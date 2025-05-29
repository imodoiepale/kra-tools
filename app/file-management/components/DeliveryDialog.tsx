// @ts-nocheck
"use client"

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CheckCircle, XCircle, CalendarIcon, Clock, User, Building2, FileCheck, Truck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

export default function DeliveryDialog({
    companyName,
    year,
    month,
    kraPin,
    onConfirm,
    existingData,
    className
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date(),
        time: format(new Date(), 'HH:mm'),
        pickedBy: '',
        deliveryMethod: 'physical',
        notes: '',
        contactPerson: '',
        deliveryLocation: '',
        status: 'delivered'
    });

    // Initialize form with existing data if available
    useEffect(() => {
        if (existingData) {
            const deliveredAt = existingData.deliveredAt ? new Date(existingData.deliveredAt) : new Date();
            setFormData({
                date: deliveredAt,
                time: format(deliveredAt, 'HH:mm'),
                pickedBy: existingData.pickedBy || '',
                deliveryMethod: existingData.deliveryMethod || 'physical',
                notes: existingData.deliveryNotes || '',
                contactPerson: existingData.contactPerson || '',
                deliveryLocation: existingData.deliveryLocation || '',
                status: existingData.status || 'delivered'
            });
        }
    }, [existingData]);

    const deliveryMethods = [
        { value: 'physical', label: 'Physical Pickup' },
        { value: 'courier', label: 'Courier Service' },
        { value: 'internal', label: 'Internal Delivery' },
        { value: 'mail', label: 'Mail Service' }
    ];

    const statusOptions = [
        { value: 'delivered', label: 'Delivered' },
        { value: 'pending', label: 'Pending Delivery' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'returned', label: 'Returned' }
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

    const validateForm = () => {
        if (!formData.pickedBy.trim()) {
            toast.error('Please enter who picked up the documents');
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
        if (!formData.contactPerson.trim()) {
            toast.error('Please enter a contact person');
            return false;
        }
        return true;
    };

    const handleConfirm = () => {
        if (!validateForm()) return;

        const dateTime = new Date(formData.date);
        const [hours, minutes] = formData.time.split(':');
        dateTime.setHours(parseInt(hours), parseInt(minutes));

        const deliveryData = {
            deliveredAt: dateTime.toISOString(),
            pickedBy: formData.pickedBy,
            deliveryMethod: formData.deliveryMethod,
            deliveryNotes: formData.notes,
            contactPerson: formData.contactPerson,
            deliveryLocation: formData.deliveryLocation,
            status: formData.status,
            filesDelivered: formData.status === 'delivered'
        };

        onConfirm(deliveryData, kraPin);
        setIsOpen(false);
        toast.success('Delivery information updated successfully');
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn("flex items-center", className)}
                >
                    {existingData?.filesDelivered ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <Truck className="h-5 w-5" />
                        <span>Document Delivery Information</span>
                    </DialogTitle>
                    <DialogDescription className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4" />
                        <span>{companyName}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Picked By */}
                    <div className="grid gap-2">
                        <Label htmlFor="pickedBy" className="flex items-center space-x-2">
                            <User className="h-4 w-4" />
                            <span>Picked By</span>
                        </Label>
                        <Input
                            id="pickedBy"
                            value={formData.pickedBy}
                            onChange={handleInputChange('pickedBy')}
                            placeholder="Enter name of person who picked up"
                        />
                    </div>

                    {/* Contact Person */}
                    <div className="grid gap-2">
                        <Label htmlFor="contactPerson">Contact Person</Label>
                        <Input
                            id="contactPerson"
                            value={formData.contactPerson}
                            onChange={handleInputChange('contactPerson')}
                            placeholder="Enter contact person name"
                        />
                    </div>

                    {/* Delivery Location */}
                    <div className="grid gap-2">
                        <Label htmlFor="deliveryLocation">Delivery Location</Label>
                        <Input
                            id="deliveryLocation"
                            value={formData.deliveryLocation}
                            onChange={handleInputChange('deliveryLocation')}
                            placeholder="Enter delivery location"
                        />
                    </div>

                    {/* Date Selection */}
                    <div className="grid gap-2">
                        <Label className="flex items-center space-x-2">
                            <CalendarIcon className="h-4 w-4" />
                            <span>Delivery Date</span>
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
                            <span>Delivery Time</span>
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
                        <Label htmlFor="deliveryMethod">Delivery Method</Label>
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

                    {/* Delivery Status */}
                    <div className="grid gap-2">
                        <Label htmlFor="status">Delivery Status</Label>
                        <Select
                            value={formData.status}
                            onValueChange={handleSelectChange('status')}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {statusOptions.map(status => (
                                    <SelectItem key={status.value} value={status.value}>
                                        {status.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Notes */}
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Delivery Notes</Label>
                        <Textarea
                            id="notes"
                            placeholder="Enter any delivery notes..."
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
                        {existingData ? 'Update Delivery' : 'Confirm Delivery'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}