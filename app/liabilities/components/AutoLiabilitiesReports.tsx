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
import { Download, Search, ArrowUpDown, Send, AlertCircle, Filter } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ClientCategoryFilter } from '@/components/ClientCategoryFilter';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function AutoLiabilitiesReports() {
    const [data, setData] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 100,
    });

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
    const [categoryFilters, setCategoryFilters] = useState({});
    const [extractionHistory, setExtractionHistory] = useState({});

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

                // Organize historical data by company
                const history = historyData.reduce((acc, record) => {
                    if (!acc[record.company_name]) {
                        acc[record.company_name] = [];
                    }
                    acc[record.company_name].push(record);
                    return acc;
                }, {});

                setData(currentData);
                setExtractionHistory(history);
                if (currentData.length > 0) {
                    setSelectedCompany(currentData[0]);
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
            header: '#',
            cell: ({ row }) => row.index + 1,
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
            cell: ({ row }) => new Date(row.getValue('updated_at')).toLocaleString(),
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

    // Apply category filters to data
    const filteredData = useMemo(() => {
        if (Object.keys(categoryFilters).length === 0) return data;
        
        return data.filter(item => {
            // Check if any category filter is active
            const hasActiveFilters = Object.values(categoryFilters).some(categoryStatus => 
                Object.values(categoryStatus as Record<string, boolean>).some(isSelected => isSelected)
            );
            
            if (!hasActiveFilters) return true;
            
            // Get the item's category and status
            const category = item.category || 'all';
            const status = item.status === 'active' ? 'active' : 'inactive';
            
            // Check if this category has any filters
            const categoryFilter = categoryFilters[category] as Record<string, boolean> | undefined;
            if (!categoryFilter) {
                // Check if 'all' category has this status selected
                const allCategoryFilter = categoryFilters['all'] as Record<string, boolean> | undefined;
                return allCategoryFilter?.[status] || allCategoryFilter?.['all'];
            }
            
            // Check if this specific status is selected for this category
            return categoryFilter[status] || categoryFilter['all'];
        });
    }, [data, categoryFilters]);

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
                    {data
                        .sort((a, b) => a.company_name.localeCompare(b.company_name))
                        .map((company, index) => (
                            <div
                                key={company.id}
                                onClick={() => setSelectedCompany(company)}
                                className={`p-2 text-sm cursor-pointer border-b last:border-b-0 ${selectedCompany?.id === company.id
                                        ? 'bg-blue-500 text-white'
                                        : company.status === 'error'
                                            ? 'bg-red-50 hover:bg-red-100'
                                            : 'hover:bg-blue-50'
                                    }`}
                            >
                                <span className="mr-2 text-xs text-gray-500">{index + 1}.</span>
                                {company.company_name}
                                {company.status === 'error' && (
                                    <AlertCircle className="inline-block ml-1 h-3 w-3 text-red-500" />
                                )}
                            </div>
                        ))}
                </ScrollArea>
            </div>

            <div className="col-span-3">
                {selectedCompany && (
                    <Card className="h-[450px]">
                        <CardHeader className="py-3">
                            <CardTitle className="text-lg">{selectedCompany.company_name}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3">
                            <ScrollArea className="h-[350px]">
                                <Tabs defaultValue="current">
                                    <TabsList className="grid w-full grid-cols-2 mb-2">
                                        <TabsTrigger value="current">Current Extraction</TabsTrigger>
                                        <TabsTrigger value="previous">Previous Extractions</TabsTrigger>
                                    </TabsList>
                                    {renderCurrentExtractionTab()}
                                    {renderPreviousExtractionsTab()}
                                </Tabs>
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
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
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
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row, index) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                                className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
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
                const headers = columns.map(col => typeof col.header === 'function' ? col.accessorKey : col.header);
                sheet.addRow(headers);

                table.getRowModel().rows.forEach((row, index) => {
                    const rowData = columns.map(col => {
                        if (col.accessorKey === 'index') return index + 1;
                        if (col.accessorKey === 'updated_at') return new Date(row.original.updated_at).toLocaleString();
                        if (['income_tax', 'vat', 'paye', 'turnover_tax'].includes(col.accessorKey)) {
                            return formatAmount(calculateTotal(row.original, col.accessorKey));
                        }
                        return row.original[col.accessorKey] || '';
                    });
                    sheet.addRow(rowData);
                });
            };

            const addDetailedSheet = (wb, company, taxType) => {
                const sheet = wb.addWorksheet(`${company.company_name} - ${taxType}`);
                const data = company.liability_data[taxType];
                if (data && data.headers && data.rows) {
                    sheet.addRow(data.headers);
                    data.rows.forEach(row => {
                        const sanitizedRow = row.map(cell => cell !== null && cell !== undefined ? String(cell) : '');
                        sheet.addRow(sanitizedRow);
                    });
                }
            };

            if (exportOptions.view === 'summary') {
                addSummarySheet(workbook);
            } else if (exportOptions.view === 'detailed') {
                const companiesToExport = exportOptions.companyOption === 'all'
                    ? data
                    : data.filter(company => exportOptions.selectedCompanies.includes(company.id));

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
                    {exportOptions.companyOption === 'selected' && (
                        <ScrollArea className="h-[200px] w-full border rounded-md p-4">
                            {data.map(company => (
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
                                    <label htmlFor={`company-${company.id}`}>{company.company_name}</label>
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
                        <Input
                            placeholder="Search..."
                            value={globalFilter ?? ""}
                            onChange={(event) => setGlobalFilter(event.target.value)}
                            className="max-w-sm"
                        />
                        <Button variant="outline" onClick={() => setIsCategoryFilterOpen(true)}>
                            <Filter className="mr-2 h-4 w-4" /> Categories Filters
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
                    isOpen={isCategoryFilterOpen} 
                    onClose={() => setIsCategoryFilterOpen(false)} 
                    onApplyFilters={(filters) => setCategoryFilters(filters)}
                    onClearFilters={() => setCategoryFilters({})}
                    selectedFilters={categoryFilters}
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