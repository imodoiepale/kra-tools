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
    Files
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
    // State management
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date(),
        time: format(new Date(), 'HH:mm'),
        broughtBy: '',
        deliveryMethod: 'physical',
        notes: '',
        documentType: 'standard',
        filesCount: '1',
        
        processingStatus: 'pending'
    });

    // Initialize form with existing data if available
    useEffect(() => {
        if (existingData) {
            const receivedAt = existingData.receivedAt ? new Date(existingData.receivedAt) : new Date();
            setFormData({
                date: receivedAt,
                time: format(receivedAt, 'HH:mm'),
                broughtBy: existingData.broughtBy || '',
                deliveryMethod: existingData.deliveryMethod || 'physical',
                notes: existingData.notes || '',
                documentType: existingData.documentType || 'standard',
                filesCount: existingData.filesCount || '1',
                
                processingStatus: existingData.processingStatus || 'pending'
            });
        }
    }, [existingData]);

    // Document types with detailed options
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

    // Delivery methods
    const deliveryMethods = [
        { value: 'physical', label: 'Physical Delivery' },
        { value: 'courier', label: 'Courier Service' },
        { value: 'email', label: 'Email' },
        { value: 'portal', label: 'Client Portal' },
        { value: 'internal', label: 'Internal Transfer' },
        { value: 'mail', label: 'Postal Mail' }
    ];

    // Urgency levels
    const urgencyLevels = [
        { value: 'low', label: 'Low Priority' },
        { value: 'normal', label: 'Normal Priority' },
        { value: 'high', label: 'High Priority' },
        { value: 'urgent', label: 'Urgent' },
        { value: 'immediate', label: 'Immediate Action Required' }
    ];

    // Processing status options
    const processingStatuses = [
        { value: 'pending', label: 'Pending Processing' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'processed', label: 'Processed' },
        { value: 'on_hold', label: 'On Hold' },
        { value: 'needs_review', label: 'Needs Review' }
    ];

    // Handle form changes
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

    // Form validation
    const validateForm = () => {
        const validationChecks = [
            { field: 'broughtBy', message: 'Please enter who brought the documents' }
        ];

        for (const check of validationChecks) {
            if (!formData[check.field]?.trim()) {
                toast.error(check.message);
                return false;
            }
        }

        if (!formData.date) {
            toast.error('Please select a date');
            return false;
        }

        if (!formData.time) {
            toast.error('Please enter the time');
            return false;
        }

        if (parseInt(formData.filesCount) < 1) {
            toast.error('Number of files must be at least 1');
            return false;
        }

        return true;
    };

    // Handle form submission
    const handleConfirm = () => {
        if (!validateForm()) return;

        const dateTime = new Date(formData.date);
        const [hours, minutes] = formData.time.split(':');
        dateTime.setHours(parseInt(hours), parseInt(minutes));

        const confirmationData = {
            receivedAt: dateTime.toISOString(),
            broughtBy: formData.broughtBy,
            deliveryMethod: formData.deliveryMethod,
            documentType: formData.documentType,
            filesCount: formData.filesCount,
            notes: formData.notes,
            processingStatus: formData.processingStatus,
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
            processingStatus: 'pending'
        });
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
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <Edit2 className="h-4 w-4 ml-1" />
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
                        <span>{existingData ? 'Edit Document Record' : 'Document Receipt Confirmation'}</span>
                    </DialogTitle>
                    <DialogDescription className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4" />
                        <span>{companyName} - {month}/{year}</span>
                    </DialogDescription>
                </DialogHeader>

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

                    

                    {/* Documents Description */}
                    <div className="col-span-2 grid gap-2">
                        <Label htmlFor="documentsDescription">Documents Description*</Label>
                        <Textarea
                            id="documentsDescription"
                            value={formData.documentsDescription}
                            onChange={handleInputChange('documentsDescription')}
                            placeholder="Enter a description of the documents..."
                            rows={2}
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

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm}>
                        {existingData ? 'Update Record' : 'Confirm Receipt'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}