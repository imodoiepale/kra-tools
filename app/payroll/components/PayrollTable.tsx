// components/payroll/PayrollTable.tsx
import { useState, useMemo } from "react"
import { format } from 'date-fns'
import {
    MoreHorizontal,
    FileCheck,
    FileClock,
    Download,
    Trash2,
    Eye,
    CheckCircle,
    AlertCircle
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
} from '../types'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const DOCUMENT_LABELS: Record<string, string> = {
    paye_csv: "PAYE Returns (CSV)",
    hslevy_csv: "Housing Levy Returns (CSV)",
    shif_exl: "SHIF Returns (Excel)",
    nssf_exl: "NSSF Returns (Excel)",
    zip_file_kra: "KRA ZIP File",
    all_csv: "All CSV Files"
};

interface PayrollTableProps {
    records: CompanyPayrollRecord[]
    onDocumentUpload: (recordId: string, file: File, documentType: DocumentType) => Promise<void>
    onDocumentDelete: (recordId: string, documentType: DocumentType) => Promise<void>
    onStatusUpdate: (recordId: string, statusUpdate: any) => Promise<void>
    loading: boolean
    setPayrollRecords: (records: CompanyPayrollRecord[]) => void
}

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
    return Object.entries(DOCUMENT_LABELS)
        .filter(([key]) => key !== 'all_csv')
        .map(([type, label]) => ({
            type: type as DocumentType,
            label,
            status: record.documents[type as DocumentType] ? 'uploaded' as const : 'missing' as const,
            path: record.documents[type as DocumentType]
        }));
};

export function PayrollTable({
    records,
    onDocumentUpload,
    onStatusUpdate,
    onDocumentDelete,
    loading,
    setPayrollRecords
}: PayrollTableProps) {
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
        if (record.status.finalization_date === 'NIL') {
            return 'N/A';
        }
        const totalDocs = Object.keys(record.documents).length - 1; // Exclude all_csv
        const uploadedDocs = Object.entries(record.documents)
            .filter(([key, value]) => key !== 'all_csv' && value !== null)
            .length;
        return `${uploadedDocs}/${totalDocs}`;
    };

    const allDocumentsUploaded = (record: CompanyPayrollRecord | undefined): boolean => {
        if (!record) return false;
        return Object.entries(record.documents)
            .filter(([key]) => key !== 'all_csv')
            .every(([_, value]) => value !== null);
    };

    // Memoize sorted records for performance
    const sortedRecords = useMemo(() =>
        [...records].sort((a, b) =>
            a.company.company_name.localeCompare(b.company.company_name)
        ),
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

            // Get all non-null document paths
            const documentsToDelete = Object.entries(record.documents)
                .filter(([key, value]) => key !== 'all_csv' && value !== null);

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

    return (
        <div className="rounded-md border h-[calc(100vh-220px)] overflow-auto">
            <Table aria-label="Payroll Records" className="border border-gray-200">
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-blue-600 hover:bg-blue-600 [&>th]:border-r [&>th]:border-blue-500 last:[&>th]:border-r-0">
                        <TableHead className="text-white font-semibold border-b" scope="col">#</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Company Name</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Obligation Date</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Finalization Date</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">PAYE (CSV)</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">HSLEVY (CSV)</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">SHIF (EXL)</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">NSSF (EXL)</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">ZIP FILE-KRA</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">All CSV</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Ready to File</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Assigned To</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={13} className="text-center py-8 border">
                                <div role="status" className="animate-pulse">
                                    <div className="h-4 bg-gray-200 rounded-full w-48 mb-4"></div>
                                    <span className="sr-only">Loading...</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : sortedRecords.map((record, index) => (
                        <TableRow
                            key={record.id}
                            className={`${index % 2 === 0 ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'} [&>td]:border-r [&>td]:border-gray-200 last:[&>td]:border-r-0`}
                            aria-label={`Payroll record for ${record.company.company_name}`}
                        >
                            <TableCell>{index + 1}</TableCell>
                            <TooltipProvider>
                                <TableCell className="font-medium">
                                    <Tooltip>
                                        <TooltipTrigger className=" ">
                                            {record.company.company_name.split(" ").slice(0, 3).join(" ")}
                                        </TooltipTrigger>
                                        <TooltipContent>{record.company.company_name}</TooltipContent>
                                    </Tooltip>
                                </TableCell>
                            </TooltipProvider>
                            <TableCell></TableCell>
                            <TableCell className="text-center">
                                {record.status.finalization_date ? (
                                    <Badge
                                        className={record.status.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-green-500'}
                                        onClick={() => setDocumentDetailsDialog({ isOpen: true, record })}
                                    >
                                        {formatDate(record.status.finalization_date)}
                                    </Badge>
                                ) : (
                                    <Button
                                        size="sm"
                                        className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 h-6"
                                        onClick={() => setFinalizeDialog({
                                            isOpen: true,
                                            recordId: record.id,
                                            assignedTo: 'Tushar',
                                            isNil: false
                                        })}
                                    >
                                        Finalize
                                    </Button>
                                )}
                            </TableCell>
                            {/* Document cells */}
                            {Object.entries(DOCUMENT_LABELS).map(([key, label]) => (
                                <TableCell key={key} className="text-center">
                                    {key === 'all_csv' ? (
                                        <Badge className={record.status.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-blue-500'}>
                                            {getDocumentCount(record)}
                                        </Badge>
                                    ) : (
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
                                    )}
                                </TableCell>
                            ))}
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
                            <TableCell>
                                <Badge variant="outline">
                                    {record.status.assigned_to || 'Unassigned'}
                                </Badge>
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
                            {filingDialog.record?.status?.filing?.filingDate ? 'Update Filing Status' : 'Ready to File'}
                        </DialogTitle>
                        <DialogDescription>
                            {filingDialog.record?.status?.filing?.filingDate
                                ? 'Update or remove the filing status'
                                : 'Please confirm you want to proceed with filing'
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {filingDialog.record?.status?.filing?.filingDate ? (
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="destructive"
                                    onClick={() => handleRemoveFiling(filingDialog.recordId!)}
                                >
                                    Remove Filing Status
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="filingNil"
                                    checked={filingDialog.isNil}
                                    onCheckedChange={(checked) =>
                                        setFilingDialog(prev => ({ ...prev, isNil: !!checked }))
                                    }
                                />
                                <Label htmlFor="filingNil">Filing NIL Return</Label>
                            </div>
                        )}
                        {!filingDialog.isNil && filingDialog.recordId && (
                            <div className="border rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Document Status</span>
                                    {allDocumentsUploaded(filingDialog.record) ? (
                                        <Badge className="bg-green-500">All Documents Ready</Badge>
                                    ) : (
                                        <Badge className="bg-yellow-500">Missing Documents</Badge>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    {Object.entries(DOCUMENT_LABELS)
                                        .filter(([key]) => key !== 'all_csv')
                                        .map(([type, label]) => {
                                            const document = filingDialog?.record?.documents[type as DocumentType];
                                            return (
                                                <div key={type} className="flex justify-between items-center">
                                                    <span className="text-sm">{label}</span>
                                                    <div className="flex items-center gap-2">
                                                        {document ? (
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                                                        )}
                                                        <span className={document ? "text-green-500" : "text-yellow-500"}>
                                                            {document ? 'Ready' : 'Missing'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setFilingDialog(prev => ({ ...prev, isOpen: false }))}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => setFilingDialog(prev => ({ ...prev, confirmOpen: true }))}
                            disabled={!filingDialog.isNil && !allDocumentsUploaded(filingDialog.record)}
                        >
                            Proceed to Filing
                        </Button>

                    </DialogFooter>
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
                                <div className="flex justify-between items-center">
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
                                </div>
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
        </div>
    )
}