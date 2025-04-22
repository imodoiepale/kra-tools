// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { createClient } from '@supabase/supabase-js';
import { Input } from "@/components/ui/input";
import { Download, MoreHorizontal, ArrowUpDown, Eye, RefreshCw, Search, Image, Filter, EyeOff } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClientCategoryFilter } from "@/components/ClientCategoryFilter";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function PINProfileReports() {
    const [reports, setReports] = useState([]);
    const [filteredReports, setFilteredReports] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState(null);
    const [sortOrder, setSortOrder] = useState('asc');
    const [visibleColumns, setVisibleColumns] = useState({
        company_name: true,
        company_pin: true,
        expiry_date: true,
        extraction_date: true,
        profile: true,
    });
    const [clientCategories, setClientCategories] = useState([]);
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [categoryFilters, setCategoryFilters] = useState({});
    const [showStatsRows, setShowStatsRows] = useState(true);

    

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const { data, error } = await supabase
                .from('PINProfilesAndCertificates')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;

            const formattedReports = data.map(company => {
                const extractions = company.extractions;
                const extractionDates = Object.keys(extractions).sort((a, b) => new Date(b) - new Date(a));
                const latestDate = extractionDates[0];
                const latestExtraction = extractions[latestDate] || {};
                
                // Extract client category if available
                const client_category = company.client_category || '';

                const formatDate = (dateString) => {
                    const date = new Date(dateString);
                    return date.toLocaleString('en-US', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    }).replace(/,/g, '').replace(/\//g, '.').toUpperCase();
                };

                return {
                    id: company.id,
                    company_name: company.company_name,
                    company_pin: company.company_pin === "MISSING PIN/PASSWORD" ? "Missing" : company.company_pin,
                    expiry_date: latestExtraction?.expiry_date || 'N/A',
                    extraction_date: formatDate(company.updated_at || latestDate || new Date()),
                    pdf_link: latestExtraction.pdf_link && latestExtraction.pdf_link !== "no doc"
                        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kra-documents/${latestExtraction.pdf_link}`
                        : null,
                    client_category: client_category
                };
            });

            // Extract unique client categories
            const categories = [
                ...new Set(formattedReports.map(report => report.client_category).filter(Boolean)),
            ];
            setClientCategories(categories);
            
            setReports(formattedReports);
            setFilteredReports(formattedReports);
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    // Filter and sort reports whenever search term, sort config or categoryFilters changes
    useEffect(() => {
        let result = [...reports];

        // Apply client category/status filter
        if (Object.keys(categoryFilters).length > 0) {
            result = result.filter((report) => {
                // For each category, check if any status is checked
                return Object.entries(categoryFilters).some(([cat, statuses]) => {
                    if (!report.client_category) return false;
                    if (cat === "all") return Object.values(statuses).some(Boolean); // "All Categories" checked
                    if (report.client_category.toLowerCase() !== cat) return false;
                    return Object.entries(statuses).some(([status, checked]) => checked);
                });
            });
        }

        // Apply search filter
        if (searchTerm) {
            const lowercasedSearch = searchTerm.toLowerCase();
            result = result.filter(
                (report) =>
                    (report.company_name || '').toLowerCase().includes(lowercasedSearch) ||
                    (report.company_pin || '').toLowerCase().includes(lowercasedSearch)
            );
        }

        setFilteredReports(result);
    }, [reports, searchTerm, categoryFilters]);

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortOrder('asc');
        }
    };

    const sortedReports = [...filteredReports].sort((a, b) => {
        if (sortColumn) {
            const orderMultiplier = sortOrder === 'asc' ? 1 : -1;
            if (!a[sortColumn] && !b[sortColumn]) return 0;
            if (!a[sortColumn]) return 1;
            if (!b[sortColumn]) return -1;
            return a[sortColumn].toString().localeCompare(b[sortColumn].toString()) * orderMultiplier;
        }
        return 0;
    });
    
    // Calculate statistics for complete and missing entries
    const calculateStats = () => {
        const stats = {
            complete: {},
            missing: {}
        };

        // Define fields to check for completeness
        const fieldsToCheck = [
            'company_name',
            'company_pin',
            'expiry_date',
            'extraction_date',
            'pdf_link'
        ];

        // Initialize stats for each field
        fieldsToCheck.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        // Calculate stats for each field individually
        filteredReports.forEach(report => {
            fieldsToCheck.forEach(field => {
                if (report[field] && report[field].toString().trim() !== '') {
                    stats.complete[field]++;
                } else {
                    stats.missing[field]++;
                }
            });
        });

        return stats;
    };

    const stats = calculateStats();

    const exportToExcel = () => {
        // Implement Excel export logic here
    };

    return (
        <div>
            <div className="flex justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 w-64"
                        />
                    </div>
                    <div className="flex space-x-2">
                        <Button variant="outline" onClick={() => setFilterDialogOpen(true)}>
                            <Filter className="h-4 w-4 mr-2" />
                            Category Filter
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => setShowStatsRows(!showStatsRows)}
                        >
                            {showStatsRows ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                            {showStatsRows ? 'Hide Stats' : 'Show Stats'}
                        </Button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={exportToExcel} size="sm">
                        <Download className="mr-2 h-3 w-3" />
                        Export to Excel
                    </Button>
                    <Button onClick={fetchReports} size="sm">
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Refresh
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="ml-auto" size="sm">
                                Columns <MoreHorizontal className="ml-2 h-3 w-3" />
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
                <ClientCategoryFilter
                    isOpen={filterDialogOpen}
                    onClose={() => setFilterDialogOpen(false)}
                    onApplyFilters={(filters) => {
                        setCategoryFilters(filters);
                        setFilterDialogOpen(false);
                    }}
                    onClearFilters={() => {
                        setCategoryFilters({});
                    }}
                    selectedFilters={categoryFilters}
                />
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
                                    { key: 'extraction_date', label: 'Last Extracted' },
                                    { key: 'profile', label: 'PIN Profile', alwaysVisible: true },
                                ].map(({ key, label, alwaysVisible }) => (
                                    (alwaysVisible || visibleColumns[key]) && (
                                        <TableHead key={key} className={`font-bold border-r border-black ${key === 'index' ? 'text-center sticky left-0 bg-white' : key === 'company_name' ? '' : 'text-center'}`}>
                                            <div className={`flex items-center ${key === 'company_name' ? '' : 'justify-center'}`}>
                                                {label}
                                                {key !== 'profile' && (
                                                    <ArrowUpDown className="h-4 w-4 cursor-pointer ml-2" onClick={() => handleSort(key)} />
                                                )}
                                            </div>
                                        </TableHead>
                                    )
                                ))}
                            </TableRow>
                            {showStatsRows && (
                                <>
                                    <TableRow className="bg-blue-50">
                                        <TableCell className="text-center text-[10px] font-bold border-r border-black sticky left-0 bg-blue-50">Complete</TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-black">
                                            <span className={stats.complete.company_name === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.company_name}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-black">
                                            <span className={stats.complete.company_pin === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.company_pin}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-black">
                                            <span className={stats.complete.extraction_date === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.extraction_date}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-black">
                                            <span className={stats.complete.pdf_link === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.pdf_link}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="bg-red-50">
                                        <TableCell className="text-center text-[10px] font-bold border-r border-black sticky left-0 bg-red-50">Missing</TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-black">
                                            <span className={stats.missing.company_name > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.company_name}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-black">
                                            <span className={stats.missing.company_pin > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.company_pin}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-black">
                                            <span className={stats.missing.extraction_date > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.extraction_date}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-black">
                                            <span className={stats.missing.pdf_link > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.pdf_link}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                </>
                            )}
                        </TableHeader>
                        <TableBody>
                            {sortedReports.map((report, index) => (
                                <TableRow key={report.id} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                    {[
                                        { key: 'index', content: index + 1, alwaysVisible: true },
                                        { key: 'company_name', content: report.company_name },
                                        { key: 'company_pin', content: report.company_pin === "MISSING PIN/PASSWORD" ? <span className="text-red-500">Missing</span> : report.company_pin },
                                        { key: 'extraction_date', content: <span className="text-center">{report.extraction_date}</span> },
                                        {
                                            key: 'profile',
                                            content: (
                                                report.pdf_link ? (
                                                    <div className="flex justify-center">
                                                        <Dialog>
                                                            <DialogTrigger asChild>


                                                                <Button variant='outline' className="text-blue-500 hover:underline text-xs px-1.5 py-0.5 flex items-center justify-center">
                                                                    <Eye className="inline-block mr-1 h-2.5 w-2.5" />
                                                                    View PIN Profile
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="w-full max-w-5xl max-h-[90vh]">
                                                                <DialogHeader>
                                                                    <DialogTitle>PIN Profile Document</DialogTitle>
                                                                </DialogHeader>
                                                                <iframe
                                                                    src={`${report.pdf_link}#toolbar=0&navpanes=0&view=FitH&zoom=40&embedded=true`}
                                                                    className="w-full h-[80vh]"
                                                                />
                                                            </DialogContent>
                                                        </Dialog>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-500 flex items-center justify-center">
                                                        <Image src={report.pdf_link || ''} alt={`PIN Profile for ${report.company_name}`} className="inline-block mr-1 h-4 w-4" />
                                                        Missing
                                                    </span>
                                                )
                                            ),
                                            alwaysVisible: true
                                        }
                                    ].map(({ key, content, alwaysVisible }) => (
                                        (alwaysVisible || visibleColumns[key]) && (
                                            <TableCell key={key} className={`border-r border-black ${key === 'index' ? 'font-bold text-center sticky left-0 bg-inherit' : ''}`}>
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
        </div>
    );
}
