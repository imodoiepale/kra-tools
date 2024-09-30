// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { createClient } from '@supabase/supabase-js';
import { Input } from "@/components/ui/input";
import { Download, MoreHorizontal, ArrowUpDown, Eye, ImageIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function PINProfileReports() {
    const [reports, setReports] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleColumns, setVisibleColumns] = useState({
        company_name: true,
        company_pin: true,
        expiry_date: true,
        extraction_date: true,
    });

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const { data, error } = await supabase
                .from('PINProfilesAndCertificates')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedReports = data.map(report => ({
                id: report.id,
                company_name: report.company_name,
                company_pin: report.company_pin,
                expiry_date: report.expiry_date || 'N/A',
                extraction_date: new Date(report.created_at).toLocaleDateString(),
                pdf_link: report.extractions.pdf_link || null,
            }));

            setReports(formattedReports);
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    const filteredReports = reports.filter(report =>
        report.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.company_pin.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSort = (key) => {
        // Implement sorting logic here
    };

    const exportToExcel = () => {
        // Implement Excel export logic here
    };

    return (
        <div value="summary">
            <div className="flex justify-between mb-4">
                <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
                <div className="flex gap-2">
                    <Button onClick={exportToExcel}>
                        <Download className="mr-2 h-4 w-4" />
                        Export to Excel
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="ml-auto">
                                Columns <MoreHorizontal className="ml-2 h-4 w-4" />
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
                                        <TableHead key={key} className={`font-bold ${key === 'index' ? 'text-center sticky left-0 bg-white' : ''}`}>
                                            <div className="flex items-center justify-between">
                                                {label}
                                                {key !== 'tcc_cert' && key !== 'screenshot' && key !== 'status' && (
                                                    <ArrowUpDown className="h-4 w-4 cursor-pointer" onClick={() => handleSort(key)} />
                                                )}
                                            </div>
                                        </TableHead>
                                    )
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredReports.map((report, index) => (
                                <TableRow key={report.id} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                    {[
                                        { key: 'index', content: index + 1, alwaysVisible: true },
                                        { key: 'company_name', content: report.company_name },
                                        { key: 'company_pin', content: report.company_pin === "MISSING PIN/PASSWORD" ? <span className="text-red-500">{report.company_pin}</span> : report.company_pin },
                                        {
                                            key: 'expiry_date', content: (
                                                <span className={`font-bold text-center ${report.expiry_date === 'N/A'
                                                    ? 'text-amber-500'
                                                    : new Date(report.expiry_date) < new Date()
                                                        ? 'text-red-500'
                                                        : 'text-green-500'
                                                    }`}>
                                                    {report.expiry_date}
                                                </span>
                                            )
                                        },
                                        {
                                            key: 'profile',
                                            content: (
                                                report.pdf_link && report.pdf_link !== "no doc" ? (
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <button className="text-blue-500 hover:underline">
                                                                <Eye className="inline-block mr-1 h-4 w-4" />
                                                                View PIN Profile
                                                            </button>
                                                        </DialogTrigger>
                                                        <DialogContent className="w-full max-w-5xl max-h-[90vh]">
                                                            <DialogHeader>
                                                                <DialogTitle>PIN Profile Document</DialogTitle>
                                                            </DialogHeader>
                                                            <iframe
                                                                src={`${report.pdf_link}#toolbar=0&navpanes=0&view=FitH&zoom=40`}
                                                                className="w-full h-[80vh]"
                                                            />
                                                        </DialogContent>
                                                    </Dialog>
                                                ) : (
                                                    <span className="text-gray-500">
                                                        <Eye className="inline-block mr-1 h-4 w-4" />
                                                        Missing
                                                    </span>
                                                )
                                            ),
                                            alwaysVisible: true
                                        },
                                        
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