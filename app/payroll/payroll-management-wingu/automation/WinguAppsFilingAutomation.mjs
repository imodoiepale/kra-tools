import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration constants
const TIMEOUT_CONFIG = {
    navigationTimeout: 120000,    // 2 minutes
    waitForLoadState: 60000,      // 1 minute
    actionTimeout: 60000,         // 1 minute
    retryDelay: 5000,             // 5 seconds
    maxRetries: 3                 // 3 retries
};

/**
 * Save progress to a JSON file
 */
function saveProgress(companyId, progress) {
    const progressPath = path.join(__dirname, 'progress', `${companyId}_filing_progress.json`);
    
    // Create directory if it doesn't exist
    const dir = path.dirname(progressPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

/**
 * Load progress from a JSON file
 */
function loadProgress(companyId) {
    const progressPath = path.join(__dirname, 'progress', `${companyId}_filing_progress.json`);
    if (fs.existsSync(progressPath)) {
        try {
            return JSON.parse(fs.readFileSync(progressPath, 'utf8'));
        } catch (error) {
            console.error('Error loading progress:', error);
            return null;
        }
    }
    return null;
}

/**
 * Setup the browser and navigate to Wingu Apps
 */
async function setupWinguAppsPage(context, credentials = {}) {
    const { username, password } = credentials;
    
    if (!username || !password) {
        throw new Error('Username and password are required for Wingu Apps login');
    }
    
    console.log('Setting up Wingu Apps page...');
    
    // Create a new page
    const page = await context.newPage();
    
    try {
        // Navigate to Wingu Apps
        await page.goto('https://apps.winguapps.com/login', { 
            timeout: TIMEOUT_CONFIG.navigationTimeout,
            waitUntil: 'networkidle'
        });
        
        // Login
        await page.fill('input[name="email"]', username);
        await page.fill('input[name="password"]', password);
        await page.click('button[type="submit"]');
        
        // Wait for navigation to complete
        await page.waitForNavigation({ 
            timeout: TIMEOUT_CONFIG.navigationTimeout,
            waitUntil: 'networkidle'
        });
        
        // Check if login was successful
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
            throw new Error('Login failed. Please check your credentials.');
        }
        
        console.log('Successfully logged in to Wingu Apps');
        return page;
    } catch (error) {
        console.error('Error setting up Wingu Apps page:', error);
        await page.close();
        throw error;
    }
}

/**
 * Navigate to the company's payroll page
 */
async function navigateToCompanyPayroll(page, companyId) {
    try {
        console.log(`Navigating to company payroll for company ID: ${companyId}`);
        
        // Navigate to the company's payroll page
        await page.goto(`https://apps.winguapps.com/payroll/company/${companyId}`, {
            timeout: TIMEOUT_CONFIG.navigationTimeout,
            waitUntil: 'networkidle'
        });
        
        // Wait for the page to load
        await page.waitForSelector('.company-header', { 
            timeout: TIMEOUT_CONFIG.waitForLoadState 
        });
        
        console.log('Successfully navigated to company payroll page');
        return true;
    } catch (error) {
        console.error('Error navigating to company payroll:', error);
        throw error;
    }
}

/**
 * File NIL returns for a company
 */
async function fileNilReturns(page, company, monthYear, filingDate) {
    try {
        console.log(`Filing NIL returns for company: ${company.name} (${monthYear})`);
        
        // Navigate to the statutory filing page
        await page.click('a:has-text("Statutory")');
        await page.waitForSelector('.statutory-container', { 
            timeout: TIMEOUT_CONFIG.waitForLoadState 
        });
        
        // Select the month and year
        const [month, year] = monthYear.split(' ');
        await page.selectOption('select[name="month"]', month.toLowerCase());
        await page.selectOption('select[name="year"]', year);
        
        // Click on the NIL filing button
        await page.click('button:has-text("File NIL")');
        
        // Wait for the confirmation dialog
        await page.waitForSelector('.confirmation-dialog', { 
            timeout: TIMEOUT_CONFIG.waitForLoadState 
        });
        
        // Confirm the NIL filing
        await page.click('.confirmation-dialog button:has-text("Confirm")');
        
        // Wait for the success message
        await page.waitForSelector('.success-message', { 
            timeout: TIMEOUT_CONFIG.waitForLoadState 
        });
        
        console.log(`Successfully filed NIL returns for company: ${company.name}`);
        return true;
    } catch (error) {
        console.error(`Error filing NIL returns for company: ${company.name}:`, error);
        throw error;
    }
}

/**
 * File regular returns for a company
 */
async function fileRegularReturns(page, company, monthYear, filingDate) {
    try {
        console.log(`Filing regular returns for company: ${company.name} (${monthYear})`);
        
        // Navigate to the statutory filing page
        await page.click('a:has-text("Statutory")');
        await page.waitForSelector('.statutory-container', { 
            timeout: TIMEOUT_CONFIG.waitForLoadState 
        });
        
        // Select the month and year
        const [month, year] = monthYear.split(' ');
        await page.selectOption('select[name="month"]', month.toLowerCase());
        await page.selectOption('select[name="year"]', year);
        
        // Upload the required documents
        // This would depend on the specific UI of Wingu Apps
        // For example:
        await page.setInputFiles('input[name="paye_csv"]', company.documents.paye_csv);
        await page.setInputFiles('input[name="hslevy_csv"]', company.documents.hslevy_csv);
        await page.setInputFiles('input[name="zip_file_kra"]', company.documents.zip_file_kra);
        await page.setInputFiles('input[name="shif_exl"]', company.documents.shif_exl);
        await page.setInputFiles('input[name="nssf_exl"]', company.documents.nssf_exl);
        
        // Click on the file button
        await page.click('button:has-text("File Returns")');
        
        // Wait for the confirmation dialog
        await page.waitForSelector('.confirmation-dialog', { 
            timeout: TIMEOUT_CONFIG.waitForLoadState 
        });
        
        // Confirm the filing
        await page.click('.confirmation-dialog button:has-text("Confirm")');
        
        // Wait for the success message
        await page.waitForSelector('.success-message', { 
            timeout: TIMEOUT_CONFIG.waitForLoadState 
        });
        
        console.log(`Successfully filed regular returns for company: ${company.name}`);
        return true;
    } catch (error) {
        console.error(`Error filing regular returns for company: ${company.name}:`, error);
        throw error;
    }
}

/**
 * Update filing status in Supabase
 */
async function updateFilingStatus(supabaseClient, recordId, filingDate, isNil) {
    try {
        console.log(`Updating filing status for record ID: ${recordId}`);
        
        const { data, error } = await supabaseClient
            .from('company_payroll_records')
            .update({
                status: {
                    filing: {
                        filingDate: filingDate.toISOString(),
                        filedBy: 'Automation',
                        isNil: isNil
                    }
                }
            })
            .eq('id', recordId);
        
        if (error) {
            throw error;
        }
        
        console.log(`Successfully updated filing status for record ID: ${recordId}`);
        return data;
    } catch (error) {
        console.error(`Error updating filing status for record ID: ${recordId}:`, error);
        throw error;
    }
}

/**
 * Main function to file returns for multiple companies
 */
async function fileCompanyReturns({ 
    companies, 
    monthYear, 
    filingDate,
    onProgress,
    supabaseUrl,
    supabaseKey,
    credentials 
}) {
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Launch browser
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        acceptDownloads: true
    });
    
    try {
        // Setup Wingu Apps page
        const page = await setupWinguAppsPage(context, credentials);
        
        // Process each company
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            const progress = (i / companies.length) * 100;
            
            // Update progress
            if (onProgress) {
                onProgress(company.id, {
                    status: 'processing',
                    progress,
                    message: `Filing returns for ${company.name}`,
                    company: company.name
                });
            }
            
            try {
                // Navigate to company payroll
                await navigateToCompanyPayroll(page, company.company_id);
                
                // Determine if this is a NIL filing
                const isNil = company.status.finalization_date === 'NIL';
                
                // File returns based on the type
                if (isNil) {
                    await fileNilReturns(page, company, monthYear, filingDate);
                } else {
                    await fileRegularReturns(page, company, monthYear, filingDate);
                }
                
                // Update filing status in Supabase
                await updateFilingStatus(supabase, company.id, filingDate, isNil);
                
                // Update progress
                if (onProgress) {
                    onProgress(company.id, {
                        status: 'completed',
                        progress: 100,
                        message: `Successfully filed returns for ${company.name}`,
                        company: company.name,
                        filingDate: filingDate.toISOString(),
                        isNil
                    });
                }
            } catch (error) {
                console.error(`Error processing company ${company.name}:`, error);
                
                // Update progress with error
                if (onProgress) {
                    onProgress(company.id, {
                        status: 'failed',
                        progress,
                        message: `Failed to file returns for ${company.name}: ${error.message}`,
                        company: company.name,
                        error: error.message
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error in fileCompanyReturns:', error);
        throw error;
    } finally {
        // Close browser
        await browser.close();
    }
}

// Export the function
export { fileCompanyReturns };
