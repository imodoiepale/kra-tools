// @ts-nocheck
"use client"

import React, { useMemo } from 'react';
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

const columnHelper = createColumnHelper();

const TaxStatus = ({ status }) => {
    if (!status || status === "No obligation") {
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">No Obligation</Badge>;
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

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = parse(dateString, 'yyyy-MM-dd', new Date());
    return isValid(date) ? format(date, 'dd/MM/yyyy') : dateString;
};

export default function RegisteredCompaniesTable({ companies, taxType }) {
    const [globalFilter, setGlobalFilter] = React.useState('');

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
        columnHelper.accessor(`${taxType}_status`, {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'Status',
        }),
        columnHelper.accessor(`${taxType}_effective_from`, {
            cell: info => formatDate(info.getValue()),
            header: 'Effective From',
        }),
    ], [taxType]);

    const data = useMemo(() =>
        companies
            // .filter(company => company[`${taxType}_status`]?.toLowerCase() === 'registered')
            .map((company, index) => ({
                ...company,
                index: index + 1,
            })),
        [companies, taxType]
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

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Registered Companies');

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
                if (col.accessorKey.includes('_effective_from')) {
                    return formatDate(row[col.accessorKey]);
                }
                return row[col.accessorKey];
            }));
        });

        // Auto-fit columns
        worksheet.columns.forEach((column) => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength;
        });

        // Add borders to all cells
        worksheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'registered_companies.xlsx');
    };

    const calculateTotals = (companies, taxType) => {
        const totals = {
            registered: 0,
            cancelled: 0,
            dormant: 0,
            noObligation: 0,
            total: 0
        };

        companies.forEach(company => {
            totals.total++;
            const status = company[`${taxType}_status`]?.toLowerCase();
            if (status === 'registered') totals.registered++;
            else if (status === 'cancelled') totals.cancelled++;
            else if (status === 'dormant') totals.dormant++;
            else totals.noObligation++;
        });

        return totals;
    };


    const TotalsRow = ({ totals }) => (
        <>
            {['Totals', 'Registered', 'Cancelled', 'Dormant', 'No Obligation'].map((rowTitle, index) => (
                <TableRow key={rowTitle} className={`${index === 0 ? 'sticky top-0' : ''} whitespace-nowrap text-center h-4 bg-yellow-100`}>
                    <TableCell colSpan={3} className="font-bold text-[10px] text-left h-4">{rowTitle}</TableCell>
                    <TableCell className="text-center">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Badge
                                        className={`${rowTitle === 'Totals' ? 'bg-black text-white' :
                                            rowTitle === 'Registered' ? 'bg-green-500' :
                                                rowTitle === 'Cancelled' ? 'bg-red-500' :
                                                    rowTitle === 'Dormant' ? 'bg-blue-500' : 'bg-amber-400'
                                            } text-[9px] px-0.5 py-0.5`}
                                        variant={rowTitle === 'No Obligation' ? 'outline' : 'default'}
                                    >
                                        {totals[rowTitle.toLowerCase().replace(' ', '')] || 0}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="text-[9px] px-1 py-0.5">{rowTitle}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </TableCell>
                    <TableCell ></TableCell>
                </TableRow>
            ))}
        </>
    );


    return (
        <div>
            <div className="flex justify-between items-center my-4">
                <Input
                    placeholder="Search companies..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="max-w-sm"
                />
                <Button onClick={exportToExcel}>Export to Excel</Button>
            </div>
            <ScrollArea className="h-[600px]">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <TableHead key={header.id} className="font-bold text-white bg-gray-600">
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

                        <TotalsRow totals={calculateTotals(companies, taxType)} />


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