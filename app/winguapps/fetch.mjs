"use server"
import sql from 'mssql';

// MSSQL Configuration
const mssqlConfig = {
    user: 'db_a77dbc_waclientrepository_admin',
    password: 'jackesq99',
    server: 'sql5061.site4now.net',
    port: 1433, // Default port for MSSQL
    database: 'db_a77dbc_waclientrepository',
    options: {
        encrypt: true, // Use this for secure connections
        trustServerCertificate: true, // Use this for local/self-signed certificates
    },
};

// Fetch Data from MSSQL
export async function fetchReports() {
    try {
        const pool = await sql.connect(mssqlConfig); // Connect to MSSQL
        const result = await pool.request()
            .input('MemberID', sql.Int, 84)
            .query('SELECT * FROM dbo.cr_Reports_External WHERE MemberID = @MemberID'); // Query with filter
          const filteredData = result.recordset.map(report => ({
              CompanyName: report.CompanyName,
            //   Month: 12,
              PAYE_CSV_Link: report.PAYE_CSV_Link,
              NSSF_Excel_Link: report.NSSF_Excel_Link,
              NHIF_Excel_Link: report.NHIF_Excel_Link,
              SHIF_Excel_Link: report.SHIF_Excel_Link,
              Housing_Levy_CSV_Link: report.Housing_Levy_CSV_Link,
          }));
        console.log('Filtered Reports:', filteredData); // For debugging
    } catch (error) {
        console.error('Error fetching reports:', error);
    } finally {
        sql.close(); // Close the connection
    }
}

fetchReports()