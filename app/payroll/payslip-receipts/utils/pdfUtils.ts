import { Template } from '@pdfme/common';
import { generate } from '@pdfme/generator';
import { text } from '@pdfme/schemas';

interface MpesaReceiptData {
    message: string;
    fileName: string;
    receiptName: string;
}

const formatMpesaMessage = (message: string): { formatted: string; original: string } => {
    // Split messages by double newline to separate different payments
    const payments = message.split(/\n\n+/);
    
    const formatted = payments.map(payment => {
        // Extract key information using regex
        const paymentRef = payment.match(/Payment Ref: ([A-Z0-9]+)/)?.[1] || '';
        const slipNo = payment.match(/E-Slip No\. (\d+)/)?.[1] || '';
        const amount = payment.match(/KES ([\d,]+\.\d{2})/)?.[1] || '';
        const date = payment.match(/received on ([\d-]+ \d+:\d+:\d+ [AP]M)/)?.[1] || '';
        const paymentType = payment.match(/\n\n([A-Z\s]+)$/)?.[1]?.trim() || '';

        // Format the payment information
        return `Payment Type: ${paymentType || 'KRA Payment'}
Reference: ${paymentRef}
E-Slip No: ${slipNo}
Amount: KES ${amount}
Date: ${date}
----------------------------------------`;
    }).join('\n\n');

    return {
        formatted,
        original: message
    };
};

export const mpesaMessageToPdf = async ({ message, fileName, receiptName }: MpesaReceiptData): Promise<Uint8Array> => {
    const template: Template = {
        basePdf: { width: 210, height: 297, padding: [5, 5, 5, 5] },
        schemas: [
            [
                {
                    name: 'title',
                    type: 'text',
                    position: { x: 10, y: 5 },
                    width: 190,
                    height: 12,
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: '#1e40af',
                    alignment: 'center',
                    backgroundColor: '#f0f9ff',
                    padding: [2, 2, 2, 2],
                    borderColor: '#bfdbfe',
                    borderWidth: 1,
                },
                {
                    name: 'companyName',
                    type: 'text',
                    position: { x: 10, y: 22 },
                    width: 190,
                    height: 12,
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: '#4b5563',
                    alignment: 'center',
                },
                {
                    name: 'message',
                    type: 'text',
                    position: { x: 20, y: 40 },
                    width: 170,
                    height: 200,
                    fontSize: 11,
                    fontFamily: 'Helvetica',
                    lineHeight: 1.4,
                    padding: [10, 10, 10, 10],
                    backgroundColor: '#f8fafc',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    color: '#4b5563'
                },
                {
                    name: 'fileInfo',
                    type: 'text',
                    position: { x: 20, y: 245 },
                    width: 170,
                    height: 8,
                    fontSize: 8,
                    color: '#94a3b8',
                    alignment: 'center',
                },
            ],
        ],
    };

    const [companyName, documentType] = receiptName.split(' - ');

    const inputs = [{
        title: documentType || 'PAYE Payment',
        companyName: companyName,
        message: message,
        fileInfo: `File: ${fileName} | Generated: ${new Date().toLocaleString()}`,
    }];

    const plugins = {
        text
    };

    const pdf = await generate({ template, inputs, plugins });
    return pdf;
};
