// automations/pin-checker/worker.js
import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ExcelJS from "exceljs";
import { createWorker } from "tesseract.js";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Process a single company
 * @param {Object} company - Company object with kra_pin and company_name
 * @returns {Object} - Processed company data
 */
export async function processCompany(company) {
    console.log(`Processing company: ${company.company_name}`);

    if (!company.kra_pin) {
        console.log(`Skipping ${company.company_name}: No KRA PIN`);
        return {
            company_name: company.company_name,
            error: "KRA PIN Missing"
        };
    }

    const browser = await chromium.launch({
        headless: true, // Use true for production
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const context = await browser.newContext();
        const page = await context.newPage();

        await loginToKRA(page, company);
        await clickObligationDetails(page);

        // Extract company data
        const extractedData = await extractCompanyData(page);

        // Format the data for storage
        const formattedData = formatExtractedData(company.company_name, extractedData);

        // Save to database
        await saveCompanyDetails(formattedData);

        console.log(`Successfully processed ${company.company_name}`);
        return formattedData;
    } catch (error) {
        console.error(`Error processing ${company.company_name}:`, error);
        return {
            company_name: company.company_name,
            error: error.message
        };
    } finally {
        await browser.close();
    }
}

/**
 * Login to KRA website with company credentials
 * @param {Page} page - Playwright page
 * @param {Object} company - Company object with kra_pin
 */
async function loginToKRA(page, company) {
    console.log(`Logging in to KRA for ${company.company_name}`);
    await page.goto("https://itax.kra.go.ke/KRA-Portal/");
    await page.locator("#logid").click();
    await page.evaluate(() => pinchecker());
    await page.waitForTimeout(1000);

    const maxAttempts = 5;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const image = await page.waitForSelector("#captcha_img");
            const imagePath = path.join(os.tmpdir(), `ocr_${Date.now()}.png`);
            await image.screenshot({ path: imagePath });

            const worker = await createWorker('eng', 1);
            const ret = await worker.recognize(imagePath);

            // Clean up the temporary image file
            await fs.unlink(imagePath).catch(err => console.error("Error deleting temporary file:", err));

            const text1 = ret.data.text.slice(0, -1); // Omit the last character
            const text = text1.slice(0, -1);
            const numbers = text.match(/\d+/g);

            if (!numbers || numbers.length < 2) {
                console.log(`Attempt ${attempts + 1}: Unable to extract valid numbers from CAPTCHA. Retrying...`);
                attempts++;
                await worker.terminate();
                await page.reload();
                await page.locator("#logid").click();
                await page.evaluate(() => pinchecker());
                await page.waitForTimeout(1000);
                continue;
            }

            let result;
            if (text.includes("+")) {
                result = Number(numbers[0]) + Number(numbers[1]);
            } else if (text.includes("-")) {
                result = Number(numbers[0]) - Number(numbers[1]);
            } else {
                console.log(`Attempt ${attempts + 1}: Unsupported operator in CAPTCHA. Retrying...`);
                attempts++;
                await worker.terminate();
                await page.reload();
                await page.locator("#logid").click();
                await page.evaluate(() => pinchecker());
                await page.waitForTimeout(1000);
                continue;
            }

            await worker.terminate();

            await page.type("#captcahText", result.toString());
            await page.locator('input[name="vo\\.pinNo"]').fill(company.kra_pin);
            await page.getByRole("button", { name: "Consult" }).click();

            // Check if login was successful
            try {
                const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', {
                    state: 'visible',
                    timeout: 3000
                });

                if (isInvalidLogin) {
                    console.log(`Attempt ${attempts + 1}: Wrong result of the arithmetic operation, retrying...`);
                    attempts++;
                    await page.reload();
                    await page.locator("#logid").click();
                    await page.evaluate(() => pinchecker());
                    await page.waitForTimeout(1000);
                    continue;
                }
            } catch (error) {
                // No error means login was successful
                console.log(`Login successful for ${company.company_name}`);
                return;
            }
        } catch (error) {
            console.error(`Login attempt ${attempts + 1} failed:`, error);
            attempts++;
            await page.reload();
            await page.locator("#logid").click();
            await page.evaluate(() => pinchecker());
            await page.waitForTimeout(1000);
        }
    }

    throw new Error(`Max login attempts (${maxAttempts}) reached for ${company.company_name}. Unable to log in.`);
}

/**
 * Click the Obligation Details section
 * @param {Page} page - Playwright page
 * @returns {boolean} - Success status
 */
async function clickObligationDetails(page) {
    try {
        await page.getByRole("group", { name: "Obligation Details" }).click();
        await page.waitForTimeout(1000); // Wait for content to load
        return true;
    } catch (error) {
        console.error("Error clicking Obligation Details:", error);
        return false;
    }
}

/**
 * Extract company data from the page
 * @param {Page} page - Playwright page
 * @returns {Object} - Extracted data
 */
async function extractCompanyData(page) {
    return await page.evaluate(() => {
        // Function to extract data from the table
        function extractTableData() {
            const result = {
                taxpayerDetails: {},
                obligationDetails: [],
                electronicTaxInvoicing: {},
                vatCompliance: {}
            };

            // Get the main table container
            const mainTable = document.querySelector('#pinCheckerForm > div:nth-child(9) > center > div > table');
            if (!mainTable) {
                console.error('Main table not found');
                return result;
            }

            // Extract Taxpayer Details (3rd row in the main table)
            const taxpayerRow = mainTable.querySelector('tr:nth-child(3)');
            if (taxpayerRow) {
                const taxpayerTable = taxpayerRow.querySelector('table');
                if (taxpayerTable) {
                    const rows = taxpayerTable.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td.textAlignLeft');
                        if (cells.length >= 4) {
                            result.taxpayerDetails[cells[0].textContent.trim().replace(':', '')] = cells[1].textContent.trim();
                            result.taxpayerDetails[cells[2].textContent.trim().replace(':', '')] = cells[3].textContent.trim();
                        }
                    });
                }
            }

            // Extract Obligation Details (5th row in the main table)
            const obligationRow = mainTable.querySelector('tr:nth-child(5)');
            if (obligationRow) {
                const obligationTable = obligationRow.querySelector('table.tab3');
                if (obligationTable) {
                    const rows = obligationTable.querySelectorAll('tr');
                    for (let i = 1; i < rows.length; i++) { // Skip header row
                        const cells = rows[i].querySelectorAll('td');
                        if (cells.length >= 4) {
                            result.obligationDetails.push({
                                obligationName: cells[0].textContent.trim(),
                                currentStatus: cells[1].textContent.trim(),
                                effectiveFromDate: cells[2].textContent.trim(),
                                effectiveToDate: cells[3].textContent.trim() || 'Active'
                            });
                        }
                    }
                }
            }

            // Extract Electronic Tax Invoicing (7th row in the main table)
            const etimsRow = mainTable.querySelector('tr:nth-child(7)');
            if (etimsRow) {
                const etimsTable = etimsRow.querySelector('table');
                if (etimsTable) {
                    const rows = etimsTable.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td.textAlignLeft');
                        if (cells.length >= 4) {
                            result.electronicTaxInvoicing[cells[0].textContent.trim().replace(':', '')] = cells[1].textContent.trim();
                            if (cells.length > 2) {
                                result.electronicTaxInvoicing[cells[2].textContent.trim().replace(':', '')] = cells[3].textContent.trim();
                            }
                        }
                    });
                }
            }

            // Extract VAT Compliance
            const vatComplianceCell = document.querySelector('#pinCheckerForm > div:nth-child(9) > center > div > table > tbody > tr:nth-child(8) > td');
            if (vatComplianceCell) {
                const vatTable = vatComplianceCell.querySelector('table');
                if (vatTable) {
                    const statusCell = vatTable.querySelector('td.textAlignLeft');
                    if (statusCell) {
                        result.vatCompliance.status = statusCell.textContent.trim();
                    }
                }
            }

            return result;
        }

        return extractTableData();
    });
}

/**
 * Format extracted data for storage
 * @param {string} companyName - Company name
 * @param {Object} extractedData - Raw extracted data
 * @returns {Object} - Formatted data
 */
function formatExtractedData(companyName, extractedData) {
    // Convert the extracted data to the original format for backwards compatibility
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
        etims_registration: extractedData.electronicTaxInvoicing['eTIMS Registration'] || 'Unknown',
        tims_registration: extractedData.electronicTaxInvoicing['TIMS Registration'] || 'Unknown',
        vat_compliance: extractedData.vatCompliance.status || 'Unknown',
        pin_status: extractedData.taxpayerDetails['PIN Status'] || 'Unknown',
        itax_status: extractedData.taxpayerDetails['iTax Status'] || 'Unknown'
    };

    // Map the obligation details to the correct fields
    if (extractedData.obligationDetails && extractedData.obligationDetails.length > 0) {
        for (const obligation of extractedData.obligationDetails) {
            switch (obligation.obligationName) {
                case 'Income Tax - PAYE':
                    data.paye_status = obligation.currentStatus;
                    data.paye_effective_from = obligation.effectiveFromDate;
                    data.paye_effective_to = obligation.effectiveToDate;
                    break;
                case 'Value Added Tax (VAT)':
                    data.vat_status = obligation.currentStatus;
                    data.vat_effective_from = obligation.effectiveFromDate;
                    data.vat_effective_to = obligation.effectiveToDate;
                    break;
                case 'Income Tax - Company':
                    data.income_tax_company_status = obligation.currentStatus;
                    data.income_tax_company_effective_from = obligation.effectiveFromDate;
                    data.income_tax_company_effective_to = obligation.effectiveToDate;
                    break;
                case 'Income Tax - Rent Income (MRI)':
                    data.rent_income_mri_status = obligation.currentStatus;
                    data.rent_income_mri_effective_from = obligation.effectiveFromDate;
                    data.rent_income_mri_effective_to = obligation.effectiveToDate;
                    break;
                case 'Income Tax - Resident Individual':
                    data.resident_individual_status = obligation.currentStatus;
                    data.resident_individual_effective_from = obligation.effectiveFromDate;
                    data.resident_individual_effective_to = obligation.effectiveToDate;
                    break;
                case 'Income Tax - Turnover Tax':
                    data.turnover_tax_status = obligation.currentStatus;
                    data.turnover_tax_effective_from = obligation.effectiveFromDate;
                    data.turnover_tax_effective_to = obligation.effectiveToDate;
                    break;
            }
        }
    }

    // Add timestamp for when this company was checked
    data.last_checked_at = new Date().toISOString();

    return data;
}

/**
 * Save company details to the database
 * @param {Object} details - Company details to save
 */
async function saveCompanyDetails(details) {
    try {
        const { error } = await supabase
            .from('PinCheckerDetails')
            .upsert(details, { onConflict: "company_name" });

        if (error) {
            throw error;
        }

        console.log(`Successfully saved details for ${details.company_name}`);
    } catch (error) {
        console.error(`Error saving details for ${details.company_name}:`, error);
        throw error;
    }
}