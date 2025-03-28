import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { parse } from 'papaparse';

export async function GET(req: NextRequest) {
    try {
        const url = req.nextUrl.searchParams.get('url');
        const type = req.nextUrl.searchParams.get('type');

        if (!url || !type) {
            return NextResponse.json({ error: 'Missing url or type parameter' }, { status: 400 });
        }

        const response = await fetch(url);
        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
        }

        switch (type.toLowerCase()) {
            case 'pdf':
                // Stream the PDF directly
                const pdfBuffer = await response.arrayBuffer();
                return new NextResponse(pdfBuffer, {
                    headers: {
                        'Content-Type': 'application/pdf',
                    },
                });

            case 'excel': {
                const buffer = await response.arrayBuffer();
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                
                const worksheet = workbook.worksheets[0];
                const headers: string[] = [];
                const data: any[][] = [];

                // Get headers
                worksheet.getRow(1).eachCell((cell) => {
                    headers.push(cell.value?.toString() || '');
                });

                // Get data
                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return; // Skip header row
                    const rowData: any[] = [];
                    row.eachCell((cell) => {
                        rowData.push(cell.value?.toString() || '');
                    });
                    data.push(rowData);
                });

                return NextResponse.json({
                    headers,
                    data
                });
            }

            case 'csv': {
                const text = await response.text();
                const { data } = parse(text, { header: false });
                
                return NextResponse.json({
                    headers: data[0],
                    data: data.slice(1)
                });
            }

            default:
                return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
        }
    } catch (error) {
        console.error('Error processing document:', error);
        return NextResponse.json({ error: 'Failed to process document' }, { status: 500 });
    }
}
