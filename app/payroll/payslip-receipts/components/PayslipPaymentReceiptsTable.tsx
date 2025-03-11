// @ts-nocheck
import { useState, useMemo, useCallback, useRef } from "react"
import { format } from 'date-fns'
import {
    MoreHorizontal,
    Mail,
    MessageSquare,
    Eye,
    Download,
    FileText,
    Trash2,
    Calendar,
    CheckCircle,
    XCircle,
    AlertCircle,
    User,
    UserCheck,
    FileCheck,
    FileX,
    FileQuestion
} from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from '@/components/ui/button'
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
import {
    CompanyPayrollRecord,
    DocumentType,
    FilingDialogState
} from '.../types'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { ContactModal } from "./ContactModal"
import { WhatsAppModal } from "./WhatsappModal";
import { DocumentViewer } from "./DocumentViewer";

interface EmailHistory {
    date: string;
    recipients: string[];
}

interface PayrollRecord {
    id: string;
    company: {
        company_name: string;
        email?: string;
        phone_number?: string;
    };
    payment_receipts_documents: Record<DocumentType, string | null>;
    status: any;
    email_history?: EmailHistory[];
}

const DOCUMENT_LABELS: Record<string, string> = {
    paye_receipt: "PAYE",
    housing_levy_receipt: "Housing Levy",
    nita_receipt: "NITA",
    shif_receipt: "SHIF",
    nssf_receipt: "NSSF",
    all_csv: "All CSV Files"
};

interface PayslipPaymentReceiptsTableProps {
    records: CompanyPayrollRecord[]
    onDocumentUpload: (recordId: string, file: File, documentType: DocumentType, subFolder: string) => Promise<{success: boolean, path: string | null, error?: string}>
    onDocumentDelete: (recordId: string, documentType: DocumentType) => Promise<void>
    onStatusUpdate: (recordId: string, statusUpdate: any) => Promise<void>
    onBatchDocumentUpload: (recordId: string, documents: Array<{file: File, documentType: DocumentType}>, subFolder: string) => Promise<{success: boolean, paths: Record<DocumentType, string | null>, error?: string}>
    loading: boolean
    setPayrollRecords: (records: CompanyPayrollRecord[]) => void
    columnVisibility?: Record<string, boolean>
}

const BATCH_SIZE = 5;

const formatDate = (date: string | null | undefined): string => {
    if (!date) return 'N/A';
    try {
        return format(new Date(date), 'dd/MM/yyyy');
    } catch {
        return 'Invalid date';
    }
};

export function PayslipPaymentReceiptsTable({
    records,
    onDocumentUpload,
    onDocumentDelete,
    onStatusUpdate,
    onBatchDocumentUpload,
    loading,
    setPayrollRecords,
    columnVisibility = {}
}: PayslipPaymentReceiptsTableProps) {
    const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<{ url: string; title: string; companyName: string } | null>(null);
    const { toast } = useToast();

    const [isDeleting, setIsDeleting] = useState(false);
    const progressRef = useRef({ total: 0, completed: 0 });

    // Memoize expensive calculations
    const documentTypes = useMemo(() => 
        Object.keys(DOCUMENT_LABELS).filter(key => key !== 'all_csv') as DocumentType[], 
    []);

    // Optimized function to delete all documents with batched processing
    const handleDeleteAllDocuments = useCallback(async (recordId: string) => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) {
                toast({
                    title: 'Error',
                    description: 'Record not found',
                    variant: 'destructive'
                });
                return;
            }

            // Add null check for payment_receipts_documents
            if (!record.payment_receipts_documents) {
                toast({
                    title: 'Error',
                    description: 'No document information available',
                    variant: 'destructive'
                });
                return;
            }

            // Get all document types that have a non-null path
            const documentTypes = Object.keys(record.payment_receipts_documents)
                .filter(key => record.payment_receipts_documents[key] !== null) as DocumentType[];

            if (documentTypes.length === 0) {
                toast({
                    title: 'Warning',
                    description: 'No documents to delete',
                    variant: 'default'
                });
                return;
            }

            setIsDeleting(true);
            progressRef.current = { total: documentTypes.length, completed: 0 };
            
            toast({
                title: 'Processing',
                description: `Deleting ${documentTypes.length} documents...`
            });
            
            // Log the documents being deleted for debugging
            console.log('Deleting document types:', documentTypes);
            
            // Process deletions SEQUENTIALLY instead of in parallel batches
            for (const docType of documentTypes) {
                try {
                    console.log(`Deleting document type: ${docType}`);
                    await onDocumentDelete(recordId, docType);
                    progressRef.current.completed++;
                    
                    // Add a small delay between deletions
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`Error deleting ${docType}:`, error);
                }
            }
            
            // Manually update the local state after successful deletion
            const updatedRecords = records.map(r => {
                if (r.id === recordId) {
                    return {
                        ...r,
                        payment_receipts_documents: {}
                    };
                }
                return r;
            });
            
            // Update the records state
            setPayrollRecords(updatedRecords);
            
            toast({
                title: 'Success',
                description: `Successfully deleted ${progressRef.current.completed} documents`
            });
        } catch (error) {
            console.error('Error deleting all documents:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete all documents',
                variant: 'destructive'
            });
        } finally {
            setIsDeleting(false);
        }
    }, [records, onDocumentDelete, toast, setPayrollRecords]);

    const handleDeleteAll = useCallback(async (record: CompanyPayrollRecord) => {
        if (!record) return;
        
        setDeleteAllDialog({
            isOpen: true,
            record
        });
    }, []);

    const handleLocalDocumentUpload = async (recordId: string, file: File, documentType: DocumentType): Promise<void> => {
        try {
            setIsSubmitting(true);
            const result = await onDocumentUpload(recordId, file, documentType, 'payment-receipts');
            
            if (result.success) {
                toast({
                    title: 'Success',
                    description: 'Document uploaded successfully'
                });
                
                // Force refresh by updating records
                setPayrollRecords(prevRecords => {
                    return prevRecords.map(record => {
                        if (record.id === recordId) {
                            const updatedDocuments = {
                                ...record.payment_receipts_documents,
                                [documentType]: result.path
                            };
                            
                            return {
                                ...record,
                                payment_receipts_documents: updatedDocuments
                            };
                        }
                        return record;
                    });
                });
            } else {
                toast({
                    title: 'Error',
                    description: result.error || 'Failed to upload document',
                    variant: 'destructive'
                });
            }
        } catch (error) {
            console.error('Document upload error:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'An unknown error occurred',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDocumentDelete = async (recordId: string, documentType: DocumentType) => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) {
                toast({
                    title: 'Error',
                    description: 'Record not found',
                    variant: 'destructive'
                });
                return;
            }

            // Add null check for payment_receipts_documents
            if (!record.payment_receipts_documents) {
                toast({
                    title: 'Error',
                    description: 'No document information available',
                    variant: 'destructive'
                });
                return;
            }

            const documentPath = record.payment_receipts_documents[documentType];
            if (!documentPath) {
                toast({
                    title: 'Warning',
                    description: 'No document to delete',
                    variant: 'default'
                });
                return;
            }

            // Use the onDocumentDelete function passed from props
            await onDocumentDelete(recordId, documentType);
            
            // Manually update the local state after successful deletion
            const updatedRecords = records.map(r => {
                if (r.id === recordId) {
                    const updatedDocuments = { ...r.payment_receipts_documents };
                    delete updatedDocuments[documentType];
                    
                    return {
                        ...r,
                        payment_receipts_documents: updatedDocuments
                    };
                }
                return r;
            });
            
            // Update the records state
            setPayrollRecords(updatedRecords);

            toast({
                title: 'Success',
                description: 'Document deleted successfully'
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete document',
                variant: 'destructive'
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

            const messageHistory = currentRecord.whatsapp_history || [];
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
            setPayrollRecords(records.map(r => {
                if (r.id === recordId) {
                    return {
                        ...r,
                        whatsapp_history: updatedHistory
                    };
                }
                return r;
            }));

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

    const [deleteAllDialog, setDeleteAllDialog] = useState<{
        isOpen: boolean;
        record: CompanyPayrollRecord | null;
    }>({ isOpen: false, record: null });

    const [documentViewerState, setDocumentViewerState] = useState<{
        isOpen: boolean;
        url: string;
        title: string;
        companyName: string;
        documentType: DocumentType | null;
        recordId: string | null;
    }>({
        isOpen: false,
        url: '',
        title: '',
        companyName: '',
        documentType: null,
        recordId: null
    });

    const openDocumentViewer = (record: CompanyPayrollRecord, documentType: DocumentType) => {
        if (!record.payment_receipts_documents?.[documentType]) return;
        
        const url = record.payment_receipts_documents[documentType] || '';
        const title = DOCUMENT_LABELS[documentType] || '';
        const companyName = record.company?.company_name || 'Unknown';
        
        setDocumentViewerState({
            isOpen: true,
            url,
            title,
            companyName,
            documentType,
            recordId: record.id
        });
    };

    const getDocumentCount = useCallback((record: CompanyPayrollRecord): number => {
        if (!record || !record.payment_receipts_documents) {
            return 0;
        }
        
        return Object.values(record.payment_receipts_documents).filter(Boolean).length;
    }, []);

    const allDocumentsUploaded = useCallback((record: CompanyPayrollRecord): boolean => {
        if (!record || !record.payment_receipts_documents) {
            return false;
        }
        
        const uploadedCount = getDocumentCount(record);
        return uploadedCount === Object.keys(DOCUMENT_LABELS).length - 1; // Subtract 1 for 'all_csv'
    }, [getDocumentCount]);

    const getDocumentsForUpload = useCallback((record: CompanyPayrollRecord) => {
        if (!record || !record.payment_receipts_documents) {
            return [];
        }

        const documents: Array<{
            type: DocumentType;
            status: 'pending' | 'uploaded';
            path?: string;
        }> = [];

        // Add all document types
        for (const docType of Object.keys(DOCUMENT_LABELS) as DocumentType[]) {
            if (docType !== 'all_csv') { // Skip all_csv as it's not a document type
                const path = record.payment_receipts_documents[docType];
                documents.push({
                    type: docType,
                    status: path ? 'uploaded' : 'pending',
                    path: path || undefined
                });
            }
        }

        return documents;
    }, []);

    const getUploadedDocCount = useCallback((record: any): number => {
        if (!record || !record.payment_receipts_documents) {
            return 0;
        }
        
        // Count only non-null document paths
        return Object.values(record.payment_receipts_documents)
            .filter(Boolean)
            .length;
    }, []);

    // Memoize sorted records for performance
    const sortedRecords = useMemo(() => {
        // First filter out records with invalid company data
        const validRecords = records.filter(record =>
            record && record.company && typeof record.company.company_name === 'string'
        );

        // Then sort the valid records
        return [...validRecords].sort((a, b) => {
            const nameA = a.company.company_name;
            const nameB = b.company.company_name;
            return nameA.localeCompare(nameB);
        });
    }, [records]);

    const handleBatchDocumentUpload = useCallback(async (recordId: string, documents: Array<{file: File, documentType: DocumentType}>) => {
        try {
            setIsSubmitting(true);
            const result = await onBatchDocumentUpload(recordId, documents, 'payment-receipts');
            
            if (result && result.success) {
                toast({
                    title: 'Success',
                    description: `Successfully uploaded ${documents.length} documents`
                });
                
                // Force refresh by updating records
                setPayrollRecords(prevRecords => {
                    return prevRecords.map(record => {
                        if (record.id === recordId) {
                            const updatedDocuments = {
                                ...record.payment_receipts_documents,
                                ...result.paths
                            };
                            
                            return {
                                ...record,
                                payment_receipts_documents: updatedDocuments
                            };
                        }
                        return record;
                    });
                });
            } else {
                toast({
                    title: 'Error',
                    description: result && result.error ? result.error : 'Failed to upload documents',
                    variant: 'destructive'
                });
            }
        } catch (error) {
            console.error('Batch document upload error:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'An unknown error occurred',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [onBatchDocumentUpload, toast, setPayrollRecords]);

    const handleEmailDateUpdate = useCallback(async (recordId: string) => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) return;
            
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    receipts_status: {
                        ...record.receipts_status,
                        email_date: new Date().toISOString()
                    }
                })
                .eq('id', recordId);

            if (updateError) throw updateError;

            toast({
                title: 'Success',
                description: 'Email date updated successfully'
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update email date',
                variant: 'destructive'
            });
        }
    }, [records, toast]);

    const handleEmailSent = useCallback(async (recordId: string, emailData: { date: string; recipients: string[] }) => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) return;

            // Fetch current record to get latest email history and status
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('email_history, receipts_status')
                .eq('id', recordId)
                .single();

            if (fetchError) throw fetchError;

            const emailHistory = currentRecord.email_history || [];
            const updatedHistory = [...emailHistory, emailData];

            // Update both email history and email date
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    email_history: updatedHistory,
                    receipts_status: {
                        ...currentRecord.receipts_status,
                        email_date: emailData.date
                    }
                })
                .eq('id', recordId);

            if (updateError) throw updateError;

            // Update local state
            setPayrollRecords(records.map(r => {
                if (r.id === recordId) {
                    return {
                        ...r,
                        email_history: updatedHistory,
                        receipts_status: {
                            ...r.receipts_status,
                            email_date: emailData.date
                        }
                    };
                }
                return r;
            }));

            toast({
                title: "Success",
                description: "Email sent and history updated successfully"
            });
        } catch (error) {
            console.error('Email history update error:', error);
            toast({
                title: "Error",
                description: "Failed to update email history",
                variant: "destructive"
            });
        }
    }, [records, setPayrollRecords, toast]);

    const handleFinalize = useCallback((recordId: string) => {
        onStatusUpdate(recordId, {
            verification_date: finalizeDialog.isNil ? 'NIL' : new Date().toISOString(),
            status: 'completed',
            assigned_to: finalizeDialog.assignedTo
        });
        setFinalizeDialog({ isOpen: false, recordId: null, assignedTo: 'Tushar', isNil: false });
    }, [finalizeDialog, onStatusUpdate]);

    const handleFilingConfirm = useCallback(async (recordId: string) => {
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
                    filedBy: record.status?.assigned_to || 'Unassigned'
                }
            };

            // Update the record in Supabase
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    status: updatedStatus
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

            setPayrollRecords(updatedRecords);

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
    }, [filingDialog, records, setFilingDialog, setPayrollRecords, toast]);

    const handleRemoveFiling = useCallback(async (recordId: string) => {
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
            setPayrollRecords(records.map(r =>
                r.id === recordId
                    ? { ...r, status: updatedStatus }
                    : r
            ));

            // Close the dialog and show success message
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
    }, [records, setFilingDialog, setPayrollRecords, toast]);

    const handleRemoveFilingStatus = useCallback(async (recordId: string) => {
        try {
            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    status: {
                        finalization_date: null,
                        assigned_to: null,
                        is_nil_filing: false
                    }
                })
                .eq('id', recordId);

            if (error) throw error;

            toast({
                title: "Success",
                description: "Filing status removed successfully"
            });

            // Update local state
            const updatedRecords = records.map(record => {
                if (record.id === recordId) {
                    return {
                        ...record,
                        status: {
                            ...record.status,
                            finalization_date: null,
                            assigned_to: null,
                            is_nil_filing: false
                        }
                    };
                }
                return record;
            });

            setPayrollRecords(updatedRecords);
        } catch (error) {
            console.error('Error removing filing status:', error);
            toast({
                title: "Error",
                description: "Failed to remove filing status. Please try again.",
                variant: "destructive",
            });
        }
    }, [records, setPayrollRecords, toast]);

    const handleDownload = useCallback(async (path: string): Promise<void> => {
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
    }, [toast]);

    const handleDownloadAll = useCallback(async (record: CompanyPayrollRecord) => {
        try {
            // Add null check for payment_receipts_documents
            if (!record.payment_receipts_documents) {
                toast({
                    title: 'Warning',
                    description: 'No documents available to download',
                    variant: 'default'
                });
                return;
            }
            
            const documentsToDownload = Object.entries(record.payment_receipts_documents)
                .filter(([key, value]) => key !== 'all_csv' && value !== null);

            if (documentsToDownload.length === 0) {
                toast({
                    title: 'Warning',
                    description: 'No documents available to download',
                    variant: 'default'
                });
                return;
            }

            toast({
                title: 'Downloading',
                description: `Downloading ${documentsToDownload.length} documents...`
            });

            // Process downloads in batches for better performance
            for (let i = 0; i < documentsToDownload.length; i += BATCH_SIZE) {
                const batch = documentsToDownload.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async ([_, path]) => {
                    if (path) await handleDownload(path);
                }));
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
    }, [handleDownload, toast]);

    return (
        <div className="rounded-md border h-[calc(100vh-220px)] overflow-auto">
            <Table aria-label="Payroll Records" className="border border-gray-200">
                <TableHeader className="bg-blue-500 text-white">
                    <TableRow>
                        {columnVisibility?.index !== false && (
                            <TableHead className="text-white font-semibold" scope="col">#</TableHead>
                        )}
                        {columnVisibility?.companyName !== false && (
                            <TableHead className="text-white font-semibold" scope="col">Company Name</TableHead>
                        )}
                        {columnVisibility?.emailDate !== false && (
                            <TableHead className="text-white font-semibold" scope="col">Email Date</TableHead>
                        )}
                        {columnVisibility?.whatsappDate !== false && (
                            <TableHead className="text-white font-semibold" scope="col">WhatsApp Date</TableHead>
                        )}
                        {columnVisibility?.payeReceipt !== false && (
                            <TableHead className="text-white font-semibold" scope="col">PAYE Receipt</TableHead>
                        )}
                        {columnVisibility?.housingLevyReceipt !== false && (
                            <TableHead className="text-white font-semibold" scope="col">Housing Levy Receipt</TableHead>
                        )}
                        {columnVisibility?.nitaReceipt !== false && (
                            <TableHead className="text-white font-semibold" scope="col">NITA Receipt</TableHead>
                        )}
                        {columnVisibility?.shifReceipt !== false && (
                            <TableHead className="text-white font-semibold" scope="col">SHIF Receipt</TableHead>
                        )}
                        {columnVisibility?.nssfReceipt !== false && (
                            <TableHead className="text-white font-semibold" scope="col">NSSF Receipt</TableHead>
                        )}
                        {columnVisibility?.allDocuments !== false && (
                            <TableHead className="text-white font-semibold" scope="col">All Documents</TableHead>
                        )}
                        {columnVisibility?.actions !== false && (
                            <TableHead className="text-white font-semibold" scope="col">Actions</TableHead>
                        )}
                        {columnVisibility?.emailStatus !== false && (
                            <TableHead className="text-white font-semibold" scope="col">Email Status</TableHead>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={14} className="text-center py-8 border">
                                <div role="status" className="animate-pulse">
                                    <div className="h-4 bg-gray-200 rounded-full w-48 mb-4"></div>
                                    <span className="sr-only">Loading...</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : sortedRecords.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={14} className="text-center py-8 border">
                                No valid records found
                            </TableCell>
                        </TableRow>
                    ) : sortedRecords.map((record, index) => {
                        // Add safety check
                        if (!record?.company?.company_name) {
                            return null;
                        }

                        return (
                        <TableRow
                            key={record.id}
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
                            {columnVisibility?.emailDate !== false && (
                                <TableCell className="text-center">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="relative h-8 w-8 p-0"
                                                    onClick={() => {
                                                        const emailHistory = record.email_history || [];
                                                        if (emailHistory.length > 0) {
                                                            toast({
                                                                title: "Email History",
                                                                description: (
                                                                    <div className="mt-2 space-y-1">
                                                                        {emailHistory.map((history, i) => (
                                                                            <div key={i} className="text-sm">
                                                                                <p>Sent: {format(new Date(history.date), 'dd/MM/yyyy HH:mm')}</p>
                                                                                <p className="text-xs text-gray-500">To: {history.recipients.join(', ')}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ),
                                                                duration: 5000,
                                                            });
                                                        }
                                                    }}
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
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                {record.email_history?.length > 0 ? (
                                                    <div className="space-y-2">
                                                        <p className="font-medium">Latest Email: {format(new Date(record.email_history[record.email_history.length - 1].date), 'dd/MM/yyyy HH:mm')}</p>
                                                        <p className="text-sm text-gray-500">Click to view full history</p>
                                                    </div>
                                                ) : (
                                                    "No emails sent yet"
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableCell>
                            )}
                            {columnVisibility?.whatsappDate !== false && (
                                <TableCell className="text-center">
                                    <WhatsAppModal
                                        trigger={
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0"
                                            >
                                                <MessageSquare className="h-4 w-4" />
                                            </Button>
                                        }
                                        companyName={record.company?.company_name || ''}
                                        companyPhone={record.company?.phone_number || ''}
                                        documents={getDocumentsForUpload(record)}
                                        onMessageSent={(data) => {
                                            // Update message history if needed
                                            handleMessageSent(record.id, data);
                                        }}
                                    />
                                </TableCell>
                            )}
                            {columnVisibility?.payeReceipt !== false && (
                                <TableCell className="text-center">
                                    {getDocumentsForUpload(record).find(doc => doc.type === 'paye_receipt')?.status === 'uploaded' ? (
                                        <div className="flex justify-center items-center space-x-1">
                                            <Button 
                                                size="sm"
                                                className="bg-green-500 hover:bg-green-600 h-6 text-xs px-2"
                                                onClick={() => openDocumentViewer(record, 'paye_receipt')}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                onClick={() => handleDocumentDelete(record.id, 'paye_receipt')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-center">
                                            <DocumentUploadDialog
                                                documentType="paye_receipt"
                                                recordId={record.id}
                                                onUpload={(file, docType) => handleLocalDocumentUpload(record.id, file, docType || 'paye_receipt')}
                                                onDelete={() => handleDocumentDelete(record.id, 'paye_receipt')}
                                                existingDocument={record.payment_receipts_documents?.paye_receipt || null}
                                                label={DOCUMENT_LABELS['paye_receipt']}
                                                isNilFiling={record.status?.finalization_date === 'NIL'}
                                                allDocuments={getDocumentsForUpload(record)}
                                                companyName={record.company?.company_name || 'Unknown'}
                                                onBatchDocumentUpload={(documents) => handleBatchDocumentUpload(record.id, documents)}
                                            />
                                        </div>
                                    )}
                                </TableCell>
                            )}
                            {columnVisibility?.housingLevyReceipt !== false && (
                                <TableCell className="text-center">
                                    {getDocumentsForUpload(record).find(doc => doc.type === 'housing_levy_receipt')?.status === 'uploaded' ? (
                                        <div className="flex justify-center items-center space-x-1">
                                            <Button 
                                                size="sm"
                                                className="bg-green-500 hover:bg-green-600 h-6 text-xs px-2"
                                                onClick={() => openDocumentViewer(record, 'housing_levy_receipt')}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                onClick={() => handleDocumentDelete(record.id, 'housing_levy_receipt')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-center">
                                            <DocumentUploadDialog
                                                documentType="housing_levy_receipt"
                                                recordId={record.id}
                                                onUpload={(file, docType) => handleLocalDocumentUpload(record.id, file, docType || 'housing_levy_receipt')}
                                                onDelete={() => handleDocumentDelete(record.id, 'housing_levy_receipt')}
                                                existingDocument={record.payment_receipts_documents?.housing_levy_receipt || null}
                                                label={DOCUMENT_LABELS['housing_levy_receipt']}
                                                isNilFiling={record.status?.finalization_date === 'NIL'}
                                                allDocuments={getDocumentsForUpload(record)}
                                                companyName={record.company?.company_name || 'Unknown'}
                                                onBatchDocumentUpload={(documents) => handleBatchDocumentUpload(record.id, documents)}
                                            />
                                        </div>
                                    )}
                                </TableCell>
                            )}
                            {columnVisibility?.nitaReceipt !== false && (
                                <TableCell className="text-center">
                                    {getDocumentsForUpload(record).find(doc => doc.type === 'nita_receipt')?.status === 'uploaded' ? (
                                        <div className="flex justify-center items-center space-x-1">
                                            <Button 
                                                size="sm"
                                                className="bg-green-500 hover:bg-green-600 h-6 text-xs px-2"
                                                onClick={() => openDocumentViewer(record, 'nita_receipt')}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                onClick={() => handleDocumentDelete(record.id, 'nita_receipt')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-center">
                                            <DocumentUploadDialog
                                                documentType="nita_receipt"
                                                recordId={record.id}
                                                onUpload={(file, docType) => handleLocalDocumentUpload(record.id, file, docType || 'nita_receipt')}
                                                onDelete={() => handleDocumentDelete(record.id, 'nita_receipt')}
                                                existingDocument={record.payment_receipts_documents?.nita_receipt || null}
                                                label={DOCUMENT_LABELS['nita_receipt']}
                                                isNilFiling={record.status?.finalization_date === 'NIL'}
                                                allDocuments={getDocumentsForUpload(record)}
                                                companyName={record.company?.company_name || 'Unknown'}
                                                onBatchDocumentUpload={(documents) => handleBatchDocumentUpload(record.id, documents)}
                                            />
                                        </div>
                                    )}
                                </TableCell>
                            )}
                            {columnVisibility?.shifReceipt !== false && (
                                <TableCell className="text-center">
                                    {getDocumentsForUpload(record).find(doc => doc.type === 'shif_receipt')?.status === 'uploaded' ? (
                                        <div className="flex justify-center items-center space-x-1">
                                            <Button 
                                                size="sm"
                                                className="bg-green-500 hover:bg-green-600 h-6 text-xs px-2"
                                                onClick={() => openDocumentViewer(record, 'shif_receipt')}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                onClick={() => handleDocumentDelete(record.id, 'shif_receipt')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-center">
                                            <DocumentUploadDialog
                                                documentType="shif_receipt"
                                                recordId={record.id}
                                                onUpload={(file, docType) => handleLocalDocumentUpload(record.id, file, docType || 'shif_receipt')}
                                                onDelete={() => handleDocumentDelete(record.id, 'shif_receipt')}
                                                existingDocument={record.payment_receipts_documents?.shif_receipt || null}
                                                label={DOCUMENT_LABELS['shif_receipt']}
                                                isNilFiling={record.status?.finalization_date === 'NIL'}
                                                allDocuments={getDocumentsForUpload(record)}
                                                companyName={record.company?.company_name || 'Unknown'}
                                                onBatchDocumentUpload={(documents) => handleBatchDocumentUpload(record.id, documents)}
                                            />
                                        </div>
                                    )}
                                </TableCell>
                            )}
                            {columnVisibility?.nssfReceipt !== false && (
                                <TableCell className="text-center">
                                    {getDocumentsForUpload(record).find(doc => doc.type === 'nssf_receipt')?.status === 'uploaded' ? (
                                        <div className="flex justify-center items-center space-x-1">
                                            <Button 
                                                size="sm"
                                                className="bg-green-500 hover:bg-green-600 h-6 text-xs px-2"
                                                onClick={() => openDocumentViewer(record, 'nssf_receipt')}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                onClick={() => handleDocumentDelete(record.id, 'nssf_receipt')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-center">
                                            <DocumentUploadDialog
                                                documentType="nssf_receipt"
                                                recordId={record.id}
                                                onUpload={(file, docType) => handleLocalDocumentUpload(record.id, file, docType || 'nssf_receipt')}
                                                onDelete={() => handleDocumentDelete(record.id, 'nssf_receipt')}
                                                existingDocument={record.payment_receipts_documents?.nssf_receipt || null}
                                                label={DOCUMENT_LABELS['nssf_receipt']}
                                                isNilFiling={record.status?.finalization_date === 'NIL'}
                                                allDocuments={getDocumentsForUpload(record)}
                                                companyName={record.company?.company_name || 'Unknown'}
                                                onBatchDocumentUpload={(documents) => handleBatchDocumentUpload(record.id, documents)}
                                            />
                                        </div>
                                    )}
                                </TableCell>
                            )}
                            {/* {columnVisibility?.nhifReceipt !== false && (
                                <TableCell className="text-center">
                                    {getDocumentsForUpload(record).find(doc => doc.type === 'nhif_receipt')?.status === 'uploaded' ? (
                                        <div className="flex justify-center items-center space-x-1">
                                            <Button 
                                                size="sm"
                                                className="bg-green-500 hover:bg-green-600 h-6 text-xs px-2"
                                                onClick={() => openDocumentViewer(record, 'nhif_receipt')}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                onClick={() => handleDocumentDelete(record.id, 'nhif_receipt')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-center">
                                            <DocumentUploadDialog
                                                documentType="nhif_receipt"
                                                recordId={record.id}
                                                onUpload={(file) => handleLocalDocumentUpload(record.id, file, 'nhif_receipt')}
                                                onDelete={() => handleDocumentDelete(record.id, 'nhif_receipt')}
                                                existingDocument={record.payment_receipts_documents?.nhif_receipt || null}
                                                label={DOCUMENT_LABELS['nhif_receipt']}
                                                isNilFiling={record.status?.finalization_date === 'NIL'}
                                                allDocuments={getDocumentsForUpload(record)}
                                                companyName={record.company?.company_name || 'Unknown'}
                                            />
                                        </div>
                                    )}
                                </TableCell>
                            )} */}
                            {columnVisibility?.allDocuments !== false && (
                                <TableCell className="text-center">
                                    <Badge className={record.status?.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-blue-500'}>
                                        {record.status?.finalization_date === 'NIL' ? 'N/A' : `${getUploadedDocCount(record)}/${Object.keys(DOCUMENT_LABELS).length - 1}`}
                                    </Badge>
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
                                        <DropdownMenuContent align="end" className="w-auto">
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
                                                onClick={() => handleDeleteAll(record)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Delete All Documents
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            )}
                            {columnVisibility?.emailStatus !== false && (
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
                                                                    <div className="absolute -top-2 -right-2">
                                                                        <Badge
                                                                            className="h-5 w-5 rounded-full bg-green-500 text-white"
                                                                            variant="secondary"
                                                                        >
                                                                            {record.email_history.length}
                                                                        </Badge>
                                                                    </div>
                                                                )}
                                                            </Button>
                                                        }
                                                        companyName={record.company?.company_name || ''}
                                                        companyEmail={record.company?.email || ''}
                                                        documents={getDocumentsForUpload(record)}
                                                        onEmailSent={(data) => handleEmailSent(record.id, data)}
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {record.email_history?.length > 0 ? (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <p className="font-medium">Email History</p>
                                                                <Badge variant="outline" className="ml-2">
                                                                    {record.email_history.length} {record.email_history.length === 1 ? 'time' : 'times'}
                                                                </Badge>
                                                            </div>
                                                            <div className="max-h-48 overflow-y-auto space-y-2">
                                                                {record.email_history.map((history, i) => (
                                                                    <div key={i} className="text-sm bg-gray-50 p-2 rounded">
                                                                        <p className="font-medium">{format(new Date(history.date), 'dd/MM/yyyy HH:mm')}</p>
                                                                        <p className="text-xs text-gray-500 truncate">
                                                                            To: {history.recipients.join(', ')}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-2">
                                                            <p>No emails sent yet</p>
                                                            <p className="text-xs text-gray-500 mt-1">Click to send documents</p>
                                                        </div>
                                                    )}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </TableCell>
                            )}
                        </TableRow>
                        );
                    })}
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
                onOpenChange={(isOpen) => {
                    if (!isOpen) setFilingDialog(prev => ({ ...prev, isOpen }));
                }}
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
                            Document Details - {documentDetailsDialog.record?.company.company_name}
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
                                    {documentDetailsDialog.record.status.finalization_date !== null && (
                                        <Button
                                            size="sm"
                                            className={documentDetailsDialog.record.status.finalization_date === 'NIL' ? 'bg-amber-500' : 'bg-purple-500'}
                                            onClick={() => {
                                                // Toggle between NIL and non-NIL status
                                                onStatusUpdate(documentDetailsDialog.record!.id, {
                                                    finalization_date: documentDetailsDialog.record!.status.finalization_date === 'NIL' ?
                                                        new Date().toISOString() : 'NIL',
                                                    status: 'completed'
                                                });
                                                setDocumentDetailsDialog({ isOpen: false, record: null });
                                            }}
                                        >
                                            {documentDetailsDialog.record.status.finalization_date === 'NIL' ?
                                                'Remove NIL Status' : 'Mark as NIL'}
                                        </Button>
                                    )}
                                </div> */}
                                {Object.entries(DOCUMENT_LABELS)
                                    .filter(([key]) => key !== 'all_csv') // Remove All CSV Files
                                    .map(([type, label]) => {
                                        const document = documentDetailsDialog?.record?.payment_receipts_documents?.[type as DocumentType];
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
                onOpenChange={(isOpen) => {
                    if (!isOpen) setDeleteAllDialog({ isOpen: false, record: null });
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will delete all documents for this record. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => {
                                if (deleteAllDialog.record) {
                                    handleDeleteAllDocuments(deleteAllDialog.record.id);
                                    setDeleteAllDialog({ isOpen: false, record: null });
                                }
                            }}
                        >
                            Delete All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {documentViewerState.isOpen && (
                <DocumentViewer
                    url={documentViewerState.url}
                    isOpen={documentViewerState.isOpen}
                    onClose={() => setDocumentViewerState(prev => ({ ...prev, isOpen: false }))}
                    title={documentViewerState.title}
                    companyName={documentViewerState.companyName}
                    documentType={documentViewerState.documentType || ''}
                    recordId={documentViewerState.recordId || ''}
                    onExtractionsUpdate={(extractions) => {
                        console.log('Extractions updated:', extractions);
                        // Handle extractions update if needed
                    }}
                />
            )}
        </div>
    )
}