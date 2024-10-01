// components/AutoPopulation/AutoPopulationReports.js
// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpDown, Search, Eye, Download, MoreHorizontal, Play, FileText } from "lucide-react";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function AutoPopulationReports() {
    const [reports, setReports] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState(null);
    const [sortOrder, setSortOrder] = useState('asc');
    const [visibleColumns, setVisibleColumns] = useState({
        company_name: true,
        company_pin: true,
        latest_extraction_date: true,
        status: true,
    });

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const response = await fetch('/api/auto-population', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getReports' })
            });
            const data = await response.json();
            setReports(data);
            if (data.length > 0) {
                setSelectedCompany(data[0]);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortOrder('asc');
        }
    };

    const sortedReports = [...reports].sort((a, b) => {
        if (!sortColumn) return 0;
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const filteredReports = sortedReports.filter(report =>
        Object.values(report).some(value =>
            value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const runAutoPopulation = async (companyIds) => {
        try {
            const response = await fetch('/api/auto-population', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', companyIds })
            });
            if (response.ok) {
                alert('Auto-population process started successfully');
            } else {
                throw new Error('Failed to start auto-population process');
            }
        } catch (error) {
            console.error('Error starting auto-population:', error);
            alert('Failed to start auto-population process. Please try again.');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Input
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
                <div className="space-x-2">
                    <Button onClick={() => runAutoPopulation(reports.map(r => r.id))}>
                        <Play className="mr-2 h-4 w-4" /> Run All
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">Columns</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {Object.keys(visibleColumns).map((column) => (
                                <DropdownMenuCheckboxItem
                                    key={column}
                                    checked={visibleColumns[column]}
                                    onCheckedChange={(checked) =>
                                        setVisibleColumns((prev) => ({ ...prev, [column]: checked }))
                                    }
                                >
                                    {column.replace(/_/g, ' ')}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <Tabs defaultValue="summary">
                <TabsList>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="detailed">Detailed</TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {visibleColumns.company_name && (
                                    <TableHead onClick={() => handleSort('company_name')}>
                                        Company Name {sortColumn === 'company_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </TableHead>
                                )}
                                {visibleColumns.company_pin && (
                                    <TableHead onClick={() => handleSort('company_pin')}>
                                        KRA PIN {sortColumn === 'company_pin' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </TableHead>
                                )}
                                {visibleColumns.latest_extraction_date && (
                                    <TableHead onClick={() => handleSort('latest_extraction_date')}>
                                        Latest Extraction {sortColumn === 'latest_extraction_date' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </TableHead>
                                )}
                                {visibleColumns.status && (
                                    <TableHead onClick={() => handleSort('status')}>
                                        Status {sortColumn === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </TableHead>
                                )}
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredReports.map((report) => (
                                <TableRow key={report.id}>
                                    {visibleColumns.company_name && <TableCell>{report.company_name}</TableCell>}
                                    {visibleColumns.company_pin && <TableCell>{report.company_pin}</TableCell>}
                                    {visibleColumns.latest_extraction_date && <TableCell>{report.latest_extraction_date}</TableCell>}
                                    {visibleColumns.status && <TableCell>{report.status}</TableCell>}
                                    <TableCell>
                                        <Button onClick={() => setSelectedCompany(report)}>View Details</Button>
                                        <Button onClick={() => runAutoPopulation([report.id])}>Run</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                <TabsContent value="detailed">
                    {selectedCompany && (
                        <Card>
                            <CardHeader>
                                <CardTitle>{selectedCompany.company_name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-lg font-semibold">Company Details</h3>
                                        <p>KRA PIN: {selectedCompany.company_pin}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold">Extraction History</h3>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Documents</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedCompany.extractions.map((extraction) => (
                                                    <TableRow key={extraction.date}>
                                                        <TableCell>{extraction.date}</TableCell>
                                                        <TableCell>{extraction.status}</TableCell>
                                                        <TableCell>
                                                            {extraction.documents && Object.entries(extraction.documents).map(([docType, url]) => (
                                                                <a 
                                                                    key={docType} 
                                                                    href={url} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center text-blue-600 hover:underline"
                                                                >
                                                                    <FileText className="mr-1 h-4 w-4" />
                                                                    {docType}
                                                                </a>
                                                            ))}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}