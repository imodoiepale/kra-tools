// @ts-nocheck
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';

(async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    const today = new Date();
    const dateString = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;

    console.log(`Starting script execution on ${dateString}`);

    const reports = [
        {
            url: 'http://192.168.0.251:4445/epayroll/process/monthlyUpgrade.php?username=admin.bs',
            link: 'P10 MONTHLY - PAYE',
            expectedExtension: '.csv'
        },
        {
            url: 'http://192.168.0.251:4445/epayroll/statutory/nssfProcess/itemReport.php?username=admin.bs',
            link: 'N.S.S.F MONTHLY',
            expectedExtension: '.xls'
        },
        {
            url: 'http://192.168.0.251:4445/epayroll/statutory/nhifProcess/itemReport.php?username=admin.bs',
            link: 'NHIF MONTHL',
            expectedExtension: '.xls'
        },
        {
            url: 'http://192.168.0.251:4445/epayroll/statutory/nitaProcess/nitaPreviewReport.php?username=admin.bs',
            link: 'NITA REVIEW',
            expectedExtension: '.xls'
        },
        {
            url: 'http://192.168.0.251:4445/epayroll/statutory/houseLevyProcess/hlPreviewReport.php?username=admin.bs',
            link: 'HOUSE LEVY PREVIEW',
            expectedExtension: '.xls'
        }
    ];

    console.log('Navigating to login page...');
    const loginPage = await context.newPage();
    await loginPage.goto('http://192.168.0.251:4445/cloudSystem/mainPageV3.php');
    console.log('Login page loaded');

    // Login process
    console.log('Performing login...');
    await loginPage.fill('#user_name', 'admin.bs');
    await loginPage.fill('#password', 'admin');
    await loginPage.evaluate(() => {
        validate();
    });
    console.log('Login submitted, waiting for navigation...');
    await loginPage.waitForNavigation({ waitUntil: 'networkidle' });

    // Get the number of options in the dropdown
    const optionCount = await loginPage.locator('#headerPage').contentFrame().locator('#clientDynamicId option').count();
    console.log(`Total options in dropdown: ${optionCount}`);

    // Iterate through each company option
    for (let i = 0; i < optionCount; i++) {
        const option = loginPage.locator('#headerPage').contentFrame().locator(`#clientDynamicId option >> nth=${i}`);
        const optionText = await option.textContent();
        const optionValue = await option.getAttribute('value');
        const optionTitle = await option.getAttribute('title');

        // Skip 'ADJUSTMENT' and 'SAMPLE LTD'
        if (optionText.trim() === 'ADJUSTMENT' || optionText.trim() === 'SAMPLE LTD' || optionText.trim() === 'BOOKSMART LTD') {
            console.log(`Skipping ${optionText.trim()}`);
            continue;
        }

        console.log(`\nProcessing company ${i + 1} of ${optionCount}: ${optionTitle}`);

        try {
            // Select the company
            console.log(`Selecting company with value: ${optionValue}`);
            await loginPage.locator('#headerPage').contentFrame().locator('#clientDynamicId').selectOption(optionValue);
            console.log('Company selected, waiting for page to load...');
            await loginPage.waitForNavigation({ waitUntil: 'load' });

            // Click on ePAYROLL
            console.log('Clicking on ePAYROLL...');
            await loginPage.locator('frame').nth(1).contentFrame().getByRole('cell', { name: 'ePAYROLL' }).click();


            const downloadFolder = path.join(os.homedir(), 'Downloads', `PENTASOFT - ${dateString}`);
            if (!fs.existsSync(downloadFolder)) {
                console.log(`Creating download folder: ${downloadFolder}`);
                fs.mkdirSync(downloadFolder, { recursive: true });
            }

            // Download each report
            for (const report of reports) {
                console.log(`\nProcessing report: ${report.link}`);
                const page = await context.newPage();

                console.log(`Navigating to ${report.url}`);
                await page.goto(report.url);
                await page.waitForLoadState('networkidle');

                const downloadPromise = page.waitForEvent('download');

                // Use switch case for different button clicks
                switch (report.link) {
                    case 'P10 MONTHLY - PAYE':
                        console.log("Clicking CSV button");
                        await page.click('#csvbutton');
                        break;
                    case 'N.S.S.F MONTHLY':
                    case 'NHIF MONTHL':
                    case 'NITA REVIEW':
                    case 'HOUSE LEVY PREVIEW':
                        console.log("Calling printToExcel function");
                        await page.evaluate(() => {
                            printToExcel();
                        });
                        break;
                    default:
                        console.log(`Unexpected report type: ${report.link}`);
                        continue;
                }

                console.log('Waiting for download to start...');
                const download = await downloadPromise;
                const suggestedFilename = download.suggestedFilename();
                let fileExtension = path.extname(suggestedFilename);

                // If the suggested extension is .xlsx but we expect .xls, change it
                if (fileExtension === '.xlsx' && report.expectedExtension === '.xls') {
                    console.log('Changing file extension from .xlsx to .xls');
                    fileExtension = '.xls';
                }

                const fileName = `${optionTitle} - ${report.link} ${dateString}${fileExtension}`;
                const filePath = path.join(downloadFolder, fileName);

                console.log(`Saving file: ${filePath}`);
                await download.saveAs(filePath);
                console.log(`File saved successfully`);

                await page.close();
                console.log('Page closed');
            }

            // Go back to the main page for the next company
            console.log('Navigating back to main page...');
            await loginPage.goto('http://192.168.0.251:4445/cloudSystem/mainPageV3.php');
            

        } catch (error) {
            console.error(`Error processing company ${optionTitle}:`, error);
        }
    }

    console.log('\nAll companies processed. Closing browser...');
    await browser.close();
    console.log('Script execution completed.');
})();