// @ts-nocheck
import { useState } from 'react';
import { format } from 'date-fns';
import { CompanyPayrollRecord, DocumentType } from '../types';
import { supabase } from '@/lib/supabase';

interface PayrollState {
    isSubmitting: boolean;
    finalizeDialog: {
        isOpen: boolean;
        recordId: string | null;
        assignedTo: string;
        isNil: boolean;
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

export function usePayrollState(
    records: CompanyPayrollRecord[],
    setPayrollRecords: (records: CompanyPayrollRecord[]) => void,
    toast: any
) {
    const [state, setState] = useState<PayrollState>({
        isSubmitting: false,
        finalizeDialog: {
            isOpen: false,
            recordId: null,
            assignedTo: 'Tushar',
            isNil: false
        },
        filingDialog: {
            isOpen: false,
            recordId: null,
            isNil: false,
            confirmOpen: false
        },
        documentDetailsDialog: {
            isOpen: false,
            record: null
        },
        deleteAllDialog: {
            isOpen: false,
            record: null
        }
    });

    const [selectedMonthYear, setSelectedMonthYear] = useState<string>(format(new Date(), 'yyyy-MM'));

    const handleFinalize = async (recordId: string, isNil: boolean, assignedTo: string) => {
        try {
            await onStatusUpdate(recordId, {
                finalization_date: isNil ? 'NIL' : new Date().toISOString(),
                status: 'completed',
                assigned_to: assignedTo
            });
            setState(prev => ({
                ...prev,
                finalizeDialog: {
                    ...prev.finalizeDialog,
                    isOpen: false,
                    recordId: null,
                    assignedTo: 'Tushar',
                    isNil: false
                }
            }));
        } catch (error) {
            console.error('Finalization error:', error);
            toast({
                title: 'Error',
                description: 'Failed to finalize documents',
                variant: 'destructive'
            });
        }
    };

    const handleRevertFinalize = async (recordId: string) => {
        try {
            await onStatusUpdate(recordId, {
                finalization_date: null,
                status: 'pending',
                assigned_to: null
            });
            setState(prev => ({
                ...prev,
                finalizeDialog: {
                    ...prev.finalizeDialog,
                    isOpen: false,
                    recordId: null,
                    assignedTo: 'Tushar',
                    isNil: false
                }
            }));
            toast({
                title: 'Success',
                description: 'Finalization reverted successfully',
            });
        } catch (error) {
            console.error('Revert finalization error:', error);
            toast({
                title: 'Error',
                description: 'Failed to revert finalization',
                variant: 'destructive'
            });
        }
    };

    const handleFilingConfirm = async (recordId: string) => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) return;

            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('status')
                .eq('id', recordId)
                .single();

            if (fetchError) throw fetchError;

            const currentDate = state.filingDialog.isNil ? 'NIL' : new Date().toISOString();

            const updatedStatus = {
                ...currentRecord.status,
                filing: {
                    isReady: true,
                    filingDate: currentDate,
                    isNil: state.filingDialog.isNil,
                    filedBy: record.status.assigned_to || 'Unassigned'
                }
            };

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({ status: updatedStatus })
                .eq('id', recordId);

            if (updateError) throw updateError;

            setPayrollRecords(records.map(r => 
                r.id === recordId ? { ...r, status: updatedStatus } : r
            ));

            toast({
                title: "Success",
                description: "Filing status updated successfully"
            });

            setState(prev => ({
                ...prev,
                filingDialog: {
                    ...prev.filingDialog,
                    isOpen: false,
                    recordId: null,
                    isNil: false,
                    confirmOpen: false
                }
            }));
        } catch (error) {
            console.error('Filing update error:', error);
            toast({
                title: "Error",
                description: "Failed to update filing status",
                variant: "destructive"
            });
        }
    };

    const handleRemoveFiling = async (recordId: string) => {
        try {
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('status')
                .eq('id', recordId)
                .single();

            if (fetchError) throw fetchError;

            const { filing, ...restStatus } = currentRecord.status;
            const updatedStatus = { ...restStatus };

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({ status: updatedStatus })
                .eq('id', recordId);

            if (updateError) throw updateError;

            setPayrollRecords(records.map(r =>
                r.id === recordId ? { ...r, status: updatedStatus } : r
            ));

            setState(prev => ({
                ...prev,
                filingDialog: { ...prev.filingDialog, isOpen: false }
            }));

            toast({
                title: "Success",
                description: "Filing status has been removed successfully.",
                variant: "default",
            });
        } catch (error) {
            console.error('Error removing filing status:', error);
            toast({
                title: "Error",
                description: "Failed to remove filing status. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleDeleteAll = async (record: CompanyPayrollRecord) => {
        try {
            setState(prev => ({ ...prev, isSubmitting: true }));

            const documentsToDelete = Object.entries(record.documents)
                .filter(([_, path]) => path !== null) as [DocumentType, string][];

            if (documentsToDelete.length === 0) {
                toast({
                    title: 'No documents',
                    description: 'No documents to delete'
                });
                return;
            }

            await Promise.all(
                documentsToDelete.map(async ([_, path]) => {
                    const { error: deleteError } = await supabase.storage
                        .from('Payroll-Cycle')
                        .remove([path]);
                    if (deleteError) throw deleteError;
                })
            );

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

            setPayrollRecords(records.map(r => {
                if (r.id === record.id) {
                    return {
                        ...r,
                        documents: {
                            paye_csv: null,
                            hslevy_csv: null,
                            shif_exl: null,
                            nssf_exl: null,
                            zip_file_kra: null,
                            all_csv: null
                        }
                    };
                }
                return r;
            }));

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
        } finally {
            setState(prev => ({ 
                ...prev, 
                isSubmitting: false,
                deleteAllDialog: { isOpen: false, record: null }
            }));
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
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to download document',
                variant: 'destructive'
            });
        }
    };

    const handleDownloadAll = async (record: CompanyPayrollRecord) => {
        try {
            const documentsToDownload = Object.entries(record.documents)
                .filter(([key, value]) => key !== 'all_csv' && value !== null);

            for (const [_, path] of documentsToDownload) {
                if (path) await handleDownload(path);
            }

            toast({
                title: 'Success',
                description: 'All documents downloaded successfully'
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to download all documents',
                variant: 'destructive'
            });
        }
    };

    const onStatusUpdate = async (recordId: string, statusUpdate: any) => {
        const { error } = await supabase
            .from('company_payroll_records')
            .update({ status: statusUpdate })
            .eq('id', recordId);

        if (error) throw error;

        setPayrollRecords(records.map(r =>
            r.id === recordId ? { ...r, status: statusUpdate } : r
        ));
    };

    return {
        state,
        setState,
        selectedMonthYear,
        setSelectedMonthYear,
        handleFinalize,
        handleRevertFinalize,
        handleFilingConfirm,
        handleRemoveFiling,
        handleDeleteAll,
        handleDownload,
        handleDownloadAll,
        onStatusUpdate
    };
}
