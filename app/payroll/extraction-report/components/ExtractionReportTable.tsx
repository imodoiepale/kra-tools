// @ts-nocheck
import React, { useState, useMemo } from "react"
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
    ChevronUp,
    ChevronDown
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
import { DocumentViewer } from './DocumentViewer'
import {
    CompanyPayrollRecord,
    DocumentType,
    FilingDialogState
} from '.../types'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { processAllDocuments, ExtractionResult, TAX_TYPES } from '@/lib/extractionUtils'

const DOCUMENT_LABELS: Record<string, string> = {
    paye_receipt: "PAYE Receipt",
    housing_levy_receipt: "Housing Levy Receipt",
    nita_receipt: "NITA Receipt",
    shif_receipt: "SHIF Receipt",
    nssf_receipt: "NSSF Receipt",
    all_csv: "All CSV Files"
};

interface ExtractionReportTableProps {
    records: CompanyPayrollRecord[]
    onDocumentUpload: (recordId: string, file: File, documentType: DocumentType) => Promise<void>
    onDocumentDelete: (recordId: string, documentType: DocumentType) => Promise<void>
    onStatusUpdate: (recordId: string, statusUpdate: any) => Promise<void>
    loading: boolean
    setPayrollRecords: (records: CompanyPayrollRecord[]) => void
}

const formatDate = (date: string | null | undefined): JSX.Element => {
    if (!date) return <span className="text-red-600 font-bold">MISSING</span>;
    
    // Check if it's already in DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return <span>{date}</span>;
    
    // Try to parse the date
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return <span>{date}</span>;
    
    // Format as DD/MM/YYYY
    const day = parsed.getDate().toString().padStart(2, '0');
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const year = parsed.getFullYear();
    
    return <span className="text-center">{`${day}/${month}/${year}`}</span>;
};

const formatAmount = (amount: string | null | undefined): JSX.Element => {
    if (!amount) return <span className="text-red-600 font-bold">MISSING</span>;
    
    // Convert to number and format with commas, no decimals
    const numAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(numAmount)) return <span>{amount}</span>;
    
    return <span className="text-right font-mono">{Math.round(numAmount).toLocaleString('en-US')}</span>;
};

const getDocumentsForUpload = (record: CompanyPayrollRecord) => {
    return Object.entries(DOCUMENT_LABELS)
        .filter(([key]) => key !== 'all_csv')
        .map(([type, label]) => ({
            type: type as DocumentType,
            label,
            status: record.payment_receipts_documents?.[type as DocumentType] ? 'uploaded' as const : 'missing' as const,
            path: record.payment_receipts_documents?.[type as DocumentType]
        }));
};

const requiredDocs = ['paye_receipt', 'housing_levy_receipt', 'shif_receipt', 'nssf_receipt', 'nita_receipt'];

const allDocumentsUploaded = (record: CompanyPayrollRecord | undefined): boolean => {
    if (!record) return false;
    return requiredDocs.every(docType => record.payment_receipts_documents?.[docType as DocumentType] !== null);
};

const getDocumentCount = (record: CompanyPayrollRecord) => {
    if (record.status.finalization_date === 'NIL') {
        return 'N/A';
    }
    return `${requiredDocs.filter(docType =>
        record.payment_receipts_documents?.[docType as DocumentType] !== null
    ).length}/${requiredDocs.length}`;
};

const ensureExtractionsExist = (record: CompanyPayrollRecord) => {
    if (!record.payment_receipts_extractions) {
        return {
            ...record,
            payment_receipts_extractions: {}
        };
    }
    return record;
};

const renderStatusBadge = (extractedData: any) => {
    if (!extractedData || Object.keys(extractedData).length === 0) {
        return <Badge variant="outline" className="bg-gray-100 text-gray-500">Not Extracted</Badge>;
    }
    
    // Check if essential fields are extracted
    const hasAmount = !!extractedData.amount;
    const hasPaymentDate = !!extractedData.payment_date;
    const hasPaymentMode = !!extractedData.payment_mode;
    
    if (hasAmount && hasPaymentDate && hasPaymentMode) {
        return <Badge variant="outline" className="bg-green-100 text-green-700">Extracted</Badge>;
    } else {
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-700">Partial</Badge>;
    }
};

const renderColumnContent = (record: CompanyPayrollRecord, columnName: string, extractedData: any) => {
    // Make sure record has properly initialized extractions
    const recordWithExtractions = ensureExtractionsExist(record);
    
    switch (columnName) {
        case 'status':
            return renderStatusBadge(extractedData);
        case 'amount':
            if (!extractedData.amount) {
                return <span className="text-red-600 font-bold">MISSING</span>;
            }
            return formatAmount(extractedData.amount);
        case 'payment_mode':
            if (!extractedData.payment_mode) {
                return <span className="text-red-600 font-bold">MISSING</span>;
            }
            return <span className="text-center">{extractedData.payment_mode}</span>;
        case 'payment_date':
            if (!extractedData.payment_date) {
                return <span className="text-red-600 font-bold">MISSING</span>;
            }
            return formatDate(extractedData.payment_date);
        case 'bank_name':
            if (extractedData.payment_mode === 'Mpesa') {
                return <span className="text-center">N/A</span>;
            }
            if (!extractedData.bank_name) {
                return <span className="text-red-600 font-bold">MISSING</span>;
            }
            return <span className="text-center">{extractedData.bank_name}</span>;
        default:
            return null;
    }
};

export function ExtractionReportTable({
    records,
    onDocumentUpload,
    onStatusUpdate,
    onDocumentDelete,
    loading,
    setPayrollRecords
}: ExtractionReportTableProps) {
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
    
    const [documentViewerDialog, setDocumentViewerDialog] = useState<{
        isOpen: boolean;
        documentPath: string;
        documentType: string;
        recordId: string;
        companyName: string;
        title: string;
        extractions: any | null;
    }>({
        isOpen: false,
        documentPath: '',
        documentType: '',
        recordId: '',
        companyName: '',
        title: '',
        extractions: null
    });

    const handleOpenDocument = (path: string, docType: string, recordId: string, companyName: string, title: string, extractions: any) => {
        console.log('Opening document with extractions:', extractions);
        setDocumentViewerDialog({
            isOpen: true,
            documentPath: path,
            documentType: docType,
            recordId: recordId,
            companyName: companyName,
            title: title,
            extractions: extractions || {}
        });
    };

    const handleExtractionsUpdate = (recordId: string, documentType: string, updatedExtractions: any) => {
        // Update local state with new extractions
        console.log('Updating extractions:', recordId, documentType, updatedExtractions);
        
        const updatedRecords = records.map(record => {
            if (record.id === recordId) {
                // Make sure payment_receipts_extractions exists
                const recordWithExtractions = ensureExtractionsExist(record);
                
                return {
                    ...recordWithExtractions,
                    payment_receipts_extractions: {
                        ...recordWithExtractions.payment_receipts_extractions,
                        [documentType]: updatedExtractions
                    }
                };
            }
            return record;
        });
        
        // Update the records in parent component
        setPayrollRecords(updatedRecords);
        
        // Also update in Supabase
        updateExtractionsInDatabase(recordId, documentType, updatedExtractions);
    };
    
    const updateExtractionsInDatabase = async (recordId: string, documentType: string, updatedExtractions: any) => {
        try {
            // First get the current record to ensure we have the latest data
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('payment_receipts_extractions')
                .eq('id', recordId)
                .single();
                
            if (fetchError) {
                console.error('Error fetching current record:', fetchError);
                return;
            }
            
            // Prepare the updated extractions object
            const currentExtractions = currentRecord?.payment_receipts_extractions || {};
            const newExtractions = {
                ...currentExtractions,
                [documentType]: updatedExtractions
            };
            
            // Update in database
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_receipts_extractions: newExtractions
                })
                .eq('id', recordId);
                
            if (updateError) {
                console.error('Error updating extractions:', updateError);
                toast({
                    title: "Error",
                    description: "Failed to save extraction data to database",
                    variant: "destructive"
                });
            } else {
                toast({
                    title: "Success",
                    description: "Extraction data saved successfully",
                    variant: "default"
                });
            }
        } catch (error) {
            console.error('Error in updateExtractionsInDatabase:', error);
        }
    };

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
    };

    const [deleteAllDialog, setDeleteAllDialog] = useState<{
        isOpen: boolean;
        record: CompanyPayrollRecord | null;
    }>({ isOpen: false, record: null });

    const handleDeleteAll = async (record: CompanyPayrollRecord) => {
        try {
            setIsSubmitting(true);

            // Filter out null values before using the paths
            const documentsToDelete = Object.entries(record.payment_receipts_documents).filter(([_, path]) => path !== null) as [DocumentType, string][];

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
                    payment_receipts_documents: {
                        paye_receipt: null,
                        housing_levy_receipt: null,
                        shif_receipt: null,
                        nssf_receipt: null,
                        nita_receipt: null
                    }
                })
                .eq('id', record.id);

            if (updateError) throw updateError;

            // Update local state
            const updatedRecords: CompanyPayrollRecord[] = records.map(r => {
                if (r.id === record.id) {
                    return {
                        ...r,
                        payment_receipts_documents: {
                            paye_receipt: null,
                            housing_levy_receipt: null,
                            shif_receipt: null,
                            nssf_receipt: null,
                            nita_receipt: null
                        }
                    };
                }
                return r;
            });
            setPayrollRecords(updatedRecords);

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
            const documentsToDownload = Object.entries(record.payment_receipts_documents)
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

            if (!record.company || !record.company.company_name) {
                throw new Error('Company information is missing');
            }

            // First, fetch the current record to get latest document paths
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('payment_receipts_documents')
                .eq('id', recordId)
                .single();

            if (fetchError) throw fetchError;
            if (!currentRecord) throw new Error('Failed to fetch current record');

            const fileName = `${documentType} - ${record.company.company_name} - ${format(new Date(), 'yyyy-MM-dd')}${file.name.substring(file.name.lastIndexOf('.'))}`;
            const filePath = `${selectedMonthYear}/PAYMENT SLIPS/${record.company.company_name}/${fileName}`;

            // Upload file to storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('Payroll-Cycle')
                .upload(filePath, file, {
                    cacheControl: '0',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Preserve existing document paths and update the new one
            const updatedDocuments = {
                ...currentRecord.payment_receipts_documents,
                [documentType]: uploadData.path
            };

            // Update database record with merged document paths
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_receipts_documents: updatedDocuments
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
            const updatedRecords: CompanyPayrollRecord[] = records.map(r => {
                if (r.id === recordId) {
                    return {
                        ...r,
                        payment_receipts_documents: updatedDocuments
                    };
                }
                return r;
            });
            setPayrollRecords(updatedRecords);

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
            if (!record) return;

            const documentPath = record.payment_receipts_documents[documentType];
            if (!documentPath) return;

            const { error: deleteError } = await supabase.storage
                .from('Payroll-Cycle')
                .remove([documentPath]);

            if (deleteError) throw deleteError;

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_receipts_documents: {
                        ...record.payment_receipts_documents,
                        [documentType]: null
                    }
                })
                .eq('id', recordId);

            if (updateError) throw updateError;

            // Update local state
            const updatedRecords: CompanyPayrollRecord[] = records.map(r => {
                if (r.id === recordId) {
                    return {
                        ...r,
                        payment_receipts_documents: {
                            ...r.payment_receipts_documents,
                            [documentType]: null
                        }
                    };
                }
                return r;
            });
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

    const renderDocumentCell = (record: CompanyPayrollRecord, docType: string, label: string) => {
        // Make sure record is properly initialized with extractions
        const recordWithExtractions = ensureExtractionsExist(record);
        
        const documentPath = recordWithExtractions.payment_receipts_documents?.[docType];
        const extractions = recordWithExtractions.payment_receipts_extractions?.[docType];
        
        return (
            <div className="flex flex-col gap-1 items-start">
                <div className="flex gap-2 items-center">
                    <DocumentUploadDialog
                        documentType={docType}
                        recordId={record.id}
                        onUpload={(file) => onDocumentUpload(record.id, file, docType)}
                        onDelete={() => onDocumentDelete(record.id, docType)}
                        existingDocument={documentPath}
                        label={label}
                        isNilFiling={record.status?.finalization_date === 'NIL'}
                        allDocuments={getDocumentsForUpload(record)}
                        companyName={record.company.company_name}
                    />
                    
                    {documentPath && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-green-600 hover:text-green-700 px-2"
                            onClick={() => handleOpenDocument(
                                documentPath,
                                docType,
                                record.id,
                                record.company.company_name,
                                label,
                                extractions
                            )}
                        >
                            <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                    )}
                </div>
                
                {extractions && (
                    <div className="text-xs w-full mt-1">
                        {extractions.amount && <div className="font-semibold">Amount: {formatAmount(extractions.amount)}</div>}
                        {extractions.payment_mode && <div>Mode: {extractions.payment_mode}</div>}
                        {extractions.payment_date && <div>Date: {formatDate(extractions.payment_date)}</div>}
                        {extractions.bank_name && <div>Bank: {extractions.bank_name}</div>}
                    </div>
                )}
            </div>
        );
    };

    const [expandedRecords, setExpandedRecords] = useState<string[]>([]);

    const handleToggleExpanded = (recordId: string) => {
        if (expandedRecords.includes(recordId)) {
            setExpandedRecords(expandedRecords.filter(id => id !== recordId));
        } else {
            setExpandedRecords([...expandedRecords, recordId]);
        }
    };

    const taxTypes = TAX_TYPES;

    const mapTaxTypeToReceiptType = (taxTypeId: string) => {
        switch (taxTypeId) {
            case 'paye':
                return 'paye_receipt';
            case 'housing_levy':
                return 'housing_levy_receipt';
            case 'nita':
                return 'nita_receipt';
            case 'shif':
                return 'shif_receipt';
            case 'nssf':
                return 'nssf_receipt';
            default:
                return '';
        }
    };

    const getDocumentPath = (record: CompanyPayrollRecord, receiptType: string) => {
        return record.payment_receipts_documents?.[receiptType];
    };

    return (
        <div className="rounded-md border h-[calc(100vh-220px)] overflow-auto">
            <Table className="w-full text-sm border-collapse">
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="bg-blue-600 text-white font-medium text-xs h-8 py-1 px-2 min-w-[50px]">
                            #
                        </TableHead>
                        <TableHead className="bg-blue-600 text-white font-medium text-xs h-8 py-1 px-2 min-w-[180px]">
                            Company
                        </TableHead>
                        <TableHead className="bg-blue-600 text-white font-medium text-xs h-8 py-1 px-2 min-w-[120px]">
                            Period
                        </TableHead>
                        <TableHead className="bg-blue-600 text-white font-medium text-xs h-8 py-1 px-2 min-w-[120px]">
                            Status
                        </TableHead>
                        <TableHead className="bg-blue-600 text-white font-medium text-xs h-8 py-1 px-2 min-w-[120px]">
                            Document Status
                        </TableHead>
                        <TableHead className="bg-blue-600 text-white font-medium text-xs h-8 py-1 px-2">
                            Actions
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody className="text-xs font-medium">
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">
                                <div role="status" className="animate-pulse">
                                    <div className="h-4 bg-gray-200 rounded-full w-48 mb-4"></div>
                                    <span className="sr-only">Loading...</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : records.map((record, index) => (
                        <React.Fragment key={record.id}>
                            <TableRow
                                className={
                                    `${index % 2 === 0 ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'}
                                    [&>td]:border-r [&>td]:border-gray-200 last:[&>td]:border-r-0`
                                }
                            >
                                <TableCell className="py-1 px-2 h-10">
                                    <span className="text-center">{index + 1}</span>
                                </TableCell>
                                <TableCell className="py-1 px-2 h-10">
                                    <span className="text-center">{record.company.company_name}</span>
                                </TableCell>
                                <TableCell className="py-1 px-2 h-10">
                                    <span className="text-center">{record.period}</span>
                                </TableCell>
                                <TableCell className="py-1 px-2 h-10">
                                    <span className="text-center">{record.status.status}</span>
                                </TableCell>
                                <TableCell className="py-1 px-2 h-10">
                                    <span className="text-center">{getDocumentCount(record)}</span>
                                </TableCell>
                                <TableCell className="py-1 px-2 h-10">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem
                                                onClick={() => handleToggleExpanded(record.id)}
                                                className="flex items-center gap-2"
                                            >
                                                {expandedRecords.includes(record.id) ? (
                                                    <>
                                                        <ChevronUp className="h-4 w-4" />
                                                        Collapse Details
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="h-4 w-4" />
                                                        Expand Details
                                                    </>
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => setDocumentDetailsDialog({ isOpen: true, record })}
                                                className="flex items-center gap-2"
                                            >
                                                <Eye className="h-4 w-4" />
                                                View Documents
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
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                            {expandedRecords.includes(record.id) && (
                                <TableRow className="bg-gray-50 hover:bg-gray-50">
                                    <TableCell colSpan={6} className="p-0">
                                        <div className="py-2">
                                            <h4 className="font-medium text-xs px-3 mb-2">Payment Receipts</h4>
                                            
                                            {/* Tax types grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-3">
                                                {taxTypes.map((tax, taxIndex) => {
                                                    const receiptType = mapTaxTypeToReceiptType(tax.id);
                                                    const extractedData = record.payment_receipts_extractions?.[receiptType] || {};
                                                    const docPath = getDocumentPath(record, receiptType);
                                                    
                                                    return (
                                                        <div key={`${record.id}-${tax.id}`} className="border rounded-md bg-white shadow-sm">
                                                            <div className={`flex items-center justify-between px-2 py-1 ${tax.color} text-white rounded-t-md`}>
                                                                <h5 className="font-medium text-xs">{tax.label}</h5>
                                                            </div>
                                                            <div className="p-2">
                                                                <div className="flex flex-col space-y-1">
                                                                    <div className="flex flex-row justify-between text-xs">
                                                                        <span className="text-gray-500">Document:</span>
                                                                        <div>
                                                                            {renderDocumentCell(record, receiptType, tax.label)}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-row justify-between text-xs">
                                                                        <span className="text-gray-500">Amount:</span>
                                                                        <span>{extractedData.amount ? formatAmount(extractedData.amount) : <span className="text-red-600 font-bold">MISSING</span>}</span>
                                                                    </div>
                                                                    <div className="flex flex-row justify-between text-xs">
                                                                        <span className="text-gray-500">Pay Mode:</span>
                                                                        <span>{extractedData.payment_mode || <span className="text-red-600 font-bold">MISSING</span>}</span>
                                                                    </div>
                                                                    <div className="flex flex-row justify-between text-xs">
                                                                        <span className="text-gray-500">Pay Date:</span>
                                                                        <span>{extractedData.payment_date ? formatDate(extractedData.payment_date) : <span className="text-red-600 font-bold">MISSING</span>}</span>
                                                                    </div>
                                                                    <div className="flex flex-row justify-between text-xs">
                                                                        <span className="text-gray-500">Bank:</span>
                                                                        <span>
                                                                            {extractedData.payment_mode === 'Mpesa' ? 
                                                                                <span>N/A</span> : 
                                                                                (extractedData.bank_name || <span className="text-red-600 font-bold">MISSING</span>)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </React.Fragment>
                    ))}
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
                            Document Details - {documentDetailsDialog.record?.company.company_name}
                        </DialogTitle>
                    </DialogHeader>
                    {documentDetailsDialog.record && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Finalization Date</Label>
                                    <div className="flex items-center gap-2">
                                        <Badge className={documentDetailsDialog.record.status.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-green-500'}>
                                            {formatDate(documentDetailsDialog.record.status.finalization_date)}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Assigned To</Label>
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-blue-500">
                                            {documentDetailsDialog.record.status.assigned_to || 'Unassigned'}
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
                                        const document = documentDetailsDialog?.record?.payment_receipts_documents[type as DocumentType];
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

            {/* Document viewer dialog */}
            <DocumentViewer
                url={documentViewerDialog.documentPath}
                isOpen={documentViewerDialog.isOpen}
                onClose={() => setDocumentViewerDialog(prev => ({ ...prev, isOpen: false }))}
                title={documentViewerDialog.title}
                companyName={documentViewerDialog.companyName}
                documentType={documentViewerDialog.documentType}
                recordId={documentViewerDialog.recordId}
                extractions={documentViewerDialog.extractions}
                onExtractionsUpdate={(updatedExtractions) => 
                    handleExtractionsUpdate(
                        documentViewerDialog.recordId, 
                        documentViewerDialog.documentType, 
                        updatedExtractions
                    )
                }
            />
        </div>
    )
}