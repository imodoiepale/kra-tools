import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ExcelJS from "exceljs";
import { createWorker } from 'tesseract.js';
import { createClient } from "@supabase/supabase-js";
import retry from 'async-retry';

// Constants
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let isRunning = false;
let progress = 0;
let currentCompany = '';

// Utility functions
function getFormattedDateTime() {
  const now = new Date();
  return `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
}

function getDownloadFolderPath() {
  const formattedDateTime = getFormattedDateTime();
  return path.join(os.homedir(), "Downloads", `AUTO EXTRACT GENERAL LEDGER- ${formattedDateTime}`);
}

async function createDownloadFolder() {
  const downloadFolderPath = getDownloadFolderPath();
  await fs.mkdir(downloadFolderPath, { recursive: true }).catch(console.error);
  return downloadFolderPath;
}

async function readSupabaseData(companyIds) {
  try {
    let query = supabase.from("company_MAIN").select("*");

    if (companyIds && companyIds.length > 0) {
      query = query.in('id', companyIds);
    }

    const { data, error } = await query.order("id", { ascending: true });
    if (error) {
      throw new Error(`Error reading data from 'company_MAIN' table: ${error.message}`);
    }
    return data;
  } catch (error) {
    throw new Error(`Error reading Supabase data: ${error.message}`);
  }
}

async function updateProgress(companyName, percentComplete, status = 'running') {
  currentCompany = companyName;
  progress = percentComplete;

  await supabase
    .from('ledger_extractions')
    .update({
      status: status,
      progress: percentComplete,
      updated_at: new Date().toISOString()
    })
    .eq('company_name', companyName);
}

async function solveCaptcha(page, downloadFolderPath) {
  const image = await page.waitForSelector("#captcha_img");
  const imagePath = path.join(downloadFolderPath, "ocr.png");
  await image.screenshot({ path: imagePath });
  const worker = await createWorker('eng', 1);
  console.log("Extracting Text...");
  const ret = await worker.recognize(imagePath);
  const text1 = ret.data.text.slice(0, -1);
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
  return result.toString();
}

async function loginToKRA(page, company, downloadFolderPath) {
  await retry(async () => {
    await page.goto("https://itax.kra.go.ke/KRA-Portal/");
    await page.locator("#logid").click();
    await page.locator("#logid").fill(company.kra_pin);
    await page.evaluate(() => {
      CheckPIN();
    });
    await page.locator('input[name="xxZTT9p2wQ"]').fill(company.kra_itax_current_password);
    await page.waitForTimeout(1500);
    
    const captchaResult = await solveCaptcha(page, downloadFolderPath);
    await page.type("#captcahText", captchaResult);
    await page.click("#loginButton");

    const isInvalidLogin = await page.waitForSelector('b:has-text("Wrong result of the arithmetic operation.")', { state: 'visible', timeout: 3000 })
      .catch(() => false);

    if (isInvalidLogin) {
      throw new Error("Wrong result of the arithmetic operation");
    }
  }, {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 3000
  });
}

async function navigateToGeneralLedger(page) {
  const menuItemsSelector = [
    "#ddtopmenubar > ul > li:nth-child(12) > a",
    "#ddtopmenubar > ul > li:nth-child(11) > a",
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
        dynamicElementFound = await page.waitForSelector("#My\\ Ledger", { timeout: 1000 }).then(() => true).catch(() => false);
      } else {
        console.warn("Unable to get bounding box for the element");
      }
    } else {
      console.warn("Unable to find the element");
    }
  }
  
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    showGeneralLedgerForm();
  });
}

async function configureGeneralLedger(page) {
  await page.click("#cmbTaxType");
  await page.locator("#cmbTaxType").selectOption("ALL");
  await page.click("#cmdShowLedger");
  await page.click("#chngroup");
  await page.locator("#chngroup").selectOption("Tax Obligation");
  await page.waitForLoadState("load");
  await page.locator("#cmbTaxType").selectOption("ALL");

  await page.evaluate(() => {
    console.log("Select options AWAITING CHANGE...");
    const changeSelectOptions = () => {
      const selectElements = document.querySelectorAll("select.ui-pg-selbox");
      selectElements.forEach(selectElement => {
        Array.from(selectElement.options).forEach(option => {
          if (option.text === "1000" || option.text === "500" || option.text === "50"|| option.text === "20"|| option.text === "100"|| option.text === "200") {
            option.value = "20000";
          }
        });
      });
      console.log("Select options VALUE changed successfully");
    };
    changeSelectOptions();
  });
  
  await page.waitForTimeout(2000);
  
  await page.locator("#pagerGeneralLedgerDtlsTbl_center > table > tbody > tr > td:nth-child(8) > select").selectOption("50");
  await page.waitForTimeout(500);
  
  const selectElements = await page.$$(".ui-pg-selbox");

  for (const selectElement of selectElements) {
    await selectElement.click();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
  }
  
  await page.waitForTimeout(2500);
}

async function extractTableData(page, worksheet, company) {
  try {
    await page.waitForSelector("#gridGeneralLedgerDtlsTbl", { state: 'visible', timeout: 30000 });
    const sectionB2TableLocator = await page.locator("#gridGeneralLedgerDtlsTbl");
    
    if (!sectionB2TableLocator) {
      console.log("Table not found.");
      return;
    }

    // Add company info
    const companyNameRow = worksheet.addRow([
      "",
      `${company.company_name}`,
      `Extraction Date: ${getFormattedDateTime()}`
    ]);
    highlightCells(companyNameRow, "B", "O", "FFADD8E6", true);

    // Extract table data
    const sectionB2TableContent = await page.evaluate(() => {
      const table = document.querySelector("#gridGeneralLedgerDtlsTbl");
      if (!table) return [];
      
      const rows = Array.from(table.querySelectorAll("tr:not(.ui-jqgrid-labels)"));
      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll("td"));
        return cells.map(cell => cell.textContent.trim());
      }).filter(row => row.length > 0 && row.some(cell => cell !== ""));
    });

    if (!sectionB2TableContent || sectionB2TableContent.length <= 1) {
      console.log("No records found for", company.company_name);
      const noRecordsRow = worksheet.addRow(["", "", "No records found"]);
      highlightCells(noRecordsRow, "C", "0", "FFFF0000", true);
      
      await supabase.from("ledger_extractions")
        .upsert({
          company_name: company.company_name,
          ledger_data: [],
          extraction_date: new Date().toISOString(),
          status: 'completed',
          progress: 100
        }, { onConflict: 'company_name' });
      
      return;
    }

    // Add headers
    const headerRow = worksheet.addRow([
      "", "", "", "Sr.No.", "Tax Obligation", "Tax Period", "Transaction Date",
      "Reference Number", "Particulars", "Transaction Type", "Debit(ksh)", "Credit(ksh)",
    ]);
    highlightCells(headerRow, "D", "O", "FFADD8E", true);

    // Add data rows
    sectionB2TableContent.forEach(row => {
      worksheet.addRow(["", "", ...row]);
    });
    worksheet.addRow();

    // Transform data
    const ledgerData = sectionB2TableContent
      .map(row => {
        if (row.length < 12) {
          console.log("Invalid row data:", row);
          return null;
        }

        return {
          sr_no: row[1] || '',
          tax_obligation: row[2] || '',
          tax_period: row[3] || '',
          transaction_date: row[4] || '',
          reference_number: row[5] || '',
          particulars: row[6] || '',
          transaction_type: row[7] || '',
          debit: row[8]?.replace(/[^0-9.-]/g, '') || '0',
          credit: row[9]?.replace(/[^0-9.-]/g, '') || '0'
        };
      })
      .filter(Boolean);

    // Store in history
    await supabase.from("ledger_extractions_history")
      .insert({
        company_name: company.company_name,
        ledger_data: ledgerData,
        extraction_date: new Date().toISOString()
      });

    // Update current extraction with retry logic
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const { error } = await supabase
          .from("ledger_extractions")
          .upsert({
            company_name: company.company_name,
            ledger_data: ledgerData,
            extraction_date: new Date().toISOString(),
            status: 'completed',
            progress: 100
          }, { onConflict: 'company_name' });

        if (error) throw error;
        console.log(`Successfully saved ledger data for ${company.company_name}`);
        break;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    // Adjust column widths
    worksheet.columns.forEach((column, columnIndex) => {
      let maxLength = 0;
      worksheet.getColumn(columnIndex + 1).eachCell(cell => {
        const cellLength = cell.value ? cell.value.toString().length : 0;
        maxLength = Math.max(maxLength, cellLength);
      });
      worksheet.getColumn(columnIndex + 1).width = maxLength + 2;
    });

  } catch (error) {
    console.error(`Error extracting data for ${company.company_name}:`, error);
    
    await supabase.from("ledger_extractions")
      .upsert({
        company_name: company.company_name,
        status: 'error',
        progress: 0,
        updated_at: new Date().toISOString(),
        error_message: error.message
      }, { onConflict: 'company_name' });

    await supabase.from("ledger_extractions_history")
      .insert({
        company_name: company.company_name,
        error_message: error.message,
        extraction_date: new Date().toISOString()
      });

    throw error;
  }
}

async function processCompany(page, company, worksheet, downloadFolderPath, updateProgressCallback) {
  try {
    if (!company.kra_pin || !(company.kra_pin.startsWith("P") || company.kra_pin.startsWith("A"))) {
      console.log(`Skipping ${company.company_name}: Invalid KRA PIN`);
      await updateProgressCallback(company.company_name, 0, 'skipped');
      return;
    }

    if (company.kra_itax_current_password === null) {
      console.log(`Skipping ${company.company_name}: Password is null`);
      await updateProgressCallback(company.company_name, 0, 'skipped');
      return;
    }

    await updateProgressCallback(company.company_name, 10);
    await loginToKRA(page, company, downloadFolderPath);
    await updateProgressCallback(company.company_name, 30);
    
    await navigateToGeneralLedger(page);
    await updateProgressCallback(company.company_name, 50);
    
    await configureGeneralLedger(page);
    await updateProgressCallback(company.company_name, 70);
    
    await extractTableData(page, worksheet, company);
    await updateProgressCallback(company.company_name, 90);

    await page.evaluate(() => {
      logOutUser();
    });

    const isInvalidLogout = await page.waitForSelector('b:has-text("Click here to Login Again")', { state: 'visible', timeout: 3000 })
      .catch(() => false);

    if (isInvalidLogout) {
      await page.goto("https://itax.kra.go.ke/KRA-Portal/");
      await page.waitForLoadState("load");
      await page.reload();
    }

    await updateProgressCallback(company.company_name, 100, 'completed');

  } catch (error) {
    console.error(`Error processing company ${company.company_name}:`, error);
    
    const errorDetails = {
      message: error.message,
      timestamp: new Date().toISOString(),
      stack: error.stack,
      company: company.company_name
    };

    await supabase.from("ledger_extractions")
      .upsert({
        company_name: company.company_name,
        status: 'error',
        progress: 0,
        error_message: errorDetails,
        updated_at: new Date().toISOString()
      }, { onConflict: 'company_name' });

    await supabase.from("ledger_extractions_history")
      .insert({
        company_name: company.company_name,
        error_message: errorDetails,
        extraction_date: new Date().toISOString()
      });

    throw error;
  }
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

async function runAutomation(companyIds, updateProgressCallback) {
  const downloadFolderPath = await createDownloadFolder();
  const data = await readSupabaseData(companyIds);
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("GENERAL LEDGER ALL SUMMARY");
  const companyNameRow = worksheet.addRow(["", "", `GENERAL LEDGER ALL COMPANIES SUMMARY`]);
  highlightCells(companyNameRow, "B", "N", "83EBFF", true);
  worksheet.addRow();

  let currentBrowser = await chromium.launch({ headless: false, channel: "msedge" });
  const context = await currentBrowser.newContext();
  const page = await context.newPage();

  try {
    for (const company of data) {
      if (!isRunning) {
        console.log("Automation stopped, closing browser...");
        break;
      }
      await processCompany(page, company, worksheet, downloadFolderPath, updateProgressCallback);
      await workbook.xlsx.writeFile(path.join(downloadFolderPath, `AUTO EXTRACT GENERAL LEDGER KRA 2.xlsx`));
    }
  } finally {
    await context.close();
    await currentBrowser.close();
    currentBrowser = null;
  }
}

export default async function handler(req, res) {
  const { action, companyIds, runOption } = req.body;

  switch (action) {
      case 'start':
          if (isRunning) {
              return res.status(400).json({ error: 'Automation is already running' });
          }

          // Reset all previous running states
          await supabase
              .from('ledger_extractions')
              .update({
                  status: 'completed',
                  updated_at: new Date().toISOString()
              })
              .eq('status', 'running');

          isRunning = true;
          progress = 0;
          let companiesToProcess = [];

          if (runOption === 'all') {
              const { data, error } = await Promise.all([
                  supabase
                      .from('companyMainList')
                      .select('id, company_name, kra_pin, kra_password, status')
                      .eq('status', 'active')
                      .order('id', { ascending: true }),
                  supabase
                      .from('PasswordChecker')
                      .select('company_name, kra_pin, kra_password, status')
              ]);

              // Merge the data prioritizing PasswordChecker passwords
              const mergedData = data[0].map(mainCompany => {
                  const passwordMatch = data[1]?.find(
                      pc => pc.company_name === mainCompany.company_name
                  );

                  return {
                      ...mainCompany,
                      kra_password: passwordMatch?.kra_password || mainCompany.kra_password
                  };
              });

              if (error) {
                  isRunning = false;
                  return res.status(500).json({ error: 'Failed to fetch companies' });
              }

              companiesToProcess = data.map(company => company.id);
          } else {
              companiesToProcess = companyIds;
          }

          // Update status for selected companies to 'pending'
          await supabase
              .from('ledger_extractions')
              .update({
                  status: 'pending',
                  progress: 0,
                  error_message: null // Clear any previous errors
              })
              .in('company_name', companiesToProcess.map(id => id.toString()));

          runAutomation(companiesToProcess, updateProgress)
              .then(() => {
                  isRunning = false;
              })
              .catch((error) => {
                  isRunning = false;
                  console.error('Automation error:', error);
              });

          return res.status(200).json({
              message: 'Automation started',
              companiesCount: companiesToProcess.length
          });

    case 'resume':
      const { company, lastProgress } = req.body;
      isRunning = true;
      progress = lastProgress;
      currentCompany = company;

      await supabase
        .from('ledger_extractions')
        .update({
          status: 'running',
          progress: lastProgress,
          updated_at: new Date().toISOString()
        })
        .eq('company_name', company);

      runAutomation([company], updateProgress)
        .then(() => {
          isRunning = false;
        })
        .catch((error) => {
          isRunning = false;
          console.error('Automation error:', error);
        });

      return res.status(200).json({ message: 'Extraction resumed' });

      case 'stop':
        isRunning = false;
        if (currentBrowser) {
          try {
            await currentBrowser.close();
            currentBrowser = null;
            console.log("Browser closed successfully");
          } catch (error) {
            console.error("Error closing browser:", error);
          }
        }
        await supabase
          .from('ledger_extractions')
          .update({
            status: 'stopped',
            updated_at: new Date().toISOString()
          })
          .eq('status', 'running');
        return res.status(200).json({ message: 'Automation stopped and browser closed' });
  
    case 'progress':
      const { data: progressData, error: progressError } = await supabase
        .from('ledger_extractions')
        .select('*')
        .in('status', ['running', 'completed', 'error', 'stopped', 'queued'])
        .order('updated_at', { ascending: false });

      if (progressError) {
        return res.status(500).json({ error: 'Failed to fetch progress data' });
      }

      const runningCompany = progressData.find(item => item.status === 'running');

      return res.status(200).json({
        isRunning,
        progress: runningCompany ? runningCompany.progress : progress,
        currentCompany: runningCompany ? runningCompany.company_name : currentCompany,
        logs: progressData.map(item => ({
          company: item.company_name,
          status: item.status,
          progress: item.progress,
          timestamp: item.updated_at,
          error: item.error_message
        }))
      });

    case 'getResults':
      const { data, error } = await supabase
        .from('ledger_extractions')
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