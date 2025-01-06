// components/AutoPopulationStart.tsx
"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from '@supabase/supabase-js';

interface Company {
    id: number;
    company_name: string;
    kra_pin: string;
    kra_password: string;
    status?: string;
}

interface AutoPopulationStartProps {
    onStart: () => void;
}

export function AutoPopulationStart({ onStart }: AutoPopulationStartProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
    const [runOption, setRunOption] = useState('all');
    const [automationProgress, setAutomationProgress] = useState<any>(null);

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        fetchCompanies();
        fetchAutomationProgress();
    }, []);

    const fetchAutomationProgress = async () => {
        const response = await fetch('/api/auto-population', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'progress' })
        });
        const data = await response.json();
        setAutomationProgress(data);
        if (data.isRunning) {
            setIsLoading(true);
        }
    };

    const fetchCompanies = async () => {
        try {
            const { data, error } = await supabase
                .from('PasswordChecker')
                .select('*')
                .order('company_name');

            if (error) throw error;
            setCompanies(data || []);
        } catch (err) {
            console.error('Error fetching companies:', err);
            setError('Failed to load companies');
        }
    };

    const handleCompanyToggle = (companyId: number) => {
        setSelectedCompanies(prev =>
            prev.includes(companyId)
                ? prev.filter(id => id !== companyId)
                : [...prev, companyId]
        );
    };

    const getStatusBadgeClass = (status?: string) => {
        if (!status) return "bg-yellow-500";
        switch (status.toLowerCase()) {
            case 'valid':
                return "bg-green-500";
            case 'invalid':
                return "bg-red-500";
            default:
                return "bg-yellow-500";
        }
    };

    const handleStart = async () => {
        if (runOption === 'selected' && selectedCompanies.length === 0) {
            setError('Please select at least one company');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/auto-population', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    action: 'start',
                    runOption,
                    selectedIds: runOption === 'selected' ? selectedCompanies : [] 
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start VAT auto-population');
            }

            onStart();
        } catch (err) {
            console.error('Error starting VAT auto-population:', err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Start VAT Auto-Population</CardTitle>
                <CardDescription>Select companies and begin the auto-population process.</CardDescription>
            </CardHeader>
            <CardContent>
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div className="mb-4">
                    <label className="block mb-2">Run option:</label>
                    <Select value={runOption} onValueChange={(value) => setRunOption(value)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select run option" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Companies</SelectItem>
                            <SelectItem value="selected">Selected Companies</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {runOption === 'selected' && (
                    <div className="flex">
                        <motion.div
                            className="pr-2"
                            initial={{ width: "100%" }}
                            animate={{ width: selectedCompanies.length > 0 ? "50%" : "100%" }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="max-h-[580px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px] sticky top-0 bg-white">Select</TableHead>
                                            <TableHead className="w-[50px] sticky top-0 bg-white">#</TableHead>
                                            <TableHead className="min-w-[200px] sticky top-0 bg-white">Company Name</TableHead>
                                            <TableHead className="w-[120px] sticky top-0 bg-white">KRA PIN</TableHead>
                                            <TableHead className="w-[120px] sticky top-0 bg-white">KRA Password</TableHead>
                                            <TableHead className="w-[100px] sticky top-0 bg-white text-center">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {companies.map((company, index) => (
                                            <TableRow key={company.id}>
                                                <TableCell className="w-[50px]">
                                                    <Checkbox
                                                        checked={selectedCompanies.includes(company.id)}
                                                        onCheckedChange={() => handleCompanyToggle(company.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="w-[50px] text-center">{index + 1}</TableCell>
                                                <TableCell className="min-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis">
                                                    {company.company_name}
                                                </TableCell>
                                                <TableCell className="w-[120px] font-mono">{company.kra_pin}</TableCell>
                                                <TableCell className="w-[120px] font-mono">{company.kra_password}</TableCell>
                                                <TableCell className="w-[100px] text-center">
                                                    <span className={`${getStatusBadgeClass(company.status)} text-white px-2 py-1 rounded whitespace-nowrap text-sm`}>
                                                        {company.status || 'Pending'}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </motion.div>
                        {selectedCompanies.length > 0 && (
                            <motion.div
                                className="pl-2"
                                initial={{ width: "0%", opacity: 0 }}
                                animate={{ width: "50%", opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="mb-4">
                                    <h3 className="text-lg font-semibold mb-2">Selected Companies</h3>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px]">#</TableHead>
                                                <TableHead className="min-w-[200px]">Company Name</TableHead>
                                                <TableHead className="w-[120px]">KRA PIN</TableHead>
                                                <TableHead className="w-[120px]">KRA Password</TableHead>
                                                <TableHead className="w-[100px] text-center">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {companies
                                                .filter(c => selectedCompanies.includes(c.id))
                                                .map((company, index) => (
                                                    <TableRow key={company.id} className="bg-blue-100">
                                                        <TableCell className="w-[50px] text-center">{index + 1}</TableCell>
                                                        <TableCell className="min-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis">
                                                            {company.company_name}
                                                        </TableCell>
                                                        <TableCell className="w-[120px] font-mono">{company.kra_pin}</TableCell>
                                                        <TableCell className="w-[120px] font-mono">{company.kra_password}</TableCell>
                                                        <TableCell className="w-[100px] text-center">
                                                            <span className={`${getStatusBadgeClass(company.status)} text-white px-2 py-1 rounded whitespace-nowrap text-sm`}>
                                                                {company.status || 'Pending'}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button
                    onClick={handleStart}
                    disabled={isLoading || (runOption === 'selected' && selectedCompanies.length === 0)}
                >
                    {isLoading ? 'Running...' : 'Start Auto-Population'}
                </Button>
            </CardFooter>
        </Card>
    );
}