"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import {
    FileCheck,
    CalendarIcon,
    Clock,
    User,
    Building2,
    FileText,
    Package,
    AlertCircle,
    CheckCircle,
    XCircle,
    Edit3,
    Save,
    Ban
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

interface EnhancedReceptionDialogProps {
    companyName: string;
    companyId: string;
    year: number;
    month: number;
    onConfirm: (data: any) => Promise<void>;
    existingData?: any;
    className?: string;
}

export default function EnhancedReceptionDialog({
    companyName,
    companyId,
    year,
    month,
    onConfirm,
    existingData,
    className
}: EnhancedReceptionDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isNil, setIsNil] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date(),
        time: format(new Date(), 'HH:mm'),
        broughtBy: '',
        deliveryMethod: 'physical',
        documentTypes: [] as string[],
        filesCount: 1,
        receptionNotes: '',
        receivedBy: 'Front Desk', // Default receiver
        processingStatus: 'pending',
        isUrgent: false
    });

    useEffect(() => {
        if (existingData) {
            setIsNil(existingData.is_nil || false);
            const receivedAt = existingData.received_at ? new Date(existingData.received_at) : new Date();
            setFormData({
                date: receivedAt,
                time: format(receivedAt, 'HH:mm'),
                broughtBy: existingData.brought_by || '',
                deliveryMethod: existingData.delivery_method || 'physical',
                documentTypes: existingData.document_types || [],
                filesCount: existingData.files_count || 1,
                receptionNotes: existingData.reception_notes || '',
                receivedBy: existingData.received_by || 'Front Desk',
                processingStatus: existingData.processing_status || 'pending',
                isUrgent: existingData.is_urgent || false
            });
        }
    }, [existingData]);

    const documentTypeOptions = [
        { value: 'financial_statements', label: 'Financial Statements', icon: '📊' },
        { value: 'tax_returns', label: 'Tax Returns', icon: '📋' },
        { value: 'audit_documents', label: 'Audit Documents', icon: '🔍' },
        { value: 'payroll_records', label: 'Payroll Records', icon: '💰' },
        { value: 'bank_statements', label: 'Bank Statements', icon: '🏦' },
        { value: 'invoices', label: 'Invoices & Bills', icon: '🧾' },
        { value: 'contracts', label: 'Contracts', icon: '📜' },
        { value: 'legal_documents', label: 'Legal Documents', icon: '⚖️' },
        { value: 'compliance_reports', label: 'Compliance Reports', icon: '📝' },
        { value: 'other', label: 'Other Documents', icon: '📁' }
    ];

    const deliveryMethodOptions = [
        { value: 'physical', label: 'Physical Delivery', icon: '🚶', color: 'bg-blue-50 text-blue-700 border-blue-200' },
        // { value: 'courier', label: 'Courier Service', icon: '🚚', color: 'bg-green-50 text-green-700 border-green-200' },
        { value: 'email', label: 'Email Attachment', icon: '📧', color: 'bg-purple-50 text-purple-700 border-purple-200' },
        { value: 'portal', label: 'Client Portal', icon: '🌐', color: 'bg-orange-50 text-orange-700 border-orange-200' },
        // { value: 'internal', label: 'Internal Transfer', icon: '🔄', color: 'bg-gray-50 text-gray-700 border-gray-200' }
    ];

    const handleDocumentTypeToggle = (docType: string) => {
        setFormData(prev => ({
            ...prev,
            documentTypes: prev.documentTypes.includes(docType)
                ? prev.documentTypes.filter(type => type !== docType)
                : [...prev.documentTypes, docType]
        }));
    };

    const handleNilToggle = (checked: boolean) => {
        setIsNil(checked);
        if (checked) {
            setFormData(prev => ({
                ...prev,
                broughtBy: 'N/A',
                deliveryMethod: 'nil',
                documentTypes: [],
                filesCount: 0,
                receptionNotes: 'No documents received for this period',
                processingStatus: 'nil'
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                broughtBy: '',
                deliveryMethod: 'physical',
                documentTypes: [],
                filesCount: 1,
                receptionNotes: '',
                processingStatus: 'pending'
            }));
        }
    };

    const validateForm = () => {
        if (isNil) return true;

        if (!formData.broughtBy.trim()) {
            toast.error('Please specify who brought the documents');
            return false;
        }

        if (formData.documentTypes.length === 0) {
            toast.error('Please select at least one document type');
            return false;
        }

        if (formData.filesCount < 1) {
            toast.error('Files count must be at least 1');
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
                received_at: isNil ? null : dateTime.toISOString(),
                brought_by: formData.broughtBy,
                delivery_method: formData.deliveryMethod,
                document_types: formData.documentTypes,
                files_count: formData.filesCount,
                reception_notes: formData.receptionNotes,
                received_by: formData.receivedBy,
                processing_status: formData.processingStatus,
                status: isNil ? 'nil' : 'received',
                is_nil: isNil,
                is_urgent: formData.isUrgent,
                // Metadata
                updated_at: new Date().toISOString(),
                updated_by: 'current_user' // Replace with actual user
            };

            await onConfirm(submissionData);
            setIsOpen(false);
            toast.success(
                existingData
                    ? 'Reception record updated successfully'
                    : 'Documents reception confirmed successfully',
                {
                    icon: '✅',
                    style: {
                        borderRadius: '10px',
                        background: '#1e40af',
                        color: '#fff',
                    },
                }
            );
        } catch (error) {
            console.error('Submission error:', error);
            toast.error('Failed to save reception record');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusIcon = () => {
        if (existingData?.is_nil) return <Ban className="h-5 w-5 text-red-500" />;
        if (existingData?.received_at) return <CheckCircle className="h-5 w-5 text-green-500" />;
        return <XCircle className="h-5 w-5 text-red-500" />;
    };

    const getStatusBadge = () => {
        if (existingData?.is_nil) return <Badge variant="destructive">NIL</Badge>;
        if (existingData?.received_at) return <Badge className="bg-green-500">Received</Badge>;
        return <Badge variant="outline">Pending</Badge>;
    };

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

            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-3">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center space-x-3 text-blue-800">
                            <div className="p-2 bg-blue-100 rounded-full">
                                <FileCheck className="h-5 w-5 text-blue-600" />
                            </div>
                            <span>{existingData ? 'Edit Reception Record' : 'Document Reception'}</span>
                        </DialogTitle>
                        {getStatusBadge()}
                    </div>

                    <Card className="border-blue-200 bg-blue-50/50">
                        <CardContent className="pt-4">
                            <div className="flex items-center space-x-3">
                                <Building2 className="h-5 w-5 text-blue-600" />
                                <div>
                                    <p className="font-semibold text-blue-800">{companyName}</p>
                                    <p className="text-sm text-blue-600">
                                        {format(new Date(year, month - 1), 'MMMM yyyy')}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </DialogHeader>

                {/* NIL Toggle */}
                <Card className="border-orange-200">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <AlertCircle className="h-5 w-5 text-orange-600" />
                                <div>
                                    <CardTitle className="text-base text-orange-800">NIL Record</CardTitle>
                                    <p className="text-sm text-orange-600">Mark if no documents were received</p>
                                </div>
                            </div>
                            <Switch
                                checked={isNil}
                                onCheckedChange={handleNilToggle}
                                className="data-[state=checked]:bg-orange-500"
                            />
                        </div>
                    </CardHeader>
                </Card>

                {isNil ? (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="pt-4">
                            <div className="flex items-center space-x-3 text-red-700">
                                <Ban className="h-5 w-5" />
                                <div>
                                    <p className="font-medium">NIL Record Active</p>
                                    <p className="text-sm">This record will be marked as having no documents received</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {/* Basic Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-blue-800 flex items-center">
                                    <User className="h-4 w-4 mr-2" />
                                    Reception Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="broughtBy" className="text-blue-700">Who Brought Documents *</Label>
                                        <Input
                                            id="broughtBy"
                                            value={formData.broughtBy}
                                            onChange={(e) => setFormData(prev => ({ ...prev, broughtBy: e.target.value }))}
                                            placeholder="Enter person's name"
                                            className="border-blue-200 focus:border-blue-400"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="receivedBy" className="text-blue-700">Received By</Label>
                                        <Select
                                            value={formData.receivedBy}
                                            onValueChange={(value) => setFormData(prev => ({ ...prev, receivedBy: value }))}
                                        >
                                            <SelectTrigger className="border-blue-200">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Front Desk">Front Desk</SelectItem>
                                                <SelectItem value="Reception">Reception</SelectItem>
                                                <SelectItem value="Document Controller">Document Controller</SelectItem>
                                                <SelectItem value="Manager">Manager</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-blue-700">Date Received *</Label>
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
                                        <Label htmlFor="time" className="text-blue-700">Time Received *</Label>
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
                                    <Package className="h-4 w-4 mr-2" />
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
                                                "h-auto p-4 justify-start",
                                                formData.deliveryMethod === method.value
                                                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                                                    : `hover:${method.color.replace('text-', 'bg-').replace('-700', '-100')} border-blue-200`
                                            )}
                                            onClick={() => setFormData(prev => ({ ...prev, deliveryMethod: method.value }))}
                                        >
                                            <span className="text-lg mr-3">{method.icon}</span>
                                            <span>{method.label}</span>
                                        </Button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Document Types */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-blue-800 flex items-center">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Document Types *
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {documentTypeOptions.map((docType) => {
                                        const isSelected = formData.documentTypes.includes(docType.value);
                                        return (
                                            <Button
                                                key={docType.value}
                                                variant={isSelected ? "default" : "outline"}
                                                size="sm"
                                                className={cn(
                                                    "h-auto p-3 justify-start text-left",
                                                    isSelected
                                                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                                                        : "hover:bg-blue-50 border-blue-200"
                                                )}
                                                onClick={() => handleDocumentTypeToggle(docType.value)}
                                            >
                                                <span className="mr-2">{docType.icon}</span>
                                                <span className="text-xs">{docType.label}</span>
                                            </Button>
                                        );
                                    })}
                                </div>
                                {formData.documentTypes.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {formData.documentTypes.map((type) => {
                                            const option = documentTypeOptions.find(opt => opt.value === type);
                                            return (
                                                <Badge key={type} variant="secondary" className="bg-blue-100 text-blue-800">
                                                    {option?.icon} {option?.label}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Additional Details */}
                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="filesCount" className="text-blue-700">Number of Files *</Label>
                                        <Input
                                            id="filesCount"
                                            type="number"
                                            min="1"
                                            value={formData.filesCount}
                                            onChange={(e) => setFormData(prev => ({ ...prev, filesCount: parseInt(e.target.value) || 1 }))}
                                            className="border-blue-200 focus:border-blue-400"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="processingStatus" className="text-blue-700">Processing Status</Label>
                                        <Select
                                            value={formData.processingStatus}
                                            onValueChange={(value) => setFormData(prev => ({ ...prev, processingStatus: value }))}
                                        >
                                            <SelectTrigger className="border-blue-200">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pending">📋 Pending</SelectItem>
                                                <SelectItem value="in_progress">⚙️ In Progress</SelectItem>
                                                <SelectItem value="completed">✅ Completed</SelectItem>
                                                <SelectItem value="on_hold">⏸️ On Hold</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3">
                                    <Switch
                                        checked={formData.isUrgent}
                                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isUrgent: checked }))}
                                        className="data-[state=checked]:bg-red-500"
                                    />
                                    <Label className="text-red-700 font-medium">Mark as Urgent</Label>
                                </div>

                                <div>
                                    <Label htmlFor="receptionNotes" className="text-blue-700">Reception Notes</Label>
                                    <Textarea
                                        id="receptionNotes"
                                        placeholder="Enter any additional notes about the document reception..."
                                        value={formData.receptionNotes}
                                        onChange={(e) => setFormData(prev => ({ ...prev, receptionNotes: e.target.value }))}
                                        className="border-blue-200 focus:border-blue-400"
                                        rows={3}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

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
                        className={cn(
                            "min-w-[120px]",
                            isNil
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-blue-600 hover:bg-blue-700"
                        )}
                    >
                        {isLoading ? (
                            <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <Save className="h-4 w-4 mr-2" />
                                {isNil ? 'Mark as NIL' : (existingData ? 'Update Record' : 'Confirm Reception')}
                            </div>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}