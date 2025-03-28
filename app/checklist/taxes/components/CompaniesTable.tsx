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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, isValid, parse } from 'date-fns';
import { ArrowUpDown, FileDown } from "lucide-react";
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { Switch } from "@/components/ui/switch";

const columnHelper = createColumnHelper();

const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        // Try parsing as ISO string first
        let date = new Date(dateString);
        if (isValid(date)) {
            return format(date, 'dd.MM.yyyy');
        }

        // If that fails, try other common formats
        const formats = [
            'yyyy-MM-dd',
            'dd/MM/yyyy',
            'MM/dd/yyyy',
            'dd.MM.yyyy',
            'yyyy/MM/dd',
        ];

        for (const dateFormat of formats) {
            date = parse(dateString, dateFormat, new Date());
            if (isValid(date)) {
                return format(date, 'dd/MM/yyyy');
            }
        }

        // If all parsing attempts fail, return the original string
        return dateString;
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
};

const formatTime = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isValid(date)) {
            return format(date, 'HH:mm');
        }
        // If parsing fails, try to extract time from the string
        const timeMatch = dateString.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
            const [hours, minutes] = timeMatch.slice(1);
            return `${hours.padStart(2, '0')}:${minutes}`;
        }
        return dateString;
    } catch (error) {
        console.error('Error formatting time:', error);
        return dateString;
    }
};

const TaxStatus = ({ status }) => {
    if (!status || status === "No obligation") {
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">No Obligation</Badge>;
    }
    switch (status.toLowerCase()) {
        case 'registered':
            return <Badge className="bg-green-500">Registered</Badge>;
        case 'to be registered':
            return <Badge className="bg-blue-500">To Be Registered</Badge>;
        case 'cancelled':
            return <Badge className="bg-red-500">Cancelled</Badge>;
        case 'dormant':
            return <Badge className="bg-blue-500">Dormant</Badge>;
        default:
            return <span>{status}</span>;
    }
};

export default function CompaniesTable({ companies, taxType, tableType }) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [showTotals, setShowTotals] = useState(true); 

    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => info.getValue(),
            header: '#',
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
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
        }),
        columnHelper.accessor('kra_pin', {
            cell: info => info.getValue(),
            header: 'KRA PIN',
        }),
        columnHelper.accessor(`${taxType}_status`, {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'Status',
        }),
        columnHelper.accessor(`${taxType}_effective_from`, {
            cell: info => formatDate(info.getValue()),
            header: 'Effective From',
        }),
        columnHelper.accessor('last_checked_at', {
            cell: info => formatDate(info.getValue()),
            header: 'Last Checked Date',
        }),
        columnHelper.accessor('last_checked_at', {
            id: 'last_checked_time',
            cell: info => formatTime(info.getValue()),
            header: 'Last Checked Time',
        }),
        columnHelper.accessor('actions', {
            cell: info => {
                const company = info.row.original;
                const currentStatus = company[`${taxType}_status`]?.toLowerCase();
                
                if (currentStatus === 'no obligation') {
                    return (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleStatusChange(company, 'To Be Registered')}
                        >
                            Mark To Be Registered
                        </Button>
                    );
                } else if (currentStatus === 'to be registered') {
                    return (
                        <div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleStatusChange(company, 'Registered')}
                                className="mr-2"
                            >
                                Mark as Registered
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleStatusChange(company, 'No Obligation')}
                            >
                                Revert to No Obligation
                            </Button>
                        </div>
                    );
                } else {
                    return null;
                }
            },
            header: 'Actions',
        }),
    ], [taxType, tableType]);

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
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
    });

    const handleStatusChange = async (company, newStatus) => {
        try {
            const { data, error } = await supabase
                .from('PinCheckerDetails')
                .update({ [`${taxType}_status`]: newStatus })
                .eq('id', company.id);

            if (error) throw error;

            toast.success(`${company.company_name} status updated to ${newStatus} for ${taxType}`);
        } catch (error) {
            console.error('Error updating company status:', error);
            toast.error('Failed to update company status');
        }
    };

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${tableType} Companies`);

        // Add headers
        const headerRow = worksheet.addRow(columns.map(col => col.header));
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' } // Yellow background
            };
            cell.font = { bold: true };
        });

        // Add data
        data.forEach((row) => {
            worksheet.addRow(columns.map(col => {
                if (col.accessorKey?.includes('effective_from') || col.accessorKey === 'last_checked_at') {
                    return formatDate(row[col.accessorKey]);
                } else if (col.id === 'last_checked_time') {
                    return formatTime(row['last_checked_at']);
                }
                return row[col.accessorKey];
            }));
        });

        // Auto-fit columns and add borders
        worksheet.columns.forEach((column) => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            column.width = maxLength < 10 ? 10 : maxLength;
        });

        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `${tableType.toLowerCase()}_companies_${taxType}.xlsx`);
    };

    const calculateTotals = (companies) => {
        const totals = {
            total: companies.length,
            registered: 0,
            toBeRegistered: 0,
            noObligation: 0,
            cancelled: 0,
            dormant: 0
        };

        companies.forEach(company => {
            const status = company[`${taxType}_status`]?.toLowerCase();
            if (status === 'registered') totals.registered++;
            else if (status === 'to be registered') totals.toBeRegistered++;
            else if (!status || status === 'no obligation') totals.noObligation++;
            else if (status === 'cancelled') totals.cancelled++;
            else if (status === 'dormant') totals.dormant++;
        });

        return totals;
    };

    const TotalsRow = ({ totals }) => (
        <>
            {[
                { label: 'Total', bgColor: 'bg-blue-100', count: totals.total },
                { label: 'Registered', bgColor: 'bg-green-100', count: totals.registered },
                { label: 'To Be Registered', bgColor: 'bg-yellow-100', count: totals.toBeRegistered },
                { label: 'No Obligation', bgColor: 'bg-amber-100', count: totals.noObligation },
                { label: 'Cancelled', bgColor: 'bg-red-100', count: totals.cancelled },
                { label: 'Dormant', bgColor: 'bg-blue-100', count: totals.dormant }
            ].map(row => (
                <TableRow key={row.label} className={`${row.bgColor}`} style={{ height: '20px' }}>
                    <TableCell className="font-bold uppercase text-xs P-1" style={{ height: '20px' }}>{row.label}</TableCell>
                    <TableCell className="text-center text-xs P-1" style={{ height: '20px' }}></TableCell>
                    <TableCell className="text-center text-xs P-1" style={{ height: '20px' }}></TableCell>
                    <TableCell className="text-center text-xs P-1" style={{ height: '20px' }}>{row.count}</TableCell>
                    {columns.length > 4 && Array(columns.length - 4).fill().map((_, index) => (
                        <TableCell key={index} className="text-center text-xs P-1" style={{ height: '20px' }}></TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );

    return (
        <div>
            <div className="flex justify-between items-center my-2">
                <div className="flex items-center space-x-4">
                    <Input
                        placeholder="Search companies..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="max-w-sm"
                    />
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Show Totals</span>
                        <Switch
                            checked={showTotals}
                            onCheckedChange={setShowTotals}
                            className="data-[state=checked]:bg-green-500"
                        />
                    </div>
                    <Button onClick={exportToExcel}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export to Excel
                    </Button>
                </div>
            </div>
            <ScrollArea className="h-[600px]">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <TableHead key={header.id} className="font-bold text-white bg-gray-600">
                                        {header.isPlaceholder ? null : (
                                            flexRender(header.column.columnDef.header, header.getContext())
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                        {showTotals && <TotalsRow totals={calculateTotals(companies)} />}
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