import { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

interface FinalizeDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onFinalize: (recordId: string, isNil: boolean, assignedTo: string) => void;
    recordId: string | null;
    defaultAssignedTo?: string;
}

export function FinalizeDialog({
    isOpen,
    onOpenChange,
    onFinalize,
    recordId,
    defaultAssignedTo = 'Tushar'
}: FinalizeDialogProps) {
    const [isNil, setIsNil] = useState(false);
    const [assignedTo, setAssignedTo] = useState(defaultAssignedTo);

    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(isOpen) => {
                onOpenChange(isOpen);
                if (!isOpen) {
                    setIsNil(false);
                    setAssignedTo(defaultAssignedTo);
                }
            }}
        >
            <AlertDialogContent className="max-w-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Finalize Company Documents</AlertDialogTitle>
                    <AlertDialogDescription>
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="nil"
                                    checked={isNil}
                                    onCheckedChange={(checked) => setIsNil(!!checked)}
                                />
                                <Label htmlFor="nil">Mark as NIL</Label>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assignedTo">Assigned To</Label>
                                <Input
                                    id="assignedTo"
                                    value={assignedTo}
                                    onChange={(e) => setAssignedTo(e.target.value)}
                                />
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-green-500 hover:bg-green-600"
                        onClick={() => recordId && onFinalize(recordId, isNil, assignedTo)}
                    >
                        Confirm & Finalize
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
