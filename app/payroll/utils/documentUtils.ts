import { DocumentType } from '../types';

export interface DocumentInfo {
    type: DocumentType;
    label: string;
    status: 'missing' | 'uploaded';
    path: string | null;
}

export const validateMpesaMessage = (message: string): string => {
    if (!message.trim()) {
        return 'Please enter an MPESA message';
    }
    return '';
};

export const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

export const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/');
};

export const generateFileName = (prefix: string, docType: string, extension: string): string => {
    return `${prefix}-${docType}-${new Date().getTime()}.${extension}`;
};

export const extractDocumentInfo = (path: string): { docType: string; timestamp: string } => {
    const parts = path.split('-');
    return {
        docType: parts[1] || '',
        timestamp: parts[2]?.split('.')[0] || ''
    };
};

export const SUPPORTED_BANKS = [
    { name: 'Equity Bank', logoIdentifiers: ['equity', 'equity bank'] },
    { name: 'KCB Bank', logoIdentifiers: ['kcb', 'kcb bank'] },
    { name: 'Co-operative Bank', logoIdentifiers: ['co-operative', 'cooperative', 'co-op'] },
    { name: 'Standard Chartered', logoIdentifiers: ['standard chartered', 'stanchart'] },
    { name: 'NCBA Bank', logoIdentifiers: ['ncba'] },
    { name: 'Absa Bank', logoIdentifiers: ['absa', 'barclays'] },
] as const;

export const PAYMENT_MODES = {
    MPESA: 'Mpesa',
    BANK: 'Bank Transfer'
} as const;

export type PaymentMode = typeof PAYMENT_MODES[keyof typeof PAYMENT_MODES];

export const determinePaymentMode = (content: string): PaymentMode => {
    const lowerContent = content.toLowerCase();
    // Check for various Mpesa-related terms
    if (lowerContent.includes('mpesa') || 
        lowerContent.includes('pay bill') || 
        lowerContent.includes('paybill')) {
        return PAYMENT_MODES.MPESA;
    }
    return PAYMENT_MODES.BANK;
};

export const validateExtraction = (extraction: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!extraction.amount || isNaN(parseFloat(extraction.amount.replace(/,/g, '')))) {
        errors.push('Invalid amount');
    }
    
    if (!extraction.payment_date || !isValidDate(extraction.payment_date)) {
        errors.push('Invalid payment date');
    }
    
    if (!extraction.payment_mode || !Object.values(PAYMENT_MODES).includes(extraction.payment_mode)) {
        errors.push('Invalid payment mode');
    }
    
    if (extraction.payment_mode === PAYMENT_MODES.BANK && !extraction.bank_name) {
        errors.push('Bank name is required for bank transfers');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

const isValidDate = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
};
