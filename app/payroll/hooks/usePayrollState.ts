// @ts-nocheck
import { useState } from 'react';
import { CompanyPayrollRecord, DocumentType } from '../types';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface PayrollState {
    finalizeDialog: {
        isOpen: boolean;
        recordId: string | null;
        assignedTo: string;
        isNil: boolean;
        record?: CompanyPayrollRecord;
    };
    filingDialog: {
        isOpen: boolean;
        recordId: string | null;
        isNil: boolean;
        confirmOpen: boolean;
        record?: CompanyPayrollRecord;
    };
    documentDetailsDialog: {
        isOpen: boolean;
        record: CompanyPayrollRecord | null;
    };
    deleteAllDialog: {
        isOpen: boolean;
        record: CompanyPayrollRecord | null;
    };
}

export const usePayrollState = (
    records: CompanyPayrollRecord[],
    setRecords: React.Dispatch<React.SetStateAction<CompanyPayrollRecord[]>>,
    toast: toast
) => {
    const [state, setState] = useState<PayrollState>({
        finalizeDialog: {
            isOpen: false,
            recordId: null,
            assignedTo: '',
            isNil: false,
        },
        filingDialog: {
            isOpen: false,
            recordId: null,
            isNil: false,
            confirmOpen: false,
        },
        documentDetailsDialog: {
            isOpen: false,
            record: null,
        },
        deleteAllDialog: {
            isOpen: false,
            record: null,
        },
    });

    const handleFinalize = async (recordId: string, isNil: boolean, assignedTo: string, finalizationDate?: Date) => {
        try {
            // First, check if this is a temporary record
            const record = records.find(r => r.id === recordId);
            if (!record) {
                throw new Error('Record not found');
            }

            // If this is a temporary record (starts with "temp_"), create a real record first
            let realRecordId = recordId;
            if (recordId.startsWith('temp_')) {
                // Extract the company_id from the temporary ID or use it directly from the record
                const companyId = record.company_id;

                // Check if a record with the same company_id and payroll_cycle_id already exists
                const { data: existingRecords, error: fetchError } = await supabase
                    .from('company_payroll_records')
                    .select('id')
                    .eq('company_id', companyId)
                    .eq('payroll_cycle_id', record.payroll_cycle_id);
                
                if (fetchError) throw fetchError;
                
                // If a record already exists, use that instead of creating a new one
                if (existingRecords && existingRecords.length > 0) {
                    realRecordId = existingRecords[0].id;
                } else {
                    // Create a new real record in the database
                    const { data: newRecord, error: insertError } = await supabase
                        .from('company_payroll_records')
                        .insert([
                            {
                                company_id: companyId,
                                payroll_cycle_id: record.payroll_cycle_id,
                                documents: {},
                                status: {
                                    finalization_date: null,
                                    assigned_to: null,
                                    filing: null
                                },
                                number_of_employees: 0
                            }
                        ])
                        .select()
                        .single();

                    if (insertError) throw insertError;
                    realRecordId = newRecord.id;
                }
            }

            // Use the provided finalization date or create a new one
            const currentDate = finalizationDate ? finalizationDate.toISOString() : new Date().toISOString();
            
            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    status: {
                        ...record.status,
                        finalization_date: isNil ? 'NIL' : currentDate,
                        assigned_to: assignedTo
                    }
                })
                .eq('id', realRecordId);

            if (error) throw error;

            // Update the records state to reflect changes
            setRecords(prevRecords =>
                prevRecords.map(r =>
                    r.id === recordId
                        ? {
                            ...r,
                            id: realRecordId, // Update the ID if it was temporary
                            is_temporary: false,
                            status: {
                                ...r.status,
                                finalization_date: isNil ? 'NIL' : currentDate,
                                assigned_to: assignedTo
                            }
                        }
                        : r
                )
            );

            // Close the dialog
            setState(prev => ({
                ...prev,
                finalizeDialog: {
                    ...prev.finalizeDialog,
                    isOpen: false,
                    recordId: null,
                    assignedTo: '',
                    isNil: false
                }
            }));

            toast({
                title: 'Success',
                description: 'Record finalized successfully'
            });
        } catch (error) {
            console.error('Finalization error:', error);
            toast({
                title: 'Error',
                description: 'Failed to finalize record',
                variant: 'destructive'
            });
            throw error;
        }
    };

    const handleRevertFinalize = async (recordId: string) => {
        try {
            // Only proceed if this is a real record (not temporary)
            if (recordId.startsWith('temp_')) {
                toast({
                    title: 'Error',
                    description: 'Cannot revert a record that has not been finalized',
                    variant: 'destructive'
                });
                return;
            }

            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    status: {
                        finalization_date: null,
                        assigned_to: null,
                        filing: null
                    }
                })
                .eq('id', recordId);

            if (error) throw error;

            // Update records state
            setRecords(prevRecords =>
                prevRecords.map(r =>
                    r.id === recordId
                        ? {
                            ...r,
                            status: {
                                finalization_date: null,
                                assigned_to: null,
                                filing: null
                            }
                        }
                        : r
                )
            );

            toast({
                title: 'Success',
                description: 'Finalization reverted successfully'
            });

            // Close dialog if open
            setState(prev => ({
                ...prev,
                finalizeDialog: {
                    ...prev.finalizeDialog,
                    isOpen: false
                },
                documentDetailsDialog: {
                    ...prev.documentDetailsDialog,
                    isOpen: false
                }
            }));
        } catch (error) {
            console.error('Revert error:', error);
            toast({
                title: 'Error',
                description: 'Failed to revert finalization',
                variant: 'destructive'
            });
        }
    };

    const handleFilingConfirm = async (recordId: string, date: Date) => {
        try {
            // First, check if this is a temporary record
            const record = records.find(r => r.id === recordId);
            if (!record) {
                throw new Error('Record not found');
            }

            // Ensure we have a valid date
            if (!date || isNaN(date.getTime())) {
                date = new Date(); // Default to current date if invalid
            }

            // If this is a temporary record, create a real record first
            let realRecordId = recordId;
            if (recordId.startsWith('temp_')) {
                // Check if a record with the same company_id and payroll_cycle_id already exists
                const { data: existingRecords, error: fetchError } = await supabase
                    .from('company_payroll_records')
                    .select('id')
                    .eq('company_id', record.company_id)
                    .eq('payroll_cycle_id', record.payroll_cycle_id);
                
                if (fetchError) throw fetchError;
                
                // If a record already exists, use that instead of creating a new one
                if (existingRecords && existingRecords.length > 0) {
                    realRecordId = existingRecords[0].id;
                } else {
                    // Create a new record in the database
                    const { data: newRecord, error: insertError } = await supabase
                        .from('company_payroll_records')
                        .insert([
                            {
                                company_id: record.company_id,
                                payroll_cycle_id: record.payroll_cycle_id,
                                documents: {},
                                status: {
                                    finalization_date: null,
                                    assigned_to: null,
                                    filing: null
                                },
                                number_of_employees: 0
                            }
                        ])
                        .select()
                        .single();

                    if (insertError) throw insertError;
                    realRecordId = newRecord.id;
                }
            }

            // Fetch the latest status from the database to ensure we have the current finalization_date
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('status')
                .eq('id', realRecordId)
                .single();
            
            if (fetchError) {
                console.error('Error fetching current record status:', fetchError);
                // Continue with the record we have, but log the error
            }

            // Use the current database status if available, otherwise use the record from state
            const currentStatus = currentRecord?.status || record.status || {};
            
            // Now update the filing status while preserving other status fields
            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    status: {
                        // Explicitly check if the finalization_date is 'NIL' and preserve it
                        finalization_date: currentStatus.finalization_date === 'NIL' 
                            ? 'NIL' 
                            : (currentStatus.finalization_date || record.status?.finalization_date),
                        assigned_to: currentStatus.assigned_to || record.status?.assigned_to,
                        filing: {
                            filingDate: date.toISOString(),
                            filedBy: currentStatus.assigned_to || record.status?.assigned_to || 'Unknown'
                        }
                    }
                })
                .eq('id', realRecordId);

            if (error) throw error;

            // Update records state
            setRecords(prevRecords =>
                prevRecords.map(r =>
                    r.id === recordId
                        ? {
                            ...r,
                            id: realRecordId, // Update ID if it was temporary
                            is_temporary: false,
                            status: {
                                // Preserve the 'NIL' value in the state update as well
                                finalization_date: r.status?.finalization_date === 'NIL' 
                                    ? 'NIL' 
                                    : r.status?.finalization_date,
                                assigned_to: r.status?.assigned_to,
                                filing: {
                                    filingDate: date.toISOString(),
                                    filedBy: r.status?.assigned_to || 'Unknown'
                                }
                            }
                        }
                        : r
                )
            );

            // Close dialog
            setState(prev => ({
                ...prev,
                filingDialog: {
                    ...prev.filingDialog,
                    isOpen: false,
                    recordId: null,
                    isNil: false,
                    confirmOpen: false,
                    record: null
                }
            }));

            toast({
                title: 'Success',
                description: 'Filing status updated successfully'
            });
        } catch (error) {
            console.error('Filing error:', error);
            toast({
                title: 'Error',
                description: 'Failed to update filing status',
                variant: 'destructive'
            });
        }
    };

    const handleRemoveFiling = async (recordId: string) => {
        try {
            // Only proceed if this is a real record
            if (recordId.startsWith('temp_')) {
                toast({
                    title: 'Error',
                    description: 'Cannot remove filing from a record that has not been filed',
                    variant: 'destructive'
                });
                return;
            }

            const record = records.find(r => r.id === recordId);
            if (!record) return;

            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    status: {
                        ...record.status,
                        filing: null
                    }
                })
                .eq('id', recordId);

            if (error) throw error;

            // Update records state
            setRecords(prevRecords =>
                prevRecords.map(r =>
                    r.id === recordId
                        ? {
                            ...r,
                            status: {
                                ...r.status,
                                filing: null
                            }
                        }
                        : r
                )
            );

            // Close dialog
            setState(prev => ({
                ...prev,
                filingDialog: {
                    ...prev.filingDialog,
                    isOpen: false,
                    recordId: null,
                    isNil: false,
                    confirmOpen: false,
                    record: null
                }
            }));

            toast({
                title: 'Success',
                description: 'Filing status removed successfully'
            });
        } catch (error) {
            console.error('Remove filing error:', error);
            toast({
                title: 'Error',
                description: 'Failed to remove filing status',
                variant: 'destructive'
            });
        }
    };

    const handleDeleteAll = async (record: CompanyPayrollRecord) => {
        try {
            // Skip if this is a temporary record with no documents
            if (record.is_temporary || record.id.startsWith('temp_')) {
                toast({
                    title: 'Info',
                    description: 'No documents to delete for this record',
                });
                return;
            }

            // First, get all document paths that need to be deleted
            const documentPaths = Object.values(record.documents).filter(Boolean);

            if (documentPaths.length === 0) {
                toast({
                    title: 'Info',
                    description: 'No documents to delete for this record',
                });
                return;
            }

            // Delete files from storage
            const { error: deleteError } = await supabase.storage
                .from('Payroll-Cycle')
                .remove(documentPaths);

            if (deleteError) throw deleteError;

            // Update record to remove all document references
            const emptyDocuments = Object.keys(record.documents).reduce((acc, key) => {
                acc[key] = null;
                return acc;
            }, {});

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    documents: emptyDocuments,
                    number_of_employees: 0
                })
                .eq('id', record.id);

            if (updateError) throw updateError;

            // Update records state
            setRecords(prevRecords =>
                prevRecords.map(r =>
                    r.id === record.id
                        ? {
                            ...r,
                            documents: emptyDocuments,
                            number_of_employees: 0
                        }
                        : r
                )
            );

            toast({
                title: 'Success',
                description: 'All documents deleted successfully'
            });
        } catch (error) {
            console.error('Delete all error:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete all documents',
                variant: 'destructive'
            });
        }
    };

    const handleDownload = async (path: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('Payroll-Cycle')
                .download(path);

            if (error) throw error;

            // Create a download link
            const url = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = path.split('/').pop() || 'document';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            toast({
                title: 'Error',
                description: 'Failed to download document',
                variant: 'destructive'
            });
        }
    };

    const handleDownloadAll = async (record: CompanyPayrollRecord) => {
        try {
            // Skip if this is a temporary record with no documents
            if (record.is_temporary || record.id.startsWith('temp_')) {
                toast({
                    title: 'Info',
                    description: 'No documents to download for this record',
                });
                return;
            }

            // Get all document paths that need to be downloaded
            const documentPaths = Object.values(record.documents).filter(Boolean);

            if (documentPaths.length === 0) {
                toast({
                    title: 'Info',
                    description: 'No documents to download for this record',
                });
                return;
            }

            // Download each document one by one
            for (const path of documentPaths) {
                try {
                    await handleDownload(path);
                } catch (error) {
                    console.error(`Failed to download ${path}:`, error);
                }
            }

            toast({
                title: 'Success',
                description: 'All documents downloaded'
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

    return {
        state,
        setState,
        handleFinalize,
        handleRevertFinalize,
        handleFilingConfirm,
        handleRemoveFiling,
        handleDeleteAll,
        handleDownload,
        handleDownloadAll
    };
};