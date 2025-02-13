import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { CompanyPayrollRecord } from '../../types';
import { formatDate } from '../../utils/payrollUtils';
import { RotateCcw } from "lucide-react";

interface FinalizeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (recordId: string, isNil: boolean, assignedTo: string) => Promise<void>;
    onRevert?: (recordId: string) => Promise<void>;
    recordId: string | null;
    record?: CompanyPayrollRecord;
    assignedTo: string;
    isNil: boolean;
}

export function FinalizeDialog({
    open,
    onOpenChange,
    onConfirm,
    onRevert,
    recordId,
    record,
    assignedTo: initialAssignedTo,
    isNil: initialIsNil
}: FinalizeDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [assignedTo, setAssignedTo] = useState(initialAssignedTo);
    const [isNil, setIsNil] = useState(initialIsNil);
    const [confirmRevert, setConfirmRevert] = useState(false);

    if (!record) return null;

    const handleConfirm = async () => {
        if (!recordId) return;
        setIsSubmitting(true);
        try {
            await onConfirm(recordId, isNil, assignedTo);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRevert = async () => {
        if (!recordId || !onRevert) return;
        setIsSubmitting(true);
        try {
            await onRevert(recordId);
            setConfirmRevert(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const allDocumentsUploaded = Object.entries(record.documents)
        .filter(([key]) => key !== 'all_csv')
        .some(([_, value]) => value !== null);

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
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge variant={record.status.finalization_date ? "default" : "secondary"}>
                                        {record.status.finalization_date ? formatDate(record.status.finalization_date) : 'Not Finalized'}
                                    </Badge>
                                    <Badge className={isNil ? 'bg-purple-500' : 'bg-blue-500'}>
                                        {isNil ? 'NIL Return' : 'Regular Return'}
                                    </Badge>
                                </div>
                                {record.status.finalization_date && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-gray-500 hover:text-red-500"
                                        onClick={() => setConfirmRevert(true)}
                                        disabled={isSubmitting}
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
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
                            {record.status.finalization_date && (
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Finalized By</span>
                                    <span className="text-sm font-medium">{record.status.assigned_to || 'N/A'}</span>
                                </div>
                            )}
                        </div>

                        {!record.status.finalization_date && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="nil-switch" className="text-sm text-gray-600">NIL Return</Label>
                                    <Switch
                                        id="nil-switch"
                                        checked={isNil}
                                        onCheckedChange={setIsNil}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="assigned-to" className="text-sm text-gray-600">Assigned To</Label>
                                    <Input
                                        id="assigned-to"
                                        value={assignedTo}
                                        onChange={(e) => setAssignedTo(e.target.value)}
                                        placeholder="Enter name"
                                        className="w-full"
                                    />
                                </div>

                                <DialogFooter>
                                    <Button
                                        onClick={handleConfirm}
                                        disabled={isSubmitting}
                                        className={isNil ? 'bg-purple-500 hover:bg-purple-600' : 'bg-green-500'}
                                    >
                                        {isSubmitting ? 'Finalizing...' : 'Finalize'}
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmRevert} onOpenChange={setConfirmRevert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revert Finalization</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to revert the finalization status? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmRevert(false)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={handleRevert}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Reverting...' : 'Revert Finalization'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
