import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ExcelJS from "exceljs";
import { createWorker } from 'tesseract.js';
import { createClient } from "@supabase/supabase-js";

// Constants
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let stopRequested = false;

// Utility functions
function getFormattedDateTime() {
  const now = new Date();
  return `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
}

function getDownloadFolderPath() {
  const formattedDateTime = getFormattedDateTime();
  return path.join(os.homedir(), "Downloads", ` AUTO EXTRACT GENERAL LEDGER- ${formattedDateTime}`);
}

async function createDownloadFolder() {
  const downloadFolderPath = getDownloadFolderPath();
  await fs.mkdir(downloadFolderPath, { recursive: true }).catch(console.error);
  return downloadFolderPath;
}

async function readSupabaseData() {
  try {
    const { data, error } = await supabase.from("company_MAIN").select("*").order("id", { ascending: true });
    if (error) {
      throw new Error(`Error reading data from 'company_MAIN' table: ${error.message}`);
    }
    return data;
  } catch (error) {
    throw new Error(`Error reading Supabase data: ${error.message}`);
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
  await page.goto("https://itax.kra.go.ke/KRA-Portal/");
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
    console.log("Wrong result of the arithmetic operation, retrying...");
    await loginToKRA(page, company, downloadFolderPath);
  }
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
    // Wait for table to be visible
    await page.waitForSelector("#gridGeneralLedgerDtlsTbl", { state: 'visible', timeout: 30000 });
    
    const sectionB2TableLocator = await page.locator("#gridGeneralLedgerDtlsTbl");
    
    if (!sectionB2TableLocator) {
      console.log("Table not found.");
      return;
    }

    // Add company info to worksheet
    const companyNameRow = worksheet.addRow([
      "",
      `${company.company_name}`,
      `Extraction Date: ${getFormattedDateTime()}`
    ]);
    highlightCells(companyNameRow, "B", "O", "FFADD8E6", true);

    // Extract table data with explicit wait and validation
    const sectionB2TableContent = await page.evaluate(() => {
      const table = document.querySelector("#gridGeneralLedgerDtlsTbl");
      if (!table) return [];
      
      const rows = Array.from(table.querySelectorAll("tr:not(.ui-jqgrid-labels)"));
      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll("td"));
        return cells.map(cell => cell.textContent.trim());
      }).filter(row => row.length > 0 && row.some(cell => cell !== "")); // Filter out empty rows
    });

    console.log("Extracted table content:", sectionB2TableContent); // Debug log

    if (!sectionB2TableContent || sectionB2TableContent.length <= 1) {
      console.log("No records found for", company.company_name);
      const noRecordsRow = worksheet.addRow(["", "", "No records found"]);
      highlightCells(noRecordsRow, "C", "0", "FFFF0000", true);
      
      // Update database with empty ledger
      await supabase.from("ledger_extractions")
        .upsert({
          company_name: company.company_name,
          ledger_data: [],
          extraction_date: new Date().toISOString(),
          status: 'completed',
          progress: 100
        }, {
          onConflict: 'company_name'
        });
      
      return;
    }

    // Add headers to worksheet
    const sectionB2TableContent_Header = worksheet.addRow([
      "", "", "", "Sr.No.", "Tax Obligation", "Tax Period", "Transaction Date",
      "Reference Number", "Particulars", "Transaction Type", "Debit(ksh)", "Credit(ksh)",
    ]);
    highlightCells(sectionB2TableContent_Header, "D", "O", "FFADD8E", true);

    // Process data rows
    sectionB2TableContent.forEach(row => {
      worksheet.addRow(["", "", ...row]);
    });
    worksheet.addRow();

    // Transform and validate data for database
    const ledgerData = sectionB2TableContent
      .map(row => {
        // Ensure row has enough elements
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
      .filter(Boolean); // Remove null entries

    console.log("Processed ledger data:", ledgerData); // Debug log

    // Save to database with retry logic
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const { data, error } = await supabase
          .from("ledger_extractions")
          .upsert({
            company_name: company.company_name,
            ledger_data: ledgerData,
            extraction_date: new Date().toISOString(),
            status: 'completed',
            progress: 100
          }, {
            onConflict: 'company_name'
          });

        if (error) {
          console.error("Database error:", error);
          throw error;
        }
        
        console.log(`Successfully saved ledger data for ${company.company_name}`);
        break;
      } catch (error) {
        retryCount++;
        console.error(`Attempt ${retryCount} failed:`, error);
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
    // Update status to error in database
    await supabase.from("ledger_extractions")
      .upsert({
        company_name: company.company_name,
        status: 'error',
        progress: 0,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'company_name'
      });
    throw error;
  }
}

async function updateExtractionStatus(companyName, status, progress = 0) {
  try {
    const { error } = await supabase
      .from('ledger_extractions')
      .upsert({
        company_name: companyName,
        status: status,
        progress: progress,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'company_name'
      });

    if (error) throw error;
    console.log(`Updated status for ${companyName} to ${status} with progress ${progress}%`);
  } catch (error) {
    console.error('Error updating extraction status:', error);
  }
}

async function processCompany(page, company, worksheet, downloadFolderPath) {
  try {
    if (!company.kra_pin || !(company.kra_pin.startsWith("P") || company.kra_pin.startsWith("A"))) {
      console.log(`Skipping ${company.company_name}: Invalid KRA PIN`);
      await updateExtractionStatus(company.company_name, 'skipped', 0);
      const companyNameRow = worksheet.addRow([
        "",
        `${company.company_name}`,
        `Extraction Date: ${getFormattedDateTime()}`
      ]);
      highlightCells(companyNameRow, "B", "0", "FFADD8E6", true);
      const pinRow = worksheet.addRow(["", " ", "MISSING KRA PIN"]);
      highlightCells(pinRow, "C", "J", "FF7474");
      worksheet.addRow();
      return;
    }

    if (company.kra_itax_current_password === null) {
      console.log(`Skipping ${company.company_name}: Password is null`);
      await updateExtractionStatus(company.company_name, 'skipped', 0);
      const companyNameRow = worksheet.addRow([
        "",
        `${company.company_name}`,
        `Extraction Date: ${getFormattedDateTime()}`
      ]);
      highlightCells(companyNameRow, "B", "J", "FFADD8E6", true);
      const passwordRow = worksheet.addRow(["", " ", "MISSING KRA PASSWORD"]);
      highlightCells(passwordRow, "C", "J", "FF7474");
      worksheet.addRow();
      return;
    }

    await updateExtractionStatus(company.company_name, 'running', 10);
    await loginToKRA(page, company, downloadFolderPath);
    await updateExtractionStatus(company.company_name, 'running', 30);
    
    await navigateToGeneralLedger(page);
    await updateExtractionStatus(company.company_name, 'running', 50);
    
    await configureGeneralLedger(page);
    await updateExtractionStatus(company.company_name, 'running', 70);
    
    await extractTableData(page, worksheet, company);
    await updateExtractionStatus(company.company_name, 'running', 90);

    await page.evaluate(() => {
      logOutUser();
    });

    const isInvalidLogout = await page.waitForSelector('b:has-text("Click here to Login Again")', { state: 'visible', timeout: 3000 })
      .catch(() => false);

    if (isInvalidLogout) {
      console.log("LOGOUT FAILED, retrying...");
      await page.goto("https://itax.kra.go.ke/KRA-Portal/");
      await page.waitForLoadState("load");
      await page.reload();
    }

    await updateExtractionStatus(company.company_name, 'completed', 100);

  } catch (error) {
    console.error(`Error processing company ${company.company_name}:`, error);
    await updateExtractionStatus(company.company_name, 'error', 0);
    throw error;
  }
}

async function processCompanies(runOption, selectedIds, startProgress = 0, existingLogs = []) {
  const downloadFolderPath = await createDownloadFolder();
  let data = await readSupabaseData();

  if (runOption === 'selected' && selectedIds && selectedIds.length > 0) {
    data = data.filter(company => selectedIds.includes(company.id));
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("GENERAL LEDGER ALL SUMMARY");
  const companyNameRow = worksheet.addRow(["", "", `GENERAL LEDGER ALL COMPANIES SUMMARY`]);
  highlightCells(companyNameRow, "B", "N", "83EBFF", true);
  worksheet.addRow();

  const browser = await chromium.launch({ headless: false, channel: "msedge" });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    for (let i = 0; i < data.length; i++) {
      if (stopRequested) {
        console.log("Automation stopped by user request.");
        const company = data[i];
        await updateExtractionStatus(company.company_name, 'stopped', 0);
        break;
      }

      const company = data[i];
      console.log(`Processing company ${i + 1}/${data.length}`);
      await processCompany(page, company, worksheet, downloadFolderPath);
      await workbook.xlsx.writeFile(path.join(downloadFolderPath, `AUTO EXTRACT GENERAL LEDGER KRA 2.xlsx`));
    }
  } catch (error) {
    console.error("Error during data extraction and processing:", error);
  } finally {
    await context.close();
    await browser.close();
  }

  console.log("Data extraction and processing complete.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { action, runOption, selectedIds } = req.body;

  try {
    switch (action) {
      case "start":
        stopRequested = false;
        // Start processing in background
        processCompanies(runOption, selectedIds).catch(console.error);
        return res.status(200).json({ message: "Extraction started." });
      
      case "stop":
        stopRequested = true;
        return res.status(200).json({ message: "Extraction stop requested." });
      
      case 'resume':
        const { company, lastProgress } = req.body;
        stopRequested = false;
        
        await updateExtractionStatus(company, 'running', lastProgress);
        // Resume processing
        processCompanies(runOption, selectedIds, lastProgress).catch(console.error);
        return res.status(200).json({ message: "Extraction resumed." });
      
      case 'progress':
        // Fetch current progress from database
        const { data: progressData } = await supabase
          .from('ledger_extractions')
          .select('*')
          .order('updated_at', { ascending: false });

        return res.status(200).json({
          currentCompany: progressData?.[0]?.company_name,
          progress: progressData?.[0]?.progress || 0,
          status: progressData?.[0]?.status || 'idle',
          logs: progressData?.map(row => ({
            company: row.company_name,
            status: row.status,
            progress: row.progress,
            timestamp: row.updated_at
          }))
        });

      default:
        return res.status(400).json({ message: "Invalid action." });
    }
  } catch (error) {
    console.error('Error in handler:', error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
}