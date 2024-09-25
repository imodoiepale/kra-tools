// pages/api/password-checker.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { chromium } from 'playwright-core';
import ExcelJS from 'exceljs';
import { createWorker } from 'tesseract.js';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const data = await readSupabaseData();
    const results = await processCompanies(data);
    res.status(200).json({ message: 'Password check completed', results });
  } catch (error) {
    console.error('Error in password checker:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function readSupabaseData() {
  const { data, error } = await supabase.from("PasswordChecker").select("*").order('id');
  if (error) throw error;
  return data;
}

async function processCompanies(companies: any[]) {
  const now = new Date();
  const formattedDateTime = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
  const downloadFolderPath = path.join(os.tmpdir(), `KRA-PASSWORD-CHECK-${formattedDateTime}`);
  await fs.mkdir(downloadFolderPath, { recursive: true });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Password Validation");
  worksheet.addRow(["Company Name", "KRA PIN", "ITAX Password", "Status"]);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const results = [];

  for (const company of companies) {
    const page = await context.newPage();
    try {
      if (!company.kra_password || !company.kra_pin) {
        const status = !company.kra_password && !company.kra_pin
          ? "Pin and Password Missing"
          : !company.kra_password
            ? "Password Missing"
            : "Pin Missing";
        results.push({ company: company.company_name, status });
        worksheet.addRow([company.company_name, company.kra_pin, company.kra_password, status]);
        await updateSupabaseStatus(company.id, status);
        continue;
      }

      await loginToKRA(page, company);
      const status = await checkLoginStatus(page);
      
      results.push({ company: company.company_name, status });
      worksheet.addRow([company.company_name, company.kra_pin, company.kra_password, status]);
      await updateSupabaseStatus(company.id, status);

      await logoutKRA(page);
    } catch (error) {
      console.error(`Error processing ${company.company_name}:`, error);
      results.push({ company: company.company_name, status: "Error" });
      worksheet.addRow([company.company_name, company.kra_pin, company.kra_password, "Error"]);
      await updateSupabaseStatus(company.id, "Error");
    } finally {
      await page.close();
    }
  }

  await context.close();
  await browser.close();

  const excelFilePath = path.join(downloadFolderPath, `PASSWORD VALIDATION - KRA - COMPANIES.xlsx`);
  await workbook.xlsx.writeFile(excelFilePath);

  return results;
}

async function loginToKRA(page: any, company: any) {
  await page.goto("https://itax.kra.go.ke/KRA-Portal/");
  await page.fill("#logid", company.kra_pin);
  await page.evaluate(() => {
    (window as any).CheckPIN();
  });
  await page.fill('input[name="xxZTT9p2wQ"]', company.kra_password);

  const captchaImg = await page.waitForSelector("#captcha_img");
  const captchaBuffer = await captchaImg.screenshot();

  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(captchaBuffer);
  await worker.terminate();

  const captchaResult = solveCaptcha(text);
  await page.fill("#captcahText", captchaResult.toString());
  await page.click("#loginButton");
}

function solveCaptcha(text: string) {
  const numbers = text.match(/\d+/g);
  if (!numbers || numbers.length < 2) throw new Error("Unable to extract valid numbers from captcha");
  if (text.includes("+")) return Number(numbers[0]) + Number(numbers[1]);
  if (text.includes("-")) return Number(numbers[0]) - Number(numbers[1]);
  throw new Error("Unsupported operator in captcha");
}

async function checkLoginStatus(page: any) {
  const isPasswordExpired = await page.$('.formheading:has-text("YOUR PASSWORD HAS EXPIRED!")');
  const isAccountLocked = await page.$('b:has-text("The account has been locked.")');
  const isInvalidLogin = await page.$('b:has-text("Invalid Login Id or Password.")');

  if (isPasswordExpired) return "Password Expired";
  if (isAccountLocked) return "Locked";
  if (isInvalidLogin) return "Invalid";
  return "Valid";
}

async function logoutKRA(page: any) {
  await page.evaluate(() => {
    try {
      (window as any).logOutUser();
      (window as any).logOutUser();
      window.location.href = "https://itax.kra.go.ke/KRA-Portal/";
      (window as any).logOutUser();
    } catch (error) {
      console.error("Error during logout:", error);
    }
  });
}

async function updateSupabaseStatus(id: number, status: string) {
  try {
    const { error } = await supabase
      .from("PasswordChecker")
      .update({ status, last_checked: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error updating Supabase:", error);
  }
}