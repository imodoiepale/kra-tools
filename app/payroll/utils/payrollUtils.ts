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
    switch (docType) {
        case 'paye_csv':
            return 'PAYE Returns';
        case 'hslevy_csv':
            return 'Housing Levy Returns';
        case 'zip_file_kra':
            return 'KRA ZIP File';
        case 'shif_exl':
            return 'SHIF Returns';
        case 'nssf_exl':
            return 'NSSF Returns';
        default:
            return docType;
    }
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
 * @param {Function} config.shouldCancel - Cancellation callback
 * @returns {Promise<void>}
 */
export const exportDocuments = async ({
    name,
    documentTypes,
    records,
    onProgress,
    onSuccess,
    onError,
    shouldCancel
}: {
    name: string;
    documentTypes: DocumentType[];
    records: CompanyPayrollRecord[];
    onProgress?: (progress: number, total: number) => void;
    onSuccess?: (count: number) => void;
    onError?: (error: Error) => void;
    shouldCancel?: () => boolean;
}): Promise<void> => {
    try {
        console.log("Export started with document types:", documentTypes);

        if (!documentTypes || documentTypes.length === 0) {
            throw new Error("No document types specified for export");
        }

        // Filter records to only include those with documents of the selected types
        const recordsWithDocuments = records.filter(record =>
            documentTypes.some(docType => record.documents && record.documents[docType])
        );

        console.log("Records with documents:", recordsWithDocuments.length);

        // Count total documents that will be exported
        let documentCount = 0;
        const documentsToExport: Array<{
            recordId: string;
            companyName: string;
            docType: DocumentType;
            path: string;
        }> = [];

        recordsWithDocuments.forEach(record => {
            // Only include documents of the selected types
            documentTypes.forEach(docType => {
                if (record.documents && record.documents[docType]) {
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

        console.log("Documents to export:", documentsToExport.length, "of types:", documentTypes);

        if (documentCount === 0) {
            throw new Error("No documents match the selected criteria");
        }

        // Create a new ZIP file
        const zip = new JSZip();
        let processedCount = 0;
        let errorCount = 0;

        // Define batch size for parallel processing
        const BATCH_SIZE = 5;
        const batches = [];

        // Split documents into batches
        for (let i = 0; i < documentsToExport.length; i += BATCH_SIZE) {
            batches.push(documentsToExport.slice(i, i + BATCH_SIZE));
        }

        // Process each batch in sequence
        for (const batch of batches) {
            // Check for cancellation
            if (shouldCancel && shouldCancel()) {
                console.log("Export cancelled by user");
                throw new Error("Export cancelled by user");
            }

            // Process documents in parallel within each batch
            const batchPromises = batch.map(async (doc) => {
                try {
                    // Download the file from Supabase storage
                    const fileBlob = await downloadFileFromStorage(doc.path);

                    // Get file extension
                    const fileExtension = getFileExtension(doc.path);

                    // Create a sanitized filename
                    const sanitizedCompanyName = sanitizeFilename(doc.companyName);
                    const docTypeLabel = getDocumentTypeLabel(doc.docType);
                    const filename = `${sanitizedCompanyName}_${docTypeLabel}.${fileExtension}`;

                    return {
                        success: true,
                        filename,
                        fileBlob,
                        error: null
                    };
                } catch (err) {
                    errorCount++;
                    console.error(`Error processing document: ${doc.path}`, err);
                    return {
                        success: false,
                        filename: null,
                        fileBlob: null,
                        error: err
                    };
                }
            });

            // Wait for all downloads in the batch to complete
            const results = await Promise.all(batchPromises);

            // Add successful downloads to the ZIP file
            results.forEach(result => {
                if (result.success && result.filename && result.fileBlob) {
                    zip.file(result.filename, result.fileBlob);
                }

                // Update progress
                processedCount++;
                if (onProgress) {
                    onProgress(processedCount, documentCount);
                }
            });

            // Check for cancellation after each batch
            if (shouldCancel && shouldCancel()) {
                console.log("Export cancelled by user");
                throw new Error("Export cancelled by user");
            }
        }

        // Generate the ZIP file
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // Check for cancellation before saving
        if (shouldCancel && shouldCancel()) {
            console.log("Export cancelled by user");
            throw new Error("Export cancelled by user");
        }

        // Save the ZIP file
        saveAs(zipBlob, `${name}.zip`);

        const successCount = processedCount - errorCount;

        if (onSuccess) {
            onSuccess(successCount);
        }

        // If there were errors but some documents were processed, notify the user
        if (errorCount > 0 && successCount > 0) {
            console.warn(`Exported ${successCount} documents, but ${errorCount} failed to export.`);
        }
    } catch (error) {
        console.error('Export error:', error);
        if (onError) {
            onError(error instanceof Error ? error : new Error(String(error)));
        }
    }
};
