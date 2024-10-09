// @ts-nocheck
"use client"

import React, { useMemo, useEffect } from 'react';
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
import { CheckCircle, XCircle } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'react-hot-toast';

const columnHelper = createColumnHelper();

const UpdateDialog = ({ title, initialValue, onUpdate, type }) => {
    const [value, setValue] = React.useState(initialValue);

    const handleUpdate = () => {
        onUpdate(value);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    {type === 'advice' ? (
                        initialValue ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                        initialValue || <XCircle className="h-5 w-5 text-red-500" />
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    {type === 'date' ? (
                        <Input
                            type="date"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    ) : type === 'amount' ? (
                        <Input
                            type="number"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Enter amount"
                        />
                    ) : type === 'advice' ? (
                        <Textarea
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Enter advice"
                            rows={4}
                        />
                    ) : (
                        <Input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Enter value"
                        />
                    )}
                    <Button onClick={handleUpdate}>Update</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const formatDate = (dateString) => {
    if (!dateString || dateString === "No obligation") return dateString;

    let date;
    if (typeof dateString === 'string') {
        const formats = [
            /^\d{4}-\d{2}-\d{2}$/,
            /^\d{2}\.\d{2}\.\d{4}$/,
            /^\d{2}\/\d{2}\/\d{4}$/,
            /^\d{4}\/\d{2}\/\d{2}$/,
            /^\d{2}-\d{2}-\d{4}$/,
        ];

        for (const format of formats) {
            if (format.test(dateString)) {
                const parts = dateString.split(/[-./]/);
                const [year, month, day] = format === formats[0] || format === formats[3]
                    ? parts
                    : parts.reverse();
                date = new Date(year, month - 1, day);
                break;
            }
        }

        if (!date) {
            date = new Date(dateString);
        }
    } else if (dateString instanceof Date) {
        date = dateString;
    } else {
        return "Invalid date";
    }

    if (isNaN(date.getTime())) {
        return "Invalid date";
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
};


export default function TaxChecklistMonthlyView({ companies, checklist, taxType, selectedDate, updateTaxStatus, refetchData }) {
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');

    const handleUpdate = async (companyName, year, month, status) => {
        try {
            await updateTaxStatus(companyName, year, month, status);
            await refetchData();  // Refetch data after successful update
            toast.success('Updated successfully');
        } catch (error) {
            console.error('Error updating:', error);
            toast.error('Failed to update');
        }
    };

    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => info.getValue(),
            header: 'Index',
            size: 50,
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
            header: 'Company Name',
            size: 200,
        }),
        columnHelper.accessor(row => {
            const taxData = checklist[row.company_name]?.taxes?.[taxType];
            return row[`${taxType}_effective_from`] || (taxData && taxData[year] && taxData[year][month] && taxData[year][month].obligationDate);
        }, {
            id: 'obligationDate',
            cell: info => {
                const value = info.getValue();
                return value ? (
                    formatDate(value)
                ) : (
                    <UpdateDialog
                        title="Update Obligation Date"
                        initialValue=""
                        onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { obligationDate: newValue })}
                        type="date"
                    >
                        <XCircle className="h-5 w-5 text-red-500" />
                    </UpdateDialog>
                );
            },
            header: 'Obligation Date',
            size: 120,
        }),
        columnHelper.accessor('separator1', {
            cell: () => null,
            header: '',
            size: 10,
        }),
        columnHelper.accessor(row => checklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.itaxSubmitDate, {
            id: 'itaxSubmitDate',
            cell: info => {
                const value = info.getValue();
                return value ? (
                    formatDate(value)
                ) : (
                    <UpdateDialog
                        title="Update ITAX Submit Date"
                        initialValue=""
                        onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { itaxSubmitDate: newValue })}
                        type="date"
                    >
                        <XCircle className="h-5 w-5 text-red-500" />
                    </UpdateDialog>
                );
            },
            header: 'ITAX Submission Date',
            size: 120,
        }),
        columnHelper.accessor(row => checklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.submittedBy, {
            id: 'submittedBy',
            cell: info => {
                const value = info.getValue();
                return value ? value : (
                    <UpdateDialog
                        title="Update Submitted By"
                        initialValue=""
                        onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { submittedBy: newValue })}
                        type="text"
                    >
                        <XCircle className="h-5 w-5 text-red-500" />
                    </UpdateDialog>
                );
            },
            header: 'Submitted By',
            size: 120,
        }),
        columnHelper.accessor('separator2', {
            cell: () => null,
            header: '',
            size: 10,
        }),
        columnHelper.accessor(row => checklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.clientPaymentDate, {
            id: 'clientPaymentDate',
            cell: info => {
                const value = info.getValue();
                return value ? (
                    formatDate(value)
                ) : (
                    <UpdateDialog
                        title="Update Client Payment Date"
                        initialValue=""
                        onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { clientPaymentDate: newValue })}
                        type="date"
                    >
                        <XCircle className="h-5 w-5 text-red-500" />
                    </UpdateDialog>
                );
            },
            header: 'Client Payment Date',
            size: 120,
        }),
        columnHelper.accessor(row => checklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.payeAmount, {
            id: 'payeAmount',
            cell: info => {
                const value = info.getValue();
                return value ? (
                    `KES ${parseFloat(value).toFixed(2)}`
                ) : (
                    <UpdateDialog
                        title="Update PAYE Amount"
                        initialValue=""
                        onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { payeAmount: parseFloat(newValue) })}
                        type="amount"
                    >
                        <XCircle className="h-5 w-5 text-red-500" />
                    </UpdateDialog>
                );
            },
            header: 'PAYE Amount',
            size: 120,
        }),
        columnHelper.accessor(row => checklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.advice, {
            id: 'advice',
            cell: info => {
                const value = info.getValue();
                return (
                    <div className="max-w-xs truncate hover:whitespace-normal">
                        {value ? value : (
                            <UpdateDialog
                                title="Advice"
                                initialValue=""
                                onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { advice: newValue })}
                                type="advice"
                            >
                                <XCircle className="h-5 w-5 text-red-500" />
                            </UpdateDialog>
                        )}
                    </div>
                );
            },
            header: 'Advice',
            size: 200,
        }),
    ], [year, month, checklist, taxType, handleUpdate]);

    const data = useMemo(() =>
        companies.map((company, index) => ({
            ...company,
            index: index + 1,
            checklistData: checklist[company.company_name]?.taxes?.[taxType]?.[year]?.[month] || {}
        })),
        [companies, checklist, taxType, year, month]
    );

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });



    return (
        <ScrollArea className="h-[600px]">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map(headerGroup => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                                <TableHead
                                    key={header.id}
                                    className={`font-bold text-white bg-gray-600 text-left ${header.id === 'separator' ? 'bg-gray-200' : ''}`}
                                    style={{ width: header.getSize() }}
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
                                <TableCell
                                    key={cell.id}
                                    className={`text-left ${cell.column.id === 'separator' ? 'bg-gray-200' : ''}`}
                                    style={{ width: cell.column.getSize() }}
                                >
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