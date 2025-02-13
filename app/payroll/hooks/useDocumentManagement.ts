import { format } from 'date-fns';
import { CompanyPayrollRecord, DocumentType } from '@/types';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export function useDocumentManagement(
    records: CompanyPayrollRecord[],
    setPayrollRecords: (records: CompanyPayrollRecord[]) => void,
    selectedMonthYear: string
) {
    const { toast } = useToast();

    const handleDocumentUpload = async (recordId: string, file: File, documentType: DocumentType): Promise<void> => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) {
                throw new Error('Record not found');
            }

            // First, fetch the current record to get latest document paths
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('documents')
                .eq('id', recordId)
                .single();

            if (fetchError) throw fetchError;

            const fileName = `${documentType}_${record.company.company_name}_${format(new Date(), 'yyyy-MM-dd')}${file.name.substring(file.name.lastIndexOf('.'))}`;
            const filePath = `${selectedMonthYear}/${record.company.company_name}/${fileName}`;

            // Upload file to storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('Payroll-Cycle')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Preserve existing document paths and update the new one
            const updatedDocuments = {
                ...currentRecord.documents,
                [documentType]: uploadData.path
            };

            // Update database record with merged document paths
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    documents: updatedDocuments
                })
                .eq('id', recordId);

            if (updateError) {
                // If database update fails, clean up the uploaded file
                await supabase.storage
                    .from('Payroll-Cycle')
                    .remove([uploadData.path]);
                throw updateError;
            }

            // Update local state
            setPayrollRecords(records.map(r =>
                r.id === recordId ? { ...r, documents: updatedDocuments } : r
            ));

            toast({
                title: 'Success',
                description: 'Document uploaded successfully'
            });
        } catch (error) {
            console.error('Document upload error:', error);
            toast({
                title: 'Error',
                description: 'Failed to upload document',
                variant: 'destructive'
            });
            throw error;
        }
    };

    const handleDocumentDelete = async (recordId: string, documentType: DocumentType): Promise<void> => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) {
                throw new Error('Record not found');
            }

            const documentPath = record.documents[documentType];
            if (!documentPath) {
                throw new Error('Document not found');
            }

            // Delete file from storage
            const { error: deleteError } = await supabase.storage
                .from('Payroll-Cycle')
                .remove([documentPath]);

            if (deleteError) throw deleteError;

            // Update database record
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    documents: {
                        ...record.documents,
                        [documentType]: null
                    }
                })
                .eq('id', recordId);

            if (updateError) throw updateError;

            // Update local state
            setPayrollRecords(records.map(r =>
                r.id === recordId
                    ? {
                        ...r,
                        documents: {
                            ...r.documents,
                            [documentType]: null
                        }
                    }
                    : r
            ));

            toast({
                title: 'Success',
                description: 'Document deleted successfully'
            });
        } catch (error) {
            console.error('Document delete error:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete document',
                variant: 'destructive'
            });
            throw error;
        }
    };

    const handleDownload = async (path: string): Promise<void> => {
        try {
            const { data, error } = await supabase.storage
                .from('Payroll-Cycle')
                .download(path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = path.split('/').pop() || 'document';
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: 'Success',
                description: 'Document downloaded successfully'
            });
        } catch (error) {
            console.error('Document download error:', error);
            toast({
                title: 'Error',
                description: 'Failed to download document',
                variant: 'destructive'
            });
        }
    };

    const handleDownloadAll = async (record: CompanyPayrollRecord): Promise<void> => {
        try {
            const documentsToDownload = Object.entries(record.documents)
                .filter(([key, value]) => key !== 'all_csv' && value !== null);

            if (documentsToDownload.length === 0) {
                toast({
                    title: 'No Documents',
                    description: 'No documents available to download',
                    variant: 'warning'
                });
                return;
            }

            for (const [_, path] of documentsToDownload) {
                if (path) await handleDownload(path);
            }

            toast({
                title: 'Success',
                description: `Successfully downloaded ${documentsToDownload.length} documents`
            });
        } catch (error) {
            console.error('Download all error:', error);
            toast({
                title: 'Error',
                description: 'Failed to download all documents',
                variant: 'destructive'
            });
        }
    };

    const handleDeleteAll = async (record: CompanyPayrollRecord): Promise<void> => {
        try {
            const documentsToDelete = Object.entries(record.documents)
                .filter(([key, value]) => key !== 'all_csv' && value !== null) as [DocumentType, string][];

            if (documentsToDelete.length === 0) {
                toast({
                    title: 'No Documents',
                    description: 'No documents to delete',
                    variant: 'warning'
                });
                return;
            }

            // Delete all files from storage
            await Promise.all(
                documentsToDelete.map(async ([_, path]) => {
                    const { error: deleteError } = await supabase.storage
                        .from('Payroll-Cycle')
                        .remove([path]);
                    if (deleteError) throw deleteError;
                })
            );

            // Update record to clear all documents
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    documents: {
                        paye_csv: null,
                        hslevy_csv: null,
                        shif_exl: null,
                        nssf_exl: null,
                        zip_file_kra: null,
                        all_csv: null
                    }
                })
                .eq('id', record.id);

            if (updateError) throw updateError;

            // Update local state
            setPayrollRecords(records.map(r =>
                r.id === record.id
                    ? {
                        ...r,
                        documents: {
                            paye_csv: null,
                            hslevy_csv: null,
                            shif_exl: null,
                            nssf_exl: null,
                            zip_file_kra: null,
                            all_csv: null
                        }
                    }
                    : r
            ));

            toast({
                title: 'Success',
                description: `Successfully deleted ${documentsToDelete.length} documents`
            });
        } catch (error) {
            console.error('Delete all error:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete documents',
                variant: 'destructive'
            });
        }
    };

    return {
        handleDocumentUpload,
        handleDocumentDelete,
        handleDownload,
        handleDownloadAll,
        handleDeleteAll
    };
}
