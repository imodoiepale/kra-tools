import sql from 'mssql';
import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import axios from 'axios';
import { ReportRecord, SelectedDocs, DocumentMap } from '@/app/winguapps/types';
import { Readable } from 'stream';

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
} as const;

async function downloadFile(url: string): Promise<Buffer> {
    if (!url) {
        throw new Error('URL is empty or undefined');
    }
    
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            validateStatus: (status) => status === 200,
            maxRedirects: 5,
            timeout: 30000 // 30 seconds timeout
        });

        // Convert stream to buffer
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            response.data.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
            response.data.on('end', () => resolve(Buffer.concat(chunks)));
            response.data.on('error', (err: Error) => reject(err));
        });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 404) {
                throw new Error(`File not found (404): ${url}`);
            } else if (error.code === 'ECONNABORTED') {
                throw new Error(`Request timed out: ${url}`);
            } else if (error.response) {
                throw new Error(`HTTP error ${error.response.status}: ${error.message}`);
            } else if (error.request) {
                throw new Error(`Network error: ${error.message}`);
            }
        }
        throw error;
    }
}

export async function POST(req: Request) {
    const logs: string[] = [];
    const errors: string[] = [];
    
    try {
        const { selectedDocs } = await req.json() as { selectedDocs: SelectedDocs };
        logs.push('Starting bulk download process...');

        logs.push('Connecting to database...');
        const pool = new sql.ConnectionPool(mssqlConfig);
        await pool.connect();
        
        const result = await pool.request()
            .input('MemberID', sql.Int, 84)
            .query<ReportRecord>('SELECT * FROM dbo.cr_Reports_External WHERE MemberID = @MemberID');

        logs.push(`Found ${result.recordset.length} companies to process`);
        const zip = new JSZip();
        let totalFiles = 0;
        let successfulFiles = 0;

        // Create separate folders for PDFs and Excel/CSV files
        const pdfFolder = zip.folder('PDFs');
        const excelFolder = zip.folder('Excel_CSV');
        
        if (!pdfFolder || !excelFolder) {
            throw new Error('Failed to create zip folders');
        }

        for (const report of result.recordset) {
            const companyName = report.CompanyName.replace(/[<>:"\/\\|?*]/g, '');
            logs.push(`Processing company: ${companyName}`);
            
            // Create company folder only for PDFs
            const companyPdfFolder = pdfFolder.folder(companyName);
            if (!companyPdfFolder) continue;

            const documentMap: DocumentMap = {
                // PDF documents
                PAYE_PDF: { url: report.PAYE_Link || '', name: 'PAYE Returns.pdf', isExcel: false },
                NSSF_PDF: { url: report.NSSF_Link || '', name: 'NSSF Returns.pdf', isExcel: false },
                NHIF_PDF: { url: report.NHIF_Link || '', name: 'NHIF Returns.pdf', isExcel: false },
                SHIF_PDF: { url: report.SHIF_Link || '', name: 'SHIF Returns.pdf', isExcel: false },
                Housing_Levy_PDF: { url: report.Housing_Levy_Link || '', name: 'Housing Levy Returns.pdf', isExcel: false },
                NITA_PDF: { url: report.NITA_List || '', name: 'NITA Returns.pdf', isExcel: false },
                // Excel/CSV documents
                PAYE_CSV: { url: report.PAYE_CSV_Link || '', name: `${companyName}_PAYE.csv`, isExcel: true },
                Housing_Levy_CSV: { url: report.Housing_Levy_CSV_Link || '', name: `${companyName}_Housing_Levy.csv`, isExcel: true },
                NSSF_Excel: { url: report.NSSF_Excel_Link || '', name: `${companyName}_NSSF.xlsx`, isExcel: true },
                NHIF_Excel: { url: report.NHIF_Excel_Link || '', name: `${companyName}_NHIF.xlsx`, isExcel: true },
                SHIF_Excel: { url: report.SHIF_Excel_Link || '', name: `${companyName}_SHIF.xlsx`, isExcel: true },
                Payroll_Summary_Excel: { url: report.Payroll_Summary_Excel_Link || '', name: `${companyName}_Payroll_Summary.xlsx`, isExcel: true }
            };

            const downloadPromises = Object.entries(selectedDocs)
                .filter(([docType, isSelected]) => isSelected && documentMap[docType]?.url)
                .map(async ([docType]) => {
                    const docInfo = documentMap[docType];
                    if (!docInfo?.url) return;
                    
                    totalFiles++;
                    try {
                        logs.push(`Downloading ${docInfo.name}...`);
                        const fileData = await downloadFile(docInfo.url);
                        
                        // Place file in appropriate folder
                        if (docInfo.isExcel) {
                            excelFolder.file(docInfo.name, fileData);
                        } else {
                            companyPdfFolder.file(docInfo.name, fileData);
                        }
                        
                        successfulFiles++;
                        logs.push(`[SUCCESS] Downloaded ${docInfo.name}`);
                        
                        // Send progress update through headers
                        const progress = `${successfulFiles}/${totalFiles}`;
                        const progressHeader = new Headers();
                        progressHeader.append('X-Progress', progress);
                        
                    } catch (error) {
                        const errorMessage = `[ERROR] Failed to download ${docInfo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                        errors.push(errorMessage);
                        logs.push(errorMessage);
                    }
                });

            await Promise.all(downloadPromises);
        }

        logs.push(`Download summary: ${successfulFiles}/${totalFiles} files downloaded successfully`);
        logs.push('Generating zip file...');
        const zipContent = await zip.generateAsync({ 
            type: 'arraybuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 5 }
        });

        // Close the connection pool properly
        await pool.close();
        
        logs.push('Process completed');

        // Return response with base64 encoded logs
        return new NextResponse(Buffer.from(zipContent), {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename=bulk_download_${new Date().toISOString().split('T')[0]}.zip`,
                'X-Download-Logs': Buffer.from(JSON.stringify({ logs, errors })).toString('base64'),
                'X-Download-Status': `${successfulFiles}/${totalFiles}`
            }
        });
    } catch (error) {
        const errorMessage = `[ERROR] Error in bulk download: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        logs.push(errorMessage);
        
        return NextResponse.json({ 
            error: 'Failed to process bulk download',
            logs,
            errors
        }, { status: 500 });
    }
}
