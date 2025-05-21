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
                return res.status(400).json({ message: "Extraction is already running" });
            }
            isRunning = true;
            progress = 0;
            totalCompanies = 0;
            currentCompany = '';
            processTCCExtraction(companies).catch(console.error);
            return res.status(200).json({ message: "TCC extraction started" });

        case "stop":
            isRunning = false;
            return res.status(200).json({ message: "TCC extraction stopped" });

        case "progress":
            return res.status(200).json({ progress, totalCompanies, isRunning, currentCompany });

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
        const { data, error } = await supabase.from("PasswordChecker").select("*").order("id", { ascending: true });

        if (error) {
            throw new Error(`Error reading data from 'PasswordChecker' table: ${error.message}`);
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
        const text = ret.data.text.trim();
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
    const fileName = `${extractionDate}_${path.basename(filePath)}`;
    const fileContent = await fs.readFile(filePath);
    const { data, error } = await supabase.storage
        .from('kra-documents')
        .upload(`${companyName}/${fileType}/${fileName}`, fileContent, {
            contentType: fileType === 'pdf' ? 'application/pdf' : 'image/png'
        });

    if (error) throw error;
    return data.path;
}

async function updateSupabaseTable(companyData, extractionDate, fullTableData) {
    try {
        const { data: tccData, error: tccError } = await supabase
            .from('TaxComplianceCertificates')
            .select('extractions, company_id')
            .eq('company_id', companyData.id)
            .single();

        if (tccError && tccError.code !== 'PGRST116') {
            console.log(`Error checking for existing extractions for company ${companyData.id}: ${tccError.message}`);
            throw new Error(`Error checking for existing extractions: ${tccError.message}`);
        }

        const { data: kycData, error: kycError } = await supabase
            .from('acc_portal_kyc_uploads')
            .select('*')
            .eq('kyc_document_id', '5c658f23-7d16-4453-9965-619b72b9166a')
            .eq('userid', companyData.id.toString())
            .order('created_at', { ascending: false });

        if (kycError) {
            console.log(`Error checking for existing KYC uploads for company ${companyData.id}: ${kycError.message}`);
        }

        const hasRecentKycUpload = kycData && kycData.length > 0 &&
            new Date(kycData[0].created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        if (hasRecentKycUpload) {
            console.log(`Company ${companyData.id} (${companyData.company_name}) has a recent TCC document uploaded in the last 7 days. Skipping.`);
            return {
                success: true,
                message: "Skipped - recent document exists",
                data: {
                    company_id: companyData.id,
                    status: "Skipped - recent document exists"
                }
            };
        }

        let existingExtractions = {};
        if (tccData) {
            existingExtractions = tccData.extractions || {};
        }

        const updatedData = existingExtractions[extractionDate] ? { ...existingExtractions[extractionDate] } : {};
        updatedData.company_name = companyData.company_name;
        updatedData.status = companyData.Status;
        updatedData.certificate_date = companyData.CertificateDate;
        updatedData.expiry_date = companyData.ExpiryDate;
        updatedData.serial_no = companyData.SerialNo;
        updatedData.pdf_link = companyData.pdfLink || "no doc";
        updatedData.screenshot_link = companyData.screenshotLink || "no doc";
        updatedData.full_table_data = fullTableData;

        const { data, error } = await supabase
            .from('TaxComplianceCertificates')
            .upsert(updatedData, {
                onConflict: 'company_id',
                returning: 'minimal'
            });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error updating Supabase table: ${error.message}`);
        throw error;
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

        const screenshotPath = path.join(
            downloadFolderPath,
            `${company.company_name} - TCC PAGE SCREENSHOT - DWN- ${formattedDateTime}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log("Screenshot taken successfully.");

        const screenshotFilePath = path.join(downloadFolderPath, `${company.id}_TCC_screenshot.png`);
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
                    const screenshotSupabasePath = screenshotStoragePath;

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
        }

        const latestExtraction = fullTableData[0];
        latestExtraction.pdfLink = pdfSupabasePath;
        latestExtraction.screenshotLink = screenshotSupabasePath;

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
