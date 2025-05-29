// @ts-nocheck
require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');
const { createWorker } = require('tesseract.js');
const { createClient } = require('@supabase/supabase-js');

// Constants and configuration
const DOWNLOAD_FOLDER = process.env.DOWNLOAD_FOLDER || path.join(os.tmpdir(), 'kra-automation');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5', 10); // Number of companies to process per worker
const WORKER_ID = process.env.WORKER_ID || 'worker-1';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Initialize Supabase client
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
    logs: []
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
            headless: true, // Use headless mode for server environments
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });
        console.log('Chrome browser launched successfully!');
    } catch (error) {
        console.log("Chrome launch error:", error.message);
        console.log("Falling back to default chromium");
        // Fall back to default chromium
        automationState.currentBrowser = await chromium.launch({ 
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });
        console.log('Default Chromium browser launched successfully!');
    }

    console.log('Creating browser context...');
    automationState.currentContext = await automationState.currentBrowser.newContext();
    
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
            const imagePath = path.join(DOWNLOAD_FOLDER, `ocr-${WORKER_ID}.png`);
            await image.screenshot({ path: imagePath });

            const worker = await createWorker('eng', 1);
            let result;

            const extractResult = async () => {
                const ret = await worker.recognize(imagePath);
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

// Function to read company data from Supabase
async function readCompanyBatch(startIndex, limit) {
    try {
        console.log(`Reading company batch from index ${startIndex} with limit ${limit}...`);
        const { data, error } = await supabase
            .from("acc_portal_company_duplicate")
            .select("*")
            .order('id')
            .range(startIndex, startIndex + limit - 1);

        if (error) {
            console.error('Supabase query error:', error);
            throw new Error(`Error reading data from 'acc_portal_company_duplicate' table: ${error.message}`);
        }

        if (!data || data.length === 0) {
            console.warn('No data found in acc_portal_company_duplicate table for this batch!');
        } else {
            console.log(`Successfully retrieved ${data.length} records from acc_portal_company_duplicate table`);
        }

        return data || [];
    } catch (error) {
        console.error('Error in readCompanyBatch function:', error);
        throw new Error(`Error reading Supabase data: ${error.message}`);
    }
}

// Function to update the status of a company's password in Supabase
async function updateCompanyStatus(id, status) {
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
}

// Function to process a batch of companies
async function processBatch(startIndex, batchSize, totalCompanies) {
    try {
        console.log(`Worker ${WORKER_ID} processing batch from index ${startIndex} with size ${batchSize}`);
        await fs.mkdir(DOWNLOAD_FOLDER, { recursive: true }).catch(console.error);
        
        // Get the batch of companies to process
        const companies = await readCompanyBatch(startIndex, batchSize);
        
        if (companies.length === 0) {
            console.log(`No companies found in batch starting at ${startIndex}. Worker ${WORKER_ID} finished.`);
            return { processed: 0, success: true };
        }
        
        // Create an Excel workbook for reporting
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Password Validation");
        setupWorksheet(worksheet);
        
        console.log(`Starting to process ${companies.length} companies...`);
        let processedCount = 0;
        
        // Process each company in the batch
        for (const company of companies) {
            console.log(`Processing company ${processedCount+1}/${companies.length}: ${company.company_name}`);
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
                
                // Add to the worksheet
                addWorksheetRow(worksheet, company, status);
                processedCount++;
                
                // Update the company status in the database
                await updateCompanyStatus(company.id, status);
                
            } catch (error) {
                console.error(`Error processing company ${company.company_name}:`, error);
                status = 'Error';
                await updateCompanyStatus(company.id, status);
            } finally {
                await cleanupBrowserResources();
            }
        }
        
        // Save the Excel report
        const reportPath = path.join(DOWNLOAD_FOLDER, `PASSWORD-VALIDATION-BATCH-${startIndex}-${WORKER_ID}.xlsx`);
        await workbook.xlsx.writeFile(reportPath);
        console.log(`Batch report saved to ${reportPath}`);
        
        return { processed: processedCount, success: true };
        
    } catch (error) {
        console.error(`Error in processBatch for Worker ${WORKER_ID}:`, error);
        return { processed: 0, success: false, error: error.message };
    } finally {
        await cleanupBrowserResources();
    }
}

// Helper function to set up worksheet
function setupWorksheet(worksheet) {
    const headers = ["Company Name", "KRA PIN", "ITAX Password", "Status", "Processed By"];
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
        { width: 15 }, // Status
        { width: 15 }  // Processed By
    ];
    headerRow.commit();
}

// Helper function to add worksheet row
function addWorksheetRow(worksheet, company, status) {
    const row = worksheet.addRow([
        company.company_name,
        company.kra_pin,
        company.kra_password,
        status,
        WORKER_ID
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

// Export the worker functions
module.exports = {
    processBatch,
    readCompanyBatch
};
