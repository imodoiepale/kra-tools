// @ts-nocheck
import { useState, useMemo, useCallback } from "react"
import { format } from 'date-fns'
import {
    MoreHorizontal,
    FileCheck,
    Download,
    Trash2,
    Eye,
    CheckCircle,
    AlertCircle,
    Mail,
    MessageSquare,
    Upload
} from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from '@/components/ui/button'
import { ContactModal } from '../../payslip-receipts/components/ContactModal'
import { WhatsAppModal } from '../../payslip-receipts/components/WhatsappModal';
import {
    Table,   
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DocumentUploadDialog } from './DocumentUploadDialog'
import BulkDocumentUpload from './BulkDocumentUpload';
import {
    CompanyPayrollRecord,
    DocumentType,
    FilingDialogState
} from '.../types'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

interface EmailHistory {
    date: string;
    recipients: string[];
}

interface TaxPaymentTableProps {
    records: CompanyPayrollRecord[]
    onDocumentUpload: (recordId: string, file: File, documentType: DocumentType, subFolder: string) => Promise<string | undefined>
    onDocumentDelete: (recordId: string, documentType: DocumentType) => Promise<void>
    onStatusUpdate: (recordId: string, statusUpdate: Partial<CompanyPayrollRecord['status']>) => Promise<void>
    loading: boolean
    columnVisibility?: Record<string, boolean>
    onExportCsv: (records: CompanyPayrollRecord[]) => Promise<void>
    bulkUploadDialogOpen: boolean
    setBulkUploadDialogOpen: (open: boolean) => void
}

const DOCUMENT_LABELS: Record<string, string> = {
    paye_acknowledgment: "PAYE Ack.",
    paye_slip: "PAYE Payment",
    housing_levy_slip: "Housing Levy",
    nita_slip: "NITA",
    shif_slip: "SHIF",
    nssf_slip: "NSSF",
    all_csv: "All CSV Files"
};

const formatDate = (date: string | null | undefined): string => {
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

const getDocumentsForUpload = (record: CompanyPayrollRecord) => {
    // Return empty array if payment_slips_documents is undefined
    if (!record.payment_slips_documents) {
        return Object.entries(DOCUMENT_LABELS)
            .filter(([key]) => key !== 'all_csv')
            .map(([type, label]) => ({
                type: type as DocumentType,
                label,  
                status: 'missing' as const,
                path: null
            }));
    }
    
    return Object.entries(DOCUMENT_LABELS)
        .filter(([key]) => key !== 'all_csv')
        .map(([type, label]) => {
            const docPath = record.payment_slips_documents[type as DocumentType];
            const isUploaded = docPath !== null && docPath !== undefined && docPath !== '';
            return {
                type: type as DocumentType,
                label,
                status: isUploaded ? 'uploaded' as const : 'missing' as const,
                path: isUploaded ? docPath : null
            };
        });
};

export function TaxPaymentTable({
    records,
    onDocumentUpload,
    onDocumentDelete,
    onStatusUpdate,
    loading,
    columnVisibility,
    onExportCsv,
    bulkUploadDialogOpen,
    setBulkUploadDialogOpen
}: TaxPaymentTableProps) {
    const { toast } = useToast()

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [finalizeDialog, setFinalizeDialog] = useState<{
        isOpen: boolean;
        recordId: string | null;
        assignedTo: string;
        isNil: boolean;
    }>({ isOpen: false, recordId: null, assignedTo: 'Tushar', isNil: false });

    const [selectedMonthYear, setSelectedMonthYear] = useState<string>(format(new Date(), 'yyyy-MM'));

    const [filingDialog, setFilingDialog] = useState<FilingDialogState>({
        isOpen: false,
        recordId: null,
        isNil: false,
        confirmOpen: false
    });

    const [documentDetailsDialog, setDocumentDetailsDialog] = useState<{
        isOpen: boolean;
        record: CompanyPayrollRecord | null;
    }>({ isOpen: false, record: null });

    const getDocumentCount = (record: CompanyPayrollRecord) => {
        if (!record.status || record.status.finalization_date === 'NIL') {
            return 'N/A';
        }
        // Check if payment_slips_documents exists
        if (!record.payment_slips_documents) {
            return '0/6';
        }
        // Count all document types including nita_slip
        const requiredDocs = ['paye_acknowledgment', 'paye_slip', 'housing_levy_slip', 'shif_slip', 'nssf_slip', 'nita_slip'];
        const totalDocs = requiredDocs.length;
        const uploadedDocs = requiredDocs.filter(docType =>
            record.payment_slips_documents[docType as DocumentType] !== null
        ).length;
        return `${uploadedDocs}/${totalDocs}`;
    };

    const allDocumentsUploaded = (record: CompanyPayrollRecord | undefined): boolean => {
        if (!record || !record.payment_slips_documents) return false;
        const requiredDocs = ['paye_acknowledgment', 'paye_slip', 'housing_levy_slip', 'shif_slip', 'nssf_slip', 'nita_slip'];
        return requiredDocs.every(docType => {
            const docPath = record.payment_slips_documents[docType as DocumentType];
            // Check that the document path exists AND is not an empty string
            return docPath !== null && docPath !== undefined && docPath !== '';
        });
    };

    // Memoize sorted records for performance
    const sortedRecords = useMemo(() =>
        [...records].sort((a, b) => {
            // Safely handle null/undefined company objects
            const nameA = a?.company?.company_name || '';
            const nameB = b?.company?.company_name || '';
            return nameA.localeCompare(nameB);
        }),
        [records]
    );
    
    const handleFinalize = (recordId: string) => {
        onStatusUpdate(recordId, {
            finalization_date: finalizeDialog.isNil ? 'NIL' : new Date().toISOString(),
            status: 'completed',
            assigned_to: finalizeDialog.assignedTo
        });
        setFinalizeDialog({ isOpen: false, recordId: null, assignedTo: 'Tushar', isNil: false });
    };

    const handleFilingConfirm = async (recordId: string) => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) return;

            // Fetch current record to get latest status
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('status')
                .eq('id', recordId)
                .single();

            if (fetchError) throw fetchError;

            const currentDate = filingDialog.isNil ? 'NIL' : new Date().toISOString();

            // Create the updated status object
            const updatedStatus = {
                ...currentRecord.status, // Preserve existing status fields
                filing: {
                    isReady: true,
                    filingDate: currentDate,
                    isNil: filingDialog.isNil,
                    filedBy: record.status.assigned_to || 'Unassigned'
                }
            };

            // Update the record in Supabase
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_slips_status: updatedStatus
                })
                .eq('id', recordId);

            if (updateError) throw updateError;

            // Update local state
            const updatedRecords = records.map(r => {
                if (r.id === recordId) {
                    return {
                        ...r,
                        status: updatedStatus
                    };
                }
                return r;
            });

            toast({
                title: "Success",
                description: "Filing status updated successfully"
            });

            setFilingDialog({ isOpen: false, recordId: null, isNil: false, confirmOpen: false });
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
            const record = records.find(r => r.id === recordId);
            if (!record) return;

            // Fetch current record to get latest status
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('status')
                .eq('id', recordId)
                .single();

            if (fetchError) throw fetchError;

            // Create the updated status object without the filing property
            const { filing, ...restStatus } = currentRecord.status;
            const updatedStatus = { ...restStatus };

            // Update the record in Supabase
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    status: updatedStatus
                })
                .eq('id', recordId);

            if (updateError) throw updateError;

            // Update local state
            setFilingDialog(prev => ({ ...prev, isOpen: false }));
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

    const [deleteAllDialog, setDeleteAllDialog] = useState<{
        isOpen: boolean;
        record: CompanyPayrollRecord | null;
    }>({ isOpen: false, record: null });

    const handleDeleteAll = async (record: CompanyPayrollRecord) => {
        try {
            setIsSubmitting(true);

            // Filter out null values before using the paths
            const documentsToDelete = Object.entries(record.payment_slips_documents).filter(([_, path]) => path !== null) as [DocumentType, string][];

            if (documentsToDelete.length === 0) {
                toast({
                    title: 'No documents',
                    description: 'No documents to delete'
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
                    payment_slips_documents: {
                        paye_acknowledgment: null,
                        paye_slip: null,
                        housing_levy_slip: null,
                        shif_slip: null,
                        nssf_slip: null,
                        nita_slip: null
                    }
                })
                .eq('id', record.id);

            if (updateError) throw updateError;

            // Update local state with a new array to trigger re-render
            const updatedRecords = records.map(r => {
                if (r.id === record.id) {
                    return {
                        ...r,
                        payment_slips_documents: {
                            paye_acknowledgment: null,
                            paye_slip: null,
                            housing_levy_slip: null,
                            shif_slip: null,
                            nssf_slip: null,
                            nita_slip: null
                        }
                    };
                }
                return r;
            });

            // Close the dialog
            setDeleteAllDialog({ isOpen: false, record: null });

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
            setIsSubmitting(false);
        }
    };

    const handleDownload = async (path: string): Promise<void> => {
        try {
            const { data, error } = await supabase.storage
                .from('Payroll-Cycle')
                .download(path);

            if (error) throw error;

            // Create download link
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
            const documentsToDownload = Object.entries(record.payment_slips_documents)
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

    const handleDocumentUpload = async (recordId: string, file: File, documentType: DocumentType): Promise<void> => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) {
                throw new Error('Record not found');
            }

            if (!record.company?.company_name) {
                throw new Error('Company information is missing');
            }

            // Call the onDocumentUpload function passed from parent
            await onDocumentUpload(recordId, file, documentType, 'payment-slips');

            toast({
                title: 'Success',
                description: 'Document uploaded successfully'
            });
        } catch (error) {
            console.error('Document upload error:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to upload document',
                variant: 'destructive'
            });
            throw error;
        }
    };

    const handleDocumentDelete = async (recordId: string, documentType: DocumentType) => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) {
                throw new Error('Record not found');
            }

            // Check if payment_slips_documents exists and has the document
            if (!record.payment_slips_documents || !record.payment_slips_documents[documentType]) {
                throw new Error('Document not found');
            }

            // Call the onDocumentDelete function passed from parent
            await onDocumentDelete(recordId, documentType);

            toast({
                title: 'Success',
                description: 'Document deleted successfully'
            });
        } catch (error) {
            console.error('Document delete error:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to delete document',
                variant: 'destructive'
            });
        }
    };

    const handleEmailSent = async (recordId: string, emailData: { date: string; recipients: string[] }) => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) return;

            // Fetch current record to get latest email history
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('email_history')
                .eq('id', recordId)
                .single();

            if (fetchError) throw fetchError;

            const emailHistory = currentRecord.email_history || [];
            const updatedHistory = [...emailHistory, emailData];

            // Update the record in Supabase
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    email_history: updatedHistory
                })
                .eq('id', recordId);

            if (updateError) throw updateError;

            // Update local state
            toast({
                title: "Success",
                description: "Email history updated successfully"
            });
        } catch (error) {
            console.error('Email history update error:', error);
            toast({
                title: "Error",
                description: "Failed to update email history",
                variant: "destructive"
            });
        }
    };

    const handleMessageSent = async (recordId: string, messageData: { date: string; recipients: string[] }) => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) return;

            // Fetch current record to get latest message history
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('whatsapp_history')
                .eq('id', recordId)
                .single();

            if (fetchError) throw fetchError;

            const messageHistory = currentRecord?.whatsapp_history || [];
            const updatedHistory = [...messageHistory, messageData];

            // Update the message history
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    whatsapp_history: updatedHistory
                })
                .eq('id', recordId);

            if (updateError) throw updateError;

            // Update local state
            toast({
                title: "Success",
                description: "WhatsApp message history updated"
            });
        } catch (error) {
            console.error('WhatsApp history update error:', error);
            toast({
                title: "Error",
                description: "Failed to update WhatsApp history",
                variant: "destructive"
            });
        }
    };

    const handleBulkUpload = async (files: File[], mappedFiles: any[]) => {
        try {
            // Filter out only valid files
            const validMappedFiles = mappedFiles.filter(file => file.recordId && file.documentType);
            
            if (validMappedFiles.length === 0) {
                toast({
                    title: 'Error',
                    description: 'No valid files to upload',
                    variant: 'destructive'
                });
                return Promise.reject(new Error('No valid files to upload'));
            }
            
            // Process each file sequentially
            const uploadResults = [];
            for (let i = 0; i < validMappedFiles.length; i++) {
                const { file, recordId, documentType, companyName } = validMappedFiles[i];
                const record = records.find(r => r.id === recordId);
                
                if (record && documentType) {
                    try {
                        await onDocumentUpload(recordId, file, documentType, 'payment-slips');
                        uploadResults.push({
                            success: true,
                            fileName: file.name,
                            companyName
                        });
                    } catch (error) {
                        console.error(`Error uploading file ${file.name}:`, error);
                        uploadResults.push({
                            success: false,
                            fileName: file.name,
                            companyName,
                            error: error.message || 'Upload failed'
                        });
                    }
                }
            }
            
            // Show summary toast
            const successCount = uploadResults.filter(r => r.success).length;
            const failCount = uploadResults.length - successCount;
            
            if (successCount > 0) {
                toast({
                    title: 'Upload Complete',
                    description: `Successfully uploaded ${successCount} documents${failCount > 0 ? `, ${failCount} failed` : ''}`,
                    variant: 'default'
                });
            } else if (failCount > 0) {
                toast({
                    title: 'Upload Failed',
                    description: `Failed to upload ${failCount} documents`,
                    variant: 'destructive'
                });
            }
            
            // Close the bulk upload dialog
            setBulkUploadDialogOpen(false);
            
            return Promise.resolve(uploadResults);
        } catch (error) {
            console.error("Bulk upload error:", error);
            toast({
                title: 'Error',
                description: 'An unexpected error occurred during bulk upload',
                variant: 'destructive'
            });
            return Promise.reject(error);
        }
    };

    const handleBulkExport = () => {
        // Get all records that have documents
        const recordsWithDocuments = records.filter(record => 
            record.payment_slips_documents && 
            Object.values(record.payment_slips_documents).some(doc => doc)
        );
        
        // Export CSV with document links
        onExportCsv(recordsWithDocuments);
    };

    return (
        <div className="rounded-md border h-[calc(100vh-220px)] overflow-auto">
            <Table aria-label="Payroll Records" className="border border-gray-200">
                <TableHeader>
                    {/* Total Records Row */}
                    <TableRow className="bg-blue-50 text-blue-800 border-b border-gray-300">
                        {columnVisibility?.index !== false && (
                            <TableHead className="text-center text-sm font-semibold">Total Records</TableHead>
                        )}
                        {columnVisibility?.companyName !== false && (
                            <TableHead className="text-center text-sm font-semibold">{sortedRecords.length}</TableHead>
                        )}
                        {columnVisibility?.readyToFile !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.payeAcknowledgment !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => r?.payment_slips_documents?.paye_acknowledgment).length}
                            </TableHead>
                        )}
                        {columnVisibility?.payeSlip !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => r?.payment_slips_documents?.paye_slip).length}
                            </TableHead>
                        )}
                        {columnVisibility?.housingLevy !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => r?.payment_slips_documents?.housing_levy_slip).length}
                            </TableHead>
                        )}
                        {columnVisibility?.nita !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => r?.payment_slips_documents?.nita_slip).length}
                            </TableHead>
                        )}
                        {columnVisibility?.shif !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => r?.payment_slips_documents?.shif_slip).length}
                            </TableHead>
                        )}
                        {columnVisibility?.nssf !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => r?.payment_slips_documents?.nssf_slip).length}
                            </TableHead>
                        )}
                        {columnVisibility?.allTaxSlips !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => allDocumentsUploaded(r)).length}
                            </TableHead>
                        )}
                        {/* {columnVisibility?.emailStatus !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )} */}
                        {columnVisibility?.email !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.whatsapp !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.actions !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                    </TableRow>

                    {/* Complete Records Row */}
                    <TableRow className="bg-green-50 text-green-800 border-b border-gray-300">
                        {columnVisibility?.index !== false && (
                            <TableHead className="text-center text-sm font-semibold">Complete</TableHead>
                        )}
                        {columnVisibility?.companyName !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => r?.status?.status === 'completed' || allDocumentsUploaded(r)).length}
                            </TableHead>
                        )}
                        {columnVisibility?.readyToFile !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.payeAcknowledgment !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => (r?.status?.status === 'completed' || allDocumentsUploaded(r)) && r?.payment_slips_documents?.paye_acknowledgment).length}
                            </TableHead>
                        )}
                        {columnVisibility?.payeSlip !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => (r?.status?.status === 'completed' || allDocumentsUploaded(r)) && r?.payment_slips_documents?.paye_slip).length}
                            </TableHead>
                        )}
                        {columnVisibility?.housingLevy !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => (r?.status?.status === 'completed' || allDocumentsUploaded(r)) && r?.payment_slips_documents?.housing_levy_slip).length}
                            </TableHead>
                        )}
                        {columnVisibility?.nita !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => (r?.status?.status === 'completed' || allDocumentsUploaded(r)) && r?.payment_slips_documents?.nita_slip).length}
                            </TableHead>
                        )}
                        {columnVisibility?.shif !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => (r?.status?.status === 'completed' || allDocumentsUploaded(r)) && r?.payment_slips_documents?.shif_slip).length}
                            </TableHead>
                        )}
                        {columnVisibility?.nssf !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => (r?.status?.status === 'completed' || allDocumentsUploaded(r)) && r?.payment_slips_documents?.nssf_slip).length}
                            </TableHead>
                        )}
                        {columnVisibility?.allTaxSlips !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => allDocumentsUploaded(r)).length}
                            </TableHead>
                        )}
                        {/* {columnVisibility?.emailStatus !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )} */}
                        {columnVisibility?.email !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.whatsapp !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.actions !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                    </TableRow>

                    {/* Pending Records Row */}
                    <TableRow className="bg-yellow-50 text-yellow-800 border-b border-gray-300">
                        {columnVisibility?.index !== false && (
                            <TableHead className="text-center text-sm font-semibold">Pending</TableHead>
                        )}
                        {columnVisibility?.companyName !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => 
                                    r?.status?.status !== 'completed' && 
                                    !allDocumentsUploaded(r) &&
                                    !(r?.status?.verification_date?.includes('NIL'))
                                ).length}
                            </TableHead>
                        )}
                        {columnVisibility?.readyToFile !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.payeAcknowledgment !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => 
                                    r?.status?.status !== 'completed' && 
                                    !allDocumentsUploaded(r) &&
                                    !(r?.status?.verification_date?.includes('NIL')) && 
                                    !r?.payment_slips_documents?.paye_acknowledgment
                                ).length}
                            </TableHead>
                        )}
                        {columnVisibility?.payeSlip !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => 
                                    r?.status?.status !== 'completed' && 
                                    !allDocumentsUploaded(r) &&
                                    !(r?.status?.verification_date?.includes('NIL')) && 
                                    !r?.payment_slips_documents?.paye_slip
                                ).length}
                            </TableHead>
                        )}
                        {columnVisibility?.housingLevy !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => 
                                    r?.status?.status !== 'completed' && 
                                    !allDocumentsUploaded(r) &&
                                    !(r?.status?.verification_date?.includes('NIL')) && 
                                    !r?.payment_slips_documents?.housing_levy_slip
                                ).length}
                            </TableHead>
                        )}
                        {columnVisibility?.nita !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => 
                                    r?.status?.status !== 'completed' && 
                                    !allDocumentsUploaded(r) &&
                                    !(r?.status?.verification_date?.includes('NIL')) && 
                                    !r?.payment_slips_documents?.nita_slip
                                ).length}
                            </TableHead>
                        )}
                        {columnVisibility?.shif !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => 
                                    r?.status?.status !== 'completed' && 
                                    !allDocumentsUploaded(r) &&
                                    !(r?.status?.verification_date?.includes('NIL')) && 
                                    !r?.payment_slips_documents?.shif_slip
                                ).length}
                            </TableHead>
                        )}
                        {columnVisibility?.nssf !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => 
                                    r?.status?.status !== 'completed' && 
                                    !allDocumentsUploaded(r) &&
                                    !(r?.status?.verification_date?.includes('NIL')) && 
                                    !r?.payment_slips_documents?.nssf_slip
                                ).length}
                            </TableHead>
                        )}
                        {columnVisibility?.allTaxSlips !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {/* {columnVisibility?.emailStatus !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )} */}
                        {columnVisibility?.email !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.whatsapp !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.actions !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                    </TableRow>

                    {/* NIL Records Row */}
                    <TableRow className="bg-purple-50 text-purple-800 border-b border-gray-300">
                        {columnVisibility?.index !== false && (
                            <TableHead className="text-center text-sm font-semibold">NIL Records</TableHead>
                        )}
                        {columnVisibility?.companyName !== false && (
                            <TableHead className="text-center text-sm font-semibold">
                                {sortedRecords.filter(r => r?.status?.verification_date?.includes('NIL')).length}
                            </TableHead>
                        )}
                        {columnVisibility?.readyToFile !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.payeAcknowledgment !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.payeSlip !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.housingLevy !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.nita !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.shif !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.nssf !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.allTaxSlips !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {/* {columnVisibility?.emailStatus !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )} */}
                        {columnVisibility?.email !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.whatsapp !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                        {columnVisibility?.actions !== false && (
                            <TableHead className="text-center text-sm font-semibold">-</TableHead>
                        )}
                    </TableRow>

                    {/* Original column headers */}
                    <TableRow className="bg-blue-500 text-white">
                        {columnVisibility?.index !== false && (
                            <TableHead className="text-white font-semibold" scope="col">#</TableHead>
                        )}
                        {columnVisibility?.companyName !== false && (
                            <TableHead className="text-white font-semibold" scope="col">Company Name</TableHead>
                        )}
                        {columnVisibility?.readyToFile !== false && (
                            <TableHead className="text-white font-semibold" scope="col">Ready to File</TableHead>
                        )}
                        {columnVisibility?.payeAcknowledgment !== false && (
                            <TableHead className="text-white font-semibold" scope="col">PAYE Ack.</TableHead>
                        )}
                        {columnVisibility?.payeSlip !== false && (
                            <TableHead className="text-white font-semibold" scope="col">PAYE Slip</TableHead>
                        )}
                        {columnVisibility?.housingLevy !== false && (
                            <TableHead className="text-white font-semibold" scope="col">Housing Levy</TableHead>
                        )}
                        {columnVisibility?.nita !== false && (
                            <TableHead className="text-white font-semibold" scope="col">NITA</TableHead>
                        )}
                        {columnVisibility?.shif !== false && (
                            <TableHead className="text-white font-semibold" scope="col">SHIF</TableHead>
                        )}
                        {columnVisibility?.nssf !== false && (
                            <TableHead className="text-white font-semibold" scope="col">NSSF</TableHead>
                        )}
                        {columnVisibility?.allTaxSlips !== false && (
                            <TableHead className="text-white font-semibold" scope="col">All Tax Slips</TableHead>
                        )}
                        {/* {columnVisibility?.emailStatus !== false && (
                            <TableHead className="text-white font-semibold" scope="col">Email Status</TableHead>
                        )} */}
                        {columnVisibility?.email !== false && (
                            <TableHead className="text-white font-semibold" scope="col">Email</TableHead>
                        )}
                        {columnVisibility?.whatsapp !== false && (
                            <TableHead className="text-white font-semibold" scope="col">WhatsApp</TableHead>
                        )}
                        {columnVisibility?.actions !== false && (
                            <TableHead className="text-white font-semibold" scope="col">Actions</TableHead>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={Object.values(columnVisibility || {}).filter(Boolean).length} className="text-center py-8 border">
                                <div role="status" className="animate-pulse">
                                    <div className="h-4 bg-gray-200 rounded-full w-48 mb-4"></div>
                                    <span className="sr-only">Loading...</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : sortedRecords.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={Object.values(columnVisibility || {}).filter(Boolean).length} className="text-center py-8 border">
                                No records found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedRecords.map((record, index) => (
                            <TableRow
                                key={record.id || index}
                                className={`${index % 2 === 0 ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'} [&>td]:border-r [&>td]:border-gray-200 last:[&>td]:border-r-0`}
                                aria-label={`Payroll record for ${record.company?.company_name || 'Unknown'}`}
                            >
                                {columnVisibility?.index !== false && (
                                    <TableCell>{index + 1}</TableCell>
                                )}
                                {columnVisibility?.companyName !== false && (
                                    <TooltipProvider>
                                        <TableCell className="font-medium">
                                            <Tooltip>
                                                <TooltipTrigger className=" ">
                                                    {record.company?.company_name ? record.company.company_name.split(" ").slice(0, 3).join(" ") : 'Unknown'}
                                                </TooltipTrigger>
                                                <TooltipContent>{record.company?.company_name || 'Unknown'}</TooltipContent>
                                            </Tooltip>
                                        </TableCell>
                                    </TooltipProvider>
                                )}
                                {columnVisibility?.readyToFile !== false && (
                                    <TableCell className="text-center">
                                        {record?.status?.filing?.filingDate ? (
                                            <Button
                                                size="sm"
                                                className={`h-6 text-xs px-2 ${record.status.finalization_date === 'NIL' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-green-500 hover:bg-green-600'}`}
                                                onClick={() => setFilingDialog({
                                                    isOpen: true,
                                                    recordId: record.id,
                                                    isNil: record.status.finalization_date === 'NIL',
                                                    confirmOpen: false,
                                                    record
                                                })}
                                            >
                                                {formatDate(record?.status?.filing?.filingDate)}
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                className={
                                                    !allDocumentsUploaded(record) && record.status?.finalization_date !== 'NIL'
                                                        ? "h-6 text-xs text-center px-2 bg-red-500 hover:bg-red-600"
                                                        : record.status?.finalization_date === 'NIL'
                                                            ? "h-6 text-xs text-center px-2 bg-gray-500 hover:bg-gray-600"
                                                            : "h-6 text-xs text-center px-2 bg-yellow-500 hover:bg-yellow-600"
                                                }
                                                disabled={!allDocumentsUploaded(record) && record.status?.finalization_date !== 'NIL'}
                                                onClick={() => {
                                                    if (allDocumentsUploaded(record) || record.status?.finalization_date === 'NIL') {
                                                        setFilingDialog({
                                                            isOpen: true,
                                                            recordId: record.id,
                                                            isNil: record.status?.finalization_date === 'NIL',
                                                            confirmOpen: false,
                                                            record
                                                        });
                                                    }
                                                }}
                                            >
                                                {!allDocumentsUploaded(record) && record.status?.finalization_date !== 'NIL' 
                                                    ? 'Pending' 
                                                    : record.status?.finalization_date === 'NIL'
                                                        ? 'N/A'
                                                        : 'Ready'}
                                            </Button>
                                        )}
                                    </TableCell>
                                )}
                                {columnVisibility?.payeAcknowledgment !== false && (
                                    <TableCell className="text-center">
                                        <DocumentUploadDialog
                                            documentType="paye_acknowledgment"
                                            recordId={record.id}
                                            onUpload={(file, docType) => handleDocumentUpload(record.id, file, docType || "paye_acknowledgment")}
                                            onDelete={(docType) => handleDocumentDelete(record.id, docType || "paye_acknowledgment")}
                                            existingDocument={record.payment_slips_documents ? record.payment_slips_documents.paye_acknowledgment : null}
                                            label="PAYE Ack."
                                            isNilFiling={record.status?.finalization_date === 'NIL'}
                                            allDocuments={getDocumentsForUpload(record)}
                                            companyName={record.company?.company_name || ''}
                                        />
                                    </TableCell>
                                )}
                                {columnVisibility?.payeSlip !== false && (
                                    <TableCell className="text-center">
                                        <DocumentUploadDialog
                                            documentType="paye_slip"
                                            recordId={record.id}
                                            onUpload={(file, docType) => handleDocumentUpload(record.id, file, docType || "paye_slip")}
                                            onDelete={(docType) => handleDocumentDelete(record.id, docType || "paye_slip")}
                                            existingDocument={record.payment_slips_documents ? record.payment_slips_documents.paye_slip : null}
                                            label="PAYE Slip"
                                            isNilFiling={record.status?.finalization_date === 'NIL'}
                                            allDocuments={getDocumentsForUpload(record)}
                                            companyName={record.company?.company_name || ''}
                                        />
                                    </TableCell>
                                )}
                                {columnVisibility?.housingLevy !== false && (
                                    <TableCell className="text-center">
                                        <DocumentUploadDialog
                                            documentType="housing_levy_slip"
                                            recordId={record.id}
                                            onUpload={(file, docType) => handleDocumentUpload(record.id, file, docType || "housing_levy_slip")}
                                            onDelete={(docType) => handleDocumentDelete(record.id, docType || "housing_levy_slip")}
                                            existingDocument={record.payment_slips_documents ? record.payment_slips_documents.housing_levy_slip : null}
                                            label="Housing Levy"
                                            isNilFiling={record.status?.finalization_date === 'NIL'}
                                            allDocuments={getDocumentsForUpload(record)}
                                            companyName={record.company?.company_name || ''}
                                        />
                                    </TableCell>
                                )}
                                {columnVisibility?.nita !== false && (
                                    <TableCell className="text-center">
                                        <DocumentUploadDialog
                                            documentType="nita_slip"
                                            recordId={record.id}
                                            onUpload={(file, docType) => handleDocumentUpload(record.id, file, docType || "nita_slip")}
                                            onDelete={(docType) => handleDocumentDelete(record.id, docType || "nita_slip")}
                                            existingDocument={record.payment_slips_documents ? record.payment_slips_documents.nita_slip : null}
                                            label="NITA"
                                            isNilFiling={record.status?.finalization_date === 'NIL'}
                                            allDocuments={getDocumentsForUpload(record)}
                                            companyName={record.company?.company_name || ''}
                                        />
                                    </TableCell>
                                )}
                                {columnVisibility?.shif !== false && (
                                    <TableCell className="text-center">
                                        <DocumentUploadDialog
                                            documentType="shif_slip"
                                            recordId={record.id}
                                            onUpload={(file, docType) => handleDocumentUpload(record.id, file, docType || "shif_slip")}
                                            onDelete={(docType) => handleDocumentDelete(record.id, docType || "shif_slip")}
                                            existingDocument={record.payment_slips_documents ? record.payment_slips_documents.shif_slip : null}
                                            label="SHIF"
                                            isNilFiling={record.status?.finalization_date === 'NIL'}
                                            allDocuments={getDocumentsForUpload(record)}
                                            companyName={record.company?.company_name || ''}
                                        />
                                    </TableCell>
                                )}
                                {columnVisibility?.nssf !== false && (
                                    <TableCell className="text-center">
                                        <DocumentUploadDialog
                                            documentType="nssf_slip"
                                            recordId={record.id}
                                            onUpload={(file, docType) => handleDocumentUpload(record.id, file, docType || "nssf_slip")}
                                            onDelete={(docType) => handleDocumentDelete(record.id, docType || "nssf_slip")}
                                            existingDocument={record.payment_slips_documents ? record.payment_slips_documents.nssf_slip : null}
                                            label="NSSF"
                                            isNilFiling={record.status?.finalization_date === 'NIL'}
                                            allDocuments={getDocumentsForUpload(record)}
                                            companyName={record.company?.company_name || ''}
                                        />
                                    </TableCell>
                                )}
                                {columnVisibility?.allTaxSlips !== false && (
                                    <TableCell>
                                        <Badge className={record.status?.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-blue-500'}>
                                            {getDocumentCount(record)}
                                        </Badge>
                                    </TableCell>
                                )}
                                {/* {columnVisibility?.emailStatus !== false && (
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <ContactModal
                                                            trigger={
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="relative"
                                                                >
                                                                    <Mail className="h-4 w-4" />
                                                                    {record.email_history?.length > 0 && (
                                                                        <Badge
                                                                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-green-500"
                                                                            variant="secondary"
                                                                        >
                                                                            {record.email_history.length}
                                                                        </Badge>
                                                                    )}
                                                                </Button>
                                                            }
                                                            companyName={record.company?.company_name || ''}
                                                            companyEmail={record.company?.email}
                                                            documents={getDocumentsForUpload(record)}
                                                            onEmailSent={(data) => handleEmailSent(record.id, data)}
                                                        />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {record.email_history?.length > 0 ? (
                                                            <div className="space-y-2">
                                                                <p className="font-semibold">Email History:</p>
                                                                {record.email_history.map((history, i) => (
                                                                    <div key={i} className="text-sm">
                                                                        <p>Sent: {format(new Date(history.date), 'dd/MM/yyyy HH:mm')}</p>
                                                                        <p>To: {history.recipients.join(', ')}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            "Send documents via email"
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>
                                )} */}
                                {columnVisibility?.email !== false && (
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <WhatsAppModal
                                                            trigger={
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0 relative"
                                                                >
                                                                    <MessageSquare className="h-4 w-4" />
                                                                    {record.whatsapp_history?.length > 0 && (
                                                                        <Badge
                                                                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-green-500"
                                                                            variant="secondary"
                                                                        >
                                                                            {record.whatsapp_history.length}
                                                                        </Badge>
                                                                    )}
                                                                </Button>
                                                            }
                                                            companyName={record.company?.company_name || ''}
                                                            companyPhone={record.company?.phone_number || ''}
                                                            documents={getDocumentsForUpload(record)}
                                                            onMessageSent={(data) => handleMessageSent(record.id, data)}
                                                        />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {record.whatsapp_history?.length > 0 ? (
                                                            <div className="space-y-2">
                                                                <p className="font-semibold">WhatsApp History:</p>
                                                                {record.whatsapp_history.map((history, i) => (
                                                                    <div key={i} className="text-sm">
                                                                        <p>Sent: {format(new Date(history.date), 'dd/MM/yyyy HH:mm')}</p>
                                                                        <p>To: {history.recipients.join(', ')}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            "Send documents via WhatsApp"
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>
                                )}
                                {columnVisibility?.whatsapp !== false && (
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <ContactModal
                                                            trigger={
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="relative"
                                                                >
                                                                    <Mail className="h-4 w-4" />
                                                                    {record.email_history?.length > 0 && (
                                                                        <Badge
                                                                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-green-500"
                                                                            variant="secondary"
                                                                        >
                                                                            {record.email_history.length}
                                                                        </Badge>
                                                                    )}
                                                                </Button>
                                                            }
                                                            companyName={record.company?.company_name || ''}
                                                            companyEmail={record.company?.email}
                                                            documents={getDocumentsForUpload(record)}
                                                            onEmailSent={(data) => handleEmailSent(record.id, data)}
                                                        />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {record.email_history?.length > 0 ? (
                                                            <div className="space-y-2">
                                                                <p className="font-semibold">Email History:</p>
                                                                {record.email_history.map((history, i) => (
                                                                    <div key={i} className="text-sm">
                                                                        <p>Sent: {format(new Date(history.date), 'dd/MM/yyyy HH:mm')}</p>
                                                                        <p>To: {history.recipients.join(', ')}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            "Send documents via email"
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>
                                )}
                                {columnVisibility?.actions !== false && (
                                    <TableCell className="text-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem
                                                    onClick={() => setDocumentDetailsDialog({ isOpen: true, record })}
                                                    className="flex items-center gap-2"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="flex items-center gap-2 text-blue-600"
                                                    onClick={() => handleDownloadAll(record)}
                                                >
                                                    <Download className="h-4 w-4" />
                                                    Download All
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="flex items-center gap-2 text-red-600"
                                                    onClick={() => setDeleteAllDialog({ isOpen: true, record })}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete All
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                    }}
                                                >
                                                    <ContactModal
                                                        trigger={
                                                            <div className="flex items-center w-full">
                                                                <Mail className="mr-2 h-4 w-4" />
                                                                <span>Send Documents</span>
                                                            </div>
                                                        }
                                                        companyName={record.company?.company_name || ''}
                                                        companyEmail={record.company?.email}
                                                        documents={Object.entries(DOCUMENT_LABELS)
                                                            .filter(([key]) => key !== 'all_csv')
                                                            .map(([type, label]) => {
                                                                // Check if payment_slips_documents exists
                                                                if (!record.payment_slips_documents) {
                                                                    return {
                                                                        type: type as DocumentType,
                                                                        label,
                                                                        status: "missing" as const,
                                                                        path: null
                                                                    };
                                                                }
                                                                return {
                                                                    type: type as DocumentType,
                                                                    label,
                                                                    status: record.payment_slips_documents[type as DocumentType] ? "uploaded" : "missing",
                                                                    path: record.payment_slips_documents[type as DocumentType] || null
                                                                };
                                                            })
                                                        }
                                                    />
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {/* Finalization Dialog */}
            <AlertDialog
                open={finalizeDialog.isOpen}
                onOpenChange={(isOpen) => !isOpen && setFinalizeDialog(prev => ({ ...prev, isOpen }))}
            >
                <AlertDialogContent className="max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Finalize Company Documents</AlertDialogTitle>
                        <AlertDialogDescription>
                            <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="nil"
                                        checked={finalizeDialog.isNil}
                                        onCheckedChange={(checked) =>
                                            setFinalizeDialog(prev => ({ ...prev, isNil: !!checked }))
                                        }
                                    />
                                    <Label htmlFor="nil">Mark as NIL</Label>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="assignedTo">Assigned To</Label>
                                    <Input
                                        id="assignedTo"
                                        value={finalizeDialog.assignedTo}
                                        onChange={(e) => setFinalizeDialog(prev => ({
                                            ...prev,
                                            assignedTo: e.target.value
                                        }))}
                                    />
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => handleFinalize(finalizeDialog.recordId!)}
                        >
                            Confirm & Finalize
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Filing Dialog */}
            <Dialog
                open={filingDialog.isOpen}
                onOpenChange={(isOpen) => !isOpen && setFilingDialog(prev => ({ ...prev, isOpen }))}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {filingDialog.record?.status?.filing?.filingDate ? 'Filing Status' : 'Ready to File'}
                        </DialogTitle>
                        <DialogDescription>
                            {filingDialog.record?.status?.filing?.filingDate
                                ? 'Update or remove the filing status'
                                : 'Please confirm you want to proceed with filing'
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        {filingDialog.record?.status?.filing?.filingDate && (
                            filingDialog.isNil ? (
                                <div className="flex items-center space-x-2 bg-purple-100 p-2 rounded-md">
                                    <AlertCircle className="h-4 w-4 text-purple-600" />
                                    <span className="text-sm font-medium text-purple-800 uppercase">NIL filing</span>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-2 bg-green-100 p-2 rounded-md">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-medium text-green-800 uppercase">You have filed taxes</span>
                                </div>
                            )
                        )}
                    </div>
                    
                </DialogContent>
            </Dialog>

            {/* Filing Confirmation Dialog */}
            <AlertDialog
                open={filingDialog.confirmOpen}
                onOpenChange={(isOpen) => setFilingDialog(prev => ({ ...prev, confirmOpen: isOpen }))}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Filing</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to proceed with filing? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => handleFilingConfirm(filingDialog.recordId!)}
                        >
                            Confirm Filing
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Document Details Dialog */}
            <Dialog
                open={documentDetailsDialog.isOpen}
                onOpenChange={(isOpen) => !isOpen && setDocumentDetailsDialog(prev => ({ ...prev, isOpen }))}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Document Details - {documentDetailsDialog.record?.company?.company_name || ''}
                        </DialogTitle>
                    </DialogHeader>
                    {documentDetailsDialog.record && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Finalization Date</Label>
                                    <div className="flex items-center gap-2">
                                        <Badge className={documentDetailsDialog.record.status?.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-green-500'}>
                                            {formatDate(documentDetailsDialog.record.status?.finalization_date)}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Assigned To</Label>
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-blue-500">
                                            {documentDetailsDialog.record.status?.assigned_to || 'Unassigned'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="border rounded-lg p-4 space-y-4">
                                {/* <div className="flex justify-between items-center">
                                    <h3 className="font-medium">Documents Status</h3>
                                    {documentDetailsDialog.record.status?.finalization_date !== null && (
                                        <Button
                                            size="sm"
                                            className={documentDetailsDialog.record.status?.finalization_date === 'NIL' ? 'bg-amber-500' : 'bg-purple-500'}
                                            onClick={() => {
                                                // Toggle between NIL and non-NIL status
                                                onStatusUpdate(documentDetailsDialog.record!.id, {
                                                    finalization_date: documentDetailsDialog.record!.status?.finalization_date === 'NIL' ?
                                                        new Date().toISOString() : 'NIL',
                                                    status: 'completed'
                                                });
                                                setDocumentDetailsDialog({ isOpen: false, record: null });
                                            }}
                                        >
                                            {documentDetailsDialog.record.status?.finalization_date === 'NIL' ?
                                                'Remove NIL Status' : 'Mark as NIL'}
                                        </Button>
                                    )}
                                </div> */}
                                {Object.entries(DOCUMENT_LABELS)
                                    .filter(([key]) => key !== 'all_csv') // Remove All CSV Files
                                    .map(([type, label]) => {
                                        const document = documentDetailsDialog?.record?.documents[type as DocumentType];
                                        const isNilFiling = documentDetailsDialog?.record?.status?.finalization_date === 'NIL';
                                        return (
                                            <div key={type} className="flex justify-between items-center">
                                                <span>{label}</span>
                                                {isNilFiling ? (
                                                    <Badge className="bg-purple-500">NIL</Badge>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Badge
                                                            className={document ? 'bg-green-500' : 'bg-yellow-500'}
                                                        >
                                                            {document ? 'Uploaded' : 'Missing'}
                                                        </Badge>
                                                        {document && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-6 text-xs"
                                                                onClick={() => handleDownload(document)}
                                                            >
                                                                <Download className="h-3 w-3 mr-1" />
                                                                Download
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>

                            {documentDetailsDialog.record.filing_status?.filingDate && (
                                <div className="space-y-2">
                                    <Label>Filing Status</Label>
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-green-500">
                                            Filed on {formatDate(documentDetailsDialog.record.filing_status.filingDate)}
                                        </Badge>
                                        <Badge variant="outline">
                                            By {documentDetailsDialog.record.filing_status.filedBy}
                                        </Badge>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={deleteAllDialog.isOpen}
                onOpenChange={(isOpen) => setDeleteAllDialog(prev => ({ ...prev, isOpen }))}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete All Documents</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete all documents for this company? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => {
                                if (deleteAllDialog.record) {
                                    handleDeleteAll(deleteAllDialog.record);
                                    setDeleteAllDialog({ isOpen: false, record: null });
                                }
                            }}
                        >
                            Delete All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <BulkDocumentUpload
                open={bulkUploadDialogOpen}
                onClose={() => setBulkUploadDialogOpen(false)}
                onUpload={handleBulkUpload}
                payrollRecords={records}
            />
        </div>
    )
}