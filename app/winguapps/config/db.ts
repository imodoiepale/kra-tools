// src/lib/db.ts
import sql from 'mssql';

// Database configuration
export const sqlConfig = {
    user: process.env.MSSQL_USER || 'db_a77dbc_waclientrepository_admin',
    password: process.env.MSSQL_PASSWORD || 'jackesq99',
    server: process.env.MSSQL_SERVER || 'sql5061.site4now.net',
    port: parseInt(process.env.MSSQL_PORT || '1433'),
    database: process.env.MSSQL_DATABASE || 'db_a77dbc_waclientrepository',
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};

// Database connection pool
class Database {
    private static pool: sql.ConnectionPool | null = null;

    static async getConnection(): Promise<sql.ConnectionPool> {
        try {
            if (this.pool) {
                return this.pool;
            }

            this.pool = await new sql.ConnectionPool(sqlConfig).connect();
            console.log('Connected to MSSQL');
            return this.pool;
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }

    static async query<T>(query: string, params?: any[]): Promise<T[]> {
        try {
            const pool = await this.getConnection();
            const request = pool.request();

            if (params) {
                params.forEach((param, index) => {
                    request.input(`param${index}`, param);
                });
            }

            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            console.error('Query execution error:', error);
            throw error;
        }
    }
}

// API Routes
export async function fetchAllReports() {
    const query = `
        SELECT * 
        FROM dbo.cr_Reports_External 
        ORDER BY CompanyName, Year DESC, Month DESC
    `;
    return Database.query(query);
}

export async function fetchReportsByCompany(companyId: number) {
    const query = `
        SELECT * 
        FROM dbo.cr_Reports_External 
        WHERE CompanyID = @param0
        ORDER BY Year DESC, Month DESC
    `;
    return Database.query(query, [companyId]);
}

export async function fetchReportsByDate(month: number, year: number) {
    const query = `
        SELECT * 
        FROM dbo.cr_Reports_External 
        WHERE Month = @param0 AND Year = @param1
        ORDER BY CompanyName
    `;
    return Database.query(query, [month, year]);
}

export async function fetchLatestReports() {
    const query = `
        WITH RankedReports AS (
            SELECT *,
                ROW_NUMBER() OVER (
                    PARTITION BY CompanyID 
                    ORDER BY Year DESC, Month DESC
                ) as rn
            FROM dbo.cr_Reports_External
        )
        SELECT * 
        FROM RankedReports 
        WHERE rn = 1
        ORDER BY CompanyName
    `;
    return Database.query(query);
}

export default Database;