// @ts-nocheck
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
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
} from "@/components/ui/alert-dialog";
import { CompanyPayrollRecord } from '../../../types';
import { formatDate } from '../../utils/payrollUtils';

interface FilingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (recordId: string, date: Date) => Promise<void>;
    onRemove: (recordId: string) => Promise<void>;
    recordId: string | null;
    isNil: boolean;
    confirmOpen: boolean;
    record?: CompanyPayrollRecord;
}

export function FilingDialog({
    open,
    onOpenChange,
    onConfirm,
    onRemove,
    recordId,
    isNil,
    confirmOpen,
    record
}: FilingDialogProps) {
    const [date, setDate] = useState<Date>(new Date());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize date when dialog opens
    useEffect(() => {
        if (open) {
            setDate(new Date());
        }
    }, [open]);

    if (!record) return null;

    const handleConfirm = async () => {
        if (!recordId) return;
        setIsSubmitting(true);
        try {
            await onConfirm(recordId, date);
            // Dialog will be closed by the parent component on success
        } catch (error) {
            console.error('Filing error:', error);
            // Keep the dialog open if there's an error
            return;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemove = async () => {
        if (!recordId) return;
        setIsSubmitting(true);
        try {
            await onRemove(recordId);
            // Dialog will be closed by the parent component on success
        } catch (error) {
            console.error('Remove filing error:', error);
            // Keep the dialog open if there's an error
            return;
        } finally {
            setIsSubmitting(false);
        }
    };

    const allDocumentsUploaded = () => {
        // NIL filings don't need documents
        if (isNil || record.status?.finalization_date === 'NIL') return true;
        
        // Define the document types we're counting
        const documentTypes = ['paye_csv', 'hslevy_csv', 'zip_file_kra', 'shif_exl', 'nssf_exl'];
        
        // Check if all required documents are uploaded (not null and not empty string)
        return documentTypes.every(docType => 
            record.documents[docType] && record.documents[docType].trim() !== ''
        );
    };

    const getDocumentCount = () => {
        // NIL filings don't need documents
        if (isNil || record.status?.finalization_date === 'NIL') return 'N/A';
        
        // Define the document types we're counting
        const documentTypes = ['paye_csv', 'hslevy_csv', 'zip_file_kra', 'shif_exl', 'nssf_exl'];
        const totalDocs = documentTypes.length;
        
        // Count documents that are actually uploaded (not null and not empty string)
        let uploadedCount = 0;
        for (const docType of documentTypes) {
            if (record.documents[docType] && record.documents[docType].trim() !== '') {
                uploadedCount++;
            }
        }
        
        return `${uploadedCount}/${totalDocs}`;
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-lg">
                    <DialogHeader className="pb-4 border-b">
                        <div className="space-y-2">
                            <DialogTitle className="text-xl font-semibold text-blue-600">
                                {record.company?.company_name || 'Unknown Company'}
                            </DialogTitle>
                            <div className="flex items-center gap-2">
                                <Badge className={`px-3 py-1 ${isNil || record.status?.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                                    {isNil || record.status?.finalization_date === 'NIL' ? 'NIL Filing' : 'Regular Filing'}
                                </Badge>
                                {record.status?.filing?.filingDate ? (
                                    <Badge variant="outline" className="px-3 py-1">
                                        Filed on {formatDate(record.status.filing.filingDate)}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="px-3 py-1">
                                        Not Filed
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Documents Status</span>
                                {isNil || record.status?.finalization_date === 'NIL' ? (
                                    <Badge variant="outline" className="text-xs">
                                        N/A
                                    </Badge>
                                ) : (
                                    <Badge className={`text-xs ${allDocumentsUploaded() ? 'bg-green-500' : 'bg-yellow-500'}`}>
                                        {getDocumentCount()}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Finalization Date</span>
                                <Badge className={isNil || record.status?.finalization_date === 'NIL' ? 'bg-purple-500' : 'bg-green-500'}>
                                    {record.status?.finalization_date === 'NIL' ? 'NIL Return' : formatDate(record.status?.finalization_date)}
                                </Badge>
                            </div>
                        </div>

                        {record.status?.filing?.filingDate ? (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <Label className="text-sm text-gray-600">Filed on</Label>
                                        <p className="font-medium">{formatDate(record.status.filing.filingDate)}</p>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleRemove}
                                        disabled={isSubmitting}
                                    >
                                        Remove Filing
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Auto Filing Date</Label>
                                    {/* <div className="border rounded-md p-3 bg-white">
                                        <Calendar
                                            mode="single"
                                            selected={date}
                                            onSelect={(newDate) => newDate && setDate(newDate)}
                                            disabled={(date) =>
                                                date > new Date() || date < new Date(2021, 0, 1)
                                            }
                                            className="rounded-md border"
                                        />
                                    </div> */}
                                    <div className="mt-2 text-sm text-blue-600 font-medium">
                                        {format(date, 'PPP')}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleConfirm}
                                        disabled={isSubmitting || (!allDocumentsUploaded() && !isNil && record.status?.finalization_date !== 'NIL')}
                                        className={isNil || record.status?.finalization_date === 'NIL' ? 'bg-purple-500 hover:bg-purple-600' : ''}
                                    >
                                        {isSubmitting ? 'Filing...' : 'Confirm Filing'}
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Filing Status</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove the filing status for this company? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={handleRemove}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Removing...' : 'Remove Filing'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
