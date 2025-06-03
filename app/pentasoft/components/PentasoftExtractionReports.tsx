// @ts-nocheck
"use client"        
import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Download, MoreHorizontal, RefreshCw, Upload, Search, Filter, Eye, EyeOff } from "lucide-react";
import * as ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import FileViewer from '@/components/FileViewer';
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const STORAGE_BUCKET = 'pentasoft-reports';

// Type definitions
interface FilePreview {
    fileName: string;
    companyName: string;    
    reportType: string;
    extractionDate: string;
    fullPath: string;
}

interface ExtractionFile {
    name: string;
    fullPath: string;
}

interface ExtractionRecord {
    id: number;
    company_name: string;
    updated_at: string;
    files: {
        [monthYear: string]: {
            files: ExtractionFile[];
            extraction_date: string;
        }
    };
    categories?: string[];
    acc_client_status?: string;
    imm_client_status?: string;
    sheria_client_status?: string;
    audit_client_status?: string;
    isMissing?: boolean;
}

export function PentasoftExtractionReports() {
    // State variables
    const [reports, setReports] = useState<ExtractionRecord[]>([]);
    const [portalCompanies, setPortalCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState<ExtractionRecord | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [visibleColumns, setVisibleColumns] = useState({
        company_name: true,
        updated_at: true,
        paye: true,
        nssf: true,
        nhif: true,
        nita: true,
        house_levy: true,
    });
    const [isUploading, setIsUploading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [filesPreviews, setFilesPreviews] = useState<FilePreview[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [companySearchTerm, setCompanySearchTerm] = useState('');
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [previewFile, setPreviewFile] = useState<ExtractionFile | null>(null);
    const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
    const [categoryFilters, setCategoryFilters] = useState({
        categories: {
            'All Categories': false,
            'Acc': true,
            'Imm': false,
            'Sheria': false,
            'Audit': false
        },
        categorySettings: {
            'Acc': {
                clientStatus: {
                    All: false,
                    Active: true,
                    Inactive: false
                },
                sectionStatus: {
                    All: false,
                    Active: true,
                    Inactive: false,
                    Missing: false
                }
            }
        }
    });
    const [showStatsRows, setShowStatsRows] = useState(true);

    // Fetch reports on component mount
    useEffect(() => {
        fetchReports();
        fetchCompaniesFromPortal();
    }, []);

    const fetchCompaniesFromPortal = async () => {
        try {
            const { data, error } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .order('company_name', { ascending: true });

            if (error) throw error;
            
            // Process companies to include category information
            const processedCompanies = data.map(company => {
                // Helper function to determine if a company belongs to a category and its status
                const getCategoryStatus = (category) => {
                    const categoryId = category.toLowerCase();
                    const fromDate = company[`${categoryId}_client_effective_from`];
                    const toDate = company[`${categoryId}_client_effective_to`];

                    if (!fromDate || !toDate) return 'inactive';

                    const today = new Date();
                    const from = new Date(fromDate.split('/').reverse().join('-'));
                    const to = new Date(toDate.split('/').reverse().join('-'));

                    return today >= from && today <= to ? 'active' : 'inactive';
                };

                // Get all categories this company belongs to
                const companyCategories = ['Acc', 'Imm', 'Sheria', 'Audit'].filter(cat => {
                    const categoryId = cat.toLowerCase();
                    const fromDate = company[`${categoryId}_client_effective_from`];
                    const toDate = company[`${categoryId}_client_effective_to`];
                    return fromDate && toDate; // Company belongs if it has dates set
                });

                return {
                    ...company,
                    categories: companyCategories,
                    // Add status for each category
                    acc_client_status: getCategoryStatus('Acc'),
                    imm_client_status: getCategoryStatus('Imm'),
                    sheria_client_status: getCategoryStatus('Sheria'),
                    audit_client_status: getCategoryStatus('Audit'),
                };
            });

            setPortalCompanies(processedCompanies);
        } catch (error) {
            console.error('Error fetching portal companies:', error);
        }
    };

    // Fetch reports from Supabase
    const fetchReports = async () => {
        try {
            const { data: reportsData, error } = await supabase
                .from('pentasoft_extractions')
                .select('*')
                .order('id');

            if (error) throw error;
            setReports(reportsData);
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    // Handle sorting of reports
    const handleSort = (column: string) => {
        setSortOrder(sortColumn === column ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc');
        setSortColumn(column);
    };

    // Get merged and filtered data from portal companies and pentasoft extractions
    const getMergedAndFilteredReports = () => {
        // Start with companies from acc_portal_company_duplicate and apply filters
        const filteredPortalCompanies = portalCompanies.filter(company => {
            // Apply search filter first
            if (!company.company_name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            
            // Apply category filters
            if (Object.keys(categoryFilters.categories || {}).length > 0) {
                const selectedCategories = Object.entries(categoryFilters.categories || {})
                    .filter(([category, isSelected]) => category && category !== 'All Categories' && isSelected)
                    .map(([category]) => category);

                // If no categories selected or All Categories is selected, include all
                if (selectedCategories.length > 0 && !categoryFilters.categories?.['All Categories']) {
                    const matchesCategory = selectedCategories.some(category => {
                        // Check if company belongs to this category
                        if (!company.categories?.includes(category)) {
                            return false;
                        }

                        // Get current status for this category
                        const categoryId = category.toLowerCase();
                        const currentStatus = company[`${categoryId}_client_status`] || 'inactive';

                        // Get selected statuses from filter
                        const categorySettings = categoryFilters.categorySettings?.[category];
                        if (!categorySettings?.clientStatus) {
                            return true;
                        }

                        const selectedClientStatuses = Object.entries(categorySettings.clientStatus)
                            .filter(([_, isSelected]) => isSelected)
                            .map(([status]) => status.toLowerCase());

                        // If All is selected or no statuses selected, include all
                        if (selectedClientStatuses.includes('all') || selectedClientStatuses.length === 0) {
                            return true;
                        }

                        // Check if current status matches selected filters
                        return selectedClientStatuses.includes(currentStatus);
                    });

                    if (!matchesCategory) {
                        return false;
                    }
                }
            }
            
            return true;
        });

        // Map portal companies to pentasoft data
        return filteredPortalCompanies.map(portalCompany => {
            // Find matching pentasoft data if exists
            const matchingReport = reports.find(report => 
                report.company_name.toLowerCase() === portalCompany.company_name.toLowerCase()
            );
            
            if (matchingReport) {
                // Return report with category information
                return {
                    ...matchingReport,
                    id: portalCompany.id, // Use portal ID
                    categories: portalCompany.categories || [],
                    acc_client_status: portalCompany.acc_client_status || 'inactive',
                    imm_client_status: portalCompany.imm_client_status || 'inactive',
                    sheria_client_status: portalCompany.sheria_client_status || 'inactive',
                    audit_client_status: portalCompany.audit_client_status || 'inactive',
                };
            } else {
                // Create placeholder for company without pentasoft data
                return {
                    id: portalCompany.id,
                    company_name: portalCompany.company_name,
                    updated_at: null,
                    files: {},
                    isMissing: true,
                    categories: portalCompany.categories || [],
                    acc_client_status: portalCompany.acc_client_status || 'inactive',
                    imm_client_status: portalCompany.imm_client_status || 'inactive',
                    sheria_client_status: portalCompany.sheria_client_status || 'inactive',
                    audit_client_status: portalCompany.audit_client_status || 'inactive',
                };
            }
        });
    };

    const filteredReports = getMergedAndFilteredReports();

    // Sort reports
    const sortedReports = [...filteredReports].sort((a, b) => {
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

        const fieldsToCheck = ['company_name', 'updated_at', 'paye', 'nssf', 'nhif', 'nita', 'house_levy'];

        // Initialize stats for each field
        fieldsToCheck.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        // Calculate stats for each field individually
        filteredReports.forEach(report => {
            // Check company name
            if (report.company_name && report.company_name.trim() !== '') {
                stats.complete.company_name++;
            } else {
                stats.missing.company_name++;
            }
            
            // Check updated_at
            if (report.updated_at) {
                stats.complete.updated_at++;
            } else {
                stats.missing.updated_at++;
            }
            
            // Check files
            const fileTypes = {
                paye: 'P10 MONTHLY - PAYE',
                nssf: 'N.S.S.F MONTHLY',
                nhif: 'NHIF MONTHL',
                nita: 'NITA REVIEW',
                house_levy: 'HOUSE LEVY PREVIEW'
            };

            Object.entries(fileTypes).forEach(([key, fileType]) => {
                if (findFile(report.files, fileType)) {
                    stats.complete[key]++;
                } else {
                    stats.missing[key]++;
                }
            });
        });

        return stats;
    };

    const stats = calculateStats();

    // Export reports to Excel
    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pentasoft Extraction Reports');

        const headers = ['IDX | ID', 'Company Name', 'Last Updated At', 'PAYE', 'NSSF', 'NHIF', 'NITA', 'Housing Levy'];
        worksheet.addRow(headers);

        filteredReports.forEach((report, index) => {
            const row = [
                `${index + 1} | ${report.id}`,
                report.company_name,
                report.updated_at ? new Date(report.updated_at).toLocaleString() : 'Missing',
                findFile(report.files, 'P10 MONTHLY - PAYE')?.name || 'Missing',
                findFile(report.files, 'N.S.S.F MONTHLY')?.name || 'Missing',
                findFile(report.files, 'NHIF MONTHL')?.name || 'Missing',
                findFile(report.files, 'NITA REVIEW')?.name || 'Missing',
                findFile(report.files, 'HOUSE LEVY PREVIEW')?.name || 'Missing',
            ];
            worksheet.addRow(row);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'pentasoft_extraction_reports.xlsx';
        link.click();
    };

    // Find a specific file in the reports
    const findFile = (files: ExtractionRecord['files'], type: string) => {
        if (!files) return undefined;

        const mostRecentMonth = Object.keys(files).sort().pop();
        if (!mostRecentMonth) return undefined;

        const monthFiles = files[mostRecentMonth].files;
        return monthFiles.find(file => file.name.includes(type));
    };

    // Render file button for viewing
    const renderFileButton = (files: ExtractionFile[] | ExtractionRecord['files'], type: string) => {
        let file: ExtractionFile | undefined;

        if (Array.isArray(files)) {
            file = files.find(f => f.name.includes(type));
        } else {
            const monthYear = Object.keys(files).sort().pop();
            if (monthYear) {
                file = files[monthYear].files.find(f => f.name.includes(type));
            }
        }

        if (!file) return <span className="text-red-500 font-bold">Missing</span>;

        return (
            <FileViewer
                url={file.fullPath}
                fileType={file.type}
                title={file.originalName}
            />
        );
    };

    // Handle file download
    const handleDownload = async (file: ExtractionFile) => {
        try {
            const response = await fetch(file.fullPath);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = file.originalName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    // Preview dialog component
    const PreviewDialog = ({ file, isOpen, onClose }) => {
        const fileType = file?.type;

        const handleFileDownload = async () => {
            if (!file) return;

            try {
                const response = await fetch(file.fullPath);
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = file.originalName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadUrl);
            } catch (error) {
                console.error('Download failed:', error);
            }
        };

        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{file?.originalName}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 h-[70vh]">
                        <FileViewer
                            url={file?.fullPath}
                            fileType={fileType}
                            title={file?.originalName}
                        />
                    </div>
                    <DialogFooter>
                        <Button onClick={handleFileDownload}>
                            <Download className="mr-1 h-4 w-4" />
                            Download
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    // Handle file selection
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const previews: FilePreview[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = file.name;

            const regex = /^(.*?)-\s*(.*?)\s+(\d{2}\.\d{2}\.\d{4})(\.\w+)?$/;
            const match = fileName.match(regex);

            if (match) {
                const companyName = match[1].trim();
                const reportType = match[2].trim();
                const extractionDate = match[3].trim();

                previews.push({
                    fileName,
                    companyName,
                    reportType,
                    extractionDate,
                    fullPath: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${companyName}/${fileName}`
                });
            } else {
                console.error(`Filename "${fileName}" does not match the expected format.`);
            }
        }

        setFilesPreviews(previews);
        setIsPreviewOpen(true);
    };

    // Handle file upload
    const handleFileUpload = async () => {
        setIsUploading(true);

        try {
            const companyFilesMap = {};

            for (const preview of filesPreviews) {
                const file = Array.from(fileInputRef.current!.files!).find(f => f.name === preview.fileName);
                if (!file) continue;

                const extractionDate = new Date(preview.extractionDate);
                const monthYearFolder = `${extractionDate.toLocaleString('default', { month: 'long' })} ${extractionDate.getFullYear()}`;

                if (!companyFilesMap[preview.companyName]) {
                    companyFilesMap[preview.companyName] = {
                        files: [],
                        extractionDate: monthYearFolder,
                    };
                }

                companyFilesMap[preview.companyName].files.push({
                    file,
                    reportType: preview.reportType,
                    fullPath: preview.fullPath,
                    extractionDate: preview.extractionDate,
                });
            }

            const uploadPromises = Object.entries(companyFilesMap).map(async ([companyName, { files, extractionDate }]) => {
                const { data: existingFiles, error: fetchError } = await supabase
                    .from('pentasoft_extractions')
                    .select('*')
                    .eq('company_name', companyName);

                if (fetchError) throw fetchError;

                const filesByDate = {};
                for (const fileInfo of files) {
                    if (!filesByDate[fileInfo.extractionDate]) {
                        filesByDate[fileInfo.extractionDate] = [];
                    }
                    filesByDate[fileInfo.extractionDate].push(fileInfo);
                }

                for (const [date, dateFiles] of Object.entries(filesByDate)) {
                    const uploadedFiles = await Promise.all(dateFiles.map(async ({ file, reportType, fullPath }) => {
                        const { data, error: uploadError } = await supabase.storage
                            .from(STORAGE_BUCKET)
                            .upload(`${companyName}/${extractionDate}/${file.name}`, file, {
                                contentType: file.type,
                            });

                        if (uploadError) {
                            console.error(`Error uploading ${file.name}:`, uploadError);
                            return null;
                        }

                        return { name: reportType, path: data.path, fullPath };
                    }));

                    const filteredUploadedFiles = uploadedFiles.filter(file => file !== null);

                    if (existingFiles && existingFiles.length > 0) {
                        const existingFileEntry = existingFiles[0];
                        const updatedFiles = [
                            ...existingFileEntry.files.filter(file => file.extractionDate !== date),
                            ...filteredUploadedFiles.map(file => ({ ...file, extractionDate: date }))
                        ];

                        const { error: updateError } = await supabase
                            .from('pentasoft_extractions')
                            .update({
                                files: updatedFiles,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existingFileEntry.id);

                        if (updateError) throw updateError;
                    } else {
                        const { error: insertError } = await supabase
                            .from('pentasoft_extractions')
                            .insert({
                                company_name: companyName,
                                files: filteredUploadedFiles.map(file => ({ ...file, extractionDate: date })),
                                updated_at: new Date().toISOString()
                            });

                        if (insertError) throw insertError;
                    }
                }
            });

            await Promise.all(uploadPromises);
            await fetchReports();
            setIsPreviewOpen(false);
            setFilesPreviews([]);
        } catch (error) {
            console.error('Error uploading files:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleApplyFilters = (newFilters) => {
        setCategoryFilters(newFilters);
    };

    const handleClearFilters = () => {
        setCategoryFilters({
            categories: {},
            categorySettings: {}
        });
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
                        <Input
                            placeholder="Search companies..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                        <Button variant="outline" onClick={() => setIsCategoryFilterOpen(true)} size="sm" className="px-2 py-1">
                            <Filter className="mr-1 h-4 w-4" />
                            Categories
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => setShowStatsRows(!showStatsRows)} 
                            size="sm"
                            className="px-2 py-1"
                        >
                            {showStatsRows ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                            {showStatsRows ? 'Hide Stats' : 'Show Stats'}
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={exportToExcel} size="sm" className="px-2 py-1">
                            <Download className="mr-1 h-4 w-4" />
                            Export to Excel
                        </Button>
                        <Button onClick={fetchReports} size="sm" className="px-2 py-1">
                            <RefreshCw className="mr-1 h-4 w-4" />
                            Refresh
                        </Button>
                        <Button onClick={() => fileInputRef.current?.click()} size="sm" className="px-2 py-1">
                            <Upload className="mr-1 h-4 w-4" />
                            Select Files
                        </Button>
                        <Input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                            multiple
                        />
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
                    open={isCategoryFilterOpen} 
                    onOpenChange={setIsCategoryFilterOpen} 
                    onFilterChange={handleApplyFilters}
                    showSectionName=""
                    initialFilters={categoryFilters}
                    showSectionStatus={false}
                />
                <div className="border rounded-md mb-2">
                    <ScrollArea className="h-[60vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {[
                                        { key: 'index', label: 'IDX | ID', alwaysVisible: true },
                                        { key: 'company_name', label: 'Company Name' },
                                        { key: 'updated_at', label: 'Last Updated At' },
                                        { key: 'paye', label: 'PAYE' },
                                        { key: 'nssf', label: 'NSSF' },
                                        { key: 'nhif', label: 'NHIF' },
                                        { key: 'nita', label: 'NITA' },
                                        { key: 'house_levy', label: 'Housing Levy' },
                                    ].map(({ key, label, alwaysVisible }) => (
                                        (alwaysVisible || visibleColumns[key]) && (
                                            <TableHead key={key} className="border-r border-gray-300">
                                                <div className="flex items-center">
                                                    {label}
                                                    {!['index', 'paye', 'nssf', 'nhif', 'nita', 'house_levy'].includes(key) && (
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
                                        <TableRow className="bg-blue-50">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-gray-300">Complete</TableCell>
                                            {['company_name', 'updated_at', 'paye', 'nssf', 'nhif', 'nita', 'house_levy'].map((column) => {
                                                if (!visibleColumns[column]) return null;
                                                const count = stats.complete[column] || 0;
                                                const total = filteredReports.length;
                                                const isComplete = count === total;
                                                
                                                return (
                                                    <TableCell key={`complete-${column}`} className="text-center text-[10px] border-r border-gray-300">
                                                        <span className={isComplete ? 'text-green-600 font-bold' : ''}>
                                                            {count}
                                                        </span>
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                        <TableRow className="bg-red-50">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-gray-300">Missing</TableCell>
                                            {['company_name', 'updated_at', 'paye', 'nssf', 'nhif', 'nita', 'house_levy'].map((column) => {
                                                if (!visibleColumns[column]) return null;
                                                const count = stats.missing[column] || 0;
                                                const hasAny = count > 0;
                                                
                                                return (
                                                    <TableCell key={`missing-${column}`} className="text-center text-[10px] border-r border-gray-300">
                                                        <span className={hasAny ? 'text-red-600 font-bold' : ''}>
                                                            {count}
                                                        </span>
                                                        </TableCell>
                                               );
                                           })}
                                       </TableRow>
                                   </>
                               )}
                           </TableHeader>
                           <TableBody>
                               {sortedReports.map((report, index) => (
                                   <TableRow key={report.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'} ${report.isMissing ? 'bg-red-100' : ''}`}>
                                       <TableCell className="border-r border-gray-300">
                                           <div className="grid grid-cols-3 gap-1">
                                               <span>{index + 1}</span>
                                               <span>|</span>
                                               <span>{report.id}</span>
                                           </div>
                                       </TableCell>
                                       {visibleColumns.company_name && <TableCell className="border-r border-gray-300">{report.company_name}</TableCell>}
                                       {visibleColumns.updated_at && (
                                           <TableCell className="border-r border-gray-300">
                                               {report.updated_at ? new Date(report.updated_at).toLocaleString() : 'Missing'}
                                           </TableCell>
                                       )}
                                       {visibleColumns.paye && <TableCell className="border-r border-gray-300">{renderFileButton(report.files, 'P10 MONTHLY - PAYE')}</TableCell>}
                                       {visibleColumns.nssf && <TableCell className="border-r border-gray-300">{renderFileButton(report.files, 'N.S.S.F MONTHLY')}</TableCell>}
                                       {visibleColumns.nhif && <TableCell className="border-r border-gray-300">{renderFileButton(report.files, 'NHIF MONTHL')}</TableCell>}
                                       {visibleColumns.nita && <TableCell className="border-r border-gray-300">{renderFileButton(report.files, 'NITA REVIEW')}</TableCell>}
                                       {visibleColumns.house_levy && <TableCell className="border-r border-gray-300">{renderFileButton(report.files, 'HOUSE LEVY PREVIEW')}</TableCell>}
                                   </TableRow>
                               ))}
                           </TableBody>
                       </Table>
                   </ScrollArea>
               </div>
               <PreviewDialog
                   file={previewFile}
                   isOpen={previewDialogOpen}
                   onClose={() => setPreviewDialogOpen(false)}
               />
           </TabsContent>
           <TabsContent value="detailed">
               <div className="flex space-x-8 mb-4">
                   <div className="w-85">
                       <div className="relative mb-2">
                           <div className="flex items-center justify-between mb-1">
                               <span className="text-xs font-medium">Companies</span>
                               <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded">
                                   {filteredReports.length}
                               </span>
                           </div>
                           <Input
                               placeholder="Search companies..."
                               value={companySearchTerm}
                               onChange={(e) => setCompanySearchTerm(e.target.value)}
                               className="pl-8 text-xs"
                           />
                           <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                       </div>
                       <ScrollArea className="h-[600px] rounded-md border">
                           {filteredReports
                               .filter(report => report.company_name.toLowerCase().includes(companySearchTerm.toLowerCase()))
                               .map((report, index) => (
                               <React.Fragment key={report.id}>
                                   <div
                                       className={`p-2 cursor-pointer transition-colors duration-200 text-xs uppercase ${selectedCompany?.id === report.id
                                           ? 'bg-blue-500 text-white font-bold'
                                           : report.isMissing
                                               ? 'bg-red-100 hover:bg-red-200'
                                               : 'hover:bg-blue-100'
                                           }`}
                                       onClick={() => setSelectedCompany(report)}
                                   >
                                       <div className="font-medium">
                                           <span className="text-[10px] text-gray-500 mr-1">#{report.id}</span>
                                           {report.company_name}
                                       </div>
                                       {/* Display category badges */}
                                       {report.categories && report.categories.length > 0 && (
                                           <div className="flex flex-wrap gap-1 mt-1">
                                               {report.categories.map(category => (
                                                   <span 
                                                       key={category}
                                                       className={`text-[8px] px-1 py-0.5 rounded ${
                                                           report[`${category.toLowerCase()}_client_status`] === 'active' 
                                                               ? 'bg-green-200 text-green-800' 
                                                               : 'bg-red-200 text-red-800'
                                                       }`}
                                                   >
                                                       {category}
                                                   </span>
                                               ))}
                                           </div>
                                       )}
                                       {report.isMissing && (
                                           <span className="text-[8px] text-red-500 font-bold">No Data</span>
                                       )}
                                   </div>
                                   {index < filteredReports.length - 1 && (
                                       <div className="border-b border-gray-200"></div>
                                   )}
                               </React.Fragment>
                           ))}
                       </ScrollArea>
                   </div>
                   <div className="flex-1">
                       {selectedCompany && (
                           <Card className="shadow-lg">
                               <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                                   <CardTitle className="text-xl">
                                       {selectedCompany.company_name}
                                       {/* Display category information in header */}
                                       {selectedCompany.categories && selectedCompany.categories.length > 0 && (
                                           <div className="flex flex-wrap gap-2 mt-2">
                                               {selectedCompany.categories.map(category => (
                                                   <span 
                                                       key={category}
                                                       className={`text-sm px-2 py-1 rounded ${
                                                           selectedCompany[`${category.toLowerCase()}_client_status`] === 'active' 
                                                               ? 'bg-green-200 text-green-800' 
                                                               : 'bg-red-200 text-red-800'
                                                       }`}
                                                   >
                                                       {category} ({selectedCompany[`${category.toLowerCase()}_client_status`]})
                                                   </span>
                                               ))}
                                           </div>
                                       )}
                                   </CardTitle>
                               </CardHeader>
                               <CardContent className="space-y-6">
                                   <ScrollArea className="h-[600px]">
                                       {selectedCompany.isMissing ? (
                                           <div className="text-center py-8 text-gray-500">
                                               No Pentasoft extraction data found for this company.
                                           </div>
                                       ) : (
                                           <div className="space-y-4">
                                               <Table>
                                                   <TableHeader>
                                                       <TableRow>
                                                           <TableHead className="text-xs text-center border-r border-gray-300">Index</TableHead>
                                                           <TableHead className="text-xs border-r border-gray-300">Month</TableHead>
                                                           <TableHead className="text-xs text-center border-r border-gray-300">PAYE</TableHead>
                                                           <TableHead className="text-xs text-center border-r border-gray-300">NSSF</TableHead>
                                                           <TableHead className="text-xs text-center border-r border-gray-300">NHIF</TableHead>
                                                           <TableHead className="text-xs text-center border-r border-gray-300">NITA</TableHead>
                                                           <TableHead className="text-xs text-center border-r border-gray-300">Housing Levy</TableHead>
                                                       </TableRow>
                                                   </TableHeader>
                                                   <TableBody>
                                                       {Object.entries(selectedCompany.files || {}).map(([monthYear, extraction], index) => (
                                                           <TableRow key={monthYear} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                               <TableCell className="text-xs p-1 text-center border-r border-gray-300">{index + 1}</TableCell>
                                                               <TableCell className="text-xs p-1 whitespace-nowrap border-r border-gray-300">{monthYear}</TableCell>
                                                               <TableCell className="text-xs p-1 text-center border-r border-gray-300">
                                                                   {renderFileButton(extraction.files, 'P10 MONTHLY - PAYE')}
                                                               </TableCell>
                                                               <TableCell className="text-xs p-1 text-center border-r border-gray-300">
                                                                   {renderFileButton(extraction.files, 'N.S.S.F MONTHLY')}
                                                               </TableCell>
                                                               <TableCell className="text-xs p-1 text-center border-r border-gray-300">
                                                                   {renderFileButton(extraction.files, 'NHIF MONTHL')}
                                                               </TableCell>
                                                               <TableCell className="text-xs p-1 text-center border-r border-gray-300">
                                                                   {renderFileButton(extraction.files, 'NITA REVIEW')}
                                                               </TableCell>
                                                               <TableCell className="text-xs p-1 text-center border-r border-gray-300">
                                                                   {renderFileButton(extraction.files, 'HOUSE LEVY PREVIEW')}
                                                               </TableCell>
                                                           </TableRow>
                                                       ))}
                                                       {/* Add a spacer row at the bottom to ensure visibility of all items */}
                                                       <TableRow key="detailed-spacer-row" className="h-10"></TableRow>
                                                   </TableBody>
                                               </Table>
                                           </div>
                                       )}
                                   </ScrollArea>
                               </CardContent>
                           </Card>
                       )}
                   </div>
               </div>
           </TabsContent>
           <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
               <DialogContent className="max-w-6xl">
                   <DialogHeader>
                       <DialogTitle>Preview of Files to Upload</DialogTitle>
                   </DialogHeader>

                   <ScrollArea className="h-[400px] mt-4 text-[9px]">
                       <p className="mb-2">Storage Bucket: {STORAGE_BUCKET}</p>
                       <Table>
                           <TableHeader>
                               <TableRow>
                                   <TableHead>File Name</TableHead>
                                   <TableHead>Company Name</TableHead>
                                   <TableHead>Report Type</TableHead>
                                   <TableHead>Extraction Date</TableHead>
                                   <TableHead>Full Path</TableHead>
                               </TableRow>
                           </TableHeader>
                           <TableBody>
                               {filesPreviews.map((preview, index) => (
                                   <TableRow key={index}>
                                       <TableCell>{preview.fileName}</TableCell>
                                       <TableCell>{preview.companyName}</TableCell>
                                       <TableCell>{preview.reportType}</TableCell>
                                       <TableCell>{preview.extractionDate}</TableCell>
                                       <TableCell className="truncate max-w-xs" title={preview.fullPath}>
                                           {preview.fullPath}
                                       </TableCell>
                                   </TableRow>
                               ))}
                           </TableBody>
                       </Table>
                   </ScrollArea>

                   <DialogFooter>
                       <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                           Cancel
                       </Button>
                       <Button onClick={handleFileUpload} disabled={isUploading}>
                           {isUploading ? 'Uploading...' : 'Confirm Upload'}
                       </Button>
                   </DialogFooter>
               </DialogContent>
           </Dialog>
       </Tabs>
   );
}