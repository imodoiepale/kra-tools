
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    return <Badge className="bg-green-500">Registered</Badge>;
};

export default function VATTable({ companies }) {
    const [globalFilter, setGlobalFilter] = useState('');

    const filteredCompanies = useMemo(() => {
        return companies.filter(company => company.vat_status?.toLowerCase() === 'registered')
            .map((company, index) => ({ ...company, index: index + 1 }));
    }, [companies]);

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
            header: 'Status',
        }),
        columnHelper.accessor('vat_effective_from', {
            cell: info => formatDate(info.getValue()),
            header: 'Effective From',
        }),
        columnHelper.accessor('vat_effective_to', {
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
    ], []);

    const table = useReactTable({
        data: filteredCompanies,
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
        console.log('Edit company:', company);
    };

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('VAT Tax Data');

        worksheet.addRow(['Company Name', 'KRA PIN', 'Status', 'Effective From', 'Effective To', 'Last Checked']);

        filteredCompanies.forEach((company) => {
            worksheet.addRow([
                company.company_name,
                company.kra_pin,
                company.vat_status,
                formatDate(company.vat_effective_from),
                formatDate(company.vat_effective_to),
                formatDate(company.last_checked_at),
            ]);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'vat_tax_data.xlsx';
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
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
                        {table.getRowModel().rows.map(row => (
                            <TableRow key={row.id} className={row.index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                                {row.getVisibleCells().map(cell => (
                                    <TableCell key={cell.id}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
    );
}