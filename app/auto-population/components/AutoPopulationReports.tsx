// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Download, MoreHorizontal, Play, RefreshCw, Filter, Eye, EyeOff, Upload } from "lucide-react";
import * as ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabase';
import { Checkbox } from '../../../components/ui/checkbox';
import { ClientCategoryFilter } from '@/components/ClientCategoryFilter';
import { FileUploadModal } from './FileUploadModal';

export function AutoPopulationReports() {
    const [reports, setReports] = useState([]);
    const [passwordCheckerCompanies, setPasswordCheckerCompanies] = useState([]);
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
    const [downloadFile, setDownloadFile] = useState(null);
    const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
    const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
    const [categoryFilters, setCategoryFilters] = useState({});
    const [showStatsRows, setShowStatsRows] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadCompany, setUploadCompany] = useState(null);

    useEffect(() => {
        fetchReports();
        fetchPasswordCheckerCompanies();
    }, []);

    const fetchPasswordCheckerCompanies = async () => {
        try {
            const { data, error } = await supabase
                .from('PasswordChecker')
                .select('id, company_name')
                .order('company_name', { ascending: true });

            if (error) throw error;
            setPasswordCheckerCompanies(data || []);
        } catch (error) {
            console.error('Error fetching PasswordChecker companies:', error);
        }
    };

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

    const getPreviousMonthName = () => {
        const currentDate = new Date();
        const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        return previousMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    const getMostRecentExtraction = (report) => {
        if (!report.extractions || Object.keys(report.extractions).length === 0) {
            return null;
        }

        // Convert extractions object to array of [monthYear, data] pairs
        const extractionsArray = Object.entries(report.extractions);

        // Sort by date in descending order (most recent first)
        extractionsArray.sort(([monthYearA], [monthYearB]) => {
            const dateA = new Date(monthYearA);
            const dateB = new Date(monthYearB);
            return dateB.getTime() - dateA.getTime();
        });

        // Return the most recent extraction's data
        return extractionsArray[0]?.[1] || null;
    };

    const getCurrentMonthExtractions = (report) => {
        if (!report.extractions || Object.keys(report.extractions).length === 0) {
            return null;
        }

        const targetMonthYear = getPreviousMonthName();
        return report.extractions[targetMonthYear] || null;
    };

    const getMergedAndSortedReports = () => {
        // Get all company names from Autopopulate
        const autopopulateCompanies = new Set(reports.map(r => r.companyName.toLowerCase()));

        // Create entries for companies that are in PasswordChecker but not in Autopopulate
        const missingCompanies = passwordCheckerCompanies
            .filter(pc => !autopopulateCompanies.has(pc.company_name.toLowerCase()))
            .map(pc => ({
                id: `pc_${pc.id}`,
                companyName: pc.company_name,
                lastUpdated: null,
                extractions: {},
                isMissing: true
            }));

        // Combine and sort all reports
        const allReports = [...reports, ...missingCompanies].sort((a, b) => {
            // First sort by whether they have any extractions
            const aHasExtractions = getMostRecentExtraction(a) !== null;
            const bHasExtractions = getMostRecentExtraction(b) !== null;

            if (aHasExtractions && !bHasExtractions) return -1;
            if (!aHasExtractions && bHasExtractions) return 1;

            // Then sort by missing status
            if (a.isMissing && !b.isMissing) return 1;
            if (!a.isMissing && b.isMissing) return -1;

            // Finally sort by company name
            return a.companyName.localeCompare(b.companyName);
        });

        // Apply search filter
        let filteredReports = allReports.filter(report =>
            report.companyName.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        // Apply category filters
        if (Object.keys(categoryFilters).length > 0) {
            // Check if any category filter is active
            const hasActiveFilters = Object.values(categoryFilters).some(categoryStatus => 
                Object.values(categoryStatus as Record<string, boolean>).some(isSelected => isSelected)
            );
            
            if (hasActiveFilters) {
                filteredReports = filteredReports.filter(report => {
                    // Get the report's category and status
                    const category = report.category || 'all';
                    const status = report.status === 'active' ? 'active' : 'inactive';
                    
                    // Check if this category has any filters
                    const categoryFilter = categoryFilters[category] as Record<string, boolean> | undefined;
                    if (!categoryFilter) {
                        // Check if 'all' category has this status selected
                        const allCategoryFilter = categoryFilters['all'] as Record<string, boolean> | undefined;
                        return allCategoryFilter?.[status] || allCategoryFilter?.['all'];
                    }
                    
                    // Check if this specific status is selected for this category
                    return categoryFilter[status] || categoryFilter['all'];
                });
            }
        }
        
        return filteredReports;
    };

    const sortedReports = [...reports].sort((a, b) => {
        if (a[sortColumn] < b[sortColumn]) return sortOrder === 'asc' ? -1 : 1;
        if (a[sortColumn] > b[sortColumn]) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const filteredReports = getMergedAndSortedReports();

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Auto-Populate Reports');

        const headers = ['Company Name', 'Last Updated', 'VAT3 - Template', 'Sec B - Sales 16%', 'Sec B -  Sales 0%', 'Sec F - Purchase'];
        worksheet.addRow(headers);

        filteredReports.forEach((report) => {
            const mostRecentFiles = getMostRecentExtraction(report)?.files || [];
            const row = [
                report.companyName,
                new Date(report.lastUpdated).toLocaleString(),
                findFile(mostRecentFiles, 'vat3')?.originalName || 'Missing',
                findFile(mostRecentFiles, 'sec_b_with_vat')?.originalName || 'Missing',
                findFile(mostRecentFiles, 'sec_b_without_vat')?.originalName || 'Missing',
                findFile(mostRecentFiles, 'sec_f')?.originalName || 'Missing',
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

    const runSelectedReports = async () => {
        if (selectedReports.length === 0) {
            // Add some UI feedback that no reports are selected
            return;
        }

        try {
            const response = await fetch('/api/auto-population', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    selectedIds: selectedReports // Pass the selected IDs
                })
            });

            if (!response.ok) {
                throw new Error('Failed to start selected reports');
            }

            // Switch to running tab or update UI as needed
            if (onStart) {
                onStart();
            }
        } catch (error) {
            console.error('Error running selected reports:', error);
            // Add error handling/UI feedback
        }
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
    
    // Calculate statistics for complete and missing entries
    const calculateStats = () => {
        const stats = {
            complete: {},
            missing: {}
        };

        // Define fields to check for completeness
        const fieldsToCheck = [
            'companyName',
            'lastUpdated',
            'vat3',
            'sec_b_with_vat',
            'sec_b_without_vat',
            'sec_f'
        ];

        // Initialize stats for each field
        fieldsToCheck.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        // Calculate stats for each field individually
        filteredReports.forEach(report => {
            const mostRecentExtraction = getMostRecentExtraction(report);
            const files = mostRecentExtraction?.files || [];
            
            // Check company name
            if (report.companyName && report.companyName.trim() !== '') {
                stats.complete.companyName++;
            } else {
                stats.missing.companyName++;
            }
            
            // Check last updated
            if (report.lastUpdated) {
                stats.complete.lastUpdated++;
            } else {
                stats.missing.lastUpdated++;
            }
            
            // Check files
            if (findFile(files, 'vat3')) {
                stats.complete.vat3++;
            } else {
                stats.missing.vat3++;
            }
            
            if (findFile(files, 'sec_b_with_vat')) {
                stats.complete.sec_b_with_vat++;
            } else {
                stats.missing.sec_b_with_vat++;
            }
            
            if (findFile(files, 'sec_b_without_vat')) {
                stats.complete.sec_b_without_vat++;
            } else {
                stats.missing.sec_b_without_vat++;
            }
            
            if (findFile(files, 'sec_f')) {
                stats.complete.sec_f++;
            } else {
                stats.missing.sec_f++;
            }
        });

        return stats;
    };

    const stats = calculateStats();

    const renderFileButton = (file, detailed = false, report = null) => {
        if (!file) {
            return (
                <div className="flex flex-col items-center gap-1">
                    <span className="text-red-500 font-bold">Missing</span>
                    {report && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="px-2 py-1 h-7 text-xs"
                            onClick={(e) => {
                                e.stopPropagation();
                                setUploadCompany(report);
                                setIsUploadModalOpen(true);
                            }}
                        >
                            <Upload className="mr-1 h-3 w-3" />
                            Upload
                        </Button>
                    )}
                </div>
            );
        }
        return (
            <Button
                key={file.path}
                variant="outline"
                size="sm"
                onClick={() => window.open(file.fullPath, '_blank')}
            >
                <Download className="mr-1 h-3 w-3" />
                {detailed ? file.originalName : 'Download'}
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
                    <div className="flex space-x-2">
                        <div className="relative">
                            <Input
                                placeholder="Search companies..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="max-w-sm pl-8"
                            />
                            <div className="absolute left-2 top-2.5">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => setIsCategoryFilterOpen(true)}>
                                <Filter className="mr-1 h-4 w-4" />
                                Categories Filters
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setShowStatsRows(!showStatsRows)}
                            >
                                {showStatsRows ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                                {showStatsRows ? 'Hide Stats' : 'Show Stats'}
                            </Button>
                        </div>
                    </div>
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
                                <Button variant="outline" size="sm" className="ml-auto px-2 py-1">
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
                <ClientCategoryFilter 
                    isOpen={isCategoryFilterOpen} 
                    onClose={() => setIsCategoryFilterOpen(false)} 
                    onApplyFilters={(filters) => setCategoryFilters(filters)}
                    onClearFilters={() => setCategoryFilters({})}
                    selectedFilters={categoryFilters}
                />
                <div className="border rounded-md mb-2">
                    <ScrollArea className="h-[60vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="border-r border-gray-300">
                                        <Checkbox
                                            checked={selectedReports.length === filteredReports.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    {[
                                        { key: 'index', label: 'Index', alwaysVisible: true },
                                        { key: 'company_name', label: 'Company Name', center: false },
                                        { key: 'last_updated', label: 'Last Updated', center: false },
                                        { key: 'vat3', label: 'VAT3 - Template', center: true },
                                        { key: 'sec_b_with_vat', label: 'Sec B - Sales 16%', center: true },
                                        { key: 'sec_b_without_vat', label: 'Sec B - Sales 0%', center: true },
                                        { key: 'sec_f', label: 'Sec F - Purchase', center: true },
                                    ].map(({ key, label, alwaysVisible, center }) => (
                                        (alwaysVisible || visibleColumns[key]) && (
                                            <TableHead key={key} className="border-r border-gray-300 text-xs font-semibold">
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
                                {showStatsRows && (
                                    <>
                                        <TableRow className="bg-gray-100">
                                            <TableCell className="border-r border-gray-300"></TableCell>
                                            <TableCell className="text-center text-[10px] font-bold border-r border-gray-300">Complete</TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.companyName === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.companyName}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.lastUpdated === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.lastUpdated}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.vat3 === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.vat3}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.sec_b_with_vat === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.sec_b_with_vat}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.sec_b_without_vat === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.sec_b_without_vat}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.sec_f === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.sec_f}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow className="bg-gray-50">
                                            <TableCell className="border-r border-gray-300"></TableCell>
                                            <TableCell className="text-center text-[10px] font-bold border-r border-gray-300">Missing</TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.companyName > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.companyName}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.lastUpdated > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.lastUpdated}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.vat3 > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.vat3}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.sec_b_with_vat > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.sec_b_with_vat}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.sec_b_without_vat > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.sec_b_without_vat}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.sec_f > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.sec_f}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    </>
                                )}
                            </TableHeader>
                            <TableBody>
                                {filteredReports.map((report, index) => (
                                    <TableRow
                                        key={report.id}
                                        className={`${index % 2 === 0 ? 'bg-gray-100' : 'bg-white'} ${report.isMissing ? 'bg-red-100' : ''
                                            }`}
                                    >
                                        <TableCell className="border-r border-gray-300">
                                            <Checkbox
                                                checked={selectedReports.includes(report.id)}
                                                onCheckedChange={() => toggleSelectReport(report.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="border-r border-gray-300 text-xs">{index + 1}</TableCell>
                                        {visibleColumns.company_name && <TableCell className="border-r border-gray-300 text-xs">{report.companyName}</TableCell>}
                                        {visibleColumns.last_updated && <TableCell className="border-r border-gray-300 text-xs">{new Date(report.lastUpdated).toLocaleString()}</TableCell>}
                                        {visibleColumns.vat3 && (
                                            <TableCell className="text-center border-r border-gray-300">
                                                {renderFileButton(findFile(getMostRecentExtraction(report)?.files, 'vat3'), false, report)}
                                            </TableCell>
                                        )}
                                        {visibleColumns.sec_b_with_vat && (
                                            <TableCell className="text-center border-r border-gray-300">
                                                {renderFileButton(findFile(getMostRecentExtraction(report)?.files, 'sec_b_with_vat'), false, report)}
                                            </TableCell>
                                        )}
                                        {visibleColumns.sec_b_without_vat && (
                                            <TableCell className="text-center border-r border-gray-300">
                                                {renderFileButton(findFile(getMostRecentExtraction(report)?.files, 'sec_b_without_vat'), false, report)}
                                            </TableCell>
                                        )}
                                        {visibleColumns.sec_f && (
                                            <TableCell className="text-center border-r border-gray-300">
                                                {renderFileButton(findFile(getMostRecentExtraction(report)?.files, 'sec_f'), false, report)}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                                <TableRow key="spacer-row" className="h-4" />
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </TabsContent>
            <TabsContent value="detailed">
                <div className="flex gap-2">
                    {/* Sidebar */}
                    <div className="w-[200px] border rounded-lg shadow-sm overflow-y-auto max-h-[calc(100vh-200px)]">
                        <div className="sticky top-0 bg-white p-1 border-b">
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full text-xs"
                            />
                        </div>
                        <div className="divide-y">
                            {reports.map((report, index) => (
                                <div
                                    key={report.id}
                                    className={`p-2 cursor-pointer transition-colors duration-200 text-xs ${
                                        selectedCompany?.id === report.id
                                            ? 'bg-gray-500 text-white font-bold'
                                            : report.isMissing
                                                ? 'bg-red-100 hover:bg-red-200'
                                                : 'hover:bg-gray-100'
                                    }`}
                                    onClick={() => setSelectedCompany(report)}
                                >
                                    <div className="font-medium">{report.companyName}</div>
                                    {report.lastUpdated && (
                                        <div className="text-[10px] mt-0.5 opacity-75">
                                            {new Date(report.lastUpdated).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
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
                                                    <TableRow className="bg-gray-100">
                                                        <TableHead className="text-xs text-center border-r border-gray-300">Index</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Month</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Last Updated</TableHead>
                                                        <TableHead className="text-xs text-center border-r border-gray-300">VAT3 - Template</TableHead>
                                                        <TableHead className="text-xs text-center border-r border-gray-300">Sec B - Sales 16%</TableHead>
                                                        <TableHead className="text-xs text-center border-r border-gray-300">Sec B - Sales 0%</TableHead>
                                                        <TableHead className="text-xs text-center border-r border-gray-300">Sec F - Purchase</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedCompany.extractions
                                                        .sort((a, b) => new Date(b.monthYear) - new Date(a.monthYear))
                                                        .map((extraction, index) => (
                                                            <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                                <TableCell className="text-xs p-1 text-center border-r border-gray-300">{index + 1}</TableCell>
                                                                <TableCell className="text-xs p-1 whitespace-nowrap border-r border-gray-300">{extraction.monthYear}</TableCell>
                                                                <TableCell className="text-xs p-1 whitespace-nowrap border-r border-gray-300">
                                                                    {extraction.extractionDate ? (
                                                                        new Date(extraction.extractionDate).toLocaleString()
                                                                    ) : (
                                                                        <span className="text-red-500">Missing</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-xs p-1 text-center border-r border-gray-300">{renderFileButton(findFile(extraction.files, 'vat3'), true, selectedCompany)}</TableCell>
                                                                <TableCell className="text-xs p-1 text-center border-r border-gray-300">{renderFileButton(findFile(extraction.files, 'sec_b_with_vat'), true, selectedCompany)}</TableCell>
                                                                <TableCell className="text-xs p-1 text-center border-r border-gray-300">{renderFileButton(findFile(extraction.files, 'sec_b_without_vat'), true, selectedCompany)}</TableCell>
                                                                <TableCell className="text-xs p-1 text-center border-r border-gray-300">{renderFileButton(findFile(extraction.files, 'sec_f'), true, selectedCompany)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    {/* Add a spacer row at the bottom to ensure visibility of all items */}
                                                    <TableRow key="detailed-spacer-row" className="h-10"></TableRow>
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
            
            {/* File Upload Modal */}
            {uploadCompany && (
                <FileUploadModal
                    isOpen={isUploadModalOpen}
                    onClose={() => {
                        setIsUploadModalOpen(false);
                        setUploadCompany(null);
                    }}
                    companyName={uploadCompany.companyName}
                    companyId={uploadCompany.id}
                    onUploadComplete={fetchReports}
                />
            )}
        </Tabs>
    );
}