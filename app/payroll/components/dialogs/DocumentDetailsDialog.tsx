// @ts-nocheck
import { Download, RotateCcw } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { CompanyPayrollRecord, DocumentType } from '../../types';
import { formatDate } from '../../utils/payrollUtils';
import React from 'react';

interface DocumentDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record: CompanyPayrollRecord | null;
    documentLabels: Record<string, string>;
    onRevertFinalize?: (recordId: string) => void;
}

export function DocumentDetailsDialog({
    open,
    onOpenChange,
    record,
    documentLabels,
    onRevertFinalize
}: DocumentDetailsDialogProps) {
    if (!record || !documentLabels) return null;
    const [confirmRevert, setConfirmRevert] = React.useState(false);

    const documents = Object.entries(documentLabels)
        .filter(([key]) => key !== 'all_csv')
        .map(([type, label]) => ({
            type: type as DocumentType,
            label,
            status: record.documents[type as DocumentType] ? 'uploaded' : 'missing',
            path: record.documents[type as DocumentType]
        }));

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader className="pb-2 border-b">
                        <div className="flex justify-between items-end">
                            <DialogTitle className="text-lg font-semibold text-blue-600">
                                {record.company.company_name}
                            </DialogTitle>
                            <div className="flex items-center gap-2 mr-6">
                                {/* <Badge variant="outline" className="text-xs">
                                    {record.status.assigned_to || 'Unassigned'}
                                </Badge> */}
                                {record.status.finalization_date && onRevertFinalize && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="h-7 text-xs px-2 gap-1"
                                        onClick={() => setConfirmRevert(true)}
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        Revert
                                    </Button>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                        {/* Company & Status Information */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Company Information */}
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    Company Details
                                </h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Company Name</span>
                                        <span className="font-medium">{record.company.company_name}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">KRA PIN</span>
                                        <span className="font-medium">{record.company.kra_pin || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Assigned To</span>
                                        <Badge variant="outline" className="text-xs">
                                            {record.status.assigned_to || 'Unassigned'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Status Information */}
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                    Status Information
                                </h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Finalization</span>
                                        <Badge className={`text-xs ${record.status.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-green-500'}`}>
                                            {record.status.finalization_date ? formatDate(record.status.finalization_date) : 'Not Finalized'}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Filing Status</span>
                                        <Badge className={`text-xs ${record.status.filing?.filingDate ? 'bg-green-500' : 'bg-yellow-500'}`}>
                                            {record.status.filing?.filingDate ? formatDate(record.status.filing.filingDate) : 'Not Filed'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Documents Section */}
                        <div className="bg-white rounded-lg border">
                            <div className="px-4 py-3 border-b">
                                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Documents
                                </h4>
                            </div>
                            <div className="divide-y text-sm">
                                {documents.map(({ type, label, status, path }) => (
                                    <div key={type} className="px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${status === 'uploaded' ? 'text-green-500' : 'text-yellow-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            <span className="font-medium">{label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className={`text-xs ${status === 'uploaded' ? 'bg-green-500' : 'bg-yellow-500'}`}>
                                                {status === 'uploaded' ? 'Uploaded' : 'Missing'}
                                            </Badge>
                                            {status === 'uploaded' && path && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2 gap-1"
                                                >
                                                    <Download className="h-3 w-3" />
                                                    <span className="text-xs">Download</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmRevert} onOpenChange={setConfirmRevert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revert Finalization</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to revert the finalization status? This will remove the finalization date and assigned person.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                onRevertFinalize?.(record.id);
                                setConfirmRevert(false);
                            }}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            Revert
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
