// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Building2,
    User,
    Phone,
    Mail,
    MapPin,
    Hash,
    Save,
    Plus,
    AlertCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Company } from '../types/fileManagement';

interface AddCompanyDialogProps {
    onCreateCompany: (company: Omit<Company, 'id' | 'created_at' | 'updated_at'>) => Promise<Company>;
    children: React.ReactNode;
}

export default function AddCompanyDialog({ onCreateCompany, children }: AddCompanyDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        company_name: '',
        kra_pin: '',
        category: 'sme' as Company['category'],
        industry: '',
        status: 'active' as Company['status'],
        priority: 'medium' as Company['priority'],
        contact_person: '',
        email: '',
        phone: '',
        address: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const industries = [
        'Manufacturing',
        'Technology',
        'Healthcare',
        'Education',
        'Finance',
        'Retail',
        'Construction',
        'Agriculture',
        'Transportation',
        'Real Estate',
        'Professional Services',
        'Non-Profit',
        'Other'
    ];

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.company_name.trim()) {
            newErrors.company_name = 'Company name is required';
        }

        if (!formData.kra_pin.trim()) {
            newErrors.kra_pin = 'KRA PIN is required';
        } else if (!/^[A-Z]\d{9}[A-Z]$/.test(formData.kra_pin.trim())) {
            newErrors.kra_pin = 'Invalid KRA PIN format (e.g., A123456789Z)';
        }

        if (!formData.contact_person.trim()) {
            newErrors.contact_person = 'Contact person is required';
        }

        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }

        if (formData.phone && !/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
            newErrors.phone = 'Invalid phone number format';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            toast.error('Please fix the errors in the form');
            return;
        }

        setIsLoading(true);
        try {
            await onCreateCompany(formData);

            // Reset form
            setFormData({
                company_name: '',
                kra_pin: '',
                category: 'sme',
                industry: '',
                status: 'active',
                priority: 'medium',
                contact_person: '',
                email: '',
                phone: '',
                address: ''
            });
            setErrors({});
            setIsOpen(false);
        } catch (error) {
            console.error('Error creating company:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>

            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-3 text-blue-800">
                        <div className="p-2 bg-blue-100 rounded-full">
                            <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <span>Add New Company</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Basic Information */}
                    <Card className="border-blue-200">
                        <CardHeader>
                            <CardTitle className="text-blue-800 flex items-center">
                                <Building2 className="h-4 w-4 mr-2" />
                                Company Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="company_name" className="text-blue-700">
                                        Company Name *
                                    </Label>
                                    <Input
                                        id="company_name"
                                        value={formData.company_name}
                                        onChange={(e) => handleInputChange('company_name', e.target.value)}
                                        placeholder="Enter company name"
                                        className={`border-blue-200 focus:border-blue-400 ${errors.company_name ? 'border-red-300' : ''}`}
                                    />
                                    {errors.company_name && (
                                        <p className="text-red-500 text-xs mt-1 flex items-center">
                                            <AlertCircle className="h-3 w-3 mr-1" />
                                            {errors.company_name}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="kra_pin" className="text-blue-700">
                                        KRA PIN *
                                    </Label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600" />
                                        <Input
                                            id="kra_pin"
                                            value={formData.kra_pin}
                                            onChange={(e) => handleInputChange('kra_pin', e.target.value.toUpperCase())}
                                            placeholder="A123456789Z"
                                            className={`pl-10 border-blue-200 focus:border-blue-400 ${errors.kra_pin ? 'border-red-300' : ''}`}
                                        />
                                    </div>
                                    {errors.kra_pin && (
                                        <p className="text-red-500 text-xs mt-1 flex items-center">
                                            <AlertCircle className="h-3 w-3 mr-1" />
                                            {errors.kra_pin}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label htmlFor="category" className="text-blue-700">Category</Label>
                                    <Select
                                        value={formData.category}
                                        onValueChange={(value) => handleInputChange('category', value)}
                                    >
                                        <SelectTrigger className="border-blue-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="corporate">🏢 Corporate</SelectItem>
                                            <SelectItem value="sme">🏪 SME</SelectItem>
                                            <SelectItem value="individual">👤 Individual</SelectItem>
                                            <SelectItem value="ngo">🤝 NGO</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="industry" className="text-blue-700">Industry</Label>
                                    <Select
                                        value={formData.industry}
                                        onValueChange={(value) => handleInputChange('industry', value)}
                                    >
                                        <SelectTrigger className="border-blue-200">
                                            <SelectValue placeholder="Select industry" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {industries.map(industry => (
                                                <SelectItem key={industry} value={industry}>
                                                    {industry}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="priority" className="text-blue-700">Priority</Label>
                                    <Select
                                        value={formData.priority}
                                        onValueChange={(value) => handleInputChange('priority', value)}
                                    >
                                        <SelectTrigger className="border-blue-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="high">🔴 High Priority</SelectItem>
                                            <SelectItem value="medium">🟡 Medium Priority</SelectItem>
                                            <SelectItem value="low">🟢 Low Priority</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contact Information */}
                    <Card className="border-blue-200">
                        <CardHeader>
                            <CardTitle className="text-blue-800 flex items-center">
                                <User className="h-4 w-4 mr-2" />
                                Contact Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="contact_person" className="text-blue-700">
                                    Contact Person *
                                </Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600" />
                                    <Input
                                        id="contact_person"
                                        value={formData.contact_person}
                                        onChange={(e) => handleInputChange('contact_person', e.target.value)}
                                        placeholder="Enter contact person name"
                                        className={`pl-10 border-blue-200 focus:border-blue-400 ${errors.contact_person ? 'border-red-300' : ''}`}
                                    />
                                </div>
                                {errors.contact_person && (
                                    <p className="text-red-500 text-xs mt-1 flex items-center">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        {errors.contact_person}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="email" className="text-blue-700">Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600" />
                                        <Input
                                            id="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => handleInputChange('email', e.target.value)}
                                            placeholder="contact@company.com"
                                            className={`pl-10 border-blue-200 focus:border-blue-400 ${errors.email ? 'border-red-300' : ''}`}
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="text-red-500 text-xs mt-1 flex items-center">
                                            <AlertCircle className="h-3 w-3 mr-1" />
                                            {errors.email}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="phone" className="text-blue-700">Phone</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600" />
                                        <Input
                                            id="phone"
                                            value={formData.phone}
                                            onChange={(e) => handleInputChange('phone', e.target.value)}
                                            placeholder="+254 xxx xxx xxx"
                                            className={`pl-10 border-blue-200 focus:border-blue-400 ${errors.phone ? 'border-red-300' : ''}`}
                                        />
                                    </div>
                                    {errors.phone && (
                                        <p className="text-red-500 text-xs mt-1 flex items-center">
                                            <AlertCircle className="h-3 w-3 mr-1" />
                                            {errors.phone}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="address" className="text-blue-700">Address</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-blue-600" />
                                    <Textarea
                                        id="address"
                                        value={formData.address}
                                        onChange={(e) => handleInputChange('address', e.target.value)}
                                        placeholder="Enter company address"
                                        className="pl-10 border-blue-200 focus:border-blue-400"
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Preview */}
                    <Card className="border-green-200 bg-green-50">
                        <CardHeader>
                            <CardTitle className="text-green-800 text-sm">Company Preview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{formData.company_name || 'Company Name'}</span>
                                    <div className="flex space-x-2">
                                        <Badge variant="outline" className="text-xs">
                                            {formData.category}
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className={`text-xs ${formData.priority === 'high' ? 'border-red-200 text-red-700' :
                                                    formData.priority === 'medium' ? 'border-yellow-200 text-yellow-700' :
                                                        'border-green-200 text-green-700'
                                                }`}
                                        >
                                            {formData.priority}
                                        </Badge>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600">
                                    KRA PIN: {formData.kra_pin || 'Not provided'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Contact: {formData.contact_person || 'Not provided'}
                                </p>
                                {formData.industry && (
                                    <p className="text-sm text-gray-600">
                                        Industry: {formData.industry}
                                    </p>
                                )}
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
                                Creating...
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <Save className="h-4 w-4 mr-2" />
                                Create Company
                            </div>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}