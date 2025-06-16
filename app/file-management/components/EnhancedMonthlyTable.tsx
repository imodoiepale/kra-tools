// @ts-nocheck
"use client";

import React, { useState, useMemo } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender, createColumnHelper } from '@tanstack/react-table';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Download, Settings2, CalendarIcon, Send, Filter, MoreHorizontal, Archive, Mail, FileDown, ArrowUpDown, Clock, Package, Loader2, CheckCircle, Ban } from "lucide-react";
import { format } from "date-fns";
import { toast } from 'react-hot-toast';
import { cn } from "@/lib/utils";

import EnhancedReceptionDialog from './EnhancedReceptionDialog';
import EnhancedDeliveryDialog from './EnhancedDeliveryDialog';
import BulkOperationsDialog from './BulkOperationsDialog';
import { FileRecord } from '../types/fileManagement';

interface Company {
    id: number;
    company_name: string;
    kra_pin: string;
    registration_number: string;
    status: string;
    
    // Category effective dates
    acc_client_effective_from: string;
    acc_client_effective_to: string;
    imm_client_effective_from: string;
    imm_client_effective_to: string;
    sheria_client_effective_from: string;
    sheria_client_effective_to: string;
    audit_client_effective_from: string;
    audit_client_effective_to: string;
    
    // Other fields
    [key: string]: any;
}
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui';

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
    const [categoryFilters, setCategoryFilters] = useState<{
        categories: { [key: string]: boolean };
        categorySettings: {
            [key: string]: {
                clientStatus: { [key: string]: boolean };
                sectionStatus: { [key: string]: boolean };
            };
        };
    }>({
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

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;

    // Helper function to get a case-insensitive property from an object
    const getCaseInsensitiveProp = (obj: any, prop: string) => {
        const lowerProp = prop.toLowerCase();
        const foundKey = Object.keys(obj).find(key => key.toLowerCase() === lowerProp);
        return foundKey ? obj[foundKey] : undefined;
    };

    // Helper function to check if a company is active for a specific category
    const isCompanyActiveForCategory = (company: any, category: string) => {
        const categoryId = category.slice(0, 3).toLowerCase();
        
        // Directly access the date fields we know exist
        const fromDateStr = company[`${categoryId}_client_effective_from`];
        const toDateStr = company[`${categoryId}_client_effective_to`];

        console.log(`Checking ${company.company_name} for category ${category} (${categoryId}):`, {
            fromDateStr,
            toDateStr,
            companyId: company.id,
            today: new Date().toISOString().split('T')[0]
        });

        if (!fromDateStr || !toDateStr) {
            console.log(`No valid dates found for ${company.company_name} in ${category}`);
            return false;
        }

        try {
            // Parse dates in DD/MM/YYYY format
            const [fromDay, fromMonth, fromYear] = fromDateStr.split('/').map(Number);
            const [toDay, toMonth, toYear] = toDateStr.split('/').map(Number);
            
            const fromDate = new Date(fromYear, fromMonth - 1, fromDay);
            const toDate = new Date(toYear, toMonth - 1, toDay);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize to start of day

            const isActive = today >= fromDate && today <= toDate;
            
            console.log(`Date check for ${company.company_name} (${category}):`, {
                today: today.toISOString().split('T')[0],
                fromDate: fromDate.toISOString().split('T')[0],
                toDate: toDate.toISOString().split('T')[0],
                isActive
            });

            return isActive;
        } catch (error) {
            console.error('Error parsing dates:', { 
                company: company.company_name, 
                category,
                fromDateStr, 
                toDateStr, 
                error 
            });
            return false;
        }
    };

// Apply category filters to companies
const applyCategoryFilters = (data: any[]) => {
    console.log('Applying category filters with settings:', categoryFilters);
    
    if (!categoryFilters.categories || Object.keys(categoryFilters.categories).length === 0) {
        console.log('No category filters defined, returning all data');
        return data;
    }

    // Get selected categories (excluding 'All Categories')
    const selectedCategories = Object.entries(categoryFilters.categories)
        .filter(([category, isSelected]) => category && category !== 'All Categories' && isSelected)
        .map(([category]) => category);

    console.log('Selected categories:', selectedCategories);

    // If no specific categories are selected, return all data
    if (selectedCategories.length === 0) {
        console.log('No categories selected, returning all data');
        return data;
    }

    // If 'All Categories' is selected, return all data
    if (categoryFilters.categories['All Categories']) {
        console.log('All categories selected, returning all data');
        return data;
    }

    const filtered = data.filter(company => {
        return selectedCategories.some(category => {
            // Use slice(0, 3) to get the correct prefix like the manufacturers table
            const categoryId = category.toLowerCase().slice(0, 3);
            const fromField = `${categoryId}_client_effective_from`;
            const toField = `${categoryId}_client_effective_to`;
            
            console.log(`Checking company ${company.company_name} for category ${category} (${categoryId})`);
            console.log(`Looking for fields: ${fromField} and ${toField}`);
            
            const fromDateStr = company[fromField];
            const toDateStr = company[toField];
            
            console.log(`Found dates: from=${fromDateStr}, to=${toDateStr}`);
            
            // If no dates are set, this company doesn't belong to this category
            if (!fromDateStr || !toDateStr) {
                console.log(`No dates found for ${company.company_name} in ${category} (${categoryId})`);
                console.log('Available date fields:', 
                    Object.keys(company).filter(key => key.endsWith('_effective_from') || key.endsWith('_effective_to'))
                );
                return false;
            }

            try {
                // Calculate current status based on today's date
                // Parse dates in DD/MM/YYYY format and reverse to YYYY-MM-DD for Date constructor
                const today = new Date();
                const effectiveFrom = new Date(fromDateStr.split('/').reverse().join('-'));
                const effectiveTo = new Date(toDateStr.split('/').reverse().join('-'));
                const currentStatus = today >= effectiveFrom && today <= effectiveTo ? 'active' : 'inactive';

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
                const shouldShow = selectedClientStatuses.includes(currentStatus);
                
                console.log(`Company ${company.company_name} (${company.id}) - ${category}:`, {
                    currentStatus,
                    shouldShow,
                    effectiveFrom: effectiveFrom.toISOString(),
                    effectiveTo: effectiveTo.toISOString(),
                    today: today.toISOString(),
                    selectedClientStatuses
                });
                
                return shouldShow;
            } catch (error) {
                console.error('Error checking dates:', error);
                return false;
            }
        });
    });
    
    console.log(`Filtered ${data.length} companies down to ${filtered.length}`);
    return filtered;
};

    // Get file record for a company in the selected month
    const getCompanyRecord = (companyId: string | number): FileRecord | null => {
        const companyIdStr = companyId.toString();
        
        const record = fileRecords.find(record => {
            const recordCompanyId = typeof record.company_id === 'number' 
                ? record.company_id.toString() 
                : record.company_id;
                
            return recordCompanyId === companyIdStr &&
                   record.year === year &&
                   record.month === month;
        });
        
        return record || null;
    };

    // Get latest reception for display
const getLatestReception = (record: FileRecord | null): ReceptionRecord | null => {
    if (!record?.receptions || record.receptions.length === 0) return null;
    return record.receptions[record.receptions.length - 1];
};

// Get total files received
const getTotalFilesReceived = (record: FileRecord | null): number => {
    if (!record?.receptions) return 0;
    return record.receptions.reduce((total, reception) => total + reception.files_count, 0);
};

// Check if has any receptions
const hasAnyReceptions = (record: FileRecord | null): boolean => {
    return record?.receptions && record.receptions.length > 0;
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
                const hasReception = record && (record.received_at || record.is_nil);
                
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
                        {hasReception && (
                            <CheckCircle className="h-4 w-4 ml-1 text-green-500" />
                        )}
                        {record?.is_nil && (
                            <Badge variant="destructive" className="ml-1 text-xs">NIL</Badge>
                        )}
                        {record?.is_urgent && (
                            <Badge variant="destructive" className="ml-1 text-xs animate-pulse">URGENT</Badge>
                        )}
                    </div>
                );
            },
            size: 140,
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
                const latestReception = getLatestReception(record);
                const totalFiles = getTotalFilesReceived(record);
                const totalReceptions = record?.receptions?.length || 0;
                
                if (!latestReception) {
                    return <div className="text-xs text-gray-400">No receptions</div>;
                }
        
                const dateTime = formatDateTime(latestReception.received_at);
        
                return (
                    <div className="text-xs">
                        <p className="font-medium">{dateTime.date}</p>
                        <p className="text-gray-500">{dateTime.time}</p>
                        {latestReception.brought_by && (
                            <p className="text-blue-600 mt-1">By: {latestReception.brought_by}</p>
                        )}
                        {totalReceptions > 1 && (
                            <div className="flex items-center gap-1 mt-1">
                                <Badge variant="outline" className="text-xs">
                                    {totalReceptions} receptions
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                    {totalFiles} files
                                </Badge>
                            </div>
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
                const hasReceptions = hasAnyReceptions(record);
                const totalReceptions = record?.receptions?.length || 0;
                
                return (
                    <div className="flex items-center justify-center">
                        <EnhancedDeliveryDialog
                            companyName={row.original.company_name}
                            companyId={row.original.id}
                            year={year}
                            month={month}
                            onConfirm={(data) => onUpdateRecord(row.original.id, year, month, data)}
                            existingData={record}
                        />
                        {hasReceptions && (
                            <div className="flex items-center ml-1">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                {totalReceptions > 1 && (
                                    <Badge variant="outline" className="ml-1 text-xs">
                                        {totalReceptions}
                                    </Badge>
                                )}
                            </div>
                        )}
                        {record?.is_nil && (
                            <Badge variant="destructive" className="ml-1 text-xs">NIL</Badge>
                        )}
                        {record?.is_urgent && (
                            <Badge variant="destructive" className="ml-1 text-xs animate-pulse">URGENT</Badge>
                        )}
                    </div>
                );
            },
            size: 140,
        }),

        // Delivery details
        columnHelper.display({
            id: 'deliveryDetails',
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
                
                // Determine status based on record state
                let status = 'pending';
                if (record) {
                    if (record.is_nil) {
                        status = 'nil';
                    } else if (record.delivered_at) {
                        status = 'delivered';
                    } else if (record.received_at) {
                        status = 'received';
                    } else if (record.processing_status === 'in_progress') {
                        status = 'processed';
                    }
                }

                const statusConfig = {
                    pending: { 
                        label: 'Pending', 
                        color: 'bg-gray-100 text-gray-800 border border-gray-200',
                        icon: <Clock className="h-3 w-3 mr-1" />
                    },
                    received: { 
                        label: 'Received', 
                        color: 'bg-blue-50 text-blue-700 border border-blue-200',
                        icon: <Package className="h-3 w-3 mr-1" />
                    },
                    processed: { 
                        label: 'In Process', 
                        color: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
                        icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    },
                    delivered: { 
                        label: 'Delivered', 
                        color: 'bg-green-50 text-green-700 border border-green-200',
                        icon: <CheckCircle className="h-3 w-3 mr-1" />
                    },
                    nil: { 
                        label: 'NIL', 
                        color: 'bg-red-50 text-red-700 border border-red-200',
                        icon: <Ban className="h-3 w-3 mr-1" />
                    }
                };

                const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

                return (
                    <div className="flex items-center">
                        <Badge className={`text-xs font-normal ${config.color} flex items-center`}>
                            {config.icon}
                            {config.label}
                        </Badge>
                        {record?.is_urgent && (
                            <span className="ml-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        )}
                    </div>
                );
            },
            size: 140,
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

// Table data with indices
const filteredCompanies = useMemo(() => {
    if (!companies.length) return [];

    const sortedCompanies = [...companies].sort((a, b) => {
        return a.company_name.localeCompare(b.company_name);
    });

    const filteredResults = sortedCompanies.filter(company => {
        // Search term filtering
        if (globalFilter) {
            const query = globalFilter.toLowerCase();
            const searchFields = [
                company.company_name,
                company.kra_pin,
                company.registration_number
            ];
            const matchesSearch = searchFields.some(field =>
                field?.toString().toLowerCase().includes(query)
            );
            if (!matchesSearch) return false;
        }

        // Category filtering
        const selectedCategories = Object.entries(categoryFilters.categories || {})
            .filter(([category, isSelected]) => category && category !== 'All Categories' && isSelected)
            .map(([category]) => category);

        console.log('Selected categories for filtering:', selectedCategories);
        
        // Debug: Log all date fields from the company
        const dateFields = Object.keys(company).filter(key => 
            key.endsWith('_client_effective_from') || 
            key.endsWith('_client_effective_to')
        );
        console.log('All date fields in company:', dateFields);
        
        // Log the actual values for the selected categories
        const categoryValues = selectedCategories.reduce((acc, cat) => {
            const prefix = cat.toLowerCase().slice(0, 3);
            return {
                ...acc,
                [`${prefix}_from`]: company[`${prefix}_client_effective_from`],
                [`${prefix}_to`]: company[`${prefix}_client_effective_to`]
            };
        }, {});
        
        console.log('Company category values:', categoryValues);

        // If no categories selected or All Categories is selected, include all
        if (selectedCategories.length === 0 || categoryFilters.categories?.['All Categories']) {
            console.log('No specific categories selected or All Categories is selected, including company');
            return true;
        }

        return selectedCategories.some(category => {
            const categoryId = category.toLowerCase();
            const prefix = categoryId.slice(0, 3);
            const fromField = `${prefix}_client_effective_from`;
            const toField = `${prefix}_client_effective_to`;
            
            // Try to get the dates using the full category name first, then fall back to prefix
            const fromDateStr = company[`${categoryId}_client_effective_from`] || company[fromField];
            const toDateStr = company[`${categoryId}_client_effective_to`] || company[toField];

            console.log(`Checking category ${category} (${categoryId}) for ${company.company_name}:`, {
                fromField,
                toField,
                fromDateStr,
                toDateStr,
                hasBothDates: !!(fromDateStr && toDateStr),
                allCompanyKeys: Object.keys(company)
            });

            // If no dates are set, this company doesn't belong to this category
            if (!fromDateStr || !toDateStr) {
                console.log(`No dates found for ${company.company_name} in category ${category} (${categoryId})`);
                console.log('Available fields:', Object.keys(company));
                return false;
            }

            // Calculate current status based on today's date
            const today = new Date();
            // Parse dates in DD/MM/YYYY format
            const [fromDay, fromMonth, fromYear] = fromDateStr.split('/').map(Number);
            const [toDay, toMonth, toYear] = toDateStr.split('/').map(Number);
            
            const effectiveFrom = new Date(fromYear, fromMonth - 1, fromDay);
            const effectiveTo = new Date(toYear, toMonth - 1, toDay);
            const currentStatus = today >= effectiveFrom && today <= effectiveTo ? 'active' : 'inactive';
            
            console.log(`Date check for ${company.company_name} (${category}):`, {
                today: today.toISOString(),
                effectiveFrom: effectiveFrom.toISOString(),
                effectiveTo: effectiveTo.toISOString(),
                currentStatus,
                isActive: today >= effectiveFrom && today <= effectiveTo
            });

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
    });

    return filteredResults;
}, [companies, globalFilter, categoryFilters]);

    // React Table setup
    const table = useReactTable({
        data: filteredCompanies,
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
            return hasAnyReceptions(record) || record?.is_nil;
        }).length;
    
        const deliveredCount = rows.filter(row => {
            const record = getCompanyRecord(row.original.id);
            return record?.deliveries && record.deliveries.length > 0;
        }).length;
    
        const nilCount = rows.filter(row => {
            const record = getCompanyRecord(row.original.id);
            return record?.is_nil;
        }).length;
    
        const urgentCount = rows.filter(row => {
            const record = getCompanyRecord(row.original.id);
            return record?.is_urgent;
        }).length;
    
        const totalFilesReceived = rows.reduce((total, row) => {
            const record = getCompanyRecord(row.original.id);
            return total + getTotalFilesReceived(record);
        }, 0);
    
        const totalReceptions = rows.reduce((total, row) => {
            const record = getCompanyRecord(row.original.id);
            return total + (record?.receptions?.length || 0);
        }, 0);
    
        return {
            total,
            receivedComplete: receivedCount,
            receivedPending: total - receivedCount,
            deliveredComplete: deliveredCount,
            deliveredPending: total - deliveredCount,
            nilCount,
            urgentCount,
            totalFilesReceived,
            totalReceptions
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
    return (
        <div className="h-[calc(100vh-200px)] flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto p-2">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search companies..."
                            className="w-full pl-8"
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCategoryFilterOpen(true)}
                        className="flex items-center gap-2"
                    >
                        <Filter className="h-4 w-4" />
                        Categories
                        {Object.values(categoryFilters.categories).filter(Boolean).length > 1 && (
                            <span className="ml-1 bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs">
                                {Object.values(categoryFilters.categories).filter(Boolean).length - 1}
                            </span>
                        )}
                    </Button>
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

                    {/* Bulk Operations */}
                    {selectedRows.length > 0 && (
                        <BulkOperationsDialog
                            selectedCompanies={selectedRows}
                            year={year}                            month={month}
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
            <div className="flex-1 flex flex-col overflow-hidden">
                <ScrollArea className="h-[calc(100vh-300px)]">
                    <div className="relative">
                        <Table className="w-full">
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
                                {table.getRowModel().rows.length > 0 ? (
                                    table.getRowModel().rows.map((row, rowIndex) => (
                                        <TableRow
                                            key={row.id}
                                            className={cn(
                                                "h-16 border-b transition-colors hover:bg-gray-50",
                                                rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30',
                                                selectedRows.includes(row.original.id) && "bg-blue-50 border-blue-200",
                                                getCompanyRecord(row.original.id)?.is_nil && "bg-red-50/50",
                                                getCompanyRecord(row.original.id)?.is_urgent && "bg-pink-50 border-l-4 border-l-pink-500"
                                            )}
                                        >
                                            {row.getVisibleCells().map((cell, cellIndex) => {
                                                const record = getCompanyRecord(row.original.id);
                                                const isNilRecord = record?.is_nil;
                                                const isUrgent = record?.is_urgent;
                                                
                                                return (
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
                                                );
                                            })}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={table.getAllColumns().length} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-4">
                                                <div className="text-4xl">📁</div>
                                                <h3 className="text-lg font-semibold text-gray-800">No Companies Found</h3>
                                                <p className="text-gray-600">
                                                    Try adjusting your filters or add some companies to get started.
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </ScrollArea>
            </div>
            <ClientCategoryFilter
                open={isCategoryFilterOpen}
                onOpenChange={setIsCategoryFilterOpen}
                onFilterChange={setCategoryFilters}
                showSectionName=""
                initialFilters={categoryFilters}
                showSectionStatus={false}
            />
        </div>
    );
}