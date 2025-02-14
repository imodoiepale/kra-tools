// @ts-nocheck
import { useState, useMemo } from "react"
import { formatDate } from '../utils/payrollUtils';
import {
    MoreHorizontal,
    Download,
    Trash2,
    Eye,
    Mail,
    MessageSquare
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
import { FinalizeDialog } from './dialogs/FinalizeDialog'
import { FilingDialog } from './dialogs/FilingDialog'
import { DocumentDetailsDialog } from './dialogs/DocumentDetailsDialog'
import { usePayrollState } from '../../hooks/usePayrollState'
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
    const { toast } = useToast();
    const {
        state,
        setState,
        handleFinalize,
        handleRevertFinalize,
        handleFilingConfirm,
        handleRemoveFiling,
        handleDeleteAll,
        handleDownload,
        handleDownloadAll
    } = usePayrollState(records, setPayrollRecords, toast);

    const [selectedMonthYear, setSelectedMonthYear] = useState<string>(formatDate(new Date(), 'yyyy-MM'));

    const updateState = (newState: Partial<typeof state>) => {
        setState(prevState => ({
            ...prevState,
            ...newState
        }));
    };

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
        [...records].sort((a, b) => {
            const nameA = a?.company?.company_name || '';
            const nameB = b?.company?.company_name || '';
            return nameA.localeCompare(nameB);
        }),
        [records]
    );

    return (
        <div className="rounded-md border h-[calc(100vh-220px)] overflow-auto">
            <Table aria-label="Payroll Records" className="border border-gray-200">
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-blue-600 hover:bg-blue-600 [&>th]:border-r [&>th]:border-blue-500 last:[&>th]:border-r-0">
                        <TableHead className="text-white font-semibold border-b" scope="col">#</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Company Name</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">Obligation Date</TableHead>
                        <TableHead className="text-white font-semibold" scope="col">No. of Emp</TableHead>
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
                            <TableCell colSpan={13} className=" py-8 border">
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
                            aria-label={`Payroll record for ${record?.company?.company_name || 'Unknown Company'}`}
                        >
                            <TableCell>{index + 1}</TableCell>
                            <TooltipProvider>
                                <TableCell className="font-medium">
                                    <Tooltip>
                                        <TooltipTrigger className=" ">
                                            {(record?.company?.company_name || 'Unknown Company').split(" ").slice(0, 3).join(" ")}
                                        </TooltipTrigger>
                                        <TooltipContent>{record?.company?.company_name || 'Unknown Company'}</TooltipContent>
                                    </Tooltip>
                                </TableCell>
                            </TooltipProvider>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell className="">
                                {record.status.finalization_date ? (
                                    <p
                                        // className={record.status.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-green-500'}
                                        variant="outline"
                                        onClick={() => updateState({ documentDetailsDialog: { isOpen: true, record } })}
                                    >
                                        {formatDate(record.status.finalization_date)}
                                    </p>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 h-6"
                                        onClick={() => {
                                            setState(prev => ({
                                                ...prev,
                                                finalizeDialog: {
                                                    ...prev.finalizeDialog,
                                                    isOpen: true,
                                                    recordId: record.id,
                                                    isNil: false,
                                                    record
                                                }
                                            }));
                                        }}
                                    >
                                        Finalize
                                    </Button>
                                )}
                            </TableCell>
                            {/* Document cells */}
                            {Object.entries(DOCUMENT_LABELS).map(([key, label]) => (
                                <TableCell key={key} className="">
                                    {key === 'all_csv' ? (
                                        <Badge className={record.status.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-blue-500'}>
                                            {getDocumentCount(record)}
                                        </Badge>
                                    ) : (
                                        <DocumentUploadDialog
                                            documentType={key as DocumentType}
                                            recordId={record.id}
                                            onUpload={(file, docType) => onDocumentUpload(record.id, file, docType || key as DocumentType)}
                                            onDelete={(docType) => onDocumentDelete(record.id, docType || key as DocumentType)}
                                            existingDocument={record.documents[key as DocumentType]}
                                            label={label}
                                            isNilFiling={record.status.finalization_date === 'NIL'}
                                            allDocuments={getDocumentsForUpload(record)}
                                            companyName={record?.company?.company_name || 'Unknown Company'}
                                        />
                                    )}
                                </TableCell>
                            ))}
                            <TableCell className="">
                                {record?.status?.filing?.filingDate ? (
                                    <Button
                                        size="sm"
                                        className={`h-6 text-xs px-2 ${record.status.finalization_date === 'NIL' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-green-500 hover:bg-green-600'}`}
                                        onClick={() => updateState({ filingDialog: { isOpen: true, recordId: record.id, isNil: record.status.finalization_date === 'NIL', confirmOpen: false, record } })}
                                    >
                                        {formatDate(record?.status?.filing?.filingDate)}
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                            className={`h-6 text-xs  px-2 ${(!allDocumentsUploaded(record) && record.status.finalization_date !== 'NIL')
                                            ? "bg-red-500 hover:bg-red-500"
                                            : "bg-yellow-500 hover:bg-yellow-500"
                                            }`}
                                        disabled={!allDocumentsUploaded(record) && record.status.finalization_date !== 'NIL'}
                                        onClick={() => updateState({ filingDialog: { isOpen: true, recordId: record.id, isNil: record.status.finalization_date === 'NIL', confirmOpen: false, record } })}
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
                            <TableCell className="">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem
                                            onClick={() => updateState({ documentDetailsDialog: { isOpen: true, record } })}
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
                                            onClick={() => updateState({ deleteAllDialog: { isOpen: true, record } })}
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
            <FinalizeDialog
                open={state.finalizeDialog.isOpen}
                onOpenChange={(open) => {
                    setState(prev => ({
                        ...prev,
                        finalizeDialog: {
                            ...prev.finalizeDialog,
                            isOpen: open,
                            recordId: open ? prev.finalizeDialog.recordId : null
                        }
                    }));
                }}
                onConfirm={handleFinalize}
                onRevert={handleRevertFinalize}
                recordId={state.finalizeDialog.recordId}
                record={records.find(r => r.id === state.finalizeDialog.recordId) || state.finalizeDialog.record}
                assignedTo={state.finalizeDialog.assignedTo}
                isNil={state.finalizeDialog.isNil}
            />

            {/* Filing Dialog */}
            <FilingDialog
                open={state.filingDialog.isOpen}
                onOpenChange={(isOpen) => !isOpen && updateState({
                    filingDialog: {
                        isOpen: false,
                        recordId: null,
                        isNil: false,
                        confirmOpen: false,
                        record: null
                    }
                })}
                onConfirm={handleFilingConfirm}
                onRemove={handleRemoveFiling}
                recordId={state.filingDialog.recordId}
                isNil={state.filingDialog.isNil}
                confirmOpen={state.filingDialog.confirmOpen}
                record={state.filingDialog.record}
            />

            {/* Document Details Dialog */}
            <DocumentDetailsDialog
                open={state.documentDetailsDialog.isOpen}
                onOpenChange={(open) => {
                    setState(prev => ({
                        ...prev,
                        documentDetailsDialog: {
                            ...prev.documentDetailsDialog,
                            isOpen: open,
                            record: open ? prev.documentDetailsDialog.record : null
                        }
                    }));
                }}
                record={state.documentDetailsDialog.record}
                documentLabels={DOCUMENT_LABELS}
                onRevertFinalize={handleRevertFinalize}
            />

            {/* Delete All Dialog */}
            <AlertDialog
                open={state.deleteAllDialog.isOpen}
                onOpenChange={(isOpen) => !isOpen && updateState({
                    deleteAllDialog: {
                        isOpen: false,
                        record: null
                    }
                })}
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
                                if (state.deleteAllDialog.record) {
                                    handleDeleteAll(state.deleteAllDialog.record);
                                    updateState({ deleteAllDialog: { isOpen: false, record: null } });
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