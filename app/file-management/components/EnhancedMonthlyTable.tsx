// @ts-nocheck
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search,
    Download,
    Settings2,
    CalendarIcon,
    Send,
    Filter,
    MoreHorizontal,
    Archive,
    Mail,
    FileDown,
    ArrowUpDown,
    Eye,
    EyeOff
} from "lucide-react";
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui';
import { format } from "date-fns";
import { toast } from 'react-hot-toast';
import { cn } from "@/lib/utils";

import EnhancedReceptionDialog from './EnhancedReceptionDialog';
import EnhancedDeliveryDialog from './EnhancedDeliveryDialog';
import BulkOperationsDialog from './BulkOperationsDialog';
import { Company, FileRecord } from '../types/fileManagement';

const columnHelper = createColumnHelper<Company>();

type SortingState = Array<{ id: string; desc: boolean }>;

interface EnhancedMonthlyTableProps {
    companies: Company[];
    fileRecords: FileRecord[];
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onUpdateRecord: (companyId: string, year: number, month: number, updates: any) => Promise<any>;
    onBulkOperation: (operation: any) => Promise<void>;
}

export default function EnhancedMonthlyTable({
    companies,
    fileRecords,
    selectedDate,
    onDateChange,
    onUpdateRecord,
    onBulkOperation
}: EnhancedMonthlyTableProps) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [showTotals, setShowTotals] = useState(true);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
    const [showStatsRows, setShowStatsRows] = useState(true);
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
                    'All': false, 
                    'Active': true, 
                    'Inactive': false 
                }
            }
        }
    });

    const handleFilterChange = (newFilters) => {
        setCategoryFilters(newFilters);
    };

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;

    // Get file record for a company in the selected month
    const getCompanyRecord = (companyId: string) => {
        return fileRecords.find(record =>
            record.company_id === companyId &&
            record.year === year &&
            record.month === month
        );
    };

    const formatDateTime = (dateTimeString?: string) => {
        if (!dateTimeString) return { date: '-', time: '-' };
        const date = new Date(dateTimeString);
        return {
            date: format(date, 'dd.MM.yyyy'),
            time: format(date, 'HH:mm')
        };
    };

    const handleSendReminder = async (companyName: string) => {
        try {
            // Implement your reminder logic here
            console.log(`Sending reminder to ${companyName}`);
            toast.success(`Reminder sent to ${companyName}`, {
                icon: '📧',
                style: {
                    borderRadius: '10px',
                    background: '#1e40af',
                    color: '#fff',
                },
            });
        } catch (error) {
            console.error('Error sending reminder:', error);
            toast.error('Failed to send reminder');
        }
    };

    const handleRowSelection = (companyId: string, selected: boolean) => {
        setSelectedRows(prev =>
            selected
                ? [...prev, companyId]
                : prev.filter(id => id !== companyId)
        );
    };

    const handleSelectAll = (selected: boolean) => {
        setSelectedRows(selected ? companies.map(c => c.id) : []);
    };

    // Define table columns
    const columns = useMemo(() => [
        // Selection column
        columnHelper.display({
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    checked={selectedRows.length === companies.length}
                    onCheckedChange={handleSelectAll}
                    className="border-blue-300"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={selectedRows.includes(row.original.id)}
                    onCheckedChange={(checked) => handleRowSelection(row.original.id, checked)}
                    className="border-blue-300"
                />
            ),
            size: 50,
        }),

        // Index column
        columnHelper.accessor((row) => {
            const index = companies.findIndex(c => c.id === row.id) + 1;
            return index;
        }, {
            id: 'index',
            header: '#',
            size: 60,
            enableSorting: false,
        }),

        // Company details
        columnHelper.accessor('company_name', {
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className="p-0 hover:bg-transparent"
                >
                    Company Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: info => (
                <div>
                    <p className="font-medium text-gray-800">{info.getValue()}</p>
                    <p className="text-xs text-gray-500">{info.row.original.kra_pin}</p>
                </div>
            ),
            size: 200,
            sortingFn: 'alphanumeric',
        }),

        // columnHelper.accessor('category', {
        //     header: 'Category',
        //     cell: info => (
        //         <Badge
        //             variant="outline"
        //             className={cn(
        //                 "text-xs",
        //                 info.getValue() === 'corporate' && "border-blue-200 text-blue-700 bg-blue-50",
        //                 info.getValue() === 'sme' && "border-green-200 text-green-700 bg-green-50",
        //                 info.getValue() === 'individual' && "border-purple-200 text-purple-700 bg-purple-50",
        //                 info.getValue() === 'ngo' && "border-orange-200 text-orange-700 bg-orange-50"
        //             )}
        //         >
        //             {info.getValue()}
        //         </Badge>
        //     ),
        //     size: 100,
        // }),

        columnHelper.accessor('priority', {
            id: 'priority',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className="p-0 hover:bg-transparent"
                >
                    Priority
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: info => (
                <Badge
                    variant="outline"
                    className={cn(
                        "text-xs",
                        info.getValue() === 'high' && "border-red-200 text-red-700 bg-red-50",
                        info.getValue() === 'medium' && "border-yellow-200 text-yellow-700 bg-yellow-50",
                        info.getValue() === 'low' && "border-green-200 text-green-700 bg-green-50"
                    )}
                >
                    {info.getValue()}
                </Badge>
            ),
            size: 80,
            sortingFn: (a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[a.original.priority] - priorityOrder[b.original.priority];
            },
        }),

        // Reception status
        columnHelper.display({
            id: 'reception',
            header: ({ column }) => (
                <div className="text-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                        className="p-0 hover:bg-transparent"
                    >
                        Reception
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                const record = getCompanyRecord(row.original.id);
                return (
                    <div className="flex items-center justify-center">
                        <EnhancedReceptionDialog
                            companyName={row.original.company_name}
                            companyId={row.original.id}
                            year={year}
                            month={month}
                            onConfirm={(data) => onUpdateRecord(row.original.id, year, month, data)}
                            existingData={record}
                        />
                        {record?.is_nil && (
                            <Badge variant="destructive" className="ml-2 text-xs">NIL</Badge>
                        )}
                        {record?.is_urgent && (
                            <Badge variant="destructive" className="ml-2 text-xs animate-pulse">URGENT</Badge>
                        )}
                    </div>
                );
            },
            size: 120,
        }),

        // Reception details
        columnHelper.display({
            id: 'receptionDetails',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className="p-0 hover:bg-transparent"
                >
                    Reception Details
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const record = getCompanyRecord(row.original.id);
                const dateTime = formatDateTime(record?.received_at);

                return (
                    <div className="text-xs">
                        <p className="font-medium">{dateTime.date}</p>
                        <p className="text-gray-500">{dateTime.time}</p>
                        {record?.brought_by && (
                            <p className="text-blue-600 mt-1">By: {record.brought_by}</p>
                        )}
                    </div>
                );
            },
            size: 140,
        }),

        // Delivery status
        columnHelper.display({
            id: 'delivery',
            header: ({ column }) => (
                <div className="text-center">
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                        className="p-0 hover:bg-transparent"
                    >
                        Delivery
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                const record = getCompanyRecord(row.original.id);
                return (
                    <div className="flex items-center justify-center">
                        <EnhancedDeliveryDialog
                            companyName={row.original.company_name}
                            companyId={row.original.id}
                            year={year}
                            month={month}
                            onConfirm={(data) => onUpdateRecord(row.original.id, year, month, data)}
                            existingData={record}
                            receptionData={record}
                        />
                    </div>
                );
            },
            size: 100,
        }),

        // Delivery details
        columnHelper.display({
            id: 'deliveryDetails',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className="p-0 hover:bg-transparent"
                >
                    Delivery Details
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const record = getCompanyRecord(row.original.id);
                const dateTime = formatDateTime(record?.delivered_at);

                return (
                    <div className="text-xs">
                        <p className="font-medium">{dateTime.date}</p>
                        <p className="text-gray-500">{dateTime.time}</p>
                        {record?.picked_by && (
                            <p className="text-green-600 mt-1">By: {record.picked_by}</p>
                        )}
                    </div>
                );
            },
            size: 140,
        }),

        // Status
        columnHelper.display({
            id: 'status',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className="p-0 hover:bg-transparent"
                >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const record = getCompanyRecord(row.original.id);
                const status = record?.status || 'pending';

                const statusConfig = {
                    pending: { label: 'Pending', color: 'bg-gray-100 text-gray-800' },
                    received: { label: 'Received', color: 'bg-blue-100 text-blue-800' },
                    processed: { label: 'Processed', color: 'bg-yellow-100 text-yellow-800' },
                    delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800' },
                    nil: { label: 'NIL', color: 'bg-red-100 text-red-800' }
                };

                const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

                return (
                    <Badge className={`text-xs ${config.color}`}>
                        {config.label}
                    </Badge>
                );
            },
            size: 100,
        }),

        // Actions
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendReminder(row.original.company_name)}
                        className="border-blue-200 hover:bg-blue-50"
                    >
                        <Send className="h-3 w-3 mr-1" />
                        <span className="text-xs">Remind</span>
                    </Button>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                            <div className="space-y-2">
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send Email
                                </Button>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <FileDown className="h-4 w-4 mr-2" />
                                    Export Record
                                </Button>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            ),
            size: 150,
        }),
    ], [year, month, companies, selectedRows, fileRecords]);

    // Helper function to check if a company is active in a category based on effective dates
    const isCategoryActive = (company: Company, category: string): boolean => {
        const categoryId = category.toLowerCase();
        const fromDateStr = company[`${categoryId}_client_effective_from`];
        const toDateStr = company[`${categoryId}_client_effective_to`];

        // If either date is missing, company is not active in this category
        if (!fromDateStr || !toDateStr) return false;

        try {
            // Parse dates from DD/MM/YYYY format (as per the data)
            const parseDate = (dateStr: string): Date => {
                // Handle different date formats (DD/MM/YYYY or YYYY-MM-DD)
                if (dateStr.includes('/')) {
                    const [day, month, year] = dateStr.split('/').map(Number);
                    return new Date(year, month - 1, day);
                } else if (dateStr.includes('-')) {
                    // Handle YYYY-MM-DD format
                    return new Date(dateStr);
                }
                return new Date(dateStr); // Fallback to native parsing
            };

            const fromDate = parseDate(fromDateStr);
            const toDate = parseDate(toDateStr);
            const today = new Date();
            
            // Reset time components for accurate date comparison
            today.setHours(0, 0, 0, 0);
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999); // End of the day

            // Company is active if today is between from and to dates (inclusive)
            return today >= fromDate && today <= toDate;
        } catch (error) {
            console.error(`Error parsing dates for ${company.company_name} (${category}):`, error, {
                fromDateStr,
                toDateStr,
                category
            });
            return false;
        }
    };

    // Filter companies based on search and category filters
    const filteredCompanies = useMemo(() => {
        if (!companies) return [];
        
        return companies.filter(company => {
            // Apply global search filter
            if (globalFilter) {
                const searchTerm = globalFilter.toLowerCase();
                const searchFields = [
                    company.company_name,
                    company.kra_pin,
                    company.itax_mobile_number,
                    company.itax_main_email_address
                ];

                const matchesSearch = searchFields.some(field => 
                    field?.toString().toLowerCase().includes(searchTerm)
                );

                if (!matchesSearch) return false;
            }

            // Apply category filters
            const selectedCategories = Object.entries(categoryFilters.categories || {})
                .filter(([category, isSelected]) => category && category !== 'All Categories' && isSelected)
                .map(([category]) => category);

            // If no categories are selected, show all companies
            if (selectedCategories.length === 0) {
                return true;
            }

            // If 'All Categories' is selected, show all companies
            if (categoryFilters.categories?.['All Categories']) {
                return true;
            }

            // Check if company matches any of the selected categories and statuses
            return selectedCategories.some(category => {
                const isActive = isCategoryActive(company, category);
                const currentStatus = isActive ? 'active' : 'inactive';
                


                // Get selected statuses from filter
                const categorySettings = categoryFilters.categorySettings?.[category];
                
                // If no specific status is selected, show all companies in this category
                if (!categorySettings?.clientStatus) {
                    return true;
                }

                const selectedClientStatuses = Object.entries(categorySettings.clientStatus)
                    .filter(([_, isSelected]) => isSelected)
                    .map(([status]) => status.toLowerCase());

                // If 'All' is selected or no status is selected, show all statuses
                if (selectedClientStatuses.includes('all') || selectedClientStatuses.length === 0) {
                    return true;
                }

                // Check if current status matches any of the selected statuses
                    return selectedClientStatuses.includes(currentStatus);
            });
        });
        
        return result;
    }, [companies, globalFilter, categoryFilters]);

    // Table data with indices
    const data = useMemo(() => filteredCompanies, [filteredCompanies]);

    // React Table setup
    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter,
            columnVisibility,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        // Set default sorting by company name
        initialState: {
            sorting: [{ id: 'company_name', desc: false }]
        }
    });

    // Calculate statistics
    const getStatusCounts = () => {
        const rows = table.getFilteredRowModel().rows;
        const total = rows.length;

        const receivedCount = rows.filter(row => {
            const record = getCompanyRecord(row.original.id);
            return record?.received_at || record?.is_nil;
        }).length;

        const deliveredCount = rows.filter(row => {
            const record = getCompanyRecord(row.original.id);
            return record?.delivered_at;
        }).length;

        const nilCount = rows.filter(row => {
            const record = getCompanyRecord(row.original.id);
            return record?.is_nil;
        }).length;

        const urgentCount = rows.filter(row => {
            const record = getCompanyRecord(row.original.id);
            return record?.is_urgent;
        }).length;

        return {
            total,
            receivedComplete: receivedCount,
            receivedPending: total - receivedCount,
            deliveredComplete: deliveredCount,
            deliveredPending: total - deliveredCount,
            nilCount,
            urgentCount
        };
    };

    const exportToExcel = async () => {
        try {
            // Implementation for Excel export
            toast.success('Export started - file will download shortly', {
                icon: '📄',
                style: {
                    borderRadius: '10px',
                    background: '#1e40af',
                    color: '#fff',
                },
            });
        } catch (error) {
            toast.error('Export failed');
        }
    };

    if (companies.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 text-center">
                <div className="space-y-4">
                    <div className="text-4xl">📁</div>
                    <h3 className="text-lg font-semibold text-gray-800">No Companies Found</h3>
                    <p className="text-gray-600">Try adjusting your filters or add some companies to get started.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-200px)] flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto p-2">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b">
                {/* Search */}
                <div className="flex items-center w-full sm:w-64 border-gray-200 focus:border-blue-400">
                    <Search className="h-4 w-4 mr-2 text-blue-500" />
                    <Input
                        placeholder="Search companies..."
                        value={globalFilter}
                        onChange={e => setGlobalFilter(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        <div className="text-xl font-bold text-blue-800">
                            {format(selectedDate, 'MMMM yyyy')}
                        </div>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="border-blue-200 hover:bg-blue-50">
                                    <CalendarIcon className="h-4 w-4 mr-2" />
                                    Change Month
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={(date) => date && onDateChange(date)}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    {/* Column Visibility */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="border-blue-200 hover:bg-blue-50">
                                <Settings2 className="h-4 w-4 mr-2" />
                                Columns
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56">
                            <div className="space-y-2 p-2">
                                {table.getAllColumns().map(column => {
                                    if (!column.getCanHide()) return null;
                                    return (
                                        <div key={column.id} className="flex items-center space-x-2">
                                            <Switch
                                                checked={column.getIsVisible()}
                                                onCheckedChange={(value) => column.toggleVisibility(value)}
                                                id={column.id}
                                                className="data-[state=checked]:bg-blue-600"
                                            />
                                            <Label htmlFor={column.id} className="text-sm">
                                                {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                                            </Label>
                                        </div>
                                    );
                                })}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Categories Filter */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCategoryFilterOpen(true)}
                        className="border-blue-200 hover:bg-blue-50"
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        Categories
                    </Button>

                    {/* Bulk Operations */}
                    {selectedRows.length > 0 && (
                        <BulkOperationsDialog
                            selectedCompanies={selectedRows}
                            year={year}
                            month={month}
                            onBulkOperation={onBulkOperation}
                            open={bulkDialogOpen}
                            onOpenChange={setBulkDialogOpen}
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-orange-200 text-orange-700 hover:bg-orange-50"
                            >
                                <Filter className="h-4 w-4 mr-2" />
                                Bulk Actions ({selectedRows.length})
                            </Button>
                        </BulkOperationsDialog>
                    )}

                    {/* Totals Toggle */}
                    <div className="flex items-center space-x-2">
                        <Switch
                            checked={showTotals}
                            onCheckedChange={setShowTotals}
                            id="show-totals"
                            className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="show-totals" className="text-sm">Show Totals</Label>
                    </div>

                    {/* Export Button */}
                    <Button
                        onClick={exportToExcel}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Category Filter Dialog */}
            <ClientCategoryFilter
                open={isCategoryFilterOpen}
                onOpenChange={setIsCategoryFilterOpen}
                onFilterChange={handleFilterChange}
                showSectionName={false}
                initialFilters={categoryFilters}
                showSectionStatus={false}
            />

            {/* Statistics Bar */}
            {showTotals && (
                <div className="px-4 py-3 bg-blue-50 border-b">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                            {[
                                {
                                    label: 'Total Companies',
                                    value: getStatusCounts().total,
                                    color: 'text-blue-600',
                                    bg: 'bg-blue-100'
                                },
                                {
                                    label: 'Received',
                                    value: getStatusCounts().receivedComplete,
                                    color: 'text-green-600',
                                    bg: 'bg-green-100'
                                },
                                {
                                    label: 'Delivered',
                                    value: getStatusCounts().deliveredComplete,
                                    color: 'text-purple-600',
                                    bg: 'bg-purple-100'
                                },
                                {
                                    label: 'Pending',
                                    value: getStatusCounts().receivedPending,
                                    color: 'text-orange-600',
                                    bg: 'bg-orange-100'
                                },
                                {
                                    label: 'NIL Records',
                                    value: getStatusCounts().nilCount,
                                    color: 'text-red-600',
                                    bg: 'bg-red-100'
                                },
                                {
                                    label: 'Urgent',
                                    value: getStatusCounts().urgentCount,
                                    color: 'text-pink-600',
                                    bg: 'bg-pink-100'
                                }
                            ].map((stat, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <div className={`px-3 py-1 rounded-full ${stat.bg}`}>
                                        <span className={`text-sm font-semibold ${stat.color}`}>
                                            {stat.value}
                                        </span>
                                    </div>
                                    <span className="text-sm text-gray-600">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="text-sm text-gray-500">
                            Completion Rate: {getStatusCounts().total > 0 ?
                                Math.round((getStatusCounts().receivedComplete / getStatusCounts().total) * 100) : 0}%
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <Table className="min-w-[1500px]">
                    <TableHeader className="sticky top-0 z-10 bg-gradient-to-r from-blue-100 to-indigo-100">
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id} className="h-12">
                                {headerGroup.headers.map(header => (
                                    <TableHead
                                        key={header.id}
                                        className="font-bold text-blue-800 border-r border-blue-200 last:border-r-0"
                                        style={{ width: header.column.columnDef.size }}
                                    >
                                        {header.isPlaceholder ? null : (
                                            <div
                                                className={cn(
                                                    "flex px-2 py-2",
                                                    header.column.getCanSort() && "cursor-pointer select-none hover:bg-blue-200 rounded"
                                                )}
                                                onClick={header.column.getToggleSortingHandler()}
                                            >
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {header.column.getIsSorted() && (
                                                    <span className="ml-2 text-blue-600">
                                                        {header.column.getIsSorted() === "asc" ? "↑" : "↓"}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>

                    <TableBody>
                        {table.getRowModel().rows.map((row, rowIndex) => {
                            const record = getCompanyRecord(row.original.id);
                            const isSelected = selectedRows.includes(row.original.id);
                            const isNilRecord = record?.is_nil;
                            const isUrgent = record?.is_urgent;

                            return (
                                <TableRow
                                    key={row.id}
                                    className={cn(
                                        "h-16 border-b transition-colors hover:bg-gray-50",
                                        rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30',
                                        isSelected && "bg-blue-50 border-blue-200",
                                        isNilRecord && "bg-red-50/50",
                                        isUrgent && "bg-pink-50 border-l-4 border-l-pink-500"
                                    )}
                                >
                                    {row.getVisibleCells().map((cell, cellIndex) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn(
                                                "p-3 border-r border-gray-100 last:border-r-0 align-middle",
                                                isNilRecord && cellIndex > 1 && "text-red-600",
                                                isUrgent && "font-medium"
                                            )}
                                            style={{
                                                width: cell.column.columnDef.size,
                                                minWidth: cell.column.columnDef.size,
                                                maxWidth: cell.column.columnDef.size
                                            }}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}