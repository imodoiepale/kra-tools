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
import { Badge } from '@/components/ui/badge';
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function PINProfileReports() {
    const [reports, setReports] = useState([]);
    const [allCompanyData, setAllCompanyData] = useState([]);
    const [filteredReports, setFilteredReports] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState(null);
    const [sortOrder, setSortOrder] = useState('asc');
    const [visibleColumns, setVisibleColumns] = useState({
        company_name: true,
        company_pin: true,
        pin_profile_status: true,
        expiry_date: true,
        extraction_date: true,
        profile: true,
    });
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

    useEffect(() => {
        fetchReports();
    }, []);

    // Apply filters when search term or category filters change
    useEffect(() => {
        if (allCompanyData.length > 0) {
            applyFilters();
        }
    }, [searchTerm, categoryFilters, allCompanyData]);

    const calculateClientStatus = (fromDate, toDate) => {
        if (!fromDate || !toDate) return 'inactive';

        const today = new Date();
        const from = new Date(fromDate.split('/').reverse().join('-'));
        const to = new Date(toDate.split('/').reverse().join('-'));

        return today >= from && today <= to ? 'active' : 'inactive';
    };

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

    const fetchReports = async () => {
        try {
            // Fetch all companies from acc_portal_company_duplicate
            const { data: companiesData, error: companiesError } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .order('id', { ascending: true });

            if (companiesError) throw companiesError;

            // Fetch all PIN profiles
            const { data: profilesData, error: profilesError } = await supabase
                .from('PINProfilesAndCertificates')
                .select('*');

            if (profilesError) throw profilesError;

            // Create a map of PIN profiles by company_id for quick lookup
            const profilesMap = new Map(profilesData.map(profile => [profile.company_id, profile]));

            const formattedReports = companiesData.map(company => {
                const profile = profilesMap.get(company.id);
                const extractions = profile?.extractions || {};
                const extractionDates = Object.keys(extractions).sort((a, b) => new Date(b) - new Date(a));
                const latestDate = extractionDates[0];
                const latestExtraction = extractions[latestDate] || {};

                // Calculate client statuses
                const acc_client_status = calculateClientStatus(company.acc_client_effective_from, company.acc_client_effective_to);
                const imm_client_status = calculateClientStatus(company.imm_client_effective_from, company.imm_client_effective_to);
                const sheria_client_status = calculateClientStatus(company.sheria_client_effective_from, company.sheria_client_effective_to);
                const audit_client_status = calculateClientStatus(company.audit_client_effective_from, company.audit_client_effective_to);
                
                // Determine which categories this company belongs to
                const categories = [];
                if (company.acc_client_effective_from && company.acc_client_effective_to) categories.push('Acc');
                if (company.imm_client_effective_from && company.imm_client_effective_to) categories.push('Imm');
                if (company.sheria_client_effective_from && company.sheria_client_effective_to) categories.push('Sheria');
                if (company.audit_client_effective_from && company.audit_client_effective_to) categories.push('Audit');

                return {
                    id: company.id,
                    company_id: company.id,
                    company_name: company.company_name,
                    company_pin: company.kra_pin || <span className="text-red-500">Missing</span>,
                    pin_profile_status: profile ? 
                        (profile.company_pin === "MISSING PIN/PASSWORD" ? "Missing" : "Available") : 
                        "Not Extracted",
                    expiry_date: latestExtraction?.expiry_date || 'N/A',
                    extraction_date: profile ? 
                        formatDate(profile.updated_at || latestDate || new Date()) : 
                        'Not Extracted',
                    pdf_link: latestExtraction.pdf_link && latestExtraction.pdf_link !== "no doc" ?
                        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kra-documents/${latestExtraction.pdf_link}` : 
                        null,
                    // Add category information
                    categories,
                    acc_client_status,
                    imm_client_status,
                    sheria_client_status,
                    audit_client_status,
                    // Keep the date fields for reference
                    acc_client_effective_from: company.acc_client_effective_from,
                    acc_client_effective_to: company.acc_client_effective_to,
                    imm_client_effective_from: company.imm_client_effective_from,
                    imm_client_effective_to: company.imm_client_effective_to,
                    sheria_client_effective_from: company.sheria_client_effective_from,
                    sheria_client_effective_to: company.sheria_client_effective_to,
                    audit_client_effective_from: company.audit_client_effective_from,
                    audit_client_effective_to: company.audit_client_effective_to,
                };
            });
            
            setAllCompanyData(formattedReports);
            setReports(formattedReports);
            applyFilters(formattedReports);
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    // Add a function to filter the data based on category filters
    const applyFiltersToData = (data) => {
        if (!categoryFilters.categories || Object.keys(categoryFilters.categories).length === 0) {
            return data;
        }

        return data.filter(company => {
            // Check if "All Categories" is selected
            if (categoryFilters.categories['All Categories']) {
                return true;
            }

            // Get all selected categories
            const selectedCategories = Object.entries(categoryFilters.categories)
                .filter(([category, isSelected]) => category !== 'All Categories' && isSelected)
                .map(([category]) => category);

            // If no categories selected, show all companies
            if (selectedCategories.length === 0) {
                return true;
            }

            // Check if company belongs to ALL of the selected categories
            // and matches the status criteria for each selected category
            return selectedCategories.every(category => {
                // Check if company belongs to this category
                if (!company.categories.includes(category)) {
                    return false;
                }

                // Get the status settings for this category
                const categorySettings = categoryFilters.categorySettings?.[category];
                if (!categorySettings) {
                    return true;
                }

                // Get the client status for this category
                const clientStatus = company[`${category.toLowerCase()}_client_status`];

                // Get selected client statuses
                const selectedClientStatuses = Object.entries(categorySettings.clientStatus || {})
                    .filter(([_, isSelected]) => isSelected)
                    .map(([status]) => status.toLowerCase());

                // If "All" is selected or no specific status is selected, include all
                if (selectedClientStatuses.includes('all') || selectedClientStatuses.length === 0) {
                    return true;
                }

                // Check if company's status matches any selected status
                return selectedClientStatuses.includes(clientStatus);
            });
        });
    };

    // Apply both category and search filters
    const applyFilters = (data = allCompanyData) => {
        // First apply category filters
        let filteredData = applyFiltersToData(data);
        
        // Then apply search filter
        if (searchTerm) {
            filteredData = filteredData.filter(report => {
                const searchValue = searchTerm.toLowerCase();
                // Generic search across all fields
                const searchableFields = [
                    report.company_name,
                    typeof report.company_pin === 'string' ? report.company_pin : '',
                    typeof report.pin_profile_status === 'string' ? report.pin_profile_status : '',
                    typeof report.expiry_date === 'string' ? report.expiry_date : '',
                    typeof report.extraction_date === 'string' ? report.extraction_date : ''
                ];
                
                return searchableFields.some(field => 
                    field.toLowerCase().includes(searchValue)
                );
            });
        }
        
        setFilteredReports(filteredData);
    };

    const handleApplyFilters = (newFilters) => {
        setCategoryFilters(newFilters);
    };

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortOrder('asc');
        }
    };

    const sortedReports = [...filteredReports].sort((a, b) => {
        if (!sortColumn) return 0;
        
        const aValue = typeof a[sortColumn] === 'object' ? '' : a[sortColumn];
        const bValue = typeof b[sortColumn] === 'object' ? '' : b[sortColumn];
        
        if (!aValue && !bValue) return 0;
        if (!aValue) return 1;
        if (!bValue) return -1;
        
        // Handle dates
        if (sortColumn === 'extraction_date' || sortColumn === 'expiry_date') {
            const dateA = new Date(aValue);
            const dateB = new Date(bValue);
            
            if (!isNaN(dateA) && !isNaN(dateB)) {
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            }
        }
        
        // Default string comparison for other fields
        return sortOrder === 'asc' 
            ? String(aValue).localeCompare(String(bValue))
            : String(bValue).localeCompare(String(aValue));
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
            'pin_profile_status',
            'extraction_date',
            'pdf_link'
        ];

        // Initialize stats for each field
        fieldsToCheck.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        // Calculate stats for each field individually
        reports.forEach(report => {
            fieldsToCheck.forEach(field => {
                if (field === 'pin_profile_status') {
                    if (report[field] === 'Available') {
                        stats.complete[field]++;
                    } else {
                        stats.missing[field]++;
                    }
                } else if (field === 'pdf_link') {
                    if (report.pdf_link) {
                        stats.complete[field]++;
                    } else {
                        stats.missing[field]++;
                    }
                } else if (field === 'extraction_date') {
                    if (report[field] !== 'Not Extracted') {
                        stats.complete[field]++;
                    } else {
                        stats.missing[field]++;
                    }
                } else if (report[field] && report[field].toString().trim() !== '') {
                    stats.complete[field]++;
                } else {
                    stats.missing[field]++;
                }
            });
        });

        return stats;
    };

    const stats = calculateStats();

    const exportToExcel = async () => {
        // Here you would implement the excel export logic
        // Using ExcelJS similar to the other components
        console.log("Export to Excel functionality would go here");
        alert("Export feature would be implemented here");
    };

    return (
        <div>
            <div className="flex justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search across all fields..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 w-64"
                        />
                    </div>
                    <div className="flex space-x-2">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsCategoryFilterOpen(true)}
                        >
                            <Filter className="h-4 w-4 mr-2" />
                            Client Categories {filteredReports.length}
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
                    open={isCategoryFilterOpen}
                    onOpenChange={setIsCategoryFilterOpen}
                    onFilterChange={handleApplyFilters}
                    showSectionName=""
                    initialFilters={categoryFilters}
                    showSectionStatus={false}
                />
            </div>
            <div className="border rounded-md flex-1 flex flex-col">
                <ScrollArea className="h-[75vh]" style={{overflowY: 'auto'}}>
                    <Table>
                        <TableHeader className="sticky top-0 bg-white z-10 text-xs">
                            <TableRow>
                                {[
                                    { key: 'index', label: 'IDX | ID', alwaysVisible: true },
                                    { key: 'company_name', label: 'Company Name' },
                                    { key: 'company_pin', label: 'KRA PIN' },
                                    { key: 'pin_profile_status', label: 'Profile Status' },
                                    { key: 'extraction_date', label: 'Last Extracted' },
                                    { key: 'profile', label: 'PIN Profile', alwaysVisible: true },
                                ].map(({ key, label, alwaysVisible }) => (
                                    (alwaysVisible || visibleColumns[key]) && (
                                        <TableHead key={key} className={`font-bold border-r border-gray-300 text-xs py-1 px-2 ${key === 'index' ? 'text-center sticky left-0 bg-white' : key === 'company_name' ? '' : 'text-center'}`}>
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
                                    <TableRow className="bg-gray-100">
                                        <TableCell className="text-center text-[10px] font-bold border-r border-gray-300 sticky left-0 bg-gray-100 py-0.5">Complete</TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.complete.company_name === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.company_name}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.complete.company_pin === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.company_pin}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.complete.pin_profile_status === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.pin_profile_status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.complete.extraction_date === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.extraction_date}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.complete.pdf_link === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.pdf_link}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="bg-gray-50">
                                        <TableCell className="text-center text-[10px] font-bold border-r border-gray-300 sticky left-0 bg-gray-50 py-0.5">Missing</TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.missing.company_name > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.company_name}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.missing.company_pin > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.company_pin}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.missing.pin_profile_status > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.pin_profile_status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.missing.extraction_date > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.extraction_date}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.missing.pdf_link > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.pdf_link}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                </>
                            )}
                        </TableHeader>
                        <TableBody className="text-xs">
                            {sortedReports.length > 0 ? (
                                sortedReports.map((report, index) => (
                                    <TableRow key={report.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{height: '24px'}}>
                                        {[
                                            { key: 'index', content: (
                                                <div className="grid grid-cols-3 gap-1">
                                                    <span>{index + 1}</span>
                                                    <span>|</span>
                                                    <span>{report.id}</span>
                                                </div>
                                            ), alwaysVisible: true },
                                            { key: 'company_name', content: report.company_name },
                                            { key: 'company_pin', content: report.company_pin },
                                            { key: 'pin_profile_status', content: <span className={`text-xs ${report.pin_profile_status === 'Available' ? 'text-green-500' : report.pin_profile_status === 'Missing' ? 'text-red-500' : 'text-gray-500'}`}>{report.pin_profile_status}</span> },
                                            { key: 'extraction_date', content: <span className="text-center text-xs">{report.extraction_date}</span> },
                                            {
                                                key: 'profile',
                                                content: (
                                                    report.pdf_link ? (
                                                        <div className="flex justify-center">
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button variant='outline' className="text-blue-500 hover:underline text-[10px] px-1 py-0 h-5 flex items-center justify-center">
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
                                                        <span className="text-gray-500 text-xs flex items-center justify-center">
                                                            <Image src={report.pdf_link || ''} alt={`PIN Profile for ${report.company_name}`} className="inline-block mr-1 h-3 w-3" />
                                                            Missing
                                                        </span>
                                                    )
                                                ),
                                                alwaysVisible: true
                                            }
                                        ].map(({ key, content, alwaysVisible }) => (
                                            (alwaysVisible || visibleColumns[key]) && (
                                                <TableCell key={key} className={`border-r border-gray-300 py-0.5 px-2 text-xs ${key === 'index' ? 'font-bold text-center sticky left-0 bg-inherit' : 'whitespace-nowrap'}`}>
                                                    {content}
                                                </TableCell>
                                            )
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 2} className="text-center py-8">
                                        No records found matching your search criteria.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        {/* Spacer row to ensure last items are visible */}
                        <tr><td className="py-4"></td></tr>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    );
}