"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import {
    Truck,
    CalendarIcon,
    Clock,
    User,
    Building2,
    MapPin,
    CheckCircle,
    XCircle,
    Edit3,
    Save,
    Phone,
    Mail
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

interface EnhancedDeliveryDialogProps {
    companyName: string;
    companyId: string;
    year: number;
    month: number;
    onConfirm: (data: any) => Promise<void>;
    existingData?: any;
    receptionData?: any; // Data from reception to pre-fill
    className?: string;
}

export default function EnhancedDeliveryDialog({
    companyName,
    companyId,
    year,
    month,
    onConfirm,
    existingData,
    receptionData,
    className
}: EnhancedDeliveryDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date(),
        time: format(new Date(), 'HH:mm'),
        pickedBy: '',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        deliveryMethod: 'physical',
        deliveryLocation: '',
        deliveryNotes: '',
        deliveryStatus: 'delivered',
        requiresSignature: true,
        isUrgent: false
    });

    useEffect(() => {
        if (existingData) {
            const deliveredAt = existingData.delivered_at ? new Date(existingData.delivered_at) : new Date();
            setFormData({
                date: deliveredAt,
                time: format(deliveredAt, 'HH:mm'),
                pickedBy: existingData.picked_by || '',
                contactPerson: existingData.contact_person || '',
                contactPhone: existingData.contact_phone || '',
                contactEmail: existingData.contact_email || '',
                deliveryMethod: existingData.delivery_method || 'physical',
                deliveryLocation: existingData.delivery_location || '',
                deliveryNotes: existingData.delivery_notes || '',
                deliveryStatus: existingData.delivery_status || 'delivered',
                requiresSignature: existingData.requires_signature ?? true,
                isUrgent: existingData.is_urgent || false
            });
        }
    }, [existingData]);

    const deliveryMethodOptions = [
        {
            value: 'physical',
            label: 'Physical Pickup',
            icon: '🚶',
            description: 'Client comes to office',
            color: 'bg-blue-50 border-blue-200 text-blue-700'
        },
        {
            value: 'courier',
            label: 'Courier Service',
            icon: '🚚',
            description: 'Professional courier delivery',
            color: 'bg-green-50 border-green-200 text-green-700'
        },
        {
            value: 'internal',
            label: 'Internal Delivery',
            icon: '🏢',
            description: 'Delivered by staff member',
            color: 'bg-purple-50 border-purple-200 text-purple-700'
        },
        {
            value: 'mail',
            label: 'Mail Service',
            icon: '📮',
            description: 'Postal or registered mail',
            color: 'bg-orange-50 border-orange-200 text-orange-700'
        }
    ];

    const deliveryStatusOptions = [
        { value: 'delivered', label: 'Successfully Delivered', icon: '✅', color: 'text-green-600' },
        { value: 'attempted', label: 'Delivery Attempted', icon: '⏳', color: 'text-yellow-600' },
        { value: 'pending', label: 'Pending Delivery', icon: '📋', color: 'text-blue-600' },
        { value: 'returned', label: 'Returned to Office', icon: '↩️', color: 'text-red-600' },
        { value: 'cancelled', label: 'Delivery Cancelled', icon: '❌', color: 'text-gray-600' }
    ];

    const validateForm = () => {
        if (!formData.pickedBy.trim()) {
            toast.error('Please specify who picked up the documents');
            return false;
        }

        if (!formData.contactPerson.trim()) {
            toast.error('Please enter a contact person name');
            return false;
        }

        if (formData.deliveryMethod === 'courier' && !formData.deliveryLocation.trim()) {
            toast.error('Please enter delivery location for courier service');
            return false;
        }

        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setIsLoading(true);
        try {
            const dateTime = new Date(formData.date);
            const [hours, minutes] = formData.time.split(':');
            dateTime.setHours(parseInt(hours), parseInt(minutes));

            const submissionData = {
                delivered_at: dateTime.toISOString(),
                picked_by: formData.pickedBy,
                contact_person: formData.contactPerson,
                contact_phone: formData.contactPhone,
                contact_email: formData.contactEmail,
                delivery_method: formData.deliveryMethod,
                delivery_location: formData.deliveryLocation,
                delivery_notes: formData.deliveryNotes,
                delivery_status: formData.deliveryStatus,
                requires_signature: formData.requiresSignature,
                is_urgent: formData.isUrgent,
                status: formData.deliveryStatus === 'delivered' ? 'delivered' : 'processed',
                // Metadata
                updated_at: new Date().toISOString(),
                updated_by: 'current_user' // Replace with actual user
            };

            await onConfirm(submissionData);
            setIsOpen(false);
            toast.success(
                existingData
                    ? 'Delivery record updated successfully'
                    : 'Document delivery confirmed successfully',
                {
                    icon: '🚀',
                    style: {
                        borderRadius: '10px',
                        background: '#1e40af',
                        color: '#fff',
                    },
                }
            );
        } catch (error) {
            console.error('Submission error:', error);
            toast.error('Failed to save delivery record');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusIcon = () => {
        if (existingData?.delivery_status === 'delivered') return <CheckCircle className="h-5 w-5 text-green-500" />;
        return <XCircle className="h-5 w-5 text-red-500" />;
    };

    const getStatusBadge = () => {
        if (existingData?.delivery_status === 'delivered') return <Badge className="bg-green-500">Delivered</Badge>;
        if (existingData?.delivery_status === 'pending') return <Badge className="bg-yellow-500">Pending</Badge>;
        return <Badge variant="outline">Not Delivered</Badge>;
    };

    // Check if documents were received (prerequisite for delivery)
    const canDeliver = receptionData?.received_at || existingData?.received_at;

    if (!canDeliver) {
        return (
            <Button
                variant="ghost"
                size="sm"
                disabled
                className="flex items-center space-x-2 text-gray-400 cursor-not-allowed"
            >
                <XCircle className="h-5 w-5" />
                <span className="text-xs">Not Received</span>
            </Button>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "flex items-center space-x-2 hover:bg-blue-50 transition-colors",
                        className
                    )}
                >
                    {getStatusIcon()}
                    {existingData && <Edit3 className="h-3 w-3 ml-1 text-blue-600" />}
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-3">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center space-x-3 text-blue-800">
                            <div className="p-2 bg-blue-100 rounded-full">
                                <Truck className="h-5 w-5 text-blue-600" />
                            </div>
                            <span>{existingData ? 'Edit Delivery Record' : 'Document Delivery'}</span>
                        </DialogTitle>
                        {getStatusBadge()}
                    </div>

                    <Card className="border-blue-200 bg-blue-50/50">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <p className="font-semibold text-blue-800">{companyName}</p>
                                        <p className="text-sm text-blue-600">
                                            {format(new Date(year, month - 1), 'MMMM yyyy')}
                                        </p>
                                    </div>
                                </div>
                                {receptionData?.is_urgent && (
                                    <Badge variant="destructive" className="animate-pulse">
                                        URGENT
                                    </Badge>
                                )}
                            </div>

                            {receptionData && (
                                <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                                    <p className="text-xs text-blue-600 font-medium">Reception Details:</p>
                                    <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                                        <span>Received: {format(new Date(receptionData.received_at), 'dd/MM/yyyy HH:mm')}</span>
                                        <span>Files: {receptionData.files_count}</span>
                                        <span>Brought by: {receptionData.brought_by}</span>
                                        <span>Method: {receptionData.delivery_method}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Delivery Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-blue-800 flex items-center">
                                <User className="h-4 w-4 mr-2" />
                                Delivery Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="pickedBy" className="text-blue-700">Picked Up By *</Label>
                                    <Input
                                        id="pickedBy"
                                        value={formData.pickedBy}
                                        onChange={(e) => setFormData(prev => ({ ...prev, pickedBy: e.target.value }))}
                                        placeholder="Name of person who collected"
                                        className="border-blue-200 focus:border-blue-400"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="contactPerson" className="text-blue-700">Contact Person *</Label>
                                    <Input
                                        id="contactPerson"
                                        value={formData.contactPerson}
                                        onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                                        placeholder="Primary contact name"
                                        className="border-blue-200 focus:border-blue-400"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="contactPhone" className="text-blue-700">Contact Phone</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600" />
                                        <Input
                                            id="contactPhone"
                                            value={formData.contactPhone}
                                            onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                                            placeholder="+254 xxx xxx xxx"
                                            className="pl-10 border-blue-200 focus:border-blue-400"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="contactEmail" className="text-blue-700">Contact Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600" />
                                        <Input
                                            id="contactEmail"
                                            type="email"
                                            value={formData.contactEmail}
                                            onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                                            placeholder="contact@company.com"
                                            className="pl-10 border-blue-200 focus:border-blue-400"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-blue-700">Delivery Date *</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start border-blue-200 hover:bg-blue-50"
                                            >
                                                <CalendarIcon className="h-4 w-4 mr-2 text-blue-600" />
                                                {format(formData.date, 'PPP')}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={formData.date}
                                                onSelect={(date) => date && setFormData(prev => ({ ...prev, date }))}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div>
                                    <Label htmlFor="time" className="text-blue-700">Delivery Time *</Label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600" />
                                        <Input
                                            id="time"
                                            type="time"
                                            value={formData.time}
                                            onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                                            className="pl-10 border-blue-200 focus:border-blue-400"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Delivery Method */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-blue-800 flex items-center">
                                <Truck className="h-4 w-4 mr-2" />
                                Delivery Method
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {deliveryMethodOptions.map((method) => (
                                    <Button
                                        key={method.value}
                                        variant={formData.deliveryMethod === method.value ? "default" : "outline"}
                                        className={cn(
                                            "h-auto p-4 justify-start text-left",
                                            formData.deliveryMethod === method.value
                                                ? "bg-blue-600 hover:bg-blue-700 text-white"
                                                : `${method.color} hover:bg-blue-100`
                                        )}
                                        onClick={() => setFormData(prev => ({ ...prev, deliveryMethod: method.value }))}
                                    >
                                        <div className="flex items-start space-x-3">
                                            <span className="text-lg">{method.icon}</span>
                                            <div>
                                                <p className="font-medium">{method.label}</p>
                                                <p className="text-xs opacity-75">{method.description}</p>
                                            </div>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Delivery Location & Status */}
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div>
                                <Label htmlFor="deliveryLocation" className="text-blue-700 flex items-center">
                                    <MapPin className="h-4 w-4 mr-2" />
                                    Delivery Location
                                    {formData.deliveryMethod === 'courier' && <span className="text-red-500 ml-1">*</span>}
                                </Label>
                                <Input
                                    id="deliveryLocation"
                                    value={formData.deliveryLocation}
                                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryLocation: e.target.value }))}
                                    placeholder={
                                        formData.deliveryMethod === 'physical'
                                            ? "Office location / reception desk"
                                            : "Full address for delivery"
                                    }
                                    className="border-blue-200 focus:border-blue-400"
                                />
                            </div>

                            <div>
                                <Label htmlFor="deliveryStatus" className="text-blue-700">Delivery Status</Label>
                                <Select
                                    value={formData.deliveryStatus}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, deliveryStatus: value }))}
                                >
                                    <SelectTrigger className="border-blue-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {deliveryStatusOptions.map((status) => (
                                            <SelectItem key={status.value} value={status.value}>
                                                <div className="flex items-center space-x-2">
                                                    <span>{status.icon}</span>
                                                    <span className={status.color}>{status.label}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="deliveryNotes" className="text-blue-700">Delivery Notes</Label>
                                <Textarea
                                    id="deliveryNotes"
                                    placeholder="Enter any delivery notes, special instructions, or observations..."
                                    value={formData.deliveryNotes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryNotes: e.target.value }))}
                                    className="border-blue-200 focus:border-blue-400"
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter className="gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                        className="border-gray-300 hover:bg-gray-50"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
                    >
                        {isLoading ? (
                            <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <Save className="h-4 w-4 mr-2" />
                                {existingData ? 'Update Delivery' : 'Confirm Delivery'}
                            </div>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}