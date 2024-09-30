// pages/api/tcc-extractor.js
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
            processTCCExtraction().catch(console.error);
            return res.status(200).json({ message: "TCC extraction started" });

        case "stop":
            isRunning = false;
            return res.status(200).json({ message: "TCC extraction stopped" });

        case "progress":
            return res.status(200).json({ progress, totalCompanies, isRunning, currentCompany });

        case "getReports":
            const reports = await getReports();
            return res.status(200).json(reports);

        default:
            return res.status(400).json({ message: "Invalid action" });
    }
}

async function processTCCExtraction() {
    const companies = await readSupabaseData();
    totalCompanies = companies.length;

    const now = new Date();
    const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
    const downloadFolderPath = path.join(os.homedir(), "Downloads", `AUTO DOWNLOADS KRA DIRECTORS ONLY TCC - ${formattedDateTime}`);
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
        const text = ret.data.text.trim();
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
    const { data, error } = await supabase.storage
        .from('kra-documents')
        .upload(`${companyName}/${fileType}/${fileName}`, fileContent, {
            contentType: fileType === 'pdf' ? 'application/pdf' : 'image/png'
        });

    if (error) throw error;
    return data.path;
}

async function updateSupabaseTable(companyData, extractionDate, fullTableData) {
    const { data: existingData, error: fetchError } = await supabase
        .from('TaxComplianceCertificates')
        .select('*')
        .eq('company_pin', companyData.PIN)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    let updatedData = existingData ? { ...existingData } : { company_pin: companyData.PIN, extractions: {} };
    
    updatedData.company_name = companyData.TaxPayerName;
    updatedData.extractions[extractionDate] = {
        status: companyData.Status,
        certificate_date: companyData.CertificateDate,
        expiry_date: companyData.ExpiryDate,
        serial_no: companyData.SerialNo,
        pdf_link: companyData.pdfLink || "no doc",
        screenshot_link: companyData.screenshotLink || "no doc",
        full_table_data: fullTableData
    };

    const { data, error } = await supabase
        .from('TaxComplianceCertificates')
        .upsert(updatedData, {
            onConflict: 'company_pin',
            returning: 'minimal'
        });

    if (error) throw error;
    return data;
}

async function processCompany(company, downloadFolderPath, formattedDateTime) {
    const browser = await chromium.launch({ headless: false, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await loginToKRA(page, company);

        await page.hover("#ddtopmenubar > ul > li:nth-child(8) > a");
        await page.evaluate(() => {
            showReprintTCC();
        });

        await page.getByRole("button", { name: "Consult" }).click();
        page.once("dialog", dialog => {
            dialog.accept().catch(() => {});
        });

        await page.getByRole("button", { name: "Consult" }).click();
        page.once("dialog", dialog => {
            dialog.accept().catch(() => {});
        });

        const fullTableData = await page.$$eval('#tbl tbody tr', rows => rows.map(row => {
            const cells = row.querySelectorAll('td');
            return {
                SerialNo: cells[0].textContent.trim(),
                PIN: cells[1].textContent.trim(),
                TaxPayerName: cells[2].textContent.trim(),
                Status: cells[3].textContent.trim(),
                CertificateDate: cells[4].textContent.trim(),
                ExpiryDate: cells[5].textContent.trim(),
                CertificateSerialNo: cells[6].textContent.trim()
            };
        }));

        let pdfSupabasePath = "no doc";
        if (await page.$('a.textDecorationUnderline')) {
            const downloadPromise = page.waitForEvent("download");
            await page.click('a.textDecorationUnderline');
            const download = await downloadPromise;
            const pdfPath = path.join(
                downloadFolderPath,
                `${company.company_name} - TCC CERT - DWN- ${formattedDateTime}.pdf`
            );
            await download.saveAs(pdfPath);
            console.log("TCC certificate downloaded successfully.");
            pdfSupabasePath = await uploadToSupabase(pdfPath, company.company_name, 'pdf', formattedDateTime);
        } else {
            console.log("Download link not found. Marking as 'no doc'.");
        }

        const screenshotPath = path.join(
            downloadFolderPath,
            `${company.company_name} - TCC PAGE SCREENSHOT - DWN- ${formattedDateTime}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log("Screenshot taken successfully.");

        // Upload screenshot to Supabase Storage
        const screenshotSupabasePath = await uploadToSupabase(screenshotPath, company.company_name, 'screenshot', formattedDateTime);

        // Prepare data for Supabase table
        const latestExtraction = fullTableData[0];  // Use the first row as the latest extraction
        latestExtraction.pdfLink = pdfSupabasePath;
        latestExtraction.screenshotLink = screenshotSupabasePath;

        // Update Supabase table with full table data
        await updateSupabaseTable(latestExtraction, formattedDateTime, fullTableData);

        await page.evaluate(() => {
            logOutUser();
        });

        console.log(`Processing completed for ${company.company_name}`);
    } catch (error) {
        console.error(`Error occurred during processing for ${company.company_name}:`, error);
    } finally {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}
