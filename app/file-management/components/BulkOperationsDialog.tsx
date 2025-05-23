"use client";

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import {
    CalendarIcon,
    CheckCircle,
    Clock,
    Download,
    Mail,
    Send,
    Upload,
    XCircle
} from "lucide-react";
import { toast } from 'react-hot-toast';

interface BulkOperationsDialogProps {
    children: React.ReactNode;
    selectedCompanies: string[];
    year: number;
    month: number;
    onBulkOperation: (operation: any) => Promise<void>;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export default function BulkOperationsDialog({
    children,
    selectedCompanies,
    year,
    month,
    onBulkOperation,
    open,
    onOpenChange
}: BulkOperationsDialogProps) {
    const [operationType, setOperationType] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [isUrgent, setIsUrgent] = useState<boolean>(false);
    const [isNil, setIsNil] = useState<boolean>(false);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [loading, setLoading] = useState<boolean>(false);

    const handleSubmit = async () => {
        if (!operationType) {
            toast.error('Please select an operation type');
            return;
        }

        setLoading(true);

        try {
            const operation = {
                type: operationType,
                companies: selectedCompanies,
                year,
                month,
                notes,
                isUrgent,
                isNil,
                date: selectedDate,
            };

            await onBulkOperation(operation);

            // Reset form
            setOperationType('');
            setNotes('');
            setIsUrgent(false);
            setIsNil(false);
            setSelectedDate(new Date());

            // Close dialog
            if (onOpenChange) {
                onOpenChange(false);
            }

            toast.success(`Bulk operation completed for ${selectedCompanies.length} companies`, {
                icon: '✅',
                style: {
                    borderRadius: '10px',
                    background: '#1e40af',
                    color: '#fff',
                },
            });
        } catch (error) {
            console.error('Error performing bulk operation:', error);
            toast.error('Failed to perform bulk operation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-blue-800">
                        Bulk Operations
                    </DialogTitle>
                    <DialogDescription>
                        Apply operations to {selectedCompanies.length} selected companies for {format(new Date(year, month - 1), 'MMMM yyyy')}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="operation-type" className="text-blue-800">Operation Type</Label>
                        <Select value={operationType} onValueChange={setOperationType}>
                            <SelectTrigger id="operation-type" className="border-blue-200">
                                <SelectValue placeholder="Select operation" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>File Status</SelectLabel>
                                    <SelectItem value="mark-received">Mark as Received</SelectItem>
                                    <SelectItem value="mark-delivered">Mark as Delivered</SelectItem>
                                    <SelectItem value="mark-nil">Mark as NIL</SelectItem>
                                    <SelectItem value="mark-urgent">Mark as Urgent</SelectItem>
                                    <SelectItem value="reset-status">Reset Status</SelectItem>
                                </SelectGroup>
                                <SelectGroup>
                                    <SelectLabel>Communications</SelectLabel>
                                    <SelectItem value="send-reminders">Send Reminders</SelectItem>
                                    <SelectItem value="generate-reports">Generate Reports</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {(operationType === 'mark-received' || operationType === 'mark-delivered') && (
                        <div className="space-y-2">
                            <Label htmlFor="date" className="text-blue-800">Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full border-blue-200 justify-start text-left font-normal"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={setSelectedDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}

                    {operationType === 'mark-urgent' && (
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="urgent"
                                checked={isUrgent}
                                onCheckedChange={setIsUrgent}
                                className="data-[state=checked]:bg-red-600"
                            />
                            <Label htmlFor="urgent" className="text-red-700">Mark as Urgent</Label>
                        </div>
                    )}

                    {operationType === 'mark-nil' && (
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="nil"
                                checked={isNil}
                                onCheckedChange={setIsNil}
                                className="data-[state=checked]:bg-purple-600"
                            />
                            <Label htmlFor="nil" className="text-purple-700">Mark as NIL</Label>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="notes" className="text-blue-800">Notes</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add notes about this bulk operation..."
                            className="border-blue-200 min-h-[100px]"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange && onOpenChange(false)}
                        className="border-blue-200"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={loading || !operationType}
                    >
                        {loading ? (
                            <>
                                <Clock className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Apply to {selectedCompanies.length} Companies
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
