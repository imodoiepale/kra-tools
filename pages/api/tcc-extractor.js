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
            companies = [];
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
        
        // Filter to only the selected companies
        companies = allCompanies.filter(company => selectedCompanyIds.includes(company.id));
        console.log(`Processing ${companies.length} selected companies`);
    } else {
        // Otherwise process all companies
        companies = await readSupabaseData();
        console.log(`Processing all ${companies.length} companies`);
    }
    
    totalCompanies = companies.length;

    const now = new Date();
    const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
    const downloadFolderPath = path.join(process.cwd(), 'tmp', formattedDateTime);
    await fs.mkdir(downloadFolderPath, { recursive: true });

    const KRA_TCC_DOCUMENT_ID = '5c658f23-7d16-4453-9965-619b72b9166a';

    for (let i = 0; i < companies.length && isRunning; i++) {
        currentCompany = companies[i].company_name;
        console.log(`Processing company ${i+1}/${companies.length}: ${currentCompany}`);
        await processCompany(companies[i], downloadFolderPath, formattedDateTime);
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
        const fileName = `${extractionDate}_${path.basename(filePath)}`;
        const storagePath = `${companyName}/${fileType}/${fileName}`;
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
        console.error(`Unexpected error during upload for ${companyName}:`, error);
        return fileType === 'pdf' ? 'no_doc' : 'no_screenshot';
    }
}

async function updateSupabaseTable(companyData, extractionDate, fullTableData) {
    try {
        // Ensure company_id and id are defined and valid
        if (!companyData.company_id && !companyData.id) {
            console.error('Missing company ID in extraction data. Cannot update database.');
            return {
                success: false,
                message: "Missing company ID"
            };
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
        
        // Create a new extraction record for this date
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
            
            // Timestamps
            extraction_date: extractionDate,
            timestamp: new Date().toISOString()
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
    } catch (error) {
        console.error(`Error updating Supabase table: ${error.message}`);
        return {
            success: false,
            message: `General error: ${error.message}`
        };
    }
}

async function processCompany(company, downloadFolderPath, formattedDateTime) {
    const browser = await chromium.launch({ headless: false, channel: "chrome" });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await loginToKRA(page, company);

        await page.hover("#ddtopmenubar > ul > li:nth-child(8) > a");
        await page.evaluate(() => {
            showReprintTCC();
        });

        await page.getByRole("button", { name: "Consult" }).click();
        page.once("dialog", dialog => {
            dialog.accept().catch(() => {});
        });

        await page.getByRole("button", { name: "Consult" }).click();
        page.once("dialog", dialog => {
            dialog.accept().catch(() => {});
        });

        const fullTableData = await page.$$eval('#tbl tbody tr', rows => rows.map(row => {
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

        let pdfSupabasePath = "no doc";
        if (await page.$('a.textDecorationUnderline')) {
            const downloadPromise = page.waitForEvent("download");
            await page.click('a.textDecorationUnderline');
            const download = await downloadPromise;
            const pdfPath = path.join(
                downloadFolderPath,
                `${company.company_name} - TCC CERT - DWN- ${formattedDateTime}.pdf`
            );
            await download.saveAs(pdfPath);
            console.log("TCC certificate downloaded successfully.");
            pdfSupabasePath = await uploadToSupabase(pdfPath, company.company_name, 'pdf', formattedDateTime);
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
            const screenshotStats = await fs.lstat(screenshotFilePath);
            if (screenshotStats.isFile()) {
                const screenshotFileContent = await fs.readFile(screenshotFilePath);
                const screenshotStoragePath = `TCC_screenshots/${formattedDateTime}_${company.id}.png`;
                const { error: screenshotUploadError } = await supabase.storage
                    .from('kra-documents')
                    .upload(screenshotStoragePath, screenshotFileContent, {
                        contentType: 'image/png',
                        upsert: true,
                    });

                if (screenshotUploadError) {
                    console.log(`Error uploading screenshot for company ${company.id}: ${screenshotUploadError.message}`);
                } else {
                    screenshotSupabasePath = screenshotStoragePath; // Assign to the variable in outer scope

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
                        const kycScreenshotPath = `tcc_screenshots/${company.id}/${formattedDateTime}.png`;
                        const { error: kycScreenshotError } = await supabase.storage
                            .from('kyc-documents')
                            .upload(kycScreenshotPath, screenshotFileContent, {
                                contentType: 'image/png',
                                upsert: true,
                            });

                        if (kycScreenshotError) {
                            console.log(`Error uploading screenshot to kyc-documents for company ${company.id}: ${kycScreenshotError.message}`);
                        } else {
                            const { error: updateError } = await supabase
                                .from('acc_portal_kyc_uploads')
                                .update({
                                    metadata: JSON.stringify({
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
                                        screenshot_path: kycScreenshotPath
                                    })
                                })
                                .eq('id', kycUploadId);

                            if (updateError) {
                                console.log(`Error updating KYC upload with screenshot for company ${company.id}: ${updateError.message}`);
                            } else {
                                console.log(`Successfully updated KYC upload with screenshot for company ${company.id}`);
                            }
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

        // Make sure we have valid data from the table
        if (!fullTableData || fullTableData.length === 0) {
            console.log(`No data extracted from table for company ${company.company_name}. Skipping database update.`);
            return;
        }
        
        // Get the first row from table and add data
        const latestExtraction = fullTableData[0];
        latestExtraction.pdfLink = pdfSupabasePath;
        latestExtraction.screenshotLink = screenshotSupabasePath;
        
        // Make sure company ID is properly set for database operations
        latestExtraction.id = company.id;
        latestExtraction.company_id = company.id;
        latestExtraction.company_name = company.company_name;
        
        // Update the database with the extraction information
        await updateSupabaseTable(latestExtraction, formattedDateTime, fullTableData);

        await page.evaluate(() => {
            logOutUser();
        });

        console.log(`Processing completed for ${company.company_name}`);
    } catch (error) {
        console.error(`Error occurred during processing for ${company.company_name}:`, error);
    } finally {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}
