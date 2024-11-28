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
import { ArrowUpDown, Download, MoreHorizontal, RefreshCw, Search, FolderOpen , ChevronDown, ChevronUp } from "lucide-react";
import * as ExcelJS from 'exceljs';
import FileViewer from '@/components/FileViewer';
import { Switch } from '@/components/ui/switch';

interface ReportRecord {
    ID: number;
    Month: number;
    Year: number;
    CompanyID: number;
    CompanyName: string;
    // Statutory Documents
    PAYE_Link: string;
    PAYE_CSV_Link: string;
    NSSF_Link: string;
    NSSF_Excel_Link: string;
    NHIF_Link: string;
    NHIF_Excel_Link: string;
    SHIF_Link: string;
    SHIF_Excel_Link: string;
    Housing_Levy_Link: string;
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
    NITA_List: string;
}

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


    // Excel Export Functions
    const exportToExcel = async (reportData: ReportRecord[] = filteredReports) => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reports');

        // Define headers
        const headers = [
            'Index',
            'Company Name',
            'Period',
            // Statutory Documents
            'PAYE Returns',
            'PAYE CSV',
            'NSSF Returns',
            'NSSF Excel',
            'NHIF Returns',
            'NHIF Excel',
            'SHIF Returns',
            'SHIF Excel',
            'Housing Levy',
            'Housing Levy CSV',
            // Payroll Documents
            'Payroll Summary',
            'Payroll Summary Excel',
            'Payroll Reconciliation',
            'Control Totals',
            'Payslips',
            // Payment Lists
            'Bank List',
            'Cash List',
            'M-PESA List',
            'NITA Returns'
        ];

        // Add headers
        worksheet.addRow(headers);

        // Add data
        reportData.forEach((report, index) => {
            worksheet.addRow([
                index + 1,
                report.CompanyName,
                `${report.Month}/${report.Year}`,
                // Statutory Documents
                report.PAYE_Link ? 'Available' : 'Missing',
                report.PAYE_CSV_Link ? 'Available' : 'Missing',
                report.NSSF_Link ? 'Available' : 'Missing',
                report.NSSF_Excel_Link ? 'Available' : 'Missing',
                report.NHIF_Link ? 'Available' : 'Missing',
                report.NHIF_Excel_Link ? 'Available' : 'Missing',
                report.SHIF_Link ? 'Available' : 'Missing',
                report.SHIF_Excel_Link ? 'Available' : 'Missing',
                report.Housing_Levy_Link ? 'Available' : 'Missing',
                report.Housing_Levy_CSV_Link ? 'Available' : 'Missing',
                // Payroll Documents
                report.Payroll_Summary_Link ? 'Available' : 'Missing',
                report.Payroll_Summary_Excel_Link ? 'Available' : 'Missing',
                report.Payroll_Recon_Link ? 'Available' : 'Missing',
                report.Control_Total_Link ? 'Available' : 'Missing',
                report.Payslips_Link ? 'Available' : 'Missing',
                // Payment Lists
                report.Bank_List_Link ? 'Available' : 'Missing',
                report.Cash_List ? 'Available' : 'Missing',
                report.MPESA_List ? 'Available' : 'Missing',
                report.NITA_List ? 'Available' : 'Missing'
            ]);
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
            <TableRow className="bg-gray-100">
                <TableHead className="w-14">Index</TableHead>
                <TableHead>
                    <div
                        className="flex items-center space-x-2 cursor-pointer"
                        onClick={() => handleSort('CompanyName')}
                    >
                        <span>Company Name</span>
                        <ArrowUpDown className="h-4 w-4" />
                    </div>
                </TableHead>
                {showPeriod && <TableHead>Period</TableHead>}

                {/* Statutory Documents */}
                {visibleColumns.StatutoryDocs && (
                    <>
                        <TableHead className="text-center">PAYE Returns</TableHead>
                        <TableHead className="text-center">NSSF Returns</TableHead>
                        <TableHead className="text-center">NHIF Returns</TableHead>
                        <TableHead className="text-center">SHIF Returns</TableHead>
                        <TableHead className="text-center">Housing Levy</TableHead>
                    </>
                )}

                {/* Payroll Documents */}
                {visibleColumns.PayrollDocs && (
                    <>
                        <TableHead className="text-center">Payroll Summary</TableHead>
                        <TableHead className="text-center">Recon Report</TableHead>
                        <TableHead className="text-center">Control Total</TableHead>
                        <TableHead className="text-center">Payslips</TableHead>
                    </>
                )}

                {/* Payment Lists */}
                {visibleColumns.PaymentLists && (
                    <>
                        <TableHead className="text-center">Bank List</TableHead>
                        <TableHead className="text-center">Cash List</TableHead>
                        <TableHead className="text-center">M-PESA List</TableHead>
                        <TableHead className="text-center">NITA Returns</TableHead>
                    </>
                )}
            </TableRow>
            <TableRow className="bg-blue-50">
                <TableHead colSpan={2}>Total Documents</TableHead>
                {visibleColumns.StatutoryDocs && documentGroups.statutory.map(doc => (
                    <TableHead key={doc.key} className="text-center">
                        {calculateColumnStats(doc.pdfKey)?.total}
                    </TableHead>
                ))}
                {visibleColumns.PayrollDocs && documentGroups.payroll.map(doc => (
                    <TableHead key={doc.key} className="text-center">
                        {calculateColumnStats(doc.pdfKey)?.total}
                    </TableHead>
                ))}
                {visibleColumns.PaymentLists && documentGroups.payments.map(doc => (
                    <TableHead key={doc.key} className="text-center">
                        {calculateColumnStats(doc.pdfKey)?.total}
                    </TableHead>
                ))}
            </TableRow>
            <TableRow className="bg-green-50">
                <TableHead colSpan={2}>Available Documents</TableHead>
                {visibleColumns.StatutoryDocs && documentGroups.statutory.map(doc => (
                    <TableHead key={doc.key} className="text-center">
                        {calculateColumnStats(doc.pdfKey)?.available}
                    </TableHead>
                ))}
                {visibleColumns.PayrollDocs && documentGroups.payroll.map(doc => (
                    <TableHead key={doc.key} className="text-center">
                        {calculateColumnStats(doc.pdfKey)?.available}
                    </TableHead>
                ))}
                {visibleColumns.PaymentLists && documentGroups.payments.map(doc => (
                    <TableHead key={doc.key} className="text-center">
                        {calculateColumnStats(doc.pdfKey)?.available}
                    </TableHead>
                ))}
            </TableRow>
            <TableRow className="bg-red-50">
                <TableHead colSpan={2}>Missing Documents</TableHead>
                {visibleColumns.StatutoryDocs && documentGroups.statutory.map(doc => (
                    <TableHead key={doc.key} className="text-center">
                        {calculateColumnStats(doc.pdfKey)?.missing}
                    </TableHead>
                ))}
                {visibleColumns.PayrollDocs && documentGroups.payroll.map(doc => (
                    <TableHead key={doc.key} className="text-center">
                        {calculateColumnStats(doc.pdfKey)?.missing}
                    </TableHead>
                ))}
                {visibleColumns.PaymentLists && documentGroups.payments.map(doc => (
                    <TableHead key={doc.key} className="text-center">
                        {calculateColumnStats(doc.pdfKey)?.missing}
                    </TableHead>
                ))}
            </TableRow>
        </>
    );

    const documentGroups = {
        statutory: [
            { key: 'PAYE', pdfKey: 'PAYE_Link', dataKey: 'PAYE_CSV_Link' },
            { key: 'NSSF', pdfKey: 'NSSF_Link', dataKey: 'NSSF_Excel_Link' },
            { key: 'NHIF', pdfKey: 'NHIF_Link', dataKey: 'NHIF_Excel_Link' },
            { key: 'SHIF', pdfKey: 'SHIF_Link', dataKey: 'SHIF_Excel_Link' },
            { key: 'Housing_Levy', pdfKey: 'Housing_Levy_Link', dataKey: 'Housing_Levy_CSV_Link' }
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
            { key: 'MPESA_List', pdfKey: 'MPESA_List' },
            { key: 'NITA_List', pdfKey: 'NITA_List' }
        ]
    };

    const renderTableRow = (report: ReportRecord, index: number, showPeriod: boolean = false) => (
        <TableRow key={report.ID} className="hover:bg-gray-50">
            <TableCell className="font-medium">{index + 1}</TableCell>
            <TableCell>{report.CompanyName}</TableCell>
            {showPeriod && <TableCell>{`${report.Month}/${report.Year}`}</TableCell>}

            {visibleColumns.StatutoryDocs && documentGroups.statutory.map(doc => (
                <TableCell key={doc.key}>
                    <FileViewer
                        url={report[doc.pdfKey]}
                        fileType="pdf"
                        title={`${doc.key.replace('_', ' ')} - ${report.CompanyName}`}
                        dataLink={doc.dataKey ? report[doc.dataKey] : undefined}
                    />
                </TableCell>
            ))}

            {visibleColumns.PayrollDocs && documentGroups.payroll.map(doc => (
                <TableCell key={doc.key}>
                    <FileViewer
                        url={report[doc.pdfKey]}
                        fileType="pdf"
                        title={`${doc.key.replace('_', ' ')} - ${report.CompanyName}`}
                        dataLink={doc.dataKey ? report[doc.dataKey] : undefined}
                    />
                </TableCell>
            ))}

            {visibleColumns.PaymentLists && documentGroups.payments.map(doc => (
                <TableCell key={doc.key}>
                    <FileViewer
                        url={report[doc.pdfKey]}
                        fileType="pdf"
                        title={`${doc.key.replace('_', ' ')} - ${report.CompanyName}`}
                    />
                </TableCell>
            ))}
        </TableRow>
    );


    return (
        <div className="p-4">
            <Tabs defaultValue="summary" className="w-full space-y-6">
                <TabsList className="grid w-[400px] grid-cols-2">
                    <TabsTrigger value="summary">Summary View</TabsTrigger>
                    <TabsTrigger value="detailed">Detailed View</TabsTrigger>
                </TabsList>

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
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm">Totals</span>
                                    <Switch
                                        checked={columnVisibility.statutory}
                                        onCheckedChange={(checked) =>
                                            setColumnVisibility(prev => ({ ...prev, statutory: checked }))
                                        }
                                    />
                                </div>
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

                {/* Detailed View */}
                <TabsContent value="detailed">
                    <div className="grid grid-cols-[350px_1fr] gap-6">
                        {/* Left Panel - Company List */}
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                                <Input
                                    placeholder="Search companies..."
                                    value={companySearchTerm}
                                    onChange={(e) => setCompanySearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            <ScrollArea className="h-[calc(100vh-300px)] rounded-md border">
                                <div className="space-y-1 p-2">
                                    {reports
                                        .filter(report =>
                                            report.CompanyName.toLowerCase().includes(companySearchTerm.toLowerCase())
                                        )
                                        .map((report) => (
                                            <div
                                                key={report.ID}
                                                onClick={() => setSelectedCompany(report)}
                                                className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-md ${selectedCompany?.ID === report.ID
                                                    ? 'bg-blue-100 text-blue-900'
                                                    : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <span>{report.CompanyName}</span>
                                            </div>
                                        ))}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Right Panel - Detailed Table View */}
                        <div>
                            {selectedCompany ? (
                                <Card>
                                    <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-xl text-white">
                                                {selectedCompany.CompanyName}
                                            </CardTitle>
                                            <div className="flex space-x-2">
                                                <Button
                                                    variant="ghost"
                                                    className="text-white hover:text-blue-100"
                                                    onClick={() => exportToExcel(reports.filter(r => r.CompanyID === selectedCompany.CompanyID))}
                                                >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Export
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="text-white hover:text-blue-100">
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
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <ScrollArea className="h-[calc(100vh-400px)]">
                                            <Table>
                                                <TableHeader>
                                                    {renderTableHeader(true)}
                                                </TableHeader>
                                                <TableBody>
                                                    {isLoading ? (
                                                        <TableRow>
                                                            <TableCell colSpan={20} className="text-center">
                                                                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : reports
                                                        .filter(r => r.CompanyID === selectedCompany.CompanyID)
                                                        .filter(report =>
                                                            report.CompanyName.toLowerCase().includes(searchTerm.toLowerCase())
                                                        )
                                                        .sort((a, b) => {
                                                            if (sortConfig.key) {
                                                                const aValue = a[sortConfig.key];
                                                                const bValue = b[sortConfig.key];
                                                                const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
                                                                return sortConfig.direction === 'asc' ? comparison : -comparison;
                                                            }
                                                            // Default date sorting
                                                            const dateA = new Date(a.Year, a.Month - 1);
                                                            const dateB = new Date(b.Year, b.Month - 1);
                                                            return dateB.getTime() - dateA.getTime();
                                                        })
                                                        .map((report, index) => renderTableRow(report, index, true))}
                                                </TableBody>

                                            </Table>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="flex h-[calc(100vh-300px)] items-center justify-center rounded-lg border-2 border-dashed">
                                    <div className="text-center">
                                        <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
                                        <h3 className="mt-2 text-sm font-medium text-gray-900">No Company Selected</h3>
                                        <p className="mt-1 text-sm text-gray-500">
                                            Select a company from the list to view detailed information
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
