// @ts-nocheck

"use client"

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Download, MoreHorizontal, RefreshCw, Search, FolderOpen, ChevronDown, ChevronUp } from "lucide-react";
import * as ExcelJS from 'exceljs';
import FileViewer from '@/components/FileViewer';
import { Switch } from '@/components/ui/switch';
import ExcelViewer from './viewer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import JSZip from 'jszip';
import SummaryView from './SummaryView';
import DetailedView from './DetailedView';

interface ReportRecord {
    ID: number;
    Month: number;
    Year: number;
    CompanyID: number;
    CompanyName: string;
    // Statutory Documents - PDF
    PAYE_Link: string;
    NSSF_Link: string;
    NHIF_Link: string;
    SHIF_Link: string;
    Housing_Levy_Link: string;
    NITA_List: string;
    // Statutory Documents - Excel
    NSSF_Excel_Link: string;
    NHIF_Excel_Link: string;
    SHIF_Excel_Link: string;
    // Statutory Documents - CSV
    PAYE_CSV_Link: string;
    Housing_Levy_CSV_Link: string;
    // Payroll Documents
    Payroll_Summary_Link: string;
    Payroll_Summary_Excel_Link: string;
    Payroll_Recon_Link: string;
    Control_Total_Link: string;
    Payslips_Link: string;
    // Payment Lists
    Bank_List_Link: string;
    Cash_List: string;
    MPESA_List: string;
}


const getFileTypeFromUrl = (url: string): string => {
    if (!url) return 'pdf';
    const extension = url.split('.').pop()?.toLowerCase();
    const fileTypes = {
        xlsx: 'excel',
        xls: 'excel',
        csv: 'csv',
        pdf: 'pdf',
        zip: 'zip'
    };
    return fileTypes[extension] || 'pdf';
};

export default function WinguAppsExtractionReports() {
    // State Management
    const [reports, setReports] = useState<ReportRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selectedCompany, setSelectedCompany] = useState<ReportRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [companySearchTerm, setCompanySearchTerm] = useState('');
    const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);
    const [selectedDocs, setSelectedDocs] = useState({
        // Statutory Documents - PDF
        PAYE_PDF: false,
        NSSF_PDF: false,
        NHIF_PDF: false,
        SHIF_PDF: false,
        Housing_Levy_PDF: false,
        NITA_PDF: false,
        // Statutory Documents - Excel/CSV
        PAYE_CSV: false,
        Housing_Levy_CSV: false,
        NSSF_Excel: false,
        NHIF_Excel: false,
        SHIF_Excel: false,
        // Payroll Documents
        Payroll_Summary_PDF: false,
        Payroll_Summary_Excel: false,
        Payroll_Recon: false,
        Control_Total: false,
        Payslips: false,
        // Payment Lists
        Bank_List: false,
        Cash_List: false,
        MPESA_List: false
    });

    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState({
        Index: true,
        CompanyName: true,
        StatutoryDocs: true,
        PayrollDocs: true,
        PaymentLists: true,
    });

    const [columnVisibility, setColumnVisibility] = useState({
        statutory: true,
        payroll: true,
        payment: true
    });

    const [sortConfig, setSortConfig] = useState({
        key: '',
        direction: 'asc'
    });

    const handleSort = (column: string) => {
        setSortConfig(current => {
            if (current.key === column) {
                return {
                    key: column,
                    direction: current.direction === 'asc' ? 'desc' : 'asc'
                };
            }
            return {
                key: column,
                direction: 'asc'
            };
        });
    };

    // Data Fetching
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

    useEffect(() => {
        fetchReports();
    }, []);

    // Get latest month reports
    const latestReports = React.useMemo(() => {
        const sortedByDate = [...reports].sort((a, b) => {
            const dateA = new Date(a.Year, a.Month - 1);
            const dateB = new Date(b.Year, b.Month - 1);
            return dateB.getTime() - dateA.getTime();
        });

        const latestMonth = sortedByDate[0]?.Month;
        const latestYear = sortedByDate[0]?.Year;

        return sortedByDate.filter(
            report => report.Month === latestMonth && report.Year === latestYear
        );
    }, [reports]);

    // Sorting and Filtering
    // const handleSort = (column: string) => {
    //     setSortOrder(sortColumn === column ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc');
    //     setSortColumn(column);
    // };

    const sortedReports = React.useMemo(() => {
        if (!sortConfig.key) return reports;

        return [...reports].sort((a, b) => {
            if (!a[sortConfig.key] || !b[sortConfig.key]) return 0;

            const comparison = a[sortConfig.key].localeCompare(b[sortConfig.key]);
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [reports, sortConfig]);


    const filteredReports = React.useMemo(() => {
        return sortedReports.filter(report =>
            report.CompanyName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [sortedReports, searchTerm]);


    // Add a function to calculate total cells for colSpan
    const calculateTotalColumns = (showPeriod: boolean = false) => {
        let total = 2; // Index and Company Name
        if (showPeriod) total += 1; // Period column
        if (visibleColumns.StatutoryDocs) total += 11; // 6 PDF + 3 Excel + 2 CSV
        if (visibleColumns.PayrollDocs) total += 5;
        if (visibleColumns.PaymentLists) total += 3;
        return total;
    };

    const renderLoadingState = (showPeriod: boolean = false) => (
        <TableRow>
            <TableCell colSpan={calculateTotalColumns(showPeriod)} className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            </TableCell>
        </TableRow>
    );

    const renderNoDataState = (showPeriod: boolean = false) => (
        <TableRow>
            <TableCell colSpan={calculateTotalColumns(showPeriod)} className="text-center">
                No reports found
            </TableCell>
        </TableRow>
    );

    // Excel Export Functions
    const exportToExcel = async (reportData: ReportRecord[] = filteredReports) => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reports');

        // Define headers based on document groups
        const headers = [
            'Index',
            'Company Name',
            'Period',
            // Statutory Documents - PDF
            ...documentGroups.statutory_pdf.map(doc => doc.key.replace('_', ' ')),
            // Statutory Documents - Excel
            ...documentGroups.statutory_excel.map(doc => doc.key.replace('_', ' ')),
            // Statutory Documents - CSV
            ...documentGroups.statutory_csv.map(doc => doc.key.replace('_', ' ')),
            // Payroll Documents
            ...documentGroups.payroll.map(doc => doc.key.replace('_', ' ')),
            // Payment Lists
            ...documentGroups.payments.map(doc => doc.key.replace('_', ' '))
        ];

        // Add headers
        worksheet.addRow(headers);

        // Add data
        reportData.forEach((report, index) => {
            const row = [
                index + 1,
                report.CompanyName,
                `${report.Month}/${report.Year}`
            ];

            // Add data for each document group
            const addDocumentStatus = (doc) => {
                if (doc.pdfKey) row.push(report[doc.pdfKey] ? 'Available' : 'Missing');
                if (doc.dataKey) row.push(report[doc.dataKey] ? 'Available' : 'Missing');
            };

            documentGroups.statutory_pdf.forEach(addDocumentStatus);
            documentGroups.statutory_excel.forEach(addDocumentStatus);
            documentGroups.statutory_csv.forEach(addDocumentStatus);
            documentGroups.payroll.forEach(addDocumentStatus);
            documentGroups.payments.forEach(addDocumentStatus);

            worksheet.addRow(row);
        });

        // Style the worksheet
        worksheet.columns.forEach(column => {
            column.width = 15;
            column.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Generate and download file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'wingu_reports.xlsx';
        link.click();
    };
    const calculateColumnStats = (columnKey: string) => {
        const total = reports.length;
        const available = reports.filter(report => report[columnKey]).length;
        const missing = total - available;

        return {
            total,
            available,
            missing
        };
    };

    // Render file link with both PDF and Excel/CSV options
    const renderFileLink = (pdfLink: string, dataLink?: string) => {
        if (!pdfLink) return <div className="flex justify-center"><span className="text-red-500 text-sm font-bold text-center">Missing</span></div>;

        return (
            <div className="flex items-center justify-center space-x-2">
                <FileViewer url={pdfLink} fileType="pdf" title="View PDF" />
                {dataLink && (
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                        <Download className="h-4 w-4" />
                    </Button>
                )}
            </div>
        );
    };

    // Table Components
    const renderTableHeader = (showPeriod: boolean = false) => (
        <>
            {/* Main Header Row */}
            <TableRow className="bg-gray-100 border-b-2 border-black">
                <TableHead rowSpan={2} className="w-14 border-r border-gray-300">#</TableHead>
                <TableHead rowSpan={2} className="border-r border-gray-300">
                    <div
                        className="flex items-center space-x-2 cursor-pointer"
                        onClick={() => handleSort('CompanyName')}
                    >
                        <span>Company Name</span>
                        <ArrowUpDown className="h-4 w-4" />
                    </div>
                </TableHead>
                {showPeriod && <TableHead rowSpan={2} className="border-r border-gray-300">Period</TableHead>}

                {visibleColumns.StatutoryDocs && (
                    <TableHead
                        colSpan={11}
                        className="text-center font-bold bg-blue-50 border-x-2 border-black"
                    >
                        Statutory Documents
                    </TableHead>
                )}

                {visibleColumns.PayrollDocs && (
                    <TableHead
                        colSpan={5}
                        className="text-center font-bold bg-purple-50 border-x-2 border-black"
                    >
                        Payroll Documents
                    </TableHead>
                )}

                {visibleColumns.PaymentLists && (
                    <TableHead
                        colSpan={3}
                        className="text-center font-bold bg-orange-50 border-x-2 border-black"
                    >
                        Payment Lists
                    </TableHead>
                )}
            </TableRow>

            {/* Sub-header Row */}
            <TableRow className="bg-gray-50 border-b-2 border-black">
                {/* Statutory Documents Subgroups */}
                {visibleColumns.StatutoryDocs && (
                    <>
                        {/* PDF Files */}
                        <TableHead className="text-center border-r border-gray-300">PAYE Returns</TableHead>
                        <TableHead className="text-center border-r border-gray-300">NSSF Returns</TableHead>
                        <TableHead className="text-center border-r border-gray-300">NHIF Returns</TableHead>
                        <TableHead className="text-center border-r border-gray-300">SHIF Returns</TableHead>
                        <TableHead className="text-center border-r border-gray-300">Housing Levy Returns</TableHead>
                        <TableHead className="text-center border-r-2 border-black">NITA Returns</TableHead>

                        {/* Excel Files */}
                        <TableHead className="text-center border-r border-gray-300">NSSF Excel</TableHead>
                        <TableHead className="text-center border-r border-gray-300">NHIF Excel</TableHead>
                        <TableHead className="text-center border-r-2 border-black">SHIF Excel</TableHead>

                        {/* CSV Files */}
                        <TableHead className="text-center border-r border-gray-300">PAYE CSV</TableHead>
                        <TableHead className="text-center border-r-2 border-black">Housing Levy CSV</TableHead>
                    </>
                )}

                {/* Payroll Documents */}
                {visibleColumns.PayrollDocs && (
                    <>
                        <TableHead className="text-center border-r border-gray-300">Payroll Summary PDF</TableHead>
                        <TableHead className="text-center border-r border-gray-300">Payroll Summary Excel</TableHead>
                        <TableHead className="text-center border-r border-gray-300">Payroll Recon</TableHead>
                        <TableHead className="text-center border-r border-gray-300">Control Total</TableHead>
                        <TableHead className="text-center border-r-2 border-black">Payslips</TableHead>
                    </>
                )}

                {/* Payment Lists */}
                {visibleColumns.PaymentLists && (
                    <>
                        <TableHead className="text-center border-r border-gray-300">Bank List</TableHead>
                        <TableHead className="text-center border-r border-gray-300">Cash List</TableHead>
                        <TableHead className="text-center border-r-2 border-black">M-PESA List</TableHead>
                    </>
                )}
            </TableRow>

            {/* Total Documents Row */}
            <TableRow className="bg-blue-50 border-b border-gray-300">
                <TableHead colSpan={showPeriod ? 3 : 2} className="border-r-2 border-black font-bold">Total Documents</TableHead>
                {/* Statutory Documents - PDF */}
                {visibleColumns.StatutoryDocs && documentGroups.statutory_pdf.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-gray-300">
                        {calculateColumnStats(doc.pdfKey)?.total}
                    </TableHead>
                ))}
                {/* Statutory Documents - Excel */}
                {visibleColumns.StatutoryDocs && documentGroups.statutory_excel.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-gray-300">
                        {calculateColumnStats(doc.dataKey)?.total}
                    </TableHead>
                ))}
                {/* Statutory Documents - CSV */}
                {visibleColumns.StatutoryDocs && documentGroups.statutory_csv.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r-2 border-black">
                        {calculateColumnStats(doc.dataKey)?.total}
                    </TableHead>
                ))}
                {/* Payroll Documents */}
                {visibleColumns.PayrollDocs && documentGroups.payroll.map(doc => (
                    <React.Fragment key={doc.key}>
                        <TableHead className="text-center border-r border-gray-300">
                            {calculateColumnStats(doc.pdfKey)?.total}
                        </TableHead>
                        {doc.dataKey && (
                            <TableHead className="text-center border-r border-gray-300">
                                {calculateColumnStats(doc.dataKey)?.total}
                            </TableHead>
                        )}
                    </React.Fragment>
                ))}
                {/* Payment Lists */}
                {visibleColumns.PaymentLists && documentGroups.payments.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-gray-300">
                        {calculateColumnStats(doc.pdfKey)?.total}
                    </TableHead>
                ))}
            </TableRow>

            {/* Available Documents Row */}
            <TableRow className="bg-green-50 border-b border-gray-300">
                <TableHead colSpan={showPeriod ? 3 : 2} className="border-r-2 border-black font-bold">Available Documents</TableHead>
                {/* Statutory Documents - PDF */}
                {visibleColumns.StatutoryDocs && documentGroups.statutory_pdf.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-gray-300">
                        {calculateColumnStats(doc.pdfKey)?.available}
                    </TableHead>
                ))}
                {/* Statutory Documents - Excel */}
                {visibleColumns.StatutoryDocs && documentGroups.statutory_excel.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-gray-300">
                        {calculateColumnStats(doc.dataKey)?.available}
                    </TableHead>
                ))}
                {/* Statutory Documents - CSV */}
                {visibleColumns.StatutoryDocs && documentGroups.statutory_csv.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r-2 border-black">
                        {calculateColumnStats(doc.dataKey)?.available}
                    </TableHead>
                ))}
                {/* Payroll Documents */}
                {visibleColumns.PayrollDocs && documentGroups.payroll.map(doc => (
                    <React.Fragment key={doc.key}>
                        <TableHead className="text-center border-r border-gray-300">
                            {calculateColumnStats(doc.pdfKey)?.available}
                        </TableHead>
                        {doc.dataKey && (
                            <TableHead className="text-center border-r border-gray-300">
                                {calculateColumnStats(doc.dataKey)?.available}
                            </TableHead>
                        )}
                    </React.Fragment>
                ))}
                {/* Payment Lists */}
                {visibleColumns.PaymentLists && documentGroups.payments.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-gray-300">
                        {calculateColumnStats(doc.pdfKey)?.available}
                    </TableHead>
                ))}
            </TableRow>

            {/* Missing Documents Row */}
            <TableRow className="bg-red-50 border-b-2 border-black">
                <TableHead colSpan={showPeriod ? 3 : 2} className="border-r-2 border-black font-bold">Missing Documents</TableHead>
                {/* Statutory Documents - PDF */}
                {visibleColumns.StatutoryDocs && documentGroups.statutory_pdf.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-gray-300">
                        {calculateColumnStats(doc.pdfKey)?.missing}
                    </TableHead>
                ))}
                {/* Statutory Documents - Excel */}
                {visibleColumns.StatutoryDocs && documentGroups.statutory_excel.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-gray-300">
                        {calculateColumnStats(doc.dataKey)?.missing}
                    </TableHead>
                ))}
                {/* Statutory Documents - CSV */}
                {visibleColumns.StatutoryDocs && documentGroups.statutory_csv.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r-2 border-black">
                        {calculateColumnStats(doc.dataKey)?.missing}
                    </TableHead>
                ))}
                {/* Payroll Documents */}
                {visibleColumns.PayrollDocs && documentGroups.payroll.map(doc => (
                    <React.Fragment key={doc.key}>
                        <TableHead className="text-center border-r border-gray-300">
                            {calculateColumnStats(doc.pdfKey)?.missing}
                        </TableHead>
                        {doc.dataKey && (
                            <TableHead className="text-center border-r border-gray-300">
                                {calculateColumnStats(doc.dataKey)?.missing}
                            </TableHead>
                        )}
                    </React.Fragment>
                ))}
                {/* Payment Lists */}
                {visibleColumns.PaymentLists && documentGroups.payments.map(doc => (
                    <TableHead key={doc.key} className="text-center border-r border-gray-300">
                        {calculateColumnStats(doc.pdfKey)?.missing}
                    </TableHead>
                ))}
            </TableRow>
        </>
    );

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


    const renderTableRow = (report: ReportRecord, index: number, showPeriod: boolean = false) => {

        return (
            <TableRow key={report.ID} className="hover:bg-gray-50">
                {/* Basic Info Cells */}
                <TableCell className="font-medium border-r border-gray-300">{index + 1}</TableCell>
                <TableCell className="border-r border-gray-300">{report.CompanyName}</TableCell>
                {showPeriod && <TableCell className="border-r border-gray-300">{`${report.Month}/${report.Year}`}</TableCell>}

                {/* Statutory Documents Section */}
                {visibleColumns.StatutoryDocs && (
                    <>
                        {/* Statutory PDF Documents */}
                        {documentGroups.statutory_pdf.map(doc => (
                            <TableCell key={doc.key} className="border-r border-gray-300">
                                <FileViewer
                                    url={report[doc.pdfKey]}
                                    fileType={getFileTypeFromUrl(report[doc.pdfKey])}
                                    title={`${doc.key.replace('_', ' ')} - ${report.CompanyName}`}
                                />
                            </TableCell>
                        ))}

                        {/* Statutory Excel Documents */}
                        {documentGroups.statutory_excel.map(doc => (
                            <TableCell key={doc.key} className="border-r border-gray-300">
                                <FileViewer
                                    url={report[doc.dataKey]}
                                    fileType={getFileTypeFromUrl(report[doc.dataKey])}
                                    title={`${doc.key.replace('_', ' ')} - ${report.CompanyName}`}
                                />
                            </TableCell>
                        ))}

                        {/* Statutory CSV Documents */}
                        {documentGroups.statutory_csv.map(doc => (
                            <TableCell key={doc.key} className="border-r-2 border-black">
                                <FileViewer
                                    url={report[doc.dataKey]}
                                    fileType={getFileTypeFromUrl(report[doc.dataKey])}
                                    title={`${doc.key.replace('_', ' ')} - ${report.CompanyName}`}
                                />
                            </TableCell>
                        ))}
                    </>
                )}

                {/* Payroll Documents Section */}
                {visibleColumns.PayrollDocs && (
                    <>
                        {documentGroups.payroll.map(doc => (
                            <React.Fragment key={doc.key}>
                                <TableCell className="border-r border-gray-300">
                                    <FileViewer
                                        url={report[doc.pdfKey]}
                                        fileType={getFileTypeFromUrl(report[doc.pdfKey])}
                                        title={`${doc.key.replace('_', ' ')} - ${report.CompanyName}`}
                                    />
                                </TableCell>
                                {doc.dataKey && (
                                    <TableCell className="border-r border-gray-300">
                                        <FileViewer
                                            url={report[doc.dataKey]}
                                            fileType={getFileTypeFromUrl(report[doc.dataKey])}
                                            title={`${doc.key.replace('_', ' ')} Excel - ${report.CompanyName}`}
                                        />
                                    </TableCell>
                                )}
                            </React.Fragment>
                        ))}
                    </>
                )}

                {/* Payment Lists Section */}
                {visibleColumns.PaymentLists && (
                    <>
                        {documentGroups.payments.map(doc => (
                            <TableCell key={doc.key} className="border-r-2 border-black">
                                <FileViewer
                                    url={report[doc.pdfKey]}
                                    fileType={getFileTypeFromUrl(report[doc.pdfKey])}
                                    title={`${doc.key.replace('_', ' ')} - ${report.CompanyName}`}
                                />
                            </TableCell>
                        ))}
                    </>
                )}
            </TableRow>

        );
    };


    const handleBulkDownload = async () => {
        const selectedFiles = [];
        
        // Map selected documents to their corresponding URLs from reports
        for (const report of filteredReports) {
            if (selectedDocs.PAYE_PDF && report.PAYE_Link) selectedFiles.push({ url: report.PAYE_Link, name: `PAYE_${report.CompanyName}.pdf` });
            if (selectedDocs.NSSF_PDF && report.NSSF_Link) selectedFiles.push({ url: report.NSSF_Link, name: `NSSF_${report.CompanyName}.pdf` });
            if (selectedDocs.NHIF_PDF && report.NHIF_Link) selectedFiles.push({ url: report.NHIF_Link, name: `NHIF_${report.CompanyName}.pdf` });
            if (selectedDocs.SHIF_PDF && report.SHIF_Link) selectedFiles.push({ url: report.SHIF_Link, name: `SHIF_${report.CompanyName}.pdf` });
            if (selectedDocs.Housing_Levy_PDF && report.Housing_Levy_Link) selectedFiles.push({ url: report.Housing_Levy_Link, name: `Housing_Levy_${report.CompanyName}.pdf` });
            if (selectedDocs.NITA_PDF && report.NITA_List) selectedFiles.push({ url: report.NITA_List, name: `NITA_${report.CompanyName}.pdf` });
            
            // Excel and CSV files
            if (selectedDocs.PAYE_CSV && report.PAYE_CSV_Link) selectedFiles.push({ url: report.PAYE_CSV_Link, name: `PAYE_${report.CompanyName}.csv` });
            if (selectedDocs.Housing_Levy_CSV && report.Housing_Levy_CSV_Link) selectedFiles.push({ url: report.Housing_Levy_CSV_Link, name: `Housing_Levy_${report.CompanyName}.csv` });
            if (selectedDocs.NSSF_Excel && report.NSSF_Excel_Link) selectedFiles.push({ url: report.NSSF_Excel_Link, name: `NSSF_${report.CompanyName}.xlsx` });
            if (selectedDocs.NHIF_Excel && report.NHIF_Excel_Link) selectedFiles.push({ url: report.NHIF_Excel_Link, name: `NHIF_${report.CompanyName}.xlsx` });
            if (selectedDocs.SHIF_Excel && report.SHIF_Excel_Link) selectedFiles.push({ url: report.SHIF_Excel_Link, name: `SHIF_${report.CompanyName}.xlsx` });
            
            // Payroll Documents
            if (selectedDocs.Payroll_Summary_PDF && report.Payroll_Summary_Link) selectedFiles.push({ url: report.Payroll_Summary_Link, name: `Payroll_Summary_${report.CompanyName}.pdf` });
            if (selectedDocs.Payroll_Summary_Excel && report.Payroll_Summary_Excel_Link) selectedFiles.push({ url: report.Payroll_Summary_Excel_Link, name: `Payroll_Summary_${report.CompanyName}.xlsx` });
            if (selectedDocs.Payroll_Recon && report.Payroll_Recon_Link) selectedFiles.push({ url: report.Payroll_Recon_Link, name: `Payroll_Recon_${report.CompanyName}.pdf` });
            if (selectedDocs.Control_Total && report.Control_Total_Link) selectedFiles.push({ url: report.Control_Total_Link, name: `Control_Total_${report.CompanyName}.pdf` });
            if (selectedDocs.Payslips && report.Payslips_Link) selectedFiles.push({ url: report.Payslips_Link, name: `Payslips_${report.CompanyName}.pdf` });
            
            // Payment Lists
            if (selectedDocs.Bank_List && report.Bank_List_Link) selectedFiles.push({ url: report.Bank_List_Link, name: `Bank_List_${report.CompanyName}.pdf` });
            if (selectedDocs.Cash_List && report.Cash_List) selectedFiles.push({ url: report.Cash_List, name: `Cash_List_${report.CompanyName}.pdf` });
            if (selectedDocs.MPESA_List && report.MPESA_List) selectedFiles.push({ url: report.MPESA_List, name: `MPESA_List_${report.CompanyName}.pdf` });
        }

        if (selectedFiles.length === 0) {
            alert('Please select at least one document to download');
            return;
        }

        // Create a loading state
        setIsLoading(true);

        try {
            // Download files in chunks to prevent overwhelming the browser
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

            // Generate and download zip file
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

    return (
        <div className="p-4">
            <Tabs defaultValue="summary" className="w-full space-y-6">
                <TabsList className="grid w-[400px] grid-cols-2">
                    <TabsTrigger value="summary">Monthly View</TabsTrigger>
                    <TabsTrigger value="detailed">All Months </TabsTrigger>
                </TabsList>

                {/* <ExcelViewer/> */}

                <TabsContent value="summary">
                    <SummaryView
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        visibleColumns={visibleColumns}
                        setVisibleColumns={setVisibleColumns}
                        latestReports={latestReports}
                        isLoading={isLoading}
                        fetchReports={fetchReports}
                        sortConfig={sortConfig}
                        renderTableHeader={renderTableHeader}
                        renderTableRow={renderTableRow}
                        exportToExcel={exportToExcel}
                        setBulkDownloadOpen={setBulkDownloadOpen}
                    />
                </TabsContent>

                {/* Detailed View */}
                <TabsContent value="detailed">
                    <DetailedView 
                        reports={reports}
                        exportToExcel={exportToExcel}
                        setBulkDownloadOpen={setBulkDownloadOpen}
                        documentGroups={documentGroups}
                    />
                </TabsContent>

            </Tabs>
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
                            <Button variant="outline" onClick={() => setBulkDownloadOpen(false)}>Cancel</Button>
                            <Button 
                                onClick={handleBulkDownload}
                                disabled={isLoading}
                            >
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
        </div>
    );
}
