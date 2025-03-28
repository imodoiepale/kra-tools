// @ts-nocheck
"use client"
import { cn } from "@/lib/utils";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { CheckCircle, XCircle, Search, Download, Settings2, CalendarIcon, Send, Edit2 } from "lucide-react";
import { format } from "date-fns";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import ConfirmDocumentDialog from './ConfirmDocumentDialog';
import DeliveryDialog from './DeliveryDialog';

const columnHelper = createColumnHelper();

export default function MonthlyTable({ clients = [], checklist, selectedDate, updateClientStatus }) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [showTotals, setShowTotals] = useState(true);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [date, setDate] = useState(new Date());

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


    const handleSendReminder = async (companyName) => {
        try {
            // Implement your reminder logic here
            console.log(`Sending reminder to ${companyName}`);
            toast.success(`Reminder sent to ${companyName}`);
            // You could trigger an API call or show a notification
        } catch (error) {
            console.error('Error sending reminder:', error);
            toast.error('Failed to send reminder');
        }
    };

    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => info.getValue(),
            header: 'Index',
            size: 60,
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
            header: 'Company Name',
            size: 200,
        }),
        columnHelper.accessor('kra_pin', {
            cell: info => info.getValue(),
            header: 'KRA PIN',
            size: 120,
        }),
        columnHelper.accessor(row => checklist[row.company_name]?.file_management?.[year]?.[month]?.broughtBy || '-', {
            id: 'broughtBy',
            header: 'Brought By',
            size: 150,
        }),
        columnHelper.accessor(row => checklist[row.company_name]?.file_management?.[year]?.[month]?.receivedAt, {
            id: 'receivedStatus',
            header: 'Received',
            cell: info => {
                const data = checklist[info.row.original.company_name]?.file_management?.[year]?.[month];
                return (
                    <div className="flex items-center justify-center space-x-2">
                        <ConfirmDocumentDialog
                            companyName={info.row.original.company_name}
                            year={year}
                            month={month}
                            kraPin={info.row.original.kra_pin}
                            onConfirm={(status, kraPin) => updateClientStatus(info.row.original.company_name, year, month, status, kraPin)}
                            existingData={data}
                        />
                        {data?.isNil && (
                            <span className="text-xs font-medium text-red-500 ml-1">NIL</span>
                        )}
                    </div>
                );
            },
            size: 100,
        }),
        columnHelper.accessor(row => formatDateTime(checklist[row.company_name]?.file_management?.[year]?.[month]?.receivedAt).date, {
            id: 'receivedDate',
            header: 'Received Date',
            size: 120,
        }),
        columnHelper.accessor(row => formatDateTime(checklist[row.company_name]?.file_management?.[year]?.[month]?.receivedAt).time, {
            id: 'receivedTime',
            header: 'Received Time',
            size: 120,
        }),
        // columnHelper.accessor(row => checklist[row.company_name]?.file_management?.[year]?.[month]?.documentType, {
        //     id: 'documentType',
        //     header: 'Doc Type',
        //     size: 120,
        // }),
        // columnHelper.accessor(row => checklist[row.company_name]?.file_management?.[year]?.[month]?.processingStatus, {
        //     id: 'processingStatus',
        //     header: 'Status',
        //     cell: info => {
        //         const status = info.getValue();
        //         const getStatusColor = (status) => {
        //             switch (status) {
        //                 case 'processed': return 'bg-green-100 text-green-800';
        //                 case 'in_progress': return 'bg-blue-100 text-blue-800';
        //                 case 'on_hold': return 'bg-yellow-100 text-yellow-800';
        //                 case 'needs_review': return 'bg-red-100 text-red-800';
        //                 default: return 'bg-gray-100 text-gray-800';
        //             }
        //         };
        //         return status ? (
        //             <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
        //                 {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
        //             </span>
        //         ) : '-';
        //     },
        //     size: 120,
        // }),
        columnHelper.accessor(row => checklist[row.company_name]?.file_management?.[year]?.[month]?.filesDelivered, {
            id: 'deliveredStatus',
            header: 'Delivered',
            cell: info => {
                const data = checklist[info.row.original.company_name]?.file_management?.[year]?.[month];
                return (
                    <div className="flex items-center justify-center space-x-2">
                        <DeliveryDialog
                            companyName={info.row.original.company_name}
                            year={year}
                            month={month}
                            kraPin={info.row.original.kra_pin}
                            onConfirm={(status, kraPin) => updateClientStatus(info.row.original.company_name, year, month, status, kraPin)}
                            existingData={data}
                        />
                    </div>
                );
            },
            size: 100,
        }),
        columnHelper.accessor(row => checklist[row.company_name]?.file_management?.[year]?.[month]?.pickedBy || '-', {
            id: 'pickedBy',
            header: 'Picked By',
            size: 150,
        }),
        columnHelper.accessor(row => formatDateTime(checklist[row.company_name]?.file_management?.[year]?.[month]?.deliveredAt).date, {
            id: 'deliveredDate',
            header: 'Delivered Date',
            size: 120,
        }),
        columnHelper.accessor(row => formatDateTime(checklist[row.company_name]?.file_management?.[year]?.[month]?.deliveredAt).time, {
            id: 'deliveredTime',
            header: 'Delivered Time',
            size: 120,
        }),
        columnHelper.accessor('actions', {
            header: 'Actions',
            cell: info => {
                const data = checklist[info.row.original.company_name]?.file_management?.[year]?.[month];
                const lastModified = data?.lastModified ? new Date(data.lastModified) : null;

                return (
                    <div className="flex items-center justify-center space-x-2">
                        {/* Edit Button
                        {data?.receivedAt && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    // Open the ConfirmDocumentDialog for editing
                                    const dialogTrigger = document.querySelector(
                                        `[data-row-index="${info.row.index}"] [data-dialog-trigger]`
                                    );
                                    if (dialogTrigger) {
                                        dialogTrigger.click();
                                    }
                                }}
                                className="flex items-center space-x-1"
                            >
                                <Edit2 className="h-4 w-4" />
                                <span className="text-xs">Edit</span>
                            </Button>
                        )} */}

                        {/* Reminder Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendReminder(info.row.original.company_name)}
                        >
                            <Send className="h-3 w-3 mr-1" />
                            Remind
                        </Button>
                    </div>
                );
            },
            size: 150,
        }),
        // columnHelper.accessor(row => {
        //     const data = checklist[row.company_name]?.file_management?.[year]?.[month];
        //     return data?.lastModified ? format(new Date(data.lastModified), 'dd/MM/yyyy HH:mm') : '-';
        // }, {
        //     id: 'lastModified',
        //     header: 'Last Modified',
        //     size: 150,
        // }),
        // ], [year, month, checklist, updateClientStatus, handleSendReminder]);
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
        state: {
            globalFilter,
            columnVisibility,
        },
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    const getStatusCounts = () => {
        const rows = table.getFilteredRowModel().rows;
        const total = rows.length;

        const receivedCount = rows.filter(row => {
            const data = checklist[row.original.company_name]?.file_management?.[year]?.[month];
            return data?.receivedAt || data?.isNil;
        }).length;

        const deliveredCount = rows.filter(row => {
            const data = checklist[row.original.company_name]?.file_management?.[year]?.[month];
            return data?.filesDelivered;
        }).length;

        const nilCount = rows.filter(row => {
            const data = checklist[row.original.company_name]?.file_management?.[year]?.[month];
            return data?.isNil;
        }).length;

        return {
            total,
            receivedComplete: receivedCount,
            receivedPending: total - receivedCount,
            deliveredComplete: deliveredCount,
            deliveredPending: total - deliveredCount,
            nilCount
        };
    };



    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Monthly Report');

        // Add title with month and year
        worksheet.addRow([`Monthly Report - ${format(selectedDate, 'MMMM yyyy')}`]);
        worksheet.mergeCells('A1:K1');
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        // Add date generated
        worksheet.addRow([`Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`]);
        worksheet.mergeCells('A2:K2');
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        // Empty row for spacing
        worksheet.addRow([]);

        // Add headers
        const headers = table.getAllColumns()
            .filter(column => column.getIsVisible())
            .map(column => column.columnDef.header);
        const headerRow = worksheet.addRow(headers);

        // Style headers
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Add data rows
        table.getRowModel().rows.forEach((row, index) => {
            const rowData = row.getAllCells()
                .filter(cell => cell.column.getIsVisible())
                .map(cell => {
                    const value = cell.getValue();
                    if (React.isValidElement(value)) {
                        // Handle React elements (like icons)
                        if (value.type === CheckCircle) return 'Yes';
                        if (value.type === XCircle) return 'No';
                        return '-';
                    }
                    return value || '-';
                });
            const excelRow = worksheet.addRow(rowData);

            // Add zebra striping
            if (index % 2 === 0) {
                excelRow.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF5F5F5' }
                    };
                });
            }

            // Add borders
            excelRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Add totals if enabled
        if (showTotals) {
            const counts = getStatusCounts();
            worksheet.addRow([]); // Empty row for spacing

            const totalsRows = [
                ['Total', counts.total, counts.total],
                ['Complete', counts.receivedComplete, counts.deliveredComplete],
                ['Pending', counts.receivedPending, counts.deliveredPending]
            ];

            totalsRows.forEach((rowData, index) => {
                const row = worksheet.addRow(['Totals', ...rowData]);
                row.font = { bold: true };
                const bgColor = index === 0 ? 'FFE6F0FF' :
                    index === 1 ? 'FFE6FFE6' : 'FFFFE6E6';
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: bgColor }
                    };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });
        }

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength + 2;
        });

        // Generate and save file
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `monthly_report_${format(selectedDate, 'MMM_yyyy')}.xlsx`);
    };

    if (clients.length === 0) {
        return <div className="text-center py-8">No clients available.</div>;
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
                <div className="text-2xl font-bold text-gray-800">
                    {format(selectedDate, 'MMMM yyyy')}
                </div>

                <div className="flex items-center space-x-4">
                    {/* Search */}
                    <div className="flex items-center w-64">
                        <Search className="h-4 w-4 mr-2 text-gray-500" />
                        <Input
                            placeholder="Search in all columns..."
                            value={globalFilter}
                            onChange={e => setGlobalFilter(e.target.value)}
                            className="w-full"
                        />
                    </div>

                    {/* Column Visibility */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Settings2 className="h-4 w-4 mr-2" />
                                Columns
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56">
                            <div className="space-y-2 p-2">
                                {table.getAllColumns().map(column => {
                                    if (!column.getCanHide()) return null;
                                    return (
                                        <div key={column.id} className="flex items-center space-x-2">
                                            <Switch
                                                checked={column.getIsVisible()}
                                                onCheckedChange={(value) =>
                                                    column.toggleVisibility(value)
                                                }
                                                id={column.id}
                                            />
                                            <Label htmlFor={column.id}>
                                                {column.columnDef.header}
                                            </Label>
                                        </div>
                                    );
                                })}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Totals Toggle */}
                    <div className="flex items-center space-x-2">
                        <Switch
                            checked={showTotals}
                            onCheckedChange={setShowTotals}
                            id="show-totals"
                        />
                        <Label htmlFor="show-totals">Show Totals</Label>
                    </div>

                    {/* Export Button */}
                    <Button onClick={exportToExcel} size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export to Excel
                    </Button>
                </div>
            </div>

            {/* Table */}
            <ScrollArea className="h-[calc(100vh-12rem)] border rounded-lg">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <TableHead
                                        key={header.id}
                                        className="font-bold bg-gray-100 text-center sticky top-0"
                                        style={{ width: header.column.columnDef.size }}
                                    >
                                        {header.isPlaceholder ? null : (
                                            <div
                                                {...{
                                                    className: header.column.getCanSort()
                                                        ? 'cursor-pointer select-none flex items-center justify-center'
                                                        : '',
                                                    onClick: header.column.getToggleSortingHandler(),
                                                }}
                                            >
                                                {flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                                {header.column.getIsSorted() && (
                                                    <span className="ml-2">
                                                        {header.column.getIsSorted() === "asc" ? " 🔼" : " 🔽"}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}

                        {showTotals && (
                            <>
                                {[
                                    { label: 'Total', bgColor: 'bg-blue-50', counts: [getStatusCounts().total, getStatusCounts().total] },
                                    { label: 'Complete', bgColor: 'bg-green-50', counts: [getStatusCounts().receivedComplete, getStatusCounts().deliveredComplete] },
                                    { label: 'Pending', bgColor: 'bg-red-50', counts: [getStatusCounts().receivedPending, getStatusCounts().deliveredPending] },
                                    { label: 'NIL Records', bgColor: 'bg-red-100', counts: [getStatusCounts().nilCount, '-'] }
                                ].map(row => (
                                    <TableRow key={row.label} className={`${row.bgColor}`}>
                                        <TableCell colSpan={4} className="font-bold text-left">
                                            {row.label}:
                                        </TableCell>
                                        <TableCell className="text-center font-semibold">
                                            {row.counts[0]}
                                        </TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                        <TableCell className="text-center font-semibold">
                                            {row.counts[1]}
                                        </TableCell>
                                        <TableCell colSpan={4}></TableCell>
                                    </TableRow>
                                ))}
                            </>
                        )}
                    </TableHeader>

                    <TableBody>
                        {table.getRowModel().rows.map((row, rowIndex) => {
                            const isNilRecord = checklist[row.original.company_name]?.file_management?.[year]?.[month]?.isNil;

                            return (
                                <TableRow
                                    key={row.id}
                                    className={cn(
                                        rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                                        isNilRecord ? 'bg-red-50' : ''
                                    )}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn(
                                                "text-center",
                                                isNilRecord && "text-red-700"
                                            )}
                                            style={{ width: cell.column.columnDef.size }}
                                        >
                                            {isNilRecord && cell.column.id !== 'receivedStatus' && cell.column.id !== 'index' && cell.column.id !== 'company_name'
                                                ? <span className="text-red-500">NIL</span>
                                                : flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
    );
}
