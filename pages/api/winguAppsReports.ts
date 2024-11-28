// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import sql from 'mssql';

const config = {
    server: 'sql5061.site4now.net',
    port: 1433,
    database: 'db_a77dbc_waclientrepository',
    user: 'db_a77dbc_waclientrepository_admin',
    password: 'jackesq99',
    MemberID:84,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        try {
            const pool = await sql.connect(config);
            const result = await pool.request().query(`
                SELECT 
                    ID,
                    Month,
                    Year,
                    CompanyID,
                    CompanyName,
                    Payslip_Link,
                    PAYE_Link,
                    PAYE_CSV_Link,
                    NSSF_Link,
                    NSSF_Excel_Link,
                    NHIF_Link,
                    NHIF_Excel_Link,
                    SHIF_Link,
                    SHIF_Excel_Link,
                    Housing_Levy_Link,
                    Housing_Levy_CSV_Link,
                    Payslips_Link,
                    Control_Total_Link,
                    Payroll_Recon_Link,
                    Payroll_Summary_Link,
                    Payroll_Summary_Excel_Link,
                    Bank_List_Link,
                    Cash_List,
                    MPESA_List,
                    NITA_List,
                    pno
                FROM cr_Reports_External
                WHERE MemberID = ${config.MemberID}
                ORDER BY CompanyName, Year DESC, Month DESC
            `);
            await pool.close();
            return res.status(200).json(result.recordset);
        } catch (error) {
            console.error('Database error:', error);
            return res.status(500).json({ message: 'Error connecting to database', error: error.message });
        }
    }
    return res.status(405).json({ message: 'Method not allowed' });
}