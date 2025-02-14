// pages/api/password-checker.js

// @ts-nocheck
import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ExcelJS from "exceljs";
import retry from "async-retry";
import { createWorker } from "tesseract.js";
import { createClient } from "@supabase/supabase-js";

// Constants
const imagePath = path.join("./KRA/ocr.png");
const now = new Date();
const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
const downloadFolderPath = path.join(
    os.homedir(),
    "Downloads",
    `AUTO PASSWORD VALIDATION - KRA -COMPANIES - ${formattedDateTime}`
);

fs.mkdir(downloadFolderPath, { recursive: true }).catch(console.error);

// Supabase Initialization
const supabaseUrl = process.env.SUPABASE_URL;  // Store sensitive data in environment variables
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Only POST requests are allowed' });
        return;
    }

    try {
        const data = await readSupabaseData(); // Fetch data from Supabase

        // Create Excel workbook for storing results
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Password Validation");

        // Setup headers in Excel
        const headers = ["Company Name", "KRA PIN", "ITAX Password", "Status"];
        const headerRow = worksheet.getRow(3);
        headers.forEach((header, index) => {
            headerRow.getCell(index + 3).value = header;
            headerRow.getCell(index + 3).font = { bold: true };
        });
        headerRow.commit();

        for (let i = 0; i < data.length; i++) {
            const browser = await chromium.launch({ headless: true });
            const context = await browser.newContext();
            const page = await context.newPage();
            const company = data[i];

            if (!company.kra_password || !company.kra_pin) {
                let status = company.kra_password === null && company.kra_pin === null
                    ? "Pin and Password Missing"
                    : company.kra_password === null
                    ? "Password Missing"
                    : "Pin Missing";

                console.log(`Skipping ${company.company_name}: ${status}`);
                const row = worksheet.addRow([company.company_name, company.kra_pin, company.kra_password, status]);
                row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE066" } };
                await updateSupabaseStatus(company.id, status);
                await workbook.xlsx.writeFile(path.join(downloadFolderPath, `PASSWORD VALIDATION - KRA - COMPANIES.xlsx`));
                continue;
            }

            console.log(`Processing ${company.company_name}`);
            await processCompany(page, company, worksheet, workbook);
            await context.close();
            await browser.close();
        }

        res.status(200).json({ message: 'Password check completed successfully' });
    } catch (error) {
        console.error('Error during password check:', error);
        res.status(500).json({ error: error.message });
    }
}

async function processCompany(page, company, worksheet, workbook) {
    try {
        await retry(async () => {
            await loginToKRA(page, company);

            let isPasswordExpired, isAccountLocked, isInvalidLogin, menuItemNotFound;

            await retry(async () => {
                menuItemNotFound = await page
                    .waitForSelector("#ddtopmenubar > ul > li:nth-child(1) > a", { timeout: 2000 })
                    .catch(() => false);

                if (!menuItemNotFound) {
                    isPasswordExpired = await page
                        .waitForSelector('.formheading:has-text("YOUR PASSWORD HAS EXPIRED!")', { state: "visible", timeout: 1000 })
                        .catch(() => false);

                    isAccountLocked = await page
                        .waitForSelector('b:has-text("The account has been locked.")', { state: "visible", timeout: 1000 })
                        .catch(() => false);

                    isInvalidLogin = !isPasswordExpired && !isAccountLocked &&
                        (await page.waitForSelector('b:has-text("Invalid Login Id or Password.")', { state: "visible", timeout: 1000 })
                            .catch(() => false));
                }
            }, { retries: 3, minTimeout: 1000, maxTimeout: 3000 });

            const status = isPasswordExpired
                ? "Password Expired"
                : isAccountLocked
                ? "Locked"
                : isInvalidLogin
                ? "Invalid"
                : "Valid";

            const row = worksheet.addRow([company.company_name, company.kra_pin, company.kra_password, status]);
            row.getCell(6).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: status === "Valid" ? "FF99FF99" : status === "Invalid" ? "FFFF9999" : "FFFFE066" }
            };

            await updateSupabaseStatus(company.id, status);
            await workbook.xlsx.writeFile(path.join(downloadFolderPath, `PASSWORD VALIDATION - COMPANIES.xlsx`));
        }, { retries: 3, minTimeout: 1000, maxTimeout: 3000 });
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

// Helper function to log in to KRA
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
    const imagePath = path.join(downloadFolderPath, "ocr.png");
    await image.screenshot({ path: imagePath });

    const worker = await createWorker('eng', 1);
    console.log("Extracting Text...");
    let result;

    const extractResult = async () => {
        const ret = await worker.recognize(imagePath);
        const text1 = ret.data.text.slice(0, -1); // Omit the last character
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
    // Retry extracting result if unsupported operator error occurs
    while (attempts < maxAttempts) {
        try {
            await extractResult();
            break; // Exit the loop if successful
        } catch (error) {
            console.log("Re-extracting text from image...");
            attempts++;
            if (attempts < maxAttempts) {
                await page.waitForTimeout(1000); // Wait before re-attempting
                await image.screenshot({ path: imagePath }); // Re-capture the image
                continue; // Retry extracting the result
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

    // Check if login was successful
    const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 3000 })
        .catch(() => false);

    if (isInvalidLogin) {
        console.log("Wrong result of the arithmetic operation, retrying...");
        await loginToKRA(page, company);
    }
}

// Helper function to read data from Supabase
async function readSupabaseData() {
    try {
        const { data, error } = await supabase.from("PasswordChecker").select("*").order('id');
        if (error) throw new Error(`Error reading data from 'PasswordChecker' table: ${error.message}`);
        return data;
    } catch (error) {
        throw new Error(`Error reading Supabase data: ${error.message}`);
    }
}

// Helper function to update Supabase status
async function updateSupabaseStatus(id, status) {
    try {
        const { error } = await supabase.from("PasswordChecker").update({ status, last_checked: new Date().toISOString() }).eq("id", id);
        if (error) throw new Error(`Error updating status in Supabase: ${error.message}`);
    } catch (error) {
        console.error("Error updating Supabase:", error);
    }
}
