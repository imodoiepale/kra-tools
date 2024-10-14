// pages/api/pentasoft-extraction.js
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { action, company } = req.body;

    switch (action) {
        case 'extract':
            try {
                const extractionResult = await extractReports(company);
                return res.status(200).json(extractionResult);
            } catch (error) {
                console.error('Extraction error:', error);
                return res.status(500).json({ message: 'Extraction failed', error: error.message });
            }
        default:
            return res.status(400).json({ message: 'Invalid action' });
    }
}

async function extractReports(company) {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('http://192.168.0.251:4445/cloudSystem/mainPageV3.php');
        await page.fill('#user_name', 'admin.bs');
        await page.fill('#password', 'admin');
        await page.evaluate(() => { validate(); });

        await page.waitForTimeout(2000);
        await page.locator('frame').nth(1).contentFrame().getByRole('cell', { name: 'ePAYROLL' }).click();

        const reports = [
            { url: 'http://192.168.0.251:4445/epayroll/process/monthlyUpgrade.php?username=admin.bs', name: 'P10 MONTHLY - PAYE', action: () => page.click('#csvbutton') },
            { url: 'http://192.168.0.251:4445/epayroll/statutory/nssfProcess/itemReport.php?username=admin.bs', name: 'N.S.S.F MONTHLY', action: () => page.evaluate(() => { printToExcel(); }) },
            { url: 'http://192.168.0.251:4445/epayroll/statutory/nhifProcess/itemReport.php?username=admin.bs', name: 'NHIF MONTHLY', action: () => page.evaluate(() => { printToExcel(); }) },
            { url: 'http://192.168.0.251:4445/epayroll/statutory/nitaProcess/nitaPreviewReport.php?username=admin.bs', name: 'NITA REVIEW', action: () => page.evaluate(() => { printToExcel(); }) },
            { url: 'http://192.168.0.251:4445/epayroll/statutory/houseLevyProcess/hlPreviewReport.php?username=admin.bs', name: 'HOUSE LEVY PREVIEW', action: () => page.evaluate(() => { printToExcel(); }) }
        ];

        const downloadedFiles = [];

        for (const report of reports) {
            await page.goto(report.url);
            const downloadPromise = page.waitForEvent('download');
            await report.action();
            const download = await downloadPromise;
            const fileName = `${company.name}-${report.name}-${new Date().toISOString().split('T')[0]}.csv`;
            const filePath = path.join(os.tmpdir(), fileName);
            await download.saveAs(filePath);
            downloadedFiles.push({ name: report.name, path: filePath });
        }

        // Upload files to Supabase Storage
        const uploadedFiles = await uploadFilesToSupabase(downloadedFiles, company.name);

        // Update Supabase table with file information
        await updateSupabaseTable(company.name, uploadedFiles);

        return { message: 'Extraction completed successfully', files: uploadedFiles };
    } finally {
        await browser.close();
    }
}

async function uploadFilesToSupabase(files, companyName) {
    const uploadedFiles = [];

    for (const file of files) {
        const fileContent = await fs.readFile(file.path);
        const fileName = path.basename(file.path);
        const { data, error } = await supabase.storage
            .from('pentasoft-reports')
            .upload(`${companyName}/${fileName}`, fileContent, {
                contentType: 'text/csv',
            });

        if (error) throw error;

        uploadedFiles.push({
            name: file.name,
            path: data.path,
            fullPath: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pentasoft-reports/${data.path}`
        });
    }

    return uploadedFiles;
}

async function updateSupabaseTable(companyName, files) {
    const { data, error } = await supabase
        .from('pentasoft_extractions')
        .insert({
            company_name: companyName,
            extraction_date: new Date().toISOString(),
            files: files
        });

    if (error) throw error;

    return data;
}