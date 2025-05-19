// run-automation.js
const { chromium } = require('playwright');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');
const { createWorker } = require('tesseract.js');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Global variables
let stopRequested = false;

// Main function
async function main() {
    console.log(`[${new Date().toISOString()}] Starting PIN Checker automation`);
    
    try {
        // Check if automation is already running
        const currentProgress = await getAutomationProgress();
        if (currentProgress && currentProgress.status === "Running") {
            console.log("Automation is already in progress.");
            return;
        }
        
        // Reset the automation status
        stopRequested = false;
        await updateAutomationProgress(0, "Running", []);
        
        // Start the automation process
        await processCompanies('all', []);
        
        console.log(`[${new Date().toISOString()}] PIN Checker automation completed successfully`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in PIN Checker automation:`, error);
        await updateAutomationProgress(0, "Error", [{ error: error.message }]);
    }
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
    console.log(`[${new Date().toISOString()}] Launching browser`);
    
    // Launch browser - in Docker, we need to specify proper options
    const browser = await chromium.launch({
        headless: true, // Run headless in Docker
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Get companies to process
        let companies = await readSupabaseData(runOption, selectedIds);
        console.log(`[${new Date().toISOString()}] Processing ${companies.length} companies`);
        
        const allCompanyData = [];
        const now = new Date();
        
        // Setup download folder
        const downloadFolderPath = path.join('/root/Downloads', `PIN_CHECKER_DETAILS_EXTRACTOR_${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`);
        await fs.mkdir(downloadFolderPath, { recursive: true });

        // Navigate to KRA portal
        await page.goto("https://itax.kra.go.ke/KRA-Portal/");

        // Process each company
        for (let i = 0; i < companies.length; i++) {
            if (stopRequested) {
                console.log(`[${new Date().toISOString()}] Automation stopped by user request.`);
                break;
            }

            const company = companies[i];
            try {
                console.log(`[${new Date().toISOString()}] Processing company ${i+1}/${companies.length}: ${company.company_name}`);
                
                // Process company data
                const organizedData = await processCompanyData(company, page);
                allCompanyData.push(organizedData);
                
                // Save details to the database
                await saveCompanyDetails(organizedData);

                // Create Excel file with current data
                const workbook = createExcelFile(allCompanyData);
                const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
                const excelFilePath = path.join(downloadFolderPath, `PIN_CHECKER_DETAILS_OBLIGATIONS_${formattedDate}.xlsx`);
                await workbook.xlsx.writeFile(excelFilePath);

                // Update progress
                const progress = Math.round(((i + 1) / companies.length) * 100);
                await updateAutomationProgress(progress, "Running", allCompanyData);
                
                // Add a delay to prevent rate limiting
                await page.waitForTimeout(2000);
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error processing company ${company.company_name}:`, error);
                
                // Add error to the company data
                const errorData = {
                    company_name: company.company_name,
                    error: error.message || "Unknown error occurred"
                };
                
                allCompanyData.push(errorData);
                await saveCompanyDetails(errorData);
                
                // Update progress with error
                const progress = Math.round(((i + 1) / companies.length) * 100);
                await updateAutomationProgress(progress, "Running", allCompanyData);
            }
        }

        // Mark automation as completed
        await updateAutomationProgress(100, "Completed", allCompanyData);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in processCompanies:`, error);
        await updateAutomationProgress(0, "Error", [{ error: error.message }]);
    } finally {
        // Close browser
        console.log(`[${new Date().toISOString()}] Closing browser`);
        await browser.close();
    }
}

async function readSupabaseData(runOption, selectedIds) {
    try {
        console.log(`[${new Date().toISOString()}] Reading company data from Supabase`);
        
        let query = supabase.from("acc_portal_company_duplicate").select("*").order('id', { ascending: true });

        if (runOption === 'selected' && selectedIds.length > 0) {
            query = query.in('id', selectedIds);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error reading data from 'acc_portal_company_duplicate' table: ${error.message}`);
        }
        
        console.log(`[${new Date().toISOString()}] Found ${data.length} companies to process`);
        return data;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error reading Supabase data:`, error);
        throw error;
    }
}

async function processCompanyData(company, page) {
    console.log(`[${new Date().toISOString()}] Processing company: ${company.company_name}`);

    if (!company.kra_pin) {
        console.log(`[${new Date().toISOString()}] KRA PIN missing for ${company.company_name}`);
        return {
            company_name: company.company_name,
            error: "KRA PIN Missing"
        };
    }

    // Login to KRA portal
    await loginToKRA(page, company);
    
    // Click obligation details
    await clickObligationDetails(page);

    // Extract table content
    const tableContent = await page.evaluate(() => {
        const table = document.querySelector(
            "#pinCheckerForm > div:nth-child(9) > center > div > table > tbody > tr:nth-child(5) > td > fieldset > div > table"
        );
        return table ? table.innerText : "Table not found";
    });

    // Organize the extracted data
    return organizeData(company.company_name, tableContent);
}

async function loginToKRA(page, company) {
    console.log(`[${new Date().toISOString()}] Logging in to KRA for ${company.company_name}`);
    
    await page.goto("https://itax.kra.go.ke/KRA-Portal/");
    await page.locator("#logid").click();
    await page.evaluate(() => pinchecker());
    await page.waitForTimeout(1000);

    const maxAttempts = 5;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const image = await page.waitForSelector("#captcha_img");
            const imagePath = path.join('/tmp', `ocr_${Date.now()}.png`);
            await image.screenshot({ path: imagePath });

            const worker = await createWorker('eng', 1);
            const ret = await worker.recognize(imagePath);
            
            // Clean up the OCR text
            const text1 = ret.data.text.slice(0, -1);
            const text = text1.slice(0, -1);
            const numbers = text.match(/\d+/g);

            if (!numbers || numbers.length < 2) {
                console.log(`[${new Date().toISOString()}] Unable to extract valid numbers from the CAPTCHA. Attempt ${attempts+1}/${maxAttempts}`);
                attempts++;
                await worker.terminate();
                await page.reload();
                await page.locator("#logid").click();
                await page.evaluate(() => pinchecker());
                await page.waitForTimeout(1000);
                continue;
            }

            // Calculate result based on operator
            let result;
            if (text.includes("+")) {
                result = Number(numbers[0]) + Number(numbers[1]);
            } else if (text.includes("-")) {
                result = Number(numbers[0]) - Number(numbers[1]);
            } else {
                console.log(`[${new Date().toISOString()}] Unsupported operator in CAPTCHA. Attempt ${attempts+1}/${maxAttempts}`);
                attempts++;
                await worker.terminate();
                await page.reload();
                await page.locator("#logid").click();
                await page.evaluate(() => pinchecker());
                await page.waitForTimeout(1000);
                continue;
            }

            await worker.terminate();

            // Enter CAPTCHA result and KRA PIN
            await page.type("#captcahText", result.toString());
            await page.locator('input[name="vo\\.pinNo"]').fill(company.kra_pin);
            await page.getByRole("button", { name: "Consult" }).click();

            // Wait for navigation and check for errors
            try {
                const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 2000 })
                    .then(() => true)
                    .catch(() => false);

                if (!isInvalidLogin) {
                    console.log(`[${new Date().toISOString()}] Login successful for ${company.company_name}`);
                    return; // Exit function on successful login
                }
                
                console.log(`[${new Date().toISOString()}] Wrong result for CAPTCHA. Attempt ${attempts+1}/${maxAttempts}`);
                attempts++;
                
                // Clean up for next attempt
                await page.reload();
                await page.locator("#logid").click();
                await page.evaluate(() => pinchecker());
                await page.waitForTimeout(1000);
            } catch (error) {
                // If we get here with no error detected, assume login was successful
                console.log(`[${new Date().toISOString()}] Login successful for ${company.company_name}`);
                return;
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error during login attempt ${attempts+1}:`, error);
            attempts++;
            
            // Reload page for next attempt
            await page.reload();
            await page.locator("#logid").click();
            await page.evaluate(() => pinchecker());
            await page.waitForTimeout(1000);
        }
    }

    throw new Error("Max login attempts reached. Unable to log in.");
}

async function clickObligationDetails(page) {
    try {
        console.log(`[${new Date().toISOString()}] Clicking Obligation Details tab`);
        await page.getByRole("group", { name: "Obligation Details" }).click();
        return true;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error clicking Obligation Details:`, error);
        return false;
    }
}

function organizeData(companyName, tableContent) {
    console.log(`[${new Date().toISOString()}] Organizing data for ${companyName}`);
    
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
        turnover_tax_effective_to: 'No obligation'
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
    try {
        console.log(`[${new Date().toISOString()}] Saving details for ${details.company_name} to Supabase`);
        const { error } = await supabase.from('PinCheckerDetails').upsert(details, { onConflict: "company_name" });
        if (error) throw error;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error saving company details:`, error);
        throw error;
    }
}

function createExcelFile(companyData) {
    console.log(`[${new Date().toISOString()}] Creating Excel file with ${companyData.length} company records`);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Company Obligations");

    // Add headers
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

    // Add headers starting from row 3, column 2
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

    // Define colors for each tax type
    const colors = {
        companyTax: 'FFB3E0F0',
        vat: 'FFF0D9B3',
        paye: 'FFD9F0B3',
        rentIncome: 'FFE0B3F0',
        residentIndividual: 'FFB3F0D9',
        turnoverTax: 'FFD9B3F0'
    };

    // Add company data
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
            company.error || ""
        ];

        // Add values starting from column 2
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

        // Apply colors to cells
        row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // White for index
        row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // White for company name
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' }; // Left align company name

        row.getCell(4).fill = row.getCell(5).fill = row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.companyTax } };
        row.getCell(7).fill = row.getCell(8).fill = row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.vat } };
        row.getCell(10).fill = row.getCell(11).fill = row.getCell(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.paye } };
        row.getCell(13).fill = row.getCell(14).fill = row.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.rentIncome } };
        row.getCell(16).fill = row.getCell(17).fill = row.getCell(18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residentIndividual } };
        row.getCell(19).fill = row.getCell(20).fill = row.getCell(21).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.turnoverTax } };

        // Set light red color for empty cells
        for (let i = 4; i <= 21; i++) {
            const cell = row.getCell(i);
            if (!cell.value || cell.value === "No obligation") {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC0CB' } }; // Light red
            }
        }

        // Set red color for error cell if there's an error
        if (company.error) {
            row.getCell(22).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; // Red
        }
    });

    // Autofit columns
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

// Run the main function
main().catch(error => {
    console.error(`[${new Date().toISOString()}] Unhandled error in main function:`, error);
    process.exit(1);
});
