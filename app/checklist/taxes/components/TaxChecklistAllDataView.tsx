// @ts-nocheck
"use client"

import React, { useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle } from "lucide-react";
import { format } from 'date-fns';

const columnHelper = createColumnHelper();

export default function TaxChecklistAllDataView({ companies, checklist, taxType, selectedDate }) {
    const year = selectedDate.getFullYear();
    const currentMonth = selectedDate.getMonth();
    const monthsToShow = 12;

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return format(new Date(dateString), 'dd.MM.yyyy');
    };

    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => info.getValue(),
            header: 'Index',
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
            header: 'Company Name',
        }),
        ...Array.from({ length: monthsToShow }, (_, i) => {
            const month = ((currentMonth - i + 12) % 12 + 1).toString().padStart(2, '0');
            const monthYear = format(new Date(year, parseInt(month) - 1), 'MMM yyyy');
            return [
                columnHelper.accessor(row => checklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.obligationDate, {
                    id: `obligationDate_${month}`,
                    header: `${monthYear} Obligation`,
                    cell: info => formatDate(info.getValue()),
                }),
                columnHelper.accessor(row => checklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.itaxSubmitDate, {
                    id: `itaxSubmitDate_${month}`,
                    header: `${monthYear} Submit`,
                    cell: info => formatDate(info.getValue()),
                }),
                columnHelper.accessor(row => checklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.advice, {
                    id: `advice_${month}`,
                    header: `${monthYear} Advice`,
                    cell: info => info.getValue() ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />,
                }),
            ];
        }).flat(),
    ], [year, currentMonth, checklist, taxType]);

    const data = useMemo(() =>
        companies.map((company, index) => ({
            ...company,
            index: index + 1,
        })),
        [companies]
    );

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <ScrollArea className="h-[600px]">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <TableHead key={header.id} className="font-bold text-white bg-gray-600 text-center">
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
                                    <TableCell key={cell.id} className="text-center">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </ScrollArea>
    );
}