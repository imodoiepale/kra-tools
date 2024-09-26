import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ExcelJS from "exceljs";
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let stopRequested = false;

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

// Function to update or create automation progress
const updateAutomationProgress = async (progress, status, logs) => {
    try {
        const { data, error } = await supabase
            .from("PasswordChecker_AutomationProgress")
            .upsert({ 
                id: 1, 
                progress, 
                status, 
                logs: logs || [],
                last_updated: new Date().toISOString() 
            });

        if (error) {
            throw new Error(`Error updating automation progress: ${error.message}`);
        }
    } catch (error) {
        console.error("Error updating automation progress:", error);
    }
};

// Function to get automation progress
const getAutomationProgress = async () => {
    try {
        const { data, error } = await supabase
            .from("PasswordChecker_AutomationProgress")
            .select("*")
            .eq("id", 1)
            .single();

        if (error) {
            console.error("Supabase error:", error);
            if (error.code === "PGRST116") {
                console.log("No data found in PasswordChecker_AutomationProgress table");
            } else {
                throw new Error(`Error getting automation progress: ${error.message}`);
            }
        }

        return data || { status: "Not Started", progress: 0, logs: [] };
    } catch (error) {
        console.error("Error getting automation progress:", error);
        return { status: "Not Started", progress: 0, logs: [] };
    }
};

// Main function to process all companies and validate passwords
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { action } = req.body;

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
        // Check if automation is already running
        const currentProgress = await getAutomationProgress();
        if (currentProgress && currentProgress.status === "Running") {
            return res.status(400).json({ message: "Automation is already in progress." });
        }

        // Reset stop request flag
        stopRequested = false;

        // Start new automation
        await updateAutomationProgress(0, "Running", []);

        // Start the automation process in the background
        processCompanies().catch(console.error);

        return res.status(200).json({ message: "Automation started." });
    }

    return res.status(400).json({ message: "Invalid action." });
}

async function processCompanies() {
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

        let logs = [];

        for (let i = 0; i < data.length; i++) {
            if (stopRequested) {
                console.log("Automation stopped by user request.");
                await updateAutomationProgress(0, "Stopped", logs);
                return;
            }

            const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
            const context = await browser.newContext();
            const page    = await context.newPage();
            const company = data[i];

            let status;

            if (company.kra_password === null || company.kra_pin === null) {
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
            } else {
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

                        status = isPasswordExpired
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

            await updateSupabaseStatus(company.id, status);
            await workbook.xlsx.writeFile(path.join(downloadFolderPath, `PASSWORD VALIDATION - KRA - COMPANIES.xlsx`));
            
            logs.push({
                company_name: company.company_name,
                kra_pin: company.kra_pin,
                kra_password: company.kra_password,
                status: status,
                timestamp: new Date().toISOString()
            });

            await updateAutomationProgress(Math.round(((i + 1) / data.length) * 100), "Running", logs);
        }

        await updateAutomationProgress(100, "Completed", logs);
    } catch (error) {
        console.error("Error in process companies:", error);
        await updateAutomationProgress(0, "Error", []);
    }
}