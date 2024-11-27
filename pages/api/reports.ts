import { NextApiRequest, NextApiResponse } from 'next';
import sql from 'mssql';
import { sqlConfig } from '@/app/winguapps/config/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const pool = await sql.connect(sqlConfig);
        const result = await pool.request().query(`
      SELECT * FROM dbo.cr_Reports_External 
      ORDER BY CompanyName, Year DESC, Month DESC
    `);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reports' });
    } finally {
        await sql.close();
    }
}
