// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { supabase } from '@/lib/supabase';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Company {
    id: number;
    company_name: string;
    kra_pin: string;
}

export function AutoLiabilitiesStart({ onStart, onStop }) {
    const [isChecking, setIsChecking] = useState(false);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
    const [runOption, setRunOption] = useState<'all' | 'selected'>('all');
    const [selectAll, setSelectAll] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        const { data, error } = await supabase
            .from('company_MAIN')
            .select('id, company_name, kra_pin')
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching companies:', error);
        } else {
            setCompanies(data as Company[] || []);
        }
    };

    const handleStartCheck = async () => {
        setIsChecking(true);
        try {
            const response = await fetch('/api/liability-extractor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'start',
                    runOption,
                    companyIds: runOption === 'selected' ? selectedCompanies : []
                })
            });

            if (!response.ok) throw new Error('API request failed');

            const data = await response.json();
            console.log('Liability extraction started:', data);
            onStart();
        } catch (error) {
            console.error('Error starting liability extraction:', error);
            alert('Failed to start liability extraction. Please try again.');
        } finally {
            setIsChecking(false);
        }
    };

    const handleStopCheck = () => {
        onStop();
        alert('Stopping all automations...');
    };

    const handleCheckboxChange = (id: number) => {
        setSelectedCompanies(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAllChange = (checked: boolean) => {
        setSelectAll(checked);
        setSelectedCompanies(checked ? companies.map(company => company.id) : []);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Start Liability Extraction</CardTitle>
                <CardDescription>Begin the liability extraction process for companies.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <label className="block mb-2">Run option:</label>
                    <Select value={runOption} onValueChange={(value) => setRunOption(value as 'all' | 'selected')}>
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
                            <ScrollArea className="h-[500px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px] sticky top-0 bg-white">
                                                <Checkbox
                                                    checked={selectAll}
                                                    onCheckedChange={handleSelectAllChange}
                                                />
                                            </TableHead>
                                            <TableHead className="sticky top-0 bg-white">#</TableHead>
                                            <TableHead className="sticky top-0 bg-white">Company Name</TableHead>
                                            <TableHead className="sticky top-0 bg-white">KRA PIN</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {companies.map((company, index) => (
                                            <TableRow key={company.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedCompanies.includes(company.id)}
                                                        onCheckedChange={() => handleCheckboxChange(company.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">{index + 1}</TableCell>
                                                <TableCell>{company.company_name}</TableCell>
                                                <TableCell>{company.kra_pin}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </motion.div>
                        {selectedCompanies.length > 0 && (
                            <motion.div
                                className="pl-6"
                                initial={{ width: "0%", opacity: 0 }}
                                animate={{ width: "50%", opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="mb-4">
                                    <h3 className="text-lg font-semibold mb-2">Selected Companies</h3>
                                    <ScrollArea className="h-[400px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="sticky top-0 bg-white">#</TableHead>
                                                    <TableHead className="sticky top-0 bg-white">Company Name</TableHead>
                                                    <TableHead className="sticky top-0 bg-white">KRA PIN</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {companies.filter(c => selectedCompanies.includes(c.id)).map((company, index) => (
                                                    <TableRow key={company.id} className="bg-blue-100">
                                                        <TableCell>{index + 1}</TableCell>
                                                        <TableCell>{company.company_name}</TableCell>
                                                        <TableCell>{company.kra_pin}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                    <div className="mt-4">
                                        <div className="flex space-x-2">
                                            <Button onClick={handleStartCheck} disabled={isChecking || selectedCompanies.length === 0} size="sm">
                                                {isChecking ? 'Starting...' : 'Start Liability Extraction'}
                                            </Button>
                                            <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" size="sm">
                                                Stop Liability Extraction
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )
                }
            </CardContent >
            {runOption === 'all' && (
                <CardFooter>
                    <div className="flex space-x-2">
                        <Button onClick={handleStartCheck} disabled={isChecking} size="sm">
                            {isChecking ? 'Starting...' : 'Start Liability Extraction'}
                        </Button>
                        <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" size="sm">
                            Stop Liability Extraction
                        </Button>
                    </div>
                </CardFooter>
            )}
        </Card >
    );
}