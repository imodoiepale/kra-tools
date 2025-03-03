// @ts-nocheck
import { useState, useMemo } from "react"
import { formatDate } from '../utils/payrollUtils';
import {
    MoreHorizontal,
    Download,
    Trash2,
    Eye,
    Mail,
    MessageSquare,
    Settings2
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
    zip_file_kra: "KRA ZIP File",
    shif_exl: "SHIF Returns (Excel)",
    nssf_exl: "NSSF Returns (Excel)",
    all_csv: "All CSV Files"
};

interface PayrollTableProps {
    records: CompanyPayrollRecord[]
    onDocumentUpload: (recordId: string, file: File, documentType: DocumentType) => Promise<void>
    onDocumentDelete: (recordId: string, documentType: DocumentType) => Promise<void>
    onStatusUpdate: (recordId: string, statusUpdate: any) => Promise<void>
    loading: boolean
    setPayrollRecords: (records: CompanyPayrollRecord[]) => void
    columnVisibility: Record<string, boolean>
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
    setPayrollRecords,
    columnVisibility
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

    // If using an inline function in PayrollTable.tsx
    const getDocumentCount = (record: CompanyPayrollRecord) => {
        if (record.status.finalization_date === 'NIL') {
            return 'N/A';
        }

        // Define the document types we're counting
        const documentTypes = ['paye_csv', 'hslevy_csv', 'zip_file_kra', 'shif_exl', 'nssf_exl'];
        const totalDocs = documentTypes.length;

        // For temporary records, assume no documents
        if (record.is_temporary || record.id.toString().startsWith('temp_')) {
            return `0/${totalDocs}`;
        }

        // Count documents that are actually uploaded (not null and not empty string)
        let uploadedCount = 0;
        for (const docType of documentTypes) {
            // Make sure to check for both null and empty string
            if (record.documents[docType] && record.documents[docType].trim() !== '') {
                uploadedCount++;
            }
        }

        return `${uploadedCount}/${totalDocs}`;
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
        <div className="rounded-md border h-[calc(100vh-240px)] overflow-auto">
            <Table aria-label="Payroll Records" className="border border-gray-200">
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-blue-600 hover:bg-blue-600 [&>th]:border-r [&>th]:border-blue-500 last:[&>th]:border-r-0">
                        {columnVisibility.index && <TableHead className="text-white font-semibold border-b" scope="col">#</TableHead>}
                        {columnVisibility.companyName && <TableHead className="text-white font-semibold" scope="col">Company Name</TableHead>}
                        {columnVisibility.kraPin && <TableHead className="text-white font-semibold" scope="col">KRA PIN</TableHead>}
                        {columnVisibility.obligationDate && <TableHead className="text-white font-semibold" scope="col">PAYE Obligation Date</TableHead>}
                        {columnVisibility.numberOfEmployees && <TableHead className="text-white font-semibold" scope="col">No. of Emp</TableHead>}
                        {columnVisibility.finalizationDate && <TableHead className="text-white font-semibold" scope="col">Finalization Date</TableHead>}
                        {columnVisibility.payeCsv && <TableHead className="text-white font-semibold" scope="col">PAYE (CSV)</TableHead>}
                        {columnVisibility.hslevyCsv && <TableHead className="text-white font-semibold" scope="col">HSLEVY (CSV)</TableHead>}
                        {columnVisibility.zipFileKra && <TableHead className="text-white font-semibold" scope="col">ZIP FILE-KRA</TableHead>}
                        {columnVisibility.shifExl && <TableHead className="text-white font-semibold" scope="col">SHIF (EXL)</TableHead>}
                        {columnVisibility.nssfExl && <TableHead className="text-white font-semibold" scope="col">NSSF (EXL)</TableHead>}
                        {columnVisibility.allCsv && <TableHead className="text-white font-semibold" scope="col">All CSV</TableHead>}
                        {columnVisibility.readyToFile && <TableHead className="text-white font-semibold" scope="col">Ready to File</TableHead>}
                        {columnVisibility.assignedTo && <TableHead className="text-white font-semibold" scope="col">Assigned To</TableHead>}
                        {columnVisibility.actions && <TableHead className="text-white font-semibold" scope="col">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={Object.values(columnVisibility).filter(Boolean).length} className="py-8 border">
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
                            {columnVisibility.index && <TableCell>{index + 1}</TableCell>}
                            {columnVisibility.companyName && (
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
                            )}
                            {columnVisibility.kraPin && (
                                <TableCell
                                    className={
                                        record.company?.kra_pin || record.pin_details?.kra_pin
                                            ? "font-medium"
                                            : "font-bold text-red-600"
                                    }
                                >
                                    {record.company?.kra_pin || record.pin_details?.kra_pin || 'Missing'}
                                </TableCell>
                            )}

                            {columnVisibility.obligationDate && (
                                <TableCell
                                    className={
                                        record.pin_details?.paye_status?.toLowerCase() === 'cancelled' ||
                                            record.pin_details?.paye_status?.toLowerCase() === 'dormant' ||
                                            record.pin_details?.paye_to_date ||
                                            record.pin_details?.paye_effective_from?.toLowerCase() === 'no obligation'
                                            ? 'text-red-600 font-bold'
                                            : record.pin_details?.paye_effective_from
                                                ? 'text-green-600 font-bold'
                                                : 'text-yellow-600 font-bold'
                                    }
                                >
                                    {record.pin_details?.paye_status?.toLowerCase() === 'cancelled' ||
                                        record.pin_details?.paye_status?.toLowerCase() === 'dormant'
                                        ? record.pin_details?.paye_status.charAt(0).toUpperCase() + record.pin_details?.paye_status.slice(1)
                                        : record.pin_details?.paye_to_date
                                            ? record.pin_details.paye_to_date
                                            : record.pin_details?.paye_effective_from?.toLowerCase() === 'no obligation'
                                                ? 'No Obligation'
                                                : record.pin_details?.paye_effective_from
                                                    ? record.pin_details.paye_effective_from
                                                    : 'Missing'}
                                </TableCell>
                            )}

                            {columnVisibility.numberOfEmployees && (
                                <TableCell>
                                    {record.number_of_employees ? (
                                        <div className="flex justify-center font-bold">
                                            {record.number_of_employees}

                                        </div>
                                    ) : (
                                            <span className="flex text-red-600 font-bold text-xs justify-center italic">N/A</span>
                                    )}
                                </TableCell>
                            )}
                            {columnVisibility.finalizationDate && (
                                <TableCell>
                                    {record.status.finalization_date ? (
                                        <p className={`text-xs px-2 py-1 rounded-full text-white ${record.status.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-green-500'}`}>
                                            {record.status.finalization_date === 'NIL' ? 'NIL' : formatDate(record.status.finalization_date)}
                                        </p>
                                    ) : (
                                        <Button
                                            size="sm"
                                            className="h-6 text-xs px-2 bg-red-500 hover:bg-red-600 text-white"
                                            onClick={() => updateState({ finalizeDialog: { isOpen: true, recordId: record.id } })}
                                        >
                                            Finalize
                                        </Button>
                                    )}
                                </TableCell>
                            )}
                            {columnVisibility.payeCsv && (
                                <TableCell>
                                    <DocumentUploadDialog
                                        documentType="paye_csv"
                                        recordId={record.id}
                                        onUpload={(file, docType) => onDocumentUpload(record.id, file, docType || "paye_csv")}
                                        onDelete={(docType) => onDocumentDelete(record.id, docType || "paye_csv")}
                                        existingDocument={record.documents.paye_csv}
                                        label="PAYE (CSV)"
                                        isNilFiling={record.status.finalization_date === 'NIL'}
                                        allDocuments={getDocumentsForUpload(record)}
                                        companyName={record?.company?.company_name || 'Unknown Company'}
                                    />
                                </TableCell>
                            )}
                            {columnVisibility.hslevyCsv && (
                                <TableCell>
                                    <DocumentUploadDialog
                                        documentType="hslevy_csv"
                                        recordId={record.id}
                                        onUpload={(file, docType) => onDocumentUpload(record.id, file, docType || "hslevy_csv")}
                                        onDelete={(docType) => onDocumentDelete(record.id, docType || "hslevy_csv")}
                                        existingDocument={record.documents.hslevy_csv}
                                        label="HSLEVY (CSV)"
                                        isNilFiling={record.status.finalization_date === 'NIL'}
                                        allDocuments={getDocumentsForUpload(record)}
                                        companyName={record?.company?.company_name || 'Unknown Company'}
                                    />
                                </TableCell>
                            )}
                            {columnVisibility.zipFileKra && (
                                <TableCell>
                                    <DocumentUploadDialog
                                        documentType="zip_file_kra"
                                        recordId={record.id}
                                        onUpload={(file, docType) => onDocumentUpload(record.id, file, docType || "zip_file_kra")}
                                        onDelete={(docType) => onDocumentDelete(record.id, docType || "zip_file_kra")}
                                        existingDocument={record.documents.zip_file_kra}
                                        label="ZIP FILE-KRA"
                                        isNilFiling={record.status.finalization_date === 'NIL'}
                                        allDocuments={getDocumentsForUpload(record)}
                                        companyName={record?.company?.company_name || 'Unknown Company'}
                                    />
                                </TableCell>
                            )}
                            {columnVisibility.shifExl && (
                                <TableCell>
                                    <DocumentUploadDialog
                                        documentType="shif_exl"
                                        recordId={record.id}
                                        onUpload={(file, docType) => onDocumentUpload(record.id, file, docType || "shif_exl")}
                                        onDelete={(docType) => onDocumentDelete(record.id, docType || "shif_exl")}
                                        existingDocument={record.documents.shif_exl}
                                        label="SHIF (EXL)"
                                        isNilFiling={record.status.finalization_date === 'NIL'}
                                        allDocuments={getDocumentsForUpload(record)}
                                        companyName={record?.company?.company_name || 'Unknown Company'}
                                    />
                                </TableCell>
                            )}
                            {columnVisibility.nssfExl && (
                                <TableCell>
                                    <DocumentUploadDialog
                                        documentType="nssf_exl"
                                        recordId={record.id}
                                        onUpload={(file, docType) => onDocumentUpload(record.id, file, docType || "nssf_exl")}
                                        onDelete={(docType) => onDocumentDelete(record.id, docType || "nssf_exl")}
                                        existingDocument={record.documents.nssf_exl}
                                        label="NSSF (EXL)"
                                        isNilFiling={record.status.finalization_date === 'NIL'}
                                        allDocuments={getDocumentsForUpload(record)}
                                        companyName={record?.company?.company_name || 'Unknown Company'}
                                    />
                                </TableCell>    
                            )}
                            {columnVisibility.allCsv && (
                                <TableCell>
                                    <Badge className={record.status.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-blue-500'}>
                                        {getDocumentCount(record)}
                                    </Badge>
                                </TableCell>
                            )}
                            {columnVisibility.readyToFile && (
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
                            )}
                            {columnVisibility.assignedTo && (
                                <TableCell>
                                    <Badge variant="outline">
                                        {record.status.assigned_to || 'Unassigned'}
                                    </Badge>
                                </TableCell>
                            )}
                            {columnVisibility.actions && (
                                <TableCell>
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
                            )}
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