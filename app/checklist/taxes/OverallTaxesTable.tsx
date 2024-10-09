// @ts-nocheck
"use client"

import React, { useMemo, useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileDown, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ExcelJS from 'exceljs';

const columnHelper = createColumnHelper();

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

export default function OverallTaxesTable({ companies }) {
    const [globalFilter, setGlobalFilter] = useState('');

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
        columnHelper.accessor('vat_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'VAT',
        }),
        columnHelper.accessor('paye_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'PAYE',
        }),
        columnHelper.accessor('rent_income_mri_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'MRI',
        }),
        columnHelper.accessor('nssf_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'NSSF',
        }),
        columnHelper.accessor('nhif_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'NHIF',
        }),
        columnHelper.accessor('housing_levy_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'Housing Levy',
        }),
        columnHelper.accessor('actions', {
            cell: info => (
                <Button variant="ghost" size="sm" onClick={() => handleEdit(info.row.original)}>
                    <Edit className="h-4 w-4" />
                </Button>
            ),
            header: 'Actions',
        }),
    ], []);

    const data = useMemo(() => 
        companies.map((company, index) => ({
            ...company,
            index: index + 1
        })),
    [companies]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
    });

    const handleEdit = (company) => {
        // Implement edit functionality
        console.log('Edit company:', company);
    };

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Overall Taxes');

        // Add headers
        worksheet.addRow(['Company Name', 'KRA PIN', 'VAT', 'PAYE', 'MRI', 'NSSF', 'NHIF', 'Housing Levy']);

        // Add data
        companies.forEach((company) => {
            worksheet.addRow([
                company.company_name,
                company.kra_pin,
                company.vat_status,
                company.paye_status,
                company.rent_income_mri_status,
                company.nssf_status,
                company.nhif_status,
                company.housing_levy_status,
            ]);
        });

        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'overall_taxes.xlsx';
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