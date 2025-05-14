// @ts-nocheck
import { chromium } from "playwright";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";
import ExcelJS from "exceljs";
import { createWorker } from "tesseract.js";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let stopRequested = false;

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { action, runOption, selectedIds } = req.body;

    if (action === "getProgress") {
        const progress = await getAutomationProgress();
        return res.status(200).json(progress);
    }

    if (action === "stop") {
        stopRequested = true;
        await updateAutomationProgress(0, "Stopped", []);
        return res.status(200).json({ message: "Automation stop requested." });
    }

    if (action === "start") {
        const currentProgress = await getAutomationProgress();
        if (currentProgress && currentProgress.status === "Running") {
            return res.status(400).json({ message: "Automation is already in progress." });
        }

        stopRequested = false;
        await updateAutomationProgress(0, "Running", []);
        processCompanies(runOption, selectedIds).catch(console.error);
        return res.status(200).json({ message: "Automation started." });
    }

    return res.status(400).json({ message: "Invalid action." });
}

async function getAutomationProgress() {
    try {
        const { data, error } = await supabase
            .from("PinCheckerDetails_AutomationProgress")
            .select("*")
            .eq("id", 1)
            .single();

        if (error) {
            console.error("Supabase error:", error);
            return { status: "Not Started", progress: 0, logs: [] };
        }

        return data || { status: "Not Started", progress: 0, logs: [] };
    } catch (error) {
        console.error("Error getting automation progress:", error);
        return { status: "Not Started", progress: 0, logs: [] };
    }
}

async function updateAutomationProgress(progress, status, logs) {
    try {
        await supabase
            .from("PinCheckerDetails_AutomationProgress")
            .upsert({
                id: 1,
                progress,
                status,
                logs: logs || [],
                last_updated: new Date().toISOString()
            });
    } catch (error) {
        console.error("Error updating automation progress:", error);
    }
}

async function processCompanies(runOption, selectedIds) {

    let chromePath = null;
    const chrome64Path = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const chrome32Path = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

    if (existsSync(chrome64Path)) {
        chromePath = chrome64Path;
    } else if (existsSync(chrome32Path)) {
        chromePath = chrome32Path;
    }

    const browser = await chromium.launch({
        headless: false,
        executablePath: chromePath,
        channel: "chrome"
    });
    console.log("Browser launched");
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        let allCompanies = await readSupabaseData(runOption, selectedIds);
        
        // Filter out companies without KRA PIN and create a list of skipped companies
        const skippedCompanies = [];
        const companies = allCompanies.filter(company => {
            if (!company.kra_pin) {
                skippedCompanies.push({
                    company_name: company.company_name,
                    income_tax_company_status: 'No obligation',
                    income_tax_company_effective_from: 'No obligation',
                    income_tax_company_effective_to: 'No obligation',
                    vat_status: 'No obligation',
                    vat_effective_from: 'No obligation',
                    vat_effective_to: 'No obligation',
                    paye_status: 'No obligation',
                    paye_effective_from: 'No obligation',
                    paye_effective_to: 'No obligation',
                    rent_income_mri_status: 'No obligation',
                    rent_income_mri_effective_from: 'No obligation',
                    rent_income_mri_effective_to: 'No obligation',
                    resident_individual_status: 'No obligation',
                    resident_individual_effective_from: 'No obligation',
                    resident_individual_effective_to: 'No obligation',
                    turnover_tax_status: 'No obligation',
                    turnover_tax_effective_from: 'No obligation',
                    turnover_tax_effective_to: 'No obligation',
                    error_message: "KRA PIN Missing - Skipped",
                    last_checked_at: new Date().toISOString()
                });
                return false;
            }
            return true;
        });
        
        // Save the skipped companies to the database
        for (const skippedCompany of skippedCompanies) {
            await saveCompanyDetails(skippedCompany);
        }
        const allCompanyData = [];
        const now = new Date();
        const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
        const downloadFolderPath = path.join(os.homedir(), "Downloads", `PIN CHECKER DETAILS EXTRACTOR_${formattedDateTime}`);
        await fs.mkdir(downloadFolderPath, { recursive: true });

        await page.goto("https://itax.kra.go.ke/KRA-Portal/");

        for (let i = 0; i < companies.length; i++) {
            if (stopRequested) {
                console.log("Automation stopped by user request.");
                break;
            }

            const company = companies[i];
            try {
                const organizedData = await processCompanyData(company, page);
                allCompanyData.push(organizedData);
                console.log(organizedData);
                await saveCompanyDetails(organizedData);

                const workbook = createExcelFile(allCompanyData);
                const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
                const excelFilePath = path.join(downloadFolderPath, `PIN CHECKER DETAILS - OBLIGATIONS - ${formattedDate}.xlsx`);
                await workbook.xlsx.writeFile(excelFilePath);

                const progress = Math.round(((i + 1) / companies.length) * 100);
                await updateAutomationProgress(progress, "Running", allCompanyData);
            } catch (error) {
                console.error(`Error processing company ${company.company_name}:`, error);
                await updateAutomationProgress(Math.round(((i + 1) / companies.length) * 100), "Running", { companyName: company.company_name, error: error.message });
            }
        }

        await updateAutomationProgress(100, "Completed", allCompanyData);
    } catch (error) {
        console.error("Error in processCompanies:", error);
        await updateAutomationProgress(0, "Error", []);
    } finally {
        await browser.close();
    }
}

async function readSupabaseData(runOption, selectedIds) {
    try {
        let query = supabase.from("acc_portal_company_duplicate").select("*").order('id', { ascending: true });

        if (runOption === 'selected' && selectedIds.length > 0) {
            query = query.in('id', selectedIds);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error reading data from 'acc_portal_company_duplicate' table: ${error.message}`);
        }
        return data;
    } catch (error) {
        console.error(`Error reading Supabase data: ${error.message}`);
        throw error;
    }
}

async function processCompanyData(company, page) {
    console.log("Processing company:", company.company_name);

    // This check should never be reached since we filter companies without KRA PIN earlier,
    // but keeping it as a safeguard
    if (!company.kra_pin) {
        return {
            company_name: company.company_name,
            income_tax_company_status: 'No obligation',
            income_tax_company_effective_from: 'No obligation',
            income_tax_company_effective_to: 'No obligation',
            vat_status: 'No obligation',
            vat_effective_from: 'No obligation',
            vat_effective_to: 'No obligation',
            paye_status: 'No obligation',
            paye_effective_from: 'No obligation',
            paye_effective_to: 'No obligation',
            rent_income_mri_status: 'No obligation',
            rent_income_mri_effective_from: 'No obligation',
            rent_income_mri_effective_to: 'No obligation',
            resident_individual_status: 'No obligation',
            resident_individual_effective_from: 'No obligation',
            resident_individual_effective_to: 'No obligation',
            turnover_tax_status: 'No obligation',
            turnover_tax_effective_from: 'No obligation',
            turnover_tax_effective_to: 'No obligation',
            error_message: "KRA PIN Missing - Skipped"
        };
    }

    await loginToKRA(page, company);
    await clickObligationDetails(page);

    const tableContent = await page.evaluate(() => {
        const table = document.querySelector(
            "#pinCheckerForm > div:nth-child(9) > center > div > table > tbody > tr:nth-child(5) > td > fieldset > div > table"
        );
        return table ? table.innerText : "Table not found";
    });

    return organizeData(company.company_name, tableContent);
}

async function loginToKRA(page, company) {
    try {
        await page.goto("https://itax.kra.go.ke/KRA-Portal/");
        await page.locator("#logid").click();
        await page.evaluate(() => pinchecker());
        await page.waitForTimeout(1000);

        const maxAttempts = 5;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const image = await page.waitForSelector("#captcha_img");
            const imagePath = path.join(os.tmpdir(), "ocr.png");
            await image.screenshot({ path: imagePath });

            const worker = await createWorker('eng', 1);

            const ret = await worker.recognize(imagePath);
            const text1 = ret.data.text.slice(0, -1); // Omit the last character
            const text = text1.slice(0, -1);
            const numbers = text.match(/\d+/g);

            if (!numbers || numbers.length < 2) {
                console.log("Unable to extract valid numbers from the CAPTCHA. Retrying...");
                attempts++;
                continue;
            }

            let result;
            if (text.includes("+")) {
                result = Number(numbers[0]) + Number(numbers[1]);
            } else if (text.includes("-")) {
                result = Number(numbers[0]) - Number(numbers[1]);
            } else {
                console.log("Unsupported operator in CAPTCHA. Retrying...");
                attempts++;
                continue;
            }

            await worker.terminate();

            await page.type("#captcahText", result.toString());
            await page.locator('input[name="vo\\.pinNo"]').fill(company.kra_pin);
            await page.getByRole("button", { name: "Consult" }).click();

            // Check if login was successful
            const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 1000 })
                .catch(() => false);

            if (!isInvalidLogin) {
                console.log("Login successful");
                return; // Exit the function if login is successful
            }

            console.log("Wrong result of the arithmetic operation, retrying...");
            attempts++;
        }

        throw new Error("Max login attempts reached. Unable to log in.");
    } catch (error) {
        console.error("Error during KRA login:", error);
        throw error;
    }
}

async function clickObligationDetails(page) {
    try {
        await page.waitForTimeout(1000); // Wait for page to load completely
        await page.getByRole("group", { name: "Obligation Details" }).click();
        await page.waitForTimeout(1000); // Wait for details to load
        return true;
    } catch (error) {
        console.error("Error clicking Obligation Details:", error);
        return false;
    }
}

function organizeData(companyName, tableContent) {
    const lines = tableContent.split("\n").map(line => line.trim()).filter(line => line);
    const data = {
        company_name: companyName,
        income_tax_company_status: 'No obligation',
        income_tax_company_effective_from: 'No obligation',
        income_tax_company_effective_to: 'No obligation',
        vat_status: 'No obligation',
        vat_effective_from: 'No obligation',
        vat_effective_to: 'No obligation',
        paye_status: 'No obligation',
        paye_effective_from: 'No obligation',
        paye_effective_to: 'No obligation',
        rent_income_mri_status: 'No obligation',
        rent_income_mri_effective_from: 'No obligation',
        rent_income_mri_effective_to: 'No obligation',
        resident_individual_status: 'No obligation',
        resident_individual_effective_from: 'No obligation',
        resident_individual_effective_to: 'No obligation',
        turnover_tax_status: 'No obligation',
        turnover_tax_effective_from: 'No obligation',
        turnover_tax_effective_to: 'No obligation',
        error_message: ''
    };

    for (const line of lines) {
        const [obligationName, currentStatus, effectiveFromDate, effectiveToDate = ""] = line.split("\t");

        switch (obligationName) {
            case 'Income Tax - PAYE':
                data.paye_status = currentStatus;
                data.paye_effective_from = effectiveFromDate;
                data.paye_effective_to = effectiveToDate || "Active";
                break;
            case 'Value Added Tax (VAT)':
                data.vat_status = currentStatus;
                data.vat_effective_from = effectiveFromDate;
                data.vat_effective_to = effectiveToDate || "Active";
                break;
            case 'Income Tax - Company':
                data.income_tax_company_status = currentStatus;
                data.income_tax_company_effective_from = effectiveFromDate;
                data.income_tax_company_effective_to = effectiveToDate || "Active";
                break;
            case 'Income Tax - Rent Income (MRI)':
                data.rent_income_mri_status = currentStatus;
                data.rent_income_mri_effective_from = effectiveFromDate;
                data.rent_income_mri_effective_to = effectiveToDate || "Active";
                break;
            case 'Income Tax - Resident Individual':
                data.resident_individual_status = currentStatus;
                data.resident_individual_effective_from = effectiveFromDate;
                data.resident_individual_effective_to = effectiveToDate || "Active";
                break;
            case 'Income Tax - Turnover Tax':
                data.turnover_tax_status = currentStatus;
                data.turnover_tax_effective_from = effectiveFromDate;
                data.turnover_tax_effective_to = effectiveToDate || "Active";
                break;
        }
    }

    return data;
}

async function saveCompanyDetails(details) {
    const detailsWithTimestamp = {
        ...details,
        last_checked_at: new Date().toISOString()
    };

    const { error } = await supabase.from('PinCheckerDetails').upsert(detailsWithTimestamp, { onConflict: "company_name" });
    if (error) throw error;
}

function createExcelFile(companyData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Company Obligations");

    const headers = [
        "Index",
        "Company Name",
        "Income Tax - Company Current Status",
        "Income Tax - Company Effective From Date",
        "Income Tax - Company Effective To Date",
        "Value Added Tax (VAT) Current Status",
        "Value Added Tax (VAT) Effective From Date",
        "Value Added Tax (VAT) Effective To Date",
        "Income Tax - PAYE Current Status",
        "Income Tax - PAYE Effective From Date",
        "Income Tax - PAYE Effective To Date",
        "Income Tax - Rent Income (MRI) Current Status",
        "Income Tax - Rent Income (MRI) Effective From Date",
        "Income Tax - Rent Income (MRI) Effective To Date",
        "Income Tax - Resident Individual Current Status",
        "Income Tax - Resident Individual Effective From Date",
        "Income Tax - Resident Individual Effective To Date",
        "Income Tax - Turnover Tax Current Status",
        "Income Tax - Turnover Tax Effective From Date",
        "Income Tax - Turnover Tax Effective To Date",
        "Error"
    ];

    const headerRow = worksheet.getRow(3);
    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 2);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow background
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    const colors = {
        companyTax: 'FFB3E0F0',
        vat: 'FFF0D9B3',
        paye: 'FFD9F0B3',
        rentIncome: 'FFE0B3F0',
        residentIndividual: 'FFB3F0D9',
        turnoverTax: 'FFB3F0D9'
    };

    companyData.forEach((company, index) => {
        const rowIndex = index + 4; // Start from row 4 (row 3 is header)
        const row = worksheet.getRow(rowIndex);

        let values = [
            index + 1,
            company.company_name,
            company.income_tax_company_status,
            company.income_tax_company_effective_from,
            company.income_tax_company_effective_to,
            company.vat_status,
            company.vat_effective_from,
            company.vat_effective_to,
            company.paye_status,
            company.paye_effective_from,
            company.paye_effective_to,
            company.rent_income_mri_status,
            company.rent_income_mri_effective_from,
            company.rent_income_mri_effective_to,
            company.resident_individual_status,
            company.resident_individual_effective_from,
            company.resident_individual_effective_to,
            company.turnover_tax_status,
            company.turnover_tax_effective_from,
            company.turnover_tax_effective_to,
            company.error_message || ""
        ];

        values.forEach((value, cellIndex) => {
            const cell = row.getCell(cellIndex + 2);
            cell.value = value;
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        row.getCell(4).fill = row.getCell(5).fill = row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.companyTax } };
        row.getCell(7).fill = row.getCell(8).fill = row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.vat } };
        row.getCell(10).fill = row.getCell(11).fill = row.getCell(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.paye } };
        row.getCell(13).fill = row.getCell(14).fill = row.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.rentIncome } };
        row.getCell(16).fill = row.getCell(17).fill = row.getCell(18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residentIndividual } };
        row.getCell(19).fill = row.getCell(20).fill = row.getCell(21).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB3F0D9' } }; // Turnover Tax color

        for (let i = 4; i <= 21; i++) {
            const cell = row.getCell(i);
            if (!cell.value || cell.value === "No obligation") {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC0CB' } }; // Light red
            }
        }

        if (company.error_message) {
            row.getCell(22).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; // Red
        }
    });

    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 0;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength + 2;
    });

    return workbook;
}