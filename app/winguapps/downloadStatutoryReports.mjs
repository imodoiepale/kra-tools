import sql from 'mssql';
import axios from 'axios';
import * as fs from 'fs';
import path from 'path';
import os from 'os';
import { mkdir } from 'fs/promises';

const mssqlConfig = {
    user: 'db_a77dbc_waclientrepository_admin',
    password: 'jackesq99',
    server: 'sql5061.site4now.net',
    port: 1433,
    database: 'db_a77dbc_waclientrepository',
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};

async function downloadFile(url, fileName) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(fileName);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`✓ Downloaded: ${path.basename(fileName)}`);
                resolve();
            });
            writer.on('error', (error) => {
                console.error(`✗ Error writing ${path.basename(fileName)}:`, error);
                reject(error);
            });
        });
    } catch (error) {
        console.error(`✗ Error downloading ${path.basename(fileName)}:`, error.message);
        throw error;
    }
}

async function processCompany(reportData, folderPath) {
    try {
        const files = {
            'PAYE': {
                url: reportData.PAYE_CSV_Link,
                ext: '.csv'
            },
            'NSSF': {
                url: reportData.NSSF_Excel_Link,
                ext: '.xlsx'
            },
            'NHIF': {
                url: reportData.NHIF_Excel_Link,
                ext: '.xlsx'
            },
            'SHIF': {
                url: reportData.SHIF_Excel_Link,
                ext: '.xlsx'
            },
            'Housing_Levy': {
                url: reportData.Housing_Levy_CSV_Link,
                ext: '.csv'
            }
        };

        const downloadPromises = Object.entries(files)
            .filter(([_, fileInfo]) => fileInfo.url)
            .map(([fileType, fileInfo]) => {
                // Keep original company name but replace any invalid file system characters
                const fileName = `${reportData.CompanyName} - ${fileType}${fileInfo.ext}`
                    .replace(/[<>:"\/\\|?*]/g, ''); // Only remove invalid file system characters
                const filePath = path.join(folderPath, fileName);
                return downloadFile(fileInfo.url, filePath);
            });

        console.log(`↓ Starting downloads for ${reportData.CompanyName}`);
        await Promise.all(downloadPromises);
        console.log(`✓ Completed all downloads for ${reportData.CompanyName}`);

    } catch (error) {
        console.error(`✗ Error processing ${reportData.CompanyName}:`, error);
    }
}

async function fetchAndDownloadReports() {
    try {
        console.log('📊 Connecting to database...');
        const pool = await sql.connect(mssqlConfig);

        console.log('🔍 Fetching reports...');
        const result = await pool.request()
            .input('MemberID', sql.Int, 84)
            .query('SELECT * FROM dbo.cr_Reports_External WHERE MemberID = @MemberID');

        const filteredData = result.recordset.map(report => ({
            CompanyName: report.CompanyName,
            Month: 11,
            PAYE_CSV_Link: report.PAYE_CSV_Link,
            NSSF_Excel_Link: report.NSSF_Excel_Link,
            NHIF_Excel_Link: report.NHIF_Excel_Link,
            SHIF_Excel_Link: report.SHIF_Excel_Link,
            Housing_Levy_CSV_Link: report.Housing_Levy_CSV_Link,
        }));

        console.log(`📁 Found ${filteredData.length} companies to process`);

        // Create the downloads folder
        const downloadsPath = path.join(os.homedir(), 'Downloads');
        
        // Create folder name with current date
        const currentDate = new Date();
        currentDate.setMonth(currentDate.getMonth() - 1);
        const formattedDate = currentDate.toISOString().split('T')[0];
        const folderName = `Payroll ${currentDate.toLocaleString('default', { month: 'long' })} - ${formattedDate}`;
        // Create full folder path
        const folderPath = path.join(downloadsPath, folderName);
        await mkdir(folderPath, { recursive: true });
        
        // Process all companies concurrently
        console.log('⚡ Starting concurrent downloads for all companies...');
        await Promise.all(
            filteredData.map(report => processCompany(report, folderPath))
        );

        console.log('✅ All companies processed successfully');
        console.log(`📂 Files saved in: ${folderPath}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await sql.close();
    }
}

// Execute the main function with better error handling
fetchAndDownloadReports()
    .then(() => console.log('🎉 Script completed successfully'))
    .catch(error => console.error('💥 Script failed:', error));