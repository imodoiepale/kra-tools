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
import { CompanyPayrollRecord } from '../../types';

interface FinalizeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (recordId: string, isNil: boolean, assignedTo: string) => Promise<void>;
    recordId: string | null;
    record?: CompanyPayrollRecord;
    assignedTo: string;
    isNil: boolean;
}

export function FinalizeDialog({
    open,
    onOpenChange,
    onConfirm,
    recordId,
    record,
    assignedTo: initialAssignedTo,
    isNil: initialIsNil
}: FinalizeDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [assignedTo, setAssignedTo] = useState(initialAssignedTo);
    const [isNil, setIsNil] = useState(initialIsNil);

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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader className="pb-4 border-b">
                    <div className="space-y-2">
                        <DialogTitle className="text-xl font-semibold text-blue-600">
                            {record.company.company_name}
                        </DialogTitle>
                        <div className="flex items-center gap-2">
                            <Badge className={`px-3 py-1 ${isNil ? 'bg-purple-500' : 'bg-blue-500'}`}>
                                {isNil ? 'NIL Return' : 'Regular Return'}
                            </Badge>
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
                    </div>

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
                    </div>
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
            </DialogContent>
        </Dialog>
    );
}
