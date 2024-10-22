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
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, ArrowUpDown, Send } from "lucide-react";
import ConfirmDocumentDialog from './ConfirmDocumentDialog';

const columnHelper = createColumnHelper();

export default function MonthlyTable({ clients = [], checklist, selectedDate, updateClientStatus }) {
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');

    const formatDateTime = (dateTimeString) => {
        if (!dateTimeString) return { date: '-', time: '-' };
        const date = new Date(dateTimeString);
        return {
            date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.'),
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        };
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
        columnHelper.accessor('kra_pin', {
            cell: info => info.getValue(),
            header: 'KRA PIN',
        }),
        columnHelper.accessor(row => checklist[row.company_name]?.file_management?.[year]?.[month]?.receivedAt, {
            id: 'receivedStatus',
            cell: info => info.getValue() ?
                <CheckCircle className="h-5 w-5 text-green-500 inline" /> :
                <ConfirmDocumentDialog
                    companyName={info.row.original.company_name}
                    year={year}
                    month={month}
                    kraPin={info.row.original.kra_pin}
                    onConfirm={(status, kraPin) => updateClientStatus(info.row.original.company_name, year, month, status, kraPin)}
                />,
            header: 'Received Status',
        }),
        columnHelper.accessor(row => formatDateTime(checklist[row.company_name]?.file_management?.[year]?.[month]?.receivedAt).date, {
            id: 'receivedDate',
            cell: info => info.getValue(),
            header: 'Received Date',
        }),
        columnHelper.accessor(row => formatDateTime(checklist[row.company_name]?.file_management?.[year]?.[month]?.receivedAt).time, {
            id: 'receivedTime',
            cell: info => info.getValue(),
            header: 'Received Time',
        }),
        columnHelper.accessor(row => checklist[row.company_name]?.file_management?.[year]?.[month]?.filesDelivered, {
            id: 'deliveredStatus',
            cell: info => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateClientStatus(
                        info.row.original.company_name,
                        year,
                        month,
                        {
                            filesDelivered: !info.getValue(),
                            deliveredAt: new Date().toISOString()
                        },
                        info.row.original.kra_pin
                    )}
                >
                    {info.getValue() ?
                        <CheckCircle className="h-5 w-5 text-green-500" /> :
                        <XCircle className="h-5 w-5 text-red-500" />
                    }
                </Button>
            ),
            header: 'Delivered Status',
        }),
        columnHelper.accessor(row => formatDateTime(checklist[row.company_name]?.file_management?.[year]?.[month]?.deliveredAt).date, {
            id: 'deliveredDate',
            cell: info => info.getValue(),
            header: 'Delivered Date',
        }),
        columnHelper.accessor(row => formatDateTime(checklist[row.company_name]?.file_management?.[year]?.[month]?.deliveredAt).time, {
            id: 'deliveredTime',
            cell: info => info.getValue(),
            header: 'Delivered Time',
        }),
        columnHelper.accessor('actions', {
            cell: info => (
                <Button variant="outline" size="sm" onClick={() => sendReminder(info.row.original.company_name)}>
                    <Send className="h-3 w-3 mr-1" />
                    Remind
                </Button>
            ),
            header: 'Actions',
        }),
    ], [year, month, checklist, updateClientStatus]);

    const data = useMemo(() =>
        clients.map((client, index) => ({
            ...client,
            index: index + 1,
        })),
        [clients]
    );

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const getStatusCounts = () => {
        const total = clients.length;
        const receivedCount = clients.filter(client =>
            checklist[client.company_name]?.file_management?.[year]?.[month]?.receivedAt
        ).length;
        const deliveredCount = clients.filter(client =>
            checklist[client.company_name]?.file_management?.[year]?.[month]?.filesDelivered
        ).length;
        return {
            total,
            receivedComplete: receivedCount,
            receivedPending: total - receivedCount,
            deliveredComplete: deliveredCount,
            deliveredPending: total - deliveredCount
        };
    };

    const statusCounts = getStatusCounts();

    if (clients.length === 0) {
        return <div>No clients available.</div>;
    }

    return (
        <ScrollArea className="h-[600px]">
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
                    {[
                        { label: 'Total', bgColor: 'bg-blue-100', counts: [statusCounts.total, statusCounts.total] },
                        { label: 'Complete', bgColor: 'bg-green-100', counts: [statusCounts.receivedComplete, statusCounts.deliveredComplete] },
                        { label: 'Pending', bgColor: 'bg-red-100', counts: [statusCounts.receivedPending, statusCounts.deliveredPending] }
                    ].map(row => (
                        <TableRow key={row.label} className={`${row.bgColor}`} style={{ height: '20px' }}>
                            <TableCell className="font-bold text-center text-xs p-0" style={{ height: '20px' }}>{row.label}</TableCell>
                            <TableCell className="text-center text-xs p-0" style={{ height: '20px' }}></TableCell>
                            <TableCell className="text-center text-xs p-0" style={{ height: '20px' }}></TableCell>
                            <TableCell className="text-center text-xs p-0" style={{ height: '20px' }}>{row.counts[0]}</TableCell>
                            <TableCell className="text-center text-xs p-0" style={{ height: '20px' }}></TableCell>
                            <TableCell className="text-center text-xs p-0" style={{ height: '20px' }}></TableCell>
                            <TableCell className="text-center text-xs p-0" style={{ height: '20px' }}>{row.counts[1]}</TableCell>
                            <TableCell className="text-center text-xs p-0" style={{ height: '20px' }}></TableCell>
                            <TableCell className="text-center text-xs p-0" style={{ height: '20px' }}></TableCell>
                            <TableCell className="text-center text-xs p-0" style={{ height: '20px' }}></TableCell>
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
        </ScrollArea>
    );
}