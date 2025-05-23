
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
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui'; // Assuming this path is correct

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
    if (amount === undefined || amount === null || isNaN(amount)) return 'KSH 0.00';
    return `KSH ${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} `;
};

// Format date to readable format
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    // Try to parse as ISO first
    let date = parseISO(dateString);

    // If not valid, try dd/MM/yyyy
    if (!isValid(date)) {
        date = parse(dateString, 'dd/MM/yyyy', new Date());
    }
    // If still not valid, try yyyy-MM-dd
    if (!isValid(date)) {
        date = parse(dateString, 'yyyy-MM-dd', new Date());
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

// Helper function to determine client status
const calculateClientStatus = (fromDateStr, toDateStr) => {
    if (!fromDateStr || !toDateStr) return 'missing'; // Or 'inactive' based on your logic

    const fromDate = parse(fromDateStr, 'dd/MM/yyyy', new Date());
    const toDate = parse(toDateStr, 'dd/MM/yyyy', new Date());
    const today = new Date();

    if (!isValid(fromDate) || !isValid(toDate)) return 'missing';

    // Set time to start/end of day for accurate range comparison
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);
    today.setHours(0, 0, 0, 0);

    return today >= fromDate && today <= toDate ? 'active' : 'inactive';
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
    const [popoverOpen, setPopoverOpen] = useState(false);

    useEffect(() => {
        setDate({ from: value?.from || undefined, to: value?.to || undefined });
    }, [value]);

    const handleApply = useCallback(() => {
        onChange(date);
        setPopoverOpen(false);
    }, [date, onChange]);

    const handleReset = useCallback(() => {
        setDate({ from: undefined, to: undefined });
        onChange({ from: null, to: null });
        setPopoverOpen(false);
    }, [onChange]);

    return (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left bg-white border-slate-200 hover:bg-slate-50",
                        !date.from && "text-muted-foreground"
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
                        onClick={handleReset}
                    >
                        Reset
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleApply}
                        disabled={!date.from || !date.to}
                    >
                        Apply
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

// Month/Year selection component with visual month grid
const MonthYearSelector = ({ onSelect, selectedYear, selectedMonth }) => {
    const [year, setYear] = useState(selectedYear || new Date().getFullYear());
    const [month, setMonth] = useState(selectedMonth || null);

    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const yearsArray = Array.from(
            { length: currentYear - 2013 + 1 },
            (_, i) => 2013 + i
        ).reverse();
        return yearsArray;
    }, []);

    const months = [
        "January", "February", "March", "April",
        "May", "June", "July", "August",
        "September", "October", "November", "December"
    ];

    const handleSelectMonth = useCallback((selectedMonthIndex) => {
        setMonth(selectedMonthIndex);
        onSelect(year, selectedMonthIndex);
    }, [year, onSelect]);

    const handleYearChange = useCallback((newYearStr) => {
        const newYear = parseInt(newYearStr);
        setYear(newYear);
        if (month) {
            onSelect(newYear, month);
        }
    }, [month, onSelect]);

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
                        onClick={() => handleSelectMonth(index + 1)}
                    >
                        {m.substring(0, 3)}
                    </Button>
                ))}
            </div>
        </div>
    );
};

// Advanced Export Options Dialog
const ExportOptionsDialog = ({ data, companyName, onExport }) => {
    const [exportType, setExportType] = useState("all");
    const [exportRange, setExportRange] = useState("all");
    const [includeSuppliers, setIncludeSuppliers] = useState(true);
    const [includeCustomers, setIncludeCustomers] = useState(true);
    const [dateRange, setDateRange] = useState({ from: null, to: null });
    const [exportFormat, setExportFormat] = useState("xlsx");
    const [dialogOpen, setDialogOpen] = useState(false);


    const handleExportClick = useCallback(() => {
        onExport({
            type: exportType,
            range: exportRange,
            includeSuppliers,
            includeCustomers,
            dateRange,
            format: exportFormat
        });
        setDialogOpen(false); // Close dialog on export
    }, [exportType, exportRange, includeSuppliers, includeCustomers, dateRange, exportFormat, onExport]);

    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Download className="mr-2 h-4 w-4" /> Export
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle>Export Options</DialogTitle>
                    <DialogDescription>
                        Customize your export for {companyName || "this data"}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium">Data Selection</h3>
                        <RadioGroup
                            value={exportType}
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
                            value={exportRange}
                            onValueChange={setExportRange}
                            className="flex flex-col space-y-2"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="all" id="t1" />
                                <Label htmlFor="t1">All Time</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="current" id="t2" />
                                <Label htmlFor="t2">Current View (Filtered)</Label>
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
                            value={exportFormat}
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
                    <Button onClick={handleExportClick}>
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
    data, // Data is already filtered/searched by parent
    searchPlaceholder = "Search...", // This is now just a visual placeholder
    pagination = true,
    additionalFilters = [], // Custom components for filters (like search input)
    monthLabel, // Specific label for month-wise view
    onRowClick,
    isLoading = false,
    emptyMessage = "No results found",
    showColumnToggle = true,
    initialPageSize = 10,
    tableMaxHeight = "max-h-[600px]",
    // NEW: Pass page-related state/setters if parent handles pagination
    // onPageIndexChange, onPageSizeChange, currentPageIndex, currentPageSize, totalRowCount
}) {
    const [sorting, setSorting] = useState([]);
    const [columnFilters, setColumnFilters] = useState([]); // This will likely be empty if parent handles filtering
    const [columnVisibility, setColumnVisibility] = useState({});
    const [rowSelection, setRowSelection] = useState({});
    const [pageSize, setPageSize] = useState(initialPageSize);

    // If the parent component manages the data, ensure it's stable.
    // The data prop here should be the *final* data for the table.
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        // No need for onColumnFiltersChange and getFilteredRowModel if parent handles all filtering
        // onColumnFiltersChange: setColumnFilters,
        // getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters, // This might be unused
            columnVisibility,
            rowSelection,
            pagination: {
                pageSize,
                pageIndex: 0 // Always reset to 0 as data is filtered by parent
            }
        },
    });

    React.useEffect(() => {
        table.setPageSize(pageSize);
    }, [pageSize, table]);


    const renderLoading = () => (
        <>
            {Array.from({ length: initialPageSize }).map((_, i) => (
                <TableRow key={`skeleton - ${i} `}>
                    {columns.map((col, j) => (
                        <TableCell key={`skeleton - cell - ${i} -${j} `}>
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
                    {/* The search input is now always passed via additionalFilters from parent */}
                    {additionalFilters.map((filter, index) => (
                        <React.Fragment key={`filter - ${index} `}>
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

            <div className={cn(
                "rounded-md border border-slate-200 bg-white overflow-y-auto",
                tableMaxHeight
            )}>
                <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-b-slate-200">
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            className="font-semibold text-slate-700 whitespace-nowrap h-10 px-4 text-xs"
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

            {pagination && (
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
                            value={`${pageSize} `}
                            onValueChange={(value) => {
                                setPageSize(Number(value));
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={pageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 20, 30, 50, 100].map((size) => (
                                    <SelectItem key={size} value={`${size} `}>
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
                                const currentPage = table.getState().pagination.pageIndex;
                                const totalPages = table.getPageCount();
                                let pageIdxToShow;

                                if (totalPages <= 5) {
                                    pageIdxToShow = i;
                                } else {
                                    if (currentPage < 2) { // Near start
                                        pageIdxToShow = i;
                                    } else if (currentPage > totalPages - 3) { // Near end
                                        pageIdxToShow = totalPages - (5 - i);
                                    } else { // Middle
                                        pageIdxToShow = currentPage - 2 + i;
                                    }
                                }

                                // Ensure page index is within bounds and not negative
                                if (pageIdxToShow < 0 || pageIdxToShow >= totalPages) return null;

                                return (
                                    <Button
                                        key={`page - ${pageIdxToShow} `}
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
        )
    }
        </div >
    );
}

// Month Sidebar Component
const MonthSidebar = ({ months, selectedMonthKey, onSelectMonth }) => {
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
            .sort(([a], [b]) => new Date(b) - new Date(a)) // Sort by date descending
            .map(([monthKey, data]) => {
                const [year, monthNum] = monthKey.split('-');
                const monthName = getMonthName(monthNum);
                return {
                    key: monthKey,
                    label: `${monthName} ${year} `,
                    tableData: data.tableData // Pass the table data directly
                };
            });
    }, [months, yearFilter]);

    if (years.length === 0 && Object.keys(months || {}).length === 0) {
        return (
            <div className="p-4 text-center text-slate-500">
                No monthly data available.
            </div>
        );
    }

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
                        const isSelected = selectedMonthKey === month.key;
                        const hasData = month.tableData && month.tableData.length > 0;
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
                                        {month.tableData.length}
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
    const columns = useMemo(() => [
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
    ], []);

    // Generate data for each month
    const monthlyData = useMemo(() => {
        return [...Array(12)].map((_, index) => {
            const monthNumber = index + 1;
            const monthKey = `${year} -${String(monthNumber).padStart(2, '0')} `;
            const monthData = data[monthKey]; // Data is already filtered by parent
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
    }, [year, data]);

    // Calculate year totals
    const totalTransactions = useMemo(() => monthlyData.reduce((sum, month) => sum + month.transactions, 0), [monthlyData]);
    const totalAmount = useMemo(() => monthlyData.reduce((sum, month) => sum + month.amount, 0), [monthlyData]);

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
                    tableMaxHeight="max-h-[unset]" // Allow table to size dynamically
                />
            </CardContent>
        </Card>
    );
};

// Advanced Filter Panel Component
const AdvancedFilterPanel = ({ rawAllDetailedData, currentFilters, onFilterChange, onReset }) => {
    const [filters, setFilters] = useState(currentFilters);

    useEffect(() => {
        setFilters(currentFilters);
    }, [currentFilters]);

    // Calculate max amount for the slider based on current data
    const maxAmount = useMemo(() => {
        if (!rawAllDetailedData || rawAllDetailedData.length === 0) return 100000;
        const amounts = rawAllDetailedData.map(row => parseFloat(row[8] || 0));
        return Math.max(...amounts) + 1000; // Add buffer
    }, [rawAllDetailedData]);

    // Generate options for filter dropdowns from all detailed data
    const withholderPINs = useMemo(() => getUniqueFilterOptions(rawAllDetailedData, 1), [rawAllDetailedData]);
    const statuses = useMemo(() => getUniqueFilterOptions(rawAllDetailedData, 5), [rawAllDetailedData]);

    const handleFilterChange = useCallback((key, value) => {
        setFilters(prev => {
            const newFilters = { ...prev, [key]: value };
            onFilterChange(newFilters);
            return newFilters;
        });
    }, [onFilterChange]);

    const handleReset = useCallback(() => {
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
        onReset(resetFilters);
    }, [maxAmount, onReset]);

    // Ensure amount range is within maxAmount bounds on initial load/reset
    useEffect(() => {
        if (filters.amountRange[1] > maxAmount) {
            setFilters(prev => ({ ...prev, amountRange: [prev.amountRange[0], maxAmount] }));
        }
    }, [maxAmount, filters.amountRange]);


    return (
        <div className="space-y-4 p-4 bg-white rounded-md border border-slate-200">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Advanced Filters</h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
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
                                id="adv-suppliers"
                                checked={filters.withholdeeTypes.suppliers}
                                onCheckedChange={(checked) => {
                                    handleFilterChange('withholdeeTypes', {
                                        ...filters.withholdeeTypes,
                                        suppliers: !!checked
                                    });
                                }}
                            />
                            <label
                                htmlFor="adv-suppliers"
                                className="text-xs font-medium leading-none"
                            >
                                Suppliers
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="adv-customers"
                                checked={filters.withholdeeTypes.customers}
                                onCheckedChange={(checked) => {
                                    handleFilterChange('withholdeeTypes', {
                                        ...filters.withholdeeTypes,
                                        customers: !!checked
                                    });
                                }}
                            />
                            <label
                                htmlFor="adv-customers"
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
    // ======== State Management ========
    const [view, setView] = useState('summary'); // 'summary' | 'detailed'
    const [allRawCompaniesData, setAllRawCompaniesData] = useState([]); // All companies with their raw extraction data
    const [selectedCompanyId, setSelectedCompanyId] = useState(null); // ID of the currently selected company
    const [loading, setLoading] = useState(true);

    // Summary View States
    const [summarySearch, setSummarySearch] = useState('');
    const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
    const [categoryFilters, setCategoryFilters] = useState({
        categories: {
            'All Categories': false, // Default to false, let specific categories drive
            'Acc': true,
            'Imm': false,
            'Sheria': false,
            'Audit': false
        },
        categorySettings: {
            'Acc': { clientStatus: { All: false, Active: true, Inactive: false, Missing: false }, sectionStatus: { All: false, Active: true, Inactive: false, Missing: false } },
            'Imm': { clientStatus: { All: false, Active: true, Inactive: false, Missing: false }, sectionStatus: { All: false, Active: true, Inactive: false, Missing: false } },
            'Sheria': { clientStatus: { All: false, Active: true, Inactive: false, Missing: false }, sectionStatus: { All: false, Active: true, Inactive: false, Missing: false } },
            'Audit': { clientStatus: { All: false, Active: true, Inactive: false, Missing: false }, sectionStatus: { All: false, Active: true, Inactive: false, Missing: false } },
        }
    });

    // Detailed View States
    const [sidebarSearchTerm, setSidebarSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('allData'); // 'allData' | 'monthWise' | 'totals'
    const [detailedSearchTerm, setDetailedSearchTerm] = useState('');
    const [detailedDateRange, setDetailedDateRange] = useState({ from: null, to: null });
    const [selectedMonthKey, setSelectedMonthKey] = useState(null); // YYYY-MM format
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState({
        withholderPIN: '',
        withholdeeTypes: { suppliers: true, customers: true },
        status: 'all',
        amountRange: [0, 100000] // Initial arbitrary range, updated dynamically
    });

    // ======== Data Fetching ========
    const fetchCompaniesAndExtractions = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch all companies
            const { data: companiesData, error: companiesError } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*');
            if (companiesError) throw companiesError;

            // Fetch all WHVAT extractions
            const { data: extractionsData, error: extractionsError } = await supabase
                .from('whvat_extractions')
                .select('company_id, extraction_data'); // Only need company_id and the actual data blob
            if (extractionsError) throw extractionsError;

            // Map extractions by company_id for efficient lookup
            const extractionsMap = new Map();
            extractionsData.forEach(extraction => {
                if (!extractionsMap.has(extraction.company_id)) {
                    extractionsMap.set(extraction.company_id, {});
                }
                // Merge all month data for a company from all its extractions
                if (extraction.extraction_data) {
                    Object.entries(extraction.extraction_data).forEach(([dateKey, data]) => {
                        if (!extractionsMap.get(extraction.company_id)[dateKey]) {
                            extractionsMap.get(extraction.company_id)[dateKey] = {
                                extractionDate: data.extractionDate, // Keep the latest extraction date if multiple for a month
                                tableData: []
                            };
                        }
                        if (data.tableData) {
                            extractionsMap.get(extraction.company_id)[dateKey].tableData.push(...data.tableData);
                        }
                    });
                }
            });

            // Combine company info with aggregated extraction data and calculated categories/statuses
            const combinedData = companiesData.map(company => {
                const companyExtractions = extractionsMap.get(company.id) || {};

                // Calculate client statuses for categories
                const acc_client_status = calculateClientStatus(company.acc_client_effective_from, company.acc_client_effective_to);
                const imm_client_status = calculateClientStatus(company.imm_client_effective_from, company.imm_client_effective_to);
                const sheria_client_status = calculateClientStatus(company.sheria_client_effective_from, company.sheria_client_effective_to);
                const audit_client_status = calculateClientStatus(company.audit_client_effective_from, company.audit_client_effective_to);

                // Determine which categories this company belongs to (based on whether the fields exist)
                const categories = [];
                if (company.acc_client_effective_from || company.acc_client_effective_to) categories.push('Acc');
                if (company.imm_client_effective_from || company.imm_client_effective_to) categories.push('Imm');
                if (company.sheria_client_effective_from || company.sheria_client_effective_to) categories.push('Sheria');
                if (company.audit_client_effective_from || company.audit_client_effective_to) categories.push('Audit');

                // Basic supplier/customer identification (Placeholder logic)
                const suppliers = new Set();
                const customers = new Set();
                Object.values(companyExtractions).forEach(({ tableData }) => {
                    tableData?.forEach(row => {
                        // Assuming row[1] is Withholder PIN and row[2] is Withholdee PIN
                        // Example: If PIN starts with 'S' it's a supplier, if 'C' it's a customer
                        if (row[1] && row[1].toString().startsWith('S')) suppliers.add(row[1]);
                        if (row[2] && row[2].toString().startsWith('C')) customers.add(row[2]);
                    });
                });

                // Calculate total amount and latest extraction date for summary view
                let latestExtractionDate = 'N/A';
                let totalAmountRaw = 0;
                let numberOfExtractions = 0; // Number of unique month extractions
                const extractionDates = [];

                Object.values(companyExtractions).forEach(monthData => {
                    if (monthData.tableData && monthData.tableData.length > 0) {
                        numberOfExtractions++;
                        totalAmountRaw += monthData.tableData.reduce((sum, row) => sum + parseFloat(row[8] || 0), 0);
                        if (monthData.extractionDate) {
                            extractionDates.push(new Date(monthData.extractionDate));
                        }
                    }
                });

                if (extractionDates.length > 0) {
                    latestExtractionDate = new Date(Math.max(...extractionDates)).toLocaleDateString();
                }

                return {
                    id: company.id,
                    company_name: company.company_name,
                    extraction_data: companyExtractions, // Monthly aggregated data for this company
                    categories,
                    acc_client_status, imm_client_status, sheria_client_status, audit_client_status,
                    suppliers: Array.from(suppliers),
                    customers: Array.from(customers),
                    latestExtractionDate,
                    numberOfExtractions,
                    totalAmountRaw,
                };
            });
            setAllRawCompaniesData(combinedData);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to fetch data. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCompaniesAndExtractions();
    }, [fetchCompaniesAndExtractions]);

    // ======== Filter Functions (Memoized) ========

    // Apply category filters to the *full* list of companies for sidebar and summary
    const applyCategoryFilters = useCallback((companies, filters) => {
        if (!filters || Object.keys(filters.categories).length === 0) {
            return companies;
        }

        const selectedCategories = Object.entries(filters.categories)
            .filter(([category, isSelected]) => isSelected && category !== 'All Categories')
            .map(([category]) => category);

        const isAllCategoriesSelected = filters.categories['All Categories'];

        if (selectedCategories.length === 0 && !isAllCategoriesSelected) {
            // If no specific categories are selected and "All Categories" is also not selected
            // This might mean "show nothing" or "show all by default if no active filters"
            // For now, let's interpret as show all (no filter applied) if nothing specific picked.
            return companies;
        }

        return companies.filter(company => {
            if (isAllCategoriesSelected) {
                return true; // If "All Categories" is checked, include all companies regardless of their specific categories
            }

            // Check if the company belongs to at least one of the actively selected categories
            const companyHasSelectedCategory = selectedCategories.some(selectedCat =>
                company.categories.includes(selectedCat)
            );

            if (!companyHasSelectedCategory) {
                return false;
            }

            // Now apply client status filters for the selected categories
            return selectedCategories.every(selectedCat => {
                const categorySettings = filters.categorySettings?.[selectedCat];
                if (!categorySettings) {
                    return true; // No settings for this category, so no further filtering
                }

                const clientStatus = company[`${selectedCat.toLowerCase()} _client_status`];
                const selectedClientStatuses = Object.entries(categorySettings.clientStatus || {})
                    .filter(([_, isSelected]) => isSelected)
                    .map(([status]) => status.toLowerCase());

                if (selectedClientStatuses.includes('all') || selectedClientStatuses.length === 0) {
                    return true; // If 'All' status is selected or no specific status, include all
                }

                return selectedClientStatuses.includes(clientStatus);
            });
        });
    }, []);

    // Apply detailed filters to a specific company's raw extraction data
    const applyDetailedFilters = useCallback((
        extractionDataByMonth, // e.g., selectedCompanyDetails.extraction_data
        searchTerm,
        dateRange,
        advFilters
    ) => {
        if (!extractionDataByMonth) return {};

        let filteredMonths = { ...extractionDataByMonth };

        // 1. Filter by date range (if applicable)
        if (dateRange.from && dateRange.to) {
            filteredMonths = Object.fromEntries(
                Object.entries(filteredMonths).filter(([key]) => {
                    const [year, month] = key.split('-');
                    const keyDate = new Date(parseInt(year), parseInt(month) - 1);
                    return keyDate >= dateRange.from && keyDate <= dateRange.to;
                })
            );
        }

        // 2. Apply advanced filters and general search term to `tableData` within each month
        Object.keys(filteredMonths).forEach(monthKey => {
            if (filteredMonths[monthKey].tableData) {
                filteredMonths[monthKey].tableData = filteredMonths[monthKey].tableData.filter(row => {
                    // Advanced Filters
                    if (advFilters) {
                        // Withholder PIN
                        if (advFilters.withholderPIN && row[1] !== advFilters.withholderPIN) {
                            return false;
                        }

                        // Withholdee Types (Suppliers/Customers) - Placeholder logic
                        const isSupplier = row[1]?.toString().startsWith('S'); // Example: PIN starts with 'S'
                        const isCustomer = row[2]?.toString().startsWith('C'); // Example: PIN starts with 'C'
                        const includeSuppliers = advFilters.withholdeeTypes.suppliers;
                        const includeCustomers = advFilters.withholdeeTypes.customers;

                        if (!includeSuppliers && isSupplier) return false;
                        if (!includeCustomers && isCustomer) return false;
                        // If both are false and it's either, then it's filtered out.
                        // If only one is true, and it matches that type, keep it.
                        // If it's neither type, but both types are selected, keep it? No, if it's not a supplier and not a customer, and you've filtered by suppliers/customers, it should probably be excluded.
                        // A more robust check for `withholdeeTypes`:
                        if (!includeSuppliers && !includeCustomers) return false; // If neither is selected, exclude all
                        if (includeSuppliers && !isSupplier && !includeCustomers) return false; // Only suppliers selected, but this isn't one
                        if (includeCustomers && !isCustomer && !includeSuppliers) return false; // Only customers selected, but this isn't one

                        // Status
                        if (advFilters.status !== 'all' && row[5] !== advFilters.status) {
                            return false;
                        }

                        // Amount Range
                        const amount = parseFloat(row[8] || 0);
                        if (amount < advFilters.amountRange[0] || amount > advFilters.amountRange[1]) {
                            return false;
                        }
                    }

                    // General Search Term (applies to all cells)
                    if (searchTerm) {
                        const lowerSearchTerm = searchTerm.toLowerCase();
                        const rowValues = row.map(cell =>
                            cell !== null && cell !== undefined
                                ? cell.toString().toLowerCase()
                                : ''
                        );
                        if (!rowValues.some(value => value.includes(lowerSearchTerm))) {
                            return false;
                        }
                    }

                    return true;
                });
            }
        });

        // Remove months that become empty after filtering
        return Object.fromEntries(
            Object.entries(filteredMonths).filter(([, data]) => data.tableData?.length > 0)
        );
    }, []);

    // ======== Derived States with useMemo ========

    // Companies for the left sidebar (filtered by categories and sidebar search)
    const sidebarCompanies = useMemo(() => {
        const filteredByCategories = applyCategoryFilters(allRawCompaniesData, categoryFilters);
        return filteredByCategories
            .filter(company =>
                !sidebarSearchTerm ||
                company.company_name.toLowerCase().includes(sidebarSearchTerm.toLowerCase())
            )
            .sort((a, b) => a.company_name.localeCompare(b.company_name));
    }, [allRawCompaniesData, categoryFilters, sidebarSearchTerm, applyCategoryFilters]);

    // Data for the Summary tab table
    const summaryTableData = useMemo(() => {
        let data = applyCategoryFilters(allRawCompaniesData, categoryFilters);

        if (summarySearch) {
            const lowerSearchTerm = summarySearch.toLowerCase();
            data = data.filter((company) => {
                const searchFields = [
                    company.company_name,
                    company.categories.join(' '),
                    company.latestExtractionDate,
                    company.numberOfExtractions.toString(),
                    formatAmount(company.totalAmountRaw),
                ];
                return searchFields.some(field =>
                    field && field.toString().toLowerCase().includes(lowerSearchTerm)
                );
            });
        }
        return data.sort((a, b) => a.company_name.toLowerCase().localeCompare(b.company_name.toLowerCase()));
    }, [allRawCompaniesData, categoryFilters, summarySearch, applyCategoryFilters]);


    // Currently selected company's full details
    const selectedCompanyDetails = useMemo(() => {
        return allRawCompaniesData.find(company => company.id === selectedCompanyId) || null;
    }, [allRawCompaniesData, selectedCompanyId]);

    // Raw extraction data for the selected company (before any detailed filtering)
    const companyRawExtractions = useMemo(() => {
        return selectedCompanyDetails?.extraction_data || {};
    }, [selectedCompanyDetails]);

    // Filtered extraction data for the detailed view tabs
    const filteredDetailedExtractions = useMemo(() => {
        return applyDetailedFilters(companyRawExtractions, detailedSearchTerm, detailedDateRange, advancedFilters);
    }, [companyRawExtractions, detailedSearchTerm, detailedDateRange, advancedFilters, applyDetailedFilters]);

    // Flattened data for "All Data" tab in detailed view
    const allDetailedTableData = useMemo(() => {
        return Object.entries(filteredDetailedExtractions).flatMap(([monthKey, data]) => {
            if (!data.tableData || data.tableData.length === 0) {
                return [];
            }
            const [year, monthNum] = monthKey.split('-');
            const monthName = `${getMonthName(monthNum)} ${year} `;
            return data.tableData.map(row => ({
                id: `${monthKey} -${row[0]} -${row[6]} `, // Unique ID for each row for React Table
                monthName,
                monthKey,
                ...row // Spread original row data
            }));
        }).sort((a, b) => new Date(b.monthKey) - new Date(a.monthKey)); // Sort by month descending
    }, [filteredDetailedExtractions]);

    // Data for the "Month Wise" tab, specifically for the selected month
    const selectedMonthDataForTable = useMemo(() => {
        return selectedMonthKey && filteredDetailedExtractions[selectedMonthKey]
            ? filteredDetailedExtractions[selectedMonthKey].tableData
            : [];
    }, [selectedMonthKey, filteredDetailedExtractions]);

    // Years available for the "Totals" view
    const yearsForTotalsView = useMemo(() => {
        const years = new Set();
        Object.keys(filteredDetailedExtractions).forEach(month => {
            const [year] = month.split('-');
            years.add(year);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [filteredDetailedExtractions]);

    // ======== Handlers ========

    const handleSelectCompany = useCallback((id) => {
        setSelectedCompanyId(id);
        // Reset detailed view states when a new company is selected
        setActiveTab('allData');
        setDetailedSearchTerm('');
        setDetailedDateRange({ from: null, to: null });
        setSelectedMonthKey(null);
        setAdvancedFilters({
            withholderPIN: '',
            withholdeeTypes: { suppliers: true, customers: true },
            status: 'all',
            amountRange: [0, 100000]
        }); // Amount range will be dynamically adjusted by AdvancedFilterPanel
        setShowFiltersPanel(false);
    }, []);

    const handleCategoryFilterChange = useCallback((newFilters) => {
        setCategoryFilters(newFilters);
    }, []);

    const handleAdvancedFilterChange = useCallback((filters) => {
        setAdvancedFilters(filters);
    }, []);

    const handleAdvancedFilterReset = useCallback((resetFilters) => {
        setAdvancedFilters(resetFilters);
    }, []);

    const handleDetailedDateRangeChange = useCallback((range) => {
        setDetailedDateRange(range);
    }, []);

    const handleMonthSelect = useCallback((monthKey) => {
        setSelectedMonthKey(monthKey);
        setActiveTab('monthWise');
    }, []);

    const clearDetailedViewFilters = useCallback(() => {
        setDetailedSearchTerm('');
        setDetailedDateRange({ from: null, to: null });
        setAdvancedFilters({
            withholderPIN: '',
            withholdeeTypes: { suppliers: true, customers: true },
            status: 'all',
            amountRange: [0, 100000]
        });
        setSelectedMonthKey(null); // Clear month selection if not in month view
        if (activeTab === 'monthWise') {
            // If currently in month-wise view, keep the latest month selected if available,
            // or switch to 'allData' if no months exist after filter reset.
            const sortedMonths = Object.keys(companyRawExtractions).sort((a, b) => new Date(b) - new Date(a));
            if (sortedMonths.length > 0) {
                setSelectedMonthKey(sortedMonths[0]);
            } else {
                setActiveTab('allData');
            }
        }
    }, [activeTab, companyRawExtractions]);

    // Set initial selected month for detailed view when company or data changes
    useEffect(() => {
        if (activeTab === 'monthWise' && !selectedMonthKey && Object.keys(companyRawExtractions).length > 0) {
            const sortedMonths = Object.keys(companyRawExtractions).sort((a, b) => new Date(b) - new Date(a));
            if (sortedMonths.length > 0) {
                setSelectedMonthKey(sortedMonths[0]);
            }
        }
        // If the current selected month is filtered out, reset it
        if (selectedMonthKey && !filteredDetailedExtractions[selectedMonthKey] && Object.keys(filteredDetailedExtractions).length > 0) {
            const sortedMonths = Object.keys(filteredDetailedExtractions).sort((a, b) => new Date(b) - new Date(a));
            if (sortedMonths.length > 0) {
                setSelectedMonthKey(sortedMonths[0]);
            } else {
                setSelectedMonthKey(null); // No months left after filter
            }
        } else if (selectedMonthKey && !filteredDetailedExtractions[selectedMonthKey] && Object.keys(filteredDetailedExtractions).length === 0) {
            setSelectedMonthKey(null);
        }
    }, [selectedCompanyId, companyRawExtractions, selectedMonthKey, activeTab, filteredDetailedExtractions]);


    // Export logic
    const exportSummaryToExcel = useCallback(async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Company Summary');

        worksheet.addRow(['IDX', 'ID', 'Company Name', 'Categories', 'Suppliers', 'Customers', 'Latest Extraction Date', 'Number of Extractions', 'Total Amount (KSH)']);

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };

        summaryTableData.forEach((company, idx) => {
            worksheet.addRow([
                idx + 1,
                company.id,
                company.company_name,
                company.categories.join(', '),
                company.suppliers.length,
                company.customers.length,
                company.latestExtractionDate,
                company.numberOfExtractions,
                company.totalAmountRaw, // Use raw amount for export to allow excel formatting
            ]);
        });

        worksheet.columns.forEach(column => {
            column.width = 20;
        });
        worksheet.getColumn(9).numFmt = '#,##0.00'; // Format amount column in Excel

        const buffer = await workbook.xlsx.writeBuffer();
        const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
        saveAs(new Blob([buffer]), `WHVAT_Summary_${timestamp}.xlsx`);
        toast.success("Summary exported successfully!");
    }, [summaryTableData]);

    const handleExportDetailedData = useCallback(async (options) => {
        const workbook = new ExcelJS.Workbook();
        const companyName = selectedCompanyDetails?.company_name || 'Selected_Company';

        let dataToExport;
        if (options.range === 'all') {
            dataToExport = companyRawExtractions;
        } else if (options.range === 'current') {
            dataToExport = filteredDetailedExtractions;
        } else if (options.range === 'custom' && options.dateRange.from && options.dateRange.to) {
            dataToExport = applyDetailedFilters(
                companyRawExtractions,
                '', // No search term
                options.dateRange,
                null // No advanced filters
            );
        } else {
            // Fallback for current view data if range is not recognized or custom range is invalid
            dataToExport = filteredDetailedExtractions;
        }

        const worksheet = workbook.addWorksheet('Extraction Data');
        const headers = [
            'Month/Year', 'Sr.No.', 'Withholder PIN', 'Withholdee PIN', 'Withholder Name',
            'Pay Point Name', 'Status', 'Invoice No', 'Certificate Date',
            'VAT Withholding Amount', 'WHT Certificate No'
        ];
        worksheet.addRow(headers);
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };

        // Process data for export, applying internal export dialog filters
        const processDataForExport = (tableData, exportOptions) => {
            return tableData.filter(row => {
                // This is a placeholder for actual supplier/customer type identification
                // You'd need a more robust system (e.g., a lookup table or a flag in your data)
                const isSupplier = row[1]?.toString().startsWith('S'); // Example: PIN starts with 'S'
                const isCustomer = row[2]?.toString().startsWith('C'); // Example: PIN starts with 'C'

                if (exportOptions.type === 'suppliers' && !isSupplier) return false;
                if (exportOptions.type === 'customers' && !isCustomer) return false;
                if (exportOptions.type === 'custom') {
                    if (!exportOptions.includeSuppliers && isSupplier) return false;
                    if (!exportOptions.includeCustomers && isCustomer) return false;
                    // If neither included, only include if it's neither supplier nor customer type
                    if (!exportOptions.includeSuppliers && !exportOptions.includeCustomers && (isSupplier || isCustomer)) return false;
                }
                return true;
            });
        };

        Object.entries(dataToExport).sort(([a], [b]) => new Date(a) - new Date(b)).forEach(([monthKey, data]) => {
            const [year, monthNum] = monthKey.split('-');
            const monthLabel = `${getMonthName(monthNum)} ${year} `;

            if (data.tableData && data.tableData.length > 0) {
                const filteredTableData = processDataForExport(data.tableData, options);

                if (filteredTableData.length > 0) {
                    filteredTableData.forEach(row => {
                        // Assuming the 'row' itself contains all cell values
                        worksheet.addRow([monthLabel, ...row]);
                    });

                    const monthTotal = filteredTableData.reduce((sum, row) => sum + parseFloat(row[8] || 0), 0);
                    const totalRow = worksheet.addRow([
                        monthLabel, 'Total', '', '', '', '', '', '', '', monthTotal, '' // Raw amount for Excel formatting
                    ]);
                    totalRow.font = { bold: true };
                    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5F7E8' } };
                    worksheet.addRow([]); // Blank row separator
                }
            }
        });

        worksheet.columns.forEach(column => {
            column.width = 15;
        });
        worksheet.getColumn(10).numFmt = '#,##0.00'; // Format VAT Amount column

        // Add a summary sheet
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.addRow(['Month/Year', 'Number of Transactions', 'Total Amount (KSH)']);
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };

        let grandTotal = 0;
        let grandTotalTransactions = 0;

        Object.entries(dataToExport).sort(([a], [b]) => new Date(a) - new Date(b)).forEach(([monthKey, data]) => {
            const [year, monthNum] = monthKey.split('-');
            const monthLabel = `${getMonthName(monthNum)} ${year} `;

            if (data.tableData && data.tableData.length > 0) {
                const filteredTableData = processDataForExport(data.tableData, options);
                const monthTotal = filteredTableData.reduce((sum, row) => sum + parseFloat(row[8] || 0), 0);
                const monthTransactions = filteredTableData.length;

                grandTotal += monthTotal;
                grandTotalTransactions += monthTransactions;

                summarySheet.addRow([
                    monthLabel,
                    monthTransactions,
                    monthTotal
                ]);
            } else {
                summarySheet.addRow([monthLabel, 0, 0]);
            }
        });

        const grandTotalRow = summarySheet.addRow([
            'GRAND TOTAL', grandTotalTransactions, grandTotal
        ]);
        grandTotalRow.font = { bold: true };
        grandTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD9D9' } };

        summarySheet.columns.forEach(column => {
            column.width = 20;
        });
        summarySheet.getColumn(3).numFmt = '#,##0.00';

        const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
        const fileName = `${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_WHVAT_Extractions_${timestamp}.${options.format} `;

        if (options.format === 'xlsx') {
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), fileName);
        } else {
            // For CSV, we need to convert the worksheet to CSV string. ExcelJS can do this.
            const csvContent = await workbook.csv.writeBuffer();
            saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }), fileName.replace('.xlsx', '.csv'));
        }
        toast.success(`Exported "${fileName}" successfully!`);
    }, [selectedCompanyDetails, companyRawExtractions, filteredDetailedExtractions, applyDetailedFilters]);


    // ======== Column Definitions ========

    const summaryColumns = useMemo(() => [
        {
            accessorKey: "index",
            header: "IDX | ID",
            cell: ({ row }) => <div className="font-medium">{row.index + 1} | {row.original.id}</div>,
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
                        handleSelectCompany(row.original.id);
                        setView('detailed');
                    }}
                >
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
                        <Badge key={category} variant="outline" className={cn(
                            category === 'Acc' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                category === 'Imm' ? 'bg-green-50 text-green-800 border-green-200' :
                                    category === 'Sheria' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                                        category === 'Audit' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                            ''
                        )}>
                            {category}
                        </Badge>
                    ))}
                </div>
            ),
        },
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
                    {formatAmount(row.original.totalAmountRaw)}
                </div>
            ),
        },
    ], [handleSelectCompany]);

    // Create month data table columns
    const detailedTableColumns = useMemo(() => [
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
            enableSorting: true, // Allow sorting by month
        },
        {
            accessorKey: "0", // Maps to Sr.No. in original data structure
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
            accessorKey: "1", // Withholder PIN
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
            accessorKey: "2", // Withholdee PIN
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
            accessorKey: "3", // Withholder Name
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
            accessorKey: "4", // Pay Point Name
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
            accessorKey: "5", // Status
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
            accessorKey: "6", // Invoice No
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
            accessorKey: "7", // Certificate Date
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
            accessorKey: "8", // VAT Withholding Amount
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
            accessorKey: "9", // WHT Certificate No
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
    ], []);

    // Columns for month-wise view (without the 'monthName' column)
    const monthWiseTableColumns = useMemo(() => detailedTableColumns.slice(1), [detailedTableColumns]);

    // ======== Render Views ========

    const renderSummaryView = () => {
        // Calculate summary statistics
        const totalCompanies = summaryTableData.length;
        const totalExtractions = summaryTableData.reduce((sum, company) => sum + company.numberOfExtractions, 0);
        const totalAmount = summaryTableData.reduce((sum, company) => sum + company.totalAmountRaw, 0);
        const companiesWithExtractions = summaryTableData.filter(c => c.numberOfExtractions > 0).length;
        const totalSuppliers = summaryTableData.reduce((sum, company) => sum + (company.suppliers?.length || 0), 0);
        const totalCustomers = summaryTableData.reduce((sum, company) => sum + (company.customers?.length || 0), 0);

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
                                {summaryTableData.length}
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
                                setCategoryFilters({
                                    categories: {
                                        'All Categories': false, // Uncheck all
                                        'Acc': true, // Reset to default 'Acc' selected
                                        'Imm': false,
                                        'Sheria': false,
                                        'Audit': false
                                    },
                                    categorySettings: { // Reset settings too
                                        'Acc': { clientStatus: { All: false, Active: true, Inactive: false, Missing: false }, sectionStatus: { All: false, Active: true, Inactive: false, Missing: false } },
                                        'Imm': { clientStatus: { All: false, Active: true, Inactive: false, Missing: false }, sectionStatus: { All: false, Active: true, Inactive: false, Missing: false } },
                                        'Sheria': { clientStatus: { All: false, Active: true, Inactive: false, Missing: false }, sectionStatus: { All: false, Active: true, Inactive: false, Missing: false } },
                                        'Audit': { clientStatus: { All: false, Active: true, Inactive: false, Missing: false }, sectionStatus: { All: false, Active: true, Inactive: false, Missing: false } },
                                    }
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
                    onFilterChange={handleCategoryFilterChange}
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
                                data={summaryTableData}
                                isLoading={loading}
                                pagination={true} // Enable pagination for summary table
                                showColumnToggle={false} // Maybe not needed for summary
                                tableMaxHeight="max-h-[700px]" // Let it scroll if too many
                            />
                        </CardContent>
                    </Card>
                )}
            </>
        );
    };

    const renderDetailedView = () => (
        <div className="grid grid-cols-5 gap-4 h-[680px]">
            {/* Left sidebar - Company Selection */}
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
                            {sidebarCompanies.length}
                        </Badge>
                    </Button>
                </div>

                <ClientCategoryFilter
                    open={isCategoryFilterOpen}
                    onOpenChange={setIsCategoryFilterOpen}
                    onFilterChange={handleCategoryFilterChange}
                    showSectionName=""
                    initialFilters={categoryFilters}
                    showSectionStatus={true} // Keep section status filtering for sidebar if needed
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
                            {sidebarCompanies.length > 0 ? (
                                sidebarCompanies.map((company) => {
                                    const isSelected = selectedCompanyId === company.id;
                                    const hasExtractions = Object.keys(company.extraction_data || {}).length > 0;

                                    return (
                                        <button
                                            key={company.id}
                                            onClick={() => handleSelectCompany(company.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-md transition-all",
                                                isSelected
                                                    ? "bg-blue-600 text-white font-medium shadow-md"
                                                    : "text-slate-700 hover:bg-slate-100",
                                                !hasExtractions && "opacity-70"
                                            )}
                                        >
                                            <div className="truncate flex-1 text-left">{company.company_name}</div>
                                            {company.categories?.length > 0 && (
                                                <div className="flex gap-0.5 ml-2">
                                                    {company.categories.slice(0, 2).map((category) => (
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
                                                    {company.categories.length > 2 && (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-[10px] px-1 py-0",
                                                                isSelected ? "bg-blue-500 border-blue-400 text-white" : "bg-slate-50 border-slate-200"
                                                            )}
                                                        >
                                                            +{company.categories.length - 2}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="p-4 text-center text-slate-500">
                                    No companies found with current filters.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Main content area */}
            <div className="col-span-4">
                {selectedCompanyDetails ? (
                    loading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-60 w-full" />
                            <Skeleton className="h-40 w-full" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">{selectedCompanyDetails.company_name}</h2>
                                    <div className="text-sm text-slate-500 mt-1">
                                        {Object.keys(companyRawExtractions).length} extraction periods | {" "}
                                        <span className="text-green-600 font-semibold">
                                            Total: {formatAmount(selectedCompanyDetails.totalAmountRaw)}
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
                                        {(advancedFilters.withholderPIN || advancedFilters.status !== 'all' || !advancedFilters.withholdeeTypes.suppliers || !advancedFilters.withholdeeTypes.customers || advancedFilters.amountRange[0] !== 0 || advancedFilters.amountRange[1] !== 100000) && ( // Basic check for active filters
                                            <Badge variant={showFiltersPanel ? "outline" : "secondary"} className={showFiltersPanel ? "bg-blue-500 text-white" : ""}>
                                                Active
                                            </Badge>
                                        )}
                                    </Button>

                                    <ExportOptionsDialog
                                        data={companyRawExtractions} // Pass raw data to dialog, let it filter internally
                                        companyName={selectedCompanyDetails.company_name}
                                        onExport={handleExportDetailedData}
                                    />
                                </div>
                            </div>

                            <div className={cn(
                                "grid gap-4",
                                showFiltersPanel ? "grid-cols-4" : "grid-cols-1"
                            )}>
                                {/* Advanced filters panel */}
                                {showFiltersPanel && (
                                    <div className="col-span-1 row-span-2">
                                        <AdvancedFilterPanel
                                            rawAllDetailedData={allDetailedTableData} // Pass raw data for options
                                            currentFilters={advancedFilters}
                                            onFilterChange={handleAdvancedFilterChange}
                                            onReset={handleAdvancedFilterReset}
                                        />
                                    </div>
                                )}

                                <div className={cn(
                                    "space-y-4",
                                    showFiltersPanel ? "col-span-3" : "col-span-1"
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
                                                    onClick={clearDetailedViewFilters}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-9 gap-1.5 text-slate-700 hover:text-slate-900"
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">Reset All</span>
                                                </Button>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="p-0">
                                            <TabsContent value="allData" className="m-0">
                                                <div className="p-4 bg-white border-b">
                                                    <div className="flex flex-wrap gap-4 items-center">
                                                        <DateRangePicker
                                                            value={detailedDateRange}
                                                            onChange={handleDetailedDateRangeChange}
                                                        />

                                                        <div className="flex items-center gap-2 ml-auto">
                                                            <div className="relative flex-1 min-w-[200px]">
                                                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                                                <Input
                                                                    placeholder="Search within data..."
                                                                    value={detailedSearchTerm}
                                                                    onChange={(e) => setDetailedSearchTerm(e.target.value)}
                                                                    className="w-full pl-9 bg-white border-slate-200"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {allDetailedTableData && allDetailedTableData.length > 0 ? (
                                                    <EnhancedDataTable
                                                        columns={detailedTableColumns}
                                                        data={allDetailedTableData}
                                                        isLoading={loading}
                                                        initialPageSize={20}
                                                        pagination={true}
                                                        tableMaxHeight="max-h-[420px]"
                                                        emptyMessage="No records found in this filtered view."
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center h-[400px] border-t">
                                                        <div className="text-center max-w-md p-6">
                                                            <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                                                <Search className="h-8 w-8 text-slate-400" />
                                                            </div>
                                                            <h3 className="text-lg font-semibold text-slate-800">No Data Available</h3>
                                                            <p className="text-slate-500 mt-2">
                                                                No extraction data found with the current filters applied.
                                                            </p>
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
                                                            months={filteredDetailedExtractions} // Pass already filtered months
                                                            selectedMonthKey={selectedMonthKey}
                                                            onSelectMonth={handleMonthSelect}
                                                        />
                                                    </div>

                                                    <div className="col-span-3 border-l overflow-hidden">
                                                        {selectedMonthKey && filteredDetailedExtractions[selectedMonthKey] ? (
                                                            <div className="h-full flex flex-col">
                                                                <div className="bg-slate-50 p-3 border-b flex justify-between items-center">
                                                                    <div>
                                                                        <h3 className="text-base font-semibold text-slate-800">
                                                                            {(() => {
                                                                                const [year, monthNum] = selectedMonthKey.split('-');
                                                                                return `${getMonthName(monthNum)} ${year} `;
                                                                            })()}
                                                                        </h3>
                                                                        <p className="text-sm text-slate-500">
                                                                            {selectedMonthDataForTable?.length || 0} records
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-lg font-bold text-green-600">
                                                                        {formatAmount(selectedMonthDataForTable?.reduce((sum, row) => sum + parseFloat(row[8] || 0), 0))}
                                                                    </div>
                                                                </div>

                                                                <div className="flex-1 overflow-auto p-4">
                                                                    {selectedMonthDataForTable && selectedMonthDataForTable.length > 0 ? (
                                                                        <EnhancedDataTable
                                                                            columns={monthWiseTableColumns}
                                                                            data={selectedMonthDataForTable}
                                                                            isLoading={loading}
                                                                            pagination={true}
                                                                            tableMaxHeight="max-h-[400px]"
                                                                            emptyMessage="No records found for this month with current filters."
                                                                            // Removed internal search, as parent handles it now
                                                                            // additionalFilters now is solely for adding components like the search input
                                                                            additionalFilters={[
                                                                                <div key="search-input-month" className="relative flex-1 max-w-sm">
                                                                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                                                                    <Input
                                                                                        placeholder={`Search in ${getMonthName(selectedMonthKey.split('-')[1])} data...`}
                                                                                        value={detailedSearchTerm}
                                                                                        onChange={(e) => setDetailedSearchTerm(e.target.value)}
                                                                                        className="w-full pl-9 bg-white border-slate-200"
                                                                                    />
                                                                                </div>
                                                                            ]}
                                                                        />
                                                                    ) : (
                                                                        <div className="flex items-center justify-center h-full">
                                                                            <div className="text-center">
                                                                                <h3 className="text-lg font-semibold text-slate-800">No Records Found</h3>
                                                                                <p className="text-slate-500 mt-2">
                                                                                    This month has no extraction data matching the current filters.
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full">
                                                                <div className="text-center">
                                                                    <h3 className="text-lg font-semibold text-slate-800">No Month Selected or Data Empty</h3>
                                                                    <p className="text-slate-500 mt-2">
                                                                        Select a month from the sidebar to view details, or adjust filters.
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
                                                        {yearsForTotalsView.length > 0 ? (
                                                            yearsForTotalsView.map(year => (
                                                                <YearSummaryTable
                                                                    key={year}
                                                                    year={year}
                                                                    data={filteredDetailedExtractions}
                                                                />
                                                            ))
                                                        ) : (
                                                            <div className="flex items-center justify-center h-[400px]">
                                                                <div className="text-center">
                                                                    <h3 className="text-lg font-semibold text-slate-800">No Data Available</h3>
                                                                    <p className="text-slate-500 mt-2">
                                                                        No extraction data available for totals view with current filters.
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
                    )
                ) : (
                    <div className="flex items-center justify-center h-full bg-white p-8 rounded-lg border border-slate-200">
                        <div className="text-center max-w-md">
                            <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                                <Briefcase className="h-8 w-8 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">Select a Company</h3>
                            <p className="text-slate-500 mt-2">
                                Choose a company from the sidebar to view WHVAT extraction data.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderResponsiveView = () => (
        <div className="hidden md:block">
            {view === 'summary' ? renderSummaryView() : renderDetailedView()}
        </div>
    );

    // Mobile view fallback message
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
