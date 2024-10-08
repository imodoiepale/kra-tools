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
import { Download, Search, ArrowUpDown, Send } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

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
    const [selectedCompanies, setSelectedCompanies] = useState([]);
    const [exportOptions, setExportOptions] = useState({
        view: 'summary',
        taxTypes: ['income_tax', 'vat', 'paye'],
        companyOption: 'all',
        selectedCompanies: [],
        exportFormat: 'single_workbook'
    });

    useEffect(() => {
        fetchResults();
    }, []);

    const fetchResults = async () => {
        try {
            const { data, error } = await supabase
                .from('liability_extractions')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;
            setData(data);
            if (data.length > 0) {
                setSelectedCompany(data[0]);
            }
        } catch (error) {
            console.error('Error fetching results:', error);
            alert('Failed to fetch results. Please try again.');
        }
    };

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
            accessorKey: 'extraction_date',
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
            cell: ({ row }) => new Date(row.getValue('extraction_date')).toLocaleString(),
        },
        {
            accessorKey: 'income_tax',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="justify-center"
                >
                    Income Tax
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const amount = calculateTotal(row.original, 'income_tax');
                return <span className={`text-center ${amount > 0 ? 'text-red-500 font-bold' : 'text-green-500'}`}>{formatAmount(amount)}</span>;
            },
            sortingFn: (rowA, rowB) => calculateTotal(rowA.original, 'income_tax') - calculateTotal(rowB.original, 'income_tax'),
        },
        {
            accessorKey: 'vat',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="justify-center"
                >
                    VAT
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const amount = calculateTotal(row.original, 'vat');
                return <span className={`text-center ${amount > 0 ? 'text-red-500 font-bold' : 'text-green-500'}`}>{formatAmount(amount)}</span>;
            },
            sortingFn: (rowA, rowB) => calculateTotal(rowA.original, 'vat') - calculateTotal(rowB.original, 'vat'),
        },
        {
            accessorKey: 'paye',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="justify-center"
                >
                    PAYE
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const amount = calculateTotal(row.original, 'paye');
                return <span className={`text-center ${amount > 0 ? 'text-red-500 font-bold' : 'text-green-500'}`}>{formatAmount(amount)}</span>;
            },
            sortingFn: (rowA, rowB) => calculateTotal(rowA.original, 'paye') - calculateTotal(rowB.original, 'paye'),
        },
    ], []);

    const table = useReactTable({
        data,
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

    const renderSummaryView = () => (
        <ScrollArea className="h-[600px]">
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

    const renderDetailedView = () => (
        <div className="grid grid-cols-4 gap-2 xs:gap-1">
            <div className="col-span-1"> 
                <ScrollArea className="h-[550px] xs:h-[300px] border rounded-lg">
                    {data.map((company) => (
                        <div
                            key={company.id}
                            onClick={() => setSelectedCompany(company)}
                            className={`p-1 xs:p-0.5 text-xs cursor-pointer ${selectedCompany?.id === company.id ? 'bg-blue-500 text-white' : 'hover:bg-blue-100'}`}
                        >
                            {company.company_name}
                        </div>
                    ))}
                </ScrollArea>
            </div>
            <div className="col-span-3">
                {selectedCompany && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{selectedCompany.company_name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="all">
                                <TabsList>
                                    {['all', 'income_tax', 'vat', 'paye'].map((tab) => (
                                        <TabsTrigger key={tab} value={tab}>{tab.replace('_', ' ').toUpperCase()}</TabsTrigger>
                                    ))}
                                </TabsList>
                                <TabsContent value="all">
                                    <ScrollArea className="h-[500px]">
                                        {['income_tax', 'vat', 'paye'].map((taxType) => (
                                            <div key={taxType}>
                                                <h3 className="text-lg font-semibold mt-4 mb-2">{taxType.replace('_', ' ').toUpperCase()}</h3>
                                                {renderTaxTable(selectedCompany, taxType)}
                                            </div>
                                        ))}
                                    </ScrollArea>
                                    <div className="mt-4 text-center">
                                        <strong className="text-green-600">
                                            Overall Liability Total: <span className="text-red-500">{formatAmount(
                                                ['income_tax', 'vat', 'paye'].reduce((sum, type) => sum + calculateTotal(selectedCompany, type), 0)
                                            )}</span>
                                        </strong>
                                    </div>
                                </TabsContent>
                                {['income_tax', 'vat', 'paye'].map((taxType) => (
                                    <TabsContent key={taxType} value={taxType}>
                                        <ScrollArea className="h-[500px]">
                                            {renderTaxTable(selectedCompany, taxType)}
                                        </ScrollArea>
                                    </TabsContent>
                                ))}
                            </Tabs>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
    const renderTaxTable = (company, taxType) => {
        const total = calculateTotal(company, taxType);
        const { headers = [], rows = [] } = company.liability_data[taxType] || {};
        const nonEmptyRows = rows.filter(row => row.some(cell => cell !== ''));

        if (total === 0 || nonEmptyRows.length === 0) {
            return (
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={headers.length + 1} className="text-left uppercase font-bold text-green-500 bg-green-100">
                                No records found for {taxType.replace('_', ' ')}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            );
        }

        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>#</TableHead>
                        {headers.map((header, index) => <TableHead key={index}>{header}</TableHead>)}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {nonEmptyRows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                            <TableCell>{rowIndex + 1}</TableCell>
                            {row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}
                        </TableRow>
                    ))}
                    <TableRow className="bg-red-100">
                        <TableCell colSpan={headers.length + 1} className="text-center font-bold">
                            Liability Total: <span className="text-red-500">{formatAmount(total)}</span>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
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
                        if (col.accessorKey === 'extraction_date') return new Date(row.original.extraction_date).toLocaleString();
                        if (['income_tax', 'vat', 'paye'].includes(col.accessorKey)) {
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
                        {['income_tax', 'vat', 'paye'].map(type => (
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
                                <label htmlFor={type}>{type.toUpperCase()}</label>
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
                    <Input
                        placeholder="Search..."
                        value={globalFilter ?? ""}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="max-w-sm"
                    />
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
                <div className="flex items-center justify-between mt-4">
                    <div>
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
                            {[10, 25, 50].map((pageSize) => (
                                <SelectItem key={pageSize} value={pageSize.toString()}>
                                    Show {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    );
}