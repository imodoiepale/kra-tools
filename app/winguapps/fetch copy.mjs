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

// Fetch Data from MSSQL based on MemberID (returning raw results)
export async function fetchReportsByMemberID() {
    try {
        const pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .input('MemberID', sql.Int, 84) // MemberID is hardcoded as 84
            .query('SELECT * FROM dbo.cr_Reports_External WHERE MemberID = @MemberID');

        console.log('Raw Reports:', result.recordset); // Logging the raw recordset
        return result.recordset; // Returning the raw recordset
    } catch (error) {
        console.error('Error fetching reports:', error);
        return []; // Return empty array on error
    } finally {
        sql.close();
    }
}
//You can remove this if you don't need it to call function on server
fetchReportsByMemberID()