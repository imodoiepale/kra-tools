// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { createClient } from '@supabase/supabase-js';
import { Input } from "@/components/ui/input";
import { Download, MoreHorizontal, ArrowUpDown, Eye, EyeOff, RefreshCw, Search, Image, Play, Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function PINCertificateReports() {
    const [reports, setReports] = useState([]);
    const [allCompanyData, setAllCompanyData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState(null);
    const [sortOrder, setSortOrder] = useState('asc');
    const [showStatsRows, setShowStatsRows] = useState(true);
    const [visibleColumns, setVisibleColumns] = useState({
        company_name: true,
        company_pin: true,
        pin_certificate_status: true,
        expiry_date: true,
        extraction_date: true,
        certificate: true,
        actions: true,
    });
    const [selectedReports, setSelectedReports] = useState([]);
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

    useEffect(() => {
        fetchReports();
    }, []);

    useEffect(() => {
        // Apply filters when category filters or search term changes
        if (allCompanyData.length > 0) {
            applyFilters();
        }
    }, [allCompanyData, categoryFilters, searchTerm]);

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

    const calculateClientStatus = (fromDate, toDate) => {
        if (!fromDate || !toDate) return 'inactive';

        const today = new Date();
        const from = new Date(fromDate.split('/').reverse().join('-'));
        const to = new Date(toDate.split('/').reverse().join('-'));

        return today >= from && today <= to ? 'active' : 'inactive';
    };

    const fetchReports = async () => {
        try {
            // Fetch all companies from acc_portal_company_duplicate
            const { data: companiesData, error: companiesError } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .order('id', { ascending: true });

            if (companiesError) throw companiesError;

            // Fetch all PIN certificates
            const { data: certificatesData, error: certificatesError } = await supabase
                .from('PINCertificates')
                .select('*');

            if (certificatesError) throw certificatesError;

            // Create a map of PIN certificates by company_id for quick lookup
            const certificatesMap = new Map(certificatesData.map(cert => [cert.company_id, cert]));

            const formattedReports = companiesData.map(company => {
                const certificate = certificatesMap.get(company.id);
                const extractions = certificate?.extractions || {};
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
                    pin_certificate_status: certificate ?
                        (certificate.company_pin === "MISSING PIN/PASSWORD" ? "Missing" : "Available") :
                        "Not Extracted",
                    expiry_date: latestExtraction?.expiry_date || 'N/A',
                    extraction_date: certificate ?
                        formatDate(certificate.updated_at || latestDate || new Date()) :
                        "Not Extracted",
                    pdf_link: latestExtraction.pdf_link && latestExtraction.pdf_link !== "no doc" ?
                        `${latestExtraction.pdf_link}` : null,
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
            applyFilters(formattedReports);
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    // Function to filter data based on categories and status
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
                    report.company_pin !== null ? report.company_pin.toString() : '',
                    report.pin_certificate_status,
                    report.expiry_date,
                    report.extraction_date
                ];

                return searchableFields.some(field =>
                    field && field.toString().toLowerCase().includes(searchValue)
                );
            });
        }

        setReports(filteredData);

        // Update selected reports to only include reports that are still in the filtered list
        setSelectedReports(prev => prev.filter(id => filteredData.some(report => report.id === id)));
    };

    const handleApplyFilters = (newFilters) => {
        setCategoryFilters(newFilters);
    };



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
            'pin_certificate_status',
            'extraction_date',
            'certificate'
        ];

        // Initialize stats for each field
        fieldsToCheck.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        // Calculate stats for each field individually
        reports.forEach(report => {
            fieldsToCheck.forEach(field => {
                if (field === 'pin_certificate_status') {
                    if (report[field] === 'Available') {
                        stats.complete[field]++;
                    } else {
                        stats.missing[field]++;
                    }
                } else if (field === 'certificate') {
                    if (report.pdf_link) {
                        stats.complete[field]++;
                    } else {
                        stats.missing[field]++;
                    }
                } else if (field === 'extraction_date') {
                    if (report.pdf_link) {
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

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortOrder('asc');
        }
    };

    const sortedReports = [...reports].sort((a, b) => {
        if (sortColumn) {
            const orderMultiplier = sortOrder === 'asc' ? 1 : -1;

            // Handle different types of values
            let aValue = a[sortColumn];
            let bValue = b[sortColumn];

            // Special handling for certificate column
            if (sortColumn === 'certificate') {
                // Sort based on whether pdf_link exists
                aValue = a.pdf_link ? 'Available' : 'Missing';
                bValue = b.pdf_link ? 'Available' : 'Missing';
            }

            // Handle dates
            if (sortColumn === 'extraction_date' || sortColumn === 'expiry_date') {
                const dateA = new Date(aValue);
                const dateB = new Date(bValue);

                if (!isNaN(dateA) && !isNaN(dateB)) {
                    return (dateA - dateB) * orderMultiplier;
                }
            }

            // Handle strings and other values
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return aValue.localeCompare(bValue) * orderMultiplier;
            }

            // Handle cases where one value is a React element (like the "Missing" span)
            return String(aValue).localeCompare(String(bValue)) * orderMultiplier;
        }
        return 0;
    });

    const exportToExcel = () => {
        // Only export visible columns and respect current filters/sorting
        const visibleFields = [
            { key: 'index', label: 'Index' },
            { key: 'id', label: 'ID' },
            { key: 'company_name', label: 'Company Name' },
            { key: 'company_pin', label: 'KRA PIN' },
            { key: 'pin_certificate_status', label: 'Certificate Status' },
            { key: 'extraction_date', label: 'Last Extracted' },
        ].filter(field => field.key === 'index' || field.key === 'id' || visibleColumns[field.key]);

        // Convert the filtered and sorted data to CSV format
        const csvContent = [
            // Header row
            visibleFields.map(field => field.label).join(','),
            // Data rows
            ...sortedReports.map((report, idx) => {
                return visibleFields.map(field => {
                    if (field.key === 'index') return idx + 1;
                    if (field.key === 'id') return report.id;

                    let value = report[field.key];
                    // Handle React elements and complex objects
                    if (React.isValidElement(value)) {
                        // Extract text content from status spans
                        value = field.key === 'pin_certificate_status' ?
                            report.pin_certificate_status :
                            String(value.props.children);
                    }
                    // Escape commas and quotes
                    value = String(value).replace(/"/g, '""');
                    return `"${value}"`;
                }).join(',');
            })
        ].join('\n');

        // Create a Blob and download the file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `pin_certificates_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const runAutomation = async (companyIds) => {
        try {
            const response = await fetch('/api/pin-certificate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', companyIds }),
            });
            const data = await response.json();
            console.log('Automation started:', data);
            // You might want to update the UI to reflect that the automation has started
        } catch (error) {
            console.error('Error starting automation:', error);
        }
    };

    const runSelectedAutomations = () => {
        runAutomation(selectedReports);
    };

    const runMissingAutomations = () => {
        const missingReports = reports.filter(report => !report.pdf_link).map(report => report.id);
        runAutomation(missingReports);
    };

    const toggleSelectAll = (checked) => {
        if (checked) {
            setSelectedReports(reports.map(report => report.id));
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

    return (
        <div>
            <div className="flex justify-between mb-4">
                <div className="flex space-x-2">
                    <Input
                        placeholder="Search across all fields..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-80"
                    />
                    <Button
                        onClick={() => setIsCategoryFilterOpen(true)}
                        variant="outline"
                        size="sm"
                        className="flex items-center"
                    >
                        <Filter className="h-4 w-4 mr-1" />
                        Categories {reports.length}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowStatsRows(!showStatsRows)}
                    >
                        {showStatsRows ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                        {showStatsRows ? 'Hide Stats' : 'Show Stats'}
                    </Button>
                    <ClientCategoryFilter
                        open={isCategoryFilterOpen}
                        onOpenChange={setIsCategoryFilterOpen}
                        onFilterChange={handleApplyFilters}
                        showSectionName=""
                        initialFilters={categoryFilters}
                        showSectionStatus={false}
                    />
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
                    <Button onClick={runSelectedAutomations} size="sm" disabled={selectedReports.length === 0}>
                        <Play className="mr-2 h-3 w-3" />
                        Run Selected ({selectedReports.length})
                    </Button>
                    <Button onClick={runMissingAutomations} size="sm">
                        <Play className="mr-2 h-3 w-3" />
                        Run Missing
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
            </div>
            <div className="border rounded-md flex-1 flex flex-col">
                <ScrollArea className="h-[75vh]" style={{ overflowY: 'auto' }}>
                    <Table>
                        <TableHeader className="sticky top-0 bg-white z-10 text-xs">
                            <TableRow>
                                <TableHead className="border-r border-gray-300 text-xs py-1 px-2">
                                    <Checkbox
                                        checked={selectedReports.length === reports.length && reports.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </TableHead>
                                {[
                                    { key: 'index', label: 'IDX | ID', alwaysVisible: true },
                                    { key: 'company_name', label: 'Company Name' },
                                    { key: 'company_pin', label: 'KRA PIN' },
                                    { key: 'pin_certificate_status', label: 'Certificate Status' },
                                    { key: 'extraction_date', label: 'Last Extracted' },
                                    { key: 'certificate', label: 'PIN Certificate', alwaysVisible: true },
                                    { key: 'actions', label: 'Actions', alwaysVisible: true },
                                ].map(({ key, label, alwaysVisible }) => (
                                    (alwaysVisible || visibleColumns[key]) && (
                                        <TableHead key={key} className={`font-bold border-r border-gray-300 text-xs py-1 px-2 ${key === 'index' ? 'text-center sticky left-0 bg-white' : key === 'company_name' ? '' : 'text-center'}`}>
                                            <div className={`flex items-center ${key === 'company_name' ? '' : 'justify-center'}`}>
                                                {label}
                                                {key !== 'index' && !['actions'].includes(key) && (
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
                                        <TableCell className="text-center text-[10px] font-bold border-r border-gray-300 sticky left-0 bg-gray-100 py-0.5"></TableCell>
                                        <TableCell className="text-center text-[10px] font-bold border-r border-gray-300 sticky left-0 bg-gray-100 py-0.5">Complete</TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.complete.company_name === reports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.company_name}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.complete.company_pin === reports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.company_pin}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.complete.pin_certificate_status === reports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.pin_certificate_status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.complete.extraction_date === reports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.extraction_date}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.complete.certificate === reports.length ? 'text-green-600 font-bold' : ''}>
                                                {stats.complete.certificate}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span>-</span>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="bg-gray-50">
                                        <TableCell className="text-center text-[10px] font-bold border-r border-gray-300 sticky left-0 bg-gray-50 py-0.5"></TableCell>
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
                                            <span className={stats.missing.pin_certificate_status > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.pin_certificate_status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.missing.extraction_date > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.extraction_date}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span className={stats.missing.certificate > 0 ? 'text-red-600 font-bold' : ''}>
                                                {stats.missing.certificate}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-[10px] border-r border-gray-300 py-0.5">
                                            <span>-</span>
                                        </TableCell>
                                    </TableRow>
                                </>
                            )}

                        </TableHeader>
                        <TableBody className="text-xs">
                            {sortedReports.length > 0 ? (
                                sortedReports.map((report, index) => (
                                    <TableRow key={report.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '24px' }}>
                                        <TableCell className="border-r border-gray-300 py-0.5 px-2 text-xs">
                                            <Checkbox
                                                checked={selectedReports.includes(report.id)}
                                                onCheckedChange={() => toggleSelectReport(report.id)}
                                            />
                                        </TableCell>
                                        {[
                                            {
                                                key: 'index', content: <div className="grid grid-cols-3 gap-1">
                                                    <span>{index + 1}</span>
                                                    <span>|</span>
                                                    <span>{report.id}</span>
                                                </div>, alwaysVisible: true
                                            },
                                            { key: 'company_name', content: report.company_name },
                                            { key: 'company_pin', content: report.company_pin },
                                            { key: 'pin_certificate_status', content: <span className={`text-xs ${report.pin_certificate_status === 'Available' ? 'text-green-500' : report.pin_certificate_status === 'Missing' ? 'text-red-500' : 'text-gray-500'}`}>{report.pin_certificate_status}</span> },
                                            { key: 'extraction_date', content: <span className="text-center text-xs">{report.extraction_date}</span> },
                                            {
                                                key: 'certificate',
                                                content: (
                                                    report.pdf_link ? (
                                                        <div className="flex justify-center">
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button variant='outline' className="text-blue-500 hover:underline text-[10px] px-1 py-0 h-5 flex items-center justify-center">
                                                                        <Eye className="inline-block mr-1 h-2.5 w-2.5" />
                                                                        View PIN Certificate
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent className="w-full max-w-5xl max-h-[90vh]">
                                                                    <DialogHeader>
                                                                        <DialogTitle>PIN Certificate Document</DialogTitle>
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
                                                            <Image src={report.pdf_link || ''} alt={`PIN Certificate for ${report.company_name}`} className="inline-block mr-1 h-3 w-3" />
                                                            Missing
                                                        </span>
                                                    )
                                                ),
                                                alwaysVisible: true
                                            },
                                            {
                                                key: 'actions',
                                                content: (
                                                    <Button
                                                        onClick={() => runAutomation([report.id])}
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        <Play className="h-3 w-3 mr-1" />
                                                        Run
                                                    </Button>
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
                                    <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 2} className="text-center py-4">
                                        No records found matching your filters.
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