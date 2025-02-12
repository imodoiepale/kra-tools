// components/payroll/PayrollTable.tsx
import { useState } from "react"
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
import { CompanyPayrollRecord, DocumentType } from '../types'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";


interface PayrollTableProps {
    records: CompanyPayrollRecord[]
    onDocumentUpload: (recordId: string, file: File, documentType: DocumentType) => Promise<void>
    onDocumentDelete: (recordId: string, documentType: DocumentType) => Promise<void>
    onStatusUpdate: (recordId: string, statusUpdate: any) => Promise<void>
    loading: boolean
}

const formatDate = (date: string | null | undefined): string => {
    if (!date || date === 'NIL') return 'NIL';
    try {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) return 'Invalid Date';
        return format(parsedDate, 'dd/MM/yyyy');
    } catch {
        return 'Invalid Date';
    }
};

export function PayrollTable({
    records,
    onDocumentUpload,
    onStatusUpdate,
    onDocumentDelete,
    loading
}: PayrollTableProps) {
    const { toast } = useToast()

    const [finalizeDialog, setFinalizeDialog] = useState<{
        isOpen: boolean;
        recordId: string | null;
        assignedTo: string;
        isNil: boolean;
    }>({ isOpen: false, recordId: null, assignedTo: 'Tushar', isNil: false });

    const [filingDialog, setFilingDialog] = useState<{
        isOpen: boolean;
        recordId: string | null;
        isNil: boolean;
        confirmOpen: boolean;
    }>({ isOpen: false, recordId: null, isNil: false, confirmOpen: false });

    const [documentDetailsDialog, setDocumentDetailsDialog] = useState<{
        isOpen: boolean;
        record: CompanyPayrollRecord | null;
    }>({ isOpen: false, record: null });

    const documentLabels = {
        paye_csv: "PAYE Returns (CSV)",
        hslevy_csv: "Housing Levy Returns (CSV)",
        shif_exl: "SHIF Returns (Excel)",
        nssf_exl: "NSSF Returns (Excel)",
        zip_file_kra: "KRA ZIP File",
        all_csv: "All CSV Files"
    };



    const getDocumentCount = (record: CompanyPayrollRecord) => {
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

    const sortedRecords = [...records].sort((a, b) =>
        a.company.company_name.localeCompare(b.company.company_name)
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

        if (!allDocumentsUploaded(record) && !filingDialog.isNil) {
            toast({
                title: "Error",
                description: "All documents must be uploaded before filing",
                variant: "destructive"
            });
            return;
        }

        const currentDate = new Date().toISOString();
        
        // Update the record in Supabase
        const { error } = await supabase
            .from('company_payroll_records')
            .update({
                status: {
                    ...record.status,
                    filing: {
                        isReady: true,
                        filingDate: currentDate,
                        isNil: filingDialog.isNil,
                        filedBy: record.status.assigned_to || 'Unassigned'
                    }
                }
            })
            .eq('id', recordId);

        if (error) throw error;

        // Fetch updated records to refresh the UI
        const payrollCycle = await supabase
            .from('payroll_cycles')
            .select('id')
            .eq('month_year', selectedMonthYear)
            .single();

        if (payrollCycle?.data) {
            await fetchPayrollRecords(payrollCycle.data.id);
        }

        toast({
            title: "Success",
            description: "Filing status updated successfully"
        });

        setFilingDialog({ isOpen: false, recordId: null, isNil: false, confirmOpen: false });
    } catch (error) {
        toast({
            title: "Error",
            description: "Failed to update filing status",
            variant: "destructive"
        });
    }
};

    const [deleteAllDialog, setDeleteAllDialog] = useState<{
        isOpen: boolean;
        record: CompanyPayrollRecord | null;
    }>({ isOpen: false, record: null });

    const handleDeleteAll = async (record: CompanyPayrollRecord) => {
        try {
            // Delete all files from storage
            const documentsToDelete = Object.values(record.documents)
                .filter((path): path is string => path !== null);

            if (documentsToDelete.length > 0) {
                const { error: deleteError } = await supabase.storage
                    .from('Payroll-Cycle')
                    .remove(documentsToDelete);

                if (deleteError) throw deleteError;
            }

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

            // Use the provided onDocumentDelete for each document type
            const documentTypes: DocumentType[] = ['paye_csv', 'hslevy_csv', 'shif_exl', 'nssf_exl', 'zip_file_kra', 'all_csv'];
            await Promise.all(
                documentTypes.map(async (docType) => {
                    if (record.documents[docType]) {
                        await onDocumentDelete(record.id, docType);
                    }
                })
            );

            toast({
                title: 'Success',
                description: 'All documents deleted successfully'
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete documents',
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

    return (
        <div className="rounded-md border h-[calc(100vh-220px)] overflow-auto">
            <Table>
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-blue-600 hover:bg-blue-600">
                        <TableHead className="text-white font-semibold">#</TableHead>
                        <TableHead className="text-white font-semibold">Company Name</TableHead>
                        <TableHead className="text-white font-semibold">Finalization Date</TableHead>
                        <TableHead className="text-white font-semibold">PAYE (CSV)</TableHead>
                        <TableHead className="text-white font-semibold">HSLEVY (CSV)</TableHead>
                        <TableHead className="text-white font-semibold">SHIF (EXL)</TableHead>
                        <TableHead className="text-white font-semibold">NSSF (EXL)</TableHead>
                        <TableHead className="text-white font-semibold">ZIP FILE-KRA</TableHead>
                        <TableHead className="text-white font-semibold">All CSV</TableHead>
                        <TableHead className="text-white font-semibold">Ready to File</TableHead>
                        <TableHead className="text-white font-semibold">Assigned To</TableHead>
                        <TableHead className="text-white font-semibold">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={13} className="text-center py-8">
                                Loading...
                            </TableCell>
                        </TableRow>
                    ) : sortedRecords.map((record, index) => (
                        <TableRow key={record.id} className={index % 2 === 0 ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-gray-50'}>
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
                            <TableCell>
                                {record.status.finalization_date ? (
                                    <Badge
                                        className="bg-green-500"
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
                            {Object.entries(documentLabels).map(([key, label]) => (
                                <TableCell key={key}>
                                    {key === 'all_csv' ? (
                                        <Badge className="bg-blue-500">
                                            {getDocumentCount(record)}
                                        </Badge>
                                    ) : (
                                        <DocumentUploadDialog
                                            documentType={key as DocumentType}
                                            onUpload={(file) => onDocumentUpload(record.id, file, key as DocumentType)}
                                            onDelete={() => onDocumentDelete(record.id, key as DocumentType)}
                                            existingDocument={record.documents[key as DocumentType]}
                                            label={label}
                                            isNilFiling={record.status.finalization_date === 'NIL'}
                                        />
                                    )}
                                </TableCell>
                            ))}
                            <TableCell>
    <Button
        size="sm"
        className={`h-6 text-xs px-2 ${
            record.status.filing?.filingDate
                ? "bg-green-500 hover:bg-green-500"
                : (!allDocumentsUploaded(record) && record.status.finalization_date !== 'NIL')
                    ? "bg-red-500 hover:bg-red-500"
                    : "bg-yellow-500 hover:bg-yellow-500"
        }`}
        disabled={!allDocumentsUploaded(record) && record.status.finalization_date !== 'NIL'}
        onClick={() => {
            if (!record.status.filing?.filingDate) {
                setFilingDialog({
                    isOpen: true,
                    recordId: record.id,
                    isNil: false,
                    confirmOpen: false
                });
            }
        }}
    >
        {record.status.filing?.filingDate ? (
            formatDate(record.status.filing.filingDate)
        ) : (
            (!allDocumentsUploaded(record) && record.status.finalization_date !== 'NIL')
                ? 'Pending'
                : 'File Now'
        )}
    </Button>
</TableCell>
                            <TableCell>
                                <Badge variant="outline">
                                    {record.status.assigned_to || 'Unassigned'}
                                </Badge>
                            </TableCell>
                            <TableCell>
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
                        <DialogTitle>Ready to File</DialogTitle>
                        <DialogDescription>
                            Please confirm you want to proceed with filing
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
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

                       {!filingDialog.isNil && filingDialog.recordId && (
    <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
            <span className="font-medium">Document Status</span>
            {allDocumentsUploaded(records.find(r => r.id === filingDialog.recordId)!) ? (
                <Badge className="bg-green-500">All Documents Ready</Badge>
            ) : (
                <Badge className="bg-yellow-500">Missing Documents</Badge>
            )}
        </div>
        <div className="grid gap-2">
            {Object.entries(documentLabels)
                .filter(([key]) => key !== 'all_csv')
                .map(([type, label]) => {
                    const document = records.find(
                        r => r.id === filingDialog.recordId
                    )?.documents[type as DocumentType];
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
  disabled={!filingDialog.isNil ? false : !allDocumentsUploaded(records.find(r => r.id === filingDialog.recordId)!)}
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
                                        <Badge className="bg-green-500">
                                            {formatDate(documentDetailsDialog.record.status.finalization_date)}
                                        </Badge>
                                        {documentDetailsDialog.record.status.finalization_date === 'NIL' && (
                                            <Badge className="bg-purple-500">NIL</Badge>
                                        )}
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
                                    {documentDetailsDialog.record.status.finalization_date === 'NIL' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                // Update status to remove NIL
                                                onStatusUpdate(documentDetailsDialog.record!.id, {
                                                    finalization_date: null,
                                                    status: 'pending'
                                                });
                                                setDocumentDetailsDialog({ isOpen: false, record: null });
                                            }}
                                        >
                                            Remove NIL Status
                                        </Button>
                                    )}
                                </div>
                                {Object.entries(documentLabels)
                                    .filter(([key]) => key !== 'all_csv') // Remove All CSV Files
                                    .map(([type, label]) => {
                                        const document = documentDetailsDialog.record.documents[type as DocumentType];
                                        const isNilFiling = documentDetailsDialog.record.status.finalization_date === 'NIL';
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

                            {documentDetailsDialog.record.filing?.filingDate && (
                                <div className="space-y-2">
                                    <Label>Filing Status</Label>
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-green-500">
                                            Filed on {formatDate(documentDetailsDialog.record.filing.filingDate)}
                                        </Badge>
                                        <Badge variant="outline">
                                            By {documentDetailsDialog.record.filing.filedBy}
                                        </Badge>
                                        {documentDetailsDialog.record.filing.isNil && (
                                            <Badge className="bg-purple-500">NIL Return</Badge>
                                        )}
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