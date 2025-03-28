// @ts-nocheck
import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createClient } from "@supabase/supabase-js";
import { createWorker } from 'tesseract.js';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { format, subMonths } from 'date-fns';
import { EventEmitter } from 'events';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const automationEmitter = new EventEmitter();
let isRunning = false;
let progress = 0;
let totalCompanies = 0;
let currentCompany = '';
let browser = null;
let context = null;
let page = null;

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { action, runOption, selectedIds } = req.body;

    switch (action) {
        case "start":
            if (isRunning) {
                return res.status(400).json({ message: "Auto-population is already running" });
            }
            try {
                isRunning = true;
                progress = 0;
                totalCompanies = 0;
                currentCompany = '';

                // Update automation progress in Supabase
                await supabase
                    .from('AutoPopulation_AutomationProgress')
                    .upsert({
                        id: 1,
                        progress: 0,
                        status: 'Running',
                        current_company: '',
                        last_updated: new Date().toISOString()
                    });

                processAutoPopulation(runOption, selectedIds).catch(async error => {
                    console.error("Error in processAutoPopulation:", error);
                    await cleanup();
                });
                return res.status(200).json({ message: "Auto-population started successfully" });
            } catch (error) {
                await cleanup();
                return res.status(500).json({ message: "Failed to start auto-population", error: error.message });
            }

        case "stop":
            try {
                await cleanup();
                return res.status(200).json({ message: "Auto-population stopped successfully" });
            } catch (error) {
                return res.status(500).json({ message: "Failed to stop auto-population", error: error.message });
            }

        case "progress":
            try {
                const { data: progressData } = await supabase
                    .from('AutoPopulation_AutomationProgress')
                    .select('*')
                    .single();

                return res.status(200).json({
                    progress,
                    totalCompanies,
                    isRunning,
                    currentCompany,
                    status: progressData?.status || 'Stopped'
                });
            } catch (error) {
                return res.status(500).json({ message: "Failed to fetch progress", error: error.message });
            }

        case "getReports":
            try {
                const reports = await getReports();
                return res.status(200).json(reports);
            } catch (error) {
                return res.status(500).json({ message: "Failed to get reports", error: error.message });
            }

        default:
            return res.status(400).json({ message: "Invalid action" });
    }
}

async function cleanup() {
    isRunning = false;
    progress = 0;
    currentCompany = '';
    
    try {
        if (page) {
            // Attempt to logout
            try {
                await page.goto("https://itax.kra.go.ke/KRA-Portal/");
                const logoutButton = await page.waitForSelector('#logout', { timeout: 5000 });
                if (logoutButton) {
                    await logoutButton.click();
                    await page.waitForTimeout(2000);
                }
            } catch (logoutError) {
                console.log("Logout failed or not needed:", logoutError);
            }
            
            await page.close();
            page = null;
        }
        if (context) {
            await context.close();
            context = null;
        }
        if (browser) {
            await browser.close();
            browser = null;
        }
    } catch (error) {
        console.error("Error during cleanup:", error);
    }

    // Update Supabase status
    await supabase
        .from('AutoPopulation_AutomationProgress')
        .upsert({
            id: 1,
            progress: 0,
            status: 'Stopped',
            current_company: '',
            last_updated: new Date().toISOString()
        });
}

async function processAutoPopulation(runOption, selectedIds) {
    let companies;
    try {
        companies = await readSupabaseData(runOption === 'selected' ? selectedIds : null);
        totalCompanies = companies.length;

        const now = new Date();
        const formattedDateTime = `${now.getDate()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
        const downloadFolderPath = path.join(os.homedir(), "Downloads", `AUTO-POPULATE-${formattedDateTime}`);
        await fs.mkdir(downloadFolderPath, { recursive: true });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("FILED RETURNS ALL MONTHS");

        const excelFilePath = path.join(downloadFolderPath, `AUTO-POPULATION-SUMMARY-${formattedDateTime}.xlsx`);
        await workbook.xlsx.writeFile(excelFilePath);

        for (let i = 0; i < companies.length && isRunning; i++) {
            currentCompany = companies[i].company_name;

            // Update progress in Supabase
            await supabase
                .from('AutoPopulation_AutomationProgress')
                .upsert({
                    id: 1,
                    progress,
                    current_company: currentCompany,
                    last_updated: new Date().toISOString()
                });

            if (!isRunning) {
                console.log("Stopping auto-population process");
                break;
            }

            await processCompany(companies[i], downloadFolderPath, formattedDateTime, worksheet);
            progress = Math.round(((i + 1) / totalCompanies) * 100);

            await workbook.xlsx.writeFile(excelFilePath);
        }

        // Update final status
        await supabase
            .from('AutoPopulation_AutomationProgress')
            .upsert({
                id: 1,
                progress: isRunning ? 100 : progress,
                status: isRunning ? 'Completed' : 'Stopped',
                current_company: '',
                last_updated: new Date().toISOString()
            });

        isRunning = false;
        currentCompany = '';
        console.log("Auto-population process completed or stopped");
    } catch (error) {
        console.error("Error in processAutoPopulation:", error);
        // Update error status
        await supabase
            .from('AutoPopulation_AutomationProgress')
            .upsert({
                id: 1,
                status: 'Stopped',
                last_updated: new Date().toISOString()
            });
        throw error;
    }
}

async function readSupabaseData(selectedIds) {
    try {
        let query = supabase.from("PasswordChecker").select("*");

        // If selectedIds is provided, filter by those IDs
        if (selectedIds && selectedIds.length > 0) {
            query = query.in('id', selectedIds);
        }

        const { data, error } = await query.order("id", { ascending: true });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error reading Supabase data: ${error.message}`);
        throw error;
    }
}

async function loginToKRA(page, company) {
    await page.goto("https://itax.kra.go.ke/KRA-Portal/");
    await page.locator("#logid").click();
    await page.locator("#logid").fill(company.kra_pin);
    await page.evaluate(() => {
        CheckPIN();
    });
    await page.locator('input[name="xxZTT9p2wQ"]').fill(company.kra_password);
    await page.waitForTimeout(1500);
    const image = await page.waitForSelector("#captcha_img");
    const imagePath = path.join(os.tmpdir(), "ocr.png");
    await image.screenshot({ path: imagePath });
    const worker = await createWorker('eng', 1);
    console.log("Extracting Text...");
    const ret = await worker.recognize(imagePath);
    const text1 = ret.data.text.slice(0, -1); // Omit the last character
    const text = text1.slice(0, -1);
    const numbers = text.match(/\d+/g);
    console.log('Extracted Numbers:', numbers);
    if (!numbers || numbers.length < 2) {
        throw new Error("Unable to extract valid numbers from the text.");
    }
    let result;
    if (text.includes("+")) {
        result = Number(numbers[0]) + Number(numbers[1]);
    } else if (text.includes("-")) {
        result = Number(numbers[0]) - Number(numbers[1]);
    } else {
        throw new Error("Unsupported operator.");
    }
    console.log('Result:', result.toString());
    await worker.terminate();
    await page.type("#captcahText", result.toString());
    await page.click("#loginButton");

    await page.goto("https://itax.kra.go.ke/KRA-Portal/")
    // Check if login was successful
    const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 1000 })
        .catch(() => false);

    if (isInvalidLogin) {
        console.log("Wrong result of the arithmetic operation, retrying...");
        await loginToKRA(page, company);
    }

}

async function initiateAndHandleDownload(page, worksheet, company, downloadFolderPath, formattedDateTime) {
    try {
        const downloadButton = await page.locator("#dwnlod_btn_tims", { state: 'visible', timeout: 2000 });
        await downloadButton.click();
        console.log("AUTO POPULATION button clicked successfully");

        page.once("dialog", dialog => { dialog.accept().catch(() => { }); });

        const isEReturnsPresent = await page.waitForSelector('td.tablerowhead:has-text("e-Returns")',
            { state: 'visible', timeout: 1000 })
            .then(() => true)
            .catch(() => false);

        if (isEReturnsPresent) {
            console.log("e-Returns header found, skipping to next iteration");
            const skipRow = worksheet.addRow(["", " ", "SKIPPED - e-Returns HEADER PRESENT"]);
            highlightCells(skipRow, "C", "D", "FFFF00");
            worksheet.addRow();
            return null;
        }

        const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
        await page.waitForSelector("#dwnlod_btn_tims");
        page.once("dialog", dialog => {
            dialog.accept().catch(() => { });
        });
        await page.click(".submit", { timeout: 60000 });
        const download = await downloadPromise;

        const previousMonthName = getPreviousMonthName();
        const fileName = `${company.company_name}-${formattedDateTime}-AUTO-POPULATE-For-${previousMonthName}.zip`;
        const downloadedFilePath = path.join(downloadFolderPath, fileName);
        await download.saveAs(downloadedFilePath);
        console.log(`File downloaded successfully: ${fileName}`);
        return downloadedFilePath;
    } catch (error) {
        console.error("Failed to initiate or complete download:", error);
        const errorRow = worksheet.addRow(["", " ", `ERROR: ${error.message}`]);
        highlightCells(errorRow, "C", "D", "FF0000");
        worksheet.addRow();
        return null;
    }
}

async function processCompany(company, downloadFolderPath, formattedDateTime, worksheet) {
    try {
        if (!isRunning) return;

        if (!browser) {
            browser = await chromium.launch({ 
                headless: false, 
                channel: "msedge",
                args: ['--new-instance']  // Start fresh instance each time
            });
        }
        if (!context) {
            context = await browser.newContext();
        }
        if (!page) {
            page = await context.newPage();
        }

        const companyNameRow = worksheet.addRow([`${company.id}`, `${company.company_name}`, `Extraction Date: ${formattedDateTime}`]);
        highlightCells(companyNameRow, "B", "D", "FFADD8E6", true);

        if (!company.kra_pin) {
            const errorMessage = "MISSING KRA PIN";
            console.log(`Skipping ${company.company_name}: ${errorMessage}`);
            const pinRow = worksheet.addRow(["", " ", errorMessage]);
            highlightCells(pinRow, "C", "D", "FF7474");
            worksheet.addRow();
            await updateSupabaseWithError(company, errorMessage, formattedDateTime);
            return;
        }

        if (!company.kra_pin.startsWith("P")) {
            const errorMessage = "INDIVIDUAL PIN";
            console.log(`Skipping ${company.company_name}: ${errorMessage}`);
            const pinRow = worksheet.addRow(["", " ", errorMessage]);
            highlightCells(pinRow, "C", "D", "FF7474");
            worksheet.addRow();
            await updateSupabaseWithError(company, errorMessage, formattedDateTime);
            return;
        }

        if (!company.kra_password) {
            const errorMessage = "MISSING PASSWORD";
            console.log(`Skipping ${company.company_name}: ${errorMessage}`);
            const passwordRow = worksheet.addRow(["", " ", errorMessage]);
            highlightCells(passwordRow, "C", "D", "FF7474");
            worksheet.addRow();
            await updateSupabaseWithError(company, errorMessage, formattedDateTime);
            return;
        }

        await loginToKRA(page, company);
        if (!isRunning) {
            await cleanup();
            return;
        }

        await page.waitForLoadState("networkidle");

        const menuItemsSelector = [
            "#ddtopmenubar > ul > li:nth-child(2) > a",
            "#ddtopmenubar > ul > li:nth-child(3) > a",
            "#ddtopmenubar > ul > li:nth-child(4) > a",
            "#ddtopmenubar > ul > li:nth-child(3) > a"
        ];

        for (const selector of menuItemsSelector) {
            await page.reload();
            const menuItem = await page.$(selector);
            if (menuItem) {
                const bbox = await menuItem.boundingBox();
                if (bbox) {
                    await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
                    if (await page.waitForSelector("#Returns > li:nth-child(3)", { timeout: 1000 }).then(() => true).catch(() => false)) {
                        break;
                    }
                }
            }
        }

        await page.waitForSelector("#Returns > li:nth-child(3)");
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => { showEReturns() });

        const vatOption = await page.locator("#regType").selectOption("Value Added Tax (VAT)", { state: 'visible', timeout: 500 }).catch(() => null);
        if (!vatOption) {
            console.log("VAT option not found, skipping to next iteration");
            const vatRow = worksheet.addRow(["", " ", "NO VAT"]);
            highlightCells(vatRow, "C", "D", "FF7474");
            worksheet.addRow();
            return;
        }

        await page.evaluate(() => { showSelTaxType(); });

        const downloadedFilePath = await initiateAndHandleDownload(page, worksheet, company, downloadFolderPath, formattedDateTime);
        if (!downloadedFilePath) {
            console.log(`Skipping further processing for ${company.company_name} due to download issues.`);
            return;
        }

        const extractedFiles = await extractAndRenameFiles(downloadedFilePath, company, formattedDateTime, downloadFolderPath);

        const excelFilePath = path.join(downloadFolderPath, `AUTO-POPULATION-SUMMARY-${formattedDateTime}.xlsx`);

        // Prepare files for upload
        const filesToUpload = [
            { path: downloadedFilePath, type: 'zip' },
            { path: excelFilePath, type: 'excel' },
            ...extractedFiles.map(file => ({ path: file.path, type: 'extracted', originalName: file.originalName }))
        ];

        let uploadedFiles = [];
        try {
            uploadedFiles = await uploadToSupabase(filesToUpload, company.company_name, formattedDateTime);
        } catch (uploadError) {
            console.error(`Error uploading files for ${company.company_name}:`, uploadError);
            // Continue with the process, but log the error
        }

        await updateSupabaseTable({
            company_name: company.company_name,
            kra_pin: company.kra_pin,
            kra_itax_current_password: company.kra_password
        }, formattedDateTime, uploadedFiles);

        const successRow = worksheet.addRow(["", " ", `SUCCESS - For ${getPreviousMonthName()}`]);
        highlightCells(successRow, "C", "D", "4CB944");
        worksheet.addRow();

        console.log(`Processing completed for ${company.company_name}`);
    } catch (error) {
        console.error(`Error occurred during processing for ${company.company_name}:`, error);
        const errorRow = worksheet.addRow(["", " ", `ERROR: ${error.message}`]);
        highlightCells(errorRow, "C", "D", "FF0000");
        worksheet.addRow();
    }
}

async function updateSupabaseWithError(company, errorMessage, extractionDate) {
    try {
        const { data: existingData, error: fetchError } = await supabase
            .from('Autopopulate')
            .select('*')
            .eq('company_name', company.company_name)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error("Error fetching existing data:", fetchError);
            throw fetchError;
        }

        const previousMonthName = getPreviousMonthName();
        const monthYear = previousMonthName;

        let updatedExtractions = existingData?.extractions || {};
        updatedExtractions[monthYear] = {
            extraction_date: extractionDate,
            error: errorMessage,
            status: 'error'
        };

        const { error } = await supabase
            .from('Autopopulate')
            .upsert({
                company_name: company.company_name,
                kra_pin: company.kra_pin,
                kra_itax_current_password: company.kra_password,
                extractions: updatedExtractions,
                last_updated: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                last_error: errorMessage,
                status: 'error'
            }, {
                onConflict: 'company_name',
                returning: 'minimal'
            });

        if (error) throw error;
        console.log(`Error status updated in database for ${company.company_name}: ${errorMessage}`);
    } catch (error) {
        console.error("Error updating error status in database:", error);
    }
}

async function updateSupabaseTable(company, extractionDate, uploadedFiles) {
    const previousMonth = getPreviousMonthName();
    const monthYear = previousMonth;

    try {
        // Get existing data first
        const { data: existingData, error: fetchError } = await supabase
            .from('Autopopulate')
            .select('*')
            .eq('company_name', company.company_name)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error("Error fetching existing data:", fetchError);
            throw fetchError;
        }

        // Initialize or update extractions
        let updatedExtractions = existingData?.extractions || {};
        
        // Clear any existing data for this month
        if (updatedExtractions[monthYear]) {
            console.log(`Clearing existing extraction data for ${monthYear}`);
        }

        // Set new data for this month
        updatedExtractions[monthYear] = {
            extraction_date: extractionDate,
            files: uploadedFiles.map(file => ({
                path: file.path,
                fullPath: file.fullPath,
                originalName: file.originalName,
                type: file.type
            })),
            status: 'success'
        };

        // Update the database
        const { error } = await supabase
            .from('Autopopulate')
            .upsert({
                company_name: company.company_name,
                kra_pin: company.kra_pin,
                kra_itax_current_password: company.kra_password,
                extractions: updatedExtractions,
                last_updated: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'success',
                last_error: null
            }, {
                onConflict: 'company_name',
                returning: 'minimal'
            });

        if (error) throw error;
        console.log(`Supabase table updated successfully for ${company.company_name}`);
    } catch (error) {
        console.error("Error updating Supabase table:", error);
        throw error;
    }
}

async function uploadToSupabase(files, companyName, extractionDate) {
    const previousMonth = getPreviousMonthName();
    const monthYear = previousMonth;
    const uploadedFiles = [];
    const failedUploads = [];

    try {
        // First, check and delete existing files for this month
        const { data: existingData } = await supabase
            .from('Autopopulate')
            .select('extractions')
            .eq('company_name', companyName)
            .single();

        if (existingData?.extractions?.[monthYear]?.files) {
            console.log(`Found existing files for ${monthYear}, deleting...`);
            const existingFiles = existingData.extractions[monthYear].files;
            for (const file of existingFiles) {
                if (file.path) {
                    const { error: deleteError } = await supabase.storage
                        .from('kra-documents')
                        .remove([file.path]);
                    
                    if (deleteError) {
                        console.warn(`Failed to delete file ${file.path}:`, deleteError);
                    } else {
                        console.log(`Successfully deleted existing file: ${file.path}`);
                    }
                }
            }
        }

        // Upload new files
        for (const file of files) {
            const fileName = path.basename(file.path);
            const storagePath = `${companyName}/auto-populate/${monthYear}/${fileName}`;

            try {
                const fileContent = await fs.readFile(file.path);
                const contentType = determineContentType(file.type, fileName);

                // Force delete any existing file at this path
                await supabase.storage
                    .from('kra-documents')
                    .remove([storagePath])
                    .catch(() => {}); // Ignore errors if file doesn't exist

                // Upload new file
                const { data, error } = await supabase.storage
                    .from('kra-documents')
                    .upload(storagePath, fileContent, { 
                        contentType,
                        upsert: true
                    });

                if (error) throw error;

                uploadedFiles.push(createFileObject(data || { path: storagePath }, file, storagePath));
                console.log(`Successfully uploaded: ${fileName}`);
            } catch (error) {
                console.error(`Error uploading file ${fileName} to Supabase:`, error);
                failedUploads.push({ fileName, error: error.message });
            }
        }

        if (failedUploads.length > 0) {
            console.warn(`Failed to upload ${failedUploads.length} file(s):`, failedUploads);
        }

        return uploadedFiles;
    } catch (error) {
        console.error('Error in uploadToSupabase:', error);
        throw error;
    }
}

function determineContentType(fileType, fileName) {
    if (fileType === 'zip') return 'application/zip';
    if (fileType === 'excel') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (fileName.endsWith('.pdf')) return 'application/pdf';
    if (fileName.endsWith('.csv')) return 'text/csv';
    if (fileName.endsWith('.txt')) return 'text/plain';
    return 'application/octet-stream';
}

function createFileObject(data, file, storagePath) {
    return {
        path: data.path || storagePath,
        fullPath: getPublicUrl(data.path || storagePath),
        originalName: file.originalName || path.basename(file.path),
        type: file.type,
        size: data.size,
        lastModified: new Date().toISOString()
    };
}

function getPublicUrl(path) {
    return `${supabaseUrl}/storage/v1/object/public/kra-documents/${path}`;
}

async function readZipFile(filePath) {
    const data = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(data);
    const extractedFiles = {};

    for (const [fileName, file] of Object.entries(zip.files)) {
        if (!file.dir) {
            const content = await file.async('nodebuffer');
            extractedFiles[fileName] = content.toString('base64');
        }
    }

    return extractedFiles;
}

async function extractAndRenameFiles(zipFilePath, company, startDateFormatted, downloadFolderPath) {
    const extractedFiles = [];

    async function processZipEntry(zipBuffer, parentPath = '') {
        const zip = await JSZip.loadAsync(zipBuffer);

        for (const [fileName, file] of Object.entries(zip.files)) {
            if (file.dir) continue; // Skip directories

            const content = await file.async('nodebuffer');
            
            if (fileName.toLowerCase().endsWith('.zip')) {
                // If it's a nested zip file, process its contents
                await processZipEntry(content, `${parentPath}${fileName}-`);
            } else {
                // Generate a unique filename
                const uniqueFileName = `${company.company_name}-${startDateFormatted}-${parentPath}${fileName.replace(/\//g, '-')}`;
                const newFilePath = path.join(downloadFolderPath, uniqueFileName);
                
                await fs.writeFile(newFilePath, content);

                extractedFiles.push({
                    originalName: `${parentPath}${fileName}`,
                    newName: uniqueFileName,
                    path: newFilePath
                });
            }
        }
    }

    const zipBuffer = await fs.readFile(zipFilePath);
    await processZipEntry(zipBuffer);
    return extractedFiles;
}

function getPreviousMonthName() {
    const currentDate = new Date();
    // Subtract one month from current date
    const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    return format(previousMonthDate, 'MMMM yyyy');
}

function highlightCells(row, startCol, endCol, color, bold = false) {
    for (let col = startCol.charCodeAt(0); col <= endCol.charCodeAt(0); col++) {
        const cell = row.getCell(String.fromCharCode(col));
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: color }
        };
        if (bold) {
            cell.font = { bold: true };
        }
    }
}

async function getReports() {
    try {
        const { data, error } = await supabase
            .from('Autopopulate')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        return data.map(item => ({
            id: item.id,
            companyName: item.company_name,
            lastUpdated: item.last_updated,
            extractions: Object.entries(item.extractions || {}).map(([monthYear, details]) => ({
                monthYear,
                extractionDate: details.extraction_date,
                zipFilePath: details.zip_file_path,
                excelFilePath: details.excel_file_path,
                extractedFiles: details.extracted_files
            }))
        }));
    } catch (error) {
        console.error('Error fetching reports:', error);
        throw error;
    }
}
