// @ts-nocheck
'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    ArrowUpDown,
    Search,
    Download,
    X,
    Filter,
    ChevronDown,
    Calendar as CalendarIcon,
    Check,
    ChevronsUpDown,
    Clock
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui';
import { Skeleton } from "@/components/ui/skeleton";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Utility function to format amount as KSH
const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return 'KSH 0.00';
    return `KSH ${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

// Date Picker component 
const DatePickerWithRange = ({ startDate, endDate, onDateChange }) => {
    const [date, setDate] = useState({
        from: startDate ? new Date(startDate) : undefined,
        to: endDate ? new Date(endDate) : undefined,
    });

    useEffect(() => {
        if (date.from && date.to) {
            onDateChange(date.from, date.to);
        }
    }, [date, onDateChange]);

    return (
        <div className="grid gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Select date range</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
};

// Month Year Selector component
const MonthYearSelector = ({ onMonthYearSelect }) => {
    const [month, setMonth] = useState("");
    const [year, setYear] = useState("");

    const handleApply = () => {
        if (month && year) {
            onMonthYearSelect(parseInt(month), parseInt(year));
        }
    };

    return (
        <div className="flex flex-wrap gap-2 items-center">
            <Select onValueChange={setMonth} value={month}>
                <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <SelectItem key={m} value={String(m)}>
                            {new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select onValueChange={setYear} value={year}>
                <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                    {Array.from({ length: new Date().getFullYear() - 2013 + 1 }, (_, i) => 2013 + i).map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button onClick={handleApply} variant="default" size="sm">Apply</Button>
        </div>
    );
};

// Data table component with enhanced features
export function DataTable({
    columns,
    data,
    searchPlaceholder = "Search...",
    onSearch,
    pagination = true
}) {
    const [sorting, setSorting] = useState([]);
    const [columnFilters, setColumnFilters] = useState([]);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [rowSelection, setRowSelection] = useState({});
    const [searchValue, setSearchValue] = useState("");

    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchValue(value);
        if (onSearch) {
            onSearch(value);
        }
    };

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    });

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Input
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={handleSearch}
                        className="max-w-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="ml-auto">
                                Columns <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(!!value)
                                            }
                                        >
                                            {column.id}
                                        </DropdownMenuCheckboxItem>
                                    );
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader className="bg-gray-50">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="font-semibold whitespace-nowrap">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results found
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {pagination && (
                <div className="flex items-center justify-between space-x-2 py-2">
                    <div className="flex gap-2 items-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            Next
                        </Button>
                    </div>
                    <div className="flex-1 text-sm text-muted-foreground text-center">
                        Page {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount()}
                    </div>
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Rows per page</p>
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value));
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={table.getState().pagination.pageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 20, 30, 40, 50].map((pageSize) => (
                                    <SelectItem key={pageSize} value={`${pageSize}`}>
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}
        </div>
    );
}

// Tooltip component for showing information on hover
const ToolTip = ({ children, title }) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <span className="cursor-help">{children}</span>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" side="top">
                {title}
            </PopoverContent>
        </Popover>
    );
};

// Stats card component for summary data
const StatsCard = ({ title, value, description, icon, className }) => {
    const Icon = icon;

    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                </div>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
};

// Main component
export function WHVATExtractorReports() {
    // State variables
    const [view, setView] = useState('summary');
    const [companies, setCompanies] = useState([]);
    const [allCompanyData, setAllCompanyData] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [companyData, setCompanyData] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('allData');
    const [filteredData, setFilteredData] = useState(null);
    const [showAllData, setShowAllData] = useState(false);
    const [summarySearch, setSummarySearch] = useState('');
    const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
    const [dateRange, setDateRange] = useState({ from: null, to: null });
    const [loading, setLoading] = useState(true);
    const [sidebarSearchTerm, setSidebarSearchTerm] = useState('');
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

    // Category filter handler
    const handleApplyFilters = (newFilters) => {
        setCategoryFilters(newFilters);
    };

    // Initial data fetch
    useEffect(() => {
        fetchCompanies();
        fetchAllCompanyData();
    }, []);

    // Filter effect for selected company
    useEffect(() => {
        if (selectedCompany) {
            // First, filter all company data based on categories
            const filteredCompanies = applyFiltersToData(allCompanyData);

            // Then find the selected company in the filtered list
            const data = filteredCompanies.find(c => c.company_name === selectedCompany);

            if (data && data.extraction_data) {
                setCompanyData(data.extraction_data);
                filterData(data.extraction_data);
            } else {
                setCompanyData(null);
                setFilteredData(null);
            }
        }
    }, [selectedCompany, allCompanyData, activeTab, searchTerm, showAllData, categoryFilters, dateRange]);

    // Handle date range changes
    const handleDateRangeChange = (from, to) => {
        setDateRange({ from, to });
        if (companyData) {
            filterData(companyData);
        }
    };

    // Handle month/year selection
    const handleMonthYearSelect = (month, year) => {
        if (companyData) {
            const selectedKey = `${year}-${String(month).padStart(2, '0')}`;
            const filtered = { [selectedKey]: companyData[selectedKey] };
            setFilteredData(filtered);
        }
    };

    // Fetch companies
    const fetchCompanies = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('acc_portal_company_duplicate')
                .select('id, company_name')
                .order('company_name');

            if (error) throw error;
            setCompanies(data);
        } catch (error) {
            console.error('Error fetching companies:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch all company data
    const fetchAllCompanyData = async () => {
        try {
            setLoading(true);
            // First get all companies from acc_portal_company_duplicate
            const { data: companiesData, error: companiesError } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*');

            if (companiesError) throw companiesError;

            // Then get all WHVAT extractions
            const { data: extractionsData, error: extractionsError } = await supabase
                .from('whvat_extractions')
                .select('*');

            if (extractionsError) throw extractionsError;

            // Map extractions by company_id for quick lookup
            const extractionsMap = new Map();
            extractionsData.forEach(extraction => {
                if (!extractionsMap.has(extraction.company_id)) {
                    extractionsMap.set(extraction.company_id, []);
                }
                extractionsMap.get(extraction.company_id).push(extraction);
            });

            // Helper function to determine client status
            const calculateClientStatus = (fromDate, toDate) => {
                if (!fromDate || !toDate) return 'inactive';

                const today = new Date();
                const from = new Date(fromDate.split('/').reverse().join('-'));
                const to = new Date(toDate.split('/').reverse().join('-'));

                return today >= from && today <= to ? 'active' : 'inactive';
            };

            // Get categories for each company
            const mappedData = companiesData.map(company => {
                const companyExtractions = extractionsMap.get(company.id) || [];
                const extractionData = {};

                // Process all extractions for this company
                companyExtractions.forEach(extraction => {
                    if (extraction.extraction_data) {
                        Object.entries(extraction.extraction_data).forEach(([dateKey, data]) => {
                            if (!extractionData[dateKey]) {
                                extractionData[dateKey] = {
                                    extractionDate: data.extractionDate,
                                    tableData: []
                                };
                            }
                            if (data.tableData) {
                                extractionData[dateKey].tableData.push(...data.tableData);
                            }
                        });
                    }
                });

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
                    company_name: company.company_name,
                    extraction_data: extractionData,
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

            setAllCompanyData(mappedData);
        } catch (error) {
            console.error('Error fetching all company data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Apply category filters to data
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

            // Check if company belongs to any of the selected categories
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

    // Calculate total for month data
    const calculateTotal = (monthData) => {
        if (!monthData || !monthData.tableData) return 0;
        return monthData.tableData.reduce((sum, row) => sum + parseFloat(row[8] || 0), 0);
    };

    // Calculate overall total
    const calculateOverallTotal = (data) => {
        if (!data) return 0;
        return Object.values(data).reduce((sum, monthData) => sum + calculateTotal(monthData), 0);
    };

    // Filter data based on criteria
    const filterData = (data) => {
        if (!data) return;
        let filtered = { ...data };

        if (!showAllData) {
            // Filter by date range
            if (dateRange.from && dateRange.to) {
                filtered = Object.fromEntries(
                    Object.entries(filtered).filter(([key]) => {
                        const [year, month] = key.split('-');
                        const keyDate = new Date(year, parseInt(month) - 1);
                        return keyDate >= dateRange.from && keyDate <= dateRange.to;
                    })
                );
            }
        }

        // Apply search term - using generic search across all cells
        if (searchTerm) {
            Object.keys(filtered).forEach(key => {
                filtered[key].tableData = filtered[key].tableData.filter(row => {
                    // Convert all cell values to lowercase strings for comparison
                    const rowValues = row.map(cell =>
                        cell !== null && cell !== undefined
                            ? cell.toString().toLowerCase()
                            : ''
                    );

                    // Check if any cell in the row contains the search term
                    return rowValues.some(value =>
                        value.includes(searchTerm.toLowerCase())
                    );
                });
            });
        }

        // Sort the filtered data by date (latest first)
        const sortedFiltered = Object.fromEntries(
            Object.entries(filtered).sort((a, b) => new Date(b[0]) - new Date(a[0]))
        );

        setFilteredData(sortedFiltered);
    };

    // Clear filters
    const clearFilters = () => {
        setDateRange({ from: null, to: null });
        setSearchTerm('');
        setShowAllData(false);
        filterData(companyData);
    };

    // Export to Excel
    const exportToExcel = async (range) => {
        if (!filteredData) return;

        const workbook = new ExcelJS.Workbook();

        if (range === 'all') {
            const worksheet = workbook.addWorksheet('All Data');
            const headers = [
                'Month', 'Sr.No.', 'Withholder PIN', 'Withholdee PIN', 'Withholder Name',
                'Pay Point Name', 'Status', 'Invoice No', 'Certificate Date',
                'VAT Withholding Amount', 'WHT Certificate No'
            ];
            worksheet.addRow(headers);

            Object.entries(filteredData).forEach(([month, data]) => {
                if (data.tableData && data.tableData.length > 0) {
                    data.tableData.forEach(row => worksheet.addRow([month, ...row]));
                } else {
                    const [year, monthNum] = month.split('-');
                    const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long' });
                    worksheet.addRow([month, `No records found for ${monthName} ${year}`]);
                }
            });
        } else {
            Object.entries(filteredData).forEach(([month, data]) => {
                const worksheet = workbook.addWorksheet(month);
                if (data.tableData && data.tableData.length > 0) {
                    const headers = [
                        'Sr.No.', 'Withholder PIN', 'Withholdee PIN', 'Withholder Name',
                        'Pay Point Name', 'Status', 'Invoice No', 'Certificate Date',
                        'VAT Withholding Amount', 'WHT Certificate No'
                    ];
                    worksheet.addRow(headers);
                    data.tableData.forEach(row => worksheet.addRow(row));
                } else {
                    const [year, monthNum] = month.split('-');
                    const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long' });
                    worksheet.addRow([`No records found for ${monthName} ${year}`]);
                }
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `${selectedCompany}_WHVAT_Extractions_${range}.xlsx`);
    };

    // Export summary to Excel
    const exportSummaryToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Summary');
        worksheet.addRow(['#', 'Company', 'Latest Extraction Date', 'Number of Extractions', 'Total Amount']);
        getFilteredSortedSummary().forEach((company, idx) => {
            worksheet.addRow([
                idx + 1,
                company.company_name,
                company.latestExtractionDate,
                company.numberOfExtractions,
                company.totalAmountRaw
            ]);
        });
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `WHVAT_Summary.xlsx`);
    };

    // Get filtered and sorted summary data
    const getFilteredSortedSummary = () => {
        // First apply category filters
        let data = applyFiltersToData(allCompanyData).map((company) => {
            const extractionDates = company.extraction_data ? Object.keys(company.extraction_data) : [];
            let latestExtractionDate = 'N/A';

            if (extractionDates.length > 0) {
                const dates = extractionDates
                    .map(date => company.extraction_data[date].extractionDate)
                    .filter(date => date) // Filter out undefined/null dates
                    .map(date => new Date(date));

                if (dates.length > 0) {
                    latestExtractionDate = new Date(Math.max(...dates)).toLocaleDateString();
                }
            }

            const totalAmount = calculateOverallTotal(company.extraction_data);
            return {
                ...company,
                latestExtractionDate,
                numberOfExtractions: extractionDates.length,
                totalAmount: formatAmount(totalAmount),
                totalAmountRaw: totalAmount,
            };
        });

        // Apply generic search filter
        if (summarySearch) {
            data = data.filter((company) => {
                const searchTerm = summarySearch.toLowerCase();

                // Search across these common fields
                const searchFields = [
                    company.company_name,
                    company.latestExtractionDate,
                    company.numberOfExtractions.toString(),
                    company.totalAmount,
                ];

                // Check if any field contains the search term
                return searchFields.some(field =>
                    field && field.toString().toLowerCase().includes(searchTerm)
                );
            });
        }

        // Default sort by company name
        data.sort((a, b) => a.company_name.toLowerCase().localeCompare(b.company_name.toLowerCase()));

        return data;
    };

    // Column definition for summary table
    const summaryColumns = useMemo(() => [
        {
            accessorKey: "id",
            header: "#",
            cell: ({ row }) => <div className="font-medium">{row.index + 1}</div>,
            enableSorting: false,
            size: 50,
        },
        {
            accessorKey: "company_name",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="whitespace-nowrap font-semibold"
                    >
                        Company
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => (
                <div className="font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                    onClick={() => setSelectedCompany(row.original.company_name)}>
                    {row.original.company_name}
                </div>
            ),
        },
        {
            accessorKey: "categories",
            header: "Categories",
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.original.categories.map((category) => (
                        <Badge key={category} variant="outline" className={
                            category === 'Acc' ? 'bg-blue-100 text-blue-800' :
                                category === 'Imm' ? 'bg-green-100 text-green-800' :
                                    category === 'Sheria' ? 'bg-purple-100 text-purple-800' :
                                        category === 'Audit' ? 'bg-amber-100 text-amber-800' :
                                            ''
                        }>
                            {category}
                        </Badge>
                    ))}
                </div>
            ),
        },
        {
            accessorKey: "latestExtractionDate",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="whitespace-nowrap font-semibold"
                    >
                        Latest Extraction
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <div>{row.original.latestExtractionDate}</div>,
        },
        {
            accessorKey: "numberOfExtractions",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="whitespace-nowrap font-semibold text-right"
                    >
                        # of Extractions
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <div className="text-right">{row.original.numberOfExtractions}</div>,
        },
        {
            accessorKey: "totalAmount",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="whitespace-nowrap font-semibold text-right"
                    >
                        Total Amount
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => (
                <div className="text-right font-bold text-green-600">
                    {row.original.totalAmount}
                </div>
            ),
        },
    ], []);

    // Create month data table columns
    const createMonthDataColumns = () => [
        {
            accessorKey: "0",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="whitespace-nowrap font-semibold"
                >
                    Sr.No.
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <div>{row.original[0]}</div>,
        },
        {
            accessorKey: "1",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="whitespace-nowrap font-semibold"
                >
                    Withholder PIN
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <div>{row.original[1]}</div>,
        },
        {
            accessorKey: "2",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="whitespace-nowrap font-semibold"
                >
                    Withholdee PIN
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <div>{row.original[2]}</div>,
        },
        {
            accessorKey: "3",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="whitespace-nowrap font-semibold"
                >
                    Withholder Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <div>{row.original[3]}</div>,
        },
        {
            accessorKey: "4",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="whitespace-nowrap font-semibold"
                >
                    Pay Point Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <div>{row.original[4]}</div>,
        },
        {
            accessorKey: "5",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="whitespace-nowrap font-semibold"
                >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <Badge variant={row.original[5]?.toLowerCase() === 'inactive' ? 'destructive' : 'default'}>
                    {row.original[5]}
                </Badge>
            ),
        },
        {
            accessorKey: "6",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="whitespace-nowrap font-semibold"
                >
                    Invoice No
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <div>{row.original[6]}</div>,
        },
        {
            accessorKey: "7",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="whitespace-nowrap font-semibold"
                >
                    Certificate Date
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <div>{row.original[7]}</div>,
        },
        {
            accessorKey: "8",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="whitespace-nowrap font-semibold text-right"
                >
                    VAT Amount
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="text-right font-medium text-green-600">
                    {formatAmount(parseFloat(row.original[8] || 0))}
                </div>
            ),
        },
        {
            accessorKey: "9",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="whitespace-nowrap font-semibold"
                >
                    WHT Certificate No
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <div>{row.original[9]}</div>,
        },
    ];

    // Create totals table columns
    const totalsColumns = [
        {
            accessorKey: "month",
            header: "Month",
            cell: ({ row }) => <div className="font-medium">{row.original.month}</div>,
        },
        {
            accessorKey: "total",
            header: "Total",
            cell: ({ row }) => (
                <div className="font-bold text-green-600">
                    {row.original.hasData ? formatAmount(row.original.total) : (
                        <span className="text-red-600">No records found</span>
                    )}
                </div>
            ),
        },
    ];

    // Create data for totals table
    const getTotalsData = () => {
        if (!filteredData) return [];

        return Object.entries(filteredData).map(([month, data]) => {
            const [year, monthNum] = month.split('-');
            const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long' });
            const total = calculateTotal(data);
            const hasData = data.tableData && data.tableData.length > 0;

            return {
                month: `${monthName} ${year}`,
                total,
                hasData
            };
        }).sort((a, b) => {
            // Extract year and month from the month string
            const [aMonthName, aYear] = a.month.split(' ');
            const [bMonthName, bYear] = b.month.split(' ');

            // Compare years first
            if (aYear !== bYear) {
                return parseInt(bYear) - parseInt(aYear); // Descending by year
            }

            // If years are the same, compare months
            const months = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];
            return months.indexOf(bMonthName) - months.indexOf(aMonthName); // Descending by month
        });
    };

    // Function to combine all months data for the All Data view
    const getAllDataRows = () => {
        if (!filteredData) return [];

        return Object.entries(filteredData).flatMap(([month, data]) => {
            if (!data.tableData || data.tableData.length === 0) {
                return [];
            }
            return data.tableData;
        });
    };

    // Get data for a specific month
    const getMonthData = (monthKey) => {
        if (!filteredData || !filteredData[monthKey] || !filteredData[monthKey].tableData) {
            return [];
        }
        return filteredData[monthKey].tableData;
    };

    // Render summary view
    const renderSummaryView = () => {
        const summaryData = getFilteredSortedSummary();

        // Calculate summary statistics
        const totalCompanies = summaryData.length;
        const totalExtractions = summaryData.reduce((sum, company) => sum + company.numberOfExtractions, 0);
        const totalAmount = summaryData.reduce((sum, company) => sum + company.totalAmountRaw, 0);
        const companiesWithExtractions = summaryData.filter(c => c.numberOfExtractions > 0).length;

        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <StatsCard
                        title="Total Companies"
                        value={totalCompanies}
                        description="Total number of companies"
                        icon={Filter}
                    />
                    <StatsCard
                        title="With Extractions"
                        value={companiesWithExtractions}
                        description={`${((companiesWithExtractions / totalCompanies) * 100).toFixed(1)}% of companies`}
                        icon={Check}
                    />
                    <StatsCard
                        title="Total Extractions"
                        value={totalExtractions}
                        description="Total number of extractions"
                        icon={Clock}
                    />
                    <StatsCard
                        title="Total Amount"
                        value={formatAmount(totalAmount)}
                        description="Sum of all VAT withholdings"
                        icon={Download}
                        className="bg-green-50"
                    />
                </div>

                <div className="flex flex-wrap gap-2 items-center mb-4 justify-between">
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="Search companies..."
                            value={summarySearch}
                            onChange={e => setSummarySearch(e.target.value)}
                            className="w-[300px]"
                        />
                        <Button
                            onClick={() => setIsCategoryFilterOpen(true)}
                            variant="outline"
                            size="sm"
                            className="flex items-center whitespace-nowrap"
                        >
                            <Filter className="h-4 w-4 mr-1" />
                            Filter Categories
                            <Badge variant="secondary" className="ml-2">
                                {summaryData.length}
                            </Badge>
                        </Button>
                    </div>
                    <Button onClick={exportSummaryToExcel} variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" /> Export to Excel
                    </Button>
                </div>

                <ClientCategoryFilter
                    open={isCategoryFilterOpen}
                    onOpenChange={setIsCategoryFilterOpen}
                    onFilterChange={handleApplyFilters}
                    showSectionName=""
                    initialFilters={categoryFilters}
                    showSectionStatus={false}
                />

                {loading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <DataTable
                        columns={summaryColumns}
                        data={summaryData}
                        searchPlaceholder="Search companies, amounts..."
                        onSearch={setSummarySearch}
                    />
                )}
            </>
        );
    };

    // Render detailed view
    const renderDetailedView = () => (
        <div className="grid grid-cols-4 gap-4 h-[680px]">
            <div className="col-span-1 bg-slate-50 rounded-lg shadow-sm p-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="Search companies..."
                            value={sidebarSearchTerm}
                            onChange={(e) => setSidebarSearchTerm(e.target.value)}
                            className="w-full"
                        />
                        <Button
                            onClick={() => setIsCategoryFilterOpen(true)}
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>

                    <ClientCategoryFilter
                        open={isCategoryFilterOpen}
                        onOpenChange={setIsCategoryFilterOpen}
                        onFilterChange={handleApplyFilters}
                        showSectionName=""
                        initialFilters={categoryFilters}
                        showSectionStatus={false}
                    />

                    {loading ? (
                        <div className="space-y-2 mt-4">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : (
                        <ScrollArea className="h-[600px]">
                            <div className="space-y-1 pr-2">
                                {companies
                                    .filter(company =>
                                        !sidebarSearchTerm ||
                                        company.company_name.toLowerCase().includes(sidebarSearchTerm.toLowerCase())
                                    )
                                    .sort((a, b) => a.company_name.localeCompare(b.company_name))
                                    .map((company) => {
                                        const isSelected = selectedCompany === company.company_name;
                                        return (
                                            <div
                                                key={company.company_name}
                                                onClick={() => setSelectedCompany(company.company_name)}
                                                className={cn(
                                                    "p-2 cursor-pointer rounded-md transition-colors duration-200",
                                                    isSelected
                                                        ? "bg-blue-600 text-white font-medium"
                                                        : "hover:bg-blue-100"
                                                )}
                                            >
                                                {company.company_name}
                                            </div>
                                        );
                                    })}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </div>

            <div className="col-span-3">
                {selectedCompany ? (
                    loading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-60 w-full" />
                            <Skeleton className="h-40 w-full" />
                        </div>
                    ) : companyData ? (
                        <>
                            <div className="mb-4 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-blue-800">{selectedCompany}</h2>
                                    <div className="text-green-600 font-semibold">
                                        Overall Total: {formatAmount(calculateOverallTotal(companyData))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="Search within data..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-60"
                                    />
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button><Download className="mr-2 h-4 w-4" /> Export</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Export Data</DialogTitle>
                                                <DialogDescription>
                                                    Choose an export option for {selectedCompany}'s data
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <Button onClick={() => exportToExcel('currentMonth')} variant="outline">
                                                    Current Selection
                                                </Button>
                                                <Button onClick={() => exportToExcel('all')} variant="default">
                                                    All Data
                                                </Button>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="secondary" onClick={() => document.querySelector('[data-state="open"]')?.click()}>
                                                    Cancel
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>

                            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-2">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="allData">All Data</TabsTrigger>
                                    <TabsTrigger value="monthWise">Month Wise</TabsTrigger>
                                    <TabsTrigger value="totals">Totals</TabsTrigger>
                                </TabsList>

                                <TabsContent value="allData">
                                    <div className="mb-4 flex gap-2 items-center flex-wrap">
                                        <DatePickerWithRange
                                            startDate={dateRange.from}
                                            endDate={dateRange.to}
                                            onDateChange={handleDateRangeChange}
                                        />
                                        <Button onClick={() => filterData(companyData)} className="whitespace-nowrap">
                                            Apply Filter
                                        </Button>
                                        <Button onClick={clearFilters} variant="outline" className="whitespace-nowrap">
                                            <X className="mr-2 h-4 w-4" />Clear Filters
                                        </Button>
                                        <Button
                                            onClick={() => setShowAllData(!showAllData)}
                                            variant={showAllData ? "default" : "outline"}
                                            className="whitespace-nowrap ml-auto"
                                        >
                                            {showAllData ? "Hide All" : "Show All Data"}
                                        </Button>
                                    </div>

                                    {filteredData && Object.keys(filteredData).length > 0 ? (
                                        <ScrollArea className="h-[500px]">
                                            <DataTable
                                                columns={createMonthDataColumns()}
                                                data={getAllDataRows()}
                                                searchPlaceholder="Search in all months..."
                                                onSearch={setSearchTerm}
                                            />
                                        </ScrollArea>
                                    ) : (
                                        <div className="flex items-center justify-center h-[400px] border rounded-md">
                                            <div className="text-center">
                                                <h3 className="text-lg font-semibold">No Data Available</h3>
                                                <p className="text-muted-foreground">
                                                    {dateRange.from && dateRange.to
                                                        ? "No data found in the selected date range"
                                                        : "No extraction data available for this company"}
                                                </p>
                                                {dateRange.from && dateRange.to && (
                                                    <Button onClick={clearFilters} variant="outline" className="mt-4">
                                                        Clear Filters
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="monthWise">
                                    <div className="mb-4 flex gap-2 items-center">
                                        <MonthYearSelector onMonthYearSelect={handleMonthYearSelect} />
                                        <Button onClick={clearFilters} variant="outline" className="whitespace-nowrap">
                                            <X className="mr-2 h-4 w-4" />Clear Filters
                                        </Button>
                                        <Button
                                            onClick={() => setShowAllData(!showAllData)}
                                            variant={showAllData ? "default" : "outline"}
                                            className="whitespace-nowrap ml-auto"
                                        >
                                            {showAllData ? "Hide All" : "Show All Data"}
                                        </Button>
                                    </div>

                                    <ScrollArea className="h-[500px]">
                                        {filteredData && Object.entries(filteredData).length > 0 ? (
                                            <div className="space-y-8">
                                                {Object.entries(filteredData).map(([month, data]) => {
                                                    const [year, monthNum] = month.split('-');
                                                    const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long' });
                                                    const total = calculateTotal(data);

                                                    return (
                                                        <Card key={month} className="overflow-hidden">
                                                            <CardHeader className="bg-slate-50 pb-2">
                                                                <div className="flex justify-between items-center">
                                                                    <CardTitle>{`${monthName} ${year}`}</CardTitle>
                                                                    <div className="text-green-600 font-semibold">
                                                                        {formatAmount(total)}
                                                                    </div>
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent className="p-0">
                                                                <DataTable
                                                                    columns={createMonthDataColumns()}
                                                                    data={getMonthData(month)}
                                                                    searchPlaceholder={`Search in ${monthName}...`}
                                                                    onSearch={setSearchTerm}
                                                                    pagination={false}
                                                                />
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center h-[400px] border rounded-md">
                                                <div className="text-center">
                                                    <h3 className="text-lg font-semibold">No Monthly Data</h3>
                                                    <p className="text-muted-foreground">
                                                        No extraction data available for the selected criteria
                                                    </p>
                                                    <Button onClick={clearFilters} variant="outline" className="mt-4">
                                                        Reset Filters
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="totals">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle>Monthly Totals</CardTitle>
                                            <CardDescription>
                                                Summary of VAT withholding amounts by month
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {getTotalsData().length > 0 ? (
                                                <DataTable
                                                    columns={totalsColumns}
                                                    data={getTotalsData()}
                                                    searchPlaceholder="Search months..."
                                                    pagination={false}
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-[300px]">
                                                    <div className="text-center">
                                                        <h3 className="text-lg font-semibold">No Data Available</h3>
                                                        <p className="text-muted-foreground">
                                                            No monthly totals available for this company
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <h3 className="text-lg font-semibold">No Data Available</h3>
                                <p className="text-muted-foreground">
                                    No extraction data found for this company
                                </p>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="flex items-center justify-center h-full border rounded-md">
                        <div className="text-center">
                            <h3 className="text-lg font-semibold">Select a Company</h3>
                            <p className="text-muted-foreground">
                                Choose a company from the sidebar to view WHVAT extraction data
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <Card className="w-full h-[940px]">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl text-blue-700">WH VAT Extractor Reports</CardTitle>
                    <Tabs value={view} onValueChange={setView} className="ml-auto">
                        <TabsList>
                            <TabsTrigger value="summary">Summary</TabsTrigger>
                            <TabsTrigger value="detailed">Detailed</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>
            <CardContent>
                {view === 'summary' ? renderSummaryView() : renderDetailedView()}
            </CardContent>
        </Card>
    );
}