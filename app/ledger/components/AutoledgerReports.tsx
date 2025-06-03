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
import { Download, Search, ArrowUpDown, Send, AlertTriangle, AlertCircle, Filter, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function AutoLedgerReports() {
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
    const TAX_TYPES = ['income_tax', 'vat', 'paye', 'mri', 'tot'];
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
    const [extractionHistory, setExtractionHistory] = useState({});
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
    const [showStats, setShowStats] = useState(false);

    useEffect(() => {
        const fetchResults = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Fetch current extractions
                const { data: currentData, error: currentError } = await supabase
                    .from('ledger_extractions')
                    .select('*')
                    .order('id', { ascending: false });

                if (currentError) throw currentError;

                // Fetch historical extractions
                const { data: historyData, error: historyError } = await supabase
                    .from('ledger_extractions_history')
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
        if (!item || !item.ledger_data) return 0;
        
        const relevantData = item.ledger_data.filter(entry => 
            entry.tax_obligation && entry.tax_obligation.toLowerCase().includes(taxType.toLowerCase())
        );

        return relevantData.reduce((sum, entry) => {
            const debit = parseFloat(entry.debit.replace(/[^0-9.-]+/g, "") || 0);
            const credit = parseFloat(entry.credit.replace(/[^0-9.-]+/g, "") || 0);
            return sum + (debit - credit);
        }, 0);
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
                        taxType === 'tot' ? 'Turnover Tax' :
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

    // Get merged and filtered data from portal companies and ledger extractions
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

        // Map portal companies to ledger data
        return filteredPortalCompanies.map(portalCompany => {
            // Find matching ledger data if exists
            const matchingData = data.find(item => 
                item.company_name.toLowerCase() === portalCompany.company_name.toLowerCase()
            );
            
            if (matchingData) {
                // Return ledger data with category information
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
                // Create placeholder for company without ledger data
                return {
                    id: portalCompany.id,
                    company_name: portalCompany.company_name,
                    updated_at: null,
                    ledger_data: [],
                    status: 'pending',
                    categories: portalCompany.categories || [],
                    acc_client_status: portalCompany.acc_client_status || 'inactive',
                    imm_client_status: portalCompany.imm_client_status || 'inactive',
                    sheria_client_status: portalCompany.sheria_client_status || 'inactive',
                    audit_client_status: portalCompany.audit_client_status || 'inactive',
                    isMissing: true, // Add missing flag for companies without ledger data
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
                if (item.ledger_data && item.ledger_data.length > 0 && calculateTotal(item, taxType) !== 0) {
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
        if (data.status === 'error' && (data.ledger_data?.error || data.error_message)) {
            const errorDetails = data.ledger_data?.error || data.error_message;
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
                                    Occurred at: {new Date(data.ledger_data?.timestamp || data.updated_at).toLocaleString()}
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
        <div className="grid grid-cols-4 gap-2 xs:gap-1">
            <div className="col-span-1">
                <ScrollArea className="h-[550px] xs:h-[300px] border rounded-lg">
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
                           .map((company) => (
                               <div
                                   key={company.id}
                                   onClick={() => setSelectedCompany(company)}
                                   className={`p-1 xs:p-0.5 text-xs cursor-pointer ${
                                       selectedCompany?.id === company.id
                                           ? 'bg-blue-500 text-white'
                                           : company.status === 'error'
                                               ? 'bg-red-100 hover:bg-red-200'
                                               : company.isMissing
                                                   ? 'bg-red-100 hover:bg-red-200'
                                                   : 'hover:bg-blue-100'
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
                   <>
                       {renderErrorAlert(selectedCompany)}
                       <Card>
                           <CardHeader>
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
                           <CardContent>
                               {selectedCompany.isMissing ? (
                                   <Alert>
                                       <AlertCircle className="h-4 w-4" />
                                       <AlertTitle>No Ledger Data</AlertTitle>
                                       <AlertDescription>
                                           No ledger extraction data found for this company.
                                       </AlertDescription>
                                   </Alert>
                               ) : (
                                   <Tabs defaultValue="current">
                                       <TabsList className="grid w-full grid-cols-2 mb-4">
                                           <TabsTrigger value="current">Current Extraction</TabsTrigger>
                                           <TabsTrigger value="previous">Previous Extractions</TabsTrigger>
                                       </TabsList>
       
                                       {renderCurrentExtractionTab()}
                                       {renderPreviousExtractionsTab()}
                                   </Tabs>
                               )}
                           </CardContent>
                       </Card>
                   </>
               )}
           </div>
       </div>
   );
   
   const renderSummaryView = () => (
       <ScrollArea className="h-[500px]">
           <Table>
               <TableHeader>
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
                       taxType === 'tot' ? 'TURNOVER TAX' :
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
                               taxType === 'tot' ? 'TURNOVER TAX' :
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
       if (!data?.ledger_data || data.status === 'error') {
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
   
       // Filter entries for the specific tax type
       const relevantData = data.ledger_data.filter(entry => {
           const taxObligation = entry.tax_obligation?.toLowerCase() || '';
           switch (taxType) {
               case 'paye':
                   return taxObligation.includes('paye');
               case 'vat':
                   return taxObligation.includes('vat');
               case 'income_tax':
                   return taxObligation.includes('income tax') && !taxObligation.includes('paye');
               case 'mri':
                   return taxObligation.includes('rental');
               case 'tot':
                   return taxObligation.includes('turnover');
               default:
                   return false;
           }
       });
   
       // Calculate total excluding summary rows
       const total = relevantData
           .filter(entry => !entry.tax_obligation?.toLowerCase().includes('total records'))
           .reduce((sum, entry) => {
               const debit = parseFloat(entry.debit.replace(/[^0-9.-]+/g, "") || 0);
               const credit = parseFloat(entry.credit.replace(/[^0-9.-]+/g, "") || 0);
               return sum + (debit - credit);
           }, 0);
   
       return (
           <div>
               <div className="text-sm text-gray-500 mb-2">
                   Extraction Date: {new Date(data.extraction_date || data.updated_at).toLocaleString()}
               </div>
               {relevantData.length > 0 ? (
                   <Table>
                       <TableHeader>
                           <TableRow>
                               <TableHead>#</TableHead>
                               <TableHead>Transaction Date</TableHead>
                               <TableHead>Tax Period</TableHead>
                               <TableHead>Reference</TableHead>
                               <TableHead>Transaction Type</TableHead>
                               <TableHead>Particulars</TableHead>
                               <TableHead>Debit</TableHead>
                               <TableHead>Credit</TableHead>
                           </TableRow>
                       </TableHeader>
                       <TableBody>
                           {relevantData
                               .filter(entry => !entry.tax_obligation?.toLowerCase().includes('total records'))
                               .map((entry, index) => (
                                   <TableRow key={index}>
                                       <TableCell>{entry.sr_no || index + 1}</TableCell>
                                       <TableCell>{entry.transaction_date}</TableCell>
                                       <TableCell>{entry.tax_period}</TableCell>
                                       <TableCell>{entry.reference_number}</TableCell>
                                       <TableCell>{entry.transaction_type}</TableCell>
                                       <TableCell>{entry.particulars}</TableCell>
                                       <TableCell className={entry.debit !== "0.00" ? "text-red-500" : ""}>
                                           {entry.debit}
                                       </TableCell>
                                       <TableCell className={entry.credit !== "0.00" ? "text-green-500" : ""}>
                                           {entry.credit}
                                       </TableCell>
                                   </TableRow>
                               ))}
                           <TableRow className="bg-gray-100 font-bold">
                               <TableCell colSpan={6} className="text-right">
                                   Net Balance:
                               </TableCell>
                               <TableCell colSpan={2} className={`text-center ${total > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                   {formatAmount(Math.abs(total))} {total > 0 ? 'DR' : 'CR'}
                               </TableCell>
                           </TableRow>
                       </TableBody>
                   </Table>
               ) : (
                   <Alert>
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
               const headers = columns.map(col => {
                   if (col.accessorKey === 'index') return 'IDX | ID';
                   return typeof col.header === 'function' ? col.accessorKey : col.header;
               });
               sheet.addRow(headers);

               table.getRowModel().rows.forEach((row, index) => {
                   const rowData = columns.map(col => {
                       if (col.accessorKey === 'index') return `${index + 1} | ${row.original.id}`;
                       if (col.accessorKey === 'updated_at') return row.original.updated_at ? new Date(row.original.updated_at).toLocaleString() : 'N/A';
                       if (TAX_TYPES.includes(col.accessorKey)) {
                           return formatAmount(calculateTotal(row.original, col.accessorKey));
                       }
                       return row.original[col.accessorKey] || '';
                   });
                   sheet.addRow(rowData);
               });
           };

           const addDetailedSheet = (wb, company, taxType) => {
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
               
               if (company.ledger_data && company.ledger_data.length > 0) {
                   const headers = ['Sr No', 'Transaction Date', 'Tax Period', 'Reference', 'Transaction Type', 'Particulars', 'Debit', 'Credit'];
                   sheet.addRow(headers);
                   
                   const relevantData = company.ledger_data.filter(entry => {
                       const taxObligation = entry.tax_obligation?.toLowerCase() || '';
                       switch (taxType) {
                           case 'paye': return taxObligation.includes('paye');
                           case 'vat': return taxObligation.includes('vat');
                           case 'income_tax': return taxObligation.includes('income tax') && !taxObligation.includes('paye');
                           case 'mri': return taxObligation.includes('rental');
                           case 'tot': return taxObligation.includes('turnover');
                           default: return false;
                       }
                   });
                   
                   relevantData.forEach(entry => {
                       sheet.addRow([
                           entry.sr_no || '',
                           entry.transaction_date || '',
                           entry.tax_period || '',
                           entry.reference_number || '',
                           entry.transaction_type || '',
                           entry.particulars || '',
                           entry.debit || '',
                           entry.credit || ''
                       ]);
                   });
               } else {
                   sheet.addRow(['No data available for this tax type']);
               }
           };

           if (exportOptions.view === 'summary') {
               addSummarySheet(workbook);
           } else if (exportOptions.view === 'detailed') {
               const companiesToExport = exportOptions.companyOption === 'all'
                   ? filteredData.filter(company => !company.isMissing)
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
                       saveAs(blob, `Ledger_Report_${company.company_name}_${new Date().toISOString().split('T')[0]}.xlsx`);
                   }
                   return;
               }
           }

           const buffer = await workbook.xlsx.writeBuffer();
           const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
           saveAs(blob, `Ledger_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
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
                               <label htmlFor={type}>{
                                     type === 'mri' ? 'MONTHLY RENTAL INCOME' :
                                     type === 'tot' ? 'TURNOVER TAX' :
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
                   {exportOptions.companyOption === 'selected' && (
                       <ScrollArea className="h-[200px] w-full border rounded-md p-4">
                           {filteredData.filter(company => !company.isMissing).map(company => (
                               <div key={company.id} className="flex items-center space-x-2 py-2">
                                   <Checkbox
                                       id={`company-${company.id}`}
                                       checked={exportOptions.selectedCompanies.includes(company.id)}
                                       onCheckedChange={(checked) => {
                                           setExportOptions(prev => ({
                                               ...prev,
                                               selectedCompanies: checked
                                                   ? [...prev.selectedCompanies, company.id]
                                                   : prev.selectedCompanies.filter(id => id !== company.id)
                                           }))
                                       }}
                                   />
                                   <label htmlFor={`company-${company.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
                   <Button onClick={exportToExcel}>
                       Export
                   </Button>
               </div>
           </DialogContent>
       </Dialog>
   );

   const sendToClients = async (options) => {
       console.log("Sending to clients with options:", options);
   };

   return (
       <Card className="w-full">
           <CardHeader>
               <CardTitle>Ledger Extraction Reports</CardTitle>
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
               <div className="flex items-center justify-between mt-2">
                   <div>
                       <Button
                           variant="outline"
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
                   <span className="flex items-center gap-1">
                       <div>Page</div>
                       <strong>
                           {table.getState().pagination.pageIndex + 1} of{" "}
                           {table.getPageCount()}
                       </strong>
                   </span>
                   <Select
                       value={table.getState().pagination.pageSize.toString()}
                       onValueChange={(value) => {
                           table.setPageSize(Number(value));
                       }}
                   >
                       <SelectTrigger className="w-[100px]">
                           <SelectValue placeholder={table.getState().pagination.pageSize} />
                       </SelectTrigger>
                       <SelectContent>
                           {[10, 25, 50, 100].map((pageSize) => (
                               <SelectItem key={pageSize} value={pageSize.toString()}>
                                   {pageSize}
                               </SelectItem>
                           ))}
                       </SelectContent>
                   </Select>
               </div>
           </CardContent>
       </Card>
   );
}