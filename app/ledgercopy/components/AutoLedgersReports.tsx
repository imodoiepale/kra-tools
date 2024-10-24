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
import { Download, Search, ArrowUpDown, Send, AlertTriangle, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function AutoLedgersReports() {
    const [data, setData] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 100,
    });
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
    const renderErrorAlert = (data) => {
        if (data.status === 'error' && data.ledger_data?.error) {
            return (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Extraction Error</AlertTitle>
                    <AlertDescription>
                        {data.ledger_data.error}
                        <br />
                        <span className="text-sm opacity-70">
                            Occurred at: {new Date(data.ledger_data.timestamp).toLocaleString()}
                        </span>
                    </AlertDescription>
                </Alert>
            );
        }
        return null;
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

    // Update the Previous Extractions Tab content
    const renderPreviousExtractionsTab = () => (
        <TabsContent value="previous">
            {extractionHistory[selectedCompany.company_name]?.length > 0 ? (
                <ScrollArea className="h-[500px]">
                    {extractionHistory[selectedCompany.company_name].map((extraction, index) => (
                        <div key={index} className="mb-8 border-b pb-4">
                            <h3 className="text-lg font-semibold mb-4">
                                Extraction from {new Date(extraction.extraction_date).toLocaleString()}
                            </h3>
                            <Tabs defaultValue="all">
                                {renderTaxTabs()}
                                {renderTaxContent(extraction)}
                                {TAX_TYPES.map((taxType) => (
                                    <TabsContent key={taxType} value={taxType}>
                                        {renderTaxTable(extraction, taxType)}
                                    </TabsContent>
                                ))}
                            </Tabs>
                        </div>
                    ))}
                </ScrollArea>
            ) : (
                <div className="text-center py-8 text-gray-500">
                    No previous extractions found
                </div>
            )}
        </TabsContent>
    );
    const renderDetailedView = () => (
        <div className="grid grid-cols-4 gap-2 xs:gap-1">
            <div className="col-span-1">
                <ScrollArea className="h-[550px] xs:h-[300px] border rounded-lg">
                    {data.map((company) => (
                        <div
                            key={company.id}
                            onClick={() => setSelectedCompany(company)}
                            className={`p-1 xs:p-0.5 text-xs cursor-pointer ${selectedCompany?.id === company.id
                                    ? 'bg-blue-500 text-white'
                                    : company.status === 'error'
                                        ? 'bg-red-100 hover:bg-red-200'
                                        : 'hover:bg-blue-100'
                                }`}
                        >
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
                    <Card>
                        <CardHeader>
                            <CardTitle>{selectedCompany.company_name}</CardTitle>
                            {renderErrorAlert(selectedCompany)}
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="current">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="current">Current Extraction</TabsTrigger>
                                    <TabsTrigger value="previous">Previous Extractions</TabsTrigger>
                                </TabsList>

                                {renderCurrentExtractionTab()}
                                {renderPreviousExtractionsTab()}
                            </Tabs>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
    const renderTaxTable = (company, taxType) => {
        // Check for error state first
        if (company.status === 'error') {
            return (
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={7} className="text-left text-red-500 bg-red-50 p-4">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <div>
                                        <div className="font-bold">Extraction Failed</div>
                                        <div className="text-sm">{company.ledger_data?.error || 'An error occurred during extraction'}</div>
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            );
        }
        if (!company?.ledger_data?.[taxType]) {
            return (
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={7} className="text-left uppercase font-bold text-yellow-500 bg-yellow-100">
                                No data available for {taxType}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            );
        }

        const { headers = [], rows = [] } = data.ledger_data[taxType];
        const total = calculateTotal(data, taxType);
        const nonEmptyRows = rows.filter(row => row.some(cell => cell !== null && cell !== ''));

        return (
            <div>
                <div className="text-sm text-gray-500 mb-2">
                    Extraction Date: {new Date(data.extraction_date || data.updated_at).toLocaleString()}
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>#</TableHead>
                            {headers.map((header, index) => (
                                <TableHead key={index}>{header}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {nonEmptyRows.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                                <TableCell>{rowIndex + 1}</TableCell>
                                {row.map((cell, cellIndex) => (
                                    <TableCell key={cellIndex}>{cell}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                        <TableRow className="bg-red-100">
                            <TableCell colSpan={headers.length + 1} className="text-center font-bold">
                                Ledger Total: <span className="text-red-500">{formatAmount(total)}</span>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
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
                          if (TAX_TYPES.includes(col.accessorKey)) {
                              return formatAmount(calculateTotal(row.original, col.accessorKey));
                          }
                          return row.original[col.accessorKey] || '';
                      });
                      sheet.addRow(rowData);
                  });
              };

              const addDetailedSheet = (wb, company, taxType, sheetIndex) => {
                  const sheetName = `${company.company_name} - ${taxType} (${sheetIndex})`;
                  const sheet = wb.addWorksheet(sheetName);
                  const data = company.ledger_data[taxType];
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
                      let sheetIndex = 1;
                      companiesToExport.forEach(company => {
                          exportOptions.taxTypes.forEach(taxType => {
                              addDetailedSheet(workbook, company, taxType, sheetIndex);
                              sheetIndex++;
                          });
                      });
                  } else if (exportOptions.exportFormat === 'separate_workbooks') {
                      for (const company of companiesToExport) {
                          const companyWorkbook = new ExcelJS.Workbook();
                          let sheetIndex = 1;
                          exportOptions.taxTypes.forEach(taxType => {
                              addDetailedSheet(companyWorkbook, company, taxType, sheetIndex);
                              sheetIndex++;
                          });
                          const buffer = await companyWorkbook.xlsx.writeBuffer();
                          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                          saveAs(blob, `Ledger_Report_${company.company_name}_${new Date().toISOString().split('T')[0]}.xlsx`);
                      }
                      return; // Exit function after saving separate workbooks
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
                <CardTitle>Ledger Extraction Reports</CardTitle>
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
                <div className="flex items-center justify-between mt-2">
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