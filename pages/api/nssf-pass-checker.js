import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ExcelJS from "exceljs"; // Import ExcelJS library for Excel manipulation
import retry from "async-retry";
import { createClient } from "@supabase/supabase-js";

// Constants for directories, Supabase URL, and API keys
const now = new Date();
const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
const downloadFolderPath = path.join(
    os.homedir(),
    "Downloads",
    `AUTO PASSWORD VALIDATION - NSSF - COMPANIES - ${formattedDateTime}`
);
fs.mkdir(downloadFolderPath, { recursive: true }).catch(console.error);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let stopRequested = false;

async function loginToNSSF(page, company) {
    try {
        await page.goto("https://eservice.nssfkenya.co.ke/eSF24/faces/login.xhtml", { timeout: 60000 });
        await page.getByLabel('Username:').fill(company.identifier);
        await page.getByLabel('Password:').fill(company.password);
        await page.getByRole('button', { name: 'Login' }).click();
        await page.waitForLoadState("networkidle");

        // Check for login error using a more specific selector
        const loginError = await page.locator('div#heading:has-text("Login Error")').isVisible();
        if (loginError) {
            console.log("Login Error: Invalid account info.");
            await page.getByRole('button', { name: 'Back' }).click();
            throw new Error("Login Error");
        }

        console.log("Login successful");
    } catch (error) {
        if (error.message.includes("net::ERR_NAME_NOT_RESOLVED") || error.message.includes("Not Found")) {
            console.log(`Page not found for company ${company.name}, skipping to next company...`);
            throw new Error("Page Not Found");
        } else {
            throw error; // Re-throw other errors
        }
    }
}

// Function to log out from NSSF portal
async function logoutFromNSSF(page) {
    await page.getByRole('link', { name: 'Logout' }).click();
    console.log("Logged out from NSSF portal.");
}

// Function to read company data from Supabase
const readSupabaseData = async () => {
    try {
        const { data, error } = await supabase.from("nssf_companies").select("*").order('id');
        if (error) {
            throw new Error(`Error reading data from 'nssf_companies' table: ${error.message}`);
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
            .from("nssf_companies")
            .update({ status, updated_at: new Date().toISOString() })
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
        const { error } = await supabase
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

// API handler function

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
    if (action === "resume") {
        const currentProgress = await getAutomationProgress();
        if (currentProgress && currentProgress.status === "Running") {
          return res.status(400).json({ message: "Automation is already in progress." });
        }
      
        stopRequested = false;
        processCompanies(runOption, selectedIds, currentProgress.progress, currentProgress.logs).catch(console.error);
        return res.status(200).json({ message: "Automation resumed." });
      }
      

    return res.status(400).json({ message: "Invalid action." });
}

// Updated main function to process companies
async function processCompanies(runOption, selectedIds, startProgress = 0, existingLogs = []) {
    try {
        let data = await readSupabaseData();

        if (runOption === 'selected' && selectedIds && selectedIds.length > 0) {
            data = data.filter(company => selectedIds.includes(company.id));
        }

        // If resuming, skip companies that have already been processed
        if (startProgress > 0) {
            const processedCount = Math.floor((startProgress / 100) * data.length);
            data = data.slice(processedCount);
        }

        const workbook = new ExcelJS.Workbook();
        let worksheet;

        // If resuming, try to load existing Excel file
        const excelFilePath = path.join(downloadFolderPath, `PASSWORD VALIDATION - NSSF - COMPANIES.xlsx`);
        try {
            await workbook.xlsx.readFile(excelFilePath);
            worksheet = workbook.getWorksheet("Password Validation");
        } catch (error) {
            // If file doesn't exist or can't be read, create a new worksheet
            worksheet = workbook.addWorksheet("Password Validation");
            const headers = ["Company Name", "NSSF ID", "Password", "Status"];
            const headerRow = worksheet.getRow(3);
            headers.forEach((header, index) => {
                headerRow.getCell(index + 3).value = header;
                headerRow.getCell(index + 3).font = { bold: true };
            });
            headerRow.commit();
        }

        let logs = existingLogs;

        const browser = await chromium.launch({ headless: false, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
        const context = await browser.newContext();
        const page = await context.newPage();

        for (let i = 0; i < data.length; i++) {
            if (stopRequested) {
                console.log("Automation stopped by user request.");
                await updateAutomationProgress(startProgress + Math.round(((i) / data.length) * (100 - startProgress)), "Stopped", logs);
                return;
            }

            const company = data[i];
            console.log("COMPANY:", company.name);
            console.log("NSSF ID:", company.identifier);
            console.log("Password:", company.password);

            let loginAttempt = 0;

            try {
                if (company.password === null || company.identifier === null) {
                    let status;
                    if (company.password === null && company.identifier === null) {
                        status = "ID and Password Missing";
                    } else if (company.password === null) {
                        status = "Password Missing";
                    } else {
                        status = "ID Missing";
                    }
                    console.log(`Skipping ${company.name}: ${status}`);
                    const row = worksheet.addRow([
                        company.name,
                        company.identifier,
                        company.password,
                        status
                    ]);
                    row.getCell(6).fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFFFE066" },
                    };
                    await updateSupabaseStatus(company.id, status);
                    continue;
                }

                await retry(async () => {
                    loginAttempt++;
                    await loginToNSSF(page, company);
                }, {
                    retries: 1,
                    onRetry: async (error) => {
                        console.log(`Retrying login for ${company.name} due to error:`, error.message);
                    }
                });

                await logoutFromNSSF(page);
                await updateSupabaseStatus(company.id, "Valid");

                const row = worksheet.addRow([null, company.name, company.identifier, company.password, "Valid"]);
                row.getCell(6).fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FF99FF99" },
                };

                logs.push({
                    company_name: company.name,
                    identifier: company.identifier,
                    status: "Valid",
                    timestamp: new Date().toISOString()
                });

            }catch (error) {
                console.error(`An error occurred for ${company.name}:`, error.message);
                if (error.message === "Page Not Found") {
                    console.log(`Skipping company ${company.name} due to page not found error.`);
                    await updateSupabaseStatus(company.id, "Page Not Found");
                    const row = worksheet.addRow([null, company.name, company.identifier, company.password, "Page Not Found"]);
                    row.getCell(6).fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFFFA500" }, // Orange color for "Page Not Found"
                    };
                } else {
                    // Handle other errors as before
                    await updateSupabaseStatus(company.id, "Error");
                    const row = worksheet.addRow([null, company.name, company.identifier, company.password, "Error"]);
                    row.getCell(6).fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFFF9999" },
                    };
                }

                logs.push({
                    company_name: company.name,
                    identifier: company.identifier,
                    status: error.message === "Page Not Found" ? "Page Not Found" : "Error",
                    timestamp: new Date().toISOString()
                });
            }
            const currentProgress = startProgress + Math.round(((i + 1) / data.length) * (100 - startProgress));
            await updateAutomationProgress(currentProgress, "Running", logs);
        }

        await workbook.xlsx.writeFile(excelFilePath);

        await context.close();
        await browser.close();

        await updateAutomationProgress(100, "Completed", logs);
    } catch (error) {
        console.error("Error in process companies:", error);
        await updateAutomationProgress(startProgress, "Error", existingLogs);
    }
}