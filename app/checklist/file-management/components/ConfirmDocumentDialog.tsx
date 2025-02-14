// @ts-nocheck
"use client"

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
    XCircle,
    CalendarIcon,
    Clock,
    User,
    Building2,
    FileCheck,
    CheckCircle,
    Edit2,
    Files,
    Ban
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

export default function ConfirmDocumentDialog({
    companyName,
    year,
    month,
    kraPin,
    onConfirm,
    existingData,
    className
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isNil, setIsNil] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date(),
        time: format(new Date(), 'HH:mm'),
        broughtBy: '',
        deliveryMethod: 'physical',
        notes: '',
        documentType: 'standard',
        filesCount: '1',
        processingStatus: 'pending',
        isNil: false
    });

    useEffect(() => {
        if (existingData) {
            setIsNil(existingData.isNil || false);
            const receivedAt = existingData.receivedAt ? new Date(existingData.receivedAt) : new Date();
            setFormData({
                date: receivedAt,
                time: format(receivedAt, 'HH:mm'),
                broughtBy: existingData.broughtBy || '',
                deliveryMethod: existingData.deliveryMethod || 'physical',
                notes: existingData.notes || '',
                documentType: existingData.documentType || 'standard',
                filesCount: existingData.filesCount || '1',
                processingStatus: existingData.processingStatus || 'pending',
                isNil: existingData.isNil || false
            });
        }
    }, [existingData]);

    const documentTypes = [
        { value: 'standard', label: 'Standard Documents' },
        { value: 'financial', label: 'Financial Statements' },
        { value: 'tax', label: 'Tax Returns' },
        { value: 'audit', label: 'Audit Documents' },
        { value: 'payroll', label: 'Payroll Documents' },
        { value: 'legal', label: 'Legal Documents' },
        { value: 'contracts', label: 'Contracts' },
        { value: 'invoices', label: 'Invoices' },
        { value: 'bank', label: 'Bank Statements' },
        { value: 'other', label: 'Other' }
    ];

    const deliveryMethods = [
        { value: 'physical', label: 'Physical Delivery' },
        { value: 'courier', label: 'Courier Service' },
        { value: 'email', label: 'Email' },
        { value: 'portal', label: 'Client Portal' },
        { value: 'internal', label: 'Internal Transfer' },
        { value: 'mail', label: 'Postal Mail' }
    ];

    const processingStatuses = [
        { value: 'pending', label: 'Pending Processing' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'processed', label: 'Processed' },
        { value: 'on_hold', label: 'On Hold' },
        { value: 'needs_review', label: 'Needs Review' }
    ];

    const handleInputChange = (field) => (e) => {
        setFormData(prev => ({
            ...prev,
            [field]: e.target.value
        }));
    };

    const handleDateChange = (newDate) => {
        setFormData(prev => ({
            ...prev,
            date: newDate
        }));
    };

    const handleSelectChange = (field) => (value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleNilToggle = (checked) => {
        setIsNil(checked);
        if (checked) {
            // Pre-fill with NIL values
            setFormData(prev => ({
                ...prev,
                broughtBy: 'NIL',
                deliveryMethod: 'nil',
                notes: 'No documents received - NIL',
                documentType: 'nil',
                filesCount: '0',
                processingStatus: 'nil',
                isNil: true
            }));
        } else {
            // Reset to default values
            setFormData(prev => ({
                ...prev,
                broughtBy: '',
                deliveryMethod: 'physical',
                notes: '',
                documentType: 'standard',
                filesCount: '1',
                processingStatus: 'pending',
                isNil: false
            }));
        }
    };

    const validateForm = () => {
        if (isNil) return true;

        if (!formData.broughtBy?.trim()) {
            toast.error('Please enter who brought the documents');
            return false;
        }

        if (!formData.date) {
            toast.error('Please select a date');
            return false;
        }

        if (!formData.time) {
            toast.error('Please enter the time');
            return false;
        }

        if (!formData.filesCount || parseInt(formData.filesCount) < 1) {
            toast.error('Number of files must be at least 1');
            return false;
        }

        return true;
    };

    const handleConfirm = () => {
        if (!validateForm()) return;

        const dateTime = new Date(formData.date);
        const [hours, minutes] = formData.time.split(':');
        dateTime.setHours(parseInt(hours), parseInt(minutes));

        const confirmationData = {
            receivedAt: isNil ? null : dateTime.toISOString(),
            broughtBy: isNil ? 'NIL' : formData.broughtBy,
            deliveryMethod: isNil ? 'nil' : formData.deliveryMethod,
            documentType: isNil ? 'nil' : formData.documentType,
            filesCount: isNil ? '0' : formData.filesCount,
            notes: isNil ? 'No documents received - NIL' : formData.notes,
            processingStatus: isNil ? 'nil' : formData.processingStatus,
            isNil: isNil,
            lastModified: new Date().toISOString(),
            modificationHistory: existingData?.modificationHistory
                ? [...existingData.modificationHistory, {
                    timestamp: new Date().toISOString(),
                    action: existingData ? 'updated' : 'created',
                    previousStatus: existingData?.processingStatus || 'none'
                }]
                : [{
                    timestamp: new Date().toISOString(),
                    action: 'created',
                    previousStatus: 'none'
                }]
        };

        onConfirm(confirmationData, kraPin);
        setIsOpen(false);
        toast.success(existingData ? 'Document record updated successfully' : 'Document receipt confirmed successfully');

        // Reset form
        setFormData({
            date: new Date(),
            time: format(new Date(), 'HH:mm'),
            broughtBy: '',
            deliveryMethod: 'physical',
            notes: '',
            documentType: 'standard',
            filesCount: '1',
            processingStatus: 'pending',
            isNil: false
        });
        setIsNil(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {existingData ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn("flex items-center space-x-1", className)}
                    >
                        {existingData.isNil ? (
                            <Ban className="h-5 w-5 text-red-500" />
                        ) : (
                            <>
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                <Edit2 className="h-4 w-4 ml-1" />
                            </>
                        )}
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn("p-0 h-8 w-8", className)}
                    >
                        <XCircle className="h-5 w-5 text-red-500" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <FileCheck className="h-5 w-5" />
                        <span>{existingData ? 'Edit Document Record' : 'File Receiving Confirmation'}</span>
                    </DialogTitle>
                    <DialogDescription className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4" />
                        <span>{companyName} - {month}/{year}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center space-x-2 py-4 border-b">
                    <Switch
                        id="nil-mode"
                        checked={isNil}
                        onCheckedChange={handleNilToggle}
                    />
                    <Label htmlFor="nil-mode" className="font-medium">
                        Mark as NIL (No Documents Received)
                    </Label>
                </div>

                {!isNil && (
                    <div className="grid grid-cols-2 gap-4 py-4">
                        {/* Who brought the documents */}
                        <div className="grid gap-2">
                            <Label htmlFor="broughtBy" className="flex items-center space-x-2">
                                <User className="h-4 w-4" />
                                <span>Brought By*</span>
                            </Label>
                            <Input
                                id="broughtBy"
                                value={formData.broughtBy}
                                onChange={handleInputChange('broughtBy')}
                                placeholder="Enter name of person who delivered"
                            />
                        </div>

                        {/* Date Selection */}
                        <div className="grid gap-2">
                            <Label className="flex items-center space-x-2">
                                <CalendarIcon className="h-4 w-4" />
                                <span>Date Received*</span>
                            </Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="justify-start text-left font-normal"
                                    >
                                        {formData.date ? (
                                            format(formData.date, 'PPP')
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={formData.date}
                                        onSelect={handleDateChange}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Time Selection */}
                        <div className="grid gap-2">
                            <Label htmlFor="time" className="flex items-center space-x-2">
                                <Clock className="h-4 w-4" />
                                <span>Time Received*</span>
                            </Label>
                            <Input
                                id="time"
                                type="time"
                                value={formData.time}
                                onChange={handleInputChange('time')}
                            />
                        </div>

                        {/* Delivery Method */}
                        <div className="grid gap-2">
                            <Label htmlFor="deliveryMethod">Delivery Method*</Label>
                            <Select
                                value={formData.deliveryMethod}
                                onValueChange={handleSelectChange('deliveryMethod')}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {deliveryMethods.map(method => (
                                        <SelectItem key={method.value} value={method.value}>
                                            {method.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Document Type */}
                        <div className="grid gap-2">
                            <Label htmlFor="documentType">Document Type</Label>
                            <Select
                                value={formData.documentType}
                                onValueChange={handleSelectChange('documentType')}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {documentTypes.map(type => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Processing Status */}
                        <div className="grid gap-2">
                            <Label htmlFor="processingStatus">Processing Status</Label>
                            <Select
                                value={formData.processingStatus}
                                onValueChange={handleSelectChange('processingStatus')}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {processingStatuses.map(status => (
                                        <SelectItem key={status.value} value={status.value}>
                                            {status.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Number of Files */}
                        <div className="grid gap-2">
                            <Label htmlFor="filesCount" className="flex items-center space-x-2">
                                <Files className="h-4 w-4" />
                                <span>Number of Files*</span>
                            </Label>
                            <Input
                                id="filesCount"
                                type="number"
                                min="1"
                                value={formData.filesCount}
                                onChange={handleInputChange('filesCount')}
                            />
                            </div>

{/* Notes */}
<div className="col-span-2 grid gap-2">
    <Label htmlFor="notes">Additional Notes</Label>
    <Textarea
        id="notes"
        placeholder="Enter any additional notes..."
        value={formData.notes}
        onChange={handleInputChange('notes')}
        rows={3}
    />
</div>
</div>
)}

{isNil && (
<div className="py-4">
<div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
    <p className="text-sm font-medium">This record will be marked as NIL:</p>
    <ul className="mt-2 text-sm list-disc list-inside space-y-1">
        <li>No documents received for this period</li>
        <li>All fields will be marked as &quot;NIL&quot;</li>
        <li>This can be changed later if documents are received</li>
    </ul>
</div>
</div>
)}

<DialogFooter>
<Button
type="button"
variant="outline"
onClick={() => setIsOpen(false)}
>
Cancel
</Button>
<Button 
onClick={handleConfirm}
className={cn(
    isNil ? "bg-red-600 hover:bg-red-700" : ""
)}
>
{isNil ? 'Confirm NIL Record' : (existingData ? 'Update Record' : 'Confirm Receipt')}
</Button>
</DialogFooter>
</DialogContent>
</Dialog>
);
}