import { Template } from '@pdfme/common';
import { generate } from '@pdfme/generator';
import { text } from '@pdfme/schemas';

interface MpesaReceiptData {
    message: string;
    fileName: string;
    receiptName: string;
}

export const formatMpesaMessage = (message: string): { formatted: string; original: string } => {
    // Just clean up the message a bit but preserve the original content
    const cleanedMessage = message.trim();
    
    return {
        formatted: cleanedMessage,
        original: message
    };
};

export const mpesaMessageToPdf = async ({ message, fileName, receiptName }: MpesaReceiptData): Promise<Uint8Array> => {
    try {
        // Get the original message content
        const { formatted } = formatMpesaMessage(message);
        
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
                        name: 'documentType',
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

        // Parse the receiptName to extract company name and document type
        // Use a default value if company name is missing or undefined
        let companyName = 'Company';
        let documentType = 'PAYE Payment';
        
        if (receiptName && receiptName !== 'undefined') {
            const parts = receiptName.split(' - ');
            if (parts.length >= 1 && parts[0] && parts[0] !== 'undefined') {
                companyName = parts[0];
            }
            if (parts.length >= 2 && parts[1] && parts[1] !== 'undefined') {
                documentType = parts[1];
            }
        }

        const inputs = [{
            title: companyName,
            documentType: documentType,
            message: formatted, // Use the original message content
            fileInfo: `File: ${fileName} | Generated: ${new Date().toLocaleString()}`,
        }];

        const plugins = {
            text
        };

        // Generate the PDF
        const pdfData = await generate({ template, inputs, plugins });
        return pdfData;
    } catch (error) {
        console.error('Error generating PDF from MPESA message:', error);
        throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};