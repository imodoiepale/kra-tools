// pages/api/pin-profile.js
import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createClient } from "@supabase/supabase-js";
import { createWorker } from 'tesseract.js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let isRunning = false;
let progress = 0;
let totalCompanies = 0;
let currentCompany = '';

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { action } = req.body;

    switch (action) {
        case "start":
            if (isRunning) {
                return res.status(400).json({ message: "Extraction is already running" });
            }
            isRunning = true;
            progress = 0;
            totalCompanies = 0;
            currentCompany = '';
            processPINProfiles().catch(console.error);
            return res.status(200).json({ message: "PIN profile extraction started" });

        case "stop":
            isRunning = false;
            return res.status(200).json({ message: "PIN profile extraction stopped" });

        case "progress":
            return res.status(200).json({ progress, totalCompanies, isRunning, currentCompany });

        case "getReports":
            const reports = await getReports();
            return res.status(200).json(reports);

        default:
            return res.status(400).json({ message: "Invalid action" });
    }
}

async function processPINProfiles() {
    const companies = await readSupabaseData();
    totalCompanies = companies.length;

    const now = new Date();
    const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
    const downloadFolderPath = path.join(os.homedir(), "Downloads", `AUTO DOWNLOADS KRA PIN PROFILE AND CERTIFICATE - ${formattedDateTime}`);
    await fs.mkdir(downloadFolderPath, { recursive: true });

    for (let i = 0; i < companies.length && isRunning; i++) {
        currentCompany = companies[i].company_name;
        await processCompany(companies[i], downloadFolderPath, formattedDateTime);
        progress = Math.round(((i + 1) / totalCompanies) * 100);
    }

    isRunning = false;
    currentCompany = '';
}

async function readSupabaseData() {
    try {
        const { data, error } = await supabase.from("PasswordChecker").select("*").order("id", { ascending: true });

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
    await page.waitForTimeout(500);

    const image = await page.waitForSelector("#captcha_img");
    const imagePath = path.join(os.tmpdir(), "ocr.png");
    await image.screenshot({ path: imagePath });

    const worker = await createWorker('eng', 1);
    console.log("Extracting Text...");
    let result;

    const extractResult = async () => {
        const ret = await worker.recognize(imagePath);
        const text1 = ret.data.text.slice(0, -1);
        const text = text1.slice(0, -1);
        const numbers = text.match(/\d+/g);
        console.log('Extracted Numbers:', numbers);

        if (!numbers || numbers.length < 2) {
            throw new Error("Unable to extract valid numbers from the text.");
        }

        if (text.includes("+")) {
            result = Number(numbers[0]) + Number(numbers[1]);
        } else if (text.includes("-")) {
            result = Number(numbers[0]) - Number(numbers[1]);
        } else {
            throw new Error("Unsupported operator.");
        }
    };

    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
        try {
            await extractResult();
            break;
        } catch (error) {
            console.log("Re-extracting text from image...");
            attempts++;
            if (attempts < maxAttempts) {
                await page.waitForTimeout(1000);
                await image.screenshot({ path: imagePath });
                continue;
            } else {
                console.log("Max attempts reached. Logging in again...");
                return loginToKRA(page, company);
            }
        }
    }

    console.log('Result:', result.toString());
    await worker.terminate();
    await page.type("#captcahText", result.toString());
    await page.click("#loginButton");

    const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 1000 })
        .catch(() => false);

    if (isInvalidLogin) {
        console.log("Wrong result of the arithmetic operation, retrying...");
        await loginToKRA(page, company);
    }
}

async function uploadToSupabase(filePath, companyName, fileType, extractionDate) {
    const fileName = `${extractionDate}_${path.basename(filePath)}`;
    const fileContent = await fs.readFile(filePath);
    
    // Check if the file already exists
    const { data: existingFile, error: listError } = await supabase.storage
        .from('kra-documents')
        .list(`${companyName}/pin-profile/`);

    if (listError) throw listError;

    const existingFileName = existingFile.find(file => file.name === fileName);

    if (existingFileName) {
        // If file exists, return the existing path
        return `${companyName}/pin-profile/${fileName}`;
    } else {
        // If file doesn't exist, upload it
        const { data, error } = await supabase.storage
            .from('kra-documents')
            .upload(`${companyName}/pin-profile/${fileName}`, fileContent, {
                contentType: 'application/pdf'
            });

        if (error) throw error;
        return data.path;
    }
}

async function updateSupabaseTable(companyData, extractionDate, pdfLink) {
    try {
        const { data: existingData, error: fetchError } = await supabase
            .from('PINProfilesAndCertificates')
            .select('*')
            .eq('company_pin', companyData.kra_pin)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        let updatedData = existingData ? { ...existingData } : { company_pin: companyData.kra_pin, extractions: {} };
        
        delete updatedData.id;
        
        updatedData.company_name = companyData.company_name;
        updatedData.extractions[extractionDate] = {
            pdf_link: pdfLink,
            pin_and_password: companyData.kra_pin && companyData.kra_password ? 'true' : 'false'
        };

        const { data, error } = await supabase
            .from('PINProfilesAndCertificates')
            .upsert(updatedData, {
                onConflict: 'company_pin',
                returning: 'minimal',
                ignoreDuplicates: false
            });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error updating Supabase table for ${companyData.company_name}:`, error);
    }
}


async function processCompany(company, downloadFolderPath, formattedDateTime) {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        if (company.kra_pin && company.kra_password) {
            await loginToKRA(page, company);

            await page.getByText("View Profile").click();
            await page.locator("#applicantType").selectOption("taxpayer");
            await page.evaluate(() => {
                submitData();
            });
            page.once("dialog", dialog => {
                dialog.accept().catch(() => {});
            });
            page.once("dialog", dialog => {
                console.log(`Dialog message: ${dialog.message()}`);
                dialog.dismiss().catch(() => {});
            });

            const page1Promise = page.waitForEvent("popup");
            await page.getByRole("button", { name: "Submit" }).click();
            const page1 = await page1Promise;
            await page.waitForTimeout(1000);

            const pdfPath = path.join(
                downloadFolderPath,
                `${company.company_name} - KRA PIN PROFILE - DWN- ${formattedDateTime}.pdf`
            );
            await page1.pdf({ path: pdfPath });

            const pdfSupabasePath = await uploadToSupabase(pdfPath, company.company_name, 'pdf', formattedDateTime);
            await updateSupabaseTable(company, formattedDateTime, pdfSupabasePath);

            await page.evaluate(() => {
                logOutUser();
            });

            console.log(`Done processing PIN Profile for ${company.company_name}`);
        } else {
            await updateSupabaseTable(company, formattedDateTime, null);
            console.log(`Skipped processing PIN Profile for ${company.company_name} due to missing PIN or password`);
        }
    } catch (error) {
        console.error(`Error occurred during processing for ${company.company_name}:`, error);
        await updateSupabaseTable(company, formattedDateTime, null);
    } finally {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

async function getReports() {
    try {
        const { data, error } = await supabase
            .from("PINProfilesAndCertificates")
            .select("*");

        if (error) {
            throw new Error(`Error fetching reports: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error(`Error fetching reports: ${error.message}`);
        throw error;
    }
}
