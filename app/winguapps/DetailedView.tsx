"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Download, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReportRecord, DocumentGroups } from './types';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import DocumentViewer from './DocumentViewer';

interface DetailedViewProps {
    reports: ReportRecord[];
    exportToExcel: (reports: ReportRecord[]) => void;
    setBulkDownloadOpen: (open: boolean) => void;
    documentGroups: DocumentGroups;
}

const DetailedView: React.FC<DetailedViewProps> = ({
    reports,
    exportToExcel,
    setBulkDownloadOpen,
    documentGroups
}) => {
    const [companySearchTerm, setCompanySearchTerm] = useState('');
    const [selectedCompany, setSelectedCompany] = useState<ReportRecord | null>(null);
    const [viewerConfig, setViewerConfig] = useState<{
        isOpen: boolean;
        url: string;
        title: string;
        fileType: string;
    }>({
        isOpen: false,
        url: '',
        title: '',
        fileType: ''
    });

    const openDocument = (url: string, title: string, fileType: string) => {
        setViewerConfig({
            isOpen: true,
            url,
            title,
            fileType
        });
    };

    const closeDocument = () => {
        setViewerConfig(prev => ({ ...prev, isOpen: false }));
    };

    // Get unique companies based on CompanyID
    const uniqueCompanies = Array.from(
        new Map(reports.map(report => [report.CompanyID, report])).values()
    );

    const renderTableHeader = () => (
        <>
            <TableRow className="bg-gradient-to-r from-blue-600 to-blue-700 border-none">
                <TableHead className="border-r border-blue-500 text-[11px] text-white font-semibold py-4">#</TableHead>
                <TableHead className="border-r border-blue-500 text-[11px] text-white font-semibold py-4">Month/Year</TableHead>
                {/* Statutory Documents - PDF */}
                {documentGroups.statutory_pdf.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-blue-500 text-[11px] text-white font-semibold py-4">
                        {doc.key.replace('_PDF', '').replace('_', ' ')}
                    </TableHead>
                ))}
                {/* Statutory Documents - Excel */}
                {documentGroups.statutory_excel.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-blue-500 text-[11px] text-white font-semibold py-4">
                        {doc.key.replace('_Excel', '').replace('_', ' ')}
                    </TableHead>
                ))}
                {/* Statutory Documents - CSV */}
                {documentGroups.statutory_csv.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-blue-500 text-[11px] text-white font-semibold py-4">
                        {doc.key.replace('_CSV', '').replace('_', ' ')}
                    </TableHead>
                ))}
                {/* Payroll Documents */}
                {documentGroups.payroll.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-blue-500 text-[11px] text-white font-semibold py-4">
                        {doc.key.replace('_', ' ')}
                    </TableHead>
                ))}
                {/* Payment Lists */}
                {documentGroups.payments.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-blue-500 text-[11px] text-white font-semibold py-4">
                        {doc.key.replace('_', ' ')}
                    </TableHead>
                ))}
            </TableRow>
        </>
    );

    const renderTableRow = (report: ReportRecord, index: number) => (
        <TableRow 
            key={`${report.CompanyID}-${report.Month}-${report.Year}`} 
            className="hover:bg-gray-50 transition-colors duration-150 ease-in-out even:bg-gray-50/50"
        >
            <TableCell className="border-r border-gray-200 text-[11px] font-medium text-gray-600">{index + 1}</TableCell>
            <TableCell className="border-r border-gray-200 text-[11px] font-medium text-gray-600">{`${report.Month}/${report.Year}`}</TableCell>
            {/* Statutory Documents - PDF */}
            {documentGroups.statutory_pdf.map(({ key, pdfKey }) => (
                <TableCell key={key} className="border-r border-gray-200 text-center">
                    {pdfKey && report[pdfKey] && typeof report[pdfKey] === 'string' && (
                        <button
                            onClick={() => openDocument(report[pdfKey] as string, `${key.replace('_PDF', '')} - ${report.CompanyName}`, 'pdf')}
                            className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors duration-150 ease-in-out"
                        >
                            View
                        </button>
                    )}
                </TableCell>
            ))}
            {/* Statutory Documents - Excel */}
            {documentGroups.statutory_excel.map(({ key, dataKey }) => (
                <TableCell key={key} className="border-r border-gray-200 text-center">
                    {dataKey && report[dataKey] && typeof report[dataKey] === 'string' && (
                        <button
                            onClick={() => openDocument(report[dataKey] as string, `${key.replace('_Excel', '')} - ${report.CompanyName}`, 'excel')}
                            className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors duration-150 ease-in-out"
                        >
                            Excel
                        </button>
                    )}
                </TableCell>
            ))}
            {/* Statutory Documents - CSV */}
            {documentGroups.statutory_csv.map(({ key, dataKey }) => (
                <TableCell key={key} className="border-r border-gray-200 text-center">
                    {dataKey && report[dataKey] && typeof report[dataKey] === 'string' && (
                        <button
                            onClick={() => openDocument(report[dataKey] as string, `${key.replace('_CSV', '')} - ${report.CompanyName}`, 'csv')}
                            className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-orange-700 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors duration-150 ease-in-out"
                        >
                            CSV
                        </button>
                    )}
                </TableCell>
            ))}
            {/* Payroll Documents */}
            {documentGroups.payroll.map(({ key, pdfKey, dataKey }) => (
                <TableCell key={key} className="border-r border-gray-200 text-center">
                    <div className="flex flex-col gap-1 items-center">
                        {pdfKey && report[pdfKey] && typeof report[pdfKey] === 'string' && (
                            <button
                                onClick={() => openDocument(report[pdfKey] as string, `${key} PDF - ${report.CompanyName}`, 'pdf')}
                                className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors duration-150 ease-in-out"
                            >
                                View
                            </button>
                        )}
                        {dataKey && report[dataKey] && typeof report[dataKey] === 'string' && (
                            <button
                                onClick={() => openDocument(report[dataKey] as string, `${key} Excel - ${report.CompanyName}`, 'excel')}
                                className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors duration-150 ease-in-out"
                            >
                                Excel
                            </button>
                        )}
                    </div>
                </TableCell>
            ))}
            {/* Payment Lists */}
            {documentGroups.payments.map(({ key, pdfKey }) => (
                <TableCell key={key} className="border-r border-gray-200 text-center">
                    {pdfKey && report[pdfKey] && typeof report[pdfKey] === 'string' && (
                        <button
                            onClick={() => openDocument(report[pdfKey] as string, `${key} - ${report.CompanyName}`, 'pdf')}
                            className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors duration-150 ease-in-out"
                        >
                            View
                        </button>
                    )}
                </TableCell>
            ))}
        </TableRow>
    );

    return (
        <div className="grid grid-cols-[250px_1fr] gap-4"> {/* Made more compact */}
            {/* Left Panel - Company List */}
            <Card className="h-[calc(100vh-180px)]"> {/* Added Card wrapper */}
                <CardHeader className="p-3">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <Input
                            placeholder="Search companies..."
                            value={companySearchTerm}
                            onChange={(e) => setCompanySearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </CardHeader>
                <ScrollArea className="h-[calc(100vh-240px)]">
                    <div className="space-y-0.5 p-2">
                        {uniqueCompanies
                            .filter(report =>
                                report.CompanyName.toLowerCase().includes(companySearchTerm.toLowerCase())
                            )
                            .map((report) => (
                                <button
                                    key={report.CompanyID}
                                    onClick={() => setSelectedCompany(report)}
                                    className={`w-full text-left px-3 py-2 rounded-md transition-all ${selectedCompany?.CompanyID === report.CompanyID
                                            ? 'bg-blue-100 text-blue-900'
                                            : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <span className="text-sm font-medium">{report.CompanyName}</span>
                                </button>
                            ))}
                    </div>
                </ScrollArea>
            </Card>

            {/* Right Panel - Table View */}
            <Card className="h-[calc(100vh-180px)]">
                {selectedCompany ? (
                    <>
                        <CardHeader className="p-3 border-b">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-semibold">
                                    {selectedCompany.CompanyName}
                                </CardTitle>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => exportToExcel([...reports].filter(r => r.CompanyID === selectedCompany.CompanyID))}
                                    >
                                        <Download className="h-4 w-4 mr-1" />
                                        Export
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setBulkDownloadOpen(true)}
                                    >
                                        <Download className="h-4 w-4 mr-1" />
                                        Bulk
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <ScrollArea className="h-[calc(100vh-270px)]">
                            <Table>
                                <TableHeader>
                                    {renderTableHeader()}
                                </TableHeader>
                                <TableBody>
                                    {reports
                                        .filter(r => r.CompanyID === selectedCompany.CompanyID)
                                        .sort((a, b) => {
                                            const dateA = new Date(a.Year, a.Month - 1);
                                            const dateB = new Date(b.Year, b.Month - 1);
                                            return dateB.getTime() - dateA.getTime();
                                        })
                                        .map((report, index) => renderTableRow(report, index))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                        Select a company to view details
                    </div>
                )}
            </Card>
        </div>
    );
};
export default DetailedView;
