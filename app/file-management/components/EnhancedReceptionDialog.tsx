// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
    Ban, CalendarIcon, Check, CheckCircle, ChevronDown, ChevronRight, Clock, 
    Edit3, FileText, History, Package, Plus, Trash2, X, XCircle, Eye, EyeOff 
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { supabase } from '@/lib/supabase';
import { cn } from "@/lib/utils";
import { Individual, FileRecord, ReceptionRecord } from '../types/fileManagement';

interface EnhancedReceptionDialogProps {
    companyName: string;
    companyId: string;
    year: number;
    month: number;
    onConfirm: (data: any) => Promise<void>;
    existingData?: FileRecord;
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
    const [employees, setEmployees] = useState<Individual[]>([]);
    const [directors, setDirectors] = useState<Individual[]>([]);
    const [loadingPeople, setLoadingPeople] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [editingReception, setEditingReception] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        date: new Date(),
        time: format(new Date(), 'HH:mm'),
        broughtBy: '',
        deliveryMethod: 'physical',
        documentTypes: [] as string[],
        filesCount: 1,
        receptionNotes: '',
        receivedBy: 'Front Desk',
        processingStatus: 'pending',
        isUrgent: false
    });

    // Helper functions for reception management
    const getAllReceptions = (): ReceptionRecord[] => {
        return existingData?.receptions || [];
    };

    const getLatestReception = (): ReceptionRecord | null => {
        const receptions = getAllReceptions();
        return receptions.length > 0 ? receptions[receptions.length - 1] : null;
    };

    const getTotalFilesReceived = (): number => {
        return getAllReceptions().reduce((total, reception) => total + reception.files_count, 0);
    };

    const hasAnyReceptions = (): boolean => {
        return getAllReceptions().length > 0;
    };

    // Fetch people associated with the company
    const fetchCompanyPeople = async () => {
        setLoadingPeople(true);
        
        try {
            const { data: allIndividuals, error: fetchError } = await supabase
                .from('registry_individuals')
                .select('id, full_name, employment_history');

            if (fetchError) {
                console.error('Error fetching individuals:', fetchError);
                return;
            }

            const individualsData = allIndividuals?.filter(individual => {
                if (!individual.employment_history) return false;
                
                return individual.employment_history.some((emp: any) => 
                    emp.company_id === companyId.toString() && 
                    emp.role?.toLowerCase() !== 'stakeholder'
                );
            }) || [];

            if (individualsData) {
                const now = new Date();
                const directorsList: Individual[] = [];
                const employeesList: Individual[] = [];

                individualsData.forEach(individual => {
                    if (!individual.employment_history) return;

                    const employment = individual.employment_history.find(
                        (emp: any) => emp.company_id === companyId.toString() && 
                                     emp.role?.toLowerCase() !== 'stakeholder'
                    );

                    if (!employment) return;

                    const endDate = employment.end_date ? new Date(employment.end_date) : null;
                    if (endDate && endDate < now) return;

                    const person = {
                        id: individual.id,
                        full_name: individual.full_name,
                        role: employment.role
                    };

                    if (employment.role?.toLowerCase().includes('director')) {
                        directorsList.push(person);
                    } else {
                        employeesList.push(person);
                    }
                });

                const sortByName = (a: Individual, b: Individual) => 
                    a.full_name.localeCompare(b.full_name);

                setDirectors([...directorsList].sort(sortByName));
                setEmployees([...employeesList].sort(sortByName));
            }
        } catch (error) {
            console.error('Error fetching company people:', error);
            toast.error('Failed to load company employees');
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
            setIsNil(existingData.is_nil || false);
            
            // If editing a specific reception, load its data
            if (editingReception) {
                const reception = getAllReceptions().find(r => r.id === editingReception);
                if (reception) {
                    const receivedAt = new Date(reception.received_at);
                    setFormData({
                        date: receivedAt,
                        time: format(receivedAt, 'HH:mm'),
                        broughtBy: reception.brought_by || '',
                        deliveryMethod: reception.delivery_method || 'physical',
                        documentTypes: reception.document_types || [],
                        filesCount: reception.files_count || 1,
                        receptionNotes: reception.reception_notes || '',
                        receivedBy: reception.received_by || 'Front Desk',
                        processingStatus: existingData.processing_status || 'pending',
                        isUrgent: reception.is_urgent || false
                    });
                }
            } else {
                // Load latest reception data or defaults
                const latestReception = getLatestReception();
                if (latestReception) {
                    const receivedAt = new Date(latestReception.received_at);
                    setFormData({
                        date: receivedAt,
                        time: format(receivedAt, 'HH:mm'),
                        broughtBy: latestReception.brought_by || '',
                        deliveryMethod: latestReception.delivery_method || 'physical',
                        documentTypes: latestReception.document_types || [],
                        filesCount: latestReception.files_count || 1,
                        receptionNotes: latestReception.reception_notes || '',
                        receivedBy: latestReception.received_by || 'Front Desk',
                        processingStatus: existingData.processing_status || 'pending',
                        isUrgent: latestReception.is_urgent || false
                    });
                }
            }
        }
    }, [existingData, editingReception]);

    const documentTypeOptions = [
        { value: 'financial_statements', label: 'Financial Statements' },
        { value: 'tax_returns', label: 'Tax Returns' },
        { value: 'audit_documents', label: 'Audit Documents' },
        { value: 'payroll_records', label: 'Payroll Records' },
        { value: 'bank_statements', label: 'Bank Statements' },
        { value: 'invoices', label: 'Invoices & Bills' },
        { value: 'contracts', label: 'Contracts' },
        { value: 'legal_documents', label: 'Legal Documents' },
        { value: 'compliance_reports', label: 'Compliance Reports' },
        { value: 'other', label: 'Other Documents' }
    ];

    const deliveryMethodOptions = [
        { value: 'physical', label: 'Physical Delivery' },
        { value: 'email', label: 'Email Attachment' },
        { value: 'portal', label: 'Client Portal' }
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

            const receptionRecord: ReceptionRecord = {
                id: editingReception || crypto.randomUUID(),
                received_at: isNil ? null : dateTime.toISOString(),
                received_by: formData.receivedBy,
                brought_by: formData.broughtBy,
                delivery_method: formData.deliveryMethod,
                document_types: formData.documentTypes,
                files_count: formData.filesCount,
                reception_notes: formData.receptionNotes,
                is_urgent: formData.isUrgent,
                created_at: new Date().toISOString(),
                created_by: 'current_user' // Replace with actual user
            };

            const submissionData = {
                company_id: companyId,
                company_name: companyName,
                year,
                month,
                reception_record: receptionRecord,
                is_editing: !!editingReception,
                status: isNil ? 'nil' : 'received',
                is_nil: isNil,
                is_urgent: formData.isUrgent,
                processing_status: formData.processingStatus,
                updated_at: new Date().toISOString(),
                updated_by: 'current_user'
            };

            await upsertFileRecord(submissionData);
            
            if (onConfirm) {
                await onConfirm(submissionData);
            }
            
            setIsOpen(false);
            setEditingReception(null);
            toast.success(
                editingReception
                    ? 'Reception record updated successfully'
                    : existingData
                        ? 'New reception added successfully'
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

    const upsertFileRecord = async (submissionData: any) => {
        const { data: existingRecord } = await supabase
            .from('file_records')
            .select('*')
            .eq('company_id', submissionData.company_id)
            .eq('year', submissionData.year)
            .eq('month', submissionData.month)
            .single();

        if (existingRecord) {
            let updatedReceptions = [...(existingRecord.receptions || [])];
            
            if (submissionData.is_editing) {
                // Update existing reception
                const index = updatedReceptions.findIndex(r => r.id === submissionData.reception_record.id);
                if (index !== -1) {
                    updatedReceptions[index] = submissionData.reception_record;
                }
            } else {
                // Add new reception
                updatedReceptions.push(submissionData.reception_record);
            }

            await supabase
                .from('file_records')
                .update({
                    receptions: updatedReceptions,
                    status: submissionData.status,
                    is_nil: submissionData.is_nil,
                    is_urgent: submissionData.is_urgent,
                    processing_status: submissionData.processing_status,
                    updated_at: submissionData.updated_at,
                    updated_by: submissionData.updated_by
                })
                .eq('id', existingRecord.id);
        } else {
            // Create new record
            await supabase
                .from('file_records')
                .insert({
                    company_id: submissionData.company_id,
                    company_name: submissionData.company_name,
                    year: submissionData.year,
                    month: submissionData.month,
                    receptions: [submissionData.reception_record],
                    deliveries: [],
                    status: submissionData.status,
                    is_nil: submissionData.is_nil,
                    is_urgent: submissionData.is_urgent,
                    processing_status: submissionData.processing_status,
                    created_by: submissionData.updated_by,
                    updated_by: submissionData.updated_by
                });
        }
    };

    const handleDeleteReception = async (receptionId: string) => {
        if (!existingData) return;

        try {
            const updatedReceptions = getAllReceptions().filter(r => r.id !== receptionId);
            
            await supabase
                .from('file_records')
                .update({
                    receptions: updatedReceptions,
                    status: updatedReceptions.length === 0 ? 'pending' : 'received',
                    updated_at: new Date().toISOString(),
                    updated_by: 'current_user'
                })
                .eq('id', existingData.id);

            if (onConfirm) {
                await onConfirm({ action: 'delete_reception', receptionId });
            }

            toast.success('Reception record deleted successfully');
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Failed to delete reception record');
        }
    };

    const getStatusIcon = () => {
        if (existingData?.is_nil) return <Ban className="h-5 w-5 text-red-500" />;
        if (hasAnyReceptions()) return <CheckCircle className="h-5 w-5 text-green-500" />;
        return <XCircle className="h-5 w-5 text-red-500" />;
    };

    const resetForm = () => {
        setFormData({
            date: new Date(),
            time: format(new Date(), 'HH:mm'),
            broughtBy: '',
            deliveryMethod: 'physical',
            documentTypes: [],
            filesCount: 1,
            receptionNotes: '',
            receivedBy: 'Front Desk',
            processingStatus: 'pending',
            isUrgent: false
        });
        setEditingReception(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={className}
                >
                    {getStatusIcon()}
                    {existingData && <Edit3 className="h-3 w-3 ml-1 text-blue-600" />}
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-auto p-6">
                <DialogHeader>
                    <DialogTitle>
                        {editingReception ? 'Edit Reception Record' : 
                         hasAnyReceptions() ? 'Add New Reception' : 'Document Reception'}
                    </DialogTitle>
                    <div className="text-sm text-gray-600">
                        {companyName} - {format(new Date(year, month - 1), 'MMMM yyyy')}
                    </div>
                </DialogHeader>

                {/* Reception History Section */}
                {hasAnyReceptions() && (
                    <Card className="mb-4">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <History className="h-5 w-5" />
                                    Reception History ({getAllReceptions().length} records)
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
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                        Total Files: {getTotalFilesReceived()}
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        
                        <Collapsible open={showHistory} onOpenChange={setShowHistory}>
                            <CollapsibleContent>
                                <CardContent className="pt-0">
                                    <ScrollArea className="h-64">
                                        <div className="space-y-3">
                                            {getAllReceptions().map((reception, index) => {
                                                const uniqueKey = `${reception.id}_${index}_reception`;
                                                return (
                                                    <div
                                                        key={uniqueKey}
                                                        className={cn(
                                                            "p-3 border rounded-lg",
                                                            index === getAllReceptions().length - 1 
                                                                ? "border-green-200 bg-green-50" 
                                                                : "border-gray-200 bg-gray-50"
                                                        )}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant={index === getAllReceptions().length - 1 ? "default" : "outline"}>
                                                                        Reception #{getAllReceptions().length - index}
                                                                    </Badge>
                                                                    {reception.is_urgent && (
                                                                        <Badge variant="destructive" className="animate-pulse">
                                                                            URGENT
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                                    <div>
                                                                        <strong>Received:</strong> {format(new Date(reception.received_at), 'PPp')}
                                                                    </div>
                                                                    <div>
                                                                        <strong>Brought by:</strong> {reception.brought_by}
                                                                    </div>
                                                                    <div>
                                                                        <strong>Received by:</strong> {reception.received_by}
                                                                    </div>
                                                                    <div>
                                                                        <strong>Files:</strong> {reception.files_count}
                                                                    </div>
                                                                    <div className="col-span-2">
                                                                        <strong>Document Types:</strong> {reception.document_types?.join(', ') || 'N/A'}
                                                                    </div>
                                                                    {reception.reception_notes && (
                                                                        <div className="col-span-2">
                                                                            <strong>Notes:</strong> {reception.reception_notes}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setEditingReception(reception.id);
                                                                        resetForm();
                                                                    }}
                                                                >
                                                                    <Edit3 className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteReception(reception.id)}
                                                                    className="text-red-600 hover:text-red-700"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </CollapsibleContent>
                        </Collapsible>
                    </Card>
                )}

                {/* New/Edit Reception Form */}
                <div className="space-y-6">
                    {editingReception && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-blue-800 font-medium">
                                    Editing Reception Record
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setEditingReception(null);
                                        resetForm();
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                   Cancel Edit
                               </Button>
                           </div>
                       </div>
                   )}

                   {/* NIL Toggle */}
                   <div className="flex items-center justify-between p-4 border rounded-md">
                       <div>
                           <div className="font-medium">NIL Record</div>
                           <div className="text-sm text-gray-500">Mark if no documents were received</div>
                       </div>
                       <Switch
                           checked={isNil}
                           onCheckedChange={handleNilToggle}
                       />
                   </div>

                   {isNil ? (
                       <div className="p-4 border border-red-200 bg-red-50 rounded-md">
                           <div className="font-medium text-red-700">NIL Record Active</div>
                           <p className="text-sm text-red-700">This record will be marked as having no documents received</p>
                       </div>
                   ) : (
                       <div className="space-y-6">
                           <div className="border rounded-md p-4 space-y-4">
                               <h3 className="text-lg font-medium">Reception Details</h3>
                               <div className="space-y-4">
                                   <div className="grid grid-cols-2 gap-4">
                                       <div>
                                           <Label htmlFor="broughtBy">Who Brought Documents *</Label>
                                           <div>
                                               <Select
                                                   value={formData.broughtBy.startsWith('other:') ? 'other' : formData.broughtBy}
                                                   onValueChange={(value) => {
                                                       if (value === 'other') {
                                                           setFormData(prev => ({
                                                               ...prev,
                                                               broughtBy: 'other:'
                                                           }));
                                                       } else {
                                                           setFormData(prev => ({
                                                               ...prev,
                                                               broughtBy: value
                                                           }));
                                                       }
                                                   }}
                                                   disabled={loadingPeople}
                                               >
                                                   <SelectTrigger>
                                                       {loadingPeople ? (
                                                           <span>Loading people...</span>
                                                       ) : (
                                                           <SelectValue placeholder="Select person" />
                                                       )}
                                                   </SelectTrigger>
                                                   <SelectContent>
                                                       <SelectItem value="other">Other Person...</SelectItem>
                                                       
                                                       {directors.length > 0 && (
                                                           <>
                                                               <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                                                   Directors ({directors.length})
                                                               </div>
                                                               {directors.map((director) => (
                                                                   <SelectItem 
                                                                       key={director.id} 
                                                                       value={director.full_name}
                                                                       className="flex items-center gap-2"
                                                                   >
                                                                       <span>{director.full_name}</span>
                                                                       {director.role && (
                                                                           <Badge variant="outline" className="text-xs font-normal ml-2">
                                                                               {director.role}
                                                                           </Badge>
                                                                       )}
                                                                   </SelectItem>
                                                               ))}
                                                               <Separator className="my-1" />
                                                           </>
                                                       )}
                                                       
                                                       {employees.length > 0 && (
                                                           <>
                                                               <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                                                   Employees ({employees.length})
                                                               </div>
                                                               {employees.map((employee) => (
                                                                   <SelectItem 
                                                                       key={employee.id} 
                                                                       value={employee.full_name}
                                                                       className="flex items-center gap-2"
                                                                   >
                                                                       <span>{employee.full_name}</span>
                                                                       {employee.role && (
                                                                           <Badge variant="outline" className="text-xs font-normal ml-2">
                                                                               {employee.role}
                                                                           </Badge>
                                                                       )}
                                                                   </SelectItem>
                                                               ))}
                                                           </>
                                                       )}
                                                   </SelectContent>
                                               </Select>
                                               
                                               {(formData.broughtBy.startsWith('other:') || (!formData.broughtBy && !employees.length && !directors.length)) && (
                                                   <div className="mt-2">
                                                       <Input
                                                           value={formData.broughtBy.startsWith('other:') ? formData.broughtBy.substring(6) : formData.broughtBy}
                                                           onChange={(e) => setFormData(prev => ({
                                                               ...prev,
                                                               broughtBy: 'other:' + e.target.value
                                                           }))}
                                                           placeholder="Enter person's name"
                                                           className="w-full"
                                                       />
                                                   </div>
                                               )}
                                           </div>
                                       </div>

                                       <div className="space-y-2">
                                           <Label htmlFor="receivedBy">Received By</Label>
                                           <Select
                                               value={formData.receivedBy.startsWith('other:') ? 'other' : formData.receivedBy}
                                               onValueChange={(value) => {
                                                   if (value === 'other') {
                                                       setFormData(prev => ({
                                                           ...prev,
                                                           receivedBy: 'other:'
                                                       }));
                                                   } else {
                                                       setFormData(prev => ({
                                                           ...prev,
                                                           receivedBy: value
                                                       }));
                                                   }
                                               }}
                                               disabled={loadingPeople}
                                           >
                                               <SelectTrigger>
                                                   {loadingPeople ? (
                                                       <span>Loading staff...</span>
                                                   ) : (
                                                       <SelectValue placeholder="Select receiver" />
                                                   )}
                                               </SelectTrigger>
                                               <SelectContent>
                                                   <SelectItem value="Front Desk">Front Desk</SelectItem>
                                                   <SelectItem value="other">Other...</SelectItem>
                                                   
                                                   {employees.length > 0 && (
                                                       <>
                                                           <Separator className="my-1" />
                                                           <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                                               Staff ({employees.length})
                                                           </div>
                                                           {employees.map((employee) => (
                                                               <SelectItem 
                                                                   key={`recv-${employee.id}`} 
                                                                   value={employee.full_name}
                                                                   className="flex items-center gap-2"
                                                               >
                                                                   <span>{employee.full_name}</span>
                                                                   {employee.role && (
                                                                       <Badge variant="outline" className="text-xs font-normal ml-2">
                                                                           {employee.role}
                                                                       </Badge>
                                                                   )}
                                                               </SelectItem>
                                                           ))}
                                                       </>
                                                   )}
                                               </SelectContent>
                                           </Select>
                                           {(formData.receivedBy.startsWith('other:') || (!formData.receivedBy && !employees.length)) && (
                                               <div className="mt-2">
                                                   <Input
                                                       value={formData.receivedBy.startsWith('other:') ? formData.receivedBy.substring(6) : formData.receivedBy}
                                                       onChange={(e) => setFormData(prev => ({
                                                           ...prev,
                                                           receivedBy: 'other:' + e.target.value
                                                       }))}
                                                       placeholder="Enter receiver's name"
                                                       className="w-full"
                                                   />
                                               </div>
                                           )}
                                       </div>
                                   </div>

                                   <div className="grid grid-cols-2 gap-4">
                                       <div>
                                           <Label>Date Received *</Label>
                                           <Popover>
                                               <PopoverTrigger asChild>
                                                   <Button variant="outline" className="w-full justify-start">
                                                       <CalendarIcon className="mr-2 h-4 w-4" />
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
                                           <Label htmlFor="time">Time Received *</Label>
                                           <div className="relative">
                                               <Input
                                                   id="time"
                                                   type="time"
                                                   value={formData.time}
                                                   onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                                                   className="pl-3"
                                               />
                                           </div>
                                       </div>
                                   </div>
                               </div>
                           </div>

                           {/* Delivery Method */}
                           <div className="space-y-4 border rounded-md p-4">
                               <h3 className="text-lg font-medium">Delivery Method</h3>
                               <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                   {deliveryMethodOptions.map((method) => (
                                       <Button
                                           key={method.value}
                                           variant={formData.deliveryMethod === method.value ? "default" : "outline"}
                                           className="h-auto py-2"
                                           onClick={() => setFormData(prev => ({ ...prev, deliveryMethod: method.value }))}
                                       >
                                           {method.label}
                                       </Button>
                                   ))}
                               </div>
                           </div>

                           {/* Document Types */}
                           <div className="space-y-4 border rounded-md p-4">
                               <h3 className="text-lg font-medium">Document Types *</h3>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                   {documentTypeOptions.map((docType) => {
                                       const isSelected = formData.documentTypes.includes(docType.value);
                                       return (
                                           <div key={docType.value} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                                               <Checkbox
                                                   id={docType.value}
                                                   checked={isSelected}
                                                   onCheckedChange={() => handleDocumentTypeToggle(docType.value)}
                                               />
                                               <label
                                                   htmlFor={docType.value}
                                                   className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                               >
                                                   {docType.label}
                                               </label>
                                           </div>
                                       );
                                   })}
                               </div>
                           </div>

                           {/* Additional Details */}
                           <div className="space-y-4 border rounded-md p-4">
                               <h3 className="text-lg font-medium">Additional Details</h3>
                               <div className="grid grid-cols-2 gap-4">
                                   <div>
                                       <Label htmlFor="filesCount">Number of Files *</Label>
                                       <Input
                                           id="filesCount"
                                           type="number"
                                           min="1"
                                           value={formData.filesCount}
                                           onChange={(e) => setFormData(prev => ({ ...prev, filesCount: parseInt(e.target.value) || 1 }))}
                                       />
                                   </div>

                                   <div>
                                       <Label htmlFor="processingStatus">Processing Status</Label>
                                       <Select
                                           value={formData.processingStatus}
                                           onValueChange={(value) => setFormData(prev => ({ ...prev, processingStatus: value }))}
                                       >
                                           <SelectTrigger>
                                               <SelectValue />
                                           </SelectTrigger>
                                           <SelectContent>
                                               <SelectItem value="pending">Pending</SelectItem>
                                               <SelectItem value="in_progress">In Progress</SelectItem>
                                               <SelectItem value="completed">Completed</SelectItem>
                                               <SelectItem value="on_hold">On Hold</SelectItem>
                                           </SelectContent>
                                       </Select>
                                   </div>
                               </div>

                               <div className="flex items-center space-x-2">
                                   <Switch
                                       id="isUrgent"
                                       checked={formData.isUrgent}
                                       onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isUrgent: checked }))}
                                   />
                                   <Label htmlFor="isUrgent" className="font-medium">Mark as Urgent</Label>
                               </div>

                               <div>
                                   <Label htmlFor="receptionNotes">Reception Notes</Label>
                                   <Textarea
                                       id="receptionNotes"
                                       placeholder="Enter any additional notes about the document reception..."
                                       value={formData.receptionNotes}
                                       onChange={(e) => setFormData(prev => ({ ...prev, receptionNotes: e.target.value }))}
                                       rows={3}
                                   />
                               </div>
                           </div>
                       </div>
                   )}
               </div>

               <DialogFooter className="pt-4 border-t">
                   <div className="flex justify-between w-full">
                       <div className="flex gap-2">
                           {editingReception && (
                               <Button
                                   type="button"
                                   variant="outline"
                                   onClick={() => {
                                       setEditingReception(null);
                                       resetForm();
                                   }}
                               >
                                   Cancel Edit
                               </Button>
                           )}
                           {hasAnyReceptions() && !editingReception && (
                               <Button
                                   type="button"
                                   variant="outline"
                                   onClick={() => resetForm()}
                                   className="border-green-200 text-green-700 hover:bg-green-50"
                               >
                                   <Plus className="h-4 w-4 mr-2" />
                                   Add Another Reception
                               </Button>
                           )}
                       </div>
                       <div className="flex gap-3">
                           <Button
                               type="button"
                               variant="outline"
                               onClick={() => setIsOpen(false)}
                           >
                               Cancel
                           </Button>
                           <Button
                               onClick={handleSubmit}
                               disabled={isLoading}
                               variant={isNil ? "destructive" : "default"}
                           >
                               {isLoading ? 'Saving...' : (
                                   isNil ? 'Mark as NIL' : 
                                   editingReception ? 'Update Reception' :
                                   hasAnyReceptions() ? 'Add Reception' : 'Save Reception'
                               )}
                           </Button>
                       </div>
                   </div>
               </DialogFooter>
           </DialogContent>
       </Dialog>
   );
}