// pages/api/auto-population.js
import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createClient } from "@supabase/supabase-js";
import { createWorker } from 'tesseract.js';
import ExcelJS from 'exceljs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let isRunning = false;
let progress = 0;
let totalCompanies = 0;
let currentCompany = '';

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { action, companyIds, month, year } = req.body;

    switch (action) {
        case "start":
            if (isRunning) {
                return res.status(400).json({ message: "Auto-population is already running" });
            }
            isRunning = true;
            progress = 0;
            totalCompanies = 0;
            currentCompany = '';
            processAutoPopulation(companyIds, month, year).catch(console.error);
            return res.status(200).json({ message: "VAT auto-population started" });

        case "stop":
            isRunning = false;
            return res.status(200).json({ message: "VAT auto-population stopped" });

        case "progress":
            return res.status(200).json({ progress, totalCompanies, isRunning, currentCompany });

        case "getReports":
            const reports = await getReports();
            return res.status(200).json(reports);

        default:
            return res.status(400).json({ message: "Invalid action" });
    }
}

async function processAutoPopulation(companyIds, month, year) {
    const companies = companyIds ? await readSupabaseData(companyIds) : await readSupabaseData();
    totalCompanies = companies.length;

    const formattedDateTime = `${year}-${month.toString().padStart(2, '0')}`;
    const downloadFolderPath = path.join(os.homedir(), "Downloads", `AUTO-POPULATE-${formattedDateTime}`);
    await fs.mkdir(downloadFolderPath, { recursive: true });

    for (let i = 0; i < companies.length && isRunning; i++) {
        currentCompany = companies[i].company_name;
        await processCompany(companies[i], downloadFolderPath, formattedDateTime, month, year);
        progress = Math.round(((i + 1) / totalCompanies) * 100);
    }

    isRunning = false;
    currentCompany = '';
}

async function readSupabaseData(companyIds) {
    try {
        let query = supabase.from("AutoPopulation").select("*");
        if (companyIds && companyIds.length > 0) {
            query = query.in('id', companyIds);
        }
        const { data, error } = await query.order("id", { ascending: true });

        if (error) {
            throw new Error(`Error reading data from 'AutoPopulation' table: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error(`Error reading Supabase data: ${error.message}`);
        throw error;
    }
}

async function processCompany(company, downloadFolderPath, formattedDateTime, month, year) {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await loginToKRA(page, company);
        await navigateToVAT(page, month, year);
        const documents = await downloadDocuments(page, company, downloadFolderPath, formattedDateTime);
        const monthlyData = await extractMonthlyData(documents.vat_excel);
        await uploadToSupabase(company, formattedDateTime, documents, monthlyData);

        console.log(`Processed ${company.company_name} for ${formattedDateTime}`);
    } catch (error) {
        console.error(`Error processing ${company.company_name}:`, error);
        await updateSupabaseError(company, formattedDateTime, error.message);
    } finally {
        await browser.close();
    }
}

async function loginToKRA(page, company) {
    await page.goto("https://itax.kra.go.ke/KRA-Portal/");
    await page.goto("https://itax.kra.go.ke/KRA-Portal/");
    await page.locator("#logid").click();
    await page.locator("#logid").fill(company.kra_pin);
    await page.evaluate(() => {
        CheckPIN();
    });
    await page.locator('input[name="xxZTT9p2wQ"]').fill(company.kra_itax_current_password);
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
    const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 3000 })
        .catch(() => false);

    if (isInvalidLogin) {
        console.log("Wrong result of the arithmetic operation, retrying...");
        await loginToKRA(page, company);
    }
}

async function navigateToVAT(page, month, year) {
    // Implement navigation to VAT page for specific month and year
}

async function downloadDocuments(page, company, downloadFolderPath, formattedDateTime) {
    const documents = {};

    // Download ZIP file
    const zipPromise = page.waitForEvent('download');
    await page.click('#downloadZipButton'); // Replace with actual selector
    const zipDownload = await zipPromise;
    const zipPath = path.join(downloadFolderPath, `${company.company_name}-${formattedDateTime}-VAT.zip`);
    await zipDownload.saveAs(zipPath);
    documents.zip = zipPath;

    // Download VAT Excel file
    const excelPromise = page.waitForEvent('download');
    await page.click('#downloadExcelButton'); // Replace with actual selector
    const excelDownload = await excelPromise;
    const excelPath = path.join(downloadFolderPath, `${company.company_name}-${formattedDateTime}-VAT.xlsx`);
    await excelDownload.saveAs(excelPath);
    documents.vat_excel = excelPath;

    // Download other documents as needed

    return documents;
}

async function extractMonthlyData(excelPath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.getWorksheet(1);

    // Extract relevant data from the Excel file
    const monthlyData = {
        total_sales: worksheet.getCell('B10').value, // Example cell
        total_vat: worksheet.getCell('C10').value,   // Example cell
        // Add more fields as needed
    };

    return monthlyData;
}

async function uploadToSupabase(company, formattedDateTime, documents, monthlyData) {
    const { data, error } = await supabase
        .from('AutoPopulation')
        .select('extractions')
        .eq('company_pin', company.company_pin)
        .single();

    if (error) throw error;

    const extractions = data.extractions || {};
    extractions[formattedDateTime] = {
        extraction_date: new Date().toISOString(),
        status: 'success',
        documents: {},
        monthly_data: monthlyData
    };

    // Upload documents to Supabase storage and store public URLs
    for (const [docType, filePath] of Object.entries(documents)) {
        const fileName = path.basename(filePath);
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('auto-population-documents')
            .upload(`${company.company_pin}/${formattedDateTime}/${fileName}`, fs.createReadStream(filePath));

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from('auto-population-documents')
            .getPublicUrl(`${company.company_pin}/${formattedDateTime}/${fileName}`);

        extractions[formattedDateTime].documents[docType] = publicUrlData.publicUrl;
    }

    const { error: updateError } = await supabase
        .from('AutoPopulation')
        .update({ extractions })
        .eq('company_pin', company.company_pin);

    if (updateError) throw updateError;
}

async function updateSupabaseError(company, formattedDateTime, errorMessage) {
    const { data, error } = await supabase
        .from('AutoPopulation')
        .select('extractions')
        .eq('company_pin', company.company_pin)
        .single();

    if (error) throw error;

    const extractions = data.extractions || {};
    extractions[formattedDateTime] = {
        extraction_date: new Date().toISOString(),
        status: 'error',
        error_message: errorMessage
    };

    const { error: updateError } = await supabase
        .from('AutoPopulation')
        .update({ extractions })
        .eq('company_pin', company.company_pin);

    if (updateError) throw updateError;
}

async function getReports() {
    try {
        const { data, error } = await supabase
            .from("AutoPopulation")
            .select("*");

        if (error) {
            throw new Error(`Error fetching reports: ${error.message}`);
        }

        // Process the data to extract all extractions for each company
        const processedData = data.map(company => {
            const extractions = company.extractions;
            const processedExtractions = Object.entries(extractions).map(([date, extraction]) => ({
                date,
                ...extraction,
            }));

            return {
                id: company.id,
                company_name: company.company_name,
                company_pin: company.company_pin,
                extractions: processedExtractions,
            };
        });

        return processedData;
    } catch (error) {
        console.error(`Error fetching reports: ${error.message}`);
        throw error;
    }
}