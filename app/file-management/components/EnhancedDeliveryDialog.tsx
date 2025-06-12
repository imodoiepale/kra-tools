// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { 
    Calendar as CalendarIcon, 
    CheckCircle, 
    Clock, 
    Edit3, 
    Loader2, 
    Mail, 
    MapPin, 
    Phone, 
    Save, 
    Truck, 
    User, 
    X, 
    XCircle, 
    AlertCircle, 
    Building2, 
    FileSignature 
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue, 
    SelectGroup, 
    SelectLabel 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "react-hot-toast";
import { supabase } from '@/lib/supabase';

interface Individual {
    id: string;
    full_name: string;
    employment_history: any[];
}

interface EnhancedDeliveryDialogProps {
    companyName: string;
    companyId: string;
    year: number;
    month: number;
    onConfirm: (data: any) => Promise<void>;
    existingData?: any;
    receptionData?: any;
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
    const [isNil, setIsNil] = useState(false);
    const [employees, setEmployees] = useState<Individual[]>([]);
    const [directors, setDirectors] = useState<Individual[]>([]);
    const [loadingPeople, setLoadingPeople] = useState(false);
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
        deliveryStatus: 'pending',
        requiresSignature: true,
        isUrgent: false
    });

    // Fetch employees and directors for the company
    const fetchCompanyPeople = async () => {
        if (!companyId) return;
        
        setLoadingPeople(true);
        try {
            const { data: individuals, error } = await supabase
                .from('registry_individuals')
                .select('id, full_name, employment_history');

            if (error) throw error;
            if (!individuals) return;

            const now = new Date();
            
            const processEmployment = (person: Individual, isCompany10: boolean = false) => {
                if (!person.employment_history || !Array.isArray(person.employment_history)) return false;
                
                return person.employment_history.some((emp: any) => {
                    if (!emp || !emp.role) return false;
                    
                    const isTargetCompany = isCompany10 
                        ? emp.company_id === '10' 
                        : emp.company_id === companyId;
                    
                    if (!isTargetCompany) return false;
                    
                    const endDate = emp.end_date ? new Date(emp.end_date) : null;
                    return !endDate || endDate >= now;
                });
            };

            // Get employees (non-directors) from both companies
            const employeeList = individuals.filter(person => 
                processEmployment(person) || processEmployment(person, true)
            ).filter(person => {
                return person.employment_history?.some((emp: any) => 
                    emp.role && emp.role.toLowerCase() !== 'director'
                );
            });

            // Get directors from both companies
            const directorList = individuals.filter(person => 
                processEmployment(person) || processEmployment(person, true)
            ).filter(person => {
                return person.employment_history?.some((emp: any) => 
                    emp.role && emp.role.toLowerCase() === 'director'
                );
            });

            // Remove duplicates
            const uniqueEmployees = Array.from(new Map(
                employeeList.map((person: any) => [person.id, person])
            ).values());

            const uniqueDirectors = Array.from(new Map(
                directorList.map((person: any) => [person.id, person])
            ).values());

            setEmployees(uniqueEmployees);
            setDirectors(uniqueDirectors);
        } catch (error) {
            console.error('Error fetching company people:', error);
            toast.error('Failed to load company employees and directors');
        } finally {
            setLoadingPeople(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchCompanyPeople();
        }
    }, [isOpen, companyId]);

    const handleNilToggle = (checked: boolean) => {
        setIsNil(checked);
        if (checked) {
            setFormData(prev => ({
                ...prev,
                pickedBy: 'N/A',
                contactPerson: 'N/A',
                deliveryMethod: 'nil',
                deliveryStatus: 'cancelled',
                requiresSignature: false,
                isUrgent: false,
                deliveryNotes: 'No delivery was made for this period.'
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                pickedBy: '',
                contactPerson: '',
                deliveryMethod: 'physical',
                deliveryStatus: 'pending',
                requiresSignature: true,
                deliveryNotes: ''
            }));
        }
    };

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
        if (isNil) return true;

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
            let submissionData: any = {
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
                is_nil: isNil,
                status: isNil ? 'nil' : (formData.deliveryStatus === 'delivered' ? 'delivered' : 'processed'),
                updated_at: new Date().toISOString(),
                updated_by: 'current_user' // Replace with actual user
            };

            // Only include delivery date if not NIL
            if (!isNil) {
                const dateTime = new Date(formData.date);
                const [hours, minutes] = formData.time.split(':');
                dateTime.setHours(parseInt(hours), parseInt(minutes));
                submissionData.delivered_at = dateTime.toISOString();
            }

            await onConfirm(submissionData);
            setIsOpen(false);
            
            toast.success(
                isNil 
                    ? 'NIL delivery record saved successfully'
                    : existingData 
                        ? 'Delivery record updated successfully'
                        : 'Document delivery confirmed successfully',
                {
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
        if (existingData?.is_nil) return <X className="h-5 w-5 text-gray-500" />;
        if (existingData?.delivery_status === 'delivered') return <CheckCircle className="h-5 w-5 text-green-500" />;
        if (existingData?.delivery_status === 'pending') return <Clock className="h-5 w-5 text-yellow-500" />;
        return <XCircle className="h-5 w-5 text-red-500" />;
    };

    const getStatusBadge = () => {
        if (existingData?.is_nil) return <Badge variant="outline" className="border-gray-300">NIL</Badge>;
        if (existingData?.delivery_status === 'delivered') return <Badge className="bg-green-500">Delivered</Badge>;
        if (existingData?.delivery_status === 'pending') return <Badge className="bg-yellow-500">Pending</Badge>;
        if (existingData?.delivery_status === 'cancelled') return <Badge variant="destructive">Cancelled</Badge>;
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
                                    <Select
                                        value={formData.pickedBy}
                                        onValueChange={(value) => setFormData(prev => ({ ...prev, pickedBy: value }))}
                                        disabled={isNil}
                                    >
                                        <SelectTrigger className="border-blue-200">
                                            <SelectValue placeholder="Select who picked up" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {loadingPeople ? (
                                                <div className="py-2 text-center text-sm text-muted-foreground">
                                                    Loading...
                                                </div>
                                            ) : (
                                                <>
                                                    <SelectGroup>
                                                        <SelectLabel>Directors</SelectLabel>
                                                        {directors.map((director) => (
                                                            <SelectItem key={director.id} value={director.full_name}>
                                                                {director.full_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                    <SelectGroup>
                                                        <SelectLabel>Employees</SelectLabel>
                                                        {employees.map((employee) => (
                                                            <SelectItem key={employee.id} value={employee.full_name}>
                                                                {employee.full_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="contactPerson" className="text-blue-700">Contact Person *</Label>
                                    <Input
                                        id="contactPerson"
                                        value={formData.contactPerson}
                                        onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                                        placeholder="Primary contact name"
                                        className="border-blue-200 focus:border-blue-400"
                                        disabled={isNil}
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
                                            disabled={isNil}
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
                                            disabled={isNil}
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
                                                className={cn("w-full justify-start text-left font-normal", !formData.date && "text-muted-foreground")}
                                                disabled={isNil}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
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
                                            disabled={isNil}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="deliveryMethod" className="text-blue-700">Delivery Method</Label>
                                <Select
                                    value={formData.deliveryMethod}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, deliveryMethod: value }))}
                                    disabled={isNil}
                                >
                                    <SelectTrigger className="border-blue-200">
                                        <SelectValue placeholder="Select delivery method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="physical">Physical Pickup</SelectItem>
                                        <SelectItem value="courier">Courier Service</SelectItem>
                                        <SelectItem value="digital">Digital Delivery</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.deliveryMethod === 'courier' && (
                                <div>
                                    <Label htmlFor="deliveryLocation" className="text-blue-700">Delivery Location *</Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600" />
                                        <Input
                                            id="deliveryLocation"
                                            value={formData.deliveryLocation}
                                            onChange={(e) => setFormData(prev => ({ ...prev, deliveryLocation: e.target.value }))}
                                            placeholder="Full address for delivery"
                                            className="pl-10 border-blue-200 focus:border-blue-400"
                                            disabled={isNil}
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <Label htmlFor="deliveryStatus" className="text-blue-700">Delivery Status</Label>
                                <Select
                                    value={formData.deliveryStatus}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, deliveryStatus: value }))}
                                    disabled={isNil}
                                >
                                    <SelectTrigger className="border-blue-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-yellow-500" />
                                                <span>Pending</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="in_transit">
                                            <div className="flex items-center gap-2">
                                                <Truck className="h-4 w-4 text-blue-500" />
                                                <span>In Transit</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="delivered">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                <span>Delivered</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="cancelled">
                                            <div className="flex items-center gap-2">
                                                <XCircle className="h-4 w-4 text-red-500" />
                                                <span>Cancelled</span>
                                            </div>
                                        </SelectItem>
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
                                    className="border-blue-200 focus:border-blue-400 min-h-[100px]"
                                    disabled={isNil}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="requires-signature"
                                            checked={formData.requiresSignature}
                                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requiresSignature: checked }))}
                                            disabled={isNil}
                                        />
                                        <Label htmlFor="requires-signature" className="flex items-center gap-1">
                                            <FileSignature className="h-4 w-4 text-blue-500" />
                                            <span>Requires Signature</span>
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="is-urgent"
                                            checked={formData.isUrgent}
                                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isUrgent: checked }))}
                                            disabled={isNil}
                                        />
                                        <Label htmlFor="is-urgent" className="flex items-center gap-1">
                                            <AlertCircle className="h-4 w-4 text-amber-500" />
                                            <span>Urgent</span>
                                        </Label>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter className="gap-3 border-t pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                        className="border-gray-300 hover:bg-gray-50"
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || (isNil && !existingData?.is_nil && existingData)}
                        className="bg-blue-600 hover:bg-blue-700 min-w-[120px] gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                {existingData?.is_nil ? 'Update NIL Record' : 
                                 isNil ? 'Save NIL Record' : 
                                 existingData ? 'Update Delivery' : 'Confirm Delivery'}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}