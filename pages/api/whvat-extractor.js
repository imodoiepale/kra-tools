// @ts-nocheck

import { chromium } from "playwright";
import { promises as fsPromises } from 'fs';
import path from "path";
import os from "os";
import ExcelJS from "exceljs";
import { createWorker } from 'tesseract.js';  
import { createClient } from '@supabase/supabase-js';
import { PDFExtract } from 'pdf.js-extract';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const imagePath = path.join("KRA", "ocr.png");
const now = new Date();
const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
const downloadFolderName = `WH VAT DOCUMENTS - DWN - ${formattedDateTime}`;
const downloadFolderPath = path.join(os.homedir(), "Downloads", "AUTO DOWNLOADS WHT VAT KRA", downloadFolderName);

let isRunning = false;
let progress = 0;
let totalCompanies = 0;
let currentCompany = '';

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { action, startMonth, startYear, endMonth, endYear, downloadDocuments, companyIds } = req.body;

    switch (action) {
        case "start":
            if (isRunning) {
                return res.status(400).json({ message: "Extraction is already running" });
            }
            
            // Validate companyIds is properly formatted
            if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
                return res.status(400).json({ message: "No companies selected for extraction" });
            }
            
            console.log(`Starting WHVAT extraction for ${companyIds.length} companies:`, companyIds);
            
            isRunning = true;
            progress = 0;
            totalCompanies = 0;
            currentCompany = '';
            executeWHVATExtraction(startMonth, startYear, endMonth, endYear, downloadDocuments, companyIds).catch(console.error);
            return res.status(200).json({ message: "WHVAT extraction started" });

        case "stop":
            isRunning = false;
            return res.status(200).json({ message: "WHVAT extraction stopped" });

        case "progress":
            return res.status(200).json({ progress, totalCompanies, isRunning, currentCompany });

        case "getReports":
            const { companyId } = req.body;
            const reports = await getReports(companyId);
            return res.status(200).json(reports);

        case "getCompanies":
            const companies = await getCompanies();
            return res.status(200).json(companies);

        default:
            return res.status(400).json({ message: "Invalid action" });
    }
}

async function readSupabaseData(companyIds) {
    try {
        let query = supabase.from("PasswordChecker").select("*");

        if (companyIds && companyIds.length > 0) {
            query = query.in('id', companyIds);
        }

        const { data, error } = await query.order("id", { ascending: true });

        if (error) {
            throw new Error(`Error reading data from 'PasswordChecker' table: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error(`Error reading Supabase data: ${error.message}`);
        throw error;
    }
}


async function executeWHVATExtraction(startMonth, startYear, endMonth, endYear, downloadDocuments, companyIds) {
    try {
        if (downloadDocuments) {
            await fsPromises.mkdir(downloadFolderPath, { recursive: true });
        }

        const data = await readSupabaseData(companyIds);
        totalCompanies = data.length;

        for (let i = 0; i < data.length && isRunning; i++) {
            const company = data[i];
            currentCompany = company.company_name;
            console.log("Processing Company:", company.company_name);

            const chromePath = await findChromePath();
            if (!chromePath) {
                throw new Error('Chrome executable not found');
            }

            const browser = await chromium.launch({
                headless: false,
                executablePath: chromePath
            });
            const context = await browser.newContext();
            const page = await context.newPage();

            try {
                await loginToKRA(page, company);

                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet("WHVAT Extraction Data");
                worksheet.columns = [
                    { header: "Month", key: "month" },
                    { header: "Year", key: "year" },
                    { header: "Data", key: "data" }
                ];

                for (let year = startYear; year <= endYear; year++) {
                    const monthStart = year === startYear ? startMonth : 1;
                    const monthEnd = year === endYear ? endMonth : 12;

                    await page.hover("#ddtopmenubar > ul > li:nth-child(8) > a");

                    await page.evaluate(() => {
                        consultAndReprintVATWHTCerti();
                    });


                    for (let month = monthStart; month <= monthEnd; month++) {
                        await navigateToWHVAT(page, month, year);

                        const recordsNotFound = await page.$("text=Records Not Found");

                        let tableData = [];
                        if (!recordsNotFound) {
                            const tableRows = await page.$$("#tbl > tbody > tr");
                            for (const row of tableRows) {
                                const rowData = await row.$$eval("td", tds => tds.map(td => td.innerText));
                                tableData.push(rowData);
                            }
                        }

                        await saveExtractionData(company.company_name, company.kra_pin, month, year, tableData);

                        worksheet.addRow({
                            month: getMonthName(month),
                            year: year,
                            data: JSON.stringify(tableData)
                        });

                        if (tableData.length > 0 && downloadDocuments) {
                            const trimmedWithholderName = company.company_name.trim().split(' ')[0];
                            await downloadWHVATDocuments(page, company, trimmedWithholderName, month, year);
                        }
                    }

                    // Save the workbook after processing each company
                    const currentDate = new Date();
                    const formattedDate = `${currentDate.getDate().toString().padStart(2, '0')}.${(currentDate.getMonth() + 1).toString().padStart(2, '0')}.${currentDate.getFullYear()}`;
                    const excelFolderPath = path.join(
                        os.homedir(),
                        "Downloads",
                        "AUTO DOWNLOADS WHT VAT KRA"
                    );
                    await fsPromises.mkdir(excelFolderPath, { recursive: true });
                    const excelFilePath = path.join(
                        excelFolderPath,
                        `${company.company_name.replace(/[<>:"\/\\|?*]+/g, " ")} - WHVAT EXTRACTION - ${formattedDate}.xlsx`
                    );
                    await workbook.xlsx.writeFile(excelFilePath);
                }

            } catch (error) {
                console.error(`Error processing company ${company.company_name}: ${error}`);
            } finally {
                await page.close();
                await context.close();
                await browser.close();
            }

            progress = Math.round(((i + 1) / totalCompanies) * 100);
        }

        if (downloadDocuments) {
            await renameDocuments();
        }

        isRunning = false;
        currentCompany = '';
        console.log("WHVAT extraction process completed successfully.");
    } catch (error) {
        console.error(`Error in WHVAT extraction process: ${error}`);
        isRunning = false;
        currentCompany = '';
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

    // Check if login was successful
    const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 3000 }).catch(() => false);

    if (isInvalidLogin) {
        console.log("Wrong result of the arithmetic operation, retrying...");
        await loginToKRA(page, company);
    }
    await page.goto("https://itax.kra.go.ke/KRA-Portal/");
}


async function navigateToWHVAT(page, month, year) {

    await page.getByLabel("Month & Year of Certificate").selectOption(month.toString());
    await page.locator("#year").selectOption(year.toString());
    await page.click("#submitBtn");
    await page.getByRole("button", { name: "Consult" }).click();
    page.once("dialog", dialog => {
        dialog.accept().catch(() => { });
    });

    await page.getByRole("button", { name: "Consult" }).click();
    page.once("dialog", dialog => {
        dialog.accept().catch(() => { });
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
}

async function downloadWHVATDocuments(page, company, trimmedWithholderName, month, year) {
    const documentLinks = await page.$$("td:nth-child(10) a");
    for (let i = 0; i < documentLinks.length; i++) {
        const documentLink = documentLinks[i];
        const documentName = await documentLink.textContent();
        const downloadPromise = page.waitForEvent("download");
        await documentLink.click();
        const download = await downloadPromise;

        const companyFolderPath = path.join(downloadFolderPath, trimmedWithholderName);
        const destinationFolderPath = path.join(companyFolderPath);
        await fsPromises.mkdir(destinationFolderPath, { recursive: true });

        const documentFileName = `${company.company_name} - WHT CERTIFICATE - MONTH ${month} YEAR ${year} - DWN - ${formattedDateTime} - ${documentName.trim()}.pdf`;

        await download.saveAs(path.join(destinationFolderPath, documentFileName));
    }
}

async function saveExtractionData(companyName, kraPIN, month, year, tableData) {
    try {
        const { data, error } = await supabase
            .from('whvat_extractions')
            .select('extraction_data')
            .eq('company_name', companyName)
            .eq('kra_pin', kraPIN)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        let extractionData = data?.extraction_data || {};

        extractionData[`${year}-${month}`] = {
            tableData,
            extractionDate: new Date().toISOString()
        };

        const { error: upsertError } = await supabase
            .from('whvat_extractions')
            .upsert({
                company_name: companyName,
                kra_pin: kraPIN,
                extraction_data: extractionData
            }, { onConflict: 'company_name, kra_pin' });

        if (upsertError) {
            if (upsertError.code === '42P10') {
                // If the error is due to missing constraint, try inserting instead
                const { error: insertError } = await supabase
                    .from('whvat_extractions')
                    .insert({
                        company_name: companyName,
                        kra_pin: kraPIN,
                        extraction_data: extractionData
                    });
                if (insertError) throw insertError;
            } else {
                throw upsertError;
            }
        }

    } catch (error) {
        console.error('Error saving extraction data:', error);
    }
}

async function getReports(companyName) {
    try {
        const { data, error } = await supabase
            .from('whvat_extractions')
            .select('*')
            .eq('company_name', companyName)
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error getting reports:', error);
        throw error;
    }
}
async function getCompanies() {
    try {
        const { data, error } = await supabase
            .from('PasswordChecker')
            .select('id, company_name')
            .order('company_name');

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error getting companies:', error);
        throw error;
    }
}

async function renameDocuments() {
    try {
        await traverseDirectory(downloadFolderPath);
        console.log('All documents renamed successfully.');
    } catch (error) {
        console.error('Error renaming documents:', error);
    }
}

async function traverseDirectory(dir) {
    try {
        const files = await fs.readdir(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = await fsPromises.stat(filePath);

            if (stats.isDirectory()) {
                await traverseDirectory(filePath);
            } else if (stats.isFile() && path.extname(filePath) === '.pdf') {
                await processFile(filePath);
            }
        }
    } catch (err) {
        console.error('Error traversing directory:', err);
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

async function processFile(filePath) {
    const pdfExtract = new PDFExtract();
    const options = {};

    try {
        const data = await pdfExtract.extract(filePath, options);

        const extractedData = {};
        let currentKey = '';
        let disclaimerFound = false;

        data.pages.forEach(page => {
            page.content.forEach(item => {
                if (item.str && !disclaimerFound) {
                    const keyLabels = [
                        'Date of Certificate',
                        'Certificate Serial Number',
                        'PIN of Withholder',
                        'Name of Withholder',
                        'Address of Withholder',
                        'PIN of Withholdee',
                        'Name of Withholdee',
                        'Address of Withholdee',
                        'Tax Head',
                        'Payment Date',
                        'Gross Amount of Transaction (Ksh)',
                        'Withholding Tax Rate',
                        'Amount of Tax Withheld (Ksh)',
                        'VAT Withholding Agency Number',
                        'Invoice Number'
                    ];

                    if (item.str.includes('Date of Certificate')) {
                        const dateRegex = /\d{2}\/\d{2}\/\d{4}/;
                        const dateMatch = dateRegex.exec(item.str);

                        if (dateMatch) {
                            extractedData['Date of Certificate'] = dateMatch[0];
                        }
                    } else if (item.str.includes('Disclaimer')) {
                        disclaimerFound = true;
                    } else {
                        const potentialKeyMatch = keyLabels.find(label => item.str.startsWith(label));
                        if (potentialKeyMatch) {
                            currentKey = potentialKeyMatch.trim();
                            extractedData[currentKey] = item.str.slice(potentialKeyMatch.length).trim();
                        } else if (currentKey === 'Amount of Tax Withheld (Ksh)') {
                            const numberRegex = /(\d{1,3}(,\d{3})*(\.\d{1,2})?)/;
                            const numberMatch = numberRegex.exec(item.str);
                            if (numberMatch) {
                                extractedData[currentKey] = numberMatch[0];
                            }
                        } else if (currentKey) {
                            extractedData[currentKey] += ' ' + item.str.trim();
                        }
                    }
                }
            });
        });

        const { 'Name of Withholder': withholderName, 'Name of Withholdee': withholdeeName, 'Tax Head': taxHead, 'Payment Date': paymentDate } = extractedData;
        const trimmedWithholderName = withholderName ? withholderName.trim().split(' ')[0] : 'UnknownWithholder';
        const trimmedWithholdeeName = withholdeeName ? withholdeeName.trim() : 'UnknownWithholdee';
        const trimmedTaxHead = taxHead ? taxHead.trim() : 'UnknownTaxHead';
        const trimmedPaymentDate = paymentDate ? paymentDate.replace(/\//g, '.').trim() : 'UnknownDate';

        const concatenatedName = `${trimmedWithholdeeName}-${trimmedWithholderName}-${trimmedTaxHead}-${trimmedPaymentDate}`;

        const dirPath = path.dirname(filePath);
        const renamedFilePath = path.join(dirPath, `${concatenatedName.toUpperCase()}.pdf`);

        await fsPromises.rename(filePath, renamedFilePath);
        console.log(`File renamed to: ${renamedFilePath}`);
    } catch (err) {
        console.error('Error processing file:', err);
    }
}

const getMonthName = month => {
    const monthIndex = parseInt(month) - 1;
    return new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2024, monthIndex));
};

const generateMonthYearHeading = async (worksheet, selectedMonth, selectedYear) => {
    const monthName = getMonthName(selectedMonth);
    const monthYearHeading = worksheet.getCell("A1");
    monthYearHeading.value = `Month & Year of Certificate: ${monthName}/${selectedYear}`;
};

// Export all functions that might be needed externally
// export {
//     executeWHVATExtraction,
//     readSupabaseData,
//     loginToKRA,
//     navigateToWHVAT,
//     downloadWHVATDocuments,
//     saveExtractionData,
//     getReports,
//     getCompanies,
//     renameDocuments,
//     traverseDirectory,
//     processFile,
//     getMonthName,
//     generateMonthYearHeading
// };