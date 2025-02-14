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
import { ArrowUpDown, Search, Eye, ImageIcon, MoreHorizontal, Download, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { createClient } from '@supabase/supabase-js';
import * as ExcelJS from 'exceljs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function TCCReports() {
    const [reports, setReports] = useState([]);
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
                    extraction_date: latestDate
                };
            });

            setReports(processedData);
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

    const sortedReports = [...reports].sort((a, b) => {
        if (a[sortColumn] < b[sortColumn]) return sortOrder === 'asc' ? -1 : 1;
        if (a[sortColumn] > b[sortColumn]) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const filteredReports = sortedReports.filter(report =>
        Object.values(report).some(value =>
            value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

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
                                        { key: 'expiry_date', label: 'Expiry Date' },
                                        { key: 'extraction_date', label: 'Last Extracted' },
                                        { key: 'tcc_cert', label: 'TCC Cert', alwaysVisible: true },
                                        { key: 'screenshot', label: 'Screenshot', alwaysVisible: true }
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
                                            { key: 'extraction_date', content: report.extraction_date },
                                            {
                                                key: 'tcc_cert',
                                                content: (
                                                    report.pdf_link && report.pdf_link !== "no doc" ? (
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <button className="text-blue-500 hover:underline">
                                                                    <Image 
                                                                        src={report.pdf_link || ''} 
                                                                        alt={`TCC Report for ${report.company_name}`}
                                                                        width={24}
                                                                        height={24}
                                                                        className="inline-block mr-1"
                                                                    />
                                                                    View TCC
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
                                                            <Image 
                                                                src={report.pdf_link || ''} 
                                                                alt={`TCC Report for ${report.company_name}`}
                                                                width={24}
                                                                height={24}
                                                                className="inline-block mr-1"
                                                            />
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
                                                                    <ImageIcon className="inline-block mr-1 h-4 w-4" />
                                                                    View Screenshot
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
                                                            <ImageIcon className="inline-block mr-1 h-4 w-4" />
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
            </TabsContent>
            <TabsContent value="detailed">
                <div className="flex space-x-8 mb-4">
                    <ScrollArea className="h-[600px] w-85 rounded-md border">
                        {reports.map((report, index) => (
                            <React.Fragment key={report.id}>
                                <div
                                    className={`p-2 cursor-pointer transition-colors duration-200 text-xs uppercase ${
                                        selectedCompany?.id === report.id
                                            ? 'bg-blue-500 text-white font-bold'
                                            : 'hover:bg-blue-100'
                                    }`}
                                    onClick={() => setSelectedCompany(report)}
                                >
                                    {report.company_name}
                                </div>
                                {index < reports.length - 1 && (
                                    <div className="border-b border-gray-200"></div>
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
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="text-center text-xs">Serial No</TableHead>
                                                        <TableHead className="text-xs">PIN</TableHead>
                                                        <TableHead className="text-xs">Taxpayer Name</TableHead>
                                                        <TableHead className="text-xs">Status</TableHead>
                                                        <TableHead className="text-xs">Certificate Date</TableHead>
                                                        <TableHead className="text-xs">Expiry Date</TableHead>
                                                        <TableHead className="text-xs">Certificate Serial No</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedCompany.full_table_data.map((row, index) => {
                                                        const isApproved = row.Status === 'Approved'
                                                        return (
                                                            <TableRow key={index}>
                                                                <TableCell className="text-center text-xs">{row.SerialNo}</TableCell>
                                                                <TableCell className="text-xs">{row.PIN}</TableCell>
                                                                <TableCell className="text-xs">{row.TaxPayerName}</TableCell>
                                                                <TableCell>
                                                                    <span className={`px-2 py-1 rounded-full text-xxs font-semibold ${row.Status === 'Approved' ? 'bg-green-100 text-green-800' :
                                                                        row.Status === 'Expired' ? 'bg-red-100 text-red-800' :
                                                                            'bg-yellow-100 text-yellow-800'
                                                                        }`}>
                                                                        {row.Status}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="font-bold text-xs">{row.CertificateDate}</TableCell>
                                                                <TableCell className={`font-bold text-xs ${isApproved ? 'text-green-500' : 'text-red-500'}`}>
                                                                    {row.ExpiryDate}
                                                                </TableCell>
                                                                <TableCell className="text-xs">{row.CertificateSerialNo}</TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
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