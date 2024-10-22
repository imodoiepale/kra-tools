// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { createClient } from '@supabase/supabase-js';
import { Input } from "@/components/ui/input";
import { Download, MoreHorizontal, ArrowUpDown, Eye, RefreshCw, Search, Image } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function PINProfileReports() {
    const [reports, setReports] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState(null);
    const [sortOrder, setSortOrder] = useState('asc');
    const [visibleColumns, setVisibleColumns] = useState({
        company_name: true,
        company_pin: true,
        expiry_date: true,
        extraction_date: true,
        profile: true,
    });

    

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const { data, error } = await supabase
                .from('PINProfilesAndCertificates')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;

            const formattedReports = data.map(company => {
                const extractions = company.extractions;
                const extractionDates = Object.keys(extractions).sort((a, b) => new Date(b) - new Date(a));
                const latestDate = extractionDates[0];
                const latestExtraction = extractions[latestDate] || {};

                const formatDate = (dateString) => {
                    const date = new Date(dateString);
                    return date.toLocaleString('en-US', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    }).replace(/,/g, '').replace(/\//g, '.').toUpperCase();
                };

                return {
                    id: company.id,
                    company_name: company.company_name,
                    company_pin: company.company_pin === "MISSING PIN/PASSWORD" ? "Missing" : company.company_pin,
                    expiry_date: latestExtraction?.expiry_date || 'N/A',
                    extraction_date: formatDate(company.updated_at || latestDate || new Date()),
                    pdf_link: latestExtraction.pdf_link && latestExtraction.pdf_link !== "no doc"
                        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kra-documents/${latestExtraction.pdf_link}`
                        : null,
                };
            });

            setReports(formattedReports);
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    const filteredReports = reports.filter(report =>
        report.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.company_pin.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortOrder('asc');
        }
    };

    const sortedReports = [...filteredReports].sort((a, b) => {
        if (sortColumn) {
            const orderMultiplier = sortOrder === 'asc' ? 1 : -1;
            return a[sortColumn].localeCompare(b[sortColumn]) * orderMultiplier;
        }
        return 0;
    });

    const exportToExcel = () => {
        // Implement Excel export logic here
    };

    return (
        <div>
            <div className="flex justify-between mb-4">
                <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-1/5"
                />
                <div className="flex gap-2">
                    <Button onClick={exportToExcel} size="sm">
                        <Download className="mr-2 h-3 w-3" />
                        Export to Excel
                    </Button>
                    <Button onClick={fetchReports} size="sm">
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Refresh
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="ml-auto" size="sm">
                                Columns <MoreHorizontal className="ml-2 h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {Object.keys(visibleColumns).map((column) => (
                                <DropdownMenuCheckboxItem
                                    key={column}
                                    className="capitalize"
                                    checked={visibleColumns[column]}
                                    onCheckedChange={(value) =>
                                        setVisibleColumns((prev) => ({ ...prev, [column]: value }))
                                    }
                                >
                                    {column.replace('_', ' ')}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="border rounded-md">
                <ScrollArea className="h-[70vh]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                                {[
                                    { key: 'index', label: 'Index', alwaysVisible: true },
                                    { key: 'company_name', label: 'Company Name' },
                                    { key: 'company_pin', label: 'KRA PIN' },
                                    { key: 'extraction_date', label: 'Last Extracted' },
                                    { key: 'profile', label: 'PIN Profile', alwaysVisible: true },
                                ].map(({ key, label, alwaysVisible }) => (
                                    (alwaysVisible || visibleColumns[key]) && (
                                        <TableHead key={key} className={`font-bold ${key === 'index' ? 'text-center sticky left-0 bg-white' : key === 'company_name' ? '' : 'text-center'}`}>
                                            <div className={`flex items-center ${key === 'company_name' ? '' : 'justify-center'}`}>
                                                {label}
                                                {key !== 'profile' && (
                                                    <ArrowUpDown className="h-4 w-4 cursor-pointer ml-2" onClick={() => handleSort(key)} />
                                                )}
                                            </div>
                                        </TableHead>
                                    )
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedReports.map((report, index) => (
                                <TableRow key={report.id} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                    {[
                                        { key: 'index', content: index + 1, alwaysVisible: true },
                                        { key: 'company_name', content: report.company_name },
                                        { key: 'company_pin', content: report.company_pin === "MISSING PIN/PASSWORD" ? <span className="text-red-500">Missing</span> : report.company_pin },
                                        { key: 'extraction_date', content: <span className="text-center">{report.extraction_date}</span> },
                                        {
                                            key: 'profile',
                                            content: (
                                                report.pdf_link ? (
                                                    <div className="flex justify-center">
                                                        <Dialog>
                                                            <DialogTrigger asChild>


                                                                <Button variant='outline' className="text-blue-500 hover:underline text-xs px-1.5 py-0.5 flex items-center justify-center">
                                                                    <Eye className="inline-block mr-1 h-2.5 w-2.5" />
                                                                    View PIN Profile
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="w-full max-w-5xl max-h-[90vh]">
                                                                <DialogHeader>
                                                                    <DialogTitle>PIN Profile Document</DialogTitle>
                                                                </DialogHeader>
                                                                <iframe
                                                                    src={`${report.pdf_link}#toolbar=0&navpanes=0&view=FitH&zoom=40&embedded=true`}
                                                                    className="w-full h-[80vh]"
                                                                />
                                                            </DialogContent>
                                                        </Dialog>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-500 flex items-center justify-center">
                                                        <Image className="inline-block mr-1 h-4 w-4" />
                                                        Missing
                                                    </span>
                                                )
                                            ),
                                            alwaysVisible: true
                                        }
                                    ].map(({ key, content, alwaysVisible }) => (
                                        (alwaysVisible || visibleColumns[key]) && (
                                            <TableCell key={key} className={key === 'index' ? 'font-bold text-center sticky left-0 bg-inherit' : ''}>
                                                {content}
                                            </TableCell>
                                        )
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    );
}
