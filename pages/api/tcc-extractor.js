// @ts-nocheck
import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createClient } from "@supabase/supabase-js";
import { createWorker } from 'tesseract.js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let isRunning = false;
let progress = 0;
let totalCompanies = 0;
let currentCompany = '';

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { action, companies } = req.body;



    switch (action) {
        case "start":
            if (isRunning) {
                return res.status(400).json({ error: "TCC extraction already running" });
            }

            isRunning = true;
            progress = 0;

            processTCCExtraction(companies).catch(console.error);
            return res.status(200).json({ message: "TCC extraction started" });
        
        case "stop":
            console.log('Stopping TCC extraction process');
            isRunning = false;
            currentCompany = '';
            progress = 0;
            // Don't try to reset companies variable here as it's not in this scope
            totalCompanies = 0;
            return res.status(200).json({ message: "TCC extraction stopped", success: true });

        case "progress":
            return res.status(200).json({
                isRunning,
                progress,
                currentCompany
            });

        case "getReports":
            const reports = await getReports();
            return res.status(200).json(reports);

        default:
            return res.status(400).json({ message: "Invalid action" });
    }
}

async function processTCCExtraction(selectedCompanyIds = []) {
    let companies;

    if (selectedCompanyIds && selectedCompanyIds.length > 0) {
        // If specific companies are selected, fetch only those
        companies = [];
        const allCompanies = await readSupabaseData();
        
        console.log(`Processing ${selectedCompanyIds.length} selected companies out of ${allCompanies.length} total`);
        console.log('Selected company IDs:', selectedCompanyIds);
        
        // Ensure IDs are properly compared (handle string vs number comparison)
        companies = allCompanies.filter(company => {
            // Convert both to strings for comparison to avoid type mismatches
            const companyIdStr = String(company.id).trim();
            return selectedCompanyIds.some(selectedId => String(selectedId).trim() === companyIdStr);
        });
        
        console.log(`Found ${companies.length} matching companies for extraction`);
        if (companies.length === 0) {
            console.error('WARNING: No matching companies found for the selected IDs!');
            console.log('First few available company IDs:', allCompanies.slice(0, 5).map(c => c.id));
        } else {
            // Log the companies we'll be processing
            console.log('Selected companies for processing:', companies.map(c => ({ id: c.id, name: c.company_name })));
            console.log(`Processing ${companies.length} selected companies`);
        }
    } else {
        // Otherwise process all companies
        companies = await readSupabaseData();
        console.log(`Processing all ${companies.length} companies`);
    }

    totalCompanies = companies.length;

    const now = new Date();
    // Format date as DD/MM/YYYY | HH:MM:SS AM/PM for consistency (for display and database)
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = (hours % 12 || 12).toString().padStart(2, '0');
    const formattedTime = `${formattedHours}:${minutes}:${seconds} ${ampm}`;

    // Use the display format for the database - this is used as the extraction date key
    // Format: DD/MM/YYYY | HH:MM:SS AM/PM
    const formattedDateTime = `${day}/${month}/${year} | ${formattedTime}`;
    console.log(`Using standardized extraction date format: ${formattedDateTime}`);

    // Create a filesystem-friendly version for the folder path
    const filesystemSafeDateTime = `${day}-${month}-${year}_${formattedHours}-${minutes}-${seconds}`;
    const downloadFolderPath = path.join(process.cwd(), 'tmp', filesystemSafeDateTime);
    await fs.mkdir(downloadFolderPath, { recursive: true });

    const KRA_TCC_DOCUMENT_ID = '5c658f23-7d16-4453-9965-619b72b9166a';

// Database utility functions are now inlined for better scoping

    /**
     * Uploads a file to Supabase storage with proper path sanitization
     * @param {string} filePath - Local path to the file
     * @param {string} companyName - Name of the company
     * @param {string} fileType - Type of file (pdf, screenshot, etc.)
     * @param {string} dateTimeStamp - Timestamp for the file
     * @returns {string} - The storage path in Supabase
     */
    async function uploadToSupabase(filePath, companyName, fileType, dateTimeStamp) {
        try {
            // Check if file exists
            const fileStats = await fs.lstat(filePath);
            if (!fileStats.isFile()) {
                console.log(`File not found: ${filePath}`);
                return fileType === 'pdf' ? 'no_doc' : 'no_screenshot';
            }

            // Read file content
            const fileContent = await fs.readFile(filePath);

            // Sanitize company name for storage path - remove spaces and special characters
            const sanitizedCompanyName = companyName
                .replace(/[\s&\/\\#,+()$~%.'":*?<>{}]/g, '_') // Replace spaces and special chars with underscores
                .replace(/__+/g, '_'); // Replace multiple underscores with a single one

            // Create a safe storage path
            const storagePath = `${sanitizedCompanyName}/${fileType}/${dateTimeStamp}_${path.basename(filePath).replace(/\s+/g, '_')}`;

            // Determine content type based on file extension
            const contentType = fileType === 'pdf' ? 'application/pdf' : 'image/png';

            // Upload to Supabase storage
            const { data, error } = await supabase.storage
                .from('kra-documents')
                .upload(storagePath, fileContent, {
                    contentType,
                    upsert: true,
                });

            if (error) {
                console.log(`Error uploading ${fileType} for ${companyName}: ${JSON.stringify(error)}`);
                return fileType === 'pdf' ? 'no_doc' : 'no_screenshot';
            }

            return storagePath;
        } catch (error) {
            console.log(`Exception during ${fileType} upload for ${companyName}: ${error.message}`);
            return fileType === 'pdf' ? 'no_doc' : 'no_screenshot';
        }
    }

    for (let i = 0; i < companies.length && isRunning; i++) {
        currentCompany = companies[i].company_name;
        console.log(`Processing company ${i + 1}/${companies.length}: ${currentCompany}`);

        // Implement retry mechanism - try up to 3 times
        let success = false;
        let attempts = 0;
        let lastError = null;

        while (!success && attempts < 3) {
            try {
                attempts++;
                if (attempts > 1) {
                    console.log(`Retry attempt ${attempts} for company: ${currentCompany}`);
                    // Add a small delay before retrying
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }

                // FIXED: Pass the total companies count to processCompany
                await processCompany(companies[i], downloadFolderPath, filesystemSafeDateTime, companies.length);
                success = true; // If we get here without an error, mark as success
            } catch (error) {
                lastError = error;
                console.log(`Error processing company ${currentCompany} (Attempt ${attempts}/3): ${error.message}`);

                // Only retry on timeout errors or connection issues
                if (!error.message.includes('timeout') &&
                    !error.message.includes('ECONNRESET') &&
                    !error.message.includes('navigation') &&
                    !error.message.includes('net::ERR')) {
                    // For non-timeout errors, don't retry
                    break;
                }
            }
        }

        if (!success) {
            console.error(`Failed to process company ${currentCompany} after 3 attempts. Last error: ${lastError?.message}`);
        }

        progress = Math.round(((i + 1) / totalCompanies) * 100);
    }

    isRunning = false;
    currentCompany = '';
}

async function readSupabaseData() {
    try {
        const { data, error } = await supabase.from("acc_portal_company_duplicate").select("*").eq("kra_status", "Valid").order("id", { ascending: true });

        if (error) {
            throw new Error(`Error reading data from 'acc_portal_company_duplicate' table: ${error.message}`);
        }

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
    await page.waitForTimeout(500);

    const image = await page.waitForSelector("#captcha_img");
    const imagePath = path.join(os.tmpdir(), "ocr.png");
    await image.screenshot({ path: imagePath });

    const worker = await createWorker('eng', 1);
    console.log("Extracting Text...");
    let result;

    const extractResult = async () => {
        const ret = await worker.recognize(imagePath);
        const text1 = ret.data.text.slice(0, -1);
        const text = text1.slice(0, -1);
        const numbers = text.match(/\d+/g);
        console.log('Extracted Numbers:', numbers);

        if (!numbers || numbers.length < 2) {
            throw new Error("Unable to extract valid numbers from the text.");
        }

        if (text.includes("+")) {
            result = Number(numbers[0]) + Number(numbers[1]);
        } else if (text.includes("-")) {
            result = Number(numbers[0]) - Number(numbers[1]);
        } else {
            throw new Error("Unsupported operator.");
        }
    };

    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
        try {
            await extractResult();
            break;
        } catch (error) {
            console.log("Re-extracting text from image...");
            attempts++;
            if (attempts < maxAttempts) {
                await page.waitForTimeout(1000);
                await image.screenshot({ path: imagePath });
                continue;
            } else {
                console.log("Max attempts reached. Logging in again...");
                return loginToKRA(page, company);
            }
        }
    }

    console.log('Result:', result.toString());
    await worker.terminate();
    await page.type("#captcahText", result.toString());
    await page.click("#loginButton");

    const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 1000 })
        .catch(() => false);

    if (isInvalidLogin) {
        console.log("Wrong result of the arithmetic operation, retrying...");
        await loginToKRA(page, company);
    }
    await page.goto("https://itax.kra.go.ke/KRA-Portal/");
}

async function uploadToSupabase(filePath, companyName, fileType, extractionDate) {
    try {
        // Sanitize company name for file paths to avoid invalid keys
        // 1. Limit length and replace invalid characters
        const sanitizeNameForPath = (name) => {
            // Remove special characters that might cause issues in paths
            const sanitized = name.replace(/[^a-zA-Z0-9_\-. ]/g, '')
                .replace(/\s+/g, '_')
                .trim();
            // Limit length to avoid path too long errors (max 50 chars)
            return sanitized.substring(0, 50);
        };

        const sanitizedCompanyName = sanitizeNameForPath(companyName);
        const fileName = `${extractionDate}_${path.basename(filePath)}`;
        const storagePath = `${sanitizedCompanyName}/${fileType}/${fileName}`;
        const fileContent = await fs.readFile(filePath);

        // First try to upload with upsert option to handle duplicates
        const { data, error } = await supabase.storage
            .from('kra-documents')
            .upload(storagePath, fileContent, {
                contentType: fileType === 'pdf' ? 'application/pdf' : 'image/png',
                upsert: true // Overwrite if already exists
            });

        if (error) {
            // If error still occurs and it's not a duplicate issue
            if (error.statusCode !== '409') {
                console.error(`Error uploading ${fileType} for ${companyName}:`, error);
                // Return a default value instead of throwing
                return fileType === 'pdf' ? 'no_doc' : 'no_screenshot';
            }

            // For duplicate errors, get the public URL instead
            console.log(`File already exists for ${companyName}, using existing file.`);

            // Check if file exists and return its path
            const { data: fileData } = await supabase.storage
                .from('kra-documents')
                .getPublicUrl(storagePath);

            if (fileData) {
                return storagePath; // Return the path even if it's a duplicate
            } else {
                return fileType === 'pdf' ? 'no_doc' : 'no_screenshot';
            }
        }

        return data.path;
    } catch (error) {
    }

    // Use company_id or id, whichever is available
    const companyId = companyData.company_id || companyData.id;

    // Ensure it's a valid ID
    if (typeof companyId === 'undefined' || companyId === null) {
        console.error('Company ID is null or undefined. Cannot update database.');
        return {
            success: false,
            message: "Invalid company ID"
        };
    }

    console.log(`Updating database for company ID: ${companyId}`);
    // Ensure it's a valid ID
    if (typeof companyId === 'undefined' || companyId === null) {
        console.error('Company ID is null or undefined. Cannot update database.');
        return {
            success: false,
            message: "Invalid company ID"
        };
    }

    console.log(`Updating database for company ID: ${companyId}`);



    const { data: tccData, error: tccError } = await supabase
        .from('TaxComplianceCertificates')
        .select('extractions, company_id')
        .eq('company_id', companyId)
        .single();

    if (tccError && tccError.code !== 'PGRST116') {
        console.log(`Error checking for existing extractions for company ${companyId}: ${tccError.message}`);
        // Don't throw, just return error
        return {
            success: false,
            message: `Error checking for existing extractions: ${tccError.message}`
        };
    }

    // Try to get KYC data if we have a valid ID
    let kycData, kycError;
    try {
        const kycResponse = await supabase
            .from('acc_portal_kyc_uploads')
            .select('*')
            .eq('kyc_document_id', '5c658f23-7d16-4453-9965-619b72b9166a')
            .eq('userid', companyId.toString())
            .order('created_at', { ascending: false });

        kycData = kycResponse.data;
        kycError = kycResponse.error;
    } catch (err) {
        console.log(`Error in KYC query for company ${companyId}: ${err.message}`);
        kycError = err;
    }

    if (kycError) {
        console.log(`Error checking for existing KYC uploads for company ${companyId}: ${kycError.message}`);
    }

    const hasRecentKycUpload = kycData && kycData.length > 0 &&
        new Date(kycData[0].created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (hasRecentKycUpload) {
        console.log(`Company ${companyId} (${companyData.company_name || 'Unknown'}) has a recent TCC document uploaded in the last 7 days. Skipping.`);
        return {
            success: true,
            message: "Skipped - recent document exists",
            data: {
                company_id: companyId,
                status: "Skipped - recent document exists"
            }
        };
    }

    // Get existing data or create new data structure
    let existingExtractions = {};
    if (tccData) {
        existingExtractions = tccData.extractions || {};
    }

    // Get company PIN from the extracted data or directly from companyData
    const companyPin = companyData.PIN || companyData.kra_pin;
    if (!companyPin) {
        console.error(`Company PIN is missing, cannot update database record`);
        return {
            success: false,
            message: "Missing company PIN"
        };
    }

    console.log(`Creating/updating TCC record for PIN: ${companyPin}`);

    const extractionRecord = {
        // Status
        status: companyData.Status || 'Unknown',

        // Certificate details
        certificate_date: companyData.CertificateDate || '',
        expiry_date: companyData.ExpiryDate || '',
        serial_no: companyData.SerialNo || companyData.CertificateSerialNo || '',

        // Documents
        pdf_link: companyData.pdfLink || "no_doc",
        screenshot_link: companyData.screenshotLink || "no_screenshot",

        // Timestamps - Always use consistent, human-readable format
        extraction_date: extractionDate, // Using the formatted date: dd/mm/yyyy | hh:mm:ss AM/PM
        timestamp: new Date().toISOString(),

        // Store ISO date for programmatic access
        last_extraction_datetime: new Date().toISOString()
    };

    // If we have full table data, add it
    if (fullTableData && fullTableData.length > 0) {
        extractionRecord.full_table_data = fullTableData;
    }

    // Create the database record object
    const updatedData = {
        company_pin: companyPin,
        company_id: companyId,
        company_name: companyData.company_name || companyData.TaxPayerName || "Unknown"
    };

    // Check if we have existing extractions or create a new object
    if (tccData && tccData.extractions) {
        // Add our new extraction to the existing ones
        updatedData.extractions = {
            ...tccData.extractions,
            [extractionDate]: extractionRecord
        };
    } else {
        // Create a new extractions object
        updatedData.extractions = {
            [extractionDate]: extractionRecord
        };
    }

    try {
        // Step 1: Update the TCC record with new extraction details
        const { data, error } = await supabase
            .from('TaxComplianceCertificates')
            .upsert(updatedData, {
                onConflict: 'company_pin',
                returning: 'minimal'
            });

        if (error) {
            console.error(`Error inserting/updating TCC record: ${error.message}`);
            return {
                success: false,
                message: `Database update failed: ${error.message}`
            };
        }

        // Step 2: After successful TCC update, sync all KYC uploads for this company
        try {
            // Find all KYC uploads for this company for TCC documents
            const { data: kycUploads } = await supabase
                .from('acc_portal_kyc_uploads')
                .select('id')
                .eq('userid', companyId.toString())
                .eq('kyc_document_id', '5c658f23-7d16-4453-9965-619b72b9166a');

            if (kycUploads && kycUploads.length > 0) {
                // Get all KYC upload IDs
                const kycUploadIds = kycUploads.map(upload => upload.id);

                // Update all KYC uploads with the new timestamp to keep them in sync
                const { error: updateError } = await supabase
                    .from('acc_portal_kyc_uploads')
                    .update({ updated_at: new Date().toISOString() })
                    .in('id', kycUploadIds);

                if (updateError) {
                    console.log(`Error updating KYC upload timestamps: ${updateError.message}`);
                    // Continue even if the KYC update fails
                } else {
                    console.log(`Successfully updated timestamps for ${kycUploadIds.length} KYC uploads`);
                }
            }
        } catch (kycError) {
            console.log(`Error syncing KYC upload dates: ${kycError.message}`);
            // Continue even if KYC sync fails - don't block the main process
        }

        return {
            success: true,
            data
        };
    } catch (dbError) {
        console.error(`Exception during database update: ${dbError.message}`);
        return {
            success: false,
            message: `Database exception: ${dbError.message}`
        };
    }
}

async function processCompany(company, downloadFolderPath, formattedDateTime, totalCompaniesCount) {
    // Create a consistent date format for extraction records
    // This is the human-readable format: DD/MM/YYYY | HH:MM:SS AM/PM
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = (hours % 12 || 12).toString().padStart(2, '0');
    
    // Format: DD/MM/YYYY | HH:MM:SS AM/PM
    const extractionDate = `${day}/${month}/${year} | ${formattedHours}:${minutes}:${seconds} ${ampm}`;
    console.log(`Using extraction date: ${extractionDate} for company ${company.company_name}`);

    // Create a filesystem-safe version for filenames - this ensures all paths use the safe format
    const filesystemSafeDateTime = formattedDateTime.replace(/\//g, '-').replace(/ \| /g, '_');
    let browser = null;
    let context = null;
    let page = null;

    try {
        // Set timeouts for browser operations
        const navigationTimeout = 60000; // 60 seconds for navigation
        browser = await chromium.launch({ headless: false, channel: "chrome" });
        context = await browser.newContext();
        page = await context.newPage();

        // Set navigation timeout
        page.setDefaultNavigationTimeout(navigationTimeout);
        page.setDefaultTimeout(navigationTimeout);

        // Login to KRA portal with timeout handling
        await Promise.race([
            loginToKRA(page, company),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Login timeout after 45 seconds')), 45000)
            )
        ]);

        await page.hover("#ddtopmenubar > ul > li:nth-child(8) > a");
        await page.evaluate(() => {
            showReprintTCC();
        });

        await page.getByRole("button", { name: "Consult" }).click();
        page.once("dialog", dialog => {
            dialog.accept().catch(() => { });
        });

        await page.getByRole("button", { name: "Consult" }).click();
        page.once("dialog", dialog => {
            dialog.accept().catch(() => { });
        });

        // Extract the full table data from the page
        let fullTableData = await page.$$eval('#tbl tbody tr', rows => rows.map(row => {
            const cells = row.querySelectorAll('td');
            return {
                SerialNo: cells[0].textContent.trim(),
                PIN: cells[1].textContent.trim(),
                TaxPayerName: cells[2].textContent.trim(),
                Status: cells[3].textContent.trim(),
                CertificateDate: cells[4].textContent.trim(),
                ExpiryDate: cells[5].textContent.trim(),
                CertificateSerialNo: cells[6].textContent.trim()
            };
        }));
        
        console.log(`Extracted table data for ${company.company_name}:`, fullTableData);

        let pdfSupabasePath = "no doc";
        if (await page.$('a.textDecorationUnderline')) {
            const downloadPromise = page.waitForEvent("download");
            await page.click('a.textDecorationUnderline');
            const download = await downloadPromise;
            const pdfPath = path.join(
                downloadFolderPath,
                `${company.company_name} - TCC CERT - DWN- ${filesystemSafeDateTime}.pdf`
            );
            await download.saveAs(pdfPath);
            console.log("TCC certificate downloaded successfully.");
            // Use a storage-safe path for Supabase uploads
            pdfSupabasePath = await uploadToSupabase(pdfPath, company.company_name, 'pdf', filesystemSafeDateTime);
        } else {
            console.log("Download link not found. Marking as 'no doc'.");
        }

        // Ensure the page is fully loaded and visible before taking screenshot
        await page.waitForTimeout(2000); // Wait for any animations/transitions to complete

        // Prepare for clean screenshot 
        try {
            // Set viewport to ensure all content is visible
            await page.setViewportSize({ width: 1200, height: 900 });

            // Try to remove any popups or overlays if present
            await page.evaluate(() => {
                // Remove any modal/popup elements if present
                document.querySelectorAll('.modal, .popup, .overlay').forEach(elem => {
                    if (elem) elem.style.display = 'none';
                });

                // Clean up any fixed headers that might cover content
                document.querySelectorAll('header, .header').forEach(elem => {
                    if (elem && elem.style.position === 'fixed') {
                        elem.style.position = 'relative';
                    }
                });
            });
        } catch (err) {
            console.log('Page preparation for screenshot had minor issues, continuing anyway:', err.message);
        }

        // Take screenshot with consistent naming and high quality
        const screenshotPath = path.join(
            downloadFolderPath,
            `${company.id}_TCC_screenshot.png`
        );

        await page.screenshot({
            path: screenshotPath,
            fullPage: true,
            timeout: 5000 // Extra time for large pages
        });
        console.log("High-quality screenshot taken successfully.");

        // Use the same path variable for consistency
        const screenshotFilePath = screenshotPath;
        let screenshotSupabasePath = "no_screenshot"; // Initialize with default value

        try {
            // Use our sanitized upload function to handle the screenshot
            screenshotSupabasePath = await uploadToSupabase(
                screenshotFilePath,
                company.company_name,
                'screenshot',
                filesystemSafeDateTime
            );

            // Only proceed if the upload was successful
            if (screenshotSupabasePath !== 'no_screenshot') {
                const { data: kycData, error: kycError } = await supabase
                    .from('acc_portal_kyc_uploads')
                    .select('*')
                    .eq('kyc_document_id', '5c658f23-7d16-4453-9965-619b72b9166a')
                    .eq('userid', company.id.toString())
                    .order('created_at', { ascending: false });

                if (kycError) {
                    console.log(`Error checking for existing KYC uploads for company ${company.id}: ${kycError.message}`);
                }

                if (kycData && kycData.length > 0) {
                    const kycUploadId = kycData[0].id;
                    // Use filesystem-friendly format for KYC storage paths too
                    const kycScreenshotPath = `tcc_screenshots/${company.id}/${filesystemSafeDateTime}.png`;
                    const { error: kycScreenshotError } = await supabase.storage
                        .from('kyc-documents')
                        .upload(kycScreenshotPath, screenshotFileContent, {
                            contentType: 'image/png',
                            upsert: true,
                        });

                    if (kycScreenshotError) {
                        console.log(`Error uploading screenshot to kyc-documents for company ${company.id}: ${kycScreenshotError.message}`);
                    } else {
                        // Create metadata object with extraction details
                        const metadataObj = {
                            source: 'auto-extraction',
                            extraction_data: {
                                company_name: company.company_name,
                                status: fullTableData[0].Status,
                                certificate_date: fullTableData[0].CertificateDate,
                                expiry_date: fullTableData[0].ExpiryDate,
                                serial_no: fullTableData[0].SerialNo,
                                pdf_link: pdfSupabasePath,
                                screenshot_link: screenshotSupabasePath,
                                full_table_data: fullTableData
                            },
                            screenshot_path: kycScreenshotPath,
                            extraction_date: formattedDateTime
                        };

                        // Update both the extraction details and the updated_at timestamp
                        // This ensures the Last Extracted date in the reports page will update
                        const updateData = {
                            extracted_details: metadataObj,
                            updated_at: new Date().toISOString() // Update the timestamp to current time
                        };

                        console.log(`Updating KYC record for company ${company.id} with metadata`);

                        try {
                            const { error: updateError } = await supabase
                                .from('acc_portal_kyc_uploads')
                                .update(updateData)
                                .eq('id', kycUploadId);

                            if (updateError) {
                                console.log(`Error updating KYC upload with screenshot for company ${company.id}: ${updateError.message}`);
                            } else {
                                console.log(`Successfully updated KYC upload with screenshot for company ${company.id}`);
                            }
                        } catch (databaseError) {
                            console.log(`Exception during KYC database update for company ${company.id}: ${databaseError.message}`);
                            // Continue processing even if KYC update fails
                        }
                    }
                }
            } else {
                console.log(`Error handling screenshot for company ${company.id}: Screenshot file not found`);
            }
        } catch (error) {
            console.log(`Error handling screenshot for company ${company.id}: ${error.message}`);
            // screenshotSupabasePath remains as "no_screenshot" if there's an error
        }

        // For selected runs, we ALWAYS want to update the extraction date, 
        // even if no data was found, as long as we attempted an extraction
        const isSelectedRun = totalCompaniesCount > 0 && totalCompaniesCount < 10;
        
        
        // Only skip if no data AND no screenshot AND it's not a selected run
        if ((!fullTableData || fullTableData.length === 0) && screenshotSupabasePath === "no_screenshot" && !isSelectedRun) {
            console.log(`No data extracted from table and no screenshot for company ${company.company_name}. Skipping database update.`);
            return;
        }
        
        // If it's a selected run, we'll always update to indicate an extraction was attempted
        if (isSelectedRun) {
            console.log(`Selected run: Forcing extraction date update for company ${company.company_name} regardless of results`);
        }
        
        // If we have a screenshot but no table data, we'll still update the database
        if (!fullTableData || fullTableData.length === 0) {
            console.log(`No table data extracted for company ${company.company_name}, but screenshot is available. Proceeding with database update.`);
            // Create empty table data to avoid errors
            fullTableData = [];
        }

        // Prepare company data for database update
        let companyData;
        
        if (fullTableData.length > 0) {
            // If we have table data, use it
            companyData = {
                ...company,
                ...fullTableData[0],
                pdfLink: pdfSupabasePath,
                screenshotLink: screenshotSupabasePath
            };
        } else {
            // If we don't have table data but have a screenshot, create a minimal record
            companyData = {
                ...company,
                Status: 'Unknown',  // No status available without table data
                CertificateDate: '',
                ExpiryDate: '',
                SerialNo: '',
                CertificateSerialNo: '',
                pdfLink: pdfSupabasePath,
                screenshotLink: screenshotSupabasePath,
                TaxPayerName: company.company_name
            };
            console.log('Created minimal record with screenshot for database update');
        }

        // Update the database with the extracted certificate details
        try {
            // Check if we already have a record for this company in the TCC table
            const companyId = companyData.id || '';
            if (!companyId) {
                console.error(`Company ID is missing, cannot update database record`);
                return;
            }

            console.log(`Updating database for company ID: ${companyId}`);
            console.log(`Using extraction date format: ${extractionDate}`);

            const { data: tccData, error: tccError } = await supabase
                .from('TaxComplianceCertificates')
                .select('extractions, company_id')
                .eq('company_id', companyId)
                .single();

            if (tccError && tccError.code !== 'PGRST116') {
                console.log(`Error checking for existing extractions for company ${companyId}: ${tccError.message}`);
                return;
            }

            // Try to get KYC data if we have a valid ID
            let kycData, kycError;
            try {
                const kycResponse = await supabase
                    .from('acc_portal_kyc_uploads')
                    .select('*')
                    .eq('kyc_document_id', '5c658f23-7d16-4453-9965-619b72b9166a')
                    .eq('userid', companyId.toString())
                    .order('created_at', { ascending: false });

                kycData = kycResponse.data;
                kycError = kycResponse.error;
            } catch (err) {
                console.log(`Error in KYC query for company ${companyId}: ${err.message}`);
                kycError = err;
            }

            if (kycError) {
                console.log(`Error checking for existing KYC uploads for company ${companyId}: ${kycError.message}`);
            }

            const hasRecentKycUpload = kycData && kycData.length > 0 &&
                new Date(kycData[0].created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            if (hasRecentKycUpload) {
                console.log(`Company ${companyId} (${companyData.company_name || 'Unknown'}) has a recent TCC document uploaded in the last 7 days. Skipping.`);
                return;
            }

            // Get existing data or create new data structure
            let existingExtractions = {};
            if (tccData) {
                existingExtractions = tccData.extractions || {};
            }

            // Get company PIN from the extracted data or directly from companyData
            const companyPin = companyData.PIN || companyData.kra_pin;
            if (!companyPin) {
                console.error(`Company PIN is missing, cannot update database record`);
                return;
            }

            console.log(`Creating/updating TCC record for PIN: ${companyPin}`);

            const extractionRecord = {
                // Status
                status: companyData.Status || 'Unknown',

                // Certificate details
                certificate_date: companyData.CertificateDate || '',
                expiry_date: companyData.ExpiryDate || '',
                serial_no: companyData.SerialNo || companyData.CertificateSerialNo || '',

                // Documents
                pdf_link: companyData.pdfLink || "no_doc",
                screenshot_link: companyData.screenshotLink || "no_screenshot",

                // Timestamps - Always use consistent, human-readable format
                extraction_date: extractionDate, // Using the formatted date: DD/MM/YYYY | HH:MM:SS AM/PM
                timestamp: new Date().toISOString(),
                
                // Store ISO date for programmatic access
                last_extraction_datetime: new Date().toISOString(),
                
                // Add standardized date that will be easier to parse by JavaScript Date
                standardized_date: new Date().toISOString()
            };

            // Log the data being sent to TaxComplianceCertificates table
            console.log('=========== DATA SENT TO TaxComplianceCertificates TABLE ===========');
            console.log(JSON.stringify(extractionRecord, null, 2));
            console.log('==================================================================');

            // If we have full table data, add it
            if (fullTableData && fullTableData.length > 0) {
                extractionRecord.full_table_data = fullTableData;
                console.log('=========== FULL TABLE DATA EXTRACTED FROM PAGE ===========');
                console.log(`Found ${fullTableData.length} rows of table data`);
                console.log(JSON.stringify(fullTableData, null, 2));
                console.log('==============================================================');
            } else {
                console.log('WARNING: No full table data was extracted from the page');
            }

            // Create the database record object - without full_table_data at root level
            const updatedData = {
                company_pin: companyPin,
                company_id: companyId,
                company_name: companyData.company_name || companyData.TaxPayerName || "Unknown",
                // Use the last_extraction_date column that now exists in the table
                // This will be automatically updated with the current UTC timestamp
                // due to the default value in the database
                last_extraction_date: new Date()
            };
            
            console.log('=========== FINAL UPDATED DATA OBJECT FOR DATABASE ===========');
            console.log('Company ID:', companyId);
            console.log('Extracting full_table_data for:', extractionDate);
            console.log('Full table data rows:', fullTableData ? fullTableData.length : 0);
            console.log('Data will be saved in extractions object, not at root level');
            console.log('==============================================================');

            // Check if we have existing extractions or create a new object
            if (tccData && tccData.extractions) {
                // Add our new extraction to the existing ones
                updatedData.extractions = {
                    ...tccData.extractions,
                    [extractionDate]: extractionRecord
                };
                console.log('=========== MERGED WITH EXISTING EXTRACTIONS ===========');
                console.log('Previous extraction dates:', Object.keys(tccData.extractions));
                console.log('New extraction date added:', extractionDate);
                console.log('Final extraction dates:', Object.keys(updatedData.extractions));
                console.log('============================================================');
            } else {
                // Create a new extractions object
                updatedData.extractions = {
                    [extractionDate]: extractionRecord
                };
                console.log('=========== CREATED NEW EXTRACTIONS OBJECT ===========');
                console.log('New extraction date:', extractionDate);
                console.log('=========================================================');
            }

            // Step 1: Update the TCC record with new extraction details
            const { data, error } = await supabase
                .from('TaxComplianceCertificates')
                .upsert(updatedData, {
                    onConflict: 'company_pin',
                    returning: 'minimal'
                });

            if (error) {
                console.error(`Error inserting/updating TCC record: ${error.message}`);
                return;
            }
            
            // Step 2: After successful TCC update, sync all KYC uploads for this company
            try {
                console.log('=========== SYNCING acc_portal_kyc_uploads TABLE ===========');
                console.log('Company ID:', companyId);
                console.log('KYC Document ID:', '5c658f23-7d16-4453-9965-619b72b9166a');
                console.log('Extraction Date:', extractionDate);
                console.log('ISO Timestamp:', new Date().toISOString());
                console.log('==================================================================');
                
                // Find all KYC uploads for this company for TCC documents
                const { data: kycUploads } = await supabase
                    .from('acc_portal_kyc_uploads')
                    .select('id')
                    .eq('userid', companyId.toString())
                    .eq('kyc_document_id', '5c658f23-7d16-4453-9965-619b72b9166a');
                
                if (kycUploads && kycUploads.length > 0) {
                    // Get all KYC upload IDs
                    const kycUploadIds = kycUploads.map(upload => upload.id);
                    
                    // Update all KYC uploads with the new timestamp to keep them in sync
                    const { error: updateError } = await supabase
                        .from('acc_portal_kyc_uploads')
                        .update({ updated_at: new Date().toISOString() })
                        .in('id', kycUploadIds);
                    
                    if (updateError) {
                        console.log(`Error updating KYC upload timestamps: ${updateError.message}`);
                        // Continue even if the KYC update fails
                    } else {
                        console.log(`Successfully updated timestamps for ${kycUploadIds.length} KYC uploads`);
                    }
                }
            } catch (kycError) {
                console.log(`Error syncing KYC upload dates: ${kycError.message}`);
                // Continue even if KYC sync fails - don't block the main process
            }
            
            console.log(`Database update completed successfully for company ${companyData.company_name}`);
        } catch (error) {
            console.error(`Error updating database: ${error.message}`);
            // Don't throw here, we want to continue processing
        }

        // Logout from KRA portal
        try {
            await page.evaluate(() => {
                logOutUser();
            });
        } catch (error) {
            console.log(`Error during logout for company ${company.company_name}: ${error.message}`);
            // Continue even if logout fails
        }

        console.log(`Processing completed for ${company.company_name}`);
    } catch (error) {
        console.error(`Error occurred during processing for ${company.company_name}: ${error.message}`);

        // Rethrow the error so the retry mechanism can catch it
        throw error;
    } finally {
        // Make sure to close the browser in all cases
        if (browser) {
            await browser.close().catch(e => console.log(`Error closing browser: ${e.message}`));
        }
    }
}
