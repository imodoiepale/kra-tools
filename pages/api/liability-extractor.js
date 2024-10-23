import { chromium } from "playwright";
import path from "path";
import os from "os";
import { promises as fsPromises } from 'fs';
import { createWorker } from 'tesseract.js';
import { createClient } from "@supabase/supabase-js";

// Constants
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const imagePath = path.join("KRA", "ocr.png");
const downloadFolderPath = path.join(os.homedir(), "Downloads", `AUTO LIABILITIES EXTRACTION - ${new Date().toISOString().split('T')[0]}`);

let isRunning = false;
let progress = 0;
let currentCompany = '';

// Utility Functions
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
    const text1 = ret.data.text.slice(0, -1);
    const text = text1.slice(0, -1);
    const numbers = text.match(/\d+/g);
    
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

    const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 3000 }).catch(() => false);
    if (isInvalidLogin) {
        console.log("Wrong result of the arithmetic operation, retrying...");
        await loginToKRA(page, company);
    }
}

async function extractTableData(page, selector) {
    const table = await page.$(selector);
    if (!table) return null;

    return await table.evaluate(table => {
        const headers = Array.from(table.querySelectorAll("thead th")).map(th => th.innerText.trim());
        const rows = Array.from(table.querySelectorAll("tbody tr")).map(row => {
            return Array.from(row.querySelectorAll("td")).map(td => {
                const input = td.querySelector('input[type="text"]');
                return input ? input.value.trim() : td.innerText.trim();
            });
        });
        return { headers, rows };
    });
}

async function extractLiabilities(page, company) {
    const liabilityData = {
        income_tax: null,
        vat: null,
        paye: null
    };

    // Extract Income Tax
    await page.locator("#cmbTaxHead").selectOption("VAT");
    await page.waitForLoadState("load");
    await page.locator("#cmbTaxHead").selectOption("IT");
    await page.locator("#cmbTaxSubHead").selectOption("4");
    await page.locator("#cmbPaymentType").selectOption("SAT");
    liabilityData.income_tax = await extractTableData(page, "#LiablibilityTbl");

    // Extract VAT
    await page.locator("#cmbTaxHead").selectOption("VAT");
    await page.locator("#cmbTaxHead").selectOption("IT");
    await page.waitForTimeout(1000);
    await page.locator("#cmbTaxHead").selectOption("VAT");
    const option9Exists = await page.locator('#cmbTaxSubHead option[value="9"]').count() > 0;
    if (option9Exists) {
        await page.locator("#cmbTaxSubHead").selectOption("9");
        await page.locator("#cmbPaymentType").selectOption("SAT");
        liabilityData.vat = await extractTableData(page, "#LiablibilityTbl");
    }

    // Extract PAYE
    await page.locator("#cmbTaxHead").selectOption("IT");
    const option7Exists = await page.locator('#cmbTaxSubHead option[value="7"]').count() > 0;
    if (option7Exists) {
        await page.locator("#cmbTaxSubHead").selectOption("7");
        await page.locator("#cmbPaymentType").selectOption("SAT");
        liabilityData.paye = await extractTableData(page, "#LiablibilityTbl");
    }

    return liabilityData;
}

async function storeLiabilityData(company, liabilityData) {
    const { data, error } = await supabase
        .from('liability_extractions')
        .upsert({
            company_name: company.company_name,
            liability_data: liabilityData,
            updated_at: new Date().toISOString(),
            extraction_date: new Date().toISOString()
        }, {
            onConflict: 'company_name',
            update: ['liability_data', 'updated_at', 'extraction_date']
        });

    if (error) {
        console.error('Error storing liability data:', error);
        throw error;
    }

    return data;
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
async function processCompany(page, company, updateProgressCallback) {
    try {
        await updateProgressCallback(company.company_name, 10);
        await loginToKRA(page, company);
        await updateProgressCallback(company.company_name, 30);
        
        await page.hover("#ddtopmenubar > ul > li:nth-child(6) > a");
        await page.evaluate(() => {
            showPaymentRegForm();
        });
        await updateProgressCallback(company.company_name, 50);
  
        await page.click("#openPayRegForm");
        page.once("dialog", dialog => {
            dialog.accept().catch(() => { });
        });
        await page.click("#openPayRegForm");
        page.once("dialog", dialog => {
            dialog.accept().catch(() => { });
        });
        await updateProgressCallback(company.company_name, 80);
  
        const liabilityData = await extractLiabilities(page, company);
        
        await storeLiabilityData(company, liabilityData);
        await updateProgressCallback(company.company_name, 100, 'completed');
  
        await page.evaluate(() => {
            logOutUser();
        });
        await page.waitForLoadState("load");
        await page.reload();
        
    } catch (error) {
        console.error(`Error processing ${company.company_name}:`, error);

        // Store detailed error information
        const { error: updateError } = await supabase
            .from('liability_extractions')
            .upsert({
                company_name: company.company_name,
                status: 'skipped',
                progress: 0,
                liability_data: {
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    details: 'Company skipped due to extraction error'
                },
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'company_name'
            });

        // Store in history table
        await supabase
            .from('liability_extractions_history')
            .insert({
                company_name: company.company_name,
                status: 'error',
                error_message: error.message,
                extraction_date: new Date().toISOString()
            });

        // Reset page state for next company
        await page.goto("https://itax.kra.go.ke/KRA-Portal/");
        await updateProgressCallback(company.company_name, 0, 'skipped');
        
        // Continue with next company
        return;
    }
}

async function updateProgress(companyName, percentComplete, status = 'running') {
    currentCompany = companyName;
    progress = percentComplete;
    
    const updateData = {
        status: status,
        progress: percentComplete,
        updated_at: new Date().toISOString()
    };

    // If status is error, add error info to liability_data
    if (status === 'error') {
        updateData.liability_data = {
            error: 'Extraction failed',
            timestamp: new Date().toISOString()
        };
    }

    await supabase
        .from('liability_extractions')
        .update(updateData)
        .eq('company_name', companyName);
}

async function runAutomation(companyIds, updateProgressCallback) {
    const data = await readSupabaseData(companyIds);
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
  
    for (const company of data) {
        if (!isRunning) break;
        await processCompany(page, company, updateProgressCallback);
    }
  
    await context.close();
    await browser.close();
}

export default async function handler(req, res) {
    const { action, companyIds, runOption } = req.body;

    switch (action) {
        case 'start':
            if (isRunning) {
                return res.status(400).json({ error: 'Automation is already running' });
            }
            isRunning = true;
            progress = 0;
            let companiesToProcess = [];
        
            if (runOption === 'all') {
                const { data, error } = await supabase
                    .from('company_MAIN')
                    .select('id');
        
                if (error) {
                    isRunning = false;
                    return res.status(500).json({ error: 'Failed to fetch companies' });
                }
        
                companiesToProcess = data.map(company => company.id);
            } else {
                companiesToProcess = companyIds;
            }
        
            await supabase
                .from('liability_extractions')
                .update({ status: 'pending', progress: 0 })
                .in('company_name', companiesToProcess.map(id => id.toString()));
        
            runAutomation(companiesToProcess, updateProgress)
                .then(() => {
                    isRunning = false;
                })
                .catch((error) => {
                    isRunning = false;
                    console.error('Automation error:', error);
                });
            return res.status(200).json({ message: 'Automation started', companiesCount: companiesToProcess.length });
        
            case 'resume':
                try {
                  const { company, lastProgress, companyId } = req.body;
                  
                  // Validate required fields
                  if (!company) {
                    return res.status(400).json({ error: 'Company name is required' });
                  }
                  
                  // Set running state
                  isRunning = true;
                  currentCompany = company;
                  progress = lastProgress || 0;
                  
                  // Update database status
                  await supabase
                    .from('liability_extractions')
                    .update({ 
                      status: 'running',
                      progress: lastProgress,
                      updated_at: new Date().toISOString()
                    })
                    .eq('company_name', company);
                  
                  // Start automation with single company
                  const companyToProcess = companyId ? [companyId] : 
                    (await supabase
                      .from('company_MAIN')
                      .select('id')
                      .eq('company_name', company)
                      .single())?.data?.id;
                      
                  if (!companyToProcess) {
                    throw new Error('Company not found in database');
                  }
                  
                  // Run automation in background
                  runAutomation([companyToProcess], updateProgress)
                    .then(() => {
                      isRunning = false;
                      progress = 100;
                    })
                    .catch((error) => {
                      isRunning = false;
                      console.error('Automation error:', error);
                    });
                  
                  return res.status(200).json({ 
                    message: 'Extraction resumed',
                    company,
                    progress: lastProgress
                  });
                  
                } catch (error) {
                  isRunning = false;
                  console.error('Resume error:', error);
                  return res.status(500).json({ 
                    error: error.message || 'Failed to resume extraction'
                  });
                }
            case 'stop':
                isRunning = false;
                const updatePromises = [
                    supabase
                        .from('liability_extractions')
                        .update({ status: 'stopped', updated_at: new Date().toISOString() })
                        .eq('status', 'running'),
                    supabase
                        .from('liability_extractions')
                        .update({ status: 'stopped', updated_at: new Date().toISOString() })
                        .eq('status', 'queued')
                ];
                await Promise.all(updatePromises);
                return res.status(200).json({ message: 'Automation stopped' });
            
        case 'progress':
            const { data: progressData, error: progressError } = await supabase
                .from('liability_extractions')
                .select('*')
                .order('updated_at', { ascending: false });
  
            if (progressError) {
                return res.status(500).json({ error: 'Failed to fetch progress data' });
            }
  
            return res.status(200).json({
                isRunning,
                progress,
                currentCompany,
                logs: progressData.map(item => ({
                    company: item.company_name,
                    status: item.status,
                    progress: item.progress,
                    timestamp: item.updated_at
                }))
            });

        case 'getResults':
            const { data, error } = await supabase
                .from('liability_extractions')
                .select('*')
                .order('extraction_date', { ascending: false });

            if (error) {
                return res.status(500).json({ error: 'Failed to fetch results' });
            }
            return res.status(200).json(data);

        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}