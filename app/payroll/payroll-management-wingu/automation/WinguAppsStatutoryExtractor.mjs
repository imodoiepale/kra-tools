import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import os from 'os';
import xlsx from 'xlsx';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get current month and year for folder structure
const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const currentDate = new Date();
const monthYear = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

// Configuration constants
const TIMEOUT_CONFIG = {
    navigationTimeout: 120000,    // 2 minutes
    waitForLoadState: 60000,      // 1 minute
    downloadTimeout: 180000,      // 3 minutes
    retryDelay: 5000,            // 5 seconds
    maxRetries: 3                 // Changed to 3 retries
};

// Configuration for document paths in database
const DOCUMENT_PATHS = {
    HOUSING: 'housing_levy_file',
    PAYE: 'paye_file',
    SHIF: 'shif_file',
    NSSF: 'nssf_file',
    PAYSLIPS: 'payslips_file'
};

// Configuration for document types
const DOCUMENT_TYPES = {
    HOUSING: {
        name: 'Housing Levy',
        menuLink: 'Export',
        subMenuLink: 'Export Payroll Data to Housing Levy Upload Data File',
        downloadLink: 'Download Housing Levy format',
        fileExtension: 'csv',
        filePrefix: 'HOUSING LEVY',
        pageIndex: 0,
        subFolder: 'PREP DOCS',
        dbField: 'housing_levy_file'
    },
    PAYE: {
        name: 'iTax',
        menuLink: 'Export',
        subMenuLink: 'Export Payroll Data to iTax',
        downloadLink: 'Download KRA format CSV File',
        fileExtension: 'csv',
        filePrefix: 'PAYE',
        pageIndex: 1,
        subFolder: 'PREP DOCS',
        dbField: 'paye_file'
    },
    SHIF: {
        name: 'SHIF',
        menuLink: 'Export',
        subMenuLink: 'SHA - SHIF Payroll Template',
        downloadLink: 'Download SHIF format excel',
        fileExtension: 'xlsx',
        filePrefix: 'SHIF',
        pageIndex: 2,
        subFolder: 'PREP DOCS',
        dbField: 'shif_file'
    },
    NSSF: {
        name: 'NSSF',
        menuLink: 'Export',
        subMenuLink: 'NSSF Payroll Template Online',
        downloadLink: 'Download NSSF format excel',
        fileExtension: 'xlsx',
        filePrefix: 'NSSF',
        pageIndex: 3,
        subFolder: 'PREP DOCS',
        dbField: 'nssf_file'
    },
    PAYSLIPS: {
        name: 'Company Payslips',
        menuLink: 'Reports',
        subMenuLink: 'Reports Selector',
        tabName: 'Payslips',
        downloadLink: 'PDF',
        fileExtension: 'pdf',
        filePrefix: 'PAYSLIPS',
        pageIndex: 4,
        subFolder: 'PREP DOCS',
        dbField: 'payslips_file'
    }
};

async function saveProgress(companyFolderPath, progress) {
    const progressFilePath = path.join(companyFolderPath, 'extraction_progress.json');
    try {
        await fs.promises.writeFile(progressFilePath, JSON.stringify(progress, null, 2));
    } catch (error) {
        console.error(`Error saving progress file: ${error.message}`);
    }
}

async function loadProgress(companyFolderPath) {
    const progressFilePath = path.join(companyFolderPath, 'extraction_progress.json');
    try {
        if (await fs.promises.access(progressFilePath).then(() => true).catch(() => false)) {
            const data = await fs.promises.readFile(progressFilePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(`Error loading progress file: ${error.message}`);
    }
    return {}; // Return empty progress if file doesn't exist or has an error
}

async function processCSVFile(filePath) {
    console.log(`Processing CSV file: ${filePath}`);
    try {
        // Read the file as buffer
        const buffer = fs.readFileSync(filePath);

        // Temporarily save as xlsx
        const xlsxPath = filePath.replace('.csv', '.xlsx');
        fs.writeFileSync(xlsxPath, buffer);

        // Read the Excel file
        const workbook = xlsx.readFile(xlsxPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to CSV
        const csvContent = xlsx.utils.sheet_to_csv(worksheet);

        // Save as converted CSV
        const newCsvPath = filePath.replace('.csv', '_converted.csv');
        fs.writeFileSync(newCsvPath, csvContent);

        // Clean up temporary xlsx file
        fs.unlinkSync(xlsxPath);

        // Remove original CSV file
        fs.unlinkSync(filePath);

        // Rename converted file to original name
        fs.renameSync(newCsvPath, filePath);

        console.log(`Successfully processed ${path.basename(filePath)}`);
        return true;
    } catch (error) {
        console.error(`Error processing CSV file ${filePath}: ${error}`);
        return false;
    }
}

// Add this function to process all CSVs in a company folder
async function processCompanyCSVs(companyFolderPath) {
    try {
        const files = await fs.promises.readdir(companyFolderPath);
        for (const file of files) {
            if (file.toLowerCase().endsWith('.csv')) {
                const filePath = path.join(companyFolderPath, file);
                await processCSVFile(filePath);
            }
        }
    } catch (error) {
        console.error(`Error processing CSVs in folder ${companyFolderPath}: ${error}`);
    }
}

async function downloadDocument(page, company, companyFolderPath, docType, supabaseClient) {
    try {
        console.log(`Downloading ${docType.name} for ${company.name}...`);
        
        // Navigate to Export menu using more specific selectors
        // Use the sidebar menu to navigate to Export
        console.log('Navigating to Export menu...');
        
        // First check if we need to click on Export or Reports
        if (docType.menuLink === 'Export') {
            // Click on Export Payroll in the sidebar menu
            await page.getByRole('link', { name: 'Export Payroll' }).click();
            await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });
            
            // Now click on the specific export type submenu
            console.log(`Clicking on ${docType.subMenuLink}...`);
            
            // Use a more specific selector for the submenu item
            if (docType.name === 'Housing Levy') {
                await page.getByRole('link', { name: 'Export Payroll Data to Housing Levy Upload Data File' }).click();
            } else if (docType.name === 'iTax') {
                // For iTax, the link text contains a variable part, so we use a partial match
                await page.getByRole('link', { name: /Export Payroll Data to iTax/ }).click();
            } else if (docType.name === 'SHIF') {
                await page.getByRole('link', { name: 'SHA - SHIF Payroll Template' }).click();
            } else if (docType.name === 'NSSF') {
                await page.getByRole('link', { name: 'NSSF Payroll Template Online' }).click();
            }
            
            await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });
        } else if (docType.menuLink === 'Reports') {
            // Click on Reports in the sidebar menu
            await page.locator('#sidebar-menu').getByText('Reports', { exact: true }).click();
            await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });
            
            // Click on Reports Selector
            await page.getByRole('link', { name: 'Reports Selector' }).click();
            await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });
            
            // Click on the Payslips tab if needed
            if (docType.name === 'Company Payslips') {
                await page.getByRole('tab', { name: 'Payslips' }).click();
                await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });
            }
        }
        
        // Set up download listener
        const downloadPromise = page.waitForEvent('download', { timeout: TIMEOUT_CONFIG.downloadTimeout });
        
        // Click the download button based on document type
        console.log(`Clicking download button for ${docType.name}...`);
        if (docType.name === 'Housing Levy' || docType.name === 'iTax') {
            await page.getByRole('link', { name: docType.downloadLink }).click();
        } else if (docType.name === 'SHIF' || docType.name === 'NSSF') {
            await page.getByRole('link', { name: docType.downloadLink }).click();
        } else if (docType.name === 'Company Payslips') {
            await page.getByRole('link', { name: 'PDF' }).click({
                modifiers: ['Alt']  // Use Alt modifier to force download
            });
        } else {
            // Generic fallback
            await page.getByRole('button', { name: 'Download' }).click();
        }
        
        // Wait for download to start
        const download = await downloadPromise;
        console.log(`Download started for ${docType.name}`);
        
        // Wait for download to complete
        const filePath = await download.path();
        if (!filePath) {
            throw new Error(`Download failed for ${docType.name}`);
        }
        
        // Create target file path for local storage
        const fileName = `${company.name}_${docType.name.replace(/\s+/g, '_')}.csv`;
        const targetPath = path.join(companyFolderPath, fileName);
        
        // Save the file locally
        await fs.promises.copyFile(filePath, targetPath);
        console.log(`Downloaded ${docType.name} to ${targetPath}`);
        
        // Upload to Supabase Storage if client is available
        if (supabaseClient) {
            try {
                const fileContent = await fs.promises.readFile(filePath);
                const month = new Date().getMonth() + 1;
                const year = new Date().getFullYear();
                
                // Create storage path: payroll/company_id/YYYY-MM/document_type.csv
                const storagePath = `payroll/${company.company_id}/${year}-${month.toString().padStart(2, '0')}/${docType.name.replace(/\s+/g, '_')}.csv`;
                
                console.log(`Uploading to storage path: ${storagePath}`);
                
                // Upload to Supabase storage
                const { data, error } = await supabaseClient.storage
                    .from('documents')
                    .upload(storagePath, fileContent, {
                        contentType: 'text/csv',
                        upsert: true
                    });
                    
                if (error) {
                    console.error(`Error uploading to storage: ${error.message}`);
                    return targetPath; // Return local path if storage upload fails
                }
                
                // Get public URL
                const { data: urlData } = supabaseClient.storage
                    .from('documents')
                    .getPublicUrl(storagePath);
                    
                const publicUrl = urlData?.publicUrl;
                console.log(`Uploaded to storage: ${publicUrl}`);
                
                return publicUrl || targetPath;
            } catch (storageError) {
                console.error(`Storage upload error: ${storageError.message}`);
                return targetPath; // Return local path if storage upload fails
            }
        } else {
            console.log('Supabase client not available, skipping storage upload');
            return targetPath;
        }
    } catch (error) {
        console.error(`Error downloading ${docType.name} for ${company.name}:`, error);
        return null;
    }
}

async function downloadPayslips(page, company, downloadFolderPath) {
    try {
        // Navigate to Reports
        await page.locator('#sidebar-menu').getByText('Reports', { exact: true }).click();
        await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

        await page.getByRole('link', { name: 'Reports Selector' }).click();
        await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

        // Click Payslips tab
        await page.getByRole('tab', { name: 'Payslips' }).click();
        await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

        // Setup download handler before clicking
        const downloadPromise = page.waitForEvent('download', { timeout: TIMEOUT_CONFIG.downloadTimeout });

        // Click with modifier to force download
        await page.getByRole('link', { name: 'PDF' }).click({
            modifiers: ['Alt']  // Use Alt modifier to force download
        });

        const download = await downloadPromise;

        // Save the file
        const fileName = `${company.name}_PAYSLIPS.pdf`;
        const monthYearPath = path.join(downloadFolderPath, monthYear, company.name, 'PREP DOCS');
        await fs.promises.mkdir(monthYearPath, { recursive: true });
        const filePath = path.join(monthYearPath, fileName);
        await download.saveAs(filePath);

        return { success: true, error: null, filePath };
    } catch (error) {
        return { success: false, error: error.message, filePath: null };
    }
}

async function setupPayrollPage(context, company) {
    try {
        console.log(`Setting up payroll page for ${company.name}...`);
        const payrollPage = await context.newPage();
        await payrollPage.goto(company.adminUrl, {
            timeout: TIMEOUT_CONFIG.navigationTimeout,
            waitUntil: 'networkidle'
        });
        await payrollPage.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

        // Login if needed using global credentials
        const loginButton = await payrollPage.$('button:has-text("Log In")');
        if (loginButton) {
            console.log(`Logging in to payroll for ${company.name}...`);
            await payrollPage.getByPlaceholder('Username').fill('tushar');
            await payrollPage.getByPlaceholder('Password').fill('0700298298');
            await payrollPage.getByRole('button', { name: 'Log In' }).click();
            await payrollPage.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });
        }

        return payrollPage;
    } catch (error) {
        console.error(`Error setting up payroll page for ${company.name}:`, error);
        return null;
    }
}

async function downloadCompanyReports({ 
    companies, 
    monthYear, 
    onProgress,
    supabaseUrl,
    supabaseKey,
    credentials 
}) {
    // Initialize Supabase client if URL and key are provided
    let supabaseClient;
    if (supabaseUrl && supabaseKey) {
        try {
            supabaseClient = createClient(supabaseUrl, supabaseKey);
            console.log('Supabase client initialized with provided credentials');
            
            // Test the connection
            const { data, error } = await supabaseClient.from('company_payroll_records').select('count').limit(1);
            if (error) {
                console.error('Supabase connection test failed:', error);
                console.warn('Will continue without Supabase storage integration');
                supabaseClient = null;
            } else {
                console.log('Supabase connection test successful');
            }
        } catch (error) {
            console.error('Error initializing Supabase client:', error);
            console.warn('Will continue without Supabase storage integration');
            supabaseClient = null;
        }
    } else {
        console.warn('Supabase credentials not provided, document storage will be local only');
        supabaseClient = null;
    }

    const browser = await chromium.launch({
        headless: false,
        channel: "msedge",
        args: ['--disable-dev-shm-usage']
    });

    const context = await browser.newContext({
        navigationTimeout: TIMEOUT_CONFIG.navigationTimeout,
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();
    const downloadFolderPath = path.join(os.homedir(), 'Documents', 'Wingu Apps Statutory Extractions');
    await fs.promises.mkdir(downloadFolderPath, { recursive: true });

    try {
        // Initial login to WinguApps using provided credentials
        console.log('Logging in to WinguApps...');
        await page.goto('https://winguapps.co.ke/Home/Login', {
            timeout: TIMEOUT_CONFIG.navigationTimeout,
            waitUntil: 'networkidle'
        });

        await page.getByPlaceholder('Email').fill( 'info@booksmartconsult.com');
        await page.getByPlaceholder('Password').fill('bclwinguapps@2024');
        await page.getByRole('button', { name: 'LOGIN' }).click();
        await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

        // Navigate to subscriptions tab to get company URLs
        console.log('Navigating to subscriptions...');
        await page.goto('https://portal.winguapps.co.ke/Dashboard#tab-subscriptions', {
            timeout: TIMEOUT_CONFIG.navigationTimeout,
            waitUntil: 'networkidle'
        });
        await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

        // Get all available companies from the subscriptions tab
        const availableCompanies = await page.evaluate(() => {
            const rows = document.querySelectorAll('table tbody tr');
            return Array.from(rows).map(row => {
                const strongElements = row.querySelectorAll('td strong');
                const nameElement = strongElements.length > 1 ? strongElements[1] : null;
                const adminLinkElement = row.querySelector('a[target="_blank"]');

                if (nameElement && adminLinkElement) {
                    return {
                        name: nameElement.textContent.trim(),
                        adminUrl: adminLinkElement.href
                    };
                }
                return null;
            }).filter(company => company !== null);
        });

        console.log(`Found ${availableCompanies.length} companies in Wingu Apps`);
        console.log(`Companies to process: ${companies.length}`);

        // Filter companies to only process those that are in our list
        const companiesToProcess = availableCompanies.filter(available =>
            companies.some(company => 
                company.name && available.name && 
                company.name.toLowerCase().includes(available.name.toLowerCase()) || 
                available.name.toLowerCase().includes(company.name.toLowerCase())
            )
        ).map(available => {
            const matchedCompany = companies.find(c => 
                c.name && available.name && 
                (c.name.toLowerCase().includes(available.name.toLowerCase()) || 
                available.name.toLowerCase().includes(c.name.toLowerCase()))
            );
            return {
                ...available,
                id: matchedCompany?.id,
                company_id: matchedCompany?.company_id,
                status: matchedCompany?.status
            };
        });

        console.log(`Matched ${companiesToProcess.length} companies for processing`);
        console.log('Companies to process:', companiesToProcess.map(c => c.name));

        // Create a folder for the month/year
        const monthYearFolderPath = path.join(downloadFolderPath, monthYear);
        await fs.promises.mkdir(monthYearFolderPath, { recursive: true });

        // Process each company
        for (let i = 0; i < companiesToProcess.length; i++) {
            const company = companiesToProcess[i];
            console.log(`Processing company ${i + 1}/${companiesToProcess.length}: ${company.name}`);

            try {
                // Create a folder for the company
                const companyFolderPath = path.join(monthYearFolderPath, company.name);
                await fs.promises.mkdir(companyFolderPath, { recursive: true });

                // Load progress or initialize new progress
                let progress = await loadProgress(companyFolderPath);

                // Setup payroll page for the company
                const payrollPage = await setupPayrollPage(context, company);
                if (!payrollPage) {
                    console.error(`Failed to setup payroll page for ${company.name}`);
                    continue;
                }

                // Download each document type
                const documentTypes = [
                    DOCUMENT_TYPES.HOUSING,
                    DOCUMENT_TYPES.PAYE,
                    DOCUMENT_TYPES.SHIF,
                    DOCUMENT_TYPES.NSSF
                ];

                for (const docType of documentTypes) {
                    if (!progress[docType.name]) {
                        try {
                            const downloadPath = await downloadDocument(payrollPage, company, companyFolderPath, docType, supabaseClient);
                            
                            if (downloadPath) {
                                // Update progress
                                progress[docType.name] = {
                                    status: 'completed',
                                    path: downloadPath,
                                    timestamp: new Date().toISOString()
                                };
                                
                                // Update document path in database
                                if (company.id && company.company_id && supabaseClient) {
                                    try {
                                        const { error } = await supabaseClient
                                            .from('company_payroll_records')
                                            .update({
                                                documents: {
                                                    ...company.status?.documents,
                                                    [docType.dbField]: downloadPath
                                                },
                                                status: {
                                                    ...company.status,
                                                    extracted: true,
                                                    wingu_extraction: true,
                                                    extraction_date: new Date().toISOString()
                                                }
                                            })
                                            .eq('company_id', company.company_id);
                                        
                                        if (error) {
                                            console.error(`Error updating document path for ${company.name}:`, error);
                                        } else {
                                            console.log(`Updated document path for ${company.name}: ${docType.name}`);
                                        }
                                    } catch (dbError) {
                                        console.error(`Database error for ${company.name}:`, dbError);
                                    }
                                } else {
                                    console.log(`Skipping database update for ${company.name} - Supabase client not available`);
                                }
                            }
                        } catch (error) {
                            console.error(`Error downloading ${docType.name} for ${company.name}:`, error);
                            progress[docType.name] = {
                                status: 'failed',
                                error: error.message,
                                timestamp: new Date().toISOString()
                            };
                        }
                        
                        // Save progress after each document
                        await saveProgress(companyFolderPath, progress);
                    }
                }

                // Calculate and report progress
                const completedDocs = Object.values(progress).filter(p => p.status === 'completed').length;
                const totalDocs = documentTypes.length;
                const progressPercent = Math.round((completedDocs / totalDocs) * 100);
                
                if (onProgress) {
                    onProgress(progressPercent);
                }

                console.log(`Completed ${progressPercent}% for ${company.name}`);

                // Close the payroll page
                await payrollPage.close();

            } catch (error) {
                console.error(`Error processing company ${company.name}:`, error);
            }
        }

        console.log('All companies processed');
        return true;
    } catch (error) {
        console.error('Error in downloadCompanyReports:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Export the function
export { downloadCompanyReports };