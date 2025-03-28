import { chromium } from 'playwright';
import path from 'path';
import os from 'os';
import fs from 'fs';
import xlsx from 'xlsx';

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

// Configuration for different document types
const DOCUMENT_TYPES = {
    HOUSING: {
        name: 'Housing Levy',
        menuLink: 'Export',
        subMenuLink: 'Export Payroll Data to Housing Levy Upload Data File',
        downloadLink: 'Download Housing Levy format',
        fileExtension: 'csv',
        filePrefix: 'HOUSING LEVY',
        pageIndex: 0
    },
    PAYE: {
        name: 'iTax',
        menuLink: 'Export',
        subMenuLink: 'Export Payroll Data to iTax (',
        downloadLink: 'Download KRA format CSV File',
        fileExtension: 'csv',
        filePrefix: 'PAYE',
        pageIndex: 1
    },
    SHIF: {
        name: 'SHIF',
        menuLink: 'Export',
        subMenuLink: 'SHA - SHIF Payroll Template',
        downloadLink: 'Download SHIF format excel',
        fileExtension: 'xlsx',
        filePrefix: 'SHIF',
        pageIndex: 2
    },
    NSSF: {
        name: 'NSSF',
        menuLink: 'Export',
        subMenuLink: 'NSSF Payroll Template Online',
        downloadLink: 'Download NSSF format excel',
        fileExtension: 'xlsx',
        filePrefix: 'NSSF',
        pageIndex: 3
    },
    PAYSLIPS: {
        name: 'Company Payslips',
        menuLink: 'Reports',
        subMenuLink: 'Reports Selector',
        tabName: 'Payslips',
        downloadLink: 'PDF',
        fileExtension: 'pdf',
        filePrefix: 'PAYSLIPS',
        pageIndex: 4
    }
};

async function saveProgress(downloadFolderPath, progress) {
    const progressPath = path.join(downloadFolderPath, 'download_progress.json');
    await fs.promises.writeFile(progressPath, JSON.stringify(progress, null, 2));
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


async function loadProgress(downloadFolderPath) {
    const progressPath = path.join(downloadFolderPath, 'download_progress.json');
    try {
        const data = await fs.promises.readFile(progressPath, 'utf8');
        return JSON.parse(data);
    } catch {
        return {
            lastCompletedIndex: -1,
            completedCompanies: [],
            startTime: new Date().toISOString(),
            totalCompanies: 0
        };
    }
}

async function downloadDocument(page, company, downloadFolderPath, docType) {
    let download = null;
    let retryCount = 0;
    let error = null;

    while (!download && retryCount < TIMEOUT_CONFIG.maxRetries) {
        try {
            // Set navigation timeout for the page
            page.setDefaultNavigationTimeout(TIMEOUT_CONFIG.navigationTimeout);
            page.setDefaultTimeout(TIMEOUT_CONFIG.navigationTimeout);

            // Wait for network to be idle
            await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

            // Click the main Export menu
            await page.getByText(docType.menuLink, { exact: true }).click();
            await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

            // Click the specific export type submenu
            const subMenuLink = await page.getByRole('link', { name: docType.subMenuLink }).first();
            if (!subMenuLink) {
                throw new Error(`${docType.name} export option not found`);
            }
            await subMenuLink.click();
            await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

            // Start download and wait for it
            const downloadPromise = page.waitForEvent('download', { timeout: TIMEOUT_CONFIG.downloadTimeout });
            const downloadLink = await page.getByRole('link', { name: docType.downloadLink }).first();
            if (!downloadLink) {
                throw new Error(`${docType.name} download link not found`);
            }
            await downloadLink.click();
            download = await downloadPromise;
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

    if (download) {
        try {
            const fileName = `${company.name}_${docType.filePrefix}.${docType.fileExtension}`;
            const monthYearPath = path.join(downloadFolderPath, monthYear, company.name);
            await fs.promises.mkdir(monthYearPath, { recursive: true });
            await download.saveAs(path.join(monthYearPath, fileName));
            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: `Failed to save file: ${err.message}` };
        }
    } else {
        return {
            success: false,
            error: error ? `Failed after ${TIMEOUT_CONFIG.maxRetries} retries: ${error.message}`
                : `Failed to download after ${TIMEOUT_CONFIG.maxRetries} attempts`
        };
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
        const monthYearPath = path.join(downloadFolderPath, monthYear, company.name);
        await fs.promises.mkdir(monthYearPath, { recursive: true });
        await download.saveAs(path.join(monthYearPath, fileName));

        return { success: true, error: null };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function setupPayrollPage(context, company) {
    const page = await context.newPage();
    await page.goto(company.adminUrl, {
        timeout: TIMEOUT_CONFIG.navigationTimeout,
        waitUntil: 'networkidle'
    });

    // Login to payroll system if needed
    const loginButton = await page.$('button:has-text("Log In")');
    if (loginButton) {
        await page.getByPlaceholder('Username').fill('tushar');
        await page.getByPlaceholder('Password').fill('0700298298');
        await page.getByRole('button', { name: 'Log In' }).click();
        await page.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });
    }

    return page;
}

async function downloadCompanyReports() {
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
        // Initial login to WinguApps
        console.log('Logging in to WinguApps...');
        await page.goto('https://winguapps.co.ke/Home/Login', {
            timeout: TIMEOUT_CONFIG.navigationTimeout,
            waitUntil: 'networkidle'
        });

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

        const companies = await page.evaluate(() => {
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

        // Load previous progress
        let progress = await loadProgress(downloadFolderPath);
        progress.totalCompanies = companies.length;
        console.log(`\nFound ${companies.length} companies to process`);

        // Process each company
        for (let i = progress.lastCompletedIndex + 1; i < companies.length; i++) {
            const company = companies[i];
            try {
                const percentComplete = ((i + 1) / companies.length * 100).toFixed(1);
                console.log(`\n========================================`);
                console.log(`Processing company ${i + 1} of ${companies.length} (${percentComplete}%)`);
                console.log(`Company Name: ${company.name}`);
                console.log(`========================================`);

                // Open payroll page and login
                const payrollPage = await context.newPage();
                await payrollPage.goto(company.adminUrl, {
                    timeout: TIMEOUT_CONFIG.navigationTimeout,
                    waitUntil: 'networkidle'
                });
                await payrollPage.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });

                // Login if needed
                const loginButton = await payrollPage.$('button:has-text("Log In")');
                if (loginButton) {
                    console.log(`Logging in to payroll for ${company.name}...`);
                    await payrollPage.getByPlaceholder('Username').fill('tushar');
                    await payrollPage.getByPlaceholder('Password').fill('0700298298');
                    await payrollPage.getByRole('button', { name: 'Log In' }).click();
                    await payrollPage.waitForLoadState('networkidle', { timeout: TIMEOUT_CONFIG.waitForLoadState });
                }

                // Track document download status
                const documentStatus = {};
                let hasAnySuccess = false;

                // Download statutory documents
                for (const docType of Object.values(DOCUMENT_TYPES)) {
                    if (docType.name === 'Company Payslips') {
                        console.log(`\nDownloading ${docType.name} for ${company.name}...`);
                        const result = await downloadPayslips(payrollPage, company, downloadFolderPath);
                        if (result.success) {
                            documentStatus[docType.name] = 'Success';
                            hasAnySuccess = true;
                        } else {
                            documentStatus[docType.name] = `Failed - ${result.error}`;
                            console.error(`\nFailed to download ${docType.name}: ${result.error}`);
                        }
                    } else {
                        console.log(`\nDownloading ${docType.name} for ${company.name}...`);
                        const result = await downloadDocument(payrollPage, company, downloadFolderPath, docType);
                        if (result.success) {
                            documentStatus[docType.name] = 'Success';
                            hasAnySuccess = true;
                        } else {
                            documentStatus[docType.name] = `Failed - ${result.error}`;
                            console.error(`\nFailed to download ${docType.name}: ${result.error}`);
                        }
                    }
                }

                // Update and save progress
                progress.lastCompletedIndex = i;
                progress.completedCompanies.push({
                    name: company.name,
                    completedAt: new Date().toISOString(),
                    documentStatus,
                    hasAnySuccess
                });
                await saveProgress(downloadFolderPath, progress);

                const companyFolderPath = path.join(downloadFolderPath, monthYear, company.name);
                console.log(`\nProcessing CSV files for ${company.name}...`);
                await processCompanyCSVs(companyFolderPath);

                // Show document status summary
                console.log(`\nDownload Status for ${company.name}:`);
                Object.entries(documentStatus).forEach(([doc, status]) => {
                    const statusSymbol = status === 'Success' ? '✓' : '✗';
                    console.log(`${statusSymbol} ${doc}: ${status}`);
                });

                if (!hasAnySuccess) {
                    console.log(`\nWarning: No documents were successfully downloaded for ${company.name}`);
                }

                console.log(`\nCompleted processing for: ${company.name}`);
                await payrollPage.close();

            } catch (error) {
                console.error(`\nError processing ${company.name}:`, error);
                progress.completedCompanies.push({
                    name: company.name,
                    completedAt: new Date().toISOString(),
                    error: error.message,
                    hasAnySuccess: false
                });
                await saveProgress(downloadFolderPath, progress);
                continue;
            }
        }

        // Show final summary
        console.log('\n========================================');
        console.log('Download Process Complete');
        console.log(`Total Companies Processed: ${progress.completedCompanies.length} of ${companies.length}`);
        console.log(`Start Time: ${progress.startTime}`);
        console.log(`End Time: ${new Date().toISOString()}`);
        console.log('========================================\n');

    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        await context.close();
        await browser.close();
    }
}

// Run the script
downloadCompanyReports().catch(console.error);