// @ts-nocheck
import { useState, useMemo, useCallback, useRef, useEffect } from "react"
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
    showSummaryHeaders?: boolean
    onToggleSummaryHeaders?: () => void
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
    columnVisibility,
    showSummaryHeaders = true,
    onToggleSummaryHeaders
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
        if (record.status?.finalization_date === 'NIL') return true; // NIL filings don't need documents

        // Define the document types we're counting
        const documentTypes = ['paye_csv', 'hslevy_csv', 'zip_file_kra', 'shif_exl', 'nssf_exl'];

        // Check if all required documents are uploaded (not null and not empty string)
        return documentTypes.every(docType =>
            record.documents[docType] && record.documents[docType].trim() !== ''
        );
    };

    // Memoize sorted records for performance
    // State for showing/hiding summary headers locally if not controlled externally
    const [_showSummaryHeaders, _setShowSummaryHeaders] = useState(showSummaryHeaders);
    // Track document operations to prevent full table refresh
    const [documentOperations, setDocumentOperations] = useState<Map<string, { isLoading: boolean; recordId: string; docType: DocumentType }>>(new Map());

    // Handle document upload with optimistic updates
    const handleOptimisticDocumentUpload = async (recordId: string, file: File, docType: DocumentType) => {
        // Create a unique operation ID
        const operationId = `${recordId}_${docType}_${Date.now()}`;

        // Set loading state for this specific operation
        setDocumentOperations(prev => {
            const newOps = new Map(prev);
            newOps.set(operationId, { isLoading: true, recordId, docType });
            return newOps;
        });

        try {
            // Call the actual upload function
            const result = await onDocumentUpload(recordId, file, docType);

            // Optimistically update the UI without waiting for a full data refresh
            setPayrollRecords(prevRecords =>
                prevRecords.map(record => {
                    if (record.id === recordId) {
                        // Create a new record object with updated documents
                        return {
                            ...record,
                            documents: {
                                ...record.documents,
                                [docType]: typeof result === 'string' ? result : record.documents[docType]
                            }
                        };
                    }
                    return record;
                })
            );

            // Mark operation as complete
            setDocumentOperations(prev => {
                const newOps = new Map(prev);
                newOps.delete(operationId);
                return newOps;
            });

            return result;
        } catch (error) {
            // Mark operation as complete even on error
            setDocumentOperations(prev => {
                const newOps = new Map(prev);
                newOps.delete(operationId);
                return newOps;
            });

            throw error;
        }
    };

    // Handle document delete with optimistic updates
    const handleOptimisticDocumentDelete = async (recordId: string, docType: DocumentType) => {
        // Create a unique operation ID
        const operationId = `${recordId}_${docType}_delete_${Date.now()}`;

        // Set loading state for this specific operation
        setDocumentOperations(prev => {
            const newOps = new Map(prev);
            newOps.set(operationId, { isLoading: true, recordId, docType });
            return newOps;
        });

        try {
            // Call the actual delete function
            await onDocumentDelete(recordId, docType);

            // Optimistically update the UI without waiting for a full data refresh
            setPayrollRecords(prevRecords =>
                prevRecords.map(record => {
                    if (record.id === recordId) {
                        // Create a new record object with updated documents
                        return {
                            ...record,
                            documents: {
                                ...record.documents,
                                [docType]: null
                            }
                        };
                    }
                    return record;
                })
            );

            // Mark operation as complete
            setDocumentOperations(prev => {
                const newOps = new Map(prev);
                newOps.delete(operationId);
                return newOps;
            });
        } catch (error) {
            // Mark operation as complete even on error
            setDocumentOperations(prev => {
                const newOps = new Map(prev);
                newOps.delete(operationId);
                return newOps;
            });

            throw error;
        }
    };

    useEffect(() => {
        _setShowSummaryHeaders(showSummaryHeaders);
    }, [showSummaryHeaders]);

    // Memoize sorted records for performance
    const sortedRecords = useMemo(() =>
        [...records].sort((a, b) => {
            const nameA = a?.company?.company_name?.toLowerCase() || '';
            const nameB = b?.company?.company_name?.toLowerCase() || '';
            return nameA.localeCompare(nameB);
        }),
        [records]
    );

    // Calculate document statistics based on filtered/visible records only
    const getDocumentCounts = useCallback(() => {
        // Use all filtered records
        const records = sortedRecords;
        const totalCount = records.length;

        // Count NIL records
        const nilRecords = records.filter(record => record.status?.finalization_date === 'NIL');
        const nilCount = nilRecords.length;

        // Define complete and pending records
        const nonNilRecords = records.filter(record => record.status?.finalization_date !== 'NIL');
        const completeRecords = nonNilRecords.filter(record => allDocumentsUploaded(record));
        const completeCount = completeRecords.length;

        // Pending records - those that are not NIL and not complete
        const pendingRecords = nonNilRecords.filter(record => !allDocumentsUploaded(record));
        const pendingCount = pendingRecords.length;

        // Count records with finalization date
        const finalizedRecords = records.filter(record => record.status?.finalization_date && record.status?.finalization_date !== 'NIL');
        const finalizedCount = finalizedRecords.length;

        // Count records with finalization date split by category
        const finalizedComplete = completeRecords.filter(record => record.status?.finalization_date && record.status?.finalization_date !== 'NIL').length;
        const finalizedPending = pendingRecords.filter(record => record.status?.finalization_date && record.status?.finalization_date !== 'NIL').length;
        const finalizedNil = nilRecords.length; // All NIL records are finalized by definition

        // Count records with KRA PIN missing
        const kraPinMissingCount = records.filter(record =>
            !record.company?.kra_pin && !record.pin_details?.kra_pin
        ).length;

        // Count records with Ready to File status
        const readyToFileRecords = records.filter(record => record.status?.ready_to_file || record.status?.filing?.filingDate);
        const readyToFileCount = readyToFileRecords.length;
        const readyToFileComplete = completeRecords.filter(record => record.status?.ready_to_file || record.status?.filing?.filingDate).length;
        const readyToFilePending = pendingRecords.filter(record => record.status?.ready_to_file || record.status?.filing?.filingDate).length;
        const readyToFileNil = nilRecords.filter(record => record.status?.ready_to_file || record.status?.filing?.filingDate).length;

        // Helper to count documents by status
        const countDocumentsByStatus = (docType, recordList) => {
            return recordList.filter(record => record.documents[docType] && record.documents[docType].trim() !== '').length;
        };

        // Document counts - across all records
        const payeCsv = countDocumentsByStatus('paye_csv', records);
        const hslevyCsv = countDocumentsByStatus('hslevy_csv', records);
        const shifExl = countDocumentsByStatus('shif_exl', records);
        const nssfExl = countDocumentsByStatus('nssf_exl', records);
        const zipFileKra = countDocumentsByStatus('zip_file_kra', records);
        const allCsv = records.filter(r => Object.values(r.documents).some(v => v && v.trim() !== '')).length;

        // Document counts - complete records
        const payeCsvComplete = countDocumentsByStatus('paye_csv', completeRecords);
        const hslevyCsvComplete = countDocumentsByStatus('hslevy_csv', completeRecords);
        const shifExlComplete = countDocumentsByStatus('shif_exl', completeRecords);
        const nssfExlComplete = countDocumentsByStatus('nssf_exl', completeRecords);
        const zipFileKraComplete = countDocumentsByStatus('zip_file_kra', completeRecords);
        const allCsvComplete = completeRecords.filter(r => Object.values(r.documents).some(v => v && v.trim() !== '')).length;

        // Document counts - pending records
        const payeCsvPending = countDocumentsByStatus('paye_csv', pendingRecords);
        const hslevyCsvPending = countDocumentsByStatus('hslevy_csv', pendingRecords);
        const shifExlPending = countDocumentsByStatus('shif_exl', pendingRecords);
        const nssfExlPending = countDocumentsByStatus('nssf_exl', pendingRecords);
        const zipFileKraPending = countDocumentsByStatus('zip_file_kra', pendingRecords);
        const allCsvPending = pendingRecords.filter(r => Object.values(r.documents).some(v => v && v.trim() !== '')).length;

        // For NIL records, all document counts should match the NIL count
        // since NIL records don't require documents

        return {
            // Basic counts
            total: totalCount,
            complete: completeCount,
            nil: nilCount,
            pending: pendingCount,

            // Finalization date counts
            finalized: finalizedCount + nilCount,  // Both standard finalized and NIL records
            finalizedComplete,
            finalizedPending,
            finalizedNil,

            // KRA PIN counts
            kraPinMissing: kraPinMissingCount,

            // Ready to file counts
            readyToFile: readyToFileCount,
            readyToFileComplete,
            readyToFilePending,
            readyToFileNil,

            // Document counts - totals
            payeCsv,
            hslevyCsv,
            shifExl,
            nssfExl,
            zipFileKra,
            allCsv,

            // Document counts - complete records
            payeCsvComplete,
            hslevyCsvComplete,
            shifExlComplete,
            nssfExlComplete,
            zipFileKraComplete,
            allCsvComplete,

            // Document counts - pending records
            payeCsvPending,
            hslevyCsvPending,
            shifExlPending,
            nssfExlPending,
            zipFileKraPending,
            allCsvPending
        };
    }, [sortedRecords, allDocumentsUploaded]);

    // Memoize the counts
    const counts = useMemo(() => getDocumentCounts(), [getDocumentCounts]);

    return (
        <div className="rounded-md border h-[calc(100vh-240px)] overflow-auto">
            <Table aria-label="Payroll Records" className="border border-gray-200">
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-blue-600 hover:bg-blue-600 [&>th]:border-r [&>th]:border-blue-500 last:[&>th]:border-r-0">
                        {columnVisibility.index && <TableHead className="text-white font-semibold border-b" scope="col">#</TableHead>}
                        {columnVisibility.companyName && <TableHead className="text-white font-semibold" scope="col">Company Name</TableHead>}
                        {columnVisibility.kraPin && <TableHead className="text-white font-semibold" scope="col">KRA PIN</TableHead>}
                        {columnVisibility.obligationDate && <TableHead className="text-white font-semibold" scope="col">PAYE Obligation Date</TableHead>}
                        {columnVisibility.numberOfEmployees && <TableHead className=" text-white text-center font-semibold" scope="col">No. of Emp (Wingu)</TableHead>}
                        {columnVisibility.numberOfEmployeesBcl && <TableHead className=" text-white text-center font-semibold" scope="col">No. of Emp (BCL)</TableHead>}
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

                    {/* Summary headers - conditionally rendered based on showSummaryHeaders */}
                    {_showSummaryHeaders && (
                        <>
                            {/* Total Records Row */}
                            <TableRow className="bg-gray-200 border-b border-gray-300 hover:bg-gray-300 h-8">
                                {columnVisibility.index && (
                                    <TableHead
                                        className="text-left text-black text-sm font-semibold pl-3 pr-1 py-1"
                                        colSpan={columnVisibility.companyName ? 2 : 1}
                                    >
                                        Total Records
                                    </TableHead>
                                )}
                                {!columnVisibility.index && columnVisibility.companyName && (
                                    <TableHead className="text-left text-black text-sm font-semibold pl-3 pr-1 py-1">
                                        Total Records
                                    </TableHead>
                                )}
                                {columnVisibility.companyName && columnVisibility.index && null}
                                {columnVisibility.kraPin && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.total}</TableHead>}
                                {columnVisibility.obligationDate && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.total}</TableHead>}
                                {columnVisibility.numberOfEmployees && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.total}</TableHead>}
                                {columnVisibility.numberOfEmployeesBcl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.total}</TableHead>}
                                {columnVisibility.finalizationDate && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.finalized}</TableHead>}
                                {columnVisibility.payeCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.payeCsv}</TableHead>}
                                {columnVisibility.hslevyCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.hslevyCsv}</TableHead>}
                                {columnVisibility.zipFileKra && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.zipFileKra}</TableHead>}
                                {columnVisibility.shifExl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.shifExl}</TableHead>}
                                {columnVisibility.nssfExl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.nssfExl}</TableHead>}
                                {columnVisibility.allCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.allCsv}</TableHead>}
                                {columnVisibility.readyToFile && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.readyToFile}</TableHead>}
                                {columnVisibility.assignedTo && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.total}</TableHead>}
                                {columnVisibility.actions && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">-</TableHead>}
                            </TableRow>

                            {/* Complete Records Row */}
                            <TableRow className="bg-emerald-200 border-b border-gray-300 hover:bg-emerald-300 h-8">
                                {columnVisibility.index && (
                                    <TableHead
                                        className="text-left text-black text-sm font-semibold pl-3 pr-1 py-1"
                                        colSpan={columnVisibility.companyName ? 2 : 1}
                                    >
                                        Complete
                                    </TableHead>
                                )}
                                {!columnVisibility.index && columnVisibility.companyName && (
                                    <TableHead className="text-left text-black text-sm font-semibold pl-3 pr-1 py-1">
                                        Complete
                                    </TableHead>
                                )}
                                {columnVisibility.companyName && columnVisibility.index && null}
                                {columnVisibility.kraPin && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.complete}</TableHead>}
                                {columnVisibility.obligationDate && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.complete}</TableHead>}
                                {columnVisibility.numberOfEmployees && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.complete}</TableHead>}
                                {columnVisibility.numberOfEmployeesBcl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.complete}</TableHead>}
                                {columnVisibility.finalizationDate && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.finalizedComplete}</TableHead>}
                                {columnVisibility.payeCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.payeCsvComplete}</TableHead>}
                                {columnVisibility.hslevyCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.hslevyCsvComplete}</TableHead>}
                                {columnVisibility.zipFileKra && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.zipFileKraComplete}</TableHead>}
                                {columnVisibility.shifExl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.shifExlComplete}</TableHead>}
                                {columnVisibility.nssfExl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.nssfExlComplete}</TableHead>}
                                {columnVisibility.allCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.allCsvComplete}</TableHead>}
                                {columnVisibility.readyToFile && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.readyToFileComplete}</TableHead>}
                                {columnVisibility.assignedTo && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.complete}</TableHead>}
                                {columnVisibility.actions && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">-</TableHead>}
                            </TableRow>

                            {/* Pending Records Row */}
                            <TableRow className="bg-red-200 border-b border-gray-300 hover:bg-red-300 h-8">
                                {columnVisibility.index && (
                                    <TableHead
                                        className="text-left text-black text-sm font-semibold pl-3 pr-1 py-1"
                                        colSpan={columnVisibility.companyName ? 2 : 1}
                                    >
                                        Pending
                                    </TableHead>
                                )}
                                {!columnVisibility.index && columnVisibility.companyName && (
                                    <TableHead className="text-left text-black text-sm font-semibold pl-3 pr-1 py-1">
                                        Pending
                                    </TableHead>
                                )}
                                {columnVisibility.companyName && columnVisibility.index && null}
                                {columnVisibility.kraPin && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.pending}</TableHead>}
                                {columnVisibility.obligationDate && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.pending}</TableHead>}
                                {columnVisibility.numberOfEmployees && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.pending}</TableHead>}
                                {columnVisibility.numberOfEmployeesBcl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.pending}</TableHead>}
                                {columnVisibility.finalizationDate && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.finalizedPending}</TableHead>}
                                {columnVisibility.payeCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.payeCsvPending}</TableHead>}
                                {columnVisibility.hslevyCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.hslevyCsvPending}</TableHead>}
                                {columnVisibility.zipFileKra && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.zipFileKraPending}</TableHead>}
                                {columnVisibility.shifExl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.shifExlPending}</TableHead>}
                                {columnVisibility.nssfExl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.nssfExlPending}</TableHead>}
                                {columnVisibility.allCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.allCsvPending}</TableHead>}
                                {columnVisibility.readyToFile && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.readyToFilePending}</TableHead>}
                                {columnVisibility.assignedTo && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.pending}</TableHead>}
                                {columnVisibility.actions && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">-</TableHead>}
                            </TableRow>

                            {/* NIL Records Row */}
                            <TableRow className="bg-indigo-200 border-b border-gray-300 hover:bg-indigo-300 h-8">
                                {columnVisibility.index && (
                                    <TableHead
                                        className="text-left text-black text-sm font-semibold pl-3 pr-1 py-1"
                                        colSpan={columnVisibility.companyName ? 2 : 1}
                                    >
                                        NIL Records
                                    </TableHead>
                                )}
                                {!columnVisibility.index && columnVisibility.companyName && (
                                    <TableHead className="text-left text-black text-sm font-semibold pl-3 pr-1 py-1">
                                        NIL Records
                                    </TableHead>
                                )}
                                {columnVisibility.companyName && columnVisibility.index && null}
                                {columnVisibility.kraPin && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.nil}</TableHead>}
                                {columnVisibility.obligationDate && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">-</TableHead>}
                                {columnVisibility.numberOfEmployees && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">-</TableHead>}
                                {columnVisibility.numberOfEmployeesBcl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">-</TableHead>}
                                {columnVisibility.finalizationDate && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.finalizedNil}</TableHead>}
                                {columnVisibility.payeCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.nil}</TableHead>}
                                {columnVisibility.hslevyCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.nil}</TableHead>}
                                {columnVisibility.shifExl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.nil}</TableHead>}
                                {columnVisibility.nssfExl && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.nil}</TableHead>}
                                {columnVisibility.zipFileKra && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.nil}</TableHead>}
                                {columnVisibility.allCsv && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">-</TableHead>}
                                {columnVisibility.readyToFile && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">{counts.readyToFileNil}</TableHead>}
                                {columnVisibility.assignedTo && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">-</TableHead>}
                                {columnVisibility.actions && <TableHead className="text-center text-black text-sm font-semibold py-1 px-2">-</TableHead>}
                            </TableRow>
                        </>
                    )}
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
                                <TableCell className="w-32">
                                    {record.pin_details?.paye_status?.toLowerCase() === 'cancelled' ||
                                        record.pin_details?.paye_status?.toLowerCase() === 'dormant' ? (
                                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 inline-block">
                                            {record.pin_details?.paye_status.charAt(0).toUpperCase() +
                                                record.pin_details?.paye_status.slice(1)}
                                        </span>
                                    ) : record.pin_details?.paye_to_date ? (
                                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 inline-block">
                                            {record.pin_details.paye_to_date}
                                        </span>
                                    ) : record.pin_details?.paye_effective_from?.toLowerCase() === 'no obligation' ? (
                                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 inline-block">
                                            No Oblig.
                                        </span>
                                    ) : record.pin_details?.paye_effective_from ? (
                                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 inline-block">
                                            {record.pin_details.paye_effective_from}
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-600 inline-block">
                                            Missing
                                        </span>
                                    )}
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
                            {columnVisibility.numberOfEmployeesBcl && (
                                <TableCell>
                                    {/* {record.number_of_employees ? (
                                        <div className="flex justify-center font-bold">
                                            {record.number_of_employees}

                                        </div>
                                    ) : (
                                            <span className="flex text-red-600 font-bold text-xs justify-center italic">N/A</span>
                                    )} */}
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
                                            onClick={() => updateState({ finalizeDialog: { isOpen: true, recordId: record.id, finalizationDate: record.status.finalization_date } })}
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
                                        onUpload={(file, docType) => handleOptimisticDocumentUpload(record.id, file, docType || "paye_csv")}
                                        onDelete={(docType) => handleOptimisticDocumentDelete(record.id, docType || "paye_csv")}
                                        existingDocument={record.documents.paye_csv}
                                        label="PAYE (CSV)"
                                        isNilFiling={record.status.finalization_date === 'NIL'}
                                        allDocuments={getDocumentsForUpload(record)}
                                        companyName={record?.company?.company_name || 'Unknown Company'}
                                        isLoading={Array.from(documentOperations.values()).some(op =>
                                            op.recordId === record.id && op.docType === "paye_csv" && op.isLoading
                                        )}
                                    />
                                </TableCell>
                            )}
                            {columnVisibility.hslevyCsv && (
                                <TableCell>
                                    <DocumentUploadDialog
                                        documentType="hslevy_csv"
                                        recordId={record.id}
                                        onUpload={(file, docType) => handleOptimisticDocumentUpload(record.id, file, docType || "hslevy_csv")}
                                        onDelete={(docType) => handleOptimisticDocumentDelete(record.id, docType || "hslevy_csv")}
                                        existingDocument={record.documents.hslevy_csv}
                                        label="HSLEVY (CSV)"
                                        isNilFiling={record.status.finalization_date === 'NIL'}
                                        allDocuments={getDocumentsForUpload(record)}
                                        companyName={record?.company?.company_name || 'Unknown Company'}
                                        isLoading={Array.from(documentOperations.values()).some(op =>
                                            op.recordId === record.id && op.docType === "hslevy_csv" && op.isLoading
                                        )}
                                    />
                                </TableCell>
                            )}
                            {columnVisibility.zipFileKra && (
                                <TableCell>
                                    <DocumentUploadDialog
                                        documentType="zip_file_kra"
                                        recordId={record.id}
                                        onUpload={(file, docType) => handleOptimisticDocumentUpload(record.id, file, docType || "zip_file_kra")}
                                        onDelete={(docType) => handleOptimisticDocumentDelete(record.id, docType || "zip_file_kra")}
                                        existingDocument={record.documents.zip_file_kra}
                                        label="ZIP FILE-KRA"
                                        isNilFiling={record.status.finalization_date === 'NIL'}
                                        allDocuments={getDocumentsForUpload(record)}
                                        companyName={record?.company?.company_name || 'Unknown Company'}
                                        isLoading={Array.from(documentOperations.values()).some(op =>
                                            op.recordId === record.id && op.docType === "zip_file_kra" && op.isLoading
                                        )}
                                    />
                                </TableCell>
                            )}
                            {columnVisibility.shifExl && (
                                <TableCell>
                                    <DocumentUploadDialog
                                        documentType="shif_exl"
                                        recordId={record.id}
                                        onUpload={(file, docType) => handleOptimisticDocumentUpload(record.id, file, docType || "shif_exl")}
                                        onDelete={(docType) => handleOptimisticDocumentDelete(record.id, docType || "shif_exl")}
                                        existingDocument={record.documents.shif_exl}
                                        label="SHIF (EXL)"
                                        isNilFiling={record.status.finalization_date === 'NIL'}
                                        allDocuments={getDocumentsForUpload(record)}
                                        companyName={record?.company?.company_name || 'Unknown Company'}
                                        isLoading={Array.from(documentOperations.values()).some(op =>
                                            op.recordId === record.id && op.docType === "shif_exl" && op.isLoading
                                        )}
                                    />
                                </TableCell>
                            )}
                            {columnVisibility.nssfExl && (
                                <TableCell>
                                    <DocumentUploadDialog
                                        documentType="nssf_exl"
                                        recordId={record.id}
                                        onUpload={(file, docType) => handleOptimisticDocumentUpload(record.id, file, docType || "nssf_exl")}
                                        onDelete={(docType) => handleOptimisticDocumentDelete(record.id, docType || "nssf_exl")}
                                        existingDocument={record.documents.nssf_exl}
                                        label="NSSF (EXL)"
                                        isNilFiling={record.status.finalization_date === 'NIL'}
                                        allDocuments={getDocumentsForUpload(record)}
                                        companyName={record?.company?.company_name || 'Unknown Company'}
                                        isLoading={Array.from(documentOperations.values()).some(op =>
                                            op.recordId === record.id && op.docType === "nssf_exl" && op.isLoading
                                        )}
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
                                            className={`h-6 text-xs px-2 ${record.status?.finalization_date === 'NIL' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-green-500 hover:bg-green-600'}`}
                                            onClick={() => updateState({
                                                filingDialog: {
                                                    isOpen: true,
                                                    recordId: record.id,
                                                    isNil: record.status?.finalization_date === 'NIL',
                                                    confirmOpen: false,
                                                    record
                                                }
                                            })}
                                        >
                                            {formatDate(record?.status?.filing?.filingDate)}
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            className={`h-6 text-xs px-2 ${(!allDocumentsUploaded(record) && record.status?.finalization_date !== 'NIL')
                                                ? "bg-red-500 hover:bg-red-500"
                                                : "bg-yellow-500 hover:bg-yellow-500"
                                                }`}
                                            disabled={!allDocumentsUploaded(record) && record.status?.finalization_date !== 'NIL'}
                                            onClick={() => updateState({
                                                filingDialog: {
                                                    isOpen: true,
                                                    recordId: record.id,
                                                    isNil: record.status?.finalization_date === 'NIL',
                                                    confirmOpen: false,
                                                    record
                                                }
                                            })}
                                        >
                                            {(!allDocumentsUploaded(record) && record.status?.finalization_date !== 'NIL')
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
                onConfirm={(recordId, isNil, assignedTo, finalizationDate) =>
                    handleFinalize(recordId, isNil, assignedTo, finalizationDate)
                }
                onFilingConfirm={handleFilingConfirm}
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