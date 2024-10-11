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

import { FileDown, Edit, Lock, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ExcelJS from 'exceljs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from '@/lib/supabase';

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
        nita: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0 },
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

        <TableCell colSpan={3} className="font-bold">Totals</TableCell>
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

export default function OverallTaxesTable({ companies }) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editCompany, setEditCompany] = useState(null);

    const updateCompanyStatus = async (companyId, newStatus) => {
        const { data, error } = await supabase
            .from('companies')
            .update({ vat_status: newStatus })
            .eq('id', companyId);
    
        if (error) {
            console.error('Error updating company status:', error);
        } else {
            console.log('Company status updated successfully:', data);
        }
    };

    const toggleLock = async (companyId, currentLockStatus) => {
        const newLockStatus = !currentLockStatus;
        const { data, error } = await supabase
            .from('companies')
            .update({ is_locked: newLockStatus })
            .eq('id', companyId);
    
        if (error) {
            console.error('Error updating lock status:', error);
        } else {
            console.log('Lock status updated successfully:', data);
            // Update the local state to reflect the change
            setCompanies(companies.map(company => 
                company.id === companyId ? {...company, is_locked: newLockStatus} : company
            ));
        }
    };

    const EditDialog = ({ company }) => (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(company)}>Edit</Button>
            </DialogTrigger>
            <DialogContent>
                <h2>{company?.company_name || 'Company Name'}</h2>
                <div>
                    {company ? (
                        <div>
                            {['vat_status', 'paye_status', 'rent_income_mri_status', 'nssf_status', 'nhif_status', 'housing_levy_status', 'nita_status'].map((statusField) => (
                                <div key={statusField} className="flex items-center mb-2">
                                    <span className="mr-2">{statusField.replace(/_/g, ' ').replace('status', '')}:</span>
                                    <Select defaultValue={company[statusField]} className="ml-2">
                                        <SelectTrigger>
                                            <span>{company[statusField]}</span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="registered">Registered</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                            <SelectItem value="dormant">Dormant</SelectItem>
                                            <SelectItem value="missing">Missing</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>No company data available.</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );

    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => info.getValue(),
            header: '#',
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
            header: 'Company Name',
        }),
        columnHelper.accessor('is_locked', {
            cell: info => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleLock(info.row.original.id, info.getValue())}
                    disabled={info.getValue()}
                >
                    {info.getValue() ? <Lock size={16} /> : <Unlock size={16} />}
                </Button>
            ),
            header: 'Lock',
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
        columnHelper.accessor('nita_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'NITA',
        }),
        columnHelper.accessor('actions', {
            cell: info => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(info.row.original)}
                    disabled={info.row.original.is_locked}
                >
                    Edit
                </Button>
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
        setEditCompany(company);
        setDialogOpen(true);
    };

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Overall Taxes');

        worksheet.addRow(['Company Name', 'KRA PIN', 'VAT', 'PAYE', 'MRI', 'NSSF', 'NHIF', 'Housing Levy', 'NITA']);

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
                company.nita_status,
            ]);
        });

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
            {editCompany && <EditDialog company={editCompany} />}
        </div>
    );
}

