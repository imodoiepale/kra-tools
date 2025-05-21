// @ts-nocheck
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

// Global state management
let automationState = {
    isRunning: false,
    stopRequested: false,
    currentBrowser: null,
    currentContext: null,
    currentPage: null,
    processedCompanies: 0,
    totalCompanies: 0,
    logs: [],
    tab: null
};

// Clean up browser resources
async function cleanupBrowserResources() {
    try {
        if (automationState.currentPage) {
            await automationState.currentPage.close().catch(() => {});
        }
        if (automationState.currentContext) {
            await automationState.currentContext.close().catch(() => {});
        }
        if (automationState.currentBrowser) {
            await automationState.currentBrowser.close().catch(() => {});
        }
    } catch (error) {
        console.error('Error cleaning up browser resources:', error);
    } finally {
        automationState.currentPage = null;
        automationState.currentContext = null;
        automationState.currentBrowser = null;
    }
}

// Initialize browser
async function initializeBrowser() {
    console.log('Initializing browser...');
    try {
        // Try Chrome first
        console.log('Attempting to launch Chrome browser...');
        automationState.currentBrowser = await chromium.launch({ 
            headless: false, 
            channel: "chrome",
            args: ['--start-maximized'],
            // executablePath: process.platform === 'win32' 
            //     ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            //     : '/usr/bin/google-chrome'
        });
        console.log('Chrome browser launched successfully!');
    } catch (error) {
        console.log("Chrome launch error:", error.message);
        try {
            console.log("Trying Microsoft Edge...");
            // Try Microsoft Edge
            automationState.currentBrowser = await chromium.launch({ 
                headless: false, 
                channel: "msedge",
                args: ['--start-maximized']
            });
            console.log('Edge browser launched successfully!');
        } catch (edgeError) {
            console.log("Edge launch error:", edgeError.message);
            console.log("Falling back to default chromium");
            // Fall back to default chromium
            automationState.currentBrowser = await chromium.launch({ 
                headless: false,
                args: ['--start-maximized']
            });
            console.log('Default Chromium browser launched successfully!');
        }
    }

    console.log('Creating browser context...');
    automationState.currentContext = await automationState.currentBrowser.newContext({
        viewport: null
    });
    
    console.log('Opening new page...');
    automationState.currentPage = await automationState.currentContext.newPage();
    console.log('Browser initialization complete!');
    
    return automationState.currentPage;
}

// Enhanced login function with better error handling
async function loginToKRA(page, company) {
    const maxLoginAttempts = 3;
    let loginAttempt = 0;

    while (loginAttempt < maxLoginAttempts) {
        try {
            await page.goto("https://itax.kra.go.ke/KRA-Portal/", { timeout: 60000 });
            await page.waitForSelector("#logid", { timeout: 10000 });
            await page.locator("#logid").click();
            await page.locator("#logid").fill(company.kra_pin);
            await page.evaluate(() => {
                CheckPIN();
            });
            await page.locator('input[name="xxZTT9p2wQ"]').fill(company.kra_password);
            await page.waitForTimeout(500);

            const image = await page.waitForSelector("#captcha_img", { timeout: 10000 });
            const imagePath = path.join(downloadFolderPath, "ocr.png");
            await image.screenshot({ path: imagePath });

            const worker = await createWorker('eng', 1);
            let result;

            const extractResult = async () => {
                const ret = await worker.recognize(imagePath);
                // Use the same text processing as in the first code
                const text1 = ret.data.text.slice(0, -1); // Remove last character
                const text = text1.slice(0, -1); // Remove another last character
                console.log("Extracted Text:", text);
                
                const numbers = text.match(/\d+/g);
                console.log("Extracted Numbers:", numbers);
                
                if (!numbers || numbers.length < 2) {
                    throw new Error("Invalid captcha format");
                }
                
                // Use the same arithmetic detection logic
                if (text.includes("+")) {
                    result = Number(numbers[0]) + Number(numbers[1]);
                } else if (text.includes("-")) {
                    result = Number(numbers[0]) - Number(numbers[1]);
                } else {
                    throw new Error("Unsupported operator");
                }
                
                console.log("Result:", result.toString());
            };

            let captchaAttempts = 0;
            const maxCaptchaAttempts = 3;

            while (captchaAttempts < maxCaptchaAttempts) {
                try {
                    await extractResult();
                    break;
                } catch (error) {
                    captchaAttempts++;
                    if (captchaAttempts === maxCaptchaAttempts) {
                        throw new Error("Failed to process captcha");
                    }
                    await page.waitForTimeout(1000);
                    await image.screenshot({ path: imagePath });
                }
            }

            await worker.terminate();
            await page.type("#captcahText", result.toString());
            await page.click("#loginButton");

            // Wait for either success or error indicators
            const loginResult = await Promise.race([
                page.waitForSelector('#ddtopmenubar', { timeout: 5000 }).then(() => 'success'),
                page.waitForSelector('b:has-text("Wrong result")', { timeout: 5000 }).then(() => 'wrong_captcha'),
                page.waitForSelector('b:has-text("Invalid Login")', { timeout: 5000 }).then(() => 'invalid_login'),
                page.waitForSelector('.formheading:has-text("PASSWORD HAS EXPIRED")', { timeout: 5000 }).then(() => 'expired'),
                page.waitForSelector('b:has-text("account has been locked")', { timeout: 5000 }).then(() => 'locked')
            ]).catch(() => 'timeout');

            if (loginResult === 'success') {
                return 'Valid';
            } else if (loginResult === 'expired') {
                return 'Password Expired';
            } else if (loginResult === 'locked') {
                return 'Locked';
            } else if (loginResult === 'invalid_login') {
                return 'Invalid';
            } else if (loginResult === 'wrong_captcha') {
                loginAttempt++;
                continue;
            }

            throw new Error('Login attempt failed');
        } catch (error) {
            loginAttempt++;
            if (loginAttempt === maxLoginAttempts) {
                console.error(`Failed to login after ${maxLoginAttempts} attempts:`, error);
                return 'Error';
            }
            await page.waitForTimeout(2000);
        }
    }

    return 'Error';
}

// Function to get the last automation state
async function getLastAutomationState(tab) {
    try {
        const { data, error } = await supabase
            .from('PasswordChecker')
            .select('*')
            .eq('tab', tab)
            .order('last_checked', { ascending: true });

        if (error) {
            throw error;
        }

        // Find the last processed company
        const lastProcessed = data.findIndex(company => !company.status || company.status === 'Pending');
        return {
            processedCompanies: lastProcessed === -1 ? data.length : lastProcessed,
            companies: data
        };
    } catch (error) {
        console.error('Error getting last automation state:', error);
        return { processedCompanies: 0, companies: [] };
    }
}

// Main process function with improved error handling and state management
async function processCompanies(runOption, selectedIds, tab, isResume = false) {
    if (automationState.isRunning) {
        throw new Error("Automation is already running");
    }

    try {
        automationState.isRunning = true;
        automationState.stopRequested = false;
        automationState.tab = tab;
        automationState.logs = [];
        
        // Set initial status immediately to show the automation is initializing
        await updateAutomationProgress(0, "Initializing", [], tab);

        console.log('Fetching company data from Supabase...');
        let data = await readSupabaseData();
        console.log(`Retrieved ${data.length} companies from Supabase`);

        if (runOption === 'selected' && selectedIds?.length > 0) {
            console.log(`Filtering for selected companies: ${JSON.stringify(selectedIds)}`);
            data = data.filter(company => selectedIds.includes(company.id));
            console.log(`Filtered to ${data.length} selected companies`);
            
            // Log the first few companies to verify data
            if (data.length > 0) {
                console.log('Sample company data:', JSON.stringify(data.slice(0, 2), null, 2));
            } else {
                console.error('WARNING: No matching companies found after filtering!');
            }
        }

        // If resuming, get the last state
        let startIndex = 0;
        if (isResume) {
            const lastState = await getLastAutomationState(tab);
            startIndex = lastState.processedCompanies;
            console.log('Resuming from company index:', startIndex);
        }

        automationState.totalCompanies = data.length;
        automationState.processedCompanies = startIndex;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Password Validation");
        setupWorksheet(worksheet);

        console.log(`Starting to process ${data.length} companies from index ${startIndex}...`);

        // Process only remaining companies
        for (let i = startIndex; i < data.length; i++) {
            if (automationState.stopRequested) {
                console.log("Automation stopped by user request");
                break;
            }

            console.log(`Processing company ${i+1}/${data.length}: ${data[i].company_name}`);

            const company = data[i];
            let status;

            try {
                if (!company.kra_password || !company.kra_pin) {
                    status = !company.kra_password && !company.kra_pin 
                        ? "Pin and Password Missing"
                        : !company.kra_password 
                            ? "Password Missing" 
                            : "Pin Missing";
                } else {
                    await initializeBrowser();
                    status = await loginToKRA(automationState.currentPage, company);
                }

                addWorksheetRow(worksheet, company, status);
                
                automationState.processedCompanies = i + 1;
                automationState.logs.push({
                    company_name: company.company_name,
                    kra_pin: company.kra_pin,
                    status,
                    timestamp: new Date().toISOString()
                });

                await Promise.all([
                    updateSupabaseStatus(company.id, status),
                    workbook.xlsx.writeFile(path.join(downloadFolderPath, `PASSWORD VALIDATION - KRA - COMPANIES.xlsx`)),
                    updateAutomationProgress(
                        Math.round((automationState.processedCompanies / automationState.totalCompanies) * 100),
                        "Running",
                        automationState.logs,
                        tab
                    )
                ]);

            } catch (error) {
                console.error(`Error processing company ${company.company_name}:`, error);
                status = 'Error';
            } finally {
                await cleanupBrowserResources();
            }
        }

        const finalStatus = automationState.stopRequested ? "Stopped" : "Completed";
        await updateAutomationProgress(
            automationState.stopRequested ? 
                Math.round((automationState.processedCompanies / automationState.totalCompanies) * 100) : 
                100,
            finalStatus,
            automationState.logs,
            tab
        );

    } catch (error) {
        console.error("Error in process companies:", error);
        await updateAutomationProgress(0, "Error", automationState.logs, tab);
        throw error;
    } finally {
        await cleanupBrowserResources();
        automationState.isRunning = false;
        automationState.stopRequested = false;
    }
}

// API route handler
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { action, runOption, selectedIds, tab = 'kra' } = req.body;
    console.log('Received request:', { action, runOption, selectedIds, tab });

    try {
        switch (action) {
            case "getProgress":
                const progress = await getAutomationProgress(tab);
                return res.status(200).json(progress);

            case "stop":
                automationState.stopRequested = true;
                await cleanupBrowserResources();
                await updateAutomationProgress(
                    Math.round((automationState.processedCompanies / automationState.totalCompanies) * 100),
                    "Stopped",
                    automationState.logs,
                    tab
                );
                return res.status(200).json({ message: "Automation stopped" });

            case "start":
                if (automationState.isRunning) {
                    return res.status(400).json({ message: "Automation is already running" });
                }
                // Reset automation state on server restart if needed
                if (automationState.currentBrowser || automationState.currentContext || automationState.currentPage) {
                    await cleanupBrowserResources();
                }
                
                // Start the process and handle errors properly
                processCompanies(runOption, selectedIds, tab, false)
                    .catch(err => {
                        console.error("Critical error in processCompanies execution:", err);
                        // Update automation progress to "Error" in Supabase
                        updateAutomationProgress(
                            automationState.processedCompanies > 0 ? 
                                Math.round((automationState.processedCompanies / automationState.totalCompanies) * 100) : 0,
                            "Error",
                            [...automationState.logs, { 
                                type: "error", 
                                message: `Automation failed: ${err.message}`, 
                                timestamp: new Date().toISOString() 
                            }],
                            tab
                        ).catch(updateErr => console.error("Failed to update progress to Error state:", updateErr));
                        
                        // Reset automation state
                        automationState.isRunning = false;
                    });
                return res.status(200).json({ message: "Automation started" });

            case "resume":
                if (automationState.isRunning) {
                    return res.status(400).json({ message: "Automation is already running" });
                }
                processCompanies(runOption, selectedIds, tab, true).catch(console.error);
                return res.status(200).json({ message: "Automation resumed" });

            default:
                console.error('Invalid action received:', action);
                return res.status(400).json({ message: `Invalid action: ${action}` });
        }
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ 
            message: "Internal server error", 
            error: error.message 
        });
    }
}

// Helper function to set up worksheet
function setupWorksheet(worksheet) {
    const headers = ["Company Name", "KRA PIN", "ITAX Password", "Status"];
    const headerRow = worksheet.getRow(3);
    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 3);
        cell.value = header;
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    worksheet.columns = [
        { width: 30 }, // Company Name
        { width: 15 }, // KRA PIN
        { width: 15 }, // Password
        { width: 15 }  // Status
    ];
    headerRow.commit();
}

// Helper function to add worksheet row
function addWorksheetRow(worksheet, company, status) {
    const row = worksheet.addRow([
        company.company_name,
        company.kra_pin,
        company.kra_password,
        status
    ]);

    const statusColors = {
        'Valid': 'FFB6FBC0',
        'Invalid': 'FFF56B00',
        'Password Expired': 'FFFF0000',
        'Locked': 'FFFFE066',
        'Error': 'FFFF0000',
        'Pin Missing': 'FFFFE066',
        'Password Missing': 'FFFFE066',
        'Pin and Password Missing': 'FFFFE066'
    };

    if (statusColors[status]) {
        row.getCell(4).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: statusColors[status] }
        };
    }

    row.commit();
}

// Function to read company data from Supabase
const readSupabaseData = async () => {
    try {
        console.log('Reading data from PasswordChecker table...');
        const { data, error } = await supabase.from("acc_portal_company_duplicate").select("*").order('id');

        if (error) {
            console.error('Supabase query error:', error);
            throw new Error(`Error reading data from 'acc_portal_company_duplicate' table: ${error.message}`);
        }

        if (!data || data.length === 0) {
            console.warn('No data found in acc_portal_company_duplicate table!');
        } else {
            console.log(`Successfully retrieved ${data.length} records from acc_portal_company_duplicate table`);
        }

        return data || [];
    } catch (error) {
        console.error('Error in readSupabaseData function:', error);
        throw new Error(`Error reading Supabase data: ${error.message}`);
    }
};

// Function to update the status of a company's password in Supabase
const updateSupabaseStatus = async (id, status) => {
    try {
        console.log(`Updating status for company ID ${id} to "${status}" in acc_portal_company_duplicate table`);
        const { error } = await supabase
            .from("acc_portal_company_duplicate")
            .update({ kra_status: status, kra_last_checked: new Date().toISOString() })
            .eq("id", id);

        if (error) {
            console.error(`Error updating company ID ${id}:`, error);
            throw new Error(`Error updating status in Supabase: ${error.message}`);
        } else {
            console.log(`Successfully updated company ID ${id} status to "${status}"`);
        }
    } catch (error) {
        console.error("Error updating Supabase:", error);
    }
};

// Function to update or create automation progress
const updateAutomationProgress = async (progress, status, logs, tab) => {
    try {
        // Use a fixed ID for each tab to avoid conflicts
        // For KRA tab, use ID 1, for others use incrementing IDs
        let progressId = 1; // Default for 'kra' tab
        
        if (tab && tab !== 'kra') {
            // For other tabs, use IDs starting from 2
            progressId = tab === 'nhif' ? 2 : 
                         tab === 'nssf' ? 3 : 
                         tab === 'ecitizen' ? 4 : 5;
        }
        
        console.log(`Updating progress for tab ${tab} with ID ${progressId}`);
        
        // First check if the record exists
        const { data: existingData } = await supabase
            .from("PasswordChecker_AutomationProgress")
            .select("id")
            .eq("id", progressId)
            .single();
            
        let result;
        
        if (existingData) {
            // Update existing record
            result = await supabase
                .from("PasswordChecker_AutomationProgress")
                .update({ 
                    progress, 
                    status, 
                    logs: logs || [],
                    tab: tab || 'kra',
                    last_updated: new Date().toISOString() 
                })
                .eq("id", progressId);
        } else {
            // Insert new record with explicit ID
            result = await supabase
                .from("PasswordChecker_AutomationProgress")
                .insert({ 
                    id: progressId, 
                    progress, 
                    status, 
                    logs: logs || [],
                    tab: tab || 'kra',
                    last_updated: new Date().toISOString(),
                    created_at: new Date().toISOString()
                });
        }
        
        const { error } = result;

        if (error) {
            throw new Error(`Error updating automation progress: ${error.message}`);
        }
    } catch (error) {
        console.error("Error updating automation progress:", error);
    }
};

// Function to get automation progress
const getAutomationProgress = async (tab) => {
    try {
        // Use a fixed ID for each tab to avoid conflicts
        // For KRA tab, use ID 1, for others use incrementing IDs
        let progressId = 1; // Default for 'kra' tab
        
        if (tab && tab !== 'kra') {
            // For other tabs, use IDs starting from 2
            progressId = tab === 'nhif' ? 2 : 
                         tab === 'nssf' ? 3 : 
                         tab === 'ecitizen' ? 4 : 5;
        }
        
        console.log(`Getting progress for tab ${tab} with ID ${progressId}`);
        
        const { data, error } = await supabase
            .from("PasswordChecker_AutomationProgress")
            .select("*")
            .eq("id", progressId)
            .maybeSingle(); // Use maybeSingle instead of single to avoid errors if record doesn't exist

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

// Function to stop other running automations
async function stopOtherAutomations() {
    try {
        // Stop auto-population if running
        const autoPopResponse = await fetch('/api/auto-population', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stop' })
        });
        
        // Stop NHIF checker if running
        const nhifResponse = await fetch('/api/nhif-pass-checker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stop' })
        });
        
        // Stop NSSF checker if running
        const nssfResponse = await fetch('/api/nssf-pass-checker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stop' })
        });
        
        // Stop eCitizen checker if running
        const ecitizenResponse = await fetch('/api/ecitizen-pass-checker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stop' })
        });

        // Wait a bit for other automations to clean up
        await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
        console.error("Error stopping other automations:", error);
    }
}