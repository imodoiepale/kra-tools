import { useState } from 'react';
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

    if (!record) return null;

    const handleConfirm = async () => {
        if (!recordId) return;
        setIsSubmitting(true);
        try {
            await onConfirm(recordId, date);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemove = async () => {
        if (!recordId) return;
        setIsSubmitting(true);
        try {
            await onRemove(recordId);
        } finally {
            setIsSubmitting(false);
        }
    };

    const allDocumentsUploaded = Object.entries(record.documents)
        .filter(([key]) => key !== 'all_csv')
        .every(([_, value]) => value !== null);

    const getDocumentCount = () => {
        const totalDocs = Object.keys(record.documents).length - 1; // Exclude all_csv
        const uploadedDocs = Object.entries(record.documents)
            .filter(([key, value]) => key !== 'all_csv' && value !== null)
            .length;
        return `${uploadedDocs}/${totalDocs}`;
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-lg">
                    <DialogHeader className="pb-4 border-b">
                        <div className="space-y-2">
                            <DialogTitle className="text-xl font-semibold text-blue-600">
                                {record.company.company_name}
                            </DialogTitle>
                            <div className="flex items-center gap-2">
                                <Badge className={`px-3 py-1 ${isNil ? 'bg-purple-500' : 'bg-blue-500'}`}>
                                    {isNil ? 'NIL Filing' : 'Regular Filing'}
                                </Badge>
                                {record.status.filing?.filingDate ? (
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
                                {isNil ? (
                                    <Badge variant="outline" className="text-xs">
                                        N/A
                                    </Badge>
                                ) : (
                                    <Badge className={`text-xs ${allDocumentsUploaded ? 'bg-green-500' : 'bg-yellow-500'}`}>
                                        {getDocumentCount()}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Finalization Date</span>
                                <Badge className={isNil ? 'bg-purple-500' : 'bg-green-500'}>
                                    {formatDate(record.status.finalization_date)}
                                </Badge>
                            </div>
                        </div>

                        {record.status.filing?.filingDate ? (
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
                                    <Label className="text-sm">Select Filing Date</Label>
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(date) => date && setDate(date)}
                                        disabled={(date) =>
                                            date > new Date() || date < new Date(2021, 0, 1)
                                        }
                                        className="rounded-md border"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleConfirm}
                                        disabled={isSubmitting || (!allDocumentsUploaded && !isNil)}
                                        className={isNil ? 'bg-purple-500 hover:bg-purple-600' : ''}
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
