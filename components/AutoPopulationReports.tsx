// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Download, MoreHorizontal, Play, RefreshCw } from "lucide-react";
import * as ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabase';
import { Checkbox } from './ui/checkbox';

export function AutoPopulationReports() {
    const [reports, setReports] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [visibleColumns, setVisibleColumns] = useState({
        company_name: true,
        last_updated: true,
        vat3: true,
        sec_b_with_vat: true,
        sec_b_without_vat: true,
        sec_f: true,
    });
    const [selectedReports, setSelectedReports] = useState([]);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const { data, error } = await supabase
                .from('Autopopulate')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;

            const processedData = data.map(item => ({
                id: item.id,
                companyName: item.company_name,
                lastUpdated: item.last_updated,
                extractions: Object.entries(item.extractions || {}).map(([monthYear, details]) => ({
                    monthYear,
                    extractionDate: details.extraction_date,
                    files: details.files || []
                }))
            }));

            setReports(processedData);
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
        report.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Auto-Populate Reports');

        const headers = ['Company Name', 'Last Updated', 'VAT3', 'Sec B with VAT', 'Sec B without VAT', 'Sec F'];
        worksheet.addRow(headers);

        filteredReports.forEach((report) => {
            const row = [
                report.companyName,
                new Date(report.lastUpdated).toLocaleString(),
                findFile(report.extractions[0]?.files, 'vat3')?.originalName || 'Missing',
                findFile(report.extractions[0]?.files, 'sec_b_with_vat')?.originalName || 'Missing',
                findFile(report.extractions[0]?.files, 'sec_b_without_vat')?.originalName || 'Missing',
                findFile(report.extractions[0]?.files, 'sec_f')?.originalName || 'Missing',
            ];
            worksheet.addRow(row);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'auto_populate_reports.xlsx';
        link.click();
    };

    const toggleSelectAll = (checked) => {
        setSelectedReports(checked ? filteredReports.map(report => report.id) : []);
    };

    const toggleSelectReport = (reportId) => {
        setSelectedReports(prev =>
            prev.includes(reportId)
                ? prev.filter(id => id !== reportId)
                : [...prev, reportId]
        );
    };

    const runSelectedReports = () => {
        console.log("Running selected reports:", selectedReports);
        // Implement logic to run selected reports
    };

    const runMissingReports = () => {
        const missingReports = filteredReports.filter(report => !report.extractions.length).map(report => report.id);
        console.log("Running missing reports:", missingReports);
        // Implement logic to run missing reports
    };

    const findFile = (files, type) => {
        if (!files || !Array.isArray(files)) return null;

        const filePatterns = {
            vat3: /VAT3_Return/i,
            sec_b_with_vat: /SEC_B_WITH_VAT_PIN/i,
            sec_b_without_vat: /SEC_B_WITHOUT_PIN/i,
            sec_f: /SEC_F_WITH_VAT_PIN/i
        };

        return files.find(file => {
            const fileName = file.originalName || file.name || '';
            return filePatterns[type].test(fileName);
        });
    };

    const renderFileButton = (file, detailed = false) => {
        if (!file) return <span className="text-red-500 font-bold">Missing</span>;
        return (
            <Button
                key={file.path}
                variant="outline"
                size="sm"
                onClick={() => window.open(file.fullPath, '_blank')}
            >
                <Download className="mr-1 h-3 w-3" />
                Download
            </Button>
        );
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
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                    />
                    <div className="flex gap-2">
                        <Button onClick={exportToExcel} size="sm" className="px-2 py-1">
                            <Download className="mr-1 h-4 w-4" />
                            Export to Excel
                        </Button>
                        <Button onClick={runSelectedReports} size="sm" disabled={selectedReports.length === 0} className="px-2 py-1">
                            <Play className="mr-1 h-4 w-4" />
                            Run Selected
                        </Button>
                        <Button onClick={runMissingReports} size="sm" className="px-2 py-1">
                            <Play className="mr-1 h-4 w-4" />
                            Run Missing
                        </Button>
                        <Button onClick={fetchReports} size="sm" className="px-2 py-1">
                            <RefreshCw className="mr-1 h-4 w-4" />
                            Refresh
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="ml-auto" size="sm" className="px-2 py-1">
                                    Columns <MoreHorizontal className="ml-1 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {Object.keys(visibleColumns).map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column}
                                        className="capitalize text-sm"
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
                <div className="border rounded-md mb-2">
                    <ScrollArea className="h-[60vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Checkbox
                                            checked={selectedReports.length === filteredReports.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    {[
                                        { key: 'index', label: 'Index', alwaysVisible: true },
                                        { key: 'company_name', label: 'Company Name', center: false },
                                        { key: 'last_updated', label: 'Last Updated', center: false },
                                        { key: 'vat3', label: 'VAT3', center: true },
                                        { key: 'sec_b_with_vat', label: 'Sec B with VAT', center: true },
                                        { key: 'sec_b_without_vat', label: 'Sec B without VAT', center: true },
                                        { key: 'sec_f', label: 'Sec F', center: true },
                                    ].map(({ key, label, alwaysVisible, center }) => (
                                        (alwaysVisible || visibleColumns[key]) && (
                                            <TableHead key={key}>
                                                <div className={`flex items-center ${center ? 'justify-center' : ''}`}>
                                                    {label}
                                                    {!['index', 'vat3', 'sec_b_with_vat', 'sec_b_without_vat', 'sec_f'].includes(key) && (
                                                        <ArrowUpDown
                                                            className="h-4 w-4 cursor-pointer"
                                                            onClick={() => handleSort(key)}
                                                        />
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
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedReports.includes(report.id)}
                                                onCheckedChange={() => toggleSelectReport(report.id)}
                                            />
                                        </TableCell>
                                        <TableCell>{index + 1}</TableCell>
                                        {visibleColumns.company_name && <TableCell>{report.companyName}</TableCell>}
                                        {visibleColumns.last_updated && <TableCell>{new Date(report.lastUpdated).toLocaleString()}</TableCell>}
                                        {visibleColumns.vat3 && <TableCell className="text-center">{renderFileButton(findFile(report.extractions[0]?.files, 'vat3'))}</TableCell>}
                                        {visibleColumns.sec_b_with_vat && <TableCell className="text-center">{renderFileButton(findFile(report.extractions[0]?.files, 'sec_b_with_vat'))}</TableCell>}
                                        {visibleColumns.sec_b_without_vat && <TableCell className="text-center">{renderFileButton(findFile(report.extractions[0]?.files, 'sec_b_without_vat'))}</TableCell>}
                                        {visibleColumns.sec_f && <TableCell className="text-center">{renderFileButton(findFile(report.extractions[0]?.files, 'sec_f'))}</TableCell>}
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
                                    className={`p-2 cursor-pointer transition-colors duration-200 text-xs uppercase ${selectedCompany?.id === report.id
                                        ? 'bg-blue-500 text-white font-bold'
                                        : 'hover:bg-blue-100'
                                        }`}
                                    onClick={() => setSelectedCompany(report)}
                                >
                                    {report.companyName}
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
                                    <CardTitle className="text-xl">{selectedCompany.companyName}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <ScrollArea className="h-[600px]">
                                        <div className="space-y-4">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="text-xs">Index</TableHead>
                                                        <TableHead className="text-xs">Month</TableHead>
                                                        <TableHead className="text-xs">Extraction Date</TableHead>
                                                        <TableHead className="text-xs">VAT3</TableHead>
                                                        <TableHead className="text-xs">Sec B with VAT</TableHead>
                                                        <TableHead className="text-xs">Sec B without VAT</TableHead>
                                                        <TableHead className="text-xs">Sec F</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedCompany.extractions.map((extraction, index) => (
                                                        <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                                            <TableCell className="text-xs p-1">{index + 1}</TableCell>
                                                            <TableCell className="text-xs p-1 whitespace-nowrap">{extraction.monthYear}</TableCell>
                                                            <TableCell className="text-xs p-1 whitespace-nowrap">
                                                                {extraction.extractionDate ? (
                                                                    new Date(extraction.extractionDate).toLocaleString()
                                                                ) : (
                                                                    <span className="text-red-500">Missing</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-xs p-1">{renderFileButton(findFile(extraction.files, 'vat3'), true)}</TableCell>
                                                            <TableCell className="text-xs p-1">{renderFileButton(findFile(extraction.files, 'sec_b_with_vat'), true)}</TableCell>
                                                            <TableCell className="text-xs p-1">{renderFileButton(findFile(extraction.files, 'sec_b_without_vat'), true)}</TableCell>
                                                            <TableCell className="text-xs p-1">{renderFileButton(findFile(extraction.files, 'sec_f'), true)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
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