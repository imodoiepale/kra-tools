// @ts-nocheck
import { format } from 'date-fns';
import { CompanyPayrollRecord, DocumentType } from '../../types';
import { supabase } from '@/lib/supabase';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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

/**
 * Get file extension from a path
 * @param {string} path - File path
 * @returns {string} File extension
 */
export const getFileExtension = (path: string): string => {
    if (!path) return '';
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

/**
 * Get document type label
 * @param {DocumentType} docType - Document type
 * @returns {string} Document type label
 */
export const getDocumentTypeLabel = (docType: DocumentType): string => {
    const labels: Record<DocumentType, string> = {
        'paye_csv': 'PAYE Returns',
        'hslevy_csv': 'Housing Levy Returns',
        'zip_file_kra': 'KRA ZIP File',
        'shif_exl': 'SHIF Returns',
        'nssf_exl': 'NSSF Returns',
        'all_csv': 'All CSV Files'
    };
    return labels[docType] || docType;
};

/**
 * Sanitize filename to be safe for file systems
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export const sanitizeFilename = (filename: string): string => {
    return filename.replace(/[/\\?%*:|"<>]/g, '_');
};

/**
 * Downloads a file from Supabase storage
 * @param {string} path - File path in storage
 * @returns {Promise<Blob>} File blob
 */
export const downloadFileFromStorage = async (path: string): Promise<Blob> => {
    if (!path) throw new Error('Invalid file path');

    // Try with 'documents' bucket first
    try {
        const { data, error } = await supabase.storage
            .from('Payroll-Cycle')
            .download(path);

        if (error) {
            console.error('Error downloading file from documents bucket:', error);
            // Don't throw here, try the fallback bucket
        } else if (data) {
            return data;
        }
    } catch (err) {
        console.error('Exception downloading from documents bucket:', err);
        // Continue to fallback bucket
    }

    // Fallback to 'payroll-documents' bucket
    try {
        const { data, error } = await supabase.storage
            .from('Payroll-Cycle')
            .download(path);

        if (error) {
            console.error('Error downloading file from payroll-documents bucket:', error);
            throw new Error(`Failed to download file: ${error.message || JSON.stringify(error)}`);
        }

        if (!data) {
            throw new Error('No data received from storage');
        }

        return data;
    } catch (err) {
        console.error('Exception downloading from payroll-documents bucket:', err);
        throw new Error(`Failed to download file: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    }
};

/**
 * Prepares and exports documents based on configuration
 * @param {Object} config - Export configuration
 * @param {string} config.name - Name for the export
 * @param {DocumentType[]} config.documentTypes - Document types to export
 * @param {CompanyPayrollRecord[]} config.records - Records to export documents from
 * @param {Function} config.onProgress - Progress callback
 * @param {Function} config.onSuccess - Success callback
 * @param {Function} config.onError - Error callback
 * @returns {Promise<void>}
 */
export const exportDocuments = async ({
    name,
    documentTypes,
    records,
    onProgress,
    onSuccess,
    onError
}: {
    name: string;
    documentTypes: DocumentType[];
    records: CompanyPayrollRecord[];
    onProgress?: (progress: number, total: number) => void;
    onSuccess?: (count: number) => void;
    onError?: (error: Error) => void;
}): Promise<void> => {
    try {
        // Filter records to only include those with documents
        const recordsWithDocuments = records.filter(record =>
            documentTypes.some(docType => record.documents[docType])
        );

        // Count total documents that will be exported
        let documentCount = 0;
        const documentsToExport: Array<{
            recordId: string;
            companyName: string;
            docType: DocumentType;
            path: string;
        }> = [];

        recordsWithDocuments.forEach(record => {
            documentTypes.forEach(docType => {
                if (record.documents[docType]) {
                    documentCount++;
                    documentsToExport.push({
                        recordId: record.id,
                        companyName: record.company?.company_name || 'Unknown',
                        docType,
                        path: record.documents[docType]
                    });
                }
            });
        });

        if (documentCount === 0) {
            throw new Error("No documents match the selected criteria");
        }

        // Create a new ZIP file
        const zip = new JSZip();
        let processedCount = 0;

        // Process each document
        for (const doc of documentsToExport) {
            try {
                // Download the file from Supabase storage
                const fileBlob = await downloadFileFromStorage(doc.path);

                // Get file extension
                const fileExtension = getFileExtension(doc.path);

                // Create a sanitized filename
                const sanitizedCompanyName = sanitizeFilename(doc.companyName);
                const docTypeLabel = getDocumentTypeLabel(doc.docType);
                const filename = `${sanitizedCompanyName}_${docTypeLabel}.${fileExtension}`;

                // Add file to ZIP
                zip.file(filename, fileBlob);

                // Update progress
                processedCount++;
                if (onProgress) {
                    onProgress(processedCount, documentCount);
                }
            } catch (err) {
                console.error(`Error processing document: ${doc.path}`, err);
                // Continue with other documents even if one fails
            }
        }

        // Generate the ZIP file
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // Save the ZIP file
        saveAs(zipBlob, `${name}.zip`);

        if (onSuccess) {
            onSuccess(processedCount);
        }
    } catch (error) {
        console.error('Export error:', error);
        if (onError) {
            onError(error instanceof Error ? error : new Error(String(error)));
        }
    }
};
