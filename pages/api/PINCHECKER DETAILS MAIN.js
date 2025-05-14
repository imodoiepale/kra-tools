import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import os from "os";
import { createWorker } from "tesseract.js";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

const supabaseUrl = "https://zyszsqgdlrpnunkegipk.supabase.co";
const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5c3pzcWdkbHJwbnVua2VnaXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgzMjc4OTQsImV4cCI6MjAyMzkwMzg5NH0.fK_zR8wR6Lg8HeK7KBTTnyF0zoyYBqjkeWeTKqi32ws";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const readSupabaseData = async () => {
    try {
        const { data, error } = await supabase.from("PasswordChecker").select("*").order('id');
        if (error) {
            throw new Error(`Error reading data from 'PasswordChecker' table: ${error.message}`);
        }
        return data;
    } catch (error) {
        throw new Error(`Error reading Supabase data: ${error.message}`);
    }
};

const clickObligationDetails = async (page) => {
    try {
        await page.getByRole("group", { name: "Obligation Details" }).click();
        return true; // Click successful
    } catch (error) {
        console.error("Error clicking Obligation Details:", error);
        return false; // Click failed
    }
};

const processCompanyData = async (company, page) => {
    console.log("Processing company:", company.company_name);

    const maxRetries = 10; // Maximum number of retries for invalid CAPTCHA
    let retries = 0;

    // Check if KRA PIN or password is missing
    if (!company.kra_pin) {
        return {
            company_name: company.company_name,
            error: "KRA PIN Missing"
        };
    }

    while (retries < maxRetries) {
        try {
            // Check if we need to navigate to the PIN checker page
            const pinInputExists = await page.locator('input[name="vo\\.pinNo"]').isVisible()
                .catch(() => false);

            if (!pinInputExists) {
                // Only click PIN checker if we're not already on the page
                await page.locator("#logid").click();
                await page.evaluate(() => pinchecker());
                await page.waitForTimeout(1000);
            }

            const image = await page.waitForSelector("#captcha_img");
            const imagePath = path.join(os.tmpdir(), "ocr.png");
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
            await page.locator('input[name="vo\\.pinNo"]').fill(company.kra_pin);
            await page.getByRole("button", { name: "Consult" }).click();

            const invalidCaptcha = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 1000 })
                .catch(() => false);

            if (invalidCaptcha) {
                console.log(`Invalid CAPTCHA result. Retrying... (Attempt ${retries + 1} of ${maxRetries})`);
                retries++;
                // Instead of continue, we'll use throw to restart the loop
                throw new Error("Invalid CAPTCHA");
            }

            let obligationDetailsClicked = false;
            let clickRetryCount = 0;
            const maxClickRetries = 10;

            while (!obligationDetailsClicked && clickRetryCount < maxClickRetries) {
                obligationDetailsClicked = await clickObligationDetails(page);
                if (!obligationDetailsClicked) {
                    console.log(`Retrying click on Obligation Details. Attempt ${clickRetryCount + 1} of ${maxClickRetries}`);
                    clickRetryCount++;
                }
            }

            if (!obligationDetailsClicked) {
                throw new Error("Failed to click Obligation Details after maximum retries.");
            }

            const tableContent = await page.evaluate(() => {
                const table = document.querySelector(
                    "#pinCheckerForm > div:nth-child(9) > center > div > table > tbody > tr:nth-child(5) > td > fieldset > div > table"
                );
                if (!table) return "Table not found"; // Handle case where table is not found

                return table.innerText; // Return text content of the table
            });

            console.log(tableContent);

            return organizeData(company.company_name, tableContent);
        } catch (error) {
            console.error(`Error processing company ${company.company_name}: ${error}`);
            retries++;
            if (retries >= maxRetries) {
                return {
                    company_name: company.company_name,
                    error: `Failed after ${maxRetries} attempts: ${error.message}`
                };
            }
            console.log(`Retrying... (Attempt ${retries} of ${maxRetries})`);
            // The loop will automatically continue to the next iteration
        }
    }

    // This line should never be reached due to the return statement in the loop,
    // but it's good practice to have a fallback
    return {
        company_name: company.company_name,
        error: "Unexpected error: Max retries reached without resolution"
    };
};

function organizeData(companyName, tableContent) {
    // Initialize default data structure
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

    // If table content is empty or not found, return default data
    if (!tableContent || tableContent === "Table not found") {
        return data;
    }

    try {
        // Split the content into lines and remove empty lines
        const lines = tableContent.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('Obligation Name'));

        // Process each line
        lines.forEach(line => {
            const parts = line.split('\t').map(part => part.trim());

            // Ensure we have at least 3 parts (name, status, from date)
            if (parts.length >= 3) {
                const [obligationName, status, fromDate, toDate = 'Active'] = parts;

                switch (obligationName) {
                    case 'Income Tax - PAYE':
                        data.paye_status = status;
                        data.paye_effective_from = fromDate;
                        data.paye_effective_to = toDate;
                        break;
                    case 'Value Added Tax (VAT)':
                        data.vat_status = status;
                        data.vat_effective_from = fromDate;
                        data.vat_effective_to = toDate;
                        break;
                    case 'Income Tax - Company':
                        data.income_tax_company_status = status;
                        data.income_tax_company_effective_from = fromDate;
                        data.income_tax_company_effective_to = toDate;
                        break;
                    case 'Income Tax - Rent Income (MRI)':
                        data.rent_income_mri_status = status;
                        data.rent_income_mri_effective_from = fromDate;
                        data.rent_income_mri_effective_to = toDate;
                        break;
                    case 'Income Tax - Resident Individual':
                        data.resident_individual_status = status;
                        data.resident_individual_effective_from = fromDate;
                        data.resident_individual_effective_to = toDate;
                        break;
                    case 'Income Tax - Turnover Tax':
                        data.turnover_tax_status = status;
                        data.turnover_tax_effective_from = fromDate;
                        data.turnover_tax_effective_to = toDate;
                        break;
                }
            }
        });

        return data;
    } catch (error) {
        console.error(`Error processing table data for ${companyName}:`, error);
        return {
            ...data,
            error: `Data processing error: ${error.message}`
        };
    }
}

const createExcelFile = (companyData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Company Obligations");

    // Add headers
    const headers = [
        "Index",
        "Company Name",
        "Income Tax - Company Current Status",
        "Income Tax - Company Effective From Date",
        "update with this  Effective To Date",
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
        residentIndividual: 'FFB3F0D9'
    };

    // Add company data
    companyData.forEach((company, index) => {
        const rowIndex = index + 4; // Start from row 4 (row 3 is header)
        const row = worksheet.getRow(rowIndex);

        let values;

        if (company.error) {
            // If there's an error, fill in the company name and error message
            values = [
                index + 1,
                company.company_name,
                ...Array(18).fill(""), // Empty cells for obligation details
                company.error // Error message in the last column
            ];
        } else {
            values = [
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
                "" // Empty string for error column when no error
            ];
        }

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

        if (!company.error) {
            row.getCell(4).fill = row.getCell(5).fill = row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.companyTax } };
            row.getCell(7).fill = row.getCell(8).fill = row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.vat } };
            row.getCell(10).fill = row.getCell(11).fill = row.getCell(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.paye } };
            row.getCell(13).fill = row.getCell(14).fill = row.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.rentIncome } };
            row.getCell(16).fill = row.getCell(17).fill = row.getCell(18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.residentIndividual } };
            row.getCell(19).fill = row.getCell(20).fill = row.getCell(21).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.turnoverTax } };
        }

        // Set light red color for empty cells
        for (let i = 4; i <= 19; i++) {
            const cell = row.getCell(i);
            if (!cell.value) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC0CB' } }; // Light red
            }
        }

        // Set red color for error cell if there's an error
        if (company.error) {
            row.getCell(19).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; // Red
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
};

(async () => {
    const now = new Date();
    const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
    const downloadFolderPath = path.join(os.homedir(), "Downloads", `PIN CHECKER DETAILS EXTRACTOR_${formattedDateTime}`);
    await fs.promises.mkdir(downloadFolderPath, { recursive: true }).catch(console.error);

    const allCompanyData = [];
    try {
        const data = await readSupabaseData();
        const browser = await chromium.launch({ headless: false, channel: "chrome" });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto("https://itax.kra.go.ke/KRA-Portal/");

        for (let i = 0; i < data.length; i++) {
            const organizedData = await processCompanyData(data[i], page);
            if (organizedData) {
                allCompanyData.push(organizedData);
                console.log(organizedData);
            }
            const workbook = createExcelFile(allCompanyData);
            const now = new Date();
            const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
            const excelFilePath = path.join(downloadFolderPath, `PIN CHECKER DETAILS - OBLIGATIONS - ${formattedDate}.xlsx`);
            await workbook.xlsx.writeFile(excelFilePath);
        }

        await browser.close();

        console.log(`All company details written to Excel file successfully.`);
    } catch (error) {
        console.error(`Error: ${error}`);
    }
})();