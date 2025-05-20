// @ts-nocheck
'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from '@/components/ui/badge';
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui';

// Icons
import {
    ArrowUpDown,
    Search,
    Download,
    ArrowDownToLine,
    X,
    Filter,
    ChevronDown,
    Calendar as CalendarIcon,
    Check,
    ChevronsUpDown,
    Clock,
    ArrowRight,
    Layers,
    BarChart3,
    ListFilter,
    FileText,
    Users,
    Building,
    TicketCheck,
    PieChart,
    Menu,
    Briefcase,
    SlidersHorizontal,
    Trash2,
    Eye,
    CircleDollarSign,
    FileSpreadsheet,
    SortAsc,
    SortDesc,
    RefreshCw,
    ListChecks,
    BookOpen,
    MonitorSmartphone
} from "lucide-react";

// Utilities
import { cn } from "@/lib/utils";
import { format, parse, isValid, parseISO, getYear } from "date-fns";
import toast from 'react-hot-toast';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// ========================== UTILITY FUNCTIONS ==========================
// Format amount as KSH with proper formatting
const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return 'KSH 0.00';
    return `KSH ${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

// Format date to readable format
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    // Try to parse as ISO first
    let date = parseISO(dateString);

    // If not valid, try other formats
    if (!isValid(date)) {
        date = parse(dateString, 'dd/MM/yyyy', new Date());
    }

    if (!isValid(date)) {
        return dateString; // Return original if we can't parse
    }

    return format(date, 'dd MMM yyyy');
};

// Generate month name
const getMonthName = (monthNum) => {
    return new Date(2000, parseInt(monthNum) - 1, 1).toLocaleString('default', { month: 'long' });
};

// Extract unique values from data array for filter options
const getUniqueFilterOptions = (data, columnIndex) => {
    if (!data || !Array.isArray(data)) return [];

    const unique = new Set();
    data.forEach(row => {
        if (row && row[columnIndex] !== undefined && row[columnIndex] !== null) {
            unique.add(row[columnIndex].toString());
        }
    });

    return Array.from(unique).sort();
};

// ========================== REUSABLE COMPONENTS ==========================
// Icons with labels for better visualization
const IconLabel = ({ icon: Icon, label, className }) => (
    <div className={cn("flex items-center gap-2", className)}>
        <Icon className="h-4 w-4" />
        <span>{label}</span>
    </div>
);

// Advanced Date Range Picker
const DateRangePicker = ({ value, onChange }) => {
    const [date, setDate] = useState({
        from: value?.from || undefined,
        to: value?.to || undefined,
    });

    useEffect(() => {
        if (date.from && date.to) {
            onChange(date);
        }
    }, [date, onChange]);

    return (
        <div className="grid gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant="outline"
                        className={cn(
                            "w-full justify-start text-left bg-white border-slate-200 hover:bg-slate-50",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "MMM d, yyyy")} - {format(date.to, "MMM d, yyyy")}
                                </>
                            ) : (
                                format(date.from, "MMM d, yyyy")
                            )
                        ) : (
                            <span className="text-slate-500">Select date range</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <div className="border-b border-slate-200 bg-slate-50 p-3">
                        <h3 className="text-sm font-medium">Select Date Range</h3>
                        <p className="text-xs text-slate-500">Choose start and end dates</p>
                    </div>
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        className="p-3"
                    />
                    <div className="flex items-center justify-between border-t border-slate-200 p-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDate({ from: undefined, to: undefined })}
                        >
                            Reset
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                if (date.from && date.to) {
                                    document.querySelector('[data-state="open"][role="dialog"]')?.querySelector('[role="button"]')?.click();
                                }
                            }}
                        >
                            Apply
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

// Month/Year selection component with visual month grid
const MonthYearSelector = ({ onSelect, selectedYear, selectedMonth }) => {
    const [year, setYear] = useState(selectedYear || new Date().getFullYear());
    const [month, setMonth] = useState(selectedMonth || null);

    const years = Array.from(
        { length: new Date().getFullYear() - 2013 + 1 },
        (_, i) => 2013 + i
    ).reverse();

    const months = [
        "January", "February", "March", "April",
        "May", "June", "July", "August",
        "September", "October", "November", "December"
    ];

    const handleSelect = (selectedMonth) => {
        setMonth(selectedMonth);
        onSelect(year, selectedMonth);
    };

    const handleYearChange = (newYear) => {
        setYear(parseInt(newYear));
        if (month) {
            onSelect(parseInt(newYear), month);
        }
    };

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Select Month & Year</h3>
                <Select value={year.toString()} onValueChange={handleYearChange}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {years.map((y) => (
                            <SelectItem key={y} value={y.toString()}>
                                {y}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {months.map((m, index) => (
                    <Button
                        key={m}
                        variant={month === index + 1 ? "default" : "outline"}
                        size="sm"
                        className={cn(
                            "h-10 justify-center",
                            month === index + 1 ? "bg-blue-600 hover:bg-blue-700" : "bg-white"
                        )}
                        onClick={() => handleSelect(index + 1)}
                    >
                        {m.substring(0, 3)}
                    </Button>
                ))}
            </div>
        </div>
    );
};

// Advanced Export Options Dialog
const ExportOptionsDialog = ({ data, company, onExport }) => {
    const [exportType, setExportType] = useState("all");
    const [exportRange, setExportRange] = useState("all");
    const [includeSuppliers, setIncludeSuppliers] = useState(true);
    const [includeCustomers, setIncludeCustomers] = useState(true);
    const [dateRange, setDateRange] = useState({ from: null, to: null });
    const [exportFormat, setExportFormat] = useState("xlsx");

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <Download className="mr-2 h-4 w-4" /> Export
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle>Export Options</DialogTitle>
                    <DialogDescription>
                        Customize your export for {company || "this data"}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium">Data Selection</h3>
                        <RadioGroup
                            defaultValue={exportType}
                            onValueChange={setExportType}
                            className="flex flex-col space-y-2"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="all" id="r1" />
                                <Label htmlFor="r1" className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    <span>All Records</span>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="suppliers" id="r2" />
                                <Label htmlFor="r2" className="flex items-center gap-2">
                                    <Building className="h-4 w-4" />
                                    <span>Suppliers Only</span>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="customers" id="r3" />
                                <Label htmlFor="r3" className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    <span>Customers Only</span>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="custom" id="r4" />
                                <Label htmlFor="r4" className="flex items-center gap-2">
                                    <SlidersHorizontal className="h-4 w-4" />
                                    <span>Custom</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {exportType === "custom" && (
                        <div className="space-y-2 border rounded-md p-3 bg-slate-50">
                            <h3 className="text-sm font-medium">Custom Options</h3>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="suppliers"
                                    checked={includeSuppliers}
                                    onCheckedChange={setIncludeSuppliers}
                                />
                                <label
                                    htmlFor="suppliers"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Include Suppliers
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="customers"
                                    checked={includeCustomers}
                                    onCheckedChange={setIncludeCustomers}
                                />
                                <label
                                    htmlFor="customers"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Include Customers
                                </label>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <h3 className="text-sm font-medium">Time Range</h3>
                        <RadioGroup
                            defaultValue={exportRange}
                            onValueChange={setExportRange}
                            className="flex flex-col space-y-2"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="all" id="t1" />
                                <Label htmlFor="t1">All Time</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="current" id="t2" />
                                <Label htmlFor="t2">Current Selection</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="custom" id="t3" />
                                <Label htmlFor="t3">Custom Date Range</Label>
                            </div>
                        </RadioGroup>

                        {exportRange === "custom" && (
                            <div className="pt-2">
                                <DateRangePicker
                                    value={dateRange}
                                    onChange={setDateRange}
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-medium">Format</h3>
                        <RadioGroup
                            defaultValue={exportFormat}
                            onValueChange={setExportFormat}
                            className="flex space-x-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="xlsx" id="f1" />
                                <Label htmlFor="f1" className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    <span>Excel (.xlsx)</span>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="csv" id="f2" />
                                <Label htmlFor="f2" className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    <span>CSV</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={() => onExport({
                        type: exportType,
                        range: exportRange,
                        includeSuppliers,
                        includeCustomers,
                        dateRange,
                        format: exportFormat
                    })}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Enhanced data table with advanced features
export function EnhancedDataTable({
    columns,
    data,
    searchPlaceholder = "Search...",
    onSearch,
    pagination = true,
    additionalFilters = [],
    monthLabel,
    onRowClick,
    isLoading = false,
    emptyMessage = "No results found",
    showColumnToggle = true,
    initialPageSize = 10,
    tableMaxHeight = "max-h-[600px]", // Added a prop for max table height, defaulting to 600px
}) {
    const [sorting, setSorting] = useState([]);
    const [columnFilters, setColumnFilters] = useState([]);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [rowSelection, setRowSelection] = useState({});
    const [searchValue, setSearchValue] = useState("");
    const [pageSize, setPageSize] = useState(initialPageSize);

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
            pagination: {
                pageSize,
                pageIndex: 0
            }
        },
        // Manual pagination control is needed if page size changes affect server-side fetching
        // For client-side pagination, this is fine.
        // manualPagination: true, // if pagination is server-side
        // pageCount: calculatedPageCount, // if pagination is server-side
    });

    // Update table page size when local pageSize state changes
    React.useEffect(() => {
        table.setPageSize(pageSize);
    }, [pageSize, table]);


    const renderLoading = () => (
        <>
            {Array.from({ length: initialPageSize }).map((_, i) => ( // Use initialPageSize for skeleton rows
                <TableRow key={`skeleton-${i}`}>
                    {columns.map((col, j) => (
                        <TableCell key={`skeleton-cell-${i}-${j}`}>
                            <Skeleton className="h-6 w-full" />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={searchValue}
                            onChange={handleSearch}
                            className="pl-9 bg-white border-slate-200"
                        />
                    </div>

                    {additionalFilters.map((filter, index) => (
                        <React.Fragment key={`filter-${index}`}>
                            {filter}
                        </React.Fragment>
                    ))}

                    {monthLabel && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 px-3 py-1.5">
                            <Calendar className="mr-1.5 h-3.5 w-3.5" />
                            {monthLabel}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {showColumnToggle && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 gap-1">
                                    <Layers className="h-4 w-4" />
                                    <span className="hidden sm:inline">Columns</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[180px]">
                                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                                <DropdownMenuSeparator />
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
                                                {column.id.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                            </DropdownMenuCheckboxItem>
                                        );
                                    })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            {/* MODIFIED: Added overflow-y-auto and tableMaxHeight (e.g., max-h-[600px]) to this div. Removed overflow-hidden. */}
            <div className={cn(
                "rounded-md border border-slate-200 bg-white overflow-y-auto",
                tableMaxHeight // Use the prop for max height
            )}>
                <Table>
                    {/* MODIFIED: Added sticky, top-0, and z-10 to TableHeader */}
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-b-slate-200"> {/* Ensure border color consistency */}
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            className="font-semibold text-slate-700 whitespace-nowrap h-10 px-4 text-xs"
                                            // Optional: Add a specific background to TableHead if TableHeader's bg isn't enough or for override
                                            // style={{ backgroundColor: 'inherit' }} // or specific color like 'var(--slate-50)'
                                        >
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
                        {isLoading ? (
                            renderLoading()
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className={cn(
                                        "border-b border-slate-100 hover:bg-slate-50 transition-colors",
                                        onRowClick && "cursor-pointer"
                                    )}
                                    onClick={() => onRowClick && onRowClick(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="py-2.5 px-4">
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
                                    className="h-24 text-center text-slate-500"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {pagination && ( // Conditionally render pagination
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 py-2">
                    <div className="flex flex-1 items-center text-sm text-slate-500">
                        {table.getFilteredRowModel().rows.length > 0 ? (
                            <>
                                Showing {table.getState().pagination.pageIndex * pageSize + 1} to{" "}
                                {Math.min(
                                    (table.getState().pagination.pageIndex + 1) * pageSize,
                                    table.getFilteredRowModel().rows.length
                                )}{" "}
                                of {table.getFilteredRowModel().rows.length} entries
                            </>
                        ) : (
                            "Showing 0 to 0 of 0 entries"
                        )}
                    </div>

                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium">Rows</p>
                            <Select
                                value={`${pageSize}`}
                                onValueChange={(value) => {
                                    setPageSize(Number(value));
                                }}
                            >
                                <SelectTrigger className="h-8 w-[70px]">
                                    <SelectValue placeholder={pageSize} />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {[10, 20, 30, 50, 100].map((size) => (
                                        <SelectItem key={size} value={`${size}`}>
                                            {size}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                                className="h-8 w-8 p-0"
                            >
                                <span className="sr-only">Previous</span>
                                <ChevronDown className="h-4 w-4 rotate-90" />
                            </Button>
                            <div className="flex items-center gap-1.5">
                                {table.getPageCount() > 0 && Array.from({ length: Math.min(5, table.getPageCount()) }).map((_, i) => {
                                    let pageIdxToShow;
                                    const currentPage = table.getState().pagination.pageIndex;
                                    const totalPages = table.getPageCount();

                                    if (totalPages <= 5) {
                                        pageIdxToShow = i;
                                    } else {
                                        // Logic for ellipsis or more complex pagination display
                                        // Simplified: show current and pages around it
                                        if (i === 0) pageIdxToShow = 0; // First page
                                        else if (i === 4) pageIdxToShow = totalPages - 1; // Last page
                                        else if (i === 1 && currentPage > 1 && currentPage < totalPages - 2) pageIdxToShow = currentPage -1;
                                        else if (i === 2) pageIdxToShow = currentPage; // Current page (or middle one)
                                        else if (i === 3 && currentPage < totalPages - 2 && currentPage > 0) pageIdxToShow = currentPage + 1;
                                        else { // Fallback or simple sequence if near start/end
                                            if (currentPage < 2) pageIdxToShow = i;
                                            else if (currentPage > totalPages - 3) pageIdxToShow = totalPages - (5-i);
                                            else pageIdxToShow = currentPage + (i-2) // Centered around current
                                        }
                                    }
                                     // Ensure pageIdxToShow is valid
                                    if (pageIdxToShow < 0 || pageIdxToShow >= totalPages) return null;
                                    // Avoid duplicate page numbers if logic above results in them
                                    // This pagination button logic is a bit complex and might need more robust handling for all edge cases
                                    // For simplicity, the original logic was kept but can be improved.
                                    // The key is that pageIdxToShow should be a valid index.
                                    // A simpler approach for limited buttons:
                                    // const pageIdx = i; // if showing first 5 pages always, or adjust based on current
                                    
                                    // Using the original logic for page button indices for now:
                                     pageIdxToShow = i === 0
                                         ? 0
                                         : i === 4
                                             ? table.getPageCount() - 1
                                             : table.getState().pagination.pageIndex -2 + i; // This needs care for boundaries

                                    if (pageIdxToShow < 0 || pageIdxToShow >= table.getPageCount()) {
                                         // Fallback for simple pagination buttons if complex logic fails
                                         // This section ensures we still render *some* buttons if the above logic is tricky
                                         if (i < table.getPageCount()) pageIdxToShow = i; else return null;
                                    }
                                     // Ensure unique pages if calculated indices overlap, not handled here perfectly.

                                    return (
                                        <Button
                                            key={`page-${pageIdxToShow}`}
                                            variant={table.getState().pagination.pageIndex === pageIdxToShow ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => table.setPageIndex(pageIdxToShow)}
                                            className={cn(
                                                "h-8 w-8 p-0",
                                                table.getState().pagination.pageIndex === pageIdxToShow
                                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                                    : "text-slate-600"
                                            )}
                                        >
                                            {pageIdxToShow + 1}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                                className="h-8 w-8 p-0"
                            >
                                <span className="sr-only">Next</span>
                                <ChevronDown className="h-4 w-4 -rotate-90" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Month Sidebar Component
const MonthSidebar = ({ months, selectedMonth, onSelectMonth }) => {
    const [yearFilter, setYearFilter] = useState("all");

    // Extract years from month data
    const years = useMemo(() => {
        const uniqueYears = new Set();
        Object.keys(months || {}).forEach(month => {
            const [year] = month.split('-');
            uniqueYears.add(year);
        });
        return Array.from(uniqueYears).sort((a, b) => b - a); // Sort years descending
    }, [months]);

    // Filter and sort months
    const filteredMonths = useMemo(() => {
        if (!months) return [];

        return Object.entries(months)
            .filter(([month]) => {
                if (yearFilter === "all") return true;
                const [year] = month.split('-');
                return year === yearFilter;
            })
            .sort(([a], [b]) => new Date(b) - new Date(a))
            .map(([month, data]) => {
                const [year, monthNum] = month.split('-');
                const monthName = getMonthName(monthNum);
                return {
                    key: month,
                    label: `${monthName} ${year}`,
                    data
                };
            });
    }, [months, yearFilter]);

    if (years.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="px-2">
                <Select
                    value={yearFilter}
                    onValueChange={setYearFilter}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Filter by Year" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {years.map(year => (
                            <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <ScrollArea className="h-[600px]">
                <div className="space-y-1 pr-2">
                    {filteredMonths.map(month => {
                        const isSelected = selectedMonth === month.key;
                        const hasData = month.data.tableData && month.data.tableData.length > 0;
                        return (
                            <button
                                key={month.key}
                                onClick={() => onSelectMonth(month.key)}
                                className={cn(
                                    "w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-md",
                                    isSelected
                                        ? "bg-blue-600 text-white font-medium"
                                        : "hover:bg-slate-100 text-slate-700",
                                    !hasData && "opacity-60"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4" />
                                    <span>{month.label}</span>
                                </div>
                                {hasData ? (
                                    <Badge variant={isSelected ? "outline" : "secondary"} className={isSelected ? "bg-blue-500 text-white" : ""}>
                                        {month.data.tableData.length}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                                        Empty
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
};

// Animated Stats Card with better visualization
const AnimatedStatsCard = ({ title, value, description, icon, trend, trendValue, className }) => {
    const Icon = icon;

    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-700">{title}</CardTitle>
                    {Icon && (
                        <div className="rounded-full bg-blue-50 p-1.5 text-blue-600">
                            <Icon className="h-4 w-4" />
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-1">
                    <div className="text-2xl font-bold text-slate-900">{value}</div>
                    {trend && (
                        <div className={cn(
                            "flex items-center space-x-1 text-xs font-medium",
                            trend === "up" ? "text-emerald-600" : "text-red-600"
                        )}>
                            {trend === "up" ? (
                                <ArrowUpDown className="h-3.5 w-3.5 rotate-45" />
                            ) : (
                                <ArrowUpDown className="h-3.5 w-3.5 -rotate-45" />
                            )}
                            <span>{trendValue}</span>
                        </div>
                    )}
                    <p className="text-xs text-slate-500">{description}</p>
                </div>
            </CardContent>
        </Card>
    );
};

// Year Summary Table component for totals view
const YearSummaryTable = ({ year, data }) => {
    // Columns for the year summary table
    const columns = [
        {
            accessorKey: "month",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <IconLabel
                            icon={CalendarIcon}
                            label="Month"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div className="font-medium">{row.original.month}</div>,
        },
        {
            accessorKey: "transactions",
            header: ({ column }) => (
                <div className="flex items-center justify-end">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent text-right"
                    >
                        <IconLabel
                            icon={ListChecks}
                            label="Transactions"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <div className="text-right font-medium">{row.original.transactions.toLocaleString()}</div>
            ),
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <div className="flex items-center justify-end">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent text-right"
                    >
                        <IconLabel
                            icon={CircleDollarSign}
                            label="Total Amount"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <div className={cn(
                    "text-right font-bold whitespace-nowrap",
                    row.original.hasData ? "text-green-600" : "text-red-500"
                )}>
                    {row.original.hasData
                        ? formatAmount(row.original.amount)
                        : "No Data"}
                </div>
            ),
        },
    ];

    // Generate data for each month
    const monthlyData = [...Array(12)].map((_, index) => {
        const monthNumber = index + 1;
        const monthKey = `${year}-${String(monthNumber).padStart(2, '0')}`;
        const monthData = data[monthKey];
        const transactions = monthData?.tableData?.length || 0;
        const hasData = transactions > 0;
        const amount = hasData ? monthData.tableData.reduce((sum, row) => sum + parseFloat(row[8] || 0), 0) : 0;

        return {
            month: getMonthName(monthNumber),
            monthKey,
            transactions,
            amount,
            hasData
        };
    });

    // Calculate year totals
    const totalTransactions = monthlyData.reduce((sum, month) => sum + month.transactions, 0);
    const totalAmount = monthlyData.reduce((sum, month) => sum + month.amount, 0);

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-slate-50 pb-2 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-800">{year}</CardTitle>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center gap-1.5">
                            <ListChecks className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-medium">{totalTransactions.toLocaleString()} transactions</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CircleDollarSign className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-bold text-green-600">{formatAmount(totalAmount)}</span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <EnhancedDataTable
                    columns={columns}
                    data={monthlyData}
                    pagination={false}
                    showColumnToggle={false}
                />
            </CardContent>
        </Card>
    );
};

// Advanced Filter Panel Component
const AdvancedFilterPanel = ({ data, onFilterChange }) => {
    const [filters, setFilters] = useState({
        withholderPIN: '',
        withholdeeTypes: {
            suppliers: true,
            customers: true
        },
        status: 'all',
        amountRange: [0, 100000]
    });

    // Generate options for filter dropdowns
    const withholderPINs = getUniqueFilterOptions(data, 1); // Assuming index 1 has withholder PIN
    const statuses = getUniqueFilterOptions(data, 5); // Assuming index 5 has status

    // Find the max amount for the slider
    const maxAmount = data && data.length
        ? Math.max(...data.map(row => parseFloat(row[8] || 0))) + 10000
        : 100000;

    const handleFilterChange = (key, value) => {
        const newFilters = {
            ...filters,
            [key]: value
        };

        setFilters(newFilters);
        onFilterChange(newFilters);
    };

    return (
        <div className="space-y-4 p-4 bg-white rounded-md border border-slate-200">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Advanced Filters</h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        const resetFilters = {
                            withholderPIN: '',
                            withholdeeTypes: {
                                suppliers: true,
                                customers: true
                            },
                            status: 'all',
                            amountRange: [0, maxAmount]
                        };
                        setFilters(resetFilters);
                        onFilterChange(resetFilters);
                    }}
                    className="h-8 text-xs"
                >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Reset
                </Button>
            </div>

            <div className="space-y-3">
                <div className="space-y-1">
                    <Label htmlFor="withholderPIN" className="text-xs">Withholder PIN</Label>
                    <Select
                        value={filters.withholderPIN}
                        onValueChange={(value) => handleFilterChange('withholderPIN', value)}
                    >
                        <SelectTrigger id="withholderPIN" className="h-8 text-xs">
                            <SelectValue placeholder="All Withholders" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">All Withholders</SelectItem>
                            {withholderPINs.map(pin => (
                                <SelectItem key={pin} value={pin}>
                                    {pin}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="suppliers"
                                checked={filters.withholdeeTypes.suppliers}
                                onCheckedChange={(checked) => {
                                    handleFilterChange('withholdeeTypes', {
                                        ...filters.withholdeeTypes,
                                        suppliers: !!checked
                                    });
                                }}
                            />
                            <label
                                htmlFor="suppliers"
                                className="text-xs font-medium leading-none"
                            >
                                Suppliers
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="customers"
                                checked={filters.withholdeeTypes.customers}
                                onCheckedChange={(checked) => {
                                    handleFilterChange('withholdeeTypes', {
                                        ...filters.withholdeeTypes,
                                        customers: !!checked
                                    });
                                }}
                            />
                            <label
                                htmlFor="customers"
                                className="text-xs font-medium leading-none"
                            >
                                Customers
                            </label>
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="status" className="text-xs">Status</Label>
                    <Select
                        value={filters.status}
                        onValueChange={(value) => handleFilterChange('status', value)}
                    >
                        <SelectTrigger id="status" className="h-8 text-xs">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {statuses.map(status => (
                                <SelectItem key={status} value={status}>
                                    {status}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Amount Range</Label>
                        <span className="text-xs text-slate-500">
                            {formatAmount(filters.amountRange[0])} - {formatAmount(filters.amountRange[1])}
                        </span>
                    </div>
                    <Slider
                        defaultValue={[0, maxAmount]}
                        max={maxAmount}
                        step={1000}
                        value={filters.amountRange}
                        onValueChange={(value) => handleFilterChange('amountRange', value)}
                        className="py-2"
                    />
                </div>
            </div>
        </div>
    );
};

// ========================== MAIN COMPONENT ==========================
export function WHVATExtractorReports() {
    const exportSummaryToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Summary');
        
        // Add headers with separate IDX and ID columns
        worksheet.addRow(['IDX', 'ID', 'Company', 'Latest Extraction Date', 'Number of Extractions', 'Total Amount']);
        
        getFilteredSortedSummary().forEach((company, idx) => {
            worksheet.addRow([
                idx + 1,                // IDX
                company.id,             // ID
                company.company_name,    // Company Name
                company.latestExtractionDate,
                company.numberOfExtractions,
                company.totalAmountRaw
            ]);
        });

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        
        // Auto-fit columns
        worksheet.columns.forEach(column => {
            column.width = 15;  // Set a minimum width
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const timestamp = new Date().toISOString().split('T')[0];
        saveAs(new Blob([buffer]), `WHVAT_Summary_${timestamp}.xlsx`);
    };

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
    const [advancedFilters, setAdvancedFilters] = useState(null);
    const [selectedMonthKey, setSelectedMonthKey] = useState(null);
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);
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

    // Handle category filter changes
    const handleApplyFilters = (newFilters) => {
        setCategoryFilters(newFilters);
    };

    // Handle advanced filter changes
    const handleAdvancedFilterChange = (filters) => {
        setAdvancedFilters(filters);
        if (companyData) {
            filterData(companyData, filters);
        }
    };

    // Initial data fetch
    useEffect(() => {
        fetchCompanies();
        fetchAllCompanyData();
    }, []);

    // Handle company selection & filtering
    useEffect(() => {
        if (selectedCompany) {
            // First, filter all company data based on categories
            const filteredCompanies = applyFiltersToData(allCompanyData);

            // Then find the selected company in the filtered list
            const data = filteredCompanies.find(c => c.company_name === selectedCompany);

            if (data && data.extraction_data) {
                setCompanyData(data.extraction_data);
                filterData(data.extraction_data, advancedFilters);

                // Set initial selected month to the most recent one
                if (!selectedMonthKey && Object.keys(data.extraction_data).length > 0) {
                    const sortedMonths = Object.keys(data.extraction_data).sort((a, b) =>
                        new Date(b) - new Date(a)
                    );
                    setSelectedMonthKey(sortedMonths[0]);
                }
            } else {
                setCompanyData(null);
                setFilteredData(null);
                setSelectedMonthKey(null);
            }
        }
    }, [
        selectedCompany,
        allCompanyData,
        activeTab,
        searchTerm,
        showAllData,
        categoryFilters,
        dateRange
    ]);

    // Update filtered data when month selection changes
    useEffect(() => {
        if (companyData && selectedMonthKey && activeTab === 'monthWise') {
            const filtered = { [selectedMonthKey]: companyData[selectedMonthKey] };
            setFilteredData(filtered);
        }
    }, [selectedMonthKey, companyData, activeTab]);

    // Handle date range changes
    const handleDateRangeChange = (range) => {
        setDateRange(range);
        if (companyData) {
            filterData(companyData, advancedFilters);
        }
    };

    // Handle month selection
    const handleMonthSelect = (monthKey) => {
        setSelectedMonthKey(monthKey);
        if (activeTab !== 'monthWise') {
            setActiveTab('monthWise');
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
            toast({
                title: "Error",
                description: "Failed to fetch companies. Please try again.",
                variant: "destructive"
            });
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

                // Tag supplier and customer types based on data
                // This is a simplified approach - in a real app, you'd have actual data for this
                const suppliers = new Set();
                const customers = new Set();

                Object.values(extractionData).forEach(({ tableData }) => {
                    tableData?.forEach(row => {
                        // Mark as supplier if matches certain criteria
                        // This is just a placeholder logic - replace with actual business logic
                        if (row[1]) suppliers.add(row[1]);
                        if (row[2]) customers.add(row[2]);
                    });
                });

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
                    suppliers: Array.from(suppliers),
                    customers: Array.from(customers),
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
            toast({
                title: "Error",
                description: "Failed to fetch extraction data. Please try again.",
                variant: "destructive"
            });
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
    const filterData = (data, advFilters = null) => {
        if (!data) return;
        let filtered = { ...data };

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

        // Apply advanced filters to tableData in each month
        if (advFilters) {
            Object.keys(filtered).forEach(key => {
                if (filtered[key].tableData) {
                    filtered[key].tableData = filtered[key].tableData.filter(row => {
                        // Filter by withholder PIN
                        if (advFilters.withholderPIN && row[1] !== advFilters.withholderPIN) {
                            return false;
                        }

                        // Filter by status
                        if (advFilters.status !== 'all' && row[5] !== advFilters.status) {
                            return false;
                        }

                        // Filter by amount range
                        const amount = parseFloat(row[8] || 0);
                        if (amount < advFilters.amountRange[0] || amount > advFilters.amountRange[1]) {
                            return false;
                        }

                        return true;
                    });
                }
            });
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
        setAdvancedFilters(null);
        filterData(companyData);
    };

    // Handle export with advanced options
    const handleExport = async (options) => {
        if (!filteredData) return;

        const workbook = new ExcelJS.Workbook();

        // Apply supplier/customer filters based on options
        const filterData = (tableData, options) => {
            if (!tableData) return [];

            // If we're exporting all types, no filtering needed
            if (options.type === 'all') return tableData;

            // If we're doing custom filtering
            if (options.type === 'custom') {
                return tableData.filter(row => {
                    const pin = row[1]; // Assuming index 1 is withholder PIN

                    // This is simplified logic - replace with real business rules
                    const isSupplier = pin?.startsWith('A'); // Example logic
                    const isCustomer = pin?.startsWith('B'); // Example logic

                    if (options.includeSuppliers && isSupplier) return true;
                    if (options.includeCustomers && isCustomer) return true;

                    return false;
                });
            }

            // Filter by specific type
            return tableData.filter(row => {
                const pin = row[1];
                const isSupplier = pin?.startsWith('A'); // Example logic
                const isCustomer = pin?.startsWith('B'); // Example logic

                if (options.type === 'suppliers' && isSupplier) return true;
                if (options.type === 'customers' && isCustomer) return true;

                return false;
            });
        };

        // Get data to export based on range option
        let dataToExport;
        if (options.range === 'all') {
            dataToExport = { ...companyData };
        } else if (options.range === 'current') {
            dataToExport = { ...filteredData };
        } else if (options.range === 'custom' && options.dateRange.from && options.dateRange.to) {
            dataToExport = Object.fromEntries(
                Object.entries(companyData).filter(([key]) => {
                    const [year, month] = key.split('-');
                    const keyDate = new Date(year, parseInt(month) - 1);
                    return keyDate >= options.dateRange.from && keyDate <= options.dateRange.to;
                })
            );
        } else {
            dataToExport = { ...filteredData };
        }

        const worksheet = workbook.addWorksheet('All Data');
        const headers = [
            'Month/Year', 'Sr.No.', 'Withholder PIN', 'Withholdee PIN', 'Withholder Name',
            'Pay Point Name', 'Status', 'Invoice No', 'Certificate Date',
            'VAT Withholding Amount', 'WHT Certificate No'
        ];
        worksheet.addRow(headers);

        // Add different styles for headers
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };

        Object.entries(dataToExport).forEach(([month, data]) => {
            const [year, monthNum] = month.split('-');
            const monthName = `${getMonthName(monthNum)} ${year}`;

            if (data.tableData && data.tableData.length > 0) {
                // Apply supplier/customer filter to the data
                const filteredTableData = filterData(data.tableData, options);

                if (filteredTableData.length > 0) {
                    // Add data rows
                    filteredTableData.forEach(row => {
                        worksheet.addRow([monthName, ...row]);
                    });

                    // Add month total
                    const monthTotal = filteredTableData.reduce((sum, row) => sum + parseFloat(row[8] || 0), 0);
                    const totalRow = worksheet.addRow([
                        monthName, 'Total', '', '', '', '', '', '', '', formatAmount(monthTotal), ''
                    ]);

                    // Style total row
                    totalRow.font = { bold: true };
                    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5F7E8' } };

                    // Add separator row
                    worksheet.addRow([]);
                }
            } else {
                worksheet.addRow([monthName, `No records found for ${monthName}`]);
            }
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            column.width = 15;
        });

        // Format currency column
        worksheet.getColumn(10).numFmt = '#,##0.00 "KSH"';

        // Add a summary sheet
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.addRow(['Month/Year', 'Number of Transactions', 'Total Amount']);
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };

        // Add summary data
        Object.entries(dataToExport).forEach(([month, data]) => {
            const [year, monthNum] = month.split('-');
            const monthName = `${getMonthName(monthNum)} ${year}`;

            if (data.tableData && data.tableData.length > 0) {
                // Apply supplier/customer filter to the data
                const filteredTableData = filterData(data.tableData, options);
                const monthTotal = filteredTableData.reduce((sum, row) => sum + parseFloat(row[8] || 0), 0);

                summarySheet.addRow([
                    monthName,
                    filteredTableData.length,
                    formatAmount(monthTotal).replace('KSH ', '')
                ]);
            } else {
                summarySheet.addRow([monthName, 0, '0.00']);
            }
        });

        // Add grand total
        const grandTotal = Object.entries(dataToExport).reduce((sum, [_, data]) => {
            if (!data.tableData) return sum;
            const filteredTableData = filterData(data.tableData, options);
            return sum + filteredTableData.reduce((s, row) => s + parseFloat(row[8] || 0), 0);
        }, 0);

        const totalTransactions = Object.entries(dataToExport).reduce((sum, [_, data]) => {
            if (!data.tableData) return sum;
            const filteredTableData = filterData(data.tableData, options);
            return sum + filteredTableData.length;
        }, 0);

        const grandTotalRow = summarySheet.addRow([
            'GRAND TOTAL', totalTransactions, formatAmount(grandTotal).replace('KSH ', '')
        ]);
        grandTotalRow.font = { bold: true };
        grandTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD9D9' } };

        // Auto-fit columns
        summarySheet.columns.forEach(column => {
            column.width = 20;
        });
        summarySheet.getColumn(3).numFmt = '#,##0.00 "KSH"';

        const fileName = `${selectedCompany}_WHVAT_Extractions_${new Date().toISOString().split('T')[0]}.${options.format}`;

        // Save the file
        if (options.format === 'xlsx') {
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), fileName);
        } else {
            const buffer = await workbook.csv.writeBuffer();
            saveAs(new Blob([buffer]), fileName.replace('.xlsx', '.csv'));
        }

        toast({
            title: "Export Complete",
            description: `File "${fileName}" has been downloaded successfully.`,
        });
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
                    company.categories.join(' '),
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
            accessorKey: "index",
            header: "#",
            cell: ({ row }) => <div className="font-medium">{row.index + 1}</div>,
            enableSorting: false,
            size: 50,
        },
        {
            accessorKey: "company_name",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <IconLabel
                            icon={Briefcase}
                            label="Company"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <div
                    className="font-medium text-blue-700 hover:text-blue-900 cursor-pointer"
                    onClick={() => {
                        setSelectedCompany(row.original.company_name);
                        setView('detailed');
                    }}
                >
                    {row.original.company_name}
                </div>
            ),
        },
        // {
        //     accessorKey: "categories",
        //     header: "Categories",
        //     cell: ({ row }) => (
        //         <div className="flex flex-wrap gap-1">
        //             {row.original.categories.map((category) => (
        //                 <Badge key={category} variant="outline" className={
        //                     category === 'Acc' ? 'bg-blue-50 text-blue-800 border-blue-200' :
        //                         category === 'Imm' ? 'bg-green-50 text-green-800 border-green-200' :
        //                             category === 'Sheria' ? 'bg-purple-50 text-purple-800 border-purple-200' :
        //                                 category === 'Audit' ? 'bg-amber-50 text-amber-800 border-amber-200' :
        //                                     ''
        //                 }>
        //                     {category}
        //                 </Badge>
        //             ))}
        //         </div>
        //     ),
        // },
        {
            accessorKey: "suppliers",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <IconLabel
                            icon={Building}
                            label="Suppliers"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <div className="text-center">
                    <Badge variant="outline" className="bg-slate-50 border-slate-200">
                        {row.original.suppliers?.length || 0}
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: "customers",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <IconLabel
                            icon={Users}
                            label="Customers"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <div className="text-center">
                    <Badge variant="outline" className="bg-slate-50 border-slate-200">
                        {row.original.customers?.length || 0}
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: "latestExtractionDate",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <IconLabel
                            icon={CalendarIcon}
                            label="Latest Extraction"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div>{row.original.latestExtractionDate}</div>,
        },
        {
            accessorKey: "numberOfExtractions",
            header: ({ column }) => (
                <div className="flex items-center justify-end">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent text-right"
                    >
                        <IconLabel
                            icon={ListChecks}
                            label="Extractions"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div className="text-right">{row.original.numberOfExtractions}</div>,
        },
        {
            accessorKey: "totalAmount",
            header: ({ column }) => (
                <div className="flex items-center justify-end">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent text-right"
                    >
                        <IconLabel
                            icon={CircleDollarSign}
                            label="Total Amount"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <div className="text-right font-bold text-green-600 whitespace-nowrap">
                    {row.original.totalAmount}
                </div>
            ),
        },
    ], []);

    // Create month data table columns
    const createMonthDataColumns = () => [
        {
            accessorKey: "monthName",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <IconLabel
                            icon={CalendarIcon}
                            label="Month/Year"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div className="font-medium">{row.original.monthName}</div>,
        },
        {
            accessorKey: "0",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <span className="font-semibold">Sr.No.</span>
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div>{row.original[0]}</div>,
        },
        {
            accessorKey: "1",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <IconLabel
                            icon={Building}
                            label="Withholder PIN"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <div className="font-mono text-xs">{row.original[1]}</div>
            ),
        },
        {
            accessorKey: "2",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <IconLabel
                            icon={Users}
                            label="Withholdee PIN"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <div className="font-mono text-xs">{row.original[2]}</div>
            ),
        },
        {
            accessorKey: "3",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <span className="font-semibold">Withholder Name</span>
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div>{row.original[3]}</div>,
        },
        {
            accessorKey: "4",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <span className="font-semibold">Pay Point Name</span>
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div>{row.original[4]}</div>,
        },
        {
            accessorKey: "5",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <span className="font-semibold">Status</span>
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
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
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <span className="font-semibold">Invoice No</span>
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div>{row.original[6]}</div>,
        },
        {
            accessorKey: "7",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <span className="font-semibold">Certificate Date</span>
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div>{formatDate(row.original[7])}</div>,
        },
        {
            accessorKey: "8",
            header: ({ column }) => (
                <div className="flex items-center justify-end">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent text-right"
                    >
                        <IconLabel
                            icon={CircleDollarSign}
                            label="VAT Amount"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <div className="text-right font-medium text-green-600 whitespace-nowrap">
                    {formatAmount(parseFloat(row.original[8] || 0))}
                </div>
            ),
        },
        {
            accessorKey: "9",
            header: ({ column }) => (
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent"
                    >
                        <IconLabel
                            icon={TicketCheck}
                            label="WHT Certificate No"
                            className="font-semibold"
                        />
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div className="font-mono text-xs">{row.original[9]}</div>,
        },
    ];

    // Get all data with month/year column
    const getAllDataWithMonth = () => {
        if (!filteredData) return [];

        return Object.entries(filteredData).flatMap(([month, data]) => {
            if (!data.tableData || data.tableData.length === 0) {
                return [];
            }

            const [year, monthNum] = month.split('-');
            const monthName = `${getMonthName(monthNum)} ${year}`;

            return data.tableData.map(row => ({
                ...row,
                monthName,
                monthKey: month
            }));
        });
    };

    // Get unique years from filtered data
    const getYearsFromData = () => {
        if (!filteredData) return [];

        const years = new Set();
        Object.keys(filteredData).forEach(month => {
            const [year] = month.split('-');
            years.add(year);
        });

        return Array.from(years).sort((a, b) => b - a); // Sort descending
    };

    // Render summary view
    const renderSummaryView = () => {
        const summaryData = getFilteredSortedSummary();

        // Calculate summary statistics
        const totalCompanies = summaryData.length;
        const totalExtractions = summaryData.reduce((sum, company) => sum + company.numberOfExtractions, 0);
        const totalAmount = summaryData.reduce((sum, company) => sum + company.totalAmountRaw, 0);
        const companiesWithExtractions = summaryData.filter(c => c.numberOfExtractions > 0).length;
        const totalSuppliers = summaryData.reduce((sum, company) => sum + (company.suppliers?.length || 0), 0);
        const totalCustomers = summaryData.reduce((sum, company) => sum + (company.customers?.length || 0), 0);

        return (
            <>
                <div className="flex flex-wrap gap-2 items-center mb-4 justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Search companies, categories, amounts..."
                                value={summarySearch}
                                onChange={e => setSummarySearch(e.target.value)}
                                className="w-[350px] pl-9 bg-white border-slate-200"
                            />
                        </div>
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
                    <div className="flex items-center gap-2">
                        <Button onClick={exportSummaryToExcel} variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" /> Export to Excel
                        </Button>
                        <Button
                            onClick={() => {
                                setSummarySearch('');
                                handleApplyFilters({
                                    categories: {
                                        'All Categories': true,
                                        'Acc': false,
                                        'Imm': false,
                                        'Sheria': false,
                                        'Audit': false
                                    },
                                    categorySettings: {}
                                });
                            }}
                            variant="ghost"
                            size="sm"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" /> Reset Filters
                        </Button>
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

                {loading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-[500px] w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <Card className="border-slate-200">
                        <CardContent className="p-0">
                            <EnhancedDataTable
                                columns={summaryColumns}
                                data={summaryData}
                                searchPlaceholder="Search companies, amounts..."
                                onSearch={setSummarySearch}
                                isLoading={loading}
                                pagination={false}
                            />
                        </CardContent>
                    </Card>
                )}
            </>
        );
    };

    // Render detailed view
    const renderDetailedView = () => (
        <div className="grid grid-cols-5 gap-4 h-[680px]">
            {/* Left sidebar */}
            <div className="col-span-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search companies..."
                            value={sidebarSearchTerm}
                            onChange={(e) => setSidebarSearchTerm(e.target.value)}
                            className="w-full pl-9 bg-white border-slate-200"
                        />
                    </div>
                </div>

                <div className="p-2">
                    <Button
                        onClick={() => setIsCategoryFilterOpen(true)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                    >
                        <Filter className="h-4 w-4 mr-1" />
                        Filter Categories
                        <Badge variant="secondary" className="ml-2">
                            {companies.length}
                        </Badge>
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
                    <div className="space-y-2 p-4">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                ) : (
                    <ScrollArea className="h-[590px]">
                        <div className="space-y-0.5 px-1 py-2">
                            {companies
                                .filter(company =>
                                    !sidebarSearchTerm ||
                                    company.company_name.toLowerCase().includes(sidebarSearchTerm.toLowerCase())
                                )
                                .sort((a, b) => a.company_name.localeCompare(b.company_name))
                                .map((company) => {
                                    const isSelected = selectedCompany === company.company_name;
                                    // Get company data for badges
                                    const companyData = allCompanyData.find(c => c.company_name === company.company_name);
                                    const hasExtractions = companyData && Object.keys(companyData.extraction_data || {}).length > 0;

                                    return (
                                        <button
                                            key={company.company_name}
                                            onClick={() => setSelectedCompany(company.company_name)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-md transition-all",
                                                isSelected
                                                    ? "bg-blue-600 text-white font-medium shadow-md"
                                                    : "text-slate-700 hover:bg-slate-100",
                                                !hasExtractions && "opacity-70"
                                            )}
                                        >
                                            <div className="truncate flex-1 text-left">{company.company_name}</div>
                                            {companyData?.categories?.length > 0 && (
                                                <div className="flex gap-0.5 ml-2">
                                                    {companyData.categories.slice(0, 2).map((category) => (
                                                        <Badge
                                                            key={category}
                                                            variant="outline"
                                                            className={cn(
                                                                "text-[10px] px-1 py-0",
                                                                isSelected
                                                                    ? "bg-blue-500 border-blue-400 text-white"
                                                                    : category === 'Acc'
                                                                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                                                                        : category === 'Imm'
                                                                            ? 'bg-green-50 text-green-800 border-green-200'
                                                                            : category === 'Sheria'
                                                                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                                                                : 'bg-amber-50 text-amber-800 border-amber-200'
                                                            )}
                                                        >
                                                            {category}
                                                        </Badge>
                                                    ))}
                                                    {companyData.categories.length > 2 && (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-[10px] px-1 py-0",
                                                                isSelected ? "bg-blue-500 border-blue-400 text-white" : "bg-slate-50 border-slate-200"
                                                            )}
                                                        >
                                                            +{companyData.categories.length - 2}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Main content area */}
            <div className="col-span-4">
                {selectedCompany ? (
                    loading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-60 w-full" />
                            <Skeleton className="h-40 w-full" />
                        </div>
                    ) : companyData ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">{selectedCompany}</h2>
                                    <div className="text-sm text-slate-500 mt-1">
                                        {Object.keys(companyData).length} extraction periods | {" "}
                                        <span className="text-green-600 font-semibold">
                                            Total: {formatAmount(calculateOverallTotal(companyData))}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant={showFiltersPanel ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                                        className="gap-1.5"
                                    >
                                        <SlidersHorizontal className="h-4 w-4" />
                                        Filters
                                        {advancedFilters && (
                                            <Badge variant={showFiltersPanel ? "outline" : "secondary"} className={showFiltersPanel ? "bg-blue-500 text-white" : ""}>
                                                Active
                                            </Badge>
                                        )}
                                    </Button>

                                    <ExportOptionsDialog
                                        data={companyData}
                                        company={selectedCompany}
                                        onExport={handleExport}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                {/* Advanced filters panel */}
                                {showFiltersPanel && (
                                    <div className="col-span-1 row-span-2">
                                        <AdvancedFilterPanel
                                            data={getAllDataWithMonth()}
                                            onFilterChange={handleAdvancedFilterChange}
                                        />
                                    </div>
                                )}

                                <div className={cn(
                                    "col-span-4 space-y-4",
                                    showFiltersPanel && "col-span-3"
                                )}>
                                    <Card className="border-slate-200">
                                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-slate-50 border-b">
                                            <CardTitle className="text-base font-semibold">
                                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                                    <TabsList className="bg-slate-200/70 h-9 w-auto">
                                                        <TabsTrigger
                                                            value="allData"
                                                            className={activeTab === "allData" ? "bg-white shadow-sm" : "hover:bg-slate-100 text-slate-700 data-[state=active]:bg-white"}
                                                        >
                                                            <BookOpen className="h-4 w-4 mr-1.5" />
                                                            All Data
                                                        </TabsTrigger>
                                                        <TabsTrigger
                                                            value="monthWise"
                                                            className={activeTab === "monthWise" ? "bg-white shadow-sm" : "hover:bg-slate-100 text-slate-700 data-[state=active]:bg-white"}
                                                        >
                                                            <CalendarIcon className="h-4 w-4 mr-1.5" />
                                                            Month View
                                                        </TabsTrigger>
                                                        <TabsTrigger
                                                            value="totals"
                                                            className={activeTab === "totals" ? "bg-white shadow-sm" : "hover:bg-slate-100 text-slate-700 data-[state=active]:bg-white"}
                                                        >
                                                            <BarChart3 className="h-4 w-4 mr-1.5" />
                                                            Totals
                                                        </TabsTrigger>
                                                    </TabsList>
                                                </Tabs>
                                            </CardTitle>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    onClick={clearFilters}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-9 gap-1.5 text-slate-700 hover:text-slate-900"
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">Reset</span>
                                                </Button>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="p-0">
                                            <TabsContent value="allData" className="m-0">
                                                <div className="p-4 bg-white border-b">
                                                    <div className="flex flex-wrap gap-4 items-center">
                                                        <DateRangePicker
                                                            value={dateRange}
                                                            onChange={handleDateRangeChange}
                                                        />

                                                        <div className="flex items-center gap-2 ml-auto">
                                                            <Input
                                                                placeholder="Search within data..."
                                                                value={searchTerm}
                                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                                className="w-64 bg-white border-slate-200"
                                                            />
                                                            <Button
                                                                onClick={() => setShowAllData(!showAllData)}
                                                                variant={showAllData ? "default" : "outline"}
                                                                size="sm"
                                                                className="whitespace-nowrap h-10"
                                                            >
                                                                {showAllData ? (
                                                                    <>
                                                                        <Eye className="mr-1.5 h-4 w-4" />
                                                                        Showing All
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Eye className="mr-1.5 h-4 w-4" />
                                                                        Show All
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {filteredData && Object.keys(filteredData).length > 0 ? (
                                                    <ScrollArea className="h-[420px]">
                                                        <EnhancedDataTable
                                                            columns={createMonthDataColumns()}
                                                            data={getAllDataWithMonth()}
                                                            searchPlaceholder="Search in all months..."
                                                            onSearch={setSearchTerm}
                                                            isLoading={loading}
                                                            initialPageSize={20}
                                                        />
                                                    </ScrollArea>
                                                ) : (
                                                    <div className="flex items-center justify-center h-[400px] border-t">
                                                        <div className="text-center max-w-md p-6">
                                                            <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                                                <Search className="h-8 w-8 text-slate-400" />
                                                            </div>
                                                            <h3 className="text-lg font-semibold text-slate-800">No Data Available</h3>
                                                            <p className="text-slate-500 mt-2">
                                                                {dateRange.from && dateRange.to
                                                                    ? "No data found in the selected date range"
                                                                    : "No extraction data available for this company"}
                                                            </p>
                                                            {(dateRange.from || dateRange.to || searchTerm) && (
                                                                <Button onClick={clearFilters} variant="outline" className="mt-4">
                                                                    Clear Filters
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            <TabsContent value="monthWise" className="m-0">
                                                <div className="grid grid-cols-4 h-[500px] divide-x divide-slate-200">
                                                    <div className="col-span-1 border-r">
                                                        <div className="p-3 bg-slate-50 border-b">
                                                            <h3 className="text-sm font-medium text-slate-700">Extractions by Month</h3>
                                                        </div>
                                                        <MonthSidebar
                                                            months={companyData}
                                                            selectedMonth={selectedMonthKey}
                                                            onSelectMonth={handleMonthSelect}
                                                        />
                                                    </div>

                                                    <div className="col-span-3 border-l overflow-hidden">
                                                        {selectedMonthKey && filteredData && filteredData[selectedMonthKey] ? (
                                                            <div className="h-full flex flex-col">
                                                                <div className="bg-slate-50 p-3 border-b flex justify-between items-center">
                                                                    <div>
                                                                        <h3 className="text-base font-semibold text-slate-800">
                                                                            {(() => {
                                                                                const [year, monthNum] = selectedMonthKey.split('-');
                                                                                return `${getMonthName(monthNum)} ${year}`;
                                                                            })()}
                                                                        </h3>
                                                                        <p className="text-sm text-slate-500">
                                                                            {filteredData[selectedMonthKey].tableData?.length || 0} records
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-lg font-bold text-green-600">
                                                                        {formatAmount(calculateTotal(filteredData[selectedMonthKey]))}
                                                                    </div>
                                                                </div>

                                                                <div className="flex-1 overflow-auto p-4">
                                                                    {filteredData[selectedMonthKey].tableData &&
                                                                        filteredData[selectedMonthKey].tableData.length > 0 ? (
                                                                        <EnhancedDataTable
                                                                            columns={createMonthDataColumns().slice(1)} // Remove month column
                                                                            data={filteredData[selectedMonthKey].tableData}
                                                                            searchPlaceholder={`Search in ${getMonthName(selectedMonthKey.split('-')[1])}...`}
                                                                            onSearch={setSearchTerm}
                                                                            pagination={false}
                                                                            additionalFilters={[
                                                                                <Input
                                                                                    key="search-input"
                                                                                    placeholder="Search..."
                                                                                    value={searchTerm}
                                                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                                                    className="w-60 bg-white border-slate-200"
                                                                                />
                                                                            ]}
                                                                        />
                                                                    ) : (
                                                                        <div className="flex items-center justify-center h-full">
                                                                            <div className="text-center">
                                                                                <h3 className="text-lg font-semibold text-slate-800">No Records Found</h3>
                                                                                <p className="text-slate-500 mt-2">
                                                                                    This month has no extraction data
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full">
                                                                <div className="text-center">
                                                                    <h3 className="text-lg font-semibold text-slate-800">No Month Selected</h3>
                                                                    <p className="text-slate-500 mt-2">
                                                                        Select a month from the sidebar to view details
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="totals" className="m-0">
                                                <ScrollArea className="h-[500px]">
                                                    <div className="p-6 space-y-6">
                                                        {getYearsFromData().map(year => (
                                                            <YearSummaryTable
                                                                key={year}
                                                                year={year}
                                                                data={filteredData}
                                                            />
                                                        ))}

                                                        {getYearsFromData().length === 0 && (
                                                            <div className="flex items-center justify-center h-[400px]">
                                                                <div className="text-center">
                                                                    <h3 className="text-lg font-semibold text-slate-800">No Data Available</h3>
                                                                    <p className="text-slate-500 mt-2">
                                                                        No extraction data available for totals view
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </TabsContent>
                                        </CardContent>
                                    </Card>

                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full bg-white p-8 rounded-lg border border-slate-200">
                            <div className="text-center max-w-md">
                                <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                    <Search className="h-8 w-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800">No Data Available</h3>
                                <p className="text-slate-500 mt-2">
                                    No extraction data found for this company
                                </p>
                                <Button variant="outline" className="mt-4" onClick={() => setSelectedCompany(null)}>
                                    Select Another Company
                                </Button>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="flex items-center justify-center h-full bg-white p-8 rounded-lg border border-slate-200">
                        <div className="text-center max-w-md">
                            <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                                <Briefcase className="h-8 w-8 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">Select a Company</h3>
                            <p className="text-slate-500 mt-2">
                                Choose a company from the sidebar to view WHVAT extraction data
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );// Responsive view wrapper

    const renderResponsiveView = () => (
        <div className="hidden md:block">
            {view === 'summary' ? renderSummaryView() : renderDetailedView()}
        </div>
    );

    // Mobile view
    const renderMobileView = () => (
        <div className="md:hidden p-4">
            <Card className="border-slate-200">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-slate-800">WHVAT Reports</CardTitle>
                    <CardDescription>
                        This view is optimized for larger screens. Please use a tablet or desktop device for the best experience.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-center">
                        <MonitorSmartphone className="h-16 w-16 text-slate-400" />
                    </div>
                    <p className="text-center text-slate-500 text-sm">
                        Switch to a larger screen to access all features of the WHVAT Extractor Reports.
                    </p>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <Card className="w-full min-h-[940px] border-slate-200 shadow-sm bg-slate-50">
            <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center">
                            <BarChart3 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-xl text-blue-800">WH VAT Extractor Reports</CardTitle>
                            <CardDescription className="mt-0.5">
                                Analysis and reporting for WithHolding VAT extractions
                            </CardDescription>
                        </div>
                    </div>

                    <Tabs value={view} onValueChange={setView} className="ml-auto">
                        <TabsList className="bg-slate-200/70 h-9">
                            <TabsTrigger
                                value="summary"
                                className={view === "summary" ? "bg-white shadow-sm" : "hover:bg-slate-100 text-slate-700 data-[state=active]:bg-white"}
                            >
                                <PieChart className="h-4 w-4 mr-1.5" />
                                Summary
                            </TabsTrigger>
                            <TabsTrigger
                                value="detailed"
                                className={view === "detailed" ? "bg-white shadow-sm" : "hover:bg-slate-100 text-slate-700 data-[state=active]:bg-white"}
                            >
                                <Layers className="h-4 w-4 mr-1.5" />
                                Detailed
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {renderResponsiveView()}
                {renderMobileView()}
            </CardContent>
        </Card>
    );
}