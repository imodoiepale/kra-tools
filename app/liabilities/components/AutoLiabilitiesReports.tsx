// @ts-nocheck

import React, { useState, useEffect, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender
} from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Search, ArrowUpDown, Send, AlertCircle, Filter, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function AutoLiabilitiesReports() {
    const [data, setData] = useState([]);
    const [portalCompanies, setPortalCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 100,
    });
    const [searchTerm, setSearchTerm] = useState('');

    const TAX_TYPES = ['income_tax', 'vat', 'paye', 'mri', 'turnover_tax'];
    const [selectedCompanies, setSelectedCompanies] = useState([]);
    const [exportOptions, setExportOptions] = useState({
        view: 'summary',
        companyOption: 'all',
        taxTypes: TAX_TYPES,
        selectedCompanies: [],
        exportFormat: 'single_workbook'
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
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
    const [extractionHistory, setExtractionHistory] = useState({});
    const [showStats, setShowStats] = useState(false);

    // Effect to log category filter changes
    useEffect(() => {
        console.log('Category filters changed:', categoryFilters);
    }, [categoryFilters]);
    
    useEffect(() => {
        const fetchResults = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Fetch current extractions
                const { data: currentData, error: currentError } = await supabase
                    .from('liability_extractions')
                    .select('*')
                    .order('company_name', { ascending: true });

                if (currentError) throw currentError;

                // Fetch historical extractions
                const { data: historyData, error: historyError } = await supabase
                    .from('liability_extractions_history')
                    .select('*')
                    .order('id', { ascending: false });

                if (historyError) throw historyError;

                // Fetch companies from portal
                const { data: portalData, error: portalError } = await supabase
                    .from('acc_portal_company_duplicate')
                    .select('*')
                    .order('company_name', { ascending: true });

                if (portalError) throw portalError;

                // Process portal companies to add category information
                const processedPortalCompanies = portalData.map(company => {
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

                // Organize historical data by company
                const history = historyData.reduce((acc, record) => {
                    if (!acc[record.company_name]) {
                        acc[record.company_name] = [];
                    }
                    acc[record.company_name].push(record);
                    return acc;
                }, {});

                setData(currentData);
                setPortalCompanies(processedPortalCompanies);
                setExtractionHistory(history);
                
                // Set initial selected company from filtered data
                if (processedPortalCompanies.length > 0) {
                    setSelectedCompany(processedPortalCompanies[0]);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                setError('Failed to fetch results. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchResults();
    }, []);

    const calculateTotal = (item, taxType) => {
        try {
            if (!item || !item.liability_data || !item.liability_data[taxType] || !item.liability_data[taxType].rows) {
                return 0;
            }
            return item.liability_data[taxType].rows.reduce((sum, row) => {
                if (!Array.isArray(row) || row.length < 9) {
                    return sum;
                }
                const amountToPay = parseFloat(row[8].replace(/[^0-9.-]+/g, "") || 0);
                return sum + (isNaN(amountToPay) ? 0 : amountToPay);
            }, 0);
        } catch (error) {
            console.error(`Error calculating total for ${taxType}:`, error);
            return 0;
        }
    };

    const formatAmount = (amount) => {
        return `Ksh ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    };

    const columns = useMemo(() => [
        {
            accessorKey: 'index',
            header: 'IDX | ID',
            cell: ({ row }) => `${row.index + 1} | ${row.original.id}`,
        },
        {
            accessorKey: 'company_name',
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Company Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
        },
        {
            accessorKey: 'updated_at',
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Extraction Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => row.getValue('updated_at') ? new Date(row.getValue('updated_at')).toLocaleString() : 'Missing',
        },
        ...TAX_TYPES.map(taxType => ({
            accessorKey: taxType,
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="justify-center"
                >
                    {taxType === 'mri' ? 'Monthly Rental Income' :
                        taxType === 'turnover_tax' ? 'Turnover Tax' :
                            taxType.toUpperCase()}
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const amount = calculateTotal(row.original, taxType);
                return <span className={`text-center ${amount > 0 ? 'text-red-500 font-bold' : 'text-green-500'}`}>
                    {formatAmount(amount)}
                </span>;
            },
            sortingFn: (rowA, rowB) => calculateTotal(rowA.original, taxType) - calculateTotal(rowB.original, taxType),
        }))
    ], []);

    // Get merged and filtered data from portal companies and liability extractions
    const filteredData = useMemo(() => {
        console.log('Filtering data with categoryFilters:', categoryFilters);
        console.log('Total portal companies before filtering:', portalCompanies.length);
        
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
        
        console.log('Filtered portal companies after category filtering:', filteredPortalCompanies.length);

        // Map portal companies to liability data
        return filteredPortalCompanies.map(portalCompany => {
            // Find matching liability data if exists
            const matchingData = data.find(item => 
                item.company_name.toLowerCase() === portalCompany.company_name.toLowerCase()
            );
            
            if (matchingData) {
                // Return liability data with category information
                return {
                    ...matchingData,
                    id: portalCompany.id, // Use portal ID
                    categories: portalCompany.categories || [],
                    acc_client_status: portalCompany.acc_client_status || 'inactive',
                    imm_client_status: portalCompany.imm_client_status || 'inactive',
                    sheria_client_status: portalCompany.sheria_client_status || 'inactive',
                    audit_client_status: portalCompany.audit_client_status || 'inactive',
                };
            } else {
                // Create placeholder for company without liability data
                return {
                    id: portalCompany.id,
                    company_name: portalCompany.company_name,
                    updated_at: null,
                    liability_data: {},
                    status: 'pending',
                    categories: portalCompany.categories || [],
                    acc_client_status: portalCompany.acc_client_status || 'inactive',
                    imm_client_status: portalCompany.imm_client_status || 'inactive',
                    sheria_client_status: portalCompany.sheria_client_status || 'inactive',
                    audit_client_status: portalCompany.audit_client_status || 'inactive',
                    isMissing: true, // Add missing flag for companies without liability data
                };
            }
        });
    }, [portalCompanies, data, categoryFilters, searchTerm]);

    // Calculate statistics for complete and missing entries
    const calculateStats = () => {
        const stats = {
            complete: {},
            missing: {}
        };

        // Define fields to check for completeness
        const fieldsToCheck = [
            'company_name',
            'updated_at',
            ...TAX_TYPES
        ];

        // Initialize stats for each field
        fieldsToCheck.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        // Calculate stats for each field individually
        filteredData.forEach(item => {
            // Check company name
            if (item.company_name && item.company_name.trim() !== '') {
                stats.complete.company_name++;
            } else {
                stats.missing.company_name++;
            }
            
            // Check updated_at
            if (item.updated_at) {
                stats.complete.updated_at++;
            } else {
                stats.missing.updated_at++;
            }
            
            // Check tax types
            TAX_TYPES.forEach(taxType => {
                if (item.liability_data && item.liability_data[taxType] && item.liability_data[taxType].rows && item.liability_data[taxType].rows.length > 0) {
                    stats.complete[taxType]++;
                } else {
                    stats.missing[taxType]++;
                }
            });
        });

        return stats;
    };

    const stats = calculateStats();

    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        state: {
            sorting,
            globalFilter,
            pagination,
        },
        onGlobalFilterChange: setGlobalFilter,
    });

    const handleApplyFilters = (newFilters) => {
        setCategoryFilters(newFilters);
    };

    const handleClearFilters = () => {
        setCategoryFilters({
            categories: {},
            categorySettings: {}
        });
    };

    const renderErrorAlert = (data) => {
        if (data.status === 'error' && (data.liability_data?.error || data.error_message)) {
            const errorDetails = data.liability_data?.error || data.error_message;
            return (
                <Card className="mb-4 border-red-200">
                    <CardContent className="pt-6">
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Extraction Error</AlertTitle>
                            <AlertDescription>
                                {typeof errorDetails === 'object' ? errorDetails.message : errorDetails}
                                <br />
                                <span className="text-sm opacity-70">
                                    Occurred at: {new Date(data.liability_data?.timestamp || data.updated_at).toLocaleString()}
                                </span>
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            );
        }
        return null;
    };

    const renderDetailedView = () => (
        <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1">
                <ScrollArea className="h-[450px] border rounded-lg shadow-sm">
                    <div className="sticky top-0 bg-white p-1 border-b">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">Companies</span>
                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded">
                                {filteredData.length}
                            </span>
                        </div>
                        <Input
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full text-xs"
                        />
                    </div>
                    <div className="divide-y">
                        {filteredData
                            .sort((a, b) => a.company_name.localeCompare(b.company_name))
                            .map((company, index) => (
                                <div
                                    key={company.id}
                                    onClick={() => setSelectedCompany(company)}
                                    className={`p-2 text-sm cursor-pointer ${selectedCompany?.id === company.id
                                            ? 'bg-blue-500 text-white'
                                            : company.status === 'error'
                                                ? 'bg-red-50 hover:bg-red-100'
                                                : company.isMissing
                                                    ? 'bg-red-100 hover:bg-red-200'
                                                    : 'hover:bg-blue-50'
                                        }`}
                                >
                                    <div className="font-medium">
                                        <span className="text-[10px] text-gray-500 mr-1">#{company.id}</span>
                                        {company.company_name}
                                    </div>
                                    {/* Display category badges */}
                                    {company.categories && company.categories.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {company.categories.map(category => (
                                                <span 
                                                    key={category}
                                                    className={`text-[8px] px-1 py-0.5 rounded ${company[`${category.toLowerCase()}_client_status`] === 'active' 
                                                        ? 'bg-green-200 text-green-800' 
                                                        : 'bg-red-200 text-red-800'
                                                    }`}
                                                >
                                                    {category}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {company.status === 'error' && (
                                        <AlertCircle className="inline-block ml-1 h-3 w-3 text-red-500" />
                                    )}
                                    {company.isMissing && (
                                        <span className="text-[8px] text-red-500 font-bold">No Data</span>
                                    )}
                                </div>
                            ))}
                    </div>
                </ScrollArea>
            </div>

            <div className="col-span-3">
                {selectedCompany && (
                    <Card className="h-[450px]">
                        <CardHeader className="py-3">
                            <CardTitle className="text-lg">
                                {selectedCompany.company_name}
                                {/* Display category information in header */}
                                {selectedCompany.categories && selectedCompany.categories.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {selectedCompany.categories.map(category => (
                                            <span 
                                                key={category}
                                                className={`text-sm px-2 py-1 rounded ${selectedCompany[`${category.toLowerCase()}_client_status`] === 'active' 
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
                        <CardContent className="p-3">
                            <ScrollArea className="h-[350px]">
                                {selectedCompany.isMissing ? (
                                    <Alert>
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>No Liability Data</AlertTitle>
                                        <AlertDescription>
                                            No liability extraction data found for this company.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Tabs defaultValue="current">
                                        <TabsList className="grid w-full grid-cols-2 mb-2">
                                            <TabsTrigger value="current">Current Extraction</TabsTrigger>
                                            <TabsTrigger value="previous">Previous Extractions</TabsTrigger>
                                        </TabsList>
                                        {renderCurrentExtractionTab()}
                                        {renderPreviousExtractionsTab()}
                                    </Tabs>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );

    const renderSummaryView = () => (
        <ScrollArea className="h-[500px]">
            <Table>
                <TableHeader className="border-b">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id} className="border-r last:border-r-0">
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                    {showStats && (
                        <>
                            <TableRow className="bg-blue-50">
                                <TableHead className="border-r">Complete</TableHead>
                                {columns.slice(1).map((column, index) => {
                                    const field = column.accessorKey;
                                    const count = stats.complete[field] || 0;
                                    const total = filteredData.length;
                                    const isComplete = count === total;
                                    
                                    return (
                                        <TableHead 
                                            key={`complete-${index}`} 
                                            className={`text-center border-r last:border-r-0 ${isComplete ? 'text-green-600 font-bold' : ''}`}
                                        >
                                            {count}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                            <TableRow className="bg-red-50">
                                <TableHead className="border-r">Missing</TableHead>
                                {columns.slice(1).map((column, index) => {
                                    const field = column.accessorKey;
                                    const count = stats.missing[field] || 0;
                                    const hasAny = count > 0;
                                    
                                    return (
                                        <TableHead 
                                            key={`missing-${index}`} 
                                            className={`text-center border-r last:border-r-0 ${hasAny ? 'text-red-600 font-bold' : ''}`}
                                        >
                                            {count}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        </>
                    )}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row, index) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                                className={`${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'} ${row.original.isMissing ? 'bg-red-100' : ''}`}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} className="border-r last:border-r-0">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </ScrollArea>
    );

    const renderTaxTabs = () => (
        <TabsList>
            <TabsTrigger value="all">ALL</TabsTrigger>
            {TAX_TYPES.map((taxType) => (
                <TabsTrigger key={taxType} value={taxType}>
                    {taxType === 'mri' ? 'MONTHLY RENTAL INCOME' :
                        taxType === 'turnover_tax' ? 'TURNOVER TAX' :
                            taxType.toUpperCase()}
                </TabsTrigger>
            ))}
        </TabsList>
    );
    
    const renderTaxContent = (data) => (
        <TabsContent value="all">
            <ScrollArea className="h-[500px]">
                {TAX_TYPES.map((taxType) => (
                    <div key={taxType}>
                        <h3 className="text-lg font-semibold mt-4 mb-2">
                            {taxType === 'mri' ? 'MONTHLY RENTAL INCOME' :
                                taxType === 'turnover_tax' ? 'TURNOVER TAX' :
                                    taxType.replace('_', ' ').toUpperCase()}
                        </h3>
                        {renderTaxTable(data, taxType)}
                    </div>
                ))}
            </ScrollArea>
        </TabsContent>
    );

    // Update the CurrentExtraction Tab content
    const renderCurrentExtractionTab = () => (
        <TabsContent value="current">
            <Tabs defaultValue="all">
                {renderTaxTabs()}
                {renderTaxContent(selectedCompany)}
                {TAX_TYPES.map((taxType) => (
                    <TabsContent key={taxType} value={taxType}>
                        <ScrollArea className="h-[500px]">
                            {renderTaxTable(selectedCompany, taxType)}
                        </ScrollArea>
                    </TabsContent>
                ))}
            </Tabs>
        </TabsContent>
    );

    const renderPreviousExtractionsTab = () => (
        <TabsContent value="previous">
            {extractionHistory[selectedCompany?.company_name]?.length > 0 ? (
                <ScrollArea className="h-[500px]">
                    {extractionHistory[selectedCompany.company_name]
                        .sort((a, b) => new Date(b.extraction_date) - new Date(a.extraction_date))
                        .map((extraction, index) => (
                            <Card key={index} className="mb-4">
                                <CardHeader>
                                    <CardTitle className="text-xl text-blue-500">
                                        Extraction from {new Date(extraction.extraction_date).toLocaleString()}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {extraction.status === 'error' ? (
                                        renderErrorAlert(extraction)
                                    ) : (
                                        <Tabs defaultValue="all" className="w-full">
                                            {renderTaxTabs()}
                                            {renderTaxContent(extraction)}
                                            {TAX_TYPES.map((taxType) => (
                                                <TabsContent key={taxType} value={taxType}>
                                                    {renderTaxTable(extraction, taxType)}
                                                </TabsContent>
                                            ))}
                                        </Tabs>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                </ScrollArea>
            ) : (
                <div className="text-center py-8 text-gray-500">
                    No previous extractions found
                </div>
            )}
        </TabsContent>
    );

    const renderTaxTable = (data, taxType) => {
        if (!data?.liability_data || data.status === 'error') {
            return (
                <Alert variant="destructive" className="my-2">
                    <AlertCircle className="h-4 w-4" />
                   <AlertTitle>No data available</AlertTitle>
                   <AlertDescription>
                       {data.status === 'error' 
                           ? 'This extraction encountered an error'
                           : `No ${taxType.toUpperCase()} data available for this extraction`}
                   </AlertDescription>
               </Alert>
           );
       }
   
       const { headers = [], rows = [] } = data.liability_data[taxType] || {};
       const total = calculateTotal(data, taxType);
       const nonEmptyRows = rows.filter(row => row.some(cell => cell !== null && cell !== ''));
   
       return (
           <div className="rounded-lg border">
               <div className="p-2 bg-gray-50 text-sm text-gray-600">
                   Extraction Date: {new Date(data.extraction_date || data.updated_at).toLocaleString()}
               </div>
               {nonEmptyRows.length > 0 ? (
                   <Table>
                       <TableHeader>
                           <TableRow className="bg-gray-50">
                               <TableHead className="w-[50px]">#</TableHead>
                               {headers.map((header, index) => (
                                   <TableHead key={index} className="text-sm font-medium">
                                       {header}
                                   </TableHead>
                               ))}
                           </TableRow>
                       </TableHeader>
                       <TableBody>
                           {nonEmptyRows.map((row, rowIndex) => (
                               <TableRow key={rowIndex} className="text-sm">
                                   <TableCell className="text-gray-500">{rowIndex + 1}</TableCell>
                                   {row.map((cell, cellIndex) => (
                                       <TableCell key={cellIndex}>{cell}</TableCell>
                                   ))}
                               </TableRow>
                           ))}
                           <TableRow className="bg-red-50 font-medium">
                               <TableCell colSpan={headers.length + 1} className="text-center">
                                   Total Liability: <span className="text-red-600">{formatAmount(total)}</span>
                               </TableCell>
                           </TableRow>
                       </TableBody>
                   </Table>
               ) : (
                   <Alert className="m-2">
                       <AlertCircle className="h-4 w-4" />
                       <AlertTitle>No data</AlertTitle>
                       <AlertDescription>
                           No {taxType.toUpperCase()} records found for this extraction
                       </AlertDescription>
                   </Alert>
               )}
           </div>
       );
   };

   const exportToExcel = async () => {
       try {
           const workbook = new ExcelJS.Workbook();

           const addSummarySheet = (wb) => {
               const sheet = wb.addWorksheet('Summary');
               // Update headers to include portal ID
               const headers = columns.map(col => {
                   if (col.accessorKey === 'index') return 'IDX | ID';
                   return typeof col.header === 'function' ? col.accessorKey : col.header;
               });
               sheet.addRow(headers);

               table.getRowModel().rows.forEach((row, index) => {
                   const rowData = columns.map(col => {
                       if (col.accessorKey === 'index') return `${index + 1} | ${row.original.id}`; // Show index and portal ID
                       if (col.accessorKey === 'updated_at') return row.original.updated_at ? new Date(row.original.updated_at).toLocaleString() : 'N/A';
                       if (['income_tax', 'vat', 'paye', 'mri', 'turnover_tax'].includes(col.accessorKey)) {
                           return formatAmount(calculateTotal(row.original, col.accessorKey));
                       }
                       return row.original[col.accessorKey] || '';
                   });
                   sheet.addRow(rowData);
               });
           };

           const addDetailedSheet = (wb, company, taxType) => {
               // Include portal ID in worksheet name
               const sheet = wb.addWorksheet(`${company.company_name} (ID: ${company.id}) - ${taxType}`);
               
               // Add company info header
               sheet.addRow([`Company: ${company.company_name}`]);
               sheet.addRow([`Portal ID: ${company.id}`]);
               
               // Add category badges if available
               if (company.categories && company.categories.length > 0) {
                   const categoriesStr = company.categories.map(cat => {
                       const status = company[`${cat.toLowerCase()}_client_status`] || 'inactive';
                       return `${cat} (${status})`;
                   }).join(', ');
                   sheet.addRow([`Categories: ${categoriesStr}`]);
               }
               
               sheet.addRow([`Extraction Date: ${company.updated_at ? new Date(company.updated_at).toLocaleString() : 'N/A'}`]);
               sheet.addRow([]);
               
               const data = company.liability_data[taxType];
               if (data && data.headers && data.rows) {
                   sheet.addRow(data.headers);
                   data.rows.forEach(row => {
                       const sanitizedRow = row.map(cell => cell !== null && cell !== undefined ? String(cell) : '');
                       sheet.addRow(sanitizedRow);
                   });
               } else {
                   sheet.addRow(['No data available for this tax type']);
               }
           };

           if (exportOptions.view === 'summary') {
               addSummarySheet(workbook);
           } else if (exportOptions.view === 'detailed') {
               const companiesToExport = exportOptions.companyOption === 'all'
                   ? filteredData.filter(company => !company.isMissing) // Only export companies with data
                   : filteredData.filter(company => exportOptions.selectedCompanies.includes(company.id) && !company.isMissing);

               if (exportOptions.exportFormat === 'single_workbook') {
                   companiesToExport.forEach(company => {
                       exportOptions.taxTypes.forEach(taxType => {
                           addDetailedSheet(workbook, company, taxType);
                       });
                   });
               } else if (exportOptions.exportFormat === 'separate_workbooks') {
                   for (const company of companiesToExport) {
                       const companyWorkbook = new ExcelJS.Workbook();
                       exportOptions.taxTypes.forEach(taxType => {
                           addDetailedSheet(companyWorkbook, company, taxType);
                       });
                       const buffer = await companyWorkbook.xlsx.writeBuffer();
                       const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                       saveAs(blob, `Liability_Report_${company.company_name}_${new Date().toISOString().split('T')[0]}.xlsx`);
                   }
                   return; // Exit function after saving separate workbooks
               }
           }

           const buffer = await workbook.xlsx.writeBuffer();
           const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
           saveAs(blob, `Liability_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
       } catch (error) {
           console.error("Error exporting to Excel:", error);
           alert("An error occurred while exporting to Excel. Please try again.");
       }
   };

   const renderExportDialog = () => (
       <Dialog>
           <DialogTrigger asChild>
               <Button>
                   <Download className="mr-2 h-4 w-4" /> Export Options
               </Button>
           </DialogTrigger>
           <DialogContent>
               <DialogHeader>
                   <DialogTitle>Export Options</DialogTitle>
               </DialogHeader>
               <div className="space-y-4">
                   <Select
                       value={exportOptions.view}
                       onValueChange={(value) => setExportOptions(prev => ({ ...prev, view: value }))}
                   >
                       <SelectTrigger>
                           <SelectValue placeholder="Select view to export" />
                       </SelectTrigger>
                       <SelectContent>
                           <SelectItem value="summary">Summary View</SelectItem>
                           <SelectItem value="detailed">Detailed View</SelectItem>
                       </SelectContent>
                   </Select>
                   <div>
                       <h4 className="mb-2">Tax Types:</h4>
                       {TAX_TYPES.map(type => (
                           <div key={type} className="flex items-center space-x-2">
                               <Checkbox
                                   id={type}
                                   checked={exportOptions.taxTypes.includes(type)}
                                   onCheckedChange={(checked) => {
                                       setExportOptions(prev => ({
                                           ...prev,
                                           taxTypes: checked
                                               ? [...prev.taxTypes, type]
                                               : prev.taxTypes.filter(t => t !== type)
                                       }))
                                   }}
                               />
                               <label htmlFor={type}>
                                   {type === 'mri' ? 'MONTHLY RENTAL INCOME' :
                                       type === 'turnover_tax' ? 'TURNOVER TAX' :
                                           type.toUpperCase()}
                               </label>
                           </div>
                       ))}
                   </div>
                   <Select
                       value={exportOptions.companyOption}
                       onValueChange={(value) => setExportOptions(prev => ({ ...prev, companyOption: value }))}
                   >
                       <SelectTrigger>
                           <SelectValue placeholder="Select companies" />
                       </SelectTrigger>
                       <SelectContent>
                           <SelectItem value="all">All Companies</SelectItem>
                           <SelectItem value="selected">Selected Companies</SelectItem>
                       </SelectContent>
                   </Select>
                   
                   {exportOptions.view === 'detailed' && exportOptions.companyOption === 'selected' && (
                       <div>
                           <h4 className="mb-2">Select Companies:</h4>
                           <ScrollArea className="h-[200px] border rounded-md p-2">
                               {filteredData.filter(company => !company.isMissing).map(company => (
                                   <div key={company.id} className="flex items-center space-x-2 py-1">
                                       <Checkbox
                                           id={`company-${company.id}`}
                                           checked={exportOptions.selectedCompanies.includes(company.id)}
                                           onCheckedChange={(checked) => {
                                               if (checked) {
                                                   setExportOptions(prev => ({
                                                       ...prev,
                                                       selectedCompanies: [...prev.selectedCompanies, company.id]
                                                   }));
                                               } else {
                                                   setExportOptions(prev => ({
                                                       ...prev,
                                                       selectedCompanies: prev.selectedCompanies.filter(id => id !== company.id)
                                                   }));
                                               }
                                           }}
                                       />
                                       <label
                                           htmlFor={`company-${company.id}`}
                                           className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                       >
                                           <span className="text-[10px] text-gray-500 mr-1">#{company.id}</span>
                                           {company.company_name}
                                           {company.categories && company.categories.length > 0 && (
                                               <span className="ml-2 flex flex-wrap gap-1 mt-1">
                                                   {company.categories.map(category => (
                                                       <span key={category} className={`text-[8px] px-1 py-0.5 rounded ${company[`${category.toLowerCase()}_client_status`] === 'active' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                                           {category}
                                                       </span>
                                                   ))}
                                               </span>
                                           )}
                                       </label>
                                   </div>
                               ))}
                           </ScrollArea>
                       </div>
                   )}
                   
                   <Select
                       value={exportOptions.exportFormat}
                       onValueChange={(value) => setExportOptions(prev => ({ ...prev, exportFormat: value }))}
                   >
                       <SelectTrigger>
                           <SelectValue placeholder="Select export format" />
                       </SelectTrigger>
                       <SelectContent>
                           <SelectItem value="single_workbook">Single Workbook</SelectItem>
                           <SelectItem value="separate_workbooks">Separate Workbooks</SelectItem>
                       </SelectContent>
                   </Select>
                   
                   <Button onClick={exportToExcel} className="w-full">
                       Export
                   </Button>
               </div>
           </DialogContent>
       </Dialog>
   );

   const sendToClients = async (options) => {
       // Implement the logic to send reports to clients
       // This could involve calling an API endpoint or triggering an email service
       console.log("Sending to clients with options:", options);
       // Add your implementation here
   };

   return (
       <Card className="w-full">
           <CardHeader>
               <CardTitle>Liability Extraction Reports</CardTitle>
           </CardHeader>
           <CardContent>
               <div className="flex justify-between mb-4">
                   <div className="flex space-x-2">
                       <div className="relative max-w-sm">
                           <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                           <Input
                               placeholder="Search companies..."
                               value={searchTerm}
                               onChange={(event) => setSearchTerm(event.target.value)}
                               className="pl-8 max-w-sm"
                           />
                       </div>
                       <Button variant="outline" size="sm" onClick={() => setIsCategoryFilterOpen(true)}>
                           <Filter className="mr-1 h-4 w-4" />
                           Categories
                       </Button>
                       <Button variant="outline" onClick={() => setShowStats(!showStats)}>
                           {showStats ? (
                               <>
                                   <EyeOff className="mr-2 h-4 w-4" /> Hide Statistics
                               </>
                           ) : (
                               <>
                                   <Eye className="mr-2 h-4 w-4" /> Show Statistics
                               </>
                           )}
                       </Button>
                   </div>
                   <div className="space-x-2">
                       {renderExportDialog()}
                       <Dialog>
                           <DialogTrigger asChild>
                               <Button>
                                   <Send className="mr-2 h-4 w-4" /> Send to Clients
                               </Button>
                           </DialogTrigger>
                           <DialogContent>
                               <DialogHeader>
                                   <DialogTitle>Send to Clients</DialogTitle>
                               </DialogHeader>
                               <div className="space-y-4">
                                   {/* Add options for sending to clients */}
                                   <Button onClick={() => sendToClients({ all: true })}>Send to All Clients</Button>
                                   <Button onClick={() => sendToClients({ selected: selectedCompanies })}>Send to Selected Clients</Button>
                               </div>
                           </DialogContent>
                       </Dialog>
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
               <Tabs defaultValue="summary">
                   <TabsList>
                       <TabsTrigger value="summary">Summary View</TabsTrigger>
                       <TabsTrigger value="detailed">Detailed View</TabsTrigger>
                   </TabsList>
                   <TabsContent value="summary">
                       {renderSummaryView()}
                   </TabsContent>
                   <TabsContent value="detailed">
                       {renderDetailedView()}
                   </TabsContent>
               </Tabs>
           </CardContent>
       </Card>
   );
}