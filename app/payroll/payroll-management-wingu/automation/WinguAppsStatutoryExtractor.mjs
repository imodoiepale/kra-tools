import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import os from 'os';
import xlsx from 'xlsx';
import { format } from 'date-fns';

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
    HOUSING: 'hslevy_csv',
    PAYE: 'paye_csv',
    SHIF: 'shif_exl',
    NSSF: 'nssf_exl',
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
        dbField: 'hslevy_csv'
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
        dbField: 'paye_csv'
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
        dbField: 'shif_exl'
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
        dbField: 'nssf_exl'
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
    let download = null;
    let retryCount = 0;
    let error = null;

    while (!download && retryCount < TIMEOUT_CONFIG.maxRetries) {
        try {
            console.log(`Downloading ${docType.name} for ${company.name}... (Attempt ${retryCount + 1})`);

            // Set navigation timeout for the page
            page.setDefaultNavigationTimeout(TIMEOUT_CONFIG.navigationTimeout);
            page.setDefaultTimeout(TIMEOUT_CONFIG.navigationTimeout);

            // Wait for network to be idle
            await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

            // Click the main menu (Export or Reports)
            if (docType.menuLink === 'Export') {
                // Using getByText with exact match as in the first script
                await page.getByText(docType.menuLink, { exact: true }).click();
                await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });
            } else if (docType.menuLink === 'Reports') {
                await page.locator('#sidebar-menu').getByText('Reports', { exact: true }).click();
                await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });
            }

            // Click the specific submenu option
            console.log(`Clicking on ${docType.subMenuLink}...`);
            if (docType.menuLink === 'Export') {
                // Don't use exact:false to avoid potential issues
                const subMenuLink = await page.getByRole('link', { name: docType.subMenuLink }).first();
                if (!subMenuLink) {
                    throw new Error(`${docType.name} export option not found`);
                }
                await subMenuLink.click();
            } else if (docType.menuLink === 'Reports') {
                await page.getByRole('link', { name: 'Reports Selector' }).click();
                await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

                if (docType.name === 'Company Payslips') {
                    await page.getByRole('tab', { name: 'Payslips' }).click();
                }
            }

            await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

            // Start download and wait for it
            const downloadPromise = page.waitForEvent('download', { timeout: TIMEOUT_CONFIG.downloadTimeout });

            // Click the download button
            console.log(`Clicking download button for ${docType.name}...`);

            if (docType.name === 'Company Payslips') {
                await page.getByRole('link', { name: docType.downloadLink }).click({
                    modifiers: ['Alt']
                });
            } else {
                const downloadLink = await page.getByRole('link', { name: docType.downloadLink }).first();
                if (!downloadLink) {
                    throw new Error(`${docType.name} download link not found`);
                }
                await downloadLink.click();
            }

            // Wait for download to start
            download = await downloadPromise;
            console.log(`Download started for ${docType.name}`);

        } catch (err) {
            error = err;
            retryCount++;
            console.error(`\nAttempt ${retryCount}/${TIMEOUT_CONFIG.maxRetries} failed for ${docType.name} - ${company.name}`);
            console.error(`Error: ${err.message}`);

            if (retryCount < TIMEOUT_CONFIG.maxRetries) {
                console.log(`Waiting ${TIMEOUT_CONFIG.retryDelay / 1000} seconds before retry...`);
                await page.waitForTimeout(TIMEOUT_CONFIG.retryDelay);
            }
        }
    }

    if (!download) {
        console.error(`Failed to download ${docType.name} after ${TIMEOUT_CONFIG.maxRetries} attempts`);
        return null;
    }

    try {
        // Wait for download to complete
        // IMPORTANT: Use suggestedFilename to get the proper filename with extension
        const suggestedFilename = download.suggestedFilename();
        console.log(`Download suggested filename: ${suggestedFilename}`);

        // Get path of downloaded file
        const filePath = await download.path();
        if (!filePath) {
            throw new Error(`Download failed for ${docType.name}`);
        }

        console.log(`Download completed for ${docType.name}: ${filePath}`);

        // Create subfolder if needed
        const subFolderPath = docType.subFolder ? path.join(companyFolderPath, docType.subFolder) : companyFolderPath;
        await fs.promises.mkdir(subFolderPath, { recursive: true });

        // Extract extension from suggested filename or use the expected extension
        let fileExtension = path.extname(suggestedFilename);
        if (!fileExtension || fileExtension === '') {
            fileExtension = `.${docType.fileExtension.toLowerCase()}`;
            console.log(`Using default extension ${fileExtension} since downloaded file doesn't have one`);
        }

        // Generate a filename with timestamp to avoid conflicts
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newFileName = `${company.name}_${docType.filePrefix}_${timestamp}${fileExtension}`;
        const newFilePath = path.join(subFolderPath, newFileName);

        try {
            // Copy the file to the destination
            await fs.promises.copyFile(filePath, newFilePath);
            console.log(`File saved to ${newFilePath}`);
        } catch (fileError) {
            console.error(`Error saving file to ${newFilePath}:`, fileError);
            throw new Error(`Failed to save file: ${fileError.message}`);
        }

        // Process CSV files if needed
        if (fileExtension.toLowerCase() === '.csv') {
            try {
                await processCSVFile(newFilePath);
            } catch (csvError) {
                console.error(`Error processing CSV file ${newFilePath}:`, csvError);
                // Continue execution even if CSV processing fails
            }
        }

        // Upload to Supabase storage if client is provided
        let downloadPath = newFilePath;
        if (supabaseClient) {
            try {
                // Read file content
                let fileContent;
                try {
                    fileContent = await fs.promises.readFile(newFilePath);
                } catch (readError) {
                    console.error(`Error reading file ${newFilePath}:`, readError);
                    throw new Error(`Failed to read file for upload: ${readError.message}`);
                }

                const companyName = company.name.replace(/[^a-zA-Z0-9]/g, '_');
                // Update file path structure to match manual upload process
                const fileName = `${docType.filePrefix}_${company.name}_${format(new Date(), 'yyyy-MM-dd')}${fileExtension}`;
                const storagePath = `${monthYear}/PREP DOCS/${company.name}/${fileName}`;

                // Check if bucket exists before uploading
                try {
                    const { data: buckets, error: bucketError } = await supabaseClient
                        .storage
                        .listBuckets();

                    if (bucketError) {
                        console.error(`Error listing buckets: ${bucketError.message}`);
                        throw new Error(`Failed to list buckets: ${bucketError.message}`);
                    }

                    const bucketExists = buckets.some(bucket => bucket.name === 'Payroll-Cycle');
                    if (!bucketExists) {
                        console.error(`Bucket 'Payroll-Cycle' not found. Available buckets: ${buckets.map(b => b.name).join(', ')}`);
                        throw new Error(`Bucket 'Payroll-Cycle' not found`);
                    }
                } catch (bucketCheckError) {
                    console.error(`Error checking bucket existence: ${bucketCheckError.message}`);
                    throw bucketCheckError;
                }

                // Upload file to bucket
                const fileType = fileExtension.toLowerCase() === '.csv' ? 'text/csv' :
                    fileExtension.toLowerCase() === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                        fileExtension.toLowerCase() === '.pdf' ? 'application/pdf' : 'application/octet-stream';

                console.log(`Uploading to Supabase with content type: ${fileType}`);

                const { data, error } = await supabaseClient
                    .storage
                    .from('Payroll-Cycle')
                    .upload(storagePath, fileContent, {
                        contentType: fileType,
                        upsert: true
                    });

                if (error) {
                    console.error(`Error uploading to Supabase: ${error.message}`);
                } else {
                    console.log(`Uploaded to Supabase: ${storagePath}`);

                    // Get public URL
                    const { data: urlData } = await supabaseClient
                        .storage
                        .from('Payroll-Cycle')
                        .getPublicUrl(storagePath);

                    if (urlData && urlData.publicUrl) {
                        downloadPath = urlData.publicUrl;
                        console.log(`Public URL: ${downloadPath}`);

                        // Update document path in database
                        if (company.id && company.company_id) {
                            try {
                                // First get the current record to ensure we have the latest data
                                const { data: currentRecord, error: fetchError } = await supabaseClient
                                    .from('company_payroll_records')
                                    .select('documents, status')
                                    .eq('id', company.id)
                                    .single();

                                if (fetchError) {
                                    console.error(`Error fetching current record for ${company.name}:`, fetchError);
                                    return downloadPath;
                                }

                                // Prepare the documents object with existing documents
                                const currentDocuments = currentRecord?.documents || {};
                                const updatedDocuments = {
                                    ...currentDocuments,
                                    [docType.dbField]: storagePath // Use storage path instead of public URL
                                };

                                // Prepare the status object with existing status
                                const currentStatus = currentRecord?.status || {};
                                const updatedStatus = {
                                    ...currentStatus,
                                    extracted: true,
                                    wingu_extraction: true,
                                    extraction_date: new Date().toISOString()
                                };

                                // Update the record with new documents and status
                                const { error } = await supabaseClient
                                    .from('company_payroll_records')
                                    .update({
                                        documents: updatedDocuments,
                                        status: updatedStatus
                                    })
                                    .eq('id', company.id);

                                if (error) {
                                    console.error(`Error updating document path for ${company.name}:`, error);
                                } else {
                                    console.log(`Updated document path for ${company.name}: ${docType.name}`);
                                }
                            } catch (dbError) {
                                console.error(`Database error for ${company.name}:`, dbError);
                            }
                        }
                    }
                }
            } catch (uploadError) {
                console.error(`Error in Supabase upload: ${uploadError.message}`);
            }
        }

        return downloadPath;
    } catch (error) {
        console.error(`Error processing downloaded file for ${docType.name}:`, error);
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

async function setupPayrollPage(context, company, credentials = {}) {
    try {
        console.log(`Setting up payroll page for ${company.name}...`);
        const payrollPage = await context.newPage();
        await payrollPage.goto(company.adminUrl, {
            timeout: TIMEOUT_CONFIG.navigationTimeout,
            waitUntil: 'networkidle'
        });
        await payrollPage.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

        // Login if needed using provided credentials or fallbacks
        const loginButton = await payrollPage.$('button:has-text("Log In")');
        if (loginButton) {
            console.log(`Logging in to payroll for ${company.name}...`);
            const username = credentials?.username || 'tushar';
            const password = credentials?.password || '0700298298';
            
            await payrollPage.getByPlaceholder('Username').fill(username);
            await payrollPage.getByPlaceholder('Password').fill(password);
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
    console.log(`Starting document extraction for ${companies.length} companies`);
    console.log(`Month/Year: ${monthYear}`);

    // Create browser instance
    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-dev-shm-usage']
    });

    const context = await browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1920, height: 1080 }
    });

    try {
        // Create base download folder
        const downloadFolderPath = path.join(os.homedir(), 'Downloads', 'Wingu Apps Extractions');
        await fs.promises.mkdir(downloadFolderPath, { recursive: true });

        // Login to WinguApps
        console.log('Logging in to WinguApps...');
        const page = await context.newPage();
        await page.goto('https://winguapps.co.ke/Home/Login', {
            timeout: TIMEOUT_CONFIG.navigationTimeout,
            waitUntil: 'networkidle'
        });

        // Use provided credentials or fallback to defaults
        const username = credentials?.username || 'tushar';
        const password = credentials?.password || '0700298298';
        
        // Fill login form

        await page.getByPlaceholder('Email').fill('info@booksmartconsult.com');
        await page.getByPlaceholder('Password').fill('bclwinguapps@2024');
        await page.getByRole('button', { name: 'LOGIN' }).click();
        await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

        // Navigate to subscriptions tab
        console.log('Navigating to subscriptions...');
        await page.goto('https://portal.winguapps.co.ke/Dashboard#tab-subscriptions', {
            timeout: TIMEOUT_CONFIG.navigationTimeout,
            waitUntil: 'networkidle'
        });
        await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

        // Get available companies from the dashboard
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
                (company.name.toLowerCase().includes(available.name.toLowerCase()) || 
                available.name.toLowerCase().includes(company.name.toLowerCase()))
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

        // Create Supabase client if credentials are provided
        let supabaseClient = null;
        if (supabaseUrl && supabaseKey) {
            try {
                supabaseClient = createClient(supabaseUrl, supabaseKey);
                console.log('Supabase client initialized');
                
                // Test the connection
                const { data, error } = await supabaseClient.from('company_payroll_records').select('count').limit(1);
                if (error) {
                    console.error('Error connecting to Supabase:', error.message);
                    supabaseClient = null;
                } else {
                    console.log('Successfully connected to Supabase');
                }
            } catch (error) {
                console.error('Failed to initialize Supabase client:', error.message);
                supabaseClient = null;
            }
        } else {
            console.log('No Supabase credentials provided, skipping database updates');
        }

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
                const payrollPage = await setupPayrollPage(context, company, credentials);
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

                // Track document download status
                const documentStatus = {};
                let hasAnySuccess = false;

                for (const docType of documentTypes) {
                    if (!progress[docType.name]) {
                        try {
                            console.log(`\nDownloading ${docType.name} for ${company.name}...`);
                            
                            // Update progress for UI
                            if (onProgress) {
                                onProgress(company.id, {
                                    status: 'processing',
                                    message: `Downloading ${docType.name}...`,
                                    progress: ((documentTypes.indexOf(docType) + 1) / documentTypes.length) * 100
                                });
                            }
                            
                            const downloadPath = await downloadDocument(payrollPage, company, companyFolderPath, docType, supabaseClient);
                            
                            if (downloadPath) {
                                // Update progress
                                progress[docType.name] = {
                                    status: 'completed',
                                    path: downloadPath,
                                    timestamp: new Date().toISOString()
                                };
                                
                                documentStatus[docType.name] = 'Success';
                                hasAnySuccess = true;
                                
                                // Save progress
                                await saveProgress(companyFolderPath, progress);
                            } else {
                                documentStatus[docType.name] = 'Failed';
                                console.error(`\nFailed to download ${docType.name}`);
                            }
                        } catch (error) {
                            documentStatus[docType.name] = `Failed - ${error.message}`;
                            console.error(`\nError downloading ${docType.name}: ${error.message}`);
                        }
                    } else {
                        console.log(`${docType.name} already downloaded for ${company.name}`);
                        documentStatus[docType.name] = 'Already downloaded';
                    }
                }

                // Process CSV files
                console.log(`\nProcessing CSV files for ${company.name}...`);
                await processCompanyCSVs(companyFolderPath);

                // Show document status summary
                console.log(`\nDownload Status for ${company.name}:`);
                Object.entries(documentStatus).forEach(([doc, status]) => {
                    const statusSymbol = status.startsWith('Success') ? '✓' : '✗';
                    console.log(`${statusSymbol} ${doc}: ${status}`);
                });

                // Close the payroll page
                await payrollPage.close();

                // Update progress for UI
                if (onProgress) {
                    onProgress(company.id, {
                        status: 'completed',
                        message: `Completed extraction for ${company.name}`,
                        progress: 100,
                        completedAt: new Date().toISOString()
                    });
                }

            } catch (error) {
                console.error(`Error processing ${company.name}:`, error);
                
                // Update progress for UI
                if (onProgress) {
                    onProgress(company.id, {
                        status: 'failed',
                        error: error.message || 'Unknown error occurred',
                        completedAt: new Date().toISOString()
                    });
                }
                
                // Log detailed error information
                console.error(`Error details for ${company.name}:`, {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    company: company.name,
                    companyId: company.id
                });
            }
        }

        console.log('\nExtraction process completed');
        return {
            success: true,
            message: 'Extraction process completed successfully',
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Fatal error in extraction process:', error);
        
        // Return structured error response
        return {
            success: false,
            error: error.message || 'Unknown fatal error occurred',
            timestamp: new Date().toISOString()
        };
    } finally {
        // Ensure browser is always closed
        try {
            if (context) await context.close();
            if (browser) await browser.close();
            console.log('Browser closed successfully');
        } catch (closingError) {
            console.error('Error closing browser:', closingError);
        }
    }
}

// Export the function
export { downloadCompanyReports };