import ExcelJS from 'exceljs';
import * as fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

// Helper function for VBS script execution
async function executeVBScript(filePath, action = 'remove', uniqueId) {
    const vbsScript = `
    On Error Resume Next
    Set excel = CreateObject("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False
    excel.EnableEvents = False
    excel.ScreenUpdating = False
    excel.AutomationSecurity = 4

    Set wb = excel.Workbooks.Open("${filePath}")

    If "${action}" = "remove" Then
        wb.Unprotect "P@ssw0rd"
        For Each ws In wb.Worksheets
            ws.Unprotect "P@ssw0rd"
            ws.ProtectContents = False
            ws.ProtectDrawingObjects = False
            ws.ProtectScenarios = False
            ws.EnableSelection = xlNoRestrictions
        Next
    Else
        For Each ws In wb.Worksheets
            ws.Protect "P@ssw0rd", True, True, True, True
        Next
        wb.Protect "P@ssw0rd"
    End If

    wb.Save
    wb.Close True
    excel.Quit

    Set ws = Nothing
    Set wb = Nothing
    Set excel = Nothing
    `.replace(/\n/g, '\r\n');

    const vbsPath = path.join(process.cwd(), `${action}_protection_${uniqueId}.vbs`);

    try {
        fs.writeFileSync(vbsPath, vbsScript);
        await execPromise(`cscript //NoLogo "${vbsPath}"`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for Excel to close

        // Clean up VBS file
        for (let i = 0; i < 3; i++) {
            try {
                fs.unlinkSync(vbsPath);
                break;
            } catch (err) {
                if (i === 2) console.warn(`Could not delete VBS file: ${vbsPath}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`Successfully ${action}d protection for ${path.basename(filePath)}`);
    } catch (error) {
        console.error(`Error in VBS execution:`, error);
        throw error;
    }
}

// Helper function to read and parse PAYE data
async function readPayeData(filePath) {
    try {
        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        return fileContent.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                    EmployeePIN: parts[0],
                    EmployeeName: parts.slice(1, 4).join(' '),
                    ResidentStatus: parts[4],
                    EmployeeType: parts.slice(5, 7).join(' '),
                    BasicSalary: parseFloat(parts[7]) || 0,
                    HouseAllowance: parseFloat(parts[8]) || 0,
                    TransportAllowance: parseFloat(parts[9]) || 0,
                    LeaveAllowance: parseFloat(parts[10]) || 0,
                    OtherAllowance: parseFloat(parts[11]) || 0,
                    DirectorsFees: parseFloat(parts[12]) || 0,
                    Lumpsum: parseFloat(parts[13]) || 0,
                    OtherPayments: parseFloat(parts[14]) || 0,
                    ValueOfQuarters: parseFloat(parts[15]) || 0,
                    OwnerOccupiedInterest: parseFloat(parts[16]) || 0,
                    AgricultureBenefit: parseFloat(parts[17]) || 0,
                    TypeOfHousing: parts[18] === 'Benefit' ? 'Benefit not given' : parts[18],
                    RentOfHouse: parseFloat(parts[19]) || 0,
                    ComputedRent: parseFloat(parts[20]) || 0,
                    PersonalRelief: parseFloat(parts[21]) || 0,
                    InsuranceRelief: parseFloat(parts[22]) || 0,
                    PAYE: parseFloat(parts[23]) || 0
                };
            });
    } catch (error) {
        console.error(`Error reading PAYE data:`, error);
        throw error;
    }
}

// Main processing function for a single PAYE file
async function processPAYEFile(payeFilePath, templatePath) {
    let tempFilePath = null;
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    try {
        console.log(`\nProcessing: ${path.basename(payeFilePath)}`);

        // Validate input files
        if (!fs.existsSync(payeFilePath)) throw new Error(`PAYE file not found: ${payeFilePath}`);
        if (!fs.existsSync(templatePath)) throw new Error(`Template file not found: ${templatePath}`);

        // Create temp file
        const companyName = path.basename(payeFilePath).replace(' - PAYE.csv', '');
        tempFilePath = path.join(path.dirname(payeFilePath), `${companyName}_${uniqueId}_temp.xlsm`);

        // Copy template with retry logic
        for (let i = 0; i < 3; i++) {
            try {
                await fs.promises.copyFile(templatePath, tempFilePath);
                await new Promise(resolve => setTimeout(resolve, 1000));
                break;
            } catch (error) {
                if (i === 2) throw new Error(`Failed to copy template file: ${error.message}`);
            }
        }

        // Remove protection
        await executeVBScript(tempFilePath, 'remove', uniqueId);

        // Read and process PAYE data
        const payeData = await readPayeData(payeFilePath);

        // Load workbook
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(tempFilePath, { keepVBA: true });
        const worksheet = workbook.getWorksheet('B_Employees_Dtls');

        // Find start row
        let startRow = 1;
        worksheet.eachRow((row, rowNumber) => {
            if (row.getCell(1).value === 'DtlsSalPdBftsPayeDedFrmEmp.List') {
                startRow = rowNumber;
                return false;
            }
        });

        // Populate data
        console.log('Populating data...');
        const columnMap = {
            EmployeePIN: 'A', EmployeeName: 'B', ResidentStatus: 'C',
            EmployeeType: 'D', BasicSalary: 'E', HouseAllowance: 'F',
            TransportAllowance: 'G', LeaveAllowance: 'H', OtherAllowance: 'I',
            DirectorsFees: 'J', Lumpsum: 'K', OtherPayments: 'L',
            ValueOfQuarters: 'N', OwnerOccupiedInterest: 'O',
            AgricultureBenefit: 'P', TypeOfHousing: 'R',
            RentOfHouse: 'S', ComputedRent: 'T',
            PersonalRelief: 'AA', InsuranceRelief: 'AB', PAYE: 'AC'
        };

        payeData.forEach((row, index) => {
            const currentRow = startRow + index;
            Object.entries(row).forEach(([key, value]) => {
                if (columnMap[key]) {
                    worksheet.getCell(`${columnMap[key]}${currentRow}`).value = value;
                }
            });
        });

        // Save workbook
        const outputFileName = `${companyName} - Populated.xlsm`;
        const outputPath = path.join(path.dirname(payeFilePath), outputFileName);

        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        await workbook.xlsx.writeFile(tempFilePath, {
            keepVBA: true,
            zip: { compression: 'DEFLATE' }
        });

        // Reapply protection
        await executeVBScript(tempFilePath, 'add', uniqueId);

        // Rename to final output file
        fs.renameSync(tempFilePath, outputPath);
        console.log(`Successfully processed: ${outputFileName}`);
        return outputPath;

    } catch (error) {
        console.error(`Error processing file: ${error.message}`);
        throw error;
    } finally {
        // Cleanup
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (e) {
                console.warn('Warning: Failed to delete temp file:', e.message);
            }
        }
    }
}

// Main function to process all PAYE files
async function processPAYEFiles(sourceFolder, templatePath) {
    try {
        console.log('\n=== Starting PAYE Files Processing ===');

        // Validate folders
        if (!fs.existsSync(sourceFolder)) throw new Error(`Source folder not found: ${sourceFolder}`);
        if (!fs.existsSync(templatePath)) throw new Error(`Template file not found: ${templatePath}`);

        // Get PAYE files
        const files = fs.readdirSync(sourceFolder)
            .filter(file => file.toLowerCase().includes('paye') && file.endsWith('.csv'));

        console.log(`Found ${files.length} PAYE CSV files to process`);

        // Process files
        const results = await Promise.allSettled(
            files.map(file => {
                const filePath = path.join(sourceFolder, file);
                return processPAYEFile(filePath, templatePath);
            })
        );

        // Report results
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`\n=== Processing Complete ===`);
        console.log(`Successfully processed: ${successful}`);
        console.log(`Failed: ${failed}`);

    } catch (error) {
        console.error('Error in main process:', error);
        throw error;
    }
}

// Configuration
const config = {
    sourceFolder: 'C:\\Users\\DELL\\Downloads\\Payroll November - 2024-11-04',
    templatePath: 'C:\\Users\\DELL\\Desktop\\bcl-portal-2024\\kra-tools\\app\\winguapps\\PAYE_Template.xlsm'
};

// Execute
console.log('Starting PAYE processing...');
processPAYEFiles(config.sourceFolder, config.templatePath)
    .then(() => {
        console.log('Processing completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Processing failed:', error);
        process.exit(1);
    });