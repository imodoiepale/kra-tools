// @ts-nocheck
"use client"

import React, { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import { Company, ChecklistItem } from './MonthlyTable.types';

interface AllDataViewProps {
  filteredClients: Company[];
  checklist: Record<string, ChecklistItem>;
  selectedDate: Date;
}

const columnHelper = createColumnHelper();

export default function AllDataView({ filteredClients, checklist, selectedDate }: AllDataViewProps) {
    const year = selectedDate.getFullYear();
    const currentMonth = new Date().getMonth();
    const startMonth = 6; // July is the 7th month (0-indexed)
    const monthsToShow = currentMonth - startMonth + 1;

    const [sorting, setSorting] = useState([]);

    const getStatusCounts = (clients: Company[], year: number, month: string) => {
        const received = clients.filter(client => checklist[client.company_name]?.file_management?.[year]?.[month]?.receivedAt).length;
        const delivered = clients.filter(client => checklist[client.company_name]?.file_management?.[year]?.[month]?.filesDelivered).length;
        const total = clients.length;
        return { 
            total,
            receivedComplete: received, 
            receivedPending: total - received,
            deliveredComplete: delivered, 
            deliveredPending: total - delivered
        };
    };

    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            header: '#',
            cell: info => info.getValue(),
        }),
        columnHelper.accessor('company_name', {
            header: 'Company',
            cell: info => info.getValue(),
        }),
        ...Array.from({ length: monthsToShow }, (_, i) => {
            const month = startMonth + i;
            const monthKey = (month + 1).toString().padStart(2, '0');
            return [
                columnHelper.accessor(row => checklist[row.company_name]?.file_management?.[year]?.[monthKey]?.receivedAt, {
                    id: `received_${monthKey}`,
                    header: 'Received',
                    cell: info => info.getValue() ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />,
                }),
                columnHelper.accessor(row => checklist[row.company_name]?.file_management?.[year]?.[monthKey]?.filesDelivered, {
                    id: `delivered_${monthKey}`,
                    header: 'Delivered',
                    cell: info => info.getValue() ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />,
                }),
            ];
        }).flat(),
    ], [year, startMonth, monthsToShow, checklist]);

    const data = useMemo(() => 
        filteredClients.map((client, index) => ({
            ...client,
            index: index + 1,
        })),
        [filteredClients]
    );

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <ScrollArea className="h-[600px]">
            <div className="overflow-x-auto">
                <Table className="border-collapse">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="sticky left-0 z-10 bg-white border">Index</TableHead>
                            <TableHead className="sticky left-0 z-10 bg-white border">Company</TableHead>
                            {Array.from({ length: monthsToShow }, (_, i) => startMonth + i).map((month, i) => (
                                <TableHead key={month} colSpan={2} className={`text-center border ${i % 2 === 0 ? 'bg-blue-100' : 'bg-green-100'}`}>
                                    {format(new Date(year, month), 'MMMM yyyy')}
                                </TableHead>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableHead className="sticky left-0 z-10 bg-white border"></TableHead>
                            <TableHead className="sticky left-0 z-10 bg-white border">
                                <div
                                    className="cursor-pointer flex items-center"
                                    onClick={() => table.getColumn('company_name')?.toggleSorting()}
                                >
                                    Status
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </div>
                            </TableHead>
                            {Array.from({ length: monthsToShow }, (_, i) => startMonth + i).map((month, i) => (
                                <React.Fragment key={month}>
                                    <TableHead className="border">Received</TableHead>
                                    <TableHead className="border">Delivered</TableHead>
                                </React.Fragment>
                            ))}
                        </TableRow>
                        {[
                            { label: 'Total', bgColor: 'bg-blue-100', getCounts: (counts) => [counts.total, counts.total] },
                            { label: 'Complete', bgColor: 'bg-green-100', getCounts: (counts) => [counts.receivedComplete, counts.deliveredComplete] },
                            { label: 'Pending', bgColor: 'bg-red-100', getCounts: (counts) => [counts.receivedPending, counts.deliveredPending] }
                        ].map(row => (
                            <TableRow key={row.label} className={`${row.bgColor}`} style={{ height: '20px' }}>
                                <TableCell className="font-bold text-center text-xs p-0 sticky left-0 z-10 border" style={{ height: '20px' }}>{row.label}</TableCell>
                                <TableCell className="text-center text-xs p-0 sticky left-0 z-10 border" style={{ height: '20px' }}></TableCell>
                                {Array.from({ length: monthsToShow }, (_, i) => {
                                    const month = (startMonth + i + 1).toString().padStart(2, '0');
                                    const counts = getStatusCounts(filteredClients, year, month);
                                    const [count1, count2] = row.getCounts(counts);
                                    return (
                                        <React.Fragment key={i}>
                                            <TableCell className="text-center text-xs p-0 border" style={{ height: '20px' }}>{count1}</TableCell>
                                            <TableCell className="text-center text-xs p-0 border" style={{ height: '20px' }}>{count2}</TableCell>
                                        </React.Fragment>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.map((row, rowIndex) => (
                            <TableRow 
                                key={row.id} 
                                className={`${rowIndex % 4 < 2 ? 'bg-blue-50' : 'bg-green-50'}`}
                            >
                                {row.getVisibleCells().map((cell, cellIndex) => (
                                    <TableCell 
                                        key={cell.id} 
                                        className={`border ${cellIndex < 2 ? 'sticky left-0 z-10' : ''} ${cellIndex % 2 === 0 ? 'bg-opacity-50' : 'bg-opacity-30'}`}
                                    >
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