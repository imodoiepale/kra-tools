// pages/api/pentasoft-extraction.js
import { chromium } from 'playwright';
import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { action, runOption, selectedCompanies } = req.body;

    switch (action) {
        case 'extract':
            try {
                const extractionResult = await extractReports(runOption, selectedCompanies);
                return res.status(200).json(extractionResult);
            } catch (error) {
                console.error('Extraction error:', error);
                return res.status(500).json({ message: 'Extraction failed', error: error.message });
            }
        default:
            return res.status(400).json({ message: 'Invalid action' });
    }
}

async function findChromePath() {
    const chrome64Path = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const chrome32Path = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

    if (await fsPromises.access(chrome64Path).then(() => true).catch(() => false)) {
        return chrome64Path;
    } else if (await fsPromises.access(chrome32Path).then(() => true).catch(() => false)) {
        return chrome32Path;
    }
    return null;
}

async function extractReports(runOption, selectedCompanies) {

    const results = [];

    const chromePath = await findChromePath();
    if (!chromePath) {
        throw new Error('Chrome executable not found');
    }

    const browser = await chromium.launch({
        headless: false,
        executablePath: chromePath
    });     
    const context = await browser.newContext();     

    const today = new Date();
    const dateString = format(today, 'dd.MM.yyyy');

    console.log(`Starting script execution on ${dateString}`);

    const reports = [
        {
            url: 'http://192.168.0.251:4445/epayroll/process/monthlyUpgrade.php?username=admin.bs',
            link: 'P10 MONTHLY - PAYE',
            expectedExtension: '.csv'
        },
        {
            url: 'http://192.168.0.251:4445/epayroll/statutory/nssfProcess/itemReport.php?username=admin.bs',
            link: 'N.S.S.F MONTHLY',
            expectedExtension: '.xls'
        },
        {
            url: 'http://192.168.0.251:4445/epayroll/statutory/nhifProcess/itemReport.php?username=admin.bs',
            link: 'NHIF MONTHL',
            expectedExtension: '.xls'
        },
        {
            url: 'http://192.168.0.251:4445/epayroll/statutory/nitaProcess/nitaPreviewReport.php?username=admin.bs',
            link: 'NITA REVIEW',
            expectedExtension: '.xls'
        },
        {
            url: 'http://192.168.0.251:4445/epayroll/statutory/houseLevyProcess/hlPreviewReport.php?username=admin.bs',
            link: 'HOUSE LEVY PREVIEW',
            expectedExtension: '.xls'
        }
    ];


    try {
        console.log('Navigating to login page...');
        const loginPage = await context.newPage();
        await loginPage.goto('http://192.168.0.251:4445/cloudSystem/mainPageV3.php');
        console.log('Login page loaded');

        console.log('Performing login...');
        await loginPage.fill('#user_name', 'admin.bs');
        await loginPage.fill('#password', 'admin');
        await loginPage.evaluate(() => { validate(); });
        console.log('Login submitted, waiting for navigation...');
        await loginPage.waitForNavigation({ waitUntil: 'networkidle' });

        const options = await loginPage.locator('#headerPage').contentFrame().locator('#clientDynamicId option').all();
        console.log(`Total options in dropdown: ${options.length}`);

        for (const option of options) {
            const optionText = await option.textContent();
            const optionValue = await option.getAttribute('value');
            const optionTitle = await option.getAttribute('title');

            if (optionText.trim() === 'ADJUSTMENT' || optionText.trim() === 'SAMPLE LTD' || optionText.trim() === 'BOOKSMART LTD') {
                console.log(`Skipping ${optionText.trim()}`);
                continue;
            }

            if (runOption === 'selected' && !selectedCompanies.includes(optionTitle)) {
                console.log(`Skipping ${optionTitle} as it's not selected`);
                continue;
            }

            console.log(`\nProcessing company: ${optionTitle}`);

            try {
                console.log(`Selecting company with value: ${optionValue}`);
                await loginPage.locator('#headerPage').contentFrame().locator('#clientDynamicId').selectOption(optionValue);
                console.log('Company selected, waiting for page to load...');
                await loginPage.waitForNavigation({ waitUntil: 'load' });

                console.log('Clicking on ePAYROLL...');
                await loginPage.locator('frame').nth(1).contentFrame().getByRole('cell', { name: 'ePAYROLL' }).click();

                const downloadFolder = path.join(os.homedir(), 'Downloads', `PENTASOFT -${dateString}`);
                await fsPromises.mkdir(downloadFolder, { recursive: true });

                const downloadedFiles = [];

                for (const report of reports) {
                    console.log(`\nProcessing report: ${report.link}`);
                    const page = await context.newPage();
                    console.log(`Navigating to ${report.url}`);
                    await page.goto(report.url);
                    await page.waitForLoadState('networkidle');

                    // Check for "NO DATA FOUND!" message
                    const noDataFound = await page.waitForSelector('b:has-text("NO DATA FOUND!")', { timeout: 1000 }).catch(() => null);
                    
                    if (noDataFound) {
                        console.log(`No data found for ${report.link}`);
                        downloadedFiles.push({
                            name: report.link,
                            path: null
                        });
                        await page.close();
                        continue;
                    }

                    const downloadPromise = page.waitForEvent('download');

                    switch (report.link) {
                        case 'P10 MONTHLY - PAYE':
                            console.log("Clicking CSV button");
                            await page.click('#csvbutton');
                            break;
                        case 'N.S.S.F MONTHLY':
                        case 'NHIF MONTHL':
                        case 'NITA REVIEW':
                        case 'HOUSE LEVY PREVIEW':
                            console.log("Calling printToExcel function");
                            await page.evaluate(() => { printToExcel(); });
                            break;
                        default:
                            console.log(`Unexpected report type: ${report.link}`);
                            continue;
                    }

                    console.log('Waiting for download to start...');
                    const download = await downloadPromise;
                    const suggestedFilename = download.suggestedFilename();
                    let fileExtension = path.extname(suggestedFilename);

                    if (fileExtension === '.xlsx' && report.expectedExtension === '.xls') {
                        console.log('Changing file extension from .xlsx to .xls');
                        fileExtension = '.xls';
                    }

                    const fileName = `${optionTitle}- ${report.link} ${dateString}${fileExtension}`;
                    const filePath = path.join(downloadFolder, fileName);

                    console.log(`Saving file: ${filePath}`);
                    await download.saveAs(filePath);
                    console.log(`File saved successfully`);
                    downloadedFiles.push({ name: report.link, path: filePath });

                    await page.close();
                    console.log('Page closed');
                }

                const uploadedFiles = await uploadFilesToSupabase(downloadedFiles, optionTitle);

                // Update Supabase table for this company
                const updateResult = await updateSupabaseTable([{ name: optionTitle }], { [optionTitle]: uploadedFiles });

                results.push({
                    company: optionTitle,
                    files: uploadedFiles,
                    updateResult: updateResult[0]
                });

                console.log('Navigating back to main page...');
                await loginPage.goto('http://192.168.0.251:4445/cloudSystem/mainPageV3.php');
            } catch (error) {
                console.error(`Error processing company ${optionTitle}:`, error);
                results.push({ company: optionTitle, error: error.message });
            }
        }

        return { message: 'Extraction completed', results };

    } finally {
        console.log('\nAll companies processed. Closing browser...');
        await browser.close();
        console.log('Script execution completed.');
    }
}

async function uploadFilesToSupabase(files, companyName) {
    if (!Array.isArray(files)) {
        console.error('Expected files to be an array, but received:', typeof files);
        return [];
    }

    const currentDate = new Date();
    const monthYear = format(currentDate, 'MMMM yyyy');
    const dateString = format(currentDate, 'dd.MM.yyyy');
    const downloadFolder = path.join(os.homedir(), 'Downloads', `PENTASOFT -${dateString}`);
    await fsPromises.mkdir(downloadFolder, { recursive: true });

    const uploadPromises = files.map(async (file) => {
        const absolutePath = path.resolve(file.path);
        if (!absolutePath.startsWith(downloadFolder)) {
            console.warn(`File path ${file.path} is not in the expected download folder. Skipping.`);
            return null;
        }

        if (file.path === null) {
            return {
                name: file.name,
                path: null,
                fullPath: null,
                originalName: null,
                type: null
            };
        }

        try {
            const fileContent = await fsPromises.readFile(absolutePath);
            const fileName = path.basename(file.path);
            const storagePath = `${companyName}/pentasoft/${monthYear}/${fileName}`;

            const { data, error } = await supabase.storage
                .from('pentasoft-reports')
                .upload(storagePath, fileContent, {
                    contentType: 'text/csv',
                    upsert: true
                });

            if (error) throw error;

            return {
                name: file.name,
                path: data.path,
                fullPath: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pentasoft-reports/${data.path}`,
                originalName: fileName,
                type: path.extname(fileName).slice(1)
            };
        } catch (error) {
            console.error(`Error processing file ${file.path}:`, error);
            return null;
        }
    });

    const uploadedFiles = await Promise.all(uploadPromises);
    return uploadedFiles.filter(file => file !== null);
}

async function updateSupabaseTable(companies, uploadedFiles) {
    const currentDate = new Date();
    const monthYear = format(currentDate, 'MMMM yyyy');

    const updatePromises = companies.map(async (company) => {
        const companyFiles = uploadedFiles[company.name] || [];

        try {
            const newData = {
                company_name: company.name,
                updated_at: new Date().toISOString(),
                files: {
                    [monthYear]: {
                        extraction_date: currentDate.toISOString(),
                        files: companyFiles
                    }
                }
            };

            const { data, error } = await supabase
                .from('pentasoft_extractions')
                .upsert(newData, {
                    onConflict: 'company_name',
                    returning: 'minimal'
                });

            if (error) throw error;

            console.log(`Supabase table updated successfully for ${company.name}`);
            return { company: company.name, success: true };
        } catch (error) {
            console.error(`Error updating Supabase table for ${company.name}:`, error);
            return { company: company.name, success: false, error: error.message };
        }
    });

    return Promise.all(updatePromises);
}