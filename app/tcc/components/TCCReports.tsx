// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpDown, Search, Eye, EyeOff, ImageIcon, MoreHorizontal, Download, ChevronLeftIcon, ChevronRightIcon, Filter } from "lucide-react";
import { createClient } from '@supabase/supabase-js';
import * as ExcelJS from 'exceljs';
import { ClientCategoryFilter } from "@/components/ClientCategoryFilter";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function TCCReports() {
    const [reports, setReports] = useState([]);
    const [filteredReports, setFilteredReports] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [visibleColumns, setVisibleColumns] = useState({
        company_name: true,
        company_pin: true,
        status: true,
        expiry_date: true,
        extraction_date: true,
    });
    const [activeTab, setActiveTab] = useState("summary");
    const [clientCategories, setClientCategories] = useState([]);
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [categoryFilters, setCategoryFilters] = useState({});
    const [showStatsRows, setShowStatsRows] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const { data, error } = await supabase
                .from('TaxComplianceCertificates')
                .select('*')
                .order('company_name', { ascending: true });

            if (error) {
                throw new Error(`Error fetching reports: ${error.message}`);
            }

            // Process the data to extract the latest extraction for each company
            const processedData = data.map(company => {
                const extractions = company.extractions;
                const latestDate = Object.keys(extractions).sort((a, b) => new Date(b) - new Date(a))[0];
                const latestExtraction = extractions[latestDate];

                // Extract client category if available
                const client_category = company.client_category || '';

                return {
                    id: company.id,
                    company_name: company.company_name,
                    company_pin: company.company_pin,
                    status: latestExtraction.status,
                    certificate_date: latestExtraction.certificate_date,
                    expiry_date: latestExtraction.expiry_date,
                    serial_no: latestExtraction.serial_no,
                    pdf_link: latestExtraction.pdf_link !== "no doc"
                        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kra-documents/${latestExtraction.pdf_link}`
                        : null,
                    screenshot_link: latestExtraction.screenshot_link !== "no doc"
                        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kra-documents/${latestExtraction.screenshot_link}`
                        : null,
                    full_table_data: latestExtraction.full_table_data,
                    extraction_date: latestDate,
                    client_category: client_category
                };
            });

            // Extract unique client categories
            const categories = [
                ...new Set(processedData.map(report => report.client_category).filter(Boolean)),
            ];
            setClientCategories(categories);

            setReports(processedData);
            setFilteredReports(processedData);
            if (processedData.length > 0) {
                setSelectedCompany(processedData[0]);
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

    // Filter and sort reports whenever search term, sort config or categoryFilters changes
    useEffect(() => {
        let result = [...reports];

        // Apply client category/status filter
        if (Object.keys(categoryFilters).length > 0) {
            result = result.filter((report) => {
                // For each category, check if any status is checked
                return Object.entries(categoryFilters).some(([cat, statuses]) => {
                    if (!report.client_category) return false;
                    if (cat === "all") return Object.values(statuses).some(Boolean); // "All Categories" checked
                    if (report.client_category.toLowerCase() !== cat) return false;
                    return Object.entries(statuses).some(([status, checked]) => checked);
                });
            });
        }

        // Apply search filter
        if (searchTerm) {
            const lowercasedSearch = searchTerm.toLowerCase();
            result = result.filter(report =>
                Object.values(report).some(value =>
                    value?.toString().toLowerCase().includes(lowercasedSearch)
                )
            );
        }

        setFilteredReports(result);
    }, [reports, searchTerm, categoryFilters]);

    const sortedReports = [...filteredReports].sort((a, b) => {
        if (!sortColumn) return 0;
        if (!a[sortColumn] && !b[sortColumn]) return 0;
        if (!a[sortColumn]) return 1;
        if (!b[sortColumn]) return -1;
        if (a[sortColumn] < b[sortColumn]) return sortOrder === 'asc' ? -1 : 1;
        if (a[sortColumn] > b[sortColumn]) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    // Calculate statistics for complete and missing entries
    const calculateStats = () => {
        const stats = {
            complete: {},
            missing: {}
        };

        // Define fields to check for completeness
        const fieldsToCheck = [
            'company_name',
            'company_pin',
            'status',
            'expiry_date',
            'extraction_date',
            'pdf_link',
            'screenshot_link'
        ];

        // Initialize stats for each field
        fieldsToCheck.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        // Calculate stats for each field individually
        filteredReports.forEach(report => {
            fieldsToCheck.forEach(field => {
                if (report[field] && report[field].toString().trim() !== '') {
                    stats.complete[field]++;
                } else {
                    stats.missing[field]++;
                }
            });
        });

        return stats;
    };

    const stats = calculateStats();

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('TCC Reports');

        // Add headers
        const headers = ['Index', 'Company Name', 'KRA PIN', 'Status', 'Expiry Date', 'Last Extracted', 'TCC Cert', 'Screenshot'];
        const headerRow = worksheet.addRow(headers);

        // Style the header row
        headerRow.eachCell((cell, colNumber) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' }  // Yellow background
            };
            cell.font = { bold: true };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Add data
        filteredReports.forEach((report, index) => {
            const row = worksheet.addRow([
                index + 1,
                report.company_name,
                report.company_pin,
                report.status,
                report.expiry_date,
                report.extraction_date,
                report.pdf_link ? 'Available' : 'Missing',
                report.screenshot_link ? 'Available' : 'Missing'
            ]);

            // Center the index
            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

            // Color coding for dates and 'N/A'
            const expiryDateCell = row.getCell(5);
            if (report.expiry_date === 'N/A') {
                expiryDateCell.font = { color: { argb: 'FFFF9900' } };  // Orange for N/A
            } else {
                const expiryDate = new Date(report.expiry_date);
                const today = new Date();
                if (expiryDate < today) {
                    expiryDateCell.font = { color: { argb: 'FFFF0000' } };  // Red for expired
                } else {
                    expiryDateCell.font = { color: { argb: 'FF008000' } };  // Green for valid
                }
            }

            // Add hyperlinks for TCC Cert and Screenshot
            if (report.pdf_link) {
                row.getCell(7).value = {
                    text: 'View TCC',
                    hyperlink: report.pdf_link,
                    tooltip: 'Click to view TCC'
                };
                row.getCell(7).font = { color: { argb: 'FF0000FF' }, underline: true };
            }
            if (report.screenshot_link) {
                row.getCell(8).value = {
                    text: 'View Screenshot',
                    hyperlink: report.screenshot_link,
                    tooltip: 'Click to view Screenshot'
                };
                row.getCell(8).font = { color: { argb: 'FF0000FF' }, underline: true };
            }

            // Alternating row colors
            if (index % 2 === 1) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF0F0F0' }  // Very light grey for alternating rows
                    };
                });
            }

            // Add borders to all cells in the row
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const cellLength = cell.value ? cell.value.toString().length : 10;
                if (cellLength > maxLength) {
                    maxLength = cellLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength;
        });

        // Generate and download the file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'tcc_reports.xlsx';
        link.click();
    };

    return (
        <Tabs defaultValue="summary">
            <TabsList>
                <TabsTrigger value="summary">Summary View</TabsTrigger>
                <TabsTrigger value="detailed">Detailed View</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
                <div className="flex justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 w-64"
                            />
                        </div>
                        <div className="flex space-x-2">
                            <Button variant="outline" onClick={() => setFilterDialogOpen(true)}>
                                <Filter className="h-4 w-4 mr-2" />
                                Category Filter
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => setShowStatsRows(!showStatsRows)}
                            >
                                {showStatsRows ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                                {showStatsRows ? 'Hide Stats' : 'Show Stats'}
                            </Button>
                        </div>
                    </div>
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
                    <ClientCategoryFilter
                        isOpen={filterDialogOpen}
                        onClose={() => setFilterDialogOpen(false)}
                        onApplyFilters={(filters) => {
                            setCategoryFilters(filters);
                            setFilterDialogOpen(false);
                        }}
                        onClearFilters={() => {
                            setCategoryFilters({});
                        }}
                        selectedFilters={categoryFilters}
                    />
                </div>
                <div className="border rounded-md flex-1 flex flex-col">
                    <ScrollArea className="h-[75vh]" style={{overflowY: 'auto'}}>
                        <Table>
                            <TableHeader className="sticky top-0 bg-white z-10">
                                <TableRow>
                                    {[
                                        { key: 'index', label: 'Index', alwaysVisible: true },
                                        { key: 'company_name', label: 'Company Name' },
                                        { key: 'company_pin', label: 'KRA PIN' },
                                        { key: 'expiry_date', label: 'Expiry Date' },
                                        { key: 'extraction_date', label: 'Last Extracted' },
                                        { key: 'tcc_cert', label: 'TCC Cert', alwaysVisible: true },
                                        { key: 'screenshot', label: 'Screenshot', alwaysVisible: true }
                                    ].map(({ key, label, alwaysVisible }) => (
                                        (alwaysVisible || visibleColumns[key]) && (
                                            <TableHead key={key} className={`font-bold border-r border-gray-300 ${key === 'index' ? 'text-center sticky left-0 bg-white' : ''}`}>
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
                                {showStatsRows && (
                                    <>
                                        <TableRow className="bg-gray-100">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-gray-300 sticky left-0 bg-gray-100">Complete</TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.company_name === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.company_name}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.company_pin === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.company_pin}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.expiry_date === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.expiry_date}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.extraction_date === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.extraction_date}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.pdf_link === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.pdf_link}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.screenshot_link === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.screenshot_link}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow className="bg-gray-50">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-gray-300 sticky left-0 bg-gray-50">Missing</TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.company_name > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.company_name}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.company_pin > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.company_pin}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.expiry_date > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.expiry_date}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.extraction_date > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.extraction_date}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.pdf_link > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.pdf_link}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.screenshot_link > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.screenshot_link}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    </>
                                )}
                            </TableHeader>
                            <TableBody>
                                {filteredReports.map((report, index) => (
                                    <TableRow key={report.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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
                                            { key: 'extraction_date', content: report.extraction_date },
                                            {
                                                key: 'tcc_cert',
                                                content: (
                                                    report.pdf_link && report.pdf_link !== "no doc" ? (
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <button className="text-blue-500 hover:underline">
                                                                    View
                                                                </button>
                                                            </DialogTrigger>
                                                            <DialogContent className="w-full max-w-5xl max-h-[90vh]">
                                                                <DialogHeader>
                                                                    <DialogTitle>TCC Document</DialogTitle>
                                                                </DialogHeader>
                                                                <iframe
                                                                    src={`${report.pdf_link}#toolbar=0&navpanes=0&view=FitH&zoom=40`}
                                                                    className="w-full h-[80vh]"
                                                                />
                                                            </DialogContent>
                                                        </Dialog>
                                                    ) : (
                                                        <span className="text-gray-500">
                                                            Missing
                                                        </span>
                                                    )
                                                ),
                                                alwaysVisible: true
                                            },
                                            {
                                                key: 'screenshot',
                                                content: (
                                                    report.screenshot_link && report.screenshot_link !== "no doc" ? (
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <button className="text-blue-500 hover:underline">
                                                                    View
                                                                </button>
                                                            </DialogTrigger>
                                                            <DialogContent className="w-full max-w-5xl max-h-[90vh]">
                                                                <DialogHeader>
                                                                    <DialogTitle>Screenshot</DialogTitle>
                                                                </DialogHeader>
                                                                <Image 
                                                                    src={report.screenshot_link} 
                                                                    alt="Screenshot"
                                                                    width={400}
                                                                    height={300}
                                                                    className="w-full h-auto max-h-[80vh] object-contain"
                                                                />
                                                            </DialogContent>
                                                        </Dialog>
                                                    ) : (
                                                        <span className="text-gray-500">
                                                            Missing
                                                        </span>
                                                    )
                                                ),
                                                alwaysVisible: true
                                            }
                                        ].map(({ key, content, alwaysVisible }) => (
                                            (alwaysVisible || visibleColumns[key]) && (
                                                <TableCell key={key} className={`border-r border-gray-300 ${key === 'index' ? 'font-bold text-center sticky left-0 bg-inherit' : ''}`}>
                                                    {content}
                                                </TableCell>
                                            )
                                        ))}
                                    </TableRow>
                                ))}
                                {/* Add a spacer row at the bottom to ensure visibility of all items */}
                                <TableRow className="h-10"></TableRow>
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </TabsContent>
            <TabsContent value="detailed">
                <div className="flex space-x-8 mb-4">
                    <ScrollArea className="h-[600px] w-85 rounded-md border border-gray-300" style={{overflowY: 'auto'}}>
                        {reports.map((report, index) => (
                            <React.Fragment key={report.id}>
                                <div
                                    className={`p-2 cursor-pointer transition-colors duration-200 text-xs uppercase ${
                                        selectedCompany?.id === report.id
                                            ? 'bg-gray-500 text-white font-bold'
                                            : 'hover:bg-gray-100'
                                    }`}
                                    onClick={() => setSelectedCompany(report)}
                                >
                                    {report.company_name}
                                </div>
                                {index < reports.length - 1 && (
                                    <div className="border-b border-gray-300"></div>
                                )}
                            </React.Fragment>
                        ))}
                    </ScrollArea>
                    <div className="flex-1">
                        {selectedCompany && (
                            <Card className="shadow-lg">
                                <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                                    <CardTitle className="text-xl">{selectedCompany.company_name}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                
                                    <ScrollArea className="h-[600px]">
                                        <div className='text-xs'>
                                            <h4 className="font-medium my-3 text-sm">Full Table Data</h4>
                                            <Table>
                                                <TableHeader className="bg-gray-100">
                                                    <TableRow>
                                                        <TableHead className="text-center text-xs border-r border-gray-300">Serial No</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">PIN</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Taxpayer Name</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Status</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Certificate Date</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Expiry Date</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Certificate Serial No</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedCompany.full_table_data.map((row, index) => {
                                                        const isApproved = row.Status === 'Approved'
                                                        return (
                                                            <TableRow key={index}>
                                                                <TableCell className="text-center text-xs border-r border-gray-300">{row.SerialNo}</TableCell>
                                                                <TableCell className="text-xs border-r border-gray-300">{row.PIN}</TableCell>
                                                                <TableCell className="text-xs border-r border-gray-300">{row.TaxPayerName}</TableCell>
                                                                <TableCell className="border-r border-gray-300">
                                                                    <span className={`px-2 py-1 rounded-full text-xxs font-semibold ${row.Status === 'Approved' ? 'bg-green-100 text-green-800' :
                                                                        row.Status === 'Expired' ? 'bg-red-100 text-red-800' :
                                                                            'bg-yellow-100 text-yellow-800'
                                                                        }`}>
                                                                        {row.Status}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="font-bold text-xs border-r border-gray-300">{row.CertificateDate}</TableCell>
                                                                <TableCell className={`font-bold text-xs border-r border-gray-300 ${isApproved ? 'text-green-500' : 'text-red-500'}`}>
                                                                    {row.ExpiryDate}
                                                                </TableCell>
                                                                <TableCell className="text-xs border-r border-gray-300">{row.CertificateSerialNo}</TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                    {/* Add a spacer row at the bottom to ensure visibility of all items */}
                                                    <TableRow className="h-10"></TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div className="max-h-[60vh]">
                                            <h4 className="font-medium mb-3 text-base">Documents</h4>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="border rounded-lg p-4">
                                                    <h5 className="font-medium mb-3 text-sm">TCC Certificate</h5>
                                                    {selectedCompany.pdf_link && selectedCompany.pdf_link !== "no doc" ? (
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <iframe src={selectedCompany.pdf_link} className="w-full h-[600px] cursor-pointer" title="TCC Certificate" />
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-[80vw] max-h-[80vh]">
                                                                <DialogHeader>
                                                                    <DialogTitle className="text-sm">TCC Certificate</DialogTitle>
                                                                </DialogHeader>
                                                                <iframe src={selectedCompany.pdf_link} className="w-full h-[70vh]" title="TCC Certificate" />
                                                            </DialogContent>
                                                        </Dialog>
                                                    ) : (
                                                        <p className="text-red-500 text-xl font-bold flex items-center justify-center capitalize h-[300px]">Missing</p>
                                                    )}
                                                </div>
                                                <div className="border rounded-lg p-4">
                                                    <h5 className="font-medium mb-3 text-sm">Screenshot</h5>
                                                    {selectedCompany.screenshot_link && selectedCompany.screenshot_link !== "no doc" ? (
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Image 
                                                                    src={selectedCompany.screenshot_link} 
                                                                    alt="Screenshot"
                                                                    width={400}
                                                                    height={300}
                                                                    className="w-[400px] h-auto max-h-[300px] object-contain cursor-zoom-in"
                                                                />
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-[60vw] max-h-[80vh]">
                                                                <DialogHeader>
                                                                    <DialogTitle className="text-sm">Screenshot</DialogTitle>
                                                                </DialogHeader>
                                                                <Image 
                                                                    src={selectedCompany.screenshot_link} 
                                                                    alt="Screenshot"
                                                                    width={400}
                                                                    height={300}
                                                                    className="w-full h-auto max-h-[70vh] object-contain"
                                                                />
                                                            </DialogContent>
                                                        </Dialog>
                                                    ) : (
                                                        <p className="text-red-500 text-xl font-bold flex items-center justify-center capitalize h-[300px]">Missing</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </TabsContent>
        </Tabs>
    );
}