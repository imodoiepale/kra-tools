// @ts-nocheck
import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import retry from "async-retry";

// Constants
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let stopRequested = false;

async function loginToECitizen(page, company) {
    await page.goto('https://accounts.ecitizen.go.ke/en/login');
    await page.getByLabel('Email address or ID number').click();
    await page.getByLabel('Email address or ID number').fill(company.identifier);
    await page.getByPlaceholder('Password').click();
    await page.getByPlaceholder('Password').fill(company.password);
    await page.getByLabel('Remember for 30 days').check();
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Check for login error
    const loginError = await page.locator('text=Invalid username or password').isVisible();
    if (loginError) {
        console.log("Login Error: Invalid username or password");
        throw new Error("Login Error");
    }

    console.log("Login successful");
}

async function logoutFromECitizen(page) {
    await page.getByRole('link', { name: 'Log out' }).click();
    console.log("Logged out from eCitizen portal.");
}

const readSupabaseData = async () => {
    try {
        const { data, error } = await supabase.from("ecitizen_companies").select("*").order('id');

        if (error) {
            throw new Error(`Error reading data from 'ecitizen_companies' table: ${error.message}`);
        }

        return data;
    } catch (error) {
        throw new Error(`Error reading Supabase data: ${error.message}`);
    }
};

const updateSupabaseStatus = async (id, status) => {
    try {
        const { error } = await supabase
            .from("ecitizen_companies")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("id", id);

        if (error) {
            throw new Error(`Error updating status in Supabase: ${error.message}`);
        }
    } catch (error) {
        console.error("Error updating Supabase:", error);
    }
};
async function processCompanies(runOption, selectedIds) {
    let data = await readSupabaseData();
    
    if (runOption === 'selected' && selectedIds && selectedIds.length > 0) {
        data = data.filter(company => selectedIds.includes(company.id));
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Password Validation");

    const headers = ["Company Name", "Identifier", "Password", "Status", "Director"];
    const headerRow = worksheet.getRow(3);
    headers.forEach((header, index) => {
        headerRow.getCell(index + 3).value = header;
        headerRow.getCell(index + 3).font = { bold: true };
    });
    headerRow.commit();

    let browser;
    let context;
    let page;

    try {
        browser = await chromium.launch({ headless: false, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
        context = await browser.newContext();
        page = await context.newPage();

        const results = [];

        for (let i = 0; i < data.length; i++) {
            if (stopRequested) {
                console.log("Validation stopped by user request.");
                break;
            }

            const company = data[i];

            if (company.password === null || company.identifier === null) {
                let status;
                if (company.password === null && company.identifier === null) {
                    status = "Identifier and Password Missing";
                } else if (company.password === null) {
                    status = "Password Missing";
                } else {
                    status = "Identifier Missing";
                }
                console.log(`Skipping ${company.name}: ${status}`);
                const row = worksheet.addRow([
                    company.name,
                    company.identifier,
                    company.password,
                    status,
                    company.director
                ]);
                row.getCell(6).fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFFFE066" },
                };
                await updateSupabaseStatus(company.id, status);
                results.push({ company: company.name, status });
                continue;
            }

            console.log("COMPANY:", company.name);
            console.log("Identifier:", company.identifier);
            console.log("Password:", company.password);

            let loginAttempt = 0;

            try {
                await retry(async () => {
                    loginAttempt++;
                    await loginToECitizen(page, company);
                }, {
                    retries: 1,
                    onRetry: async (error) => {
                        console.log(`Retrying login for ${company.name} due to error:`, error.message);
                    }
                });

                await logoutFromECitizen(page);

                await updateSupabaseStatus(company.id, "Valid");

                const row = worksheet.addRow([company.name, company.identifier, company.password, "Valid", company.director]);
                row.getCell(6).fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FF99FF99" },
                };
                results.push({ company: company.name, status: "Valid" });

            } catch (error) {
                console.error(`An error occurred for ${company.name}:`, error.message);
                if (loginAttempt > 1) {
                    console.log(`Skipping company ${company.name} with identifier ${company.identifier} after second failed attempt.`);
                    await updateSupabaseStatus(company.id, "Invalid");
                    const row = worksheet.addRow([company.name, company.identifier, company.password, "Invalid", company.director]);
                    row.getCell(6).fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFFF9999" },
                    };
                    results.push({ company: company.name, status: "Invalid" });
                }
            }
        }

        const downloadFolderPath = path.join(os.homedir(), "Downloads");
        await workbook.xlsx.writeFile(
            path.join(downloadFolderPath, `PASSWORD VALIDATION - ECITIZEN - COMPANIES.xlsx`)
        );

        return results;
    } catch (error) {
        console.error("Error in processCompanies:", error);
        throw error;
    } finally {
        if (page) await page.close();
        if (context) await context.close();
        if (browser) await browser.close();
    }
}

// API Routes
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { action, runOption, selectedIds } = req.body;

    if (action === "start") {
        try {
            stopRequested = false;
            const results = await processCompanies(runOption, selectedIds);
            return res.status(200).json({ message: "Validation completed", results });
        } catch (error) {
            console.error("Error during validation:", error);
            return res.status(500).json({ message: "An error occurred during validation", error: error.message });
        }
    }

    if (action === "stop") {
        stopRequested = true;
        return res.status(200).json({ message: "Validation stop requested" });
    }

    return res.status(400).json({ message: "Invalid action" });
}

// Helper function to handle errors
function handleError(res, error) {
    console.error("Error:", error);
    res.status(500).json({ message: "An error occurred", error: error.message });
}

// API endpoint to get validation status
export async function getValidationStatus(req, res) {
    try {
        const { data, error } = await supabase
            .from("ecitizen_companies")
            .select("name, status")
            .order("updated_at", { ascending: false })
            .limit(1);

        if (error) throw error;

        const status = data.length > 0 ? data[0].status : "No recent validations";
        res.status(200).json({ status });
    } catch (error) {
        handleError(res, error);
    }
}

// API endpoint to get validation results
export async function getValidationResults(req, res) {
    try {
        const { data, error } = await supabase
            .from("ecitizen_companies")
            .select("name, identifier, status, updated_at")
            .order("updated_at", { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        handleError(res, error);
    }
}

// API endpoint to get a list of companies
export async function getCompanies(req, res) {
    try {
        const { data, error } = await supabase
            .from("ecitizen_companies")
            .select("id, name, identifier")
            .order("name");

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        handleError(res, error);
    }
}