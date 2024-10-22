import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ExcelJS from "exceljs";
import { createWorker } from 'tesseract.js';
import { createClient } from "@supabase/supabase-js";
import retry from "async-retry";

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

function getFormattedDateTimeForExcel() {
  const now = new Date();
  return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
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

async function saveLedgerDataToDB(companyName, ledgerData) {
  try {
    const { data, error } = await supabase
      .from("ledger_extractions")
      .upsert({
        company_name: companyName,
        ledger_data: ledgerData,
        extraction_date: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Error saving ledger data to database: ${error.message}`);
    }
    console.log(`Successfully saved ledger data for ${companyName}`);
  } catch (error) {
    console.error("Error saving ledger data:", error);
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

function getMonthName(month) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[month - 1];
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
  const sectionB2TableLocator = await page.locator("#gridGeneralLedgerDtlsTbl");
  
  if (sectionB2TableLocator) {
    const sectionB2Table = await sectionB2TableLocator;
    const companyNameRow = worksheet.addRow([
      "",
      `${company.company_name}`,
      `Extraction Date: ${getFormattedDateTime()}`
    ]);
    highlightCells(companyNameRow, "B", "O", "FFADD8E6", true);

    const sectionB2TableContent = await sectionB2Table.evaluate(table => {
      const rows = Array.from(table.querySelectorAll("tr"));
      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll("td"));
        return cells.map(cell => cell.innerText.trim());
      });
    });

    if (sectionB2TableContent.length <= 1) {
      const noRecordsRow = worksheet.addRow(["", "", "No records found"]);
      highlightCells(noRecordsRow, "C", "0", "FFFF0000", true);
    } else {
      const sectionB2TableContent_Header = worksheet.addRow([
        "", "", "", "Sr.No.", "Tax Obligation", "Tax Period", "Transaction Date",
        "Reference Number", "Particulars", "Transaction Type", "Debit(ksh)", "Credit(ksh)",
      ]);
      highlightCells(sectionB2TableContent_Header, "D", "O", "FFADD8E", true);

      sectionB2TableContent
        .filter(row => row.some(cell => cell.trim() !== ""))
        .forEach(row => {
          worksheet.addRow(["", "", ...row]);
        });
      worksheet.addRow();

      // Save extracted data to the database
      const ledgerData = sectionB2TableContent.map(row => ({
        sr_no: row[3],
        tax_obligation: row[4],
        tax_period: row[5],
        transaction_date: row[6],
        reference_number: row[7],
        particulars: row[8],
        transaction_type: row[9],
        debit: row[10],
        credit: row[11],
      }));

      await saveLedgerDataToDB(company.company_name, ledgerData);
    }

    worksheet.columns.forEach((column, columnIndex) => {
      let maxLength = 0;
      for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
        const cell = worksheet.getCell(rowIndex, columnIndex + 1);
        const cellLength = cell.value ? cell.value.toString().length : 0;
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      }
      worksheet.getColumn(columnIndex + 1).width = maxLength + 2;
    });
  } else {
    console.log("Table not found.");
  }
}


async function processCompany(page, company, worksheet, downloadFolderPath) {
  if (!company.kra_pin || !(company.kra_pin.startsWith("P") || company.kra_pin.startsWith("A"))) {
    console.log(`Skipping ${company.company_name}: Invalid KRA PIN`);
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

  await loginToKRA(page, company, downloadFolderPath);
  await navigateToGeneralLedger(page);
  await configureGeneralLedger(page);
  await extractTableData(page, worksheet, company);

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
}

async function processCompanies(runOption, selectedIds, startProgress = 0, existingLogs = []) {
  const downloadFolderPath = await createDownloadFolder();
  let data = await readSupabaseData(); // Change const to let

  if (runOption === 'selected' && selectedIds && selectedIds.length > 0) {
    data = data.filter(company => selectedIds.includes(company.id)); // This is now valid
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
        return;
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

// API handler function
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { action, runOption, selectedIds } = req.body;

  if (action === "start") {
    stopRequested = false;
    await processCompanies(runOption, selectedIds);
    return res.status(200).json({ message: "Extraction started." });
  }

  if (action === "stop") {
    stopRequested = true;
    return res.status(200).json({ message: "Extraction stop requested." });
  }

  return res.status(400).json({ message: "Invalid action." });
}