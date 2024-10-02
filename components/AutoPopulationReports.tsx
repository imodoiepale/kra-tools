// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpDown, Search, Eye, Download, MoreHorizontal, FileIcon, ImageIcon, Play, RefreshCw } from "lucide-react";
import * as ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabase'
import { Checkbox } from './ui/checkbox';
import FileViewer from './FileViewer';

export function AutoPopulationReports() {
    const [reports, setReports] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [visibleColumns, setVisibleColumns] = useState({
        company_name: true,
        last_updated: true,
        extraction_count: true,
        zip_file: true,
        excel_file: true,
        extracted_files: true,
    });

    const [selectedReports, setSelectedReports] = useState([]);

    const viewDocument = (url, title) => {
        const fileType = url.endsWith('.xlsx') || url.endsWith('.csv') ? 'excel' : 'zip';
        return <FileViewer url={url} fileType={fileType} title={title} />;
    };

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

        // Add headers
        const headers = ['Company Name', 'Last Updated', 'Extraction Count'];
        const headerRow = worksheet.addRow(headers);

        // Style the header row
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' }
            };
            cell.font = { bold: true };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Add data
        filteredReports.forEach((report) => {
            worksheet.addRow([
                report.companyName,
                new Date(report.lastUpdated).toLocaleString(),
                report.extractions.length
            ]);
        });

        // Generate and download the file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'auto_populate_reports.xlsx';
        link.click();
    };

    const toggleSelectAll = (checked) => {
        if (checked) {
            setSelectedReports(filteredReports.map(report => report.id));
        } else {
            setSelectedReports([]);
        }
    };

    const toggleSelectReport = (reportId) => {
        setSelectedReports(prev =>
            prev.includes(reportId)
                ? prev.filter(id => id !== reportId)
                : [...prev, reportId]
        );
    };

    const runSelectedReports = () => {
        // Implement logic to run selected reports
    };

    const runMissingReports = () => {
        const missingReports = filteredReports.filter(report => !report.extractions.length).map(report => report.id);
        // Implement logic to run missing reports
    };

    const renderFileButton = (file) => (
        <Button
            key={file.path}
            variant="outline"
            size="sm"
            onClick={() => window.open(file.fullPath, '_blank')}
        >
            <FileIcon className="mr-1 h-3 w-3" />
            {file.originalName}
        </Button>
    );

    const findFile = (files, type) => files && Array.isArray(files) ? files.find(f => f.type === type) : null;

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
                                        { key: 'company_name', label: 'Company Name' },
                                        { key: 'last_updated', label: 'Last Updated' },
                                        { key: 'extracted_files', label: 'Extracted Files', textAlign: 'text-center' },
                                    ].map(({ key, label, alwaysVisible, textAlign }) => (
                                        (alwaysVisible || visibleColumns[key]) && (
                                            <TableHead key={key}>
                                                <div className={`flex items-center justify-center ${textAlign ? textAlign : ''}`}>
                                                    {label}
                                                    {key !== 'actions' && key !== 'extracted_files' && (
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
                                        {[
                                            { key: 'index', content: index + 1, alwaysVisible: true },
                                            { key: 'company_name', content: report.companyName },
                                            { key: 'last_updated', content: new Date(report.lastUpdated).toLocaleString() },
                                            {
                                                key: 'extracted_files',
                                                content: (() => {
                                                    const extractedFiles = report.extractions[0]?.files?.filter(f => f.type === 'extracted') || [];
                                                    return extractedFiles.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 justify-center">
                                                            {extractedFiles.map(file => (
                                                                <React.Fragment key={file.path}>
                                                                    {/* {viewDocument(file.fullPath, file.originalName)} */}
                                                                    <Button variant="outline" size="sm" onClick={() => window.open(file.fullPath, '_blank')}>
                                                                        <Download className="mr-2 h-4 w-4" />
                                                                        Download {file.originalName}
                                                                    </Button>
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1 justify-center">
                                                            <span className="text-red-500 text-center font-bold">No extracted files</span>
                                                        </div>
                                                    );
                                                })()
                                            },

                                        ].map(({ key, content, alwaysVisible }) => (
                                            (alwaysVisible || visibleColumns[key]) && (
                                                <TableCell key={key}>{content}</TableCell>
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
                                                        <TableHead className="text-xs">Files</TableHead>
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
                                                            <TableCell className="text-xs p-1">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {extraction.files.length > 0 ? (
                                                                        extraction.files.map(renderFileButton)
                                                                    ) : (
                                                                        <span className="text-red-500">No files available</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
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