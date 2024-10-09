// @ts-nocheck
"use client"

import React, { useMemo, useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getGroupedRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ExcelJS from 'exceljs';

const columnHelper = createColumnHelper();

const formatDate = (dateString) => {
    if (!dateString || dateString === "No obligation") return dateString;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
};

const TaxStatus = ({ status }) => {
    if (!status || status === "No obligation") {
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">MISSING</Badge>;
    }
    switch (status.toLowerCase()) {
        case 'registered':
            return <Badge className="bg-green-500">Registered</Badge>;
        case 'cancelled':
            return <Badge className="bg-red-500">Cancelled</Badge>;
        case 'dormant':
            return <Badge className="bg-blue-500">Dormant</Badge>;
        default:
            return <span>{status}</span>;
    }
};

export default function TaxTypeTable({ companies, taxType, statusField, fromField, toField }) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => info.getValue(),
            header: '#',
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
            header: 'Company Name',
        }),
        columnHelper.accessor('kra_pin', {
            cell: info => info.getValue(),
            header: 'KRA PIN',
        }),
        columnHelper.accessor(statusField, {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'Status',
        }),
        columnHelper.accessor(fromField, {
            cell: info => formatDate(info.getValue()),
            header: 'Effective From',
        }),
        columnHelper.accessor(toField, {
            cell: info => formatDate(info.getValue()),
            header: 'Effective To',
        }),
        columnHelper.accessor('last_checked_at', {
            cell: info => {
                const date = new Date(info.getValue());
                return (
                    <div>
                        <div>{formatDate(info.getValue())}</div>
                        <div>{date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    </div>
                );
            },
            header: 'Last Checked',
        }),
        columnHelper.accessor('actions', {
            cell: info => (
                <Button variant="ghost" size="sm" onClick={() => handleEdit(info.row.original)}>
                    <Edit className="h-4 w-4" />
                </Button>
            ),
            header: 'Actions',
        }),
    ], [statusField, fromField, toField]);

    const filteredData = useMemo(() => {
        return companies.filter(company => {
            if (statusFilter === 'all') return true;
            return company[statusField] === statusFilter;
        }).map((company, index) => ({
            ...company,
            index: index + 1
        }));
    }, [companies, statusFilter, statusField]);

    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getGroupedRowModel: getGroupedRowModel(),
        state: {
            globalFilter,
            grouping: [statusField],
        },
        onGlobalFilterChange: setGlobalFilter,
    });

    const handleEdit = (company) => {
        // Implement edit functionality
        console.log('Edit company:', company);
    };

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${taxType.toUpperCase()} Tax Data`);

        // Add headers
        worksheet.addRow(['Company Name', 'KRA PIN', 'Status', 'Effective From', 'Effective To', 'Last Checked']);

        // Add data
        filteredData.forEach((company) => {
            worksheet.addRow([
                company.company_name,
                company.kra_pin,
                company[statusField],
                formatDate(company[fromField]),
                formatDate(company[toField]),
                formatDate(company.last_checked_at),
            ]);
        });

        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${taxType}_tax_data.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <Tabs defaultValue="all" onValueChange={setStatusFilter}>
                <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="Registered">Registered</TabsTrigger>
                    <TabsTrigger value="Cancelled">Cancelled</TabsTrigger>
                    <TabsTrigger value="Dormant">Dormant</TabsTrigger>
                </TabsList>
            </Tabs>
            <div className="flex justify-between items-center my-4">
                <Input
                    placeholder="Search companies..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="max-w-sm"
                />
                <Button onClick={exportToExcel}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export to Excel
                </Button>
            </div>
            <ScrollArea className="h-[600px]">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <TableHead 
                                        key={header.id} 
                                        className="font-bold text-white bg-gray-600"
                                    >
                                        {header.isPlaceholder ? null : (
                                            <div
                                                {...{
                                                    className: header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                                                    onClick: header.column.getToggleSortingHandler(),
                                                }}
                                            >
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {{
                                                    asc: ' 🔼',
                                                    desc: ' 🔽',
                                                }[header.column.getIsSorted()] ?? null}
                                            </div>
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.map((row, rowIndex) => {
                            const isGroupRow = row.depth === 0;
                            return (
                                <React.Fragment key={row.id}>
                                    {isGroupRow && rowIndex > 0 && (
                                        <TableRow>
                                            <TableCell colSpan={columns.length} className="bg-yellow-100 h-2"></TableCell>
                                        </TableRow>
                                    )}
                                    <TableRow className={isGroupRow ? 'bg-gray-100' : row.index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                                        {row.getVisibleCells().map(cell => (
                                            <TableCell key={cell.id}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
    );
}