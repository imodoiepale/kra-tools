// TaxPaymentTable.tsx
'use client'

import { useState, useMemo } from "react"
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
    MessageSquare
} from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
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
import { CompanyTaxPaymentRecord, DocumentType } from '../types'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

const DOCUMENT_LABELS: Record<string, string> = {
    paye_ack: "PAYE Ack.",
    paye: "PAYE Payment",
    housing_levy: "Housing Levy",
    shif: "SHIF",
    nssf: "NSSF"
};

interface TaxPaymentTableProps {
    records: CompanyTaxPaymentRecord[]
    onDocumentUpload: (recordId: string, file: File, documentType: DocumentType) => Promise<void>
    onDocumentDelete: (recordId: string, documentType: DocumentType) => Promise<void>
    onStatusUpdate: (recordId: string, statusUpdate: Partial<CompanyTaxPaymentRecord['status']>) => Promise<void>
    loading: boolean
    setTaxPaymentRecords: React.Dispatch<React.SetStateAction<CompanyTaxPaymentRecord[]>>
}

export function TaxPaymentTable({
    records,
    onDocumentUpload,
    onDocumentDelete,
    onStatusUpdate,
    loading,
    setTaxPaymentRecords
}: TaxPaymentTableProps) {
    const { toast } = useToast()
    const [selectedDocument, setSelectedDocument] = useState<{
        recordId: string;
        docType: DocumentType;
        path: string | null;
    } | null>(null);

    const [uploadDialog, setUploadDialog] = useState<{
        isOpen: boolean;
        recordId: string | null;
        docType: DocumentType | null;
    }>({
        isOpen: false,
        recordId: null,
        docType: null
    });

    const [deleteDialog, setDeleteDialog] = useState<{
        isOpen: boolean;
        recordId: string | null;
        docType: DocumentType | null;
    }>({
        isOpen: false,
        recordId: null,
        docType: null
    });

    const [viewDialog, setViewDialog] = useState<{
        isOpen: boolean;
        url: string | null;
    }>({
        isOpen: false,
        url: null
    });

    const [filingDialog, setFilingDialog] = useState<{
        isOpen: boolean;
        recordId: string | null;
        isNil: boolean;
        confirmOpen: boolean;
        record: CompanyTaxPaymentRecord | null;
    }>({
        isOpen: false,
        recordId: null,
        isNil: false,
        confirmOpen: false,
        record: null
    });

    const handleUploadClick = (recordId: string, docType: DocumentType) => {
        setUploadDialog({
            isOpen: true,
            recordId,
            docType
        });
    };

    const handleDeleteClick = (recordId: string, docType: DocumentType) => {
        setDeleteDialog({
            isOpen: true,
            recordId,
            docType
        });
    };

    const handleViewClick = async (path: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('Tax-Payment-Slips')
                .createSignedUrl(path, 60); // 60 seconds validity

            if (error) throw error;

            if (data?.signedUrl) {
                setViewDialog({
                    isOpen: true,
                    url: data.signedUrl
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to view document',
                variant: 'destructive'
            });
        }
    };

    const handleDelete = async () => {
        if (!deleteDialog.recordId || !deleteDialog.docType) return;

        try {
            const record = records.find(r => r.id === deleteDialog.recordId);
            if (!record) return;

            const path = record.documents[deleteDialog.docType];
            if (!path) return;

            await onDocumentDelete(deleteDialog.recordId, deleteDialog.docType);
            setDeleteDialog({ isOpen: false, recordId: null, docType: null });

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

    const handleFilingConfirm = async (recordId: string) => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) return;

            const currentDate = filingDialog.isNil ? 'NIL' : new Date().toISOString();

            // Create the updated status object
            const updatedStatus = {
                ...record.status,
                filing: {
                    isReady: true,
                    filingDate: currentDate,
                    isNil: filingDialog.isNil,
                    filedBy: record.status.assigned_to || 'Unassigned'
                }
            };

            // Update the record in Supabase
            const { error: updateError } = await supabase
                .from('company_tax_payment_records')
                .update({
                    status: updatedStatus
                })
                .eq('id', recordId);

            if (updateError) throw updateError;

            // Update local state
            setTaxPaymentRecords(records.map(r => {
                if (r.id === recordId) {
                    return {
                        ...r,
                        status: updatedStatus
                    };
                }
                return r;
            }));

            toast({
                title: "Success",
                description: "Filing status updated successfully"
            });

            setFilingDialog({ isOpen: false, recordId: null, isNil: false, confirmOpen: false, record: null });
        } catch (error) {
            console.error('Filing update error:', error);
            toast({
                title: "Error",
                description: "Failed to update filing status",
                variant: "destructive"
            });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'verified':
                return 'bg-green-500'
            case 'pending':
                return 'bg-yellow-500'
            default:
                return 'bg-gray-500'
        }
    };

    const handleVerifyClick = async (recordId: string) => {
        const record = records.find(r => r.id === recordId);
        if (!record) return;

        try {
            await onStatusUpdate(recordId, {
                status: 'verified',
                verification_date: new Date().toISOString(),
                assigned_to: 'current_user'
            });

            toast({
                title: 'Success',
                description: 'Payment status verified successfully'
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to verify payment status',
                variant: 'destructive'
            });
        }
    };

    const getDocumentCount = (record: CompanyTaxPaymentRecord) => {
        const totalDocs = Object.keys(record.documents).length - 1; // Exclude all_csv
        const uploadedDocs = Object.entries(record.documents)
            .filter(([key, value]) => key !== 'all_csv' && value !== null)
            .length;
        return `${uploadedDocs}/${totalDocs}`;
    };


    const handleDeleteAll = async (record: CompanyPayrollRecord) => {
        try {
            setIsSubmitting(true);

            // Filter out null values before using the paths
            const documentsToDelete = Object.entries(record.documents).filter(([_, path]) => path !== null) as [DocumentType, string][];

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
            const updatedRecords: CompanyPayrollRecord[] = records.map(r => {
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
            const updatedRecords: CompanyPayrollRecord[] = records.map(r => {
                if (r.id === recordId) {
                    return {
                        ...r,
                        documents: updatedDocuments
                    };
                }
                return r;
            });
            setPayrollRecords(updatedRecords);
        } catch (error) {
            console.error('Document upload error:', error);
            throw error;
        }
    };

    const handleDocumentDelete = async (recordId: string, documentType: DocumentType) => {
        try {
            const record = records.find(r => r.id === recordId);
            if (!record) return;

            const documentPath = record.documents[documentType];
            if (!documentPath) return;

            const { error: deleteError } = await supabase.storage
                .from('Payroll-Cycle')
                .remove([documentPath]);

            if (deleteError) throw deleteError;

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
            const updatedRecords: CompanyPayrollRecord[] = records.map(r => {
                if (r.id === recordId) {
                    return {
                        ...r,
                        documents: {
                            ...r.documents,
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

    const allDocumentsUploaded = (record: CompanyTaxPaymentRecord): boolean => {
        return Object.entries(record.documents)
            .filter(([key]) => key !== 'all_csv')
            .every(([_, value]) => value !== null);
    };

    const sortedRecords = useMemo(() =>
        [...records].sort((a, b) =>
            a.company.company_name.localeCompare(b.company.company_name)
        ),
        [records]
    );

    return (
        <div className="rounded-md border h-[calc(100vh-220px)] overflow-auto">
            <Table aria-label="Tax Payment Records" className="border border-gray-200">
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-blue-600 hover:bg-blue-600 [&>th]:border-r [&>th]:border-blue-500 last:[&>th]:border-r-0">
                        <TableHead className="text-white font-semibold border-b" scope="col">#</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Company Name</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Ready to File</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">PAYE Ack.</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">PAYE Payment</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Housing Levy</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">SHIF</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">NSSF</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Email</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">WhatsApp</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedRecords.map((record, index) => (
                        <TableRow
                            key={record.id}
                            className={`${index % 2 === 0 ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'} [&>td]:border-r [&>td]:border-gray-200 last:[&>td]:border-r-0`}
                        >
                            <TableCell>{index + 1}</TableCell>
                            <TooltipProvider>
                                <TableCell className="font-medium">
                                    <Tooltip>
                                        <TooltipTrigger className="text-left">
                                            {record.company.company_name.split(" ").slice(0, 3).join(" ")}
                                        </TooltipTrigger>
                                        <TooltipContent>{record.company.company_name}</TooltipContent>
                                    </Tooltip>
                                </TableCell>
                            </TooltipProvider>

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
                                        className={`h-6 text-xs text-center px-2 ${(!allDocumentsUploaded(record) && record.status.finalization_date !== 'NIL')
                                            ? "bg-red-500 hover:bg-red-500"
                                            : "bg-yellow-500 hover:bg-yellow-500"
                                            }`}
                                        disabled={!allDocumentsUploaded(record) && record.status.finalization_date !== 'NIL'}
                                        onClick={() => {
                                            setFilingDialog({
                                                isOpen: true,
                                                recordId: record.id,
                                                isNil: record.status.finalization_date === 'NIL',
                                                confirmOpen: false,
                                                record
                                            });
                                        }}
                                    >
                                        {(!allDocumentsUploaded(record) && record.status.finalization_date !== 'NIL')
                                            ? 'Pending'
                                            : 'File Now'
                                        }
                                    </Button>
                                )}
                            </TableCell>
                            {Object.entries(DOCUMENT_LABELS).map(([key, label]) => (
                                <TableCell key={key} className="text-center">
                                    <DocumentUploadDialog
                                        documentType={key as DocumentType}
                                        recordId={record.id}
                                        onUpload={(file, docType) => handleDocumentUpload(record.id, file, docType || key as DocumentType)}
                                        onDelete={(docType) => handleDocumentDelete(record.id, docType || key as DocumentType)}
                                        existingDocument={record.documents[key as DocumentType]}
                                        label={label}
                                        isNilFiling={record.status.finalization_date === 'NIL'}
                                        allDocuments={getDocumentsForUpload(record)}
                                    />
                                </TableCell>
                            ))}
                            
                            <TableCell className="text-center">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                        // TODO: Implement email dialog
                                        toast({
                                            title: "Coming Soon",
                                            description: "Email functionality will be added soon"
                                        });
                                    }}
                                >
                                    <Mail className="h-4 w-4" />
                                </Button>
                            </TableCell>
                            <TableCell className="text-center">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                        // TODO: Implement WhatsApp dialog
                                        toast({
                                            title: "Coming Soon",
                                            description: "WhatsApp functionality will be added soon"
                                        });
                                    }}
                                >
                                    <MessageSquare className="h-4 w-4" />
                                </Button>
                            </TableCell>
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
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <DocumentUploadDialog
                open={uploadDialog.isOpen}
                onClose={() => setUploadDialog({ isOpen: false, recordId: null, docType: null })}
                onUpload={async (file) => {
                    if (uploadDialog.recordId && uploadDialog.docType) {
                        await onDocumentUpload(uploadDialog.recordId, file, uploadDialog.docType);
                        setUploadDialog({ isOpen: false, recordId: null, docType: null });
                    }
                }}
            />

            <AlertDialog
                open={deleteDialog.isOpen}
                onOpenChange={(isOpen) => !isOpen && setDeleteDialog({ isOpen: false, recordId: null, docType: null })}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this document? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={handleDelete}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog 
                open={viewDialog.isOpen} 
                onOpenChange={(isOpen) => !isOpen && setViewDialog({ isOpen: false, url: null })}
            >
                <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>View Document</DialogTitle>
                    </DialogHeader>
                    {viewDialog.url && (
                        <div className="mt-4 h-[60vh] overflow-auto">
                            <iframe 
                                src={viewDialog.url}
                                className="w-full h-full"
                                title="Document Preview"
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => setViewDialog({ isOpen: false, url: null })}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog 
                open={filingDialog.isOpen} 
                onOpenChange={(isOpen) => !isOpen && setFilingDialog({ isOpen: false, recordId: null, isNil: false, confirmOpen: false, record: null })}
            >
                <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Confirm Filing</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                        <p>Are you sure you want to confirm filing for this record?</p>
                        <p>Record ID: {filingDialog.recordId}</p>
                        <p>Company Name: {filingDialog.record?.company.company_name}</p>
                    </div>
                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => setFilingDialog({ isOpen: false, recordId: null, isNil: false, confirmOpen: false, record: null })}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => handleFilingConfirm(filingDialog.recordId!)}
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}