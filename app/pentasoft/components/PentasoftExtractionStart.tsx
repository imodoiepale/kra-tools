// @ts-nocheck
// components/PentasoftExtractionStart.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface Company {
    id: number;
    company_name: string;
}

interface PentasoftExtractionStartProps {
    onStart: () => void;
}

export function PentasoftExtractionStart({ onStart }: PentasoftExtractionStartProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [runOption, setRunOption] = useState<'all' | 'selected'>('all');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const { data, error } = await supabase
                .from('acc_portal_company_duplicate')
                .select('id, company_name')
                .order('id');

            if (error) throw error;

            setCompanies(data);
        } catch (err) {
            console.error('Error fetching companies:', err);
            setError('Failed to fetch companies');
        }
    };

    const handleStart = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/pentasoft-extraction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'extract',
                    runOption,
                    selectedCompanies: runOption === 'selected' ? selectedCompanies : []
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start PENTASOFT extraction');
            }

            onStart();
        } catch (err) {
            console.error('Error starting PENTASOFT extraction:', err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckboxChange = (companyName: string) => {
        setSelectedCompanies(prev =>
            prev.includes(companyName) ? prev.filter(x => x !== companyName) : [...prev, companyName]
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Start PENTASOFT Extraction</CardTitle>
                <CardDescription>Begin the process of extracting PAYE, NITA Housing Levy, NHIF, and NSSF reports from PENTASOFT.</CardDescription>
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
                            <ScrollArea className="h-[300px] mb-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px] sticky top-0 bg-white">Select</TableHead>
                                            <TableHead className="sticky top-0 bg-white">#</TableHead>
                                            <TableHead className="sticky top-0 bg-white">Company Name</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {companies.map((company, index) => (
                                            <TableRow key={company.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedCompanies.includes(company.company_name)}
                                                        onCheckedChange={() => handleCheckboxChange(company.company_name)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">{index + 1}</TableCell>
                                                <TableCell>{company.company_name}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
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
                                                <TableHead>#</TableHead>
                                                <TableHead>Company Name</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedCompanies.map((companyName, index) => (
                                                <TableRow key={companyName} className="bg-blue-100">
                                                    <TableCell>{index + 1}</TableCell>
                                                    <TableCell>{companyName}</TableCell>
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
                <Button onClick={handleStart} disabled={isLoading || (runOption === 'selected' && selectedCompanies.length === 0)}>
                    {isLoading ? 'Extracting...' : 'Start Extraction'}
                </Button>
            </CardFooter>
        </Card>
    );
}