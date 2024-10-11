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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"; // Import Dialog components
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";

const columnHelper = createColumnHelper();

const TaxStatus = ({ status }) => {
    if (!status || status === "No obligation") {
        return <Badge variant="outline" className="bg-amber-400 text-yellow-800">Missing</Badge>;
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

const calculateTotals = (companies) => {
    const totals = {
        vat: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0 },
        paye: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0 },
        rent_income_mri: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0 },
        turnover_tax: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0 },
        resident_individual: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0 },
        nssf: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0 },
        nhif: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0 },
        housing_levy: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0 },
    };

    companies.forEach(company => {
        Object.keys(totals).forEach(tax => {
            totals[tax].total++;
            const status = company[`${tax}_status`]?.toLowerCase();
            if (status === 'registered') totals[tax].registered++;
            else if (status === 'cancelled') totals[tax].cancelled++;
            else if (status === 'dormant') totals[tax].dormant++;
            else totals[tax].missing++;
        });
    });

    return totals;
};

const TotalsRow = ({ totals }) => (
    <TableRow className='sticky top-0'>
        <TableCell colSpan={2} className="font-bold">Totals</TableCell>
        {Object.entries(totals).map(([tax, counts]) => (
            <TableCell key={tax}>
                <TooltipProvider>
                    {counts.total > 0 && (
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge className="bg-black text-white text-[10px] px-1 py-0.5">{counts.total}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>Total</TooltipContent>
                        </Tooltip>
                    )}
                    {counts.registered > 0 && (
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge className="bg-green-500 ml-1 text-[10px] px-1 py-0.5">{counts.registered}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>Registered</TooltipContent>
                        </Tooltip>
                    )}
                    {counts.cancelled > 0 && (
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge className="bg-red-500 ml-1 text-[10px] px-1 py-0.5">{counts.cancelled}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>Cancelled</TooltipContent>
                        </Tooltip>
                    )}
                    {counts.dormant > 0 && (
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge className="bg-blue-500 ml-1 text-[10px] px-1 py-0.5">{counts.dormant}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>Dormant</TooltipContent>
                        </Tooltip>
                    )}
                    {counts.missing > 0 && (
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge variant="outline" className="bg-amber-400 text-yellow-800 ml-1 text-[10px] px-1 py-0.5">{counts.missing}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>Missing</TooltipContent>
                        </Tooltip>
                    )}
                </TooltipProvider>
            </TableCell>
        ))}
    </TableRow>
);

const EditDialog = () => (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
            <Button variant="ghost" size="sm">Edit</Button>
        </DialogTrigger>
        <DialogContent>
            <h2>{editCompany?.company_name}</h2>
            <div>
                {Object.entries(editCompany).map(([tax, status], index) => (
                    <div key={index} className="flex items-center">
                        <span className="mr-2">{String.fromCharCode(8482 + index)}. {tax.replace('_', ' ')}</span>
                        <input type="checkbox" disabled checked={status === 'registered'} />
                        <Select defaultValue={status} className="ml-2">
                            <SelectTrigger>
                                <span>{status}</span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </div>
        </DialogContent>
    </Dialog>
);


export default function OverallTaxesTable({ companies }) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editCompany, setEditCompany] = useState(null);

    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => info.getValue(),
            header: '#',
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
            header: 'Company Name',
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
        columnHelper.accessor('turnover_tax_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'Turnover Tax',
        }),
        columnHelper.accessor('resident_individual_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'Individual',
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
                <EditDialog />
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
        // Open dialog with company data
        setEditCompany(company); // Set the company to be edited
        setDialogOpen(true); // Open the dialog
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

    const totals = useMemo(() => calculateTotals(companies), [companies]);

    return (
        <div>
            <div className="flex justify-between items-center my-4">
                <Input
                    placeholder="Search..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="w-64"
                />
                <Button onClick={exportToExcel} size="sm">
                    <FileDown className="mr-2 h-4 w-4" />
                    Export
                </Button>
            </div>
            <ScrollArea className="h-[600px]">
                <TooltipProvider>
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
                            <TotalsRow totals={totals} />
                        </TableHeader>
                        <TableBody>

                            {table.getRowModel().rows.map((row, rowIndex) => {
                                const isGroupRow = row.depth === 0;
                                return (
                                    <React.Fragment key={row.id}>
                                        <TableRow className={row.index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
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
                </TooltipProvider>
            </ScrollArea>
        </div>
    );
}

