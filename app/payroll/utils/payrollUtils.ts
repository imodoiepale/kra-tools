import { format } from 'date-fns';
import { CompanyPayrollRecord, DocumentType } from '@/types';

export const formatDate = (date: string | null | undefined): string => {
    if (!date) return 'NIL';
    if (date === 'NIL') return `${format(new Date(), 'dd/MM/yyyy')}`;
    try {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) return 'Invalid Date';
        return format(parsedDate, 'dd/MM/yyyy');
    } catch {
        return 'Invalid Date';
    }
};

export const getDocumentsForUpload = (
    record: CompanyPayrollRecord,
    documentLabels: Record<string, string>
) => {
    return Object.entries(documentLabels)
        .filter(([key]) => key !== 'all_csv')
        .map(([type, label]) => ({
            type: type as DocumentType,
            label,
            status: record.documents[type as DocumentType] ? 'uploaded' as const : 'missing' as const,
            path: record.documents[type as DocumentType]
        }));
};

export const getDocumentCount = (record: CompanyPayrollRecord): string => {
    if (record.status.finalization_date === 'NIL') {
        return 'N/A';
    }
    const totalDocs = Object.keys(record.documents).length - 1; // Exclude all_csv
    const uploadedDocs = Object.entries(record.documents)
        .filter(([key, value]) => key !== 'all_csv' && value !== null)
        .length;
    return `${uploadedDocs}/${totalDocs}`;
};

export const allDocumentsUploaded = (record: CompanyPayrollRecord | undefined): boolean => {
    if (!record) return false;
    return Object.entries(record.documents)
        .filter(([key]) => key !== 'all_csv')
        .every(([_, value]) => value !== null);
};

export const truncateCompanyName = (name: string, maxWords: number = 3): string => {
    return name.split(" ").slice(0, maxWords).join(" ");
};

export const getDocumentStatus = (record: CompanyPayrollRecord): {
    status: 'complete' | 'incomplete' | 'nil';
    message: string;
} => {
    if (record.status.finalization_date === 'NIL') {
        return { status: 'nil', message: 'NIL Filing' };
    }

    const isComplete = allDocumentsUploaded(record);
    return {
        status: isComplete ? 'complete' : 'incomplete',
        message: isComplete ? 'All Documents Uploaded' : 'Missing Documents'
    };
};

export const sortRecordsByCompanyName = (records: CompanyPayrollRecord[]): CompanyPayrollRecord[] => {
    return [...records].sort((a, b) =>
        a.company.company_name.localeCompare(b.company.company_name)
    );
};
