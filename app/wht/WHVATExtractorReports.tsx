// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Search, Download, X } from "lucide-react";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function WHVATExtractorReports() {
    const [view, setView] = useState('summary');
    const [companies, setCompanies] = useState([]);
    const [allCompanyData, setAllCompanyData] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [companyData, setCompanyData] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('allData');
    const [sortColumn, setSortColumn] = useState('');
    const [sortDirection, setSortDirection] = useState('asc');
    const [startMonth, setStartMonth] = useState('');
    const [startYear, setStartYear] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [endYear, setEndYear] = useState('');
    const [filteredData, setFilteredData] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [showAllData, setShowAllData] = useState(false);
    const [summarySearch, setSummarySearch] = useState('');
    const [summarySort, setSummarySort] = useState({ column: 'company', direction: 'asc' });

    useEffect(() => {
        fetchCompanies();
        fetchAllCompanyData();
    }, []);

    useEffect(() => {
        if (selectedCompany) {
            const data = allCompanyData.find(c => c.company_name === selectedCompany);
            setCompanyData(data?.extraction_data || null);
            filterData(data?.extraction_data);
        }
    }, [selectedCompany, allCompanyData, activeTab, startMonth, startYear, endMonth, endYear, searchTerm, selectedMonth, selectedYear, showAllData]);

    useEffect(() => {
        if (selectedCompany) {
            const data = allCompanyData.find(c => c.company_name === selectedCompany);
            setCompanyData(data?.extraction_data || null);
            setActiveTab('allData');
        }
    }, [selectedCompany, allCompanyData]);

    const fetchCompanies = async () => {
        try {
            const { data, error } = await supabase
                .from('whvat_extractions')
                .select('company_name')
                .order('company_name');

            if (error) throw error;
            setCompanies(data);
        } catch (error) {
            console.error('Error fetching companies:', error);
        }
    };

    const fetchAllCompanyData = async () => {
        try {
            const { data, error } = await supabase
                .from('whvat_extractions')
                .select('*');

            if (error) throw error;
            setAllCompanyData(data);
        } catch (error) {
            console.error('Error fetching all company data:', error);
        }
    };

    const calculateTotal = (monthData) => {
        if (!monthData || !monthData.tableData) return 0;
        return monthData.tableData.reduce((sum, row) => sum + parseFloat(row[8] || 0), 0);
    };

    const calculateOverallTotal = (data) => {
        if (!data) return 0;
        return Object.values(data).reduce((sum, monthData) => sum + calculateTotal(monthData), 0);
    };

    const filterData = (data) => {
        if (!data) return;
        let filtered = { ...data };

        if (!showAllData) {
            // Filter by date range
            if (startMonth && startYear && endMonth && endYear) {
                filtered = Object.fromEntries(
                    Object.entries(filtered).filter(([key]) => {
                        const [year, month] = key.split('-');
                        const startDate = new Date(startYear, startMonth - 1);
                        const endDate = new Date(endYear, endMonth - 1);
                        const currentDate = new Date(year, parseInt(month) - 1);
                        return currentDate >= startDate && currentDate <= endDate;
                    })
                );
            }

            // Filter by selected month and year
            if (activeTab === 'monthWise' && selectedMonth && selectedYear) {
                const selectedKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
                filtered = { [selectedKey]: filtered[selectedKey] };
            }
        }

        // Apply search term
        if (searchTerm) {
            Object.keys(filtered).forEach(key => {
                filtered[key].tableData = filtered[key].tableData.filter(row =>
                    row.some(cell => cell.toString().toLowerCase().includes(searchTerm.toLowerCase()))
                );
            });
        }

        // Sort the filtered data by date (latest first)
        const sortedFiltered = Object.fromEntries(
            Object.entries(filtered).sort((a, b) => new Date(b[0]) - new Date(a[0]))
        );

        setFilteredData(sortedFiltered);
    };

    const clearFilters = () => {
        setStartMonth('');
        setStartYear('');
        setEndMonth('');
        setEndYear('');
        setSearchTerm('');
        setSelectedMonth('');
        setSelectedYear('');
        setShowAllData(false);
        filterData(companyData);
    };

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const handleSummarySort = (column) => {
        setSummarySort((prev) => {
            if (prev.column === column) {
                return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { column, direction: 'asc' };
        });
    };

    const formatAmount = (amount) => {
        return `KSH ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    };

    const renderAllDataTable = () => {
        if (!filteredData) return null;

        const headers = [
            'Sr.No.', 'Withholder PIN', 'Withholdee PIN', 'Withholder Name',
            'Pay Point Name', 'Status', 'Invoice No', 'Certificate Date',
            'VAT Withholding Amount', 'WHT Certificate No'
        ];

        const allData = Object.entries(filteredData).flatMap(([month, data]) => {
            if (!data.tableData || data.tableData.length === 0) {
                const [year, monthNum] = month.split('-');
                const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long' });
                return [['', '', '', '', '', '', '', '', '', '', month, 0, `No records found for ${monthName} ${year}`]];
            }
            const monthData = data.tableData.map(row => [...row, month]);
            const total = calculateTotal(data);
            return [
                ...monthData,
                ['', '', '', '', '', '', '', '', '', '', month, total]
            ];
        });

        const sortedData = allData.sort((a, b) => new Date(b[10]) - new Date(a[10]));

        return (
            <ScrollArea className="h-[calc(100vh-20rem)] overflow-auto">
                <Table className="w-full text-xs">
                    <TableHeader className="text-xs">
                        <TableRow>
                            {headers.map((header, index) => (
                                <TableHead key={index} onClick={() => handleSort(header)} className="px-1 py-0.5 border-r border-gray-300 text-xs">
                                    {header} <ArrowUpDown className="inline h-2 w-2" />
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                        {sortedData.map((row, rowIndex) => {
                            if (row[10] && row[11] !== undefined) {
                                // This is a total row
                                const [year, monthNum] = row[10].split('-');
                                const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long' });
                                return (
                                    <TableRow key={rowIndex} className="bg-green-100">
                                        <TableCell colSpan={10} className="text-center font-bold uppercase">
                                            {row[12] ? (
                                                <span className="text-red-600">{row[12]}</span>
                                            ) : (
                                                <>
                                                    Totals for <span className="text-blue-700 font-extrabold">{monthName} {year}</span> = {formatAmount(row[11])}
                                                </>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            } else {
                                // This is a data row
                                return (
                                    <TableRow key={rowIndex} style={{height: '24px'}}>
                                        {row.slice(0, 10).map((cell, cellIndex) => (
                                            <TableCell key={cellIndex} className="px-1 py-0.5">
                                                {cellIndex === 8 && !isNaN(parseFloat(cell)) ? formatAmount(parseFloat(cell)) : cell}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            }
                        })}
                    </TableBody>
                </Table>
            </ScrollArea>
        );
    };

    const renderMonthTable = (monthData, monthKey) => {
        if (!monthData || !monthData.tableData || monthData.tableData.length === 0) {
            const [year, monthNum] = monthKey.split('-');
            const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long' });
            return (
                <Table className="text-xs">
                    <TableBody className="text-xs">
                        <TableRow>
                            <TableCell colSpan={10} className="text-left font-bold uppercase text-red-600 text-xs">
                                No records found for {monthName} {year}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            );
        }

        const total = calculateTotal(monthData);
        const headers = [
            'Sr.No.', 'Withholder PIN', 'Withholdee PIN', 'Withholder Name',
            'Pay Point Name', 'Status', 'Invoice No', 'Certificate Date',
            'VAT Withholding Amount', 'WHT Certificate No'
        ];

        const sortedData = [...monthData.tableData].sort((a, b) => {
            const index = headers.indexOf(sortColumn);
            if (index === -1) return 0;
            const aVal = a[index], bVal = b[index];
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return (
            <div className="mb-8">
                <div className="mb-4 text-sm font-bold text-green-600">
                    Total for this month: {formatAmount(total)}
                </div>
                <Table className="w-full text-xs">
                    <TableHeader className="text-xs">
                        <TableRow>
                            {headers.map((header, index) => (
                                <TableHead key={index} onClick={() => handleSort(header)} className="px-1 py-0.5 border-r border-gray-300 text-xs">
                                    {header} <ArrowUpDown className="inline h-2 w-2" />
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                        {sortedData.map((row, rowIndex) => (
                            <TableRow key={rowIndex} style={{height: '24px'}}>
                                {row.map((cell, cellIndex) => (
                                    <TableCell key={cellIndex} className="px-1 py-0.5">
                                        {cellIndex === 8 ? formatAmount(parseFloat(cell)) : cell}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };

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

    const getFilteredSortedSummary = () => {
        let data = allCompanyData.map((company) => {
            const extractionDates = company.extraction_data ? Object.keys(company.extraction_data) : [];
            const latestExtractionDate = extractionDates.length > 0 ?
                new Date(Math.max(...extractionDates.map(date => new Date(company.extraction_data[date].extractionDate)))).toLocaleDateString() :
                'N/A';
            const totalAmount = calculateOverallTotal(company.extraction_data);
            return {
                ...company,
                latestExtractionDate,
                numberOfExtractions: extractionDates.length,
                totalAmount: formatAmount(totalAmount),
                totalAmountRaw: totalAmount,
            };
        });
        if (summarySearch) {
            data = data.filter((company) =>
                company.company_name.toLowerCase().includes(summarySearch.toLowerCase())
            );
        }
        data.sort((a, b) => {
            const { column, direction } = summarySort;
            let aVal, bVal;
            switch (column) {
                case 'company':
                    aVal = a.company_name.toLowerCase();
                    bVal = b.company_name.toLowerCase();
                    break;
                case 'latestExtractionDate':
                    aVal = new Date(a.latestExtractionDate);
                    bVal = new Date(b.latestExtractionDate);
                    break;
                case 'numberOfExtractions':
                    aVal = a.numberOfExtractions;
                    bVal = b.numberOfExtractions;
                    break;
                case 'totalAmount':
                    aVal = a.totalAmountRaw;
                    bVal = b.totalAmountRaw;
                    break;
                default:
                    aVal = a.company_name.toLowerCase();
                    bVal = b.company_name.toLowerCase();
            }
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        return data;
    };

    const renderDetailedView = () => (
        <div className="grid grid-cols-4 gap-4 h-[600px]" >
            <div className="col-span-1">
                <ScrollArea className="h-[600px]">
                    {companies.map((company) => (
                        <div
                            key={company.company_name}
                            onClick={() => setSelectedCompany(company.company_name)}
                            className={`p-2 cursor-pointer transition-colors duration-200 text-xs ${selectedCompany === company.company_name
                                    ? 'bg-blue-500 text-white font-bold'
                                    : 'hover:bg-blue-100'
                                }`}
                        >
                            {company.company_name}
                        </div>
                    ))}
                </ScrollArea>
            </div>
            <div className="col-span-3">
                {companyData && (
                    <>
                        <div className="mb-4 flex justify-between items-center">
                            <strong className="text-green-600">Overall Total: {formatAmount(calculateOverallTotal(companyData))}</strong>
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-1/3"
                            />
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button><Download className="mr-2 h-4 w-4" /> Export</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Export Data</DialogTitle>
                                    </DialogHeader>
                                    <div className="flex flex-col gap-4">
                                        <Button onClick={() => exportToExcel('currentMonth')}>Export Current Month</Button>
                                        <Button onClick={() => exportToExcel('dateRange')}>Export Date Range</Button>
                                        <Button onClick={() => exportToExcel('all')}>Export All Data</Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList>
                                <TabsTrigger value="allData">All Data</TabsTrigger>
                                <TabsTrigger value="monthWise">Month Wise</TabsTrigger>
                                <TabsTrigger value="totals">Totals</TabsTrigger>
                            </TabsList>
                            <TabsContent value="allData">
                                <div className="mb-4 flex gap-2 items-center flex-wrap">
                                    <Select onValueChange={setStartMonth} value={startMonth}>
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue placeholder="Start Month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                                <SelectItem key={month} value={String(month)}>{new Date(2000, month - 1, 1).toLocaleString('default', { month: 'short' })}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select onValueChange={setStartYear} value={startYear}>
                                        <SelectTrigger className="w-[100px]">
                                            <SelectValue placeholder="Start Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: new Date().getFullYear() - 2013 + 1 }, (_, i) => 2013 + i).map(year => (
                                                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select onValueChange={setEndMonth} value={endMonth}>
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue placeholder="End Month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                                <SelectItem key={month} value={String(month)}>{new Date(2000, month - 1, 1).toLocaleString('default', { month: 'short' })}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select onValueChange={setEndYear} value={endYear}>
                                        <SelectTrigger className="w-[100px]">
                                            <SelectValue placeholder="End Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: new Date().getFullYear() - 2013 + 1 }, (_, i) => 2013 + i).map(year => (
                                                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={() => filterData(companyData)} className="whitespace-nowrap">Apply Filter</Button>
                                    <Button onClick={clearFilters} variant="outline" className="whitespace-nowrap"><X className="mr-2 h-4 w-4" />Clear Filters</Button>
                                    <Button onClick={() => setShowAllData(!showAllData)} variant="outline" className="whitespace-nowrap">
                                        {showAllData ? "Hide All Data" : "Show All Data"}
                                    </Button>
                                </div>
                                {renderAllDataTable()}
                            </TabsContent>
                            <TabsContent value="monthWise">
                                <div className="mb-4 flex gap-2 items-center">
                                    <Select onValueChange={setSelectedMonth} value={selectedMonth}>
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue placeholder="Select Month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                                <SelectItem key={month} value={String(month)}>{new Date(2000, month - 1, 1).toLocaleString('default', { month: 'short' })}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select onValueChange={setSelectedYear} value={selectedYear}>
                                        <SelectTrigger className="w-[100px]">
                                            <SelectValue placeholder="Select Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: new Date().getFullYear() - 2013 + 1 }, (_, i) => 2013 + i).map(year => (
                                                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={() => filterData(companyData)} className="whitespace-nowrap">Apply Filter</Button>
                                    <Button onClick={clearFilters} variant="outline" className="whitespace-nowrap"><X className="mr-2 h-4 w-4" />Clear Filters</Button>
                                    <Button onClick={() => setShowAllData(!showAllData)} variant="outline" className="whitespace-nowrap">
                                        {showAllData ? "Hide All Data" : "Show All Data"}
                                    </Button>
                                </div>
                                <ScrollArea className="h-[calc(100vh-20rem)] overflow-auto">
                                    {filteredData && Object.entries(filteredData).map(([month, data]) => (
                                        <div key={month}>
                                            <h3 className="text-lg font-bold mb-2">{month.split('-').reverse().join('-')}</h3>
                                            {renderMonthTable(data, month)}
                                        </div>
                                    ))}
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="totals">
                                <ScrollArea className="h-[calc(100vh-20rem)] overflow-auto">
                                    <Table>
                                        <TableHeader className="text-xs">
                                            <TableRow>
                                                <TableHead>Month</TableHead>
                                                <TableHead>Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs">
                                            {filteredData && Object.entries(filteredData).map(([month, data]) => {
                                                const [year, monthNum] = month.split('-');
                                                const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long' });
                                                const total = calculateTotal(data);
                                                return (
                                                    <TableRow key={month}>
                                                        <TableCell className="border-r border-gray-300 py-0.5 px-2 text-xs whitespace-nowrap">{`${monthName} ${year}`}</TableCell>
                                                        <TableCell className="border-r border-gray-300 py-0.5 px-2 text-xs whitespace-nowrap">
                                                            {data.tableData && data.tableData.length > 0
                                                                ? <span className="font-bold text-green-600">{formatAmount(total)}</span>
                                                                : (
                                                                    <span className="font-bold text-red-600">
                                                                        No records found
                                                                    </span>
                                                                )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </div>
        </div>
    );

    const renderSummaryView = () => (
        <>
            <div className="flex flex-wrap gap-2 items-center mb-2">
                <Input
                    placeholder="Search companies..."
                    value={summarySearch}
                    onChange={e => setSummarySearch(e.target.value)}
                    className="w-64"
                />
                <Button onClick={exportSummaryToExcel} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" /> Export to Excel
                </Button>
                <div className="ml-auto font-bold text-blue-700">
                    Total Companies: {getFilteredSortedSummary().length}
                </div>
            </div>
            <ScrollArea className="h-[650px] overflow-auto" style={{overflowY: 'auto'}}>
                <Table>
                    <TableHeader className="text-xs">
                        <TableRow>
                            <TableHead className="font-bold text-center border-r border-gray-300 text-xs py-1 px-2">#</TableHead>
                            <TableHead onClick={() => handleSummarySort('company')} className="cursor-pointer select-none border-r border-gray-300 text-xs py-1 px-2">
                                Company <ArrowUpDown className="ml-2 h-4 w-4" />
                            </TableHead>
                            <TableHead onClick={() => handleSummarySort('latestExtractionDate')} className="cursor-pointer select-none border-r border-gray-300 text-xs py-1 px-2">
                                Latest Extraction Date <ArrowUpDown className="ml-2 h-4 w-4" />
                            </TableHead>
                            <TableHead onClick={() => handleSummarySort('numberOfExtractions')} className="cursor-pointer select-none border-r border-gray-300 text-xs py-1 px-2">
                                Number of Extractions <ArrowUpDown className="ml-2 h-4 w-4" />
                            </TableHead>
                            <TableHead onClick={() => handleSummarySort('totalAmount')} className="cursor-pointer select-none border-r border-gray-300 text-xs py-1 px-2">
                                Total Amount <ArrowUpDown className="ml-2 h-4 w-4" />
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                        {getFilteredSortedSummary().map((company, index) => (
                            <TableRow key={company.company_name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <TableCell className="font-bold text-center border-r border-gray-300 py-0.5 px-2 text-xs">{index + 1}</TableCell>
                                <TableCell className="border-r border-gray-300 py-0.5 px-2 text-xs whitespace-nowrap">{company.company_name}</TableCell>
                                <TableCell className="border-r border-gray-300 py-0.5 px-2 text-xs whitespace-nowrap">{company.latestExtractionDate}</TableCell>
                                <TableCell className="border-r border-gray-300 py-0.5 px-2 text-xs whitespace-nowrap">{company.numberOfExtractions}</TableCell>
                                <TableCell className="font-bold text-green-600 border-r border-gray-300 py-0.5 px-2 text-xs">{company.totalAmount}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </>
    );

    return (
        <Card className="w-full ">
            <CardHeader>
                <CardTitle className="text-blue-700">WH VAT Extractor Reports</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={view} onValueChange={setView} className="mb-2">
                    <TabsList>
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="detailed">Detailed</TabsTrigger>
                    </TabsList>
                </Tabs>
                {view === 'summary' ? renderSummaryView() : renderDetailedView()}
            </CardContent>
        </Card>
    );
}