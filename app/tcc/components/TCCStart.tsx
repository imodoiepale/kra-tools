// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Play, RefreshCw, PlayCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from '@supabase/supabase-js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function TCCStart({ onStart, onStop }) {
    const [isRunning, setIsRunning] = useState(false);
    const [extractionMode, setExtractionMode] = useState('all'); // 'all' or 'selected'
    const [companies, setCompanies] = useState([]);
    const [selectedCompanies, setSelectedCompanies] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [progress, setProgress] = useState(0);
    const [currentCompany, setCurrentCompany] = useState('');
    const [pollInterval, setPollInterval] = useState(null);
    const [activeTab, setActiveTab] = useState('control');

    useEffect(() => {
        fetchCompanies();
        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, []);

    const fetchCompanies = async () => {
        try {
            const { data: companiesData, error } = await supabase
                .from('acc_portal_company_duplicate')
                .select('id, company_name, kra_pin')
                .order('company_name', { ascending: true });

            if (error) throw error;
            setCompanies(companiesData || []);
        } catch (error) {
            console.error('Error fetching companies:', error);
        }
    };

    const filteredCompanies = companies.filter(company => {
        return company.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (company.kra_pin && company.kra_pin.toLowerCase().includes(searchTerm.toLowerCase()));
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
                                setIsRunning(false);
                                clearInterval(interval);
                                setPollInterval(null);
                                onStop();
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
                onStop();
            } else {
                throw new Error('Failed to stop TCC extraction');
            }
        } catch (error) {
            console.error('Error stopping TCC extraction:', error);
            alert('Failed to stop TCC extraction. Please try again.');
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
        <Card className="w-full max-w-4xl">
            <CardHeader>
                <CardTitle>TCC Extraction Control</CardTitle>
                <CardDescription>Manage the Tax Compliance Certificate extraction process</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="control">Control Panel</TabsTrigger>
                        <TabsTrigger value="companies">Company Selection</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="control" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-3">Extraction Settings</h3>
                                <RadioGroup className="space-y-3" value={extractionMode} onValueChange={setExtractionMode}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="all" id="r1" />
                                        <Label htmlFor="r1" className="font-medium">Extract All Companies</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="selected" id="r2" />
                                        <Label htmlFor="r2" className="font-medium">Extract Selected Companies ({selectedCompanies.length})</Label>
                                    </div>
                                </RadioGroup>
                                
                                {extractionMode === 'selected' && selectedCompanies.length === 0 && (
                                    <div className="mt-3 text-sm text-amber-600">
                                        Please select at least one company in the "Company Selection" tab before starting extraction.
                                    </div>
                                )}
                                
                                <div className="mt-6 space-y-4">
                                    <Button 
                                        onClick={handleStart} 
                                        disabled={isRunning || (extractionMode === 'selected' && selectedCompanies.length === 0)}
                                        className="w-full"
                                    >
                                        <Play className="mr-2 h-4 w-4" />
                                        Start Extraction
                                    </Button>
                                    
                                    <Button 
                                        onClick={handleStop} 
                                        disabled={!isRunning} 
                                        variant="destructive"
                                        className="w-full"
                                    >
                                        Stop Automation
                                    </Button>
                                </div>
                            </div>
                            
                            <div>
                                <h3 className="text-lg font-semibold mb-3">Extraction Status</h3>
                                {isRunning ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center p-4 text-sm text-yellow-800 border border-yellow-300 rounded-lg bg-yellow-50" role="alert">
                                            <AlertCircle className="flex-shrink-0 inline w-4 h-4 mr-3" />
                                            <div>
                                                <span className="font-medium">Extraction in progress!</span> The process is currently running.
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>Progress:</span>
                                                <span className="font-medium">{progress}%</span>
                                            </div>
                                            <Progress value={progress} className="h-2" />
                                        </div>
                                        
                                        {currentCompany && (
                                            <div className="text-sm">
                                                <span className="font-medium">Currently processing:</span> {currentCompany}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center p-4 text-sm text-green-800 border border-green-300 rounded-lg bg-green-50" role="alert">
                                        <div>
                                            <span className="font-medium">Ready to start!</span> Configure your extraction settings and press Start.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="companies">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="relative w-64">
                                    <Input
                                        placeholder="Search companies..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-2"
                                    />
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                    <Button variant="outline" size="sm" onClick={fetchCompanies}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Refresh
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleSelectAll(true)}
                                        disabled={filteredCompanies.length === 0}
                                    >
                                        Select All
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleSelectAll(false)}
                                        disabled={selectedCompanies.length === 0}
                                    >
                                        Deselect All
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="border rounded-md">
                                <ScrollArea className="h-[400px]">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-white z-10">
                                            <TableRow>
                                                <TableHead className="w-[50px] text-center">
                                                    <Checkbox 
                                                        checked={selectedCompanies.length === filteredCompanies.length && filteredCompanies.length > 0}
                                                        onCheckedChange={handleSelectAll}
                                                    />
                                                </TableHead>
                                                <TableHead className="w-[50px]">ID</TableHead>
                                                <TableHead>Company Name</TableHead>
                                                <TableHead className="w-[150px]">KRA PIN</TableHead>
                                                <TableHead className="w-[100px] text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredCompanies.length > 0 ? (
                                                filteredCompanies.map((company, index) => (
                                                    <TableRow key={company.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                        <TableCell className="text-center">
                                                            <Checkbox 
                                                                checked={selectedCompanies.includes(company.id)}
                                                                onCheckedChange={(checked) => handleSelectCompany(company.id, checked)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-medium">{company.id}</TableCell>
                                                        <TableCell>{company.company_name}</TableCell>
                                                        <TableCell>{company.kra_pin || '-'}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="h-7 px-2"
                                                                disabled={isRunning}
                                                                onClick={() => {
                                                                    setSelectedCompanies([company.id]);
                                                                    setExtractionMode('selected');
                                                                    setActiveTab('control');
                                                                }}
                                                            >
                                                                <PlayCircle className="h-3 w-3 mr-1" />
                                                                Select
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8">
                                                        {searchTerm ? 'No companies match your search criteria.' : 'No companies found.'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                            
                            <div className="flex justify-between items-center text-sm text-gray-500">
                                <span>Showing {filteredCompanies.length} of {companies.length} companies</span>
                                <span>{selectedCompanies.length} companies selected</span>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}