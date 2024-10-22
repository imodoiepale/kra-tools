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

    let date;
    if (typeof dateString === 'string') {
        // Try parsing different date formats
        const formats = [
            /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
            /^\d{2}\.\d{2}\.\d{4}$/, // DD.MM.YYYY
            /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
            /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
            /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
        ];

        for (const format of formats) {
            if (format.test(dateString)) {
                const [year, month, day] = dateString.split(/[-./]/).map(Number);
                date = new Date(format === formats[0] || format === formats[3] ? year : day, month - 1, format === formats[0] || format === formats[3] ? day : year);
                break;
            }
        }

        if (!date) {
            date = new Date(dateString); // Fallback to default parsing
        }
    } else if (dateString instanceof Date) {
        date = dateString;
    } else {
        return "Invalid date";
    }

    if (isNaN(date.getTime())) {
        return "Invalid date";
    }

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

export default function TaxTable({ companies, taxType, statusField, fromField, toField }) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('Registered');

    const filteredData = useMemo(() => {
        return companies.filter(company => {
            return company[statusField]?.toLowerCase() === 'registered';
        }).map((company, index) => ({
            ...company,
            index: index + 1
        }));
    }, [companies, statusField]);

    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => info.getValue(),
            header: '#',
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
            header: 'Company Name',
        }),
        // columnHelper.accessor('kra_pin', {
        //     cell: info => info.getValue(),
        //     header: 'KRA PIN',
        // }),
        columnHelper.accessor(statusField, {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'Status',
        }),
        columnHelper.accessor(fromField, {
            cell: info => formatDate(info.getValue()),
            header: 'Effective From',
        }),
        // columnHelper.accessor(toField, {
        //     cell: info => formatDate(info.getValue()),
        //     header: 'Effective To',
        // }),
        columnHelper.accessor('last_checked_at', {
            cell: info => {
                const date = new Date(info.getValue());
                return <div className="text-center">{formatDate(info.getValue())}</div>;
            },
            header: 'Last Checked Date',
        }),
        columnHelper.accessor('last_checked_at', {
            cell: info => {
                const date = new Date(info.getValue());
                return <div className="text-center">{date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>;
            },
            header: 'Last Checked Time',
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

    const table = useReactTable({
        data: filteredData,
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
        const worksheet = workbook.addWorksheet(`${taxType} Tax Data`);
    
        // Add headers, excluding the actions column
        const headers = columns
            .filter(col => col.header !== 'Actions')
            .map(col => col.header === 'Last Checked' ? ['Last Checked Date', 'Last Checked Time'] : col.header)
            .flat();
        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' } // Yellow background
            };
            cell.font = { bold: true };
            cell.border = {
                top: {style:'thin'},
                left: {style:'thin'},
                bottom: {style:'thin'},
                right: {style:'thin'}
            };
        });
    
        // Add data
        table.getRowModel().rows.forEach((row) => {
            const rowData = row.getAllCells()
                .filter(cell => cell.column.id !== 'actions')
                .map(cell => {
                    const value = cell.getValue();
                    if (cell.column.id === 'last_checked_at') {
                        const date = new Date(value);
                        return [
                            formatDate(date),
                            date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                        ];
                    }
                    return value instanceof Date ? formatDate(value) : value;
                })
                .flat();
            const dataRow = worksheet.addRow(rowData);
            dataRow.eachCell((cell) => {
                cell.border = {
                    top: {style:'thin'},
                    left: {style:'thin'},
                    bottom: {style:'thin'},
                    right: {style:'thin'}
                };
            });
        });
    
        // Autofit columns
        worksheet.columns.forEach(column => {
            let maxColumnLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                maxColumnLength = Math.max(maxColumnLength, cell.value ? cell.value.toString().length : 0);
            });
            column.width = maxColumnLength < 10 ? 10 : maxColumnLength;
        });
    
        const currentDate = new Date();
    const formattedDate = currentDate.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${taxType} - tax data - ${formattedDate}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
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
            <ScrollArea className="h-[650px]">
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
