// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Play, RefreshCw, PlayCircle, Search, X, UsersIcon, CheckSquare, Info as InfoIcon } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { createClient } from '@supabase/supabase-js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function TCCStart({ onStart }) {
    const [isRunning, setIsRunning] = useState(false);
    const [extractionMode, setExtractionMode] = useState('all'); // 'all' or 'selected'
    const [companies, setCompanies] = useState([]);
    const [selectedCompanies, setSelectedCompanies] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [progress, setProgress] = useState(0);
    const [currentCompany, setCurrentCompany] = useState('');
    const [pollInterval, setPollInterval] = useState(null);
    const [extractionStatus, setExtractionStatus] = useState('idle'); // 'idle', 'running', 'completed', 'error'
    const [categoryFilters, setCategoryFilters] = useState({
        categories: {
            'All Categories': false,
            'Acc': true,
            'Audit': false
        },
        categorySettings: {
            'Acc': {
                clientStatus: {
                    All: false,
                    Active: true,
                    Inactive: false
                }
            },
            'Audit': {
                clientStatus: {
                    All: false,
                    Active: true,
                    Inactive: false
                }
            }
        }
    });

    useEffect(() => {
        fetchCompanies();
        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, []);

    const fetchCompanies = async () => {
        try {
            const currentDate = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
            
            const { data: companiesData, error } = await supabase
                .from('acc_portal_company_duplicate')
                .select('id, company_name, kra_pin, acc_client_effective_from, acc_client_effective_to, audit_client_effective_from, audit_client_effective_to')
                .order('company_name', { ascending: true });

            if (error) throw error;
            
            // Process and format company data with service categories
            const processedData = companiesData?.map(company => {
                // Determine if company is accounting active
                const isAccActive = Boolean(
                    company.acc_client_effective_from && 
                    company.acc_client_effective_to && 
                    new Date(company.acc_client_effective_from) <= new Date(currentDate) && 
                    new Date(company.acc_client_effective_to) >= new Date(currentDate)
                );
                                 
                // Determine if company is audit active
                const isAuditActive = Boolean(
                    company.audit_client_effective_from && 
                    company.audit_client_effective_to && 
                    new Date(company.audit_client_effective_from) <= new Date(currentDate) && 
                    new Date(company.audit_client_effective_to) >= new Date(currentDate)
                );

                // Prepare categories array
                const categories = [];
                if (isAccActive || (!isAccActive && company.acc_client_effective_from)) categories.push('Acc');
                if (isAuditActive || (!isAuditActive && company.audit_client_effective_from)) categories.push('Audit');

                return {
                    ...company,
                    categories: categories,
                    acc_client_status: isAccActive ? 'active' : 'inactive',
                    audit_client_status: isAuditActive ? 'active' : 'inactive',
                    service_categories: categories, // Keep for backward compatibility
                    is_active: isAccActive || isAuditActive
                };
            }) || [];
            
            setCompanies(processedData);
        } catch (error) {
            console.error('Error fetching companies:', error);
        }
    };

    // Add a function to filter data based on category filters (similar to TCCReports)
    const applyFiltersToData = (data) => {
        if (!categoryFilters.categories || Object.keys(categoryFilters.categories).length === 0) {
            return data;
        }

        return data.filter(company => {
            // Check if "All Categories" is selected
            if (categoryFilters.categories['All Categories']) {
                return true;
            }

            // Get all selected categories
            const selectedCategories = Object.entries(categoryFilters.categories)
                .filter(([category, isSelected]) => category !== 'All Categories' && isSelected)
                .map(([category]) => category);

            // If no categories selected, show all companies
            if (selectedCategories.length === 0) {
                return true;
            }

            // Check if company belongs to ANY of the selected categories
            // and matches the status criteria for that category
            return selectedCategories.some(category => {
                // Check if company belongs to this category
                if (!company.categories?.includes(category)) {
                    return false;
                }

                // Get the status settings for this category
                const categorySettings = categoryFilters.categorySettings?.[category];
                if (!categorySettings) {
                    return true;
                }

                // Get the client status for this category
                const clientStatus = company[`${category.toLowerCase()}_client_status`];

                // Get selected client statuses
                const selectedClientStatuses = Object.entries(categorySettings.clientStatus || {})
                    .filter(([_, isSelected]) => isSelected)
                    .map(([status]) => status.toLowerCase());

                // If "All" is selected or no specific status is selected, include all
                if (selectedClientStatuses.includes('all') || selectedClientStatuses.length === 0) {
                    return true;
                }

                // Check if company's status matches any selected status
                return selectedClientStatuses.includes(clientStatus);
            });
        });
    };

    // Filter companies by both search term and categories
    const filteredCompanies = companies.filter(company => {
        // First apply category filters
        const passesCategories = applyFiltersToData([company]).length > 0;
        if (!passesCategories) return false;
        
        // Then apply search filter
        const matchesSearch = !searchTerm ||
            company.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            company.kra_pin?.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
    });

    const handleStart = async () => {
        try {
            let companyIds = [];
            
            if (extractionMode === 'selected' && selectedCompanies.length > 0) {
                companyIds = selectedCompanies;
            }
            
            const response = await fetch('/api/tcc-extractor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'start',
                    companies: companyIds
                })
            });
            
            if (response.ok) {
                setIsRunning(true);
                onStart();
                
                // Start polling for progress
                const interval = setInterval(async () => {
                    try {
                        const progressResponse = await fetch('/api/tcc-extractor', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'progress' })
                        });
                        
                        if (progressResponse.ok) {
                            const progressData = await progressResponse.json();
                            setProgress(progressData.progress || 0);
                            setCurrentCompany(progressData.currentCompany || '');
                            
                            if (!progressData.isRunning) {
                                clearInterval(interval);
                                setPollInterval(null);
                                setIsRunning(false);
                                setExtractionStatus('completed');
                                if (typeof onStart === 'function') {
                                    onStart(); // Notify parent that extraction is done
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error polling progress:', error);
                    }
                }, 3000);
                
                setPollInterval(interval);
            } else {
                throw new Error('Failed to start TCC extraction');
            }
        } catch (error) {
            console.error('Error starting TCC extraction:', error);
            alert('Failed to start TCC extraction. Please try again.');
        }
    };

    const handleStop = async () => {
        try {
            const response = await fetch('/api/tcc-extractor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });
            
            if (response.ok) {
                setIsRunning(false);
                if (pollInterval) {
                    clearInterval(pollInterval);
                    setPollInterval(null);
                }
                
                // Notify parent if the function exists
                if (typeof onStart === 'function') {
                    onStart();
                }
                
                setExtractionStatus('idle');
                
                // Reset progress
                setProgress(0);
                setCurrentCompany('');
            }
        } catch (error) {
            console.error('Error stopping extraction:', error);
            setExtractionStatus('error');
        }
    };
    
    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedCompanies(filteredCompanies.map(company => company.id));
        } else {
            setSelectedCompanies([]);
        }
    };
    
    const handleSelectCompany = (companyId, checked) => {
        if (checked) {
            setSelectedCompanies(prev => [...prev, companyId]);
        } else {
            setSelectedCompanies(prev => prev.filter(id => id !== companyId));
        }
    };

    return (
        <Card className="shadow-md border border-gray-200">
            <CardHeader className="pb-3 border-b">
                <CardTitle className="flex items-center gap-2 text-xl">
                    <Play className="h-5 w-5 text-primary" />
                    TCC Extraction Control
                </CardTitle>
                <CardDescription>Extract TCC documents for all companies or selected companies</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:space-x-4">
                    {/* Control panel side */}
                    <div className="w-full md:w-1/3 space-y-4">
                        <div className="space-y-4 p-4 border rounded-md bg-slate-50">
                            <div className="flex items-center space-x-2">
                                <InfoIcon className="h-5 w-5 text-blue-500" />
                                <h3 className="font-medium">Extraction Settings</h3>
                            </div>
                            
                            <RadioGroup
                                value={extractionMode}
                                onValueChange={setExtractionMode}
                                className="flex flex-col space-y-2 mt-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="all" id="all" disabled={isRunning} />
                                    <Label htmlFor="all">Extract All Companies</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="selected" id="selected" disabled={isRunning || selectedCompanies.length === 0} />
                                    <Label htmlFor="selected">Extract Selected Companies ({selectedCompanies.length})</Label>
                                </div>
                            </RadioGroup>
                            
                            <div className="pt-1">
                                <Button 
                                    className="w-full" 
                                    disabled={isRunning || (extractionMode === 'selected' && selectedCompanies.length === 0)}
                                    onClick={handleStart}
                                >
                                    <Play className="h-4 w-4 mr-2" />
                                    Start Extraction
                                </Button>
                                
                                {isRunning && (
                                    <Button 
                                        variant="outline" 
                                        className="w-full mt-2" 
                                        onClick={handleStop}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Stop Process
                                    </Button>
                                )}
                            </div>
                        </div>
                        
                        {isRunning && (
                            <div className="space-y-3 p-4 border rounded-md">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium">Extraction Progress:</span>
                                    <span className="font-bold">{Math.round(progress)}%</span>
                                </div>
                                <Progress value={progress} className="h-2" />
                                {currentCompany && (
                                    <Alert className="py-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle className="ml-2 text-sm">Processing</AlertTitle>
                                        <AlertDescription className="ml-6 text-xs">
                                            {currentCompany}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}
                        
                        {selectedCompanies.length > 0 && (
                            <div className="border rounded-md">
                                <div className="p-2 bg-blue-50 flex items-center">
                                    <CheckSquare className="h-4 w-4 mr-2 text-blue-700" />
                                    <span className="text-sm font-medium text-blue-700">Selected ({selectedCompanies.length})</span>
                                </div>
                                <ScrollArea className="h-[150px]">
                                    <div className="p-2 space-y-1">
                                        {companies
                                            .filter(c => selectedCompanies.includes(c.id))
                                            .map((company) => (
                                                <div key={company.id} className="flex justify-between items-center py-1 px-2 text-sm bg-blue-50 rounded">
                                                    <span className="truncate">{company.company_name}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        disabled={isRunning}
                                                        onClick={() => handleSelectCompany(company.id, false)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </ScrollArea>
                                <div className="border-t p-2 flex justify-between">
                                    <span className="text-xs text-muted-foreground">{selectedCompanies.length} selected</span>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 text-xs"
                                        disabled={isRunning}
                                        onClick={() => setSelectedCompanies([])}
                                    >
                                        Clear All
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Companies list side */}
                    <div className="flex-1">
                        <div className="space-y-4">
                            <div className="border-b pb-3 mb-2">
                                <h3 className="text-sm font-medium mb-2">Category Filter</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="all-categories"
                                            checked={categoryFilters.categories['All Categories']}
                                            onCheckedChange={(checked) => {
                                                setCategoryFilters(prev => ({
                                                    ...prev,
                                                    categories: {
                                                        ...Object.keys(prev.categories).reduce((acc, cat) => {
                                                            acc[cat] = false;
                                                            return acc;
                                                        }, {}),
                                                        'All Categories': !!checked
                                                    }
                                                }));
                                            }}
                                            disabled={isRunning}
                                        />
                                        <Label htmlFor="all-categories" className="text-sm">All Categories</Label>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="acc-category"
                                            checked={categoryFilters.categories['Acc']}
                                            onCheckedChange={(checked) => {
                                                setCategoryFilters(prev => ({
                                                    ...prev,
                                                    categories: {
                                                        ...prev.categories,
                                                        'All Categories': false,
                                                        'Acc': !!checked
                                                    }
                                                }));
                                            }}
                                            disabled={isRunning}
                                        />
                                        <Label htmlFor="acc-category" className="text-sm">Accounting</Label>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="audit-category"
                                            checked={categoryFilters.categories['Audit']}
                                            onCheckedChange={(checked) => {
                                                setCategoryFilters(prev => ({
                                                    ...prev,
                                                    categories: {
                                                        ...prev.categories,
                                                        'All Categories': false,
                                                        'Audit': !!checked
                                                    }
                                                }));
                                            }}
                                            disabled={isRunning}
                                        />
                                        <Label htmlFor="audit-category" className="text-sm">Audit</Label>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="acc-active-only"
                                            checked={categoryFilters.categorySettings['Acc'].clientStatus.Active}
                                            onCheckedChange={(checked) => {
                                                setCategoryFilters(prev => ({
                                                    ...prev,
                                                    categorySettings: {
                                                        ...prev.categorySettings,
                                                        'Acc': {
                                                            ...prev.categorySettings['Acc'],
                                                            clientStatus: {
                                                                All: false,
                                                                Active: !!checked,
                                                                Inactive: !checked 
                                                                    ? prev.categorySettings['Acc'].clientStatus.Inactive 
                                                                    : false
                                                            }
                                                        }
                                                    }
                                                }));
                                            }}
                                            disabled={isRunning || !categoryFilters.categories['Acc']}
                                        />
                                        <Label htmlFor="acc-active-only" className="text-sm">Active Clients Only</Label>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by company name or PIN"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8"
                                    disabled={isRunning}
                                />
                                {searchTerm && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0.5 top-0.5 h-8 w-8 p-0"
                                        onClick={() => setSearchTerm('')}
                                        disabled={isRunning}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            
                            <div className="border rounded-md">
                                <div className="flex justify-between items-center p-2 bg-gray-50 border-b">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            checked={filteredCompanies.length > 0 && selectedCompanies.length === filteredCompanies.length}
                                            onCheckedChange={handleSelectAll}
                                            disabled={isRunning || filteredCompanies.length === 0}
                                            id="select-all"
                                        />
                                        <Label htmlFor="select-all" className="text-sm cursor-pointer">Select All</Label>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {filteredCompanies.length} companies
                                    </span>
                                </div>
                                <ScrollArea className="h-[350px]">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-white z-10">
                                            <TableRow>
                                                <TableHead className="w-[50px] text-center"></TableHead>
                                                <TableHead>Company Name</TableHead>
                                                <TableHead className="w-[120px]">KRA PIN</TableHead>
                                                <TableHead className="w-[80px] text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredCompanies.length > 0 ? (
                                                filteredCompanies.map((company, index) => (
                                                    <TableRow key={company.id} className={selectedCompanies.includes(company.id) ? 'bg-blue-50' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                                                        <TableCell className="text-center">
                                                            <Checkbox 
                                                                checked={selectedCompanies.includes(company.id)}
                                                                onCheckedChange={(checked) => handleSelectCompany(company.id, checked)}
                                                                disabled={isRunning}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-medium truncate max-w-[280px]">
                                                            {company.company_name}
                                                        </TableCell>
                                                        <TableCell>{company.kra_pin || '-'}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-7 px-2"
                                                                disabled={isRunning || selectedCompanies.includes(company.id)}
                                                                onClick={() => handleSelectCompany(company.id, true)}
                                                            >
                                                                Select
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-8">
                                                        {searchTerm ? 'No companies match your search criteria.' : 'No companies found.'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}