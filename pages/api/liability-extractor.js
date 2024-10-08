import { chromium } from "playwright";
import path from "path";
import os from "os";
import { promises as fsPromises } from 'fs';
import { createWorker } from 'tesseract.js';
import { createClient } from "@supabase/supabase-js";
import retry from 'async-retry';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const imagePath = path.join("KRA", "ocr.png");

const downloadFolderPath = path.join(os.homedir(), "Downloads", `AUTO LIABILITIES EXTRACTION - ${new Date().toISOString().split('T')[0]}`);

let isRunning = false;
let progress = 0;
let currentCompany = '';

async function readSupabaseData(companyIds) {
    try {
        let query = supabase.from("PasswordChecker").select("*");

        if (companyIds && companyIds.length > 0) {
            query = query.in('id', companyIds);
        }

        const { data, error } = await query.order("id", { ascending: true });

        if (error) {
            throw new Error(`Error reading data from 'PasswordChecker' table: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error(`Error reading Supabase data: ${error.message}`);
        throw error;
    }
}

async function loginToKRA(page, company) {
    await page.goto("https://itax.kra.go.ke/KRA-Portal/");
    await page.locator("#logid").click();
    await page.locator("#logid").fill(company.kra_pin);
    await page.evaluate(() => {
        CheckPIN();
    });
    await page.locator('input[name="xxZTT9p2wQ"]').fill(company.kra_password);
    await page.waitForTimeout(1500);
    const image = await page.waitForSelector("#captcha_img");

    await image.screenshot({ path: imagePath });
    const worker = await createWorker('eng', 1);
    console.log("Extracting Text...");
    const ret = await worker.recognize(imagePath);
    const text1 = ret.data.text.slice(0, -1); // Omit the last character
    const text = text1.slice(0, -1);
    const numbers = text.match(/\d+/g);
    console.log('Extracted Numbers:', numbers);
    if (!numbers || numbers.length < 2) {
        throw new Error("Unable to extract valid numbers from the text.");
    }
    let result;
    if (text.includes("+")) {
        result = Number(numbers[0]) + Number(numbers[1]);
    } else if (text.includes("-")) {
        result = Number(numbers[0]) - Number(numbers[1]);
    } else {
        throw new Error("Unsupported operator.");
    }
    console.log('Result:', result.toString());
    await worker.terminate();
    await page.type("#captcahText", result.toString());
    await page.click("#loginButton");

    // Check if login was successful
    const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 3000 }).catch(() => false);

    if (isInvalidLogin) {
        console.log("Wrong result of the arithmetic operation, retrying...");
        await loginToKRA(page, company);
    }
}


async function extractTableData(page, selector) {
    const table = await page.$(selector);
    if (!table) return null;

    return await table.evaluate(table => {
        const headers = Array.from(table.querySelectorAll("thead th")).map(th => th.innerText.trim());
        const rows = Array.from(table.querySelectorAll("tbody tr")).map(row => {
            return Array.from(row.querySelectorAll("td")).map(td => {
                const input = td.querySelector('input[type="text"]');
                return input ? input.value.trim() : td.innerText.trim();
            });
        });
        return { headers, rows };
    });
}

async function extractLiabilities(page, company) {
    const liabilityData = {
        income_tax: null,
        vat: null,
        paye: null
    };

    // Extract Income Tax
    await page.locator("#cmbTaxHead").selectOption("VAT");
    await page.waitForLoadState("load");
    await page.locator("#cmbTaxHead").selectOption("IT");
    await page.locator("#cmbTaxSubHead").selectOption("4");
    await page.locator("#cmbPaymentType").selectOption("SAT");
    liabilityData.income_tax = await extractTableData(page, "#LiablibilityTbl");

    // Extract VAT
    await page.locator("#cmbTaxHead").selectOption("VAT");
    await page.locator("#cmbTaxHead").selectOption("IT");
    await page.waitForTimeout(1000);
    await page.locator("#cmbTaxHead").selectOption("VAT");
    const option9Exists = await page.locator('#cmbTaxSubHead option[value="9"]').count() > 0;
    if (option9Exists) {
        await page.locator("#cmbTaxSubHead").selectOption("9");
        await page.locator("#cmbPaymentType").selectOption("SAT");
        liabilityData.vat = await extractTableData(page, "#LiablibilityTbl");
    }

    // Extract PAYE
    await page.locator("#cmbTaxHead").selectOption("IT");
    const option7Exists = await page.locator('#cmbTaxSubHead option[value="7"]').count() > 0;
    if (option7Exists) {
        await page.locator("#cmbTaxSubHead").selectOption("7");
        await page.locator("#cmbPaymentType").selectOption("SAT");
        liabilityData.paye = await extractTableData(page, "#LiablibilityTbl");
    }

    return liabilityData;
}

async function storeLiabilityData(company, liabilityData) {
    const { data, error } = await supabase
        .from('liability_extractions')
        .upsert({
            company_name: company.company_name,
            liability_data: liabilityData,
            updated_at: new Date().toISOString(),
            extraction_date: new Date().toISOString()  // Add this line
        }, {
            onConflict: 'company_name',  // Change this line
            update: ['liability_data', 'updated_at', 'extraction_date']  // Add this line
        });

    if (error) {
        console.error('Error storing liability data:', error);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        throw error;
    }

    return data;
}

async function findChromePath() {
    const chrome64Path = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const chrome32Path = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

    if (await fsPromises.access(chrome64Path).then(() => true).catch(() => false)) {
        return chrome64Path;
    } else if (await fsPromises.access(chrome32Path).then(() => true).catch(() => false)) {
        return chrome32Path;
    }
    return null;
}


async function runAutomation(companyIds, updateProgressCallback) {
    const data = await readSupabaseData();

    const chromePath = await findChromePath();
    if (!chromePath) {
        throw new Error('Chrome executable not found');
    }


    const filteredData = companyIds ? data.filter(company => companyIds.includes(company.id)) : data;
    const totalCompanies = filteredData.length;

    for (let i = 0; i < filteredData.length; i++) {
        const company = filteredData[i];
        updateProgressCallback(company.company_name, Math.round((i / totalCompanies) * 100));

        if (!company.kra_pin || !(company.kra_pin.startsWith("P") || company.kra_pin.startsWith("A"))) {
            console.log(`Skipping ${company.company_name}: Invalid KRA PIN`);
            continue;
        }

        if (company.kra_itax_current_password === null) {
            console.log(`Skipping ${company.company_name}: Password is null`);
            continue;
        }

        const browser = await chromium.launch({
            headless: false,
            executablePath: chromePath
        });
        const context = await browser.newContext();


        const page = await context.newPage();

        try {
            await loginToKRA(page, company);
            await page.hover("#ddtopmenubar > ul > li:nth-child(6) > a");

            await page.evaluate(() => {
                showPaymentRegForm();
            });

            await page.click("#openPayRegForm");
            page.once("dialog", dialog => {
                dialog.accept().catch(() => { });
            });
            await page.click("#openPayRegForm");
            page.once("dialog", dialog => {
                dialog.accept().catch(() => { });
            });

            const liabilityData = await extractLiabilities(page, company);
            await storeLiabilityData(company, liabilityData);

            await page.evaluate(() => {
                logOutUser();
            });
            await page.waitForLoadState("load");
            await page.reload();
        } catch (error) {
            console.error(`Error processing ${company.company_name}:`, error);
        } finally {
            await page.close();
            await context.close();
            await browser.close();
        }
    }

   
    updateProgressCallback('', 100);
}

export default async function handler(req, res) {
    const { action, companyIds, runOption } = req.body; // Make sure runOption is being received

    switch (action) {
        case 'start':
            if (isRunning) {
                return res.status(400).json({ error: 'Automation is already running' });
            }
            isRunning = true;
            progress = 0;
            let companiesToProcess = [];

            if (runOption === 'all') {
                // Fetch all companies from the database
                const { data, error } = await supabase
                    .from('company_MAIN')
                    .select('id');

                if (error) {
                    isRunning = false;
                    return res.status(500).json({ error: 'Failed to fetch companies' });
                }

                // Log the fetched companies
                console.log('Fetched all companies:', data);

                companiesToProcess = data.map(company => company.id);
            } else {
                companiesToProcess = companyIds;

                // Log the selected companies
                console.log('Selected companies:', companiesToProcess);
            }

            runAutomation(companiesToProcess, updateProgress)
                .then(() => {
                    isRunning = false;
                    progress = 100;
                })
                .catch((error) => {
                    isRunning = false;
                    console.error('Automation error:', error);
                });

            return res.status(200).json({ message: 'Automation started', companiesCount: companiesToProcess.length });

        case 'stop':
            isRunning = false;
            return res.status(200).json({ message: 'Automation stopped' });

        case 'progress':
            return res.status(200).json({ isRunning, progress, currentCompany });

        case 'getResults':
            const { data, error } = await supabase
                .from('liability_extractions')
                .select('*')
                .order('extraction_date', { ascending: false });

            if (error) {
                return res.status(500).json({ error: 'Failed to fetch results' });
            }
            return res.status(200).json(data);

        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

function updateProgress(companyName, percentComplete) {
    currentCompany = companyName;
    progress = percentComplete;
}