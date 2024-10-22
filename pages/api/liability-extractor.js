import { chromium } from "playwright";
import path from "path";
import os from "os";
import { promises as fsPromises } from 'fs';
import { createWorker } from 'tesseract.js';
import { createClient } from "@supabase/supabase-js";
import retry from 'async-retry';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const imagePath = path.join("KRA", "ocr.png");

const downloadFolderPath = path.join(os.homedir(), "Downloads", `AUTO LIABILITIES EXTRACTION - ${new Date().toISOString().split('T')[0]}`);

let isRunning = false;
let progress = 0;
let currentCompany = '';

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
    // Start a Supabase transaction
    const { data: currentExtraction, error: fetchError } = await supabase
        .from('liability_extractions')
        .select('*')
        .eq('company_name', company.company_name)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error fetching current extraction:', fetchError);
        throw fetchError;
    }

    // If there's existing data, store it in the history table
    if (currentExtraction) {
        const { error: historyError } = await supabase
            .from('liability_extractions_history')
            .insert({
                company_name: currentExtraction.company_name,
                liability_data: currentExtraction.liability_data,
                extraction_date: currentExtraction.extraction_date || currentExtraction.updated_at,
                created_at: new Date().toISOString()
            });

        if (historyError) {
            console.error('Error storing historical data:', historyError);
            throw historyError;
        }
    }

    // Update or insert the new extraction data
    const { data, error: upsertError } = await supabase
        .from('liability_extractions')
        .upsert({
            company_name: company.company_name,
            liability_data: liabilityData,
            updated_at: new Date().toISOString(),
<<<<<<< Updated upstream
            extraction_date: new Date().toISOString()  // Add this line
        }, {
            onConflict: 'company_name',  // Change this line
            update: ['liability_data', 'updated_at', 'extraction_date']  // Add this line
        });

    if (error) {
        console.error('Error storing liability data:', error);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        throw error;
=======
            extraction_date: new Date().toISOString(),
            status: 'completed',
            progress: 100
        }, {
            onConflict: 'company_name',
            update: ['liability_data', 'updated_at', 'extraction_date', 'status', 'progress']
        });

    if (upsertError) {
        console.error('Error storing new liability data:', upsertError);
        throw upsertError;
>>>>>>> Stashed changes
    }

    return data;
}

// // Add this helper function to clean up old history records if needed
// async function cleanupHistoricalData(companyName, retentionPeriodInDays = 365) {
//     const cutoffDate = new Date();
//     cutoffDate.setDate(cutoffDate.getDate() - retentionPeriodInDays);

//     const { error } = await supabase
//         .from('liability_extractions_history')
//         .delete()
//         .eq('company_name', companyName)
//         .lt('extraction_date', cutoffDate.toISOString());

//     if (error) {
//         console.error('Error cleaning up historical data:', error);
//     }
// }
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
      await updateProgressCallback(company.company_name, 'error');
    }
  }
  async function updateProgress(companyName, percentComplete, status = 'running') {
    currentCompany = companyName;
    progress = percentComplete;
    
    await supabase
        .from('liability_extractions')
        .update({ 
            status: status,
            progress: percentComplete,
            updated_at: new Date().toISOString()
        })
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
    const { action, companyIds, runOption } = req.body; // Make sure runOption is being received

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
        
            // Update status for all companies to 'pending'
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
            const { company, lastProgress } = req.body;
            isRunning = true;
            progress = lastProgress;
            currentCompany = company;

            await supabase
                .from('liability_extractions')
                .update({ status: 'running', progress: lastProgress })
                .eq('company_name', company);

            runAutomation([company], updateProgress)
                .then(() => {
                    isRunning = false;
                    progress = 100;
                })
                .catch((error) => {
                    isRunning = false;
                    console.error('Automation error:', error);
                });

            return res.status(200).json({ message: 'Extraction resumed' });

            case 'stop':
                isRunning = false;
                await supabase
                    .from('liability_extractions')
                    .update({ status: 'stopped', updated_at: new Date().toISOString() })
                    .eq('status', 'running');
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
