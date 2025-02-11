"use server"
import sql from 'mssql';
import ExcelJS from 'exceljs';

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

async function createExcelReport() {
    try {
        const pool = await sql.connect(mssqlConfig);

        // First get all unique companies
        const companiesResult = await pool.request()
            .input('MemberID', sql.Int, 84)
            .query('SELECT DISTINCT CompanyName FROM dbo.cr_Reports_External WHERE MemberID = @MemberID ORDER BY CompanyName');

        const allCompanies = companiesResult.recordset.map(r => r.CompanyName);

        // Get all document columns
        const result = await pool.request()
            .query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'cr_Reports_External' 
                AND COLUMN_NAME LIKE '%Link'
            `);

        const documentColumns = result.recordset.map(record => record.COLUMN_NAME);

        // Get the data
        const selectClause = `
            SELECT CompanyName, Month, Year, 
            ${documentColumns.join(', ')}
            FROM dbo.cr_Reports_External 
            WHERE MemberID = @MemberID 
            ORDER BY Year, Month, CompanyName
        `;

        const records = await pool.request()
            .input('MemberID', sql.Int, 84)
            .query(selectClause);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Report Generator';
        workbook.created = new Date();

        // Group data by period
        const monthlyReports = {};
        records.recordset.forEach(record => {
            const period = `${record.Month}-${record.Year}`;
            if (!monthlyReports[period]) {
                monthlyReports[period] = {};
            }
            monthlyReports[period][record.CompanyName] = record;
        });

        for (const period in monthlyReports) {
            const worksheet = workbook.addWorksheet(`${period}`);

            // Set up columns starting from B
            worksheet.getColumn('A').width = 5;

            const columns = [
                { header: '#', key: 'index', width: 5 },
                { header: 'Company', key: 'company', width: 40 },
                ...documentColumns.map(col => ({
                    header: col.replace('_Link', '').replace(/_/g, ' '),
                    key: col,
                    width: 20
                }))
            ];

            worksheet.columns = columns;

            // Style the header row (row 1)
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4B0082' }
            };

            headerRow.eachCell((cell, colNumber) => {
                if (colNumber === 2) {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                }
            });

            // Add all companies, marking missing ones with crosses
            allCompanies.forEach((company, index) => {
                const recordForCompany = monthlyReports[period][company];

                const rowData = {
                    index: index + 1,
                    company: company,
                };

                documentColumns.forEach(col => {
                    rowData[col] = recordForCompany ? (recordForCompany[col] ? '✓' : '✗') : '✗';
                });

                const row = worksheet.addRow(rowData);
                row.height = 25;

                row.eachCell((cell, colNumber) => {
                    if (colNumber === 2) {
                        cell.alignment = { vertical: 'middle', horizontal: 'left' };
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                });

                row.font = { size: 11 };

                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: index % 2 === 0 ? 'FFF0F8FF' : 'FFFFFFFF' }
                };

                row.eachCell((cell, colNumber) => {
                    if (cell.value === '✓') {
                        cell.font = { color: { argb: 'FF008000' }, bold: true };
                    } else if (cell.value === '✗') {
                        cell.font = { color: { argb: 'FFFF0000' }, bold: true };
                    }
                });
            });

            // Add borders
            worksheet.eachRow((row, rowNumber) => {
                row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // AutoFit columns
            worksheet.columns.forEach(column => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: true }, cell => {
                    const length = cell.value ? cell.value.toString().length : 0;
                    if (length > maxLength) {
                        maxLength = length;
                    }
                });
                column.width = Math.min(Math.max(maxLength + 2, 10), 50);
            });

            // Freeze panes
            worksheet.views = [
                { state: 'frozen', xSplit: 2, ySplit: 1 }
            ];
        }

        await workbook.xlsx.writeFile('DocumentStatus.xlsx');
        console.log('Excel file has been created successfully!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        sql.close();
    }
}

createExcelReport();