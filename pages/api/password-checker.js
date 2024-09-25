import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ExcelJS from "exceljs"; // Import ExcelJS library for Excel manipulation
import retry from "async-retry";
import { createWorker } from "tesseract.js";
import { createClient } from "@supabase/supabase-js";

// Constants for directories, Supabase URL, and API keys
const imagePath = path.join("./KRA/ocr.png");
const now = new Date();
const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
const downloadFolderPath = path.join(
    os.homedir(),
    "Downloads",
    `AUTO PASSWORD VALIDATION - KRA -COMPANIES - ${formattedDateTime}`
);
fs.mkdir(downloadFolderPath, { recursive: true }).catch(console.error);

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase        = createClient(supabaseUrl, supabaseAnonKey);

// Function to log in to KRA iTax portal
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

// Function to read company data from Supabase
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

// Function to update the status of a company's password in Supabase
const updateSupabaseStatus = async (id, status) => {
    try {
        const { error } = await supabase
            .from("PasswordChecker")
            .update({ status, last_checked: new Date().toISOString() })
            .eq("id", id);

        if (error) {
            throw new Error(`Error updating status in Supabase: ${error.message}`);
        }
    } catch (error) {
        console.error("Error updating Supabase:", error);
    }
};

// Main function to process all companies and validate passwords
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const data = await readSupabaseData();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Password Validation");

        // Headers starting from the 3rd row and 3rd column
        const headers = ["Company Name", "KRA PIN", "ITAX Password", "Status"];
        const headerRow = worksheet.getRow(3);
        headers.forEach((header, index) => {
            headerRow.getCell(index + 3).value = header; // Start from 3rd column
            headerRow.getCell(index + 3).font = { bold: true }; // Set headers bold
        });
        headerRow.commit();

        for (let i = 0; i < data.length; i++) {
            const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
            const context = await browser.newContext();
            const page    = await context.newPage();
            const company = data[i];

            if (company.kra_password === null || company.kra_pin === null) {
                let status;
                if (company.kra_password === null && company.kra_pin === null) {
                    status = "Pin and Password Missing";
                } else if (company.kra_password === null) {
                    status = "Password Missing";
                } else {
                    status = "Pin Missing";
                }
                console.log(`Skipping ${company.company_name}: ${status}`);
                const row = worksheet.addRow([
                    company.company_name, // Column 1
                    company.kra_pin,      // Column 2
                    company.kra_password, // Column 3
                    status                // Column 4
                ]);
                row.getCell(6).fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFFFE066" }, // Light Yellow for missing data
                };
                await updateSupabaseStatus(company.id, status);
                await workbook.xlsx.writeFile(
                    path.join(downloadFolderPath, `PASSWORD VALIDATION - KRA - COMPANIES.xlsx`)
                );
                continue; // Skip to the next company
            }
            console.log("COMPANY:", company.company_name);
            console.log("KRA PIN:", company.kra_pin);
            console.log("ITAX Password:", company.kra_password);

            await retry(async (bail) => {
                try {
                    await loginToKRA(page, company);

                    let isPasswordExpired, isAccountLocked, isInvalidLogin, menuItemNotFound;

                    await retry(
                        async (bail) => {
                            try {
                                menuItemNotFound = await page
                                    .waitForSelector("#ddtopmenubar > ul > li:nth-child(1) > a", { timeout: 2000 })
                                    .catch(() => false);

                                if (!menuItemNotFound) {
                                    isPasswordExpired = await page
                                        .waitForSelector('.formheading:has-text("YOUR PASSWORD HAS EXPIRED!")', {
                                            state: "visible",
                                            timeout: 1000,
                                        })
                                        .catch(() => false);

                                    isAccountLocked = await page
                                        .waitForSelector('b:has-text("The account has been locked.")', {
                                            state: "visible",
                                            timeout: 1000,
                                        })
                                        .catch(() => false);

                                    isInvalidLogin =
                                        !isPasswordExpired &&
                                        !isAccountLocked &&
                                        (await page
                                            .waitForSelector('b:has-text("Invalid Login Id or Password.")', {
                                                state: "visible",
                                                timeout: 1000,
                                            })
                                            .catch(() => false));
                                }
                            } catch (error) {
                                bail(error);
                            }
                        },
                        { retries: 3, minTimeout: 1000, maxTimeout: 3000 }
                    );

                    const status = isPasswordExpired
                        ? "Password Expired"
                        : isAccountLocked
                            ? "Locked"
                            : isInvalidLogin
                                ? "Invalid"
                                : "Valid";

                    const row = worksheet.addRow([null, company.company_name, company.kra_pin, company.kra_password, status]);

                    // Apply cell colors based on status
                    if (status === "Valid") {
                        row.getCell(6).fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "FFB6FBC0" }, // Light Green for valid
                        };
                    } else if (status === "Invalid") {
                        row.getCell(6).fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "FFF56B00" }, // Orange for invalid
                        };
                    } else if (status === "Password Expired") {
                        row.getCell(6).fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "FFFF0000" }, // Red for expired
                        };
                    } else if (status === "Locked") {
                        row.getCell(6).fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "FFFFE066" }, // Light Yellow for locked
                        };
                    }

                    await updateSupabaseStatus(company.id, status);
                    await workbook.xlsx.writeFile(path.join(downloadFolderPath, `PASSWORD VALIDATION - KRA - COMPANIES.xlsx`));
                    await context.close();
                    await browser.close();
                } catch (error) {
                    console.error("Error during validation:", error);
                    await context.close();
                    await browser.close();
                    bail(error);
                }
            });
        }
        await res.status(200).json({ message: "Password validation complete." });
    } catch (error) {
        console.error("Error in API handler:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
}
