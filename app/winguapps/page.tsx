// WinguAppsExtractionReports.tsx
"use client"

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Download, MoreHorizontal, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import * as ExcelJS from 'exceljs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import JSZip from 'jszip';
import { cn } from "@/lib/utils";

// Types and Interfaces
interface ReportRecord {
    ID: number;
    Month: number;
    Year: number;
    CompanyID: number;
    CompanyName: string;
    PAYE_Link: string;
    NSSF_Link: string;
    NHIF_Link: string;
    SHIF_Link: string;
    Housing_Levy_Link: string;
    NITA_List: string;
    NSSF_Excel_Link: string;
    NHIF_Excel_Link: string;
    SHIF_Excel_Link: string;
    PAYE_CSV_Link: string;
    Housing_Levy_CSV_Link: string;
    Payroll_Summary_Link: string;
    Payroll_Summary_Excel_Link: string;
    Payroll_Recon_Link: string;
    Control_Total_Link: string;
    Payslips_Link: string;
    Bank_List_Link: string;
    Cash_List: string;
    MPESA_List: string;
}

// Document Viewer Component
interface DocumentViewerProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title: string;
    fileType: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
    isOpen,
    onClose,
    url,
    title,
    fileType
}) => {
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[80vh]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 h-full">
                    {fileType === 'pdf' ? (
                        <iframe src={url} className="w-full h-full" />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <a
                                href={url}
                                download
                                className="text-blue-600 hover:text-blue-800 underline"
                            >
                                Download {fileType.toUpperCase()} File
                            </a>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Document Groups Configuration
const documentGroups = {
    statutory_pdf: [
        { key: 'PAYE_PDF', pdfKey: 'PAYE_Link' },
        { key: 'NSSF_PDF', pdfKey: 'NSSF_Link' },
        { key: 'NHIF_PDF', pdfKey: 'NHIF_Link' },
        { key: 'SHIF_PDF', pdfKey: 'SHIF_Link' },
        { key: 'Housing_Levy_PDF', pdfKey: 'Housing_Levy_Link' },
        { key: 'NITA_PDF', pdfKey: 'NITA_List' }
    ],
    statutory_excel: [
        { key: 'NSSF_Excel', dataKey: 'NSSF_Excel_Link' },
        { key: 'NHIF_Excel', dataKey: 'NHIF_Excel_Link' },
        { key: 'SHIF_Excel', dataKey: 'SHIF_Excel_Link' }
    ],
    statutory_csv: [
        { key: 'PAYE_CSV', dataKey: 'PAYE_CSV_Link' },
        { key: 'Housing_Levy_CSV', dataKey: 'Housing_Levy_CSV_Link' }
    ],
    payroll: [
        { key: 'Payroll_Summary', pdfKey: 'Payroll_Summary_Link', dataKey: 'Payroll_Summary_Excel_Link' },
        { key: 'Payroll_Recon', pdfKey: 'Payroll_Recon_Link' },
        { key: 'Control_Total', pdfKey: 'Control_Total_Link' },
        { key: 'Payslips', pdfKey: 'Payslips_Link' }
    ],
    payments: [
        { key: 'Bank_List', pdfKey: 'Bank_List_Link' },
        { key: 'Cash_List', pdfKey: 'Cash_List' },
        { key: 'MPESA_List', pdfKey: 'MPESA_List' }
    ]
};

// Styles
const tableStyles = {
    cell: "py-1.5 px-2 text-xs",
    header: "py-1.5 px-2 text-xs font-medium bg-gray-50",
    button: "px-2 py-1 text-xs rounded",
};

const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Main Component
export default function WinguAppsExtractionReports() {
    // State Management
    const [reports, setReports] = useState<ReportRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<ReportRecord | null>(null);
    const [viewerConfig, setViewerConfig] = useState({
        isOpen: false,
        url: '',
        title: '',
        fileType: ''
    });
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return {
            month: now.getMonth() + 1,
            year: now.getFullYear()
        };
    });
    const [visibleColumns, setVisibleColumns] = useState({
        StatutoryDocs: true,
        PayrollDocs: true,
        PaymentLists: true,
    });
    const [selectedDocs, setSelectedDocs] = useState({
        PAYE_PDF: false,
        NSSF_PDF: false,
        NHIF_PDF: false,
        SHIF_PDF: false,
        Housing_Levy_PDF: false,
        NITA_PDF: false,
        PAYE_CSV: false,
        Housing_Levy_CSV: false,
        NSSF_Excel: false,
        NHIF_Excel: false,
        SHIF_Excel: false,
        Payroll_Summary_PDF: false,
        Payroll_Summary_Excel: false,
        Payroll_Recon: false,
        Control_Total: false,
        Payslips: false,
        Bank_List: false,
        Cash_List: false,
        MPESA_List: false
    });

    // Effects
    useEffect(() => {
        fetchReports();
    }, []);

    // Functions
    const fetchReports = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/winguAppsReports');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setReports(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching reports:', error);
            setReports([]);
        } finally {
            setIsLoading(false);
        }
    };

    const openDocument = (url: string, title: string, fileType: string) => {
        setViewerConfig({
            isOpen: true,
            url,
            title,
            fileType
        });
    };

    const handleDateChange = (type: 'month' | 'year', value: number) => {
        setSelectedDate(prev => ({
            ...prev,
            [type]: value
        }));
    };

    const handlePreviousMonth = () => {
        setSelectedDate(prev => {
            if (prev.month === 1) {
                return { month: 12, year: prev.year - 1 };
            }
            return { month: prev.month - 1, year: prev.year };
        });
    };

    const handleNextMonth = () => {
        setSelectedDate(prev => {
            if (prev.month === 12) {
                return { month: 1, year: prev.year + 1 };
            }
            return { month: prev.month + 1, year: prev.year };
        });
    };

    const handleBulkDownload = async () => {
        const selectedFiles = [];

        // Get the reports to process (either selected company or all filtered reports)
        const reportsToProcess = selectedCompany
            ? reports.filter(r => r.CompanyID === selectedCompany.CompanyID)
            : filteredReports;

        // Map selected documents to their corresponding URLs from reports
        for (const report of reportsToProcess) {
            if (selectedDocs.PAYE_PDF && report.PAYE_Link) {
                selectedFiles.push({ url: report.PAYE_Link, name: `PAYE_${report.CompanyName}.pdf` });
            }
            if (selectedDocs.NSSF_PDF && report.NSSF_Link) {
                selectedFiles.push({ url: report.NSSF_Link, name: `NSSF_${report.CompanyName}.pdf` });
            }
            if (selectedDocs.NHIF_PDF && report.NHIF_Link) {
                selectedFiles.push({ url: report.NHIF_Link, name: `NHIF_${report.CompanyName}.pdf` });
            }
            if (selectedDocs.SHIF_PDF && report.SHIF_Link) {
                selectedFiles.push({ url: report.SHIF_Link, name: `SHIF_${report.CompanyName}.pdf` });
            }
            if (selectedDocs.Housing_Levy_PDF && report.Housing_Levy_Link) {
                selectedFiles.push({ url: report.Housing_Levy_Link, name: `Housing_Levy_${report.CompanyName}.pdf` });
            }
            if (selectedDocs.NITA_PDF && report.NITA_List) {
                selectedFiles.push({ url: report.NITA_List, name: `NITA_${report.CompanyName}.pdf` });
            }

            // Excel and CSV files
            if (selectedDocs.PAYE_CSV && report.PAYE_CSV_Link) {
                selectedFiles.push({ url: report.PAYE_CSV_Link, name: `PAYE_${report.CompanyName}.csv` });
            }
            if (selectedDocs.Housing_Levy_CSV && report.Housing_Levy_CSV_Link) {
                selectedFiles.push({ url: report.Housing_Levy_CSV_Link, name: `Housing_Levy_${report.CompanyName}.csv` });
            }
            if (selectedDocs.NSSF_Excel && report.NSSF_Excel_Link) {
                selectedFiles.push({ url: report.NSSF_Excel_Link, name: `NSSF_${report.CompanyName}.xlsx` });
            }
            if (selectedDocs.NHIF_Excel && report.NHIF_Excel_Link) {
                selectedFiles.push({ url: report.NHIF_Excel_Link, name: `NHIF_${report.CompanyName}.xlsx` });
            }
            if (selectedDocs.SHIF_Excel && report.SHIF_Excel_Link) {
                selectedFiles.push({ url: report.SHIF_Excel_Link, name: `SHIF_${report.CompanyName}.xlsx` });
            }

            // Payroll Documents
            if (selectedDocs.Payroll_Summary_PDF && report.Payroll_Summary_Link) {
                selectedFiles.push({ url: report.Payroll_Summary_Link, name: `Payroll_Summary_${report.CompanyName}.pdf` });
            }
            if (selectedDocs.Payroll_Summary_Excel && report.Payroll_Summary_Excel_Link) {
                selectedFiles.push({ url: report.Payroll_Summary_Excel_Link, name: `Payroll_Summary_${report.CompanyName}.xlsx` });
            }
            if (selectedDocs.Payroll_Recon && report.Payroll_Recon_Link) {
                selectedFiles.push({ url: report.Payroll_Recon_Link, name: `Payroll_Recon_${report.CompanyName}.pdf` });
            }
            if (selectedDocs.Control_Total && report.Control_Total_Link) {
                selectedFiles.push({ url: report.Control_Total_Link, name: `Control_Total_${report.CompanyName}.pdf` });
            }
            if (selectedDocs.Payslips && report.Payslips_Link) {
                selectedFiles.push({ url: report.Payslips_Link, name: `Payslips_${report.CompanyName}.pdf` });
            }

            // Payment Lists
            if (selectedDocs.Bank_List && report.Bank_List_Link) {
                selectedFiles.push({ url: report.Bank_List_Link, name: `Bank_List_${report.CompanyName}.pdf` });
            }
            if (selectedDocs.Cash_List && report.Cash_List) {
                selectedFiles.push({ url: report.Cash_List, name: `Cash_List_${report.CompanyName}.pdf` });
            }
            if (selectedDocs.MPESA_List && report.MPESA_List) {
                selectedFiles.push({ url: report.MPESA_List, name: `MPESA_List_${report.CompanyName}.pdf` });
            }
        }

        if (selectedFiles.length === 0) {
            alert('Please select at least one document to download');
            return;
        }

        setIsLoading(true);

        try {
            const chunkSize = 5;
            const zip = new JSZip();

            for (let i = 0; i < selectedFiles.length; i += chunkSize) {
                const chunk = selectedFiles.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (file) => {
                    try {
                        const response = await fetch(file.url);
                        const blob = await response.blob();
                        zip.file(file.name, blob);
                    } catch (error) {
                        console.error(`Error downloading ${file.name}:`, error);
                    }
                }));
            }

            const content = await zip.generateAsync({ type: "blob" });
            const downloadUrl = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `bulk_download_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Error in bulk download:', error);
            alert('Error downloading files. Please try again.');
        } finally {
            setIsLoading(false);
            setBulkDownloadOpen(false);
        }
    };

    // Filtered Reports
    const filteredReports = React.useMemo(() => {
        return reports.filter(report =>
            report.CompanyName.toLowerCase().includes(searchTerm.toLowerCase()) &&
            report.Month === selectedDate.month &&
            report.Year === selectedDate.year
        );
    }, [reports, searchTerm, selectedDate]);

    // Render Functions
    const renderTableHeader = () => (
        <TableRow className="border-b">
            <TableHead className={cn(tableStyles.header, "w-12")}>#</TableHead>
            <TableHead className={cn(tableStyles.header, "w-48")}>Company</TableHead>
            {visibleColumns.StatutoryDocs && (
                <>
                    <TableHead className={tableStyles.header} colSpan={6}>Statutory Documents</TableHead>
                    <TableHead className={tableStyles.header} colSpan={3}>Excel Files</TableHead>
                    <TableHead className={tableStyles.header} colSpan={2}>CSV Files</TableHead>
                </>
            )}
            {visibleColumns.PayrollDocs && (
                <TableHead className={tableStyles.header} colSpan={5}>Payroll Documents</TableHead>
            )}
            {visibleColumns.PaymentLists && (
                <TableHead className={tableStyles.header} colSpan={3}>Payment Lists</TableHead>
            )}
        </TableRow>
    );

    const renderTableRow = (report: ReportRecord, index: number) => (
        <TableRow
            key={`${report.CompanyID}-${report.Month}-${report.Year}`}
            className="hover:bg-gray-50 transition-colors"
        >
            <TableCell className={tableStyles.cell}>{index + 1}</TableCell>
            <TableCell className={tableStyles.cell}>{report.CompanyName}</TableCell>

            {/* Statutory Documents - PDF */}
            {visibleColumns.StatutoryDocs && documentGroups.statutory_pdf.map(({ key, pdfKey }) => (
                <TableCell key={key} className={cn(tableStyles.cell, "text-center")}>
                    {!report[pdfKey] || report[pdfKey].trim() === '' ? (
                        <span className="text-red-500 text-xs">Missing</span>
                    ) : (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDocument(report[pdfKey], `${key.replace('_PDF', '')} - ${report.CompanyName}`, 'pdf')}
                            className="h-7 px-2 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100"
                        >
                            View
                        </Button>
                    )}
                </TableCell>
            ))}

            {/* Statutory Documents - Excel */}
            {visibleColumns.StatutoryDocs && documentGroups.statutory_excel.map(({ key, dataKey }) => (
                <TableCell key={key} className={cn(tableStyles.cell, "text-center")}>
                    {!report[dataKey] || report[dataKey].trim() === '' ? (
                        <span className="text-red-500 text-xs">Missing</span>
                    ) : (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDocument(report[dataKey], `${key.replace('_Excel', '')} - ${report.CompanyName}`, 'excel')}
                            className="h-7 px-2 text-xs text-green-600 bg-green-50 hover:bg-green-100"
                        >
                            Excel
                        </Button>
                    )}
                </TableCell>
            ))}

            {/* Statutory Documents - CSV */}
            {visibleColumns.StatutoryDocs && documentGroups.statutory_csv.map(({ key, dataKey }) => (
                <TableCell key={key} className={cn(tableStyles.cell, "text-center")}>
                    {!report[dataKey] || report[dataKey].trim() === '' ? (
                        <span className="text-red-500 text-xs">Missing</span>
                    ) : (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDocument(report[dataKey], `${key.replace('_CSV', '')} - ${report.CompanyName}`, 'csv')}
                            className="h-7 px-2 text-xs text-orange-600 bg-orange-50 hover:bg-orange-100"
                        >
                            CSV
                        </Button>
                    )}
                </TableCell>
            ))}

            {/* Payroll Documents */}
            {visibleColumns.PayrollDocs && documentGroups.payroll.map(({ key, pdfKey, dataKey }) => (
                <TableCell key={key} className={cn(tableStyles.cell, "text-center")}>
                    <div className="flex flex-col gap-1 items-center">
                        {!report[pdfKey] || report[pdfKey].trim() === '' ? (
                            <span className="text-red-500 text-xs">Missing</span>
                        ) : (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openDocument(report[pdfKey], `${key} PDF - ${report.CompanyName}`, 'pdf')}
                                className="h-7 px-2 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100"
                            >
                                View
                            </Button>
                        )}
                        {dataKey && (!report[dataKey] || report[dataKey].trim() === '' ? (
                            <span className="text-red-500 text-xs">Missing</span>
                        ) : (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openDocument(report[dataKey], `${key} Excel - ${report.CompanyName}`, 'excel')}
                                className="h-7 px-2 text-xs text-green-600 bg-green-50 hover:bg-green-100"
                            >
                                Excel
                            </Button>
                        ))}
                    </div>
                </TableCell>
            ))}

            {/* Payment Lists */}
            {visibleColumns.PaymentLists && documentGroups.payments.map(({ key, pdfKey }) => (
                <TableCell key={key} className={cn(tableStyles.cell, "text-center")}>
                    {!report[pdfKey] || report[pdfKey].trim() === '' ? (
                        <span className="text-red-500 text-xs">Missing</span>
                    ) : (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDocument(report[pdfKey], `${key} - ${report.CompanyName}`, 'pdf')}
                            className="h-7 px-2 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100"
                        >
                            View
                        </Button>
                    )}
                </TableCell>
            ))}
        </TableRow>
    );

    return (
        <div className="p-4">
            <Tabs defaultValue="summary" className="w-full space-y-4">
                <TabsList className="grid w-[400px] grid-cols-2">
                    <TabsTrigger value="summary">Monthly View</TabsTrigger>
                    <TabsTrigger value="detailed">All Months</TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                    <div className="space-y-4">
                        {/* Date Navigation and Search */}
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="relative w-[300px]">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="Search companies..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <select
                                            value={selectedDate.month}
                                            onChange={(e) => handleDateChange('month', parseInt(e.target.value))}
                                            className="text-sm border rounded px-2 py-1"
                                        >
                                            {monthNames.map((month, index) => (
                                                <option key={month} value={index + 1}>
                                                    {month}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            value={selectedDate.year}
                                            onChange={(e) => handleDateChange('year', parseInt(e.target.value))}
                                            className="text-sm border rounded px-2 py-1"
                                        >
                                            {Array.from({ length: 5 }, (_, i) =>
                                                selectedDate.year - 2 + i
                                            ).map(year => (
                                                <option key={year} value={year}>
                                                    {year}
                                                </option>
                                            ))}
                                        </select>
                                        <Button variant="outline" size="sm" onClick={handleNextMonth}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm">
                                        <Download className="h-4 w-4 mr-2" />
                                        Export
                                    </Button>
                                    <Button variant="outline" size="sm">
                                        <Download className="h-4 w-4 mr-2" />
                                        Bulk Download
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={fetchReports} disabled={isLoading}>
                                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Table */}
                        <Card className="overflow-hidden">
                            <ScrollArea className="h-[calc(100vh-280px)]">
                                <Table>
                                    <TableHeader>
                                        {renderTableHeader()}
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={20}
                                                    className="h-24 text-center"
                                                >
                                                    <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredReports.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={20}
                                                    className="h-24 text-center text-gray-500"
                                                >
                                                    No reports found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredReports.map((report, index) => (
                                                <TableRow
                                                    key={`${report.CompanyID}-${report.Month}-${report.Year}`}
                                                    className="hover:bg-gray-50/50"
                                                >
                                                    <TableCell className={tableStyles.cell}>
                                                        {index + 1}
                                                    </TableCell>
                                                    <TableCell className={tableStyles.cell}>
                                                        {report.CompanyName}
                                                    </TableCell>

                                                    {/* Statutory Documents - PDF */}
                                                    {visibleColumns.StatutoryDocs && documentGroups.statutory_pdf.map(({ key, pdfKey }) => (
                                                        <TableCell key={key} className={cn(tableStyles.cell, "text-center")}>
                                                            {!report[pdfKey] || report[pdfKey].trim() === '' ? (
                                                                <span className="text-red-500 text-[11px] font-medium">Missing</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => openDocument(report[pdfKey], `${key.replace('_PDF', '')} - ${report.CompanyName}`, 'pdf')}
                                                                    className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors duration-150 ease-in-out"
                                                                >
                                                                    View
                                                                </button>
                                                            )}
                                                        </TableCell>
                                                    ))}

                                                    {/* Statutory Documents - Excel */}
                                                    {visibleColumns.StatutoryDocs && documentGroups.statutory_excel.map(({ key, dataKey }) => (
                                                        <TableCell key={key} className={cn(tableStyles.cell, "text-center")}>
                                                            {!report[dataKey] || report[dataKey].trim() === '' ? (
                                                                <span className="text-red-500 text-[11px] font-medium">Missing</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => openDocument(report[dataKey], `${key.replace('_Excel', '')} - ${report.CompanyName}`, 'excel')}
                                                                    className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors duration-150 ease-in-out"
                                                                >
                                                                    Excel
                                                                </button>
                                                            )}
                                                        </TableCell>
                                                    ))}

                                                    {/* Statutory Documents - CSV */}
                                                    {visibleColumns.StatutoryDocs && documentGroups.statutory_csv.map(({ key, dataKey }) => (
                                                        <TableCell key={key} className={cn(tableStyles.cell, "text-center")}>
                                                            {!report[dataKey] || report[dataKey].trim() === '' ? (
                                                                <span className="text-red-500 text-[11px] font-medium">Missing</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => openDocument(report[dataKey], `${key.replace('_CSV', '')} - ${report.CompanyName}`, 'csv')}
                                                                    className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-orange-700 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors duration-150 ease-in-out"
                                                                >
                                                                    CSV
                                                                </button>
                                                            )}
                                                        </TableCell>
                                                    ))}

                                                    {/* Payroll Documents */}
                                                    {visibleColumns.PayrollDocs && documentGroups.payroll.map(({ key, pdfKey, dataKey }) => (
                                                        <TableCell key={key} className={cn(tableStyles.cell, "text-center")}>
                                                            <div className="flex flex-col gap-1 items-center">
                                                                {!report[pdfKey] || report[pdfKey].trim() === '' ? (
                                                                    <span className="text-red-500 text-[11px] font-medium">Missing</span>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => openDocument(report[pdfKey], `${key} PDF - ${report.CompanyName}`, 'pdf')}
                                                                        className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors duration-150 ease-in-out"
                                                                    >
                                                                        View
                                                                    </button>
                                                                )}
                                                                {dataKey && (!report[dataKey] || report[dataKey].trim() === '' ? (
                                                                    <span className="text-red-500 text-[11px] font-medium">Missing</span>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => openDocument(report[dataKey], `${key} Excel - ${report.CompanyName}`, 'excel')}
                                                                        className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors duration-150 ease-in-out"
                                                                    >
                                                                        Excel
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                    ))}

                                                    {/* Payment Lists */}
                                                    {visibleColumns.PaymentLists && documentGroups.payments.map(({ key, pdfKey }) => (
                                                        <TableCell key={key} className={cn(tableStyles.cell, "text-center")}>
                                                            {!report[pdfKey] || report[pdfKey].trim() === '' ? (
                                                                <span className="text-red-500 text-[11px] font-medium">Missing</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => openDocument(report[pdfKey], `${key} - ${report.CompanyName}`, 'pdf')}
                                                                    className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors duration-150 ease-in-out"
                                                                >
                                                                    View
                                                                </button>
                                                            )}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </Card>
                    </div>
                </TabsContent>
        
                <TabsContent value="detailed">
                    <div className="grid grid-cols-[250px_1fr] gap-4">
                        {/* Left Panel - Company List */}
                        <Card className="h-[calc(100vh-180px)]">
                            <CardHeader className="p-3">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                                    <Input
                                        placeholder="Search companies..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>
                            </CardHeader>
                            <ScrollArea className="h-[calc(100vh-240px)]">
                                <div className="space-y-0.5 p-2">
                                    {/* Company List */}
                                    {Array.from(new Set(reports.map(r => r.CompanyID))).map(companyId => {
                                        const company = reports.find(r => r.CompanyID === companyId);
                                        return (
                                            <button
                                                key={companyId}
                                                onClick={() => setSelectedCompany(company)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 rounded-md transition-all",
                                                    selectedCompany?.CompanyID === companyId
                                                        ? "bg-blue-100 text-blue-900"
                                                        : "hover:bg-gray-50"
                                                )}
                                            >
                                                <span className="text-sm font-medium">{company?.CompanyName}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </Card>

                        {/* Right Panel - Detailed View */}
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
                                                    onClick={() => exportToExcel(reports.filter(r => r.CompanyID === selectedCompany.CompanyID))}
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
                </TabsContent>
            </Tabs>

            {/* Bulk Download Dialog */}
            <Dialog open={bulkDownloadOpen} onOpenChange={setBulkDownloadOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Select Documents to Download</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-3 gap-4">
                            {/* Statutory Documents - PDF */}
                            <div className="space-y-4">
                                <h3 className="font-semibold">Statutory Documents (PDF)</h3>
                                {['PAYE_PDF', 'NSSF_PDF', 'NHIF_PDF', 'SHIF_PDF', 'Housing_Levy_PDF', 'NITA_PDF'].map(key => (
                                    <div key={key} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={key}
                                            checked={selectedDocs[key]}
                                            onCheckedChange={(checked) =>
                                                setSelectedDocs(prev => ({ ...prev, [key]: checked as boolean }))
                                            }
                                        />
                                        <Label htmlFor={key}>{key.replace(/_/g, ' ')}</Label>
                                    </div>
                                ))}
                            </div>

                            {/* Excel and CSV Files */}
                            <div className="space-y-4">
                                <h3 className="font-semibold">Excel & CSV Files</h3>
                                {['PAYE_CSV', 'Housing_Levy_CSV', 'NSSF_Excel', 'NHIF_Excel', 'SHIF_Excel'].map(key => (
                                    <div key={key} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={key}
                                            checked={selectedDocs[key]}
                                            onCheckedChange={(checked) =>
                                                setSelectedDocs(prev => ({ ...prev, [key]: checked as boolean }))
                                            }
                                        />
                                        <Label htmlFor={key}>{key.replace(/_/g, ' ')}</Label>
                                    </div>
                                ))}
                            </div>

                            {/* Payroll & Payment Documents */}
                            <div className="space-y-4">
                                <h3 className="font-semibold">Payroll & Payment Documents</h3>
                                {['Payroll_Summary_PDF', 'Payroll_Summary_Excel', 'Payroll_Recon', 'Control_Total', 'Payslips', 'Bank_List', 'Cash_List', 'MPESA_List'].map(key => (
                                    <div key={key} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={key}
                                            checked={selectedDocs[key]}
                                            onCheckedChange={(checked) =>
                                                setSelectedDocs(prev => ({ ...prev, [key]: checked as boolean }))
                                            }
                                        />
                                        <Label htmlFor={key}>{key.replace(/_/g, ' ')}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setBulkDownloadOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleBulkDownload} disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Downloading...
                                    </>
                                ) : (
                                    <>
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Selected
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Document Viewer */}
            <DocumentViewer
                isOpen={viewerConfig.isOpen}
                onClose={() => setViewerConfig(prev => ({ ...prev, isOpen: false }))}
                url={viewerConfig.url}
                title={viewerConfig.title}
                fileType={viewerConfig.fileType}
            />
        </div>
    );
}