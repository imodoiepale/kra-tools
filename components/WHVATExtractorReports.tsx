// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Search, Download } from "lucide-react";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function WHVATExtractorReports() {
    const [view, setView] = useState('summary');
    const [companies, setCompanies] = useState([]);
    const [allCompanyData, setAllCompanyData] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [companyData, setCompanyData] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('');

    useEffect(() => {
        fetchCompanies();
        fetchAllCompanyData();
    }, []);

    useEffect(() => {
        if (selectedCompany) {
            const data = allCompanyData.find(c => c.company_name === selectedCompany);
            setCompanyData(data?.extraction_data || null);
            setActiveTab(data?.extraction_data ? Object.keys(data.extraction_data)[0] : '');
        }
    }, [selectedCompany, allCompanyData]);

    const fetchCompanies = async () => {
        try {
            const { data, error } = await supabase
                .from('whvat_extractions')
                .select('company_name')
                .order('company_name');

            if (error) throw error;
            setCompanies(data);
        } catch (error) {
            console.error('Error fetching companies:', error);
        }
    };

    const fetchAllCompanyData = async () => {
        try {
            const { data, error } = await supabase
                .from('whvat_extractions')
                .select('*');

            if (error) throw error;
            setAllCompanyData(data);
        } catch (error) {
            console.error('Error fetching all company data:', error);
        }
    };

    const calculateTotal = (monthData) => {
        if (!monthData || !monthData.tableData) return 0;
        return monthData.tableData.reduce((sum, row) => sum + parseFloat(row[8] || 0), 0);
    };

    const calculateOverallTotal = (data) => {
        if (!data) return 0;
        return Object.values(data).reduce((sum, monthData) => sum + calculateTotal(monthData), 0);
    };

    const renderMonthTable = (monthData) => {
        if (!monthData || !monthData.tableData || monthData.tableData.length === 0) {
            return <p>No data available for this month.</p>;
        }

        const total = calculateTotal(monthData);

        return (
            <>
                <div className="mb-4">
                    <strong>Total for this month: {total.toFixed(2)}</strong>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            {monthData.tableData[0].map((header, index) => (
                                <TableHead key={index}>{header}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {monthData.tableData.slice(1).map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                                {row.map((cell, cellIndex) => (
                                    <TableCell key={cellIndex}>{cell}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </>
        );
    };

    const exportToExcel = async () => {
        if (!companyData) return;

        const workbook = new ExcelJS.Workbook();
        
        Object.entries(companyData).forEach(([month, data]) => {
            const worksheet = workbook.addWorksheet(month);
            
            if (data.tableData && data.tableData.length > 0) {
                worksheet.addRow(data.tableData[0]); // Headers
                data.tableData.slice(1).forEach(row => worksheet.addRow(row));
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `${selectedCompany}_WHVAT_Extractions.xlsx`);
    };

    const renderSummaryView = () => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Latest Extraction Date</TableHead>
                    <TableHead>Number of Extractions</TableHead>
                    <TableHead>Total Amount</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {allCompanyData.map((company) => {
                    const extractionDates = company.extraction_data ? Object.keys(company.extraction_data) : [];
                    const latestExtractionDate = extractionDates.length > 0 ? 
                        new Date(Math.max(...extractionDates.map(date => new Date(company.extraction_data[date].extractionDate)))).toLocaleDateString() : 
                        'N/A';
                    const totalAmount = calculateOverallTotal(company.extraction_data);
                    return (
                        <TableRow key={company.company_name}>
                            <TableCell>{company.company_name}</TableCell>
                            <TableCell>{latestExtractionDate}</TableCell>
                            <TableCell>{extractionDates.length}</TableCell>
                            <TableCell>{totalAmount.toFixed(2)}</TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );

    const renderDetailedView = () => (
        <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1">
                <ScrollArea className="h-[calc(100vh-2rem)]">
                    {companies.map((company) => (
                        <Button
                            key={company.company_name}
                            onClick={() => setSelectedCompany(company.company_name)}
                            variant={selectedCompany === company.company_name ? "default" : "outline"}
                            className="w-full mb-2"
                        >
                            {company.company_name}
                        </Button>
                    ))}
                </ScrollArea>
            </div>
            <div className="col-span-3">
                {companyData && (
                    <>
                        <div className="mb-4">
                            <strong>Overall Total: {calculateOverallTotal(companyData).toFixed(2)}</strong>
                        </div>
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList>
                                {Object.keys(companyData).map((month) => (
                                    <TabsTrigger key={month} value={month}>{month}</TabsTrigger>
                                ))}
                                <TabsTrigger value="totals">Totals</TabsTrigger>
                            </TabsList>
                            {Object.entries(companyData).map(([month, data]) => (
                                <TabsContent key={month} value={month}>
                                    {renderMonthTable(data)}
                                </TabsContent>
                            ))}
                            <TabsContent value="totals">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Month</TableHead>
                                            <TableHead>Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(companyData).map(([month, data]) => (
                                            <TableRow key={month}>
                                                <TableCell>{month}</TableCell>
                                                <TableCell>{calculateTotal(data).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                        </Tabs>
                        <Button onClick={exportToExcel} className="mt-4">
                            <Download className="mr-2 h-4 w-4" /> Export to Excel
                        </Button>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>WHVAT Extractor Reports</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={view} onValueChange={setView} className="mb-4">
                    <TabsList>
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="detailed">Detailed</TabsTrigger>
                    </TabsList>
                </Tabs>
                {view === 'summary' ? renderSummaryView() : renderDetailedView()}
            </CardContent>
        </Card>
    );
}