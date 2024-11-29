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
        // Add console logging here at the start of the function
        console.log('Document Links for', report.CompanyName, {
            // Statutory Documents
            PAYE: {
                pdf: report.PAYE_Link,
                csv: report.PAYE_CSV_Link
            },
            NSSF: {
                pdf: report.NSSF_Link,
                excel: report.NSSF_Excel_Link
            },
            NHIF: {
                pdf: report.NHIF_Link,
                excel: report.NHIF_Excel_Link
            },
            SHIF: {
                pdf: report.SHIF_Link,
                excel: report.SHIF_Excel_Link
            },
            HousingLevy: {
                pdf: report.Housing_Levy_Link,
                csv: report.Housing_Levy_CSV_Link
            },
            NITA: report.NITA_List,

            // Payroll Documents
            PayrollSummary: {
                pdf: report.Payroll_Summary_Link,
                excel: report.Payroll_Summary_Excel_Link
            },
            PayrollRecon: report.Payroll_Recon_Link,
            ControlTotal: report.Control_Total_Link,
            Payslips: report.Payslips_Link,

            // Payment Lists
            BankList: report.Bank_List_Link,
            CashList: report.Cash_List,
            MPESAList: report.MPESA_List
        });

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

                
                {visibleColumns.PayrollDocs && (
                    <>
                        {documentGroups.payroll.map(doc => (
                            <TableCell key={doc.key} className="border-r border-gray-300">
                                <div className="flex items-center justify-center space-x-2">
                                    <FileViewer
                                        url={report[doc.pdfKey]}
                                        fileType={getFileTypeFromUrl(report[doc.pdfKey])}
                                        title={`${doc.key.replace('_', ' ')} - ${report.CompanyName}`}
                                    />
                                    {doc.dataKey && (
                                        <FileViewer
                                            url={report[doc.dataKey]}
                                            fileType={getFileTypeFromUrl(report[doc.dataKey])}
                                            title={`${doc.key.replace('_', ' ')} Excel - ${report.CompanyName}`}
                                        />
                                    )}
                                </div>
                            </TableCell>
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


    return (
        <div className="p-4">
            <Tabs defaultValue="summary" className="w-full space-y-6">
                <TabsList className="grid w-[400px] grid-cols-2">
                    <TabsTrigger value="summary">Summary View</TabsTrigger>
                    <TabsTrigger value="detailed">Detailed View</TabsTrigger>
                </TabsList>

                {/* <ExcelViewer/> */}

                {/* Summary View */}
                <TabsContent value="summary">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2 mb-4">
                                <Search className="h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search companies..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-[300px]"
                                />
                            </div>

                            <div className="flex items-center space-x-2">
                                <div className="flex items-center space-x-4 mb-4">
                                    {/* <div className="flex items-center space-x-2">
                                    <span className="text-sm">Totals</span>
                                    <Switch
                                        checked={columnVisibility.statutory}
                                        onCheckedChange={(checked) =>
                                            setColumnVisibility(prev => ({ ...prev, statutory: checked }))
                                        }
                                    />
                                </div> */}
                                    {/* Add similar toggles for other column groups */}
                                </div>
                                <Button variant="outline" onClick={() => exportToExcel(latestReports)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export
                                </Button>
                                <Button variant="outline" onClick={fetchReports}>
                                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline">
                                            <MoreHorizontal className="mr-2 h-4 w-4" />
                                            Sections
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuCheckboxItem
                                            checked={visibleColumns.StatutoryDocs}
                                            onCheckedChange={(checked) =>
                                                setVisibleColumns(prev => ({ ...prev, StatutoryDocs: checked }))
                                            }
                                        >
                                            Statutory Documents
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={visibleColumns.PayrollDocs}
                                            onCheckedChange={(checked) =>
                                                setVisibleColumns(prev => ({ ...prev, PayrollDocs: checked }))
                                            }
                                        >
                                            Payroll Documents
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={visibleColumns.PaymentLists}
                                            onCheckedChange={(checked) =>
                                                setVisibleColumns(prev => ({ ...prev, PaymentLists: checked }))
                                            }
                                        >
                                            Payment Lists
                                        </DropdownMenuCheckboxItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        <div className="rounded-md border">
                            <ScrollArea className="h-[calc(100vh-300px)]">
                                <Table>
                                    <TableHeader>
                                        {renderTableHeader(false)}
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={20} className="text-center">
                                                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredReports.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={20} className="text-center">
                                                    No reports found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredReports
                                                .sort((a, b) => {
                                                    if (sortConfig.key === 'CompanyName') {
                                                        return sortConfig.direction === 'asc'
                                                            ? a.CompanyName.localeCompare(b.CompanyName)
                                                            : b.CompanyName.localeCompare(a.CompanyName);
                                                    }
                                                    return 0;
                                                })
                                                .map((report, index) => renderTableRow(report, index, false))
                                        )}
                                    </TableBody>

                                </Table>
                            </ScrollArea>
                        </div>
                    </div>
                </TabsContent>

            </Tabs>
        </div>
    );
}
