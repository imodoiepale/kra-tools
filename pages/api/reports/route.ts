// src/app/api/reports/route.ts
import { NextResponse } from 'next/server';
import { fetchAllReports, fetchReportsByCompany, fetchReportsByDate, fetchLatestReports } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const companyId = searchParams.get('companyId');
        const month = searchParams.get('month');
        const year = searchParams.get('year');
        const latest = searchParams.get('latest');

        let data;

        if (latest === 'true') {
            data = await fetchLatestReports();
        } else if (companyId) {
            data = await fetchReportsByCompany(parseInt(companyId));
        } else if (month && year) {
            data = await fetchReportsByDate(parseInt(month), parseInt(year));
        } else {
            data = await fetchAllReports();
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}