// @ts-nocheck
require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');

// Constants and configuration
const DOWNLOAD_FOLDER = process.env.DOWNLOAD_FOLDER || path.join(os.tmpdir(), 'kra-automation');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5', 10);
const WORKER_ID = process.env.WORKER_ID || 'worker-1';
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

/**
 * Clean up browser resources
 */
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

/**
 * Initialize browser for automation
 */
async function initializeBrowser() {
    try {
        console.log('Initializing browser for manufacturer details extraction...');
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
        
        automationState.currentContext = await automationState.currentBrowser.newContext();
        automationState.currentPage = await automationState.currentContext.newPage();
        console.log('Browser initialization complete');
        return automationState.currentPage;
    } catch (error) {
        console.error('Error initializing browser:', error);
        throw error;
    }
}

/**
 * Process a single company to extract manufacturer details
 * @param {Object} company - Company object with required data
 * @returns {Object} - Processing result
 */
async function processCompany(company) {
    console.log(`Processing company: ${company.company_name || 'Unknown'}`);
    
    try {
        if (!company.kra_pin) {
            return {
                company_name: company.company_name,
                error: "KRA PIN Missing",
                status: "PIN Missing"
            };
        }
        
        await initializeBrowser();
        const page = automationState.currentPage;
        
        // Navigate to the KRA portal
        await page.goto("https://itax.kra.go.ke/KRA-Portal/");
        
        // TODO: Implement actual manufacturer details extraction logic here
        // For now, we'll just simulate extraction with a delay
        await page.waitForTimeout(2000);
        
        // Format result data
        const result = {
            company_name: company.company_name,
            kra_pin: company.kra_pin,
            manufacturer_details: {
                status: "Sample Status",
                registration_date: new Date().toISOString().split('T')[0],
                last_checked: new Date().toISOString(),
                processed_by: WORKER_ID
            }
        };
        
        // Save data to Supabase
        await saveManufacturerDetails(result);
        
        return result;
    } catch (error) {
        console.error(`Error processing ${company.company_name}:`, error);
        return {
            company_name: company.company_name,
            error: error.message,
            status: "Error"
        };
    } finally {
        await cleanupBrowserResources();
    }
}

/**
 * Save manufacturer details to Supabase
 * @param {Object} data - Manufacturer details data
 */
async function saveManufacturerDetails(data) {
    try {
        const { error } = await supabase
            .from("manufacturer_details")
            .upsert({
                company_name: data.company_name,
                kra_pin: data.kra_pin,
                status: data.manufacturer_details.status,
                registration_date: data.manufacturer_details.registration_date,
                last_checked: data.manufacturer_details.last_checked,
                processed_by: data.manufacturer_details.processed_by
            }, { onConflict: 'company_name' });

        if (error) {
            console.error("Error saving manufacturer details to database:", error);
        } else {
            console.log(`Successfully saved manufacturer details for ${data.company_name}`);
        }
    } catch (error) {
        console.error("Error in saveManufacturerDetails:", error);
    }
}

/**
 * Read company batch from Supabase
 * @param {number} startIndex - Start index for batch
 * @param {number} limit - Batch size
 * @returns {Array} - Array of company objects
 */
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

/**
 * Process a batch of companies
 * @param {number} startIndex - Start index
 * @param {number} batchSize - Batch size
 * @param {number} totalCompanies - Total companies count
 * @returns {Object} - Batch processing result
 */
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
        const worksheet = workbook.addWorksheet("Manufacturer Details");
        setupWorksheet(worksheet);
        
        console.log(`Starting to process ${companies.length} companies...`);
        let processedCount = 0;
        let results = [];
        
        // Process each company in the batch
        for (const company of companies) {
            console.log(`Processing company ${processedCount+1}/${companies.length}: ${company.company_name || 'Unknown'}`);
            let result;
            
            try {
                result = await processCompany(company);
                addWorksheetRow(worksheet, result);
                results.push(result);
                processedCount++;
                
            } catch (error) {
                console.error(`Error processing company ${company.company_name || 'Unknown'}:`, error);
                const errorResult = {
                    company_name: company.company_name,
                    kra_pin: company.kra_pin,
                    error: error.message,
                    status: "Error"
                };
                addWorksheetRow(worksheet, errorResult);
                results.push(errorResult);
            }
        }
        
        // Save the Excel report
        const reportPath = path.join(DOWNLOAD_FOLDER, `MANUFACTURER-DETAILS-BATCH-${startIndex}-${WORKER_ID}.xlsx`);
        await workbook.xlsx.writeFile(reportPath);
        console.log(`Batch report saved to ${reportPath}`);
        
        return { 
            processed: processedCount, 
            success: true,
            results
        };
        
    } catch (error) {
        console.error(`Error in processBatch for Worker ${WORKER_ID}:`, error);
        return { processed: 0, success: false, error: error.message };
    }
}

/**
 * Set up worksheet headers
 * @param {Worksheet} worksheet - Excel worksheet
 */
function setupWorksheet(worksheet) {
    const headers = ["Company Name", "KRA PIN", "Status", "Registration Date", "Processed By"];
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
        { width: 15 }, // Status
        { width: 15 }, // Registration Date
        { width: 15 }  // Processed By
    ];
    headerRow.commit();
}

/**
 * Add a row to the worksheet
 * @param {Worksheet} worksheet - Excel worksheet
 * @param {Object} data - Row data
 */
function addWorksheetRow(worksheet, data) {
    const status = data.manufacturer_details?.status || data.status || "Unknown";
    const registrationDate = data.manufacturer_details?.registration_date || "N/A";
    
    const row = worksheet.addRow([
        data.company_name || "Unknown",
        data.kra_pin || "N/A",
        status,
        registrationDate,
        WORKER_ID
    ]);

    // Color code based on status
    const statusColors = {
        'Sample Status': 'FFB6FBC0', // Green
        'Error': 'FFFF0000',         // Red
        'PIN Missing': 'FFFFD700'    // Yellow
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
    readCompanyBatch,
    processCompany
};