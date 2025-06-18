// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar as CalendarIcon, CheckCircle, Clock, Edit3, Loader2, Mail, MapPin, Phone, Save, Truck, User, X, XCircle, AlertCircle, Building2, FileSignature, History,Eye, EyeOff, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { supabase } from '@/lib/supabase';
import { FileRecord, DeliveryRecord, ReceptionRecord, Individual } from '../types/fileManagement';

interface EnhancedDeliveryDialogProps {
    companyName: string;
    companyId: string;
    year: number;
    month: number;
    onConfirm: (data: any) => Promise<void>;
    existingData?: FileRecord;
    receptionData?: FileRecord;
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
    const [employees, setEmployees] = useState<Individual[]>([]);
    const [directors, setDirectors] = useState<Individual[]>([]);
    const [loadingPeople, setLoadingPeople] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [editingDelivery, setEditingDelivery] = useState<string | null>(null);
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
        isUrgent: false,
        receptionId: 'general'
    });

    // Helper functions for delivery management
    const getAllDeliveries = (): DeliveryRecord[] => {
        return existingData?.delivery_data?.map((d: any) => ({
            ...d,
            delivered_at: new Date(d.delivered_at),
            id: d.id || crypto.randomUUID()
        })) || [];
    };

    const getLatestDelivery = (): DeliveryRecord | null => {
        const deliveries = getAllDeliveries();
        if (deliveries.length === 0) return null;
        
        // Sort by delivered_at in descending order and return the first one
        return [...deliveries].sort((a, b) => 
            new Date(b.delivered_at).getTime() - new Date(a.delivered_at).getTime()
        )[0];
    };

    const getAllReceptions = (): ReceptionRecord[] => {
        return existingData?.reception_data?.map((r: any) => ({
            ...r,
            received_at: new Date(r.received_at),
            id: r.id || crypto.randomUUID()
        })) || [];
    };

    const getLatestReception = (): ReceptionRecord | null => {
        const receptions = getAllReceptions();
        if (receptions.length === 0) return null;
        
        // Sort by received_at in descending order and return the first one
        return [...receptions].sort((a, b) => 
            new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
        )[0];
    };

    const hasAnyDeliveries = (): boolean => {
        return getAllDeliveries().length > 0;
    };

    const hasAnyReceptions = (): boolean => {
        return getAllReceptions().length > 0;
    };

    const canDeliver = (): boolean => {
        return hasAnyReceptions() && !existingData?.processing_status?.includes('nil');
    };

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

            const employeeList = individuals.filter(person => 
                processEmployment(person) || processEmployment(person, true)
            ).filter(person => {
                return person.employment_history?.some((emp: any) => 
                    emp.role && emp.role.toLowerCase() !== 'director'
                );
            });

            const directorList = individuals.filter(person => 
                processEmployment(person) || processEmployment(person, true)
            ).filter(person => {
                return person.employment_history?.some((emp: any) => 
                    emp.role && emp.role.toLowerCase() === 'director'
                );
            });

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
 
    useEffect(() => {
        if (existingData) {
            // If editing a specific delivery, load its data
            if (editingDelivery) {
                const delivery = getAllDeliveries().find(d => d.id === editingDelivery);
                if (delivery) {
                    const deliveredAt = new Date(delivery.delivered_at);
                    setFormData({
                        date: deliveredAt,
                        time: format(deliveredAt, 'HH:mm'),
                        pickedBy: delivery.picked_by || '',
                        contactPerson: delivery.delivered_to || '',
                        contactPhone: '',
                        contactEmail: '',
                        deliveryMethod: 'physical',
                        deliveryLocation: delivery.delivery_location || '',
                        deliveryNotes: delivery.delivery_notes || '',
                        deliveryStatus: 'delivered',
                        requiresSignature: true,
                        isUrgent: false,
                        receptionId: delivery.reception_id || 'general'
                    });
                }
            } else {
                // Load latest delivery data or defaults
                const latestDelivery = getLatestDelivery();
                if (latestDelivery) {
                    const deliveredAt = new Date(latestDelivery.delivered_at);
                    setFormData({
                        date: deliveredAt,
                        time: format(deliveredAt, 'HH:mm'),
                        pickedBy: latestDelivery.picked_by || '',
                        contactPerson: latestDelivery.delivered_to || '',
                        contactPhone: '',
                        contactEmail: '',
                        deliveryMethod: 'physical',
                        deliveryLocation: latestDelivery.delivery_location || '',
                        deliveryNotes: latestDelivery.delivery_notes || '',
                        deliveryStatus: 'delivered',
                        requiresSignature: true,
                        isUrgent: false,
                        receptionId: latestDelivery.reception_id || 'general'
                    });
                }
            }
        }
    }, [existingData, editingDelivery]);
 
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
 
            const deliveryRecord: DeliveryRecord = {
                id: editingDelivery || crypto.randomUUID(),
                reception_id: formData.receptionId,
                delivered_at: dateTime.toISOString(),
                delivered_to: formData.contactPerson,
                picked_by: formData.pickedBy,
                delivery_location: formData.deliveryLocation,
                delivery_notes: formData.deliveryNotes,
                created_at: new Date().toISOString(),
                created_by: 'current_user'
            };
 
            const submissionData = {
                company_id: companyId,
                company_name: companyName,
                year,
                month,
                delivery_record: deliveryRecord,
                is_editing: !!editingDelivery,
                status: 'delivered',
                updated_at: new Date().toISOString(),
                updated_by: 'current_user'
            };
 
            await upsertFileRecord(submissionData);
            
            if (onConfirm) {
                await onConfirm(submissionData);
            }
            
            setIsOpen(false);
            setEditingDelivery(null);
            
            toast.success(
                editingDelivery
                    ? 'Delivery record updated successfully'
                    : hasAnyDeliveries()
                        ? 'New delivery added successfully'
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
 
    const upsertFileRecord = async (submissionData: any) => {
        const { data: existingRecord } = await supabase
            .from('file_transactions')
            .select('*')
            .eq('company_id', submissionData.company_id)
            .eq('year', submissionData.year)
            .eq('month', submissionData.month)
            .single();

        if (!existingRecord) {
            throw new Error('No reception record found. Documents must be received before delivery.');
        }

        let updatedDeliveryData = [...(existingRecord.delivery_data || [])];
        
        if (submissionData.is_editing) {
            // Update existing delivery
            const index = updatedDeliveryData.findIndex(d => d.id === submissionData.delivery_record.id);
            if (index !== -1) {
                updatedDeliveryData[index] = submissionData.delivery_record;
            }
        } else {
            // Add new delivery
            updatedDeliveryData.push(submissionData.delivery_record);
        }

        const updateData = {
            delivery_data: updatedDeliveryData,
            processing_status: submissionData.status,
            updated_at: submissionData.updated_at,
            updated_by: submissionData.updated_by
        };

        const { error } = await supabase
            .from('file_transactions')
            .update(updateData)
            .eq('id', existingRecord.id);

        if (error) throw error;

    };
 
    const handleDeleteDelivery = async (deliveryId: string) => {
        if (!existingData) return;
 
        try {
            const updatedDeliveries = getAllDeliveries().filter(d => d.id !== deliveryId);
            
            await supabase
                .from('file_records')
                .update({
                    deliveries: updatedDeliveries,
                    status: updatedDeliveries.length === 0 ? 'received' : 'delivered',
                    updated_at: new Date().toISOString(),
                    updated_by: 'current_user'
                })
                .eq('id', existingData.id);
 
            if (onConfirm) {
                await onConfirm({ action: 'delete_delivery', deliveryId });
            }
 
            toast.success('Delivery record deleted successfully');
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Failed to delete delivery record');
        }
    };
 
    const getStatusIcon = () => {
        if (!canDeliver()) return <XCircle className="h-5 w-5 text-gray-500" />;
        if (hasAnyDeliveries()) return <CheckCircle className="h-5 w-5 text-green-500" />;
        return <Clock className="h-5 w-5 text-yellow-500" />;
    };
 
    const resetForm = () => {
        setFormData({
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
            isUrgent: false,
            receptionId: 'general'
        });
        setEditingDelivery(null);
    };
 
    if (!canDeliver()) {
        return (
            <Button
                variant="ghost"
                size="sm"
                disabled
                className="flex items-center space-x-2 text-gray-400 cursor-not-allowed"
                title="Documents must be received before delivery"
            >
                <XCircle className="h-5 w-5" />
                <span className="text-xs">Cannot Deliver</span>
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
 
            <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-auto p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-3 text-blue-800">
                        <div className="p-2 bg-blue-100 rounded-full">
                            <Truck className="h-5 w-5 text-blue-600" />
                        </div>
                        <span>
                            {editingDelivery ? 'Edit Delivery Record' : 
                             hasAnyDeliveries() ? 'Add New Delivery' : 'Document Delivery'}
                        </span>
                    </DialogTitle>
                    <div className="text-sm text-gray-600">
                        {companyName} - {format(new Date(year, month - 1), 'MMMM yyyy')}
                    </div>
                </DialogHeader>
 
                {/* Company and Reception Info */}
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
                            {existingData?.is_urgent && (
                                <Badge variant="destructive" className="animate-pulse">
                                    URGENT
                                </Badge>
                            )}
                        </div>
 
                        {hasAnyReceptions() && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                                <p className="text-xs text-blue-600 font-medium">Reception Summary:</p>
                                <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                                    <span>Total Receptions: {getAllReceptions().length}</span>
                                    <span>Total Files: {getAllReceptions().reduce((sum, r) => sum + r.files_count, 0)}</span>
                                    <span>Latest: {getLatestReception() ? format(new Date(getLatestReception()!.received_at), 'dd/MM/yyyy') : 'N/A'}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
 
                {/* Delivery History Section */}
                {hasAnyDeliveries() && (
                    <Card className="mb-4">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <History className="h-5 w-5" />
                                    Delivery History ({getAllDeliveries().length} records)
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowHistory(!showHistory)}
                                    >
                                        {showHistory ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        {showHistory ? 'Hide' : 'Show'} Details
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        
                        <Collapsible open={showHistory} onOpenChange={setShowHistory}>
                            <CollapsibleContent>
                                <CardContent className="pt-0">
                                    <ScrollArea className="h-64">
                                        <div className="space-y-3">
                                            {getAllDeliveries().map((delivery, index) => (
                                                <div
                                                    key={delivery.id}
                                                    className={cn(
                                                        "p-3 border rounded-lg",
                                                        index === getAllDeliveries().length - 1 
                                                            ? "border-green-200 bg-green-50" 
                                                            : "border-gray-200 bg-gray-50"
                                                    )}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant={index === getAllDeliveries().length - 1 ? "default" : "outline"}>
                                                                    Delivery #{getAllDeliveries().length - index}
                                                                </Badge>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                                <div>
                                                                    <strong>Delivered:</strong> {format(new Date(delivery.delivered_at), 'PPp')}
                                                                </div>
                                                                <div>
                                                                    <strong>Picked by:</strong> {delivery.picked_by}
                                                                </div>
                                                                <div>
                                                                    <strong>Delivered to:</strong> {delivery.delivered_to}
                                                                </div>
                                                                <div>
                                                                    <strong>Location:</strong> {delivery.delivery_location || 'Office'}
                                                                </div>
                                                                {delivery.delivery_notes && (
                                                                    <div className="col-span-2">
                                                                        <strong>Notes:</strong> {delivery.delivery_notes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setEditingDelivery(delivery.id);
                                                                    resetForm();
                                                                }}
                                                            >
                                                                <Edit3 className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleDeleteDelivery(delivery.id)}
                                                                className="text-red-600 hover:text-red-700"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </CollapsibleContent>
                        </Collapsible>
                    </Card>
                )}
 
                {/* New/Edit Delivery Form */}
                <div className="space-y-6">
                    {editingDelivery && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-blue-800 font-medium">
                                    Editing Delivery Record
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setEditingDelivery(null);
                                        resetForm();
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                    Cancel Edit
                                </Button>
                            </div>
                        </div>
                    )}
 
                    {/* Delivery Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-blue-800 flex items-center">
                                <User className="h-4 w-4 mr-2" />
                                Delivery Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Reception Selection */}
                            {getAllReceptions().length > 1 && (
                                <div>
                                    <Label htmlFor="receptionId" className="text-blue-700">Link to Reception</Label>
                                    <Select
                                        value={formData.receptionId}
                                        onValueChange={(value) => setFormData(prev => ({ ...prev, receptionId: value }))}
                                    >
                                        <SelectTrigger className="border-blue-200">
                                            <SelectValue placeholder="Select reception to link" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="general">General Delivery</SelectItem>
                                            {getAllReceptions().map((reception, index) => (
                                                <SelectItem key={reception.id} value={reception.id}>
                                                    Reception #{getAllReceptions().length - index} - {format(new Date(reception.received_at), 'dd/MM/yyyy')} ({reception.files_count} files)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
 
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="pickedBy" className="text-blue-700">Picked Up By *</Label>
                                    <Select
                                        value={formData.pickedBy}
                                        onValueChange={(value) => setFormData(prev => ({ ...prev, pickedBy: value }))}
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
                                                    <Separator className="my-1" />
                                                    <SelectItem value="other">Other Person...</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {formData.pickedBy === 'other' && (
                                        <Input
                                            className="mt-2"
                                            placeholder="Enter person's name"
                                            onChange={(e) => setFormData(prev => ({ ...prev, pickedBy: e.target.value }))}
                                        />
                                    )}
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
                                                className={cn("w-full justify-start text-left font-normal", !formData.date && "text-muted-foreground")}
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
                                        />
                                    </div>
                                </div>
                            </div>
 
                            <div>
                                <Label className="text-blue-700">Delivery Method</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                    {deliveryMethodOptions.map((method) => (
                                        <Button
                                            key={method.value}
                                            variant={formData.deliveryMethod === method.value ? "default" : "outline"}
                                            className={cn(
                                                "h-auto py-3 flex-col space-y-1",
                                                formData.deliveryMethod === method.value ? "" : method.color
                                            )}
                                            onClick={() => setFormData(prev => ({ ...prev, deliveryMethod: method.value }))}
                                        >
                                            <span className="text-lg">{method.icon}</span>
                                            <span className="text-xs font-medium">{method.label}</span>
                                        </Button>
                                    ))}
                                </div>
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
                                        />
                                    </div>
                                </div>
                            )}
 
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
                                                <div className="flex items-center gap-2">
                                                    <span>{status.icon}</span>
                                                    <span>{status.label}</span>
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
                                    className="border-blue-200 focus:border-blue-400 min-h-[100px]"
                                />
                            </div>
 
                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="requires-signature"
                                            checked={formData.requiresSignature}
                                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requiresSignature: checked }))}
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

               <DialogFooter className="pt-4 border-t">
                   <div className="flex justify-between w-full">
                       <div className="flex gap-2">
                           {editingDelivery && (
                               <Button
                                   type="button"
                                   variant="outline"
                                   onClick={() => {
                                       setEditingDelivery(null);
                                       resetForm();
                                   }}
                               >
                                   Cancel Edit
                               </Button>
                           )}
                           {hasAnyDeliveries() && !editingDelivery && (
                               <Button
                                   type="button"
                                   variant="outline"
                                   onClick={() => resetForm()}
                                   className="border-green-200 text-green-700 hover:bg-green-50"
                               >
                                   <Plus className="h-4 w-4 mr-2" />
                                   Add Another Delivery
                               </Button>
                           )}
                       </div>
                       <div className="flex gap-3">
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
                               disabled={isLoading}
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
                                       {editingDelivery ? 'Update Delivery' :
                                        hasAnyDeliveries() ? 'Add Delivery' : 'Confirm Delivery'}
                                   </>
                               )}
                           </Button>
                       </div>
                   </div>
               </DialogFooter>
           </DialogContent>
       </Dialog>
   );
}