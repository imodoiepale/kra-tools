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

// IMPORTANT ASSUMPTION: This ID is assumed to be the global, static documentId for all KRA PIN certificates.
// If this ID is company-specific or dynamic, this approach needs to be revised.
// Using UUID format with hyphens as required by acc_portal_kyc_uploads table
const KRA_PIN_DOCUMENT_ID = "92e58484-167a-40df-9836-7b110b003e86"; // UUID format with hyphens

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { action, companyIds } = req.body;

    switch (action) {
        case "start":
            if (isRunning) {
                return res.status(400).json({ message: "Extraction is already running" });
            }
            isRunning = true;
            progress = 0;
            totalCompanies = 0;
            currentCompany = '';
            processPINCertificates(companyIds).catch(console.error);
            return res.status(200).json({ message: "PIN certificate extraction started" });

        case "stop":
            isRunning = false;
            return res.status(200).json({ message: "PIN certificate extraction stopped" });

        case "progress":
            return res.status(200).json({ progress, totalCompanies, isRunning, currentCompany });

        case "getReports":
            const reports = await getReports();
            return res.status(200).json(reports);

        default:
            return res.status(400).json({ message: "Invalid action" });
    }
}

async function processPINCertificates(companyIds) {
    let companies;
    if (companyIds && companyIds.length > 0) {
        companies = await readSupabaseData(companyIds);
    } else {
        companies = await readSupabaseData();
    }
    totalCompanies = companies.length;

    const now = new Date();
    const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
    const downloadFolderPath = path.join(os.homedir(), "Downloads", `AUTO DOWNLOADS KRA PIN CERTIFICATE - ${formattedDateTime}`);
    await fs.mkdir(downloadFolderPath, { recursive: true });

    for (let i = 0; i < companies.length && isRunning; i++) {
        currentCompany = companies[i].company_name;
        await processCompany(companies[i], downloadFolderPath, formattedDateTime);
        progress = Math.round(((i + 1) / totalCompanies) * 100);
    }

    isRunning = false;
    currentCompany = '';
}

async function readSupabaseData(companyIds) {
    try {
        let query = supabase.from("acc_portal_company_duplicate").select("*").eq("kra_status", "Valid");
        
        if (companyIds && companyIds.length > 0) {
            query = query.in('id', companyIds);
        }
        
        const { data, error } = await query.order("id", { ascending: true });

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

async function navigateToCert(page) {
    const menuItemsSelector = [
        "#ddtopmenubar > ul > li:nth-child(3) > a",
        "#ddtopmenubar > ul > li:nth-child(4) > a",
        "#ddtopmenubar > ul > li:nth-child(2) > a",
        "#ddtopmenubar > ul > li:nth-child(3) > a",
    ];

    let dynamicElementFound = false;

    for (const selector of menuItemsSelector) {
        if (dynamicElementFound) break;

        await page.reload();
        const menuItem = await page.$(selector);

        if (menuItem) {
            const bbox = await menuItem.boundingBox();
            if (bbox) {
                const x = bbox.x + bbox.width / 2;
                const y = bbox.y + bbox.height / 2;
                await page.mouse.move(x, y);
                await page.waitForTimeout(1000);

                dynamicElementFound = await page.waitForSelector("#Returns > li:nth-child(4)", { timeout: 1000 }).then(() => true).catch(() => false);
            }
        }
    }

    await page.waitForSelector("#Returns > li:nth-child(4)");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
        showReprintCertificate();
    });

    await page.locator("#applicantType").selectOption("taxpayer");

    await page.click(".submit");

    page.once("dialog", dialog => {
        dialog.accept().catch(() => { });
    });
    await page.click(".submit");

    page.once("dialog", dialog => {
        dialog.accept().catch(() => { });
    });
}

async function uploadToSupabase(localPdfPath, company, kycDocumentId, extractionDate) {
    const sanitizedCompanyName = company.company_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const sanitizedDocName = kycDocumentId.toLowerCase().replace(/[^a-z0-9]/g, '_'); // Will use the updated KRA_PIN_DOCUMENT_ID
    
    // Generate filename based on sanitized local filename + timestamp
    const localBaseName = path.basename(localPdfPath, '.pdf');
    const sanitizedLocalBaseName = localBaseName.replace(/[^a-z0-9]/gi, '_');
    const timestamp = new Date().getTime();
    const remoteFileName = `${sanitizedLocalBaseName}_${timestamp}.pdf`;
    
    const remoteStoragePath = `company-documents/${sanitizedCompanyName}/${sanitizedDocName}/${remoteFileName}`;

    const fileContent = await fs.readFile(localPdfPath);

    const { data, error } = await supabase.storage
        .from('kyc-documents') // Use kyc-documents bucket
        .upload(remoteStoragePath, fileContent, {
            contentType: 'application/pdf',
            upsert: false 
        });

    if (error) {
        console.error(`Error uploading ${remoteStoragePath} to kyc-documents:`, error);
        throw error;
    }
    
    // Get public URL for the PINCertificates table or other uses
    const { data: { publicUrl } } = supabase.storage
        .from('kyc-documents') // From the same bucket
        .getPublicUrl(data.path);

    return { publicUrl: publicUrl, path: data.path }; // data.path is the actual storage path
}

// New function to add record to acc_portal_kyc_uploads
async function addKycUploadRecord(companyId, kycDocumentId, storagePath, createdAtIsoString) {
    try {
        const uploadData = {
            userid: companyId.toString(), 
            kyc_document_id: kycDocumentId,
            file_path: storagePath, // This is the path in Supabase storage from 'kyc-documents' bucket
            created_at: createdAtIsoString,
            // metadata: { uploaded_by_automation: true } // Optional: if your table supports a metadata JSONB column
        };

        const { data, error } = await supabase
            .from('acc_portal_kyc_uploads')
            .insert(uploadData)
            .select() 
            .single(); 

        if (error) {
            console.error(`Error creating KYC upload record for company ${companyId}, doc ${kycDocumentId}:`, error);
            throw error; 
        }
        console.log(`Successfully created KYC upload record for company ${companyId}, doc ${kycDocumentId}, path: ${storagePath}`);
        return data;
    } catch (error) {
        console.error(`Exception in addKycUploadRecord for company ${companyId}, doc ${kycDocumentId}:`, error);
        throw error;
    }
}

async function updateSupabaseTable(companyData, extractionDate, pdfLink) {
    try {
        const { data: existingData, error: fetchError } = await supabase
            .from('PINCertificates')
            .select('*')
            .eq('company_pin', companyData.kra_pin)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; // PGRST116 means no rows found, which is fine for upsert logic

        let updatedData = existingData ? { ...existingData } : { company_pin: companyData.kra_pin, extractions: {} };
        
        // Ensure 'id' is not part of the upsert payload if it's auto-generated and part of existingData
        delete updatedData.id; 
        
        updatedData.company_name = companyData.company_name;
        if (!updatedData.extractions) updatedData.extractions = {}; // Ensure extractions object exists
        updatedData.extractions[extractionDate] = {
            pdf_link: pdfLink, // This can be null if upload failed or was skipped
            pin_and_password: companyData.kra_pin && companyData.kra_password ? 'true' : 'false'
        };

        const { data, error } = await supabase
            .from('PINCertificates')
            .upsert(updatedData, {
                onConflict: 'company_pin',
                returning: 'minimal',
                ignoreDuplicates: false
            });

        if (error) throw error;
        console.log(`Updated Supabase table 'PINCertificates' for ${companyData.company_name}.`);
        return data;
    } catch (error) {
        console.error(`Error updating 'PINCertificates' table for ${companyData.company_name}:`, error);
        // Do not rethrow here if this update is non-critical to overall process
    }
}

async function processCompany(company, downloadFolderPath, formattedDateTime) {
    const browser = await chromium.launch({ headless: false, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        if (company.kra_pin && company.kra_password) {
            console.log(`Starting process for ${company.company_name}`);
            // Create download path before any browser interactions
            const sanitizedCompanyName = company.company_name.replace(/[<>:"/\\|?*]/g, '_');
            const localPdfPath = path.join(
                downloadFolderPath,
                `${sanitizedCompanyName} - KRA PIN CERT - DWN- ${formattedDateTime}.pdf`
            );
            
            // Login to KRA portal
            await loginToKRA(page, company);
            
            console.log(`Successfully logged in for ${company.company_name}, navigating to certificate...`);
            
            // Setup download listener BEFORE navigating to certificate page
            const downloadPromise = page.waitForEvent("download", {timeout: 60000});
            
            // Navigate to certificate page
            await navigateToCert(page);
            
            console.log(`Navigated to certificate page for ${company.company_name}, downloading certificate...`);
            
            await page.waitForTimeout(1000)
            
            // Trigger the download
            await page.evaluate(() => {
                downloadPinCertificate();
            }).catch(e => console.log(`Error triggering download: ${e.message}`));
            
            // Wait for download with proper error handling
            let download;
            try {
                download = await downloadPromise;
                console.log(`Certificate download started for ${company.company_name}`);
                await download.saveAs(localPdfPath);
                console.log(`Certificate saved to ${localPdfPath}`);
                
                // Verify file was created
                try {
                    const fileStats = await fs.stat(localPdfPath);
                    if (fileStats.size === 0) {
                        throw new Error(`Downloaded file is empty: ${localPdfPath}`);
                    }
                    console.log(`Verified file ${localPdfPath}, size: ${fileStats.size} bytes`);
                    
                    // Upload to 'kyc-documents' bucket
                    const uploadInfo = await uploadToSupabase(localPdfPath, company, KRA_PIN_DOCUMENT_ID, formattedDateTime);
                    console.log(`File uploaded to Supabase for ${company.company_name}`);
                    
                    // Update the PINCertificates table (this might be for logging/reporting purposes)
                    await updateSupabaseTable(company, formattedDateTime, uploadInfo.publicUrl);
                    
                    // Add record to acc_portal_kyc_uploads
                    await addKycUploadRecord(company.id, KRA_PIN_DOCUMENT_ID, uploadInfo.path, new Date().toISOString());
                    console.log(`KYC upload record created for ${company.company_name}`);
                } catch (fileError) {
                    console.error(`Error verifying or processing downloaded file: ${fileError.message}`);
                    throw fileError;
                }
            } catch (downloadError) {
                console.error(`Download failed for ${company.company_name}: ${downloadError.message}`);
                throw new Error(`Certificate download failed: ${downloadError.message}`);
            }

            // Try to log out safely
            try {
                await page.evaluate(() => {
                    logOutUser();
                }).catch(() => console.log(`Logout failed for ${company.company_name}, but proceeding`));
            } catch (logoutError) {
                console.log(`Error during logout: ${logoutError.message}`);
                // Don't throw here, we want to continue cleanup
            }

            console.log(`Done processing PIN CERT for ${company.company_name}`);
        } else {
            // If PIN/password missing, still update PINCertificates table as skipped
            await updateSupabaseTable(company, formattedDateTime, null);
            console.log(`Skipped processing PIN CERT for ${company.company_name} due to missing PIN or password`);
        }
    } catch (error) {
        console.error(`Error occurred during processing for ${company.company_name}:`, error);
        // Update PINCertificates table indicating an error/null link
        await updateSupabaseTable(company, formattedDateTime, null); 
    } finally {
        // Make sure to clean up browser resources
        try {
            if (page) await page.close().catch(() => {});
            if (context) await context.close().catch(() => {});
            if (browser) await browser.close().catch(() => {});
            console.log(`Browser resources cleaned up for ${company.company_name}`);
        } catch (cleanupError) {
            console.error(`Error during browser cleanup: ${cleanupError.message}`);
        }
    }
}

async function getReports() {
    try {
        const { data, error } = await supabase
            .from("PINCertificates")
            .select("*");

        if (error) {
            throw new Error(`Error fetching reports: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error(`Error fetching reports: ${error.message}`);
        throw error;
    }
}