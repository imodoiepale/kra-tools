// @ts-nocheck
"use client"

import React, { useMemo, useState, useEffect } from 'react';
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

import { FileDown, Edit, Lock, Unlock, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ExcelJS from 'exceljs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const columnHelper = createColumnHelper();

const TaxStatus = ({ status }) => {
    if (!status || status === "No obligation") {
        return <div className="flex justify-center"><Badge variant="outline" className="bg-red-600 text-white text-[10px]">No Obligation</Badge></div>;
    }
    switch (status.toLowerCase()) {
        case 'registered':
            return <div className="flex justify-center"><Badge className="bg-green-500 text-[10px]">Registered</Badge></div>;
        case 'cancelled':
            return <div className="flex justify-center"><Badge className="bg-red-500 text-[10px]">Cancelled</Badge></div>;
        case 'dormant':
            return <div className="flex justify-center"><Badge className="bg-blue-500 text-[10px]">Dormant</Badge></div>;
        default:
            return <div className="flex justify-center"><Badge variant="outline" className="bg-red-600 text-white text-[10px]">No Obligation</Badge></div>;
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

export default function OverallTaxesTable({ companies: initialCompanies }) {
    const [companies, setCompanies] = useState(initialCompanies);
    const [globalFilter, setGlobalFilter] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editCompany, setEditCompany] = useState(null);

    const fetchCompanies = async () => {
        const { data, error } = await supabase
            .from('PinCheckerDetails')
            .select('*');
        if (error) {
            console.error('Error fetching companies:', error);
            toast.error('Failed to refresh data. Please try again.');
        } else {
            setCompanies(data);
        }
    };

    const updateCompanyField = async (companyId, field, newValue) => {
        const toastId = toast.loading('Saving changes...');
        try {
            const { data, error } = await supabase
                .from('PinCheckerDetails')
                .update({ [field]: newValue })
                .eq('id', companyId);

            if (error) throw error;

            toast.success('Changes saved successfully!', { id: toastId });
            fetchCompanies(); // Refresh the data
        } catch (error) {
            console.error('Error saving changes:', error);
            toast.error('Failed to save changes. Please try again.', { id: toastId });
        }
    };

    const toggleLock = (companyId, currentLockStatus) => {
        const newLockStatus = !currentLockStatus;
        updateCompanyField(companyId, 'is_locked', newLockStatus);
    };

    const EditDialog = ({ company }) => {
        const [localCompany, setLocalCompany] = useState(company);
        const [hasChanges, setHasChanges] = useState(false);

        const handleFieldChange = (field, value) => {
            setLocalCompany(prev => ({ ...prev, [field]: value }));
            setHasChanges(true);
        };

        const handleSave = async () => {
            const toastId = toast.loading('Saving changes...');
            try {
                for (const [key, value] of Object.entries(localCompany)) {
                    if (value !== company[key]) {
                        await updateCompanyField(company.id, key, value);
                    }
                }
                toast.success('Changes saved successfully!', { id: toastId });
                fetchCompanies(); // Refresh the data
                setDialogOpen(false);
            } catch (error) {
                console.error('Error saving changes:', error);
                toast.error('Failed to save changes. Please try again.', { id: toastId });
            }
        };

        const taxTypes = [
            'vat', 'paye', 'rent_income_mri', 'turnover_tax', 'resident_individual',
            'nssf', 'nhif', 'housing_levy', 'nita'
        ];

        const uneditableTaxes = ['vat', 'paye', 'rent_income_mri', 'turnover_tax', 'resident_individual'];


        const TaxCard = ({ tax, editable }) => (
            <div className={`bg-white shadow-sm rounded-md p-2 w-full text-xs border border-black ${editable ? 'border-l-4 border-l-green-500 border-b-2 border-b-green-500' : 'border-l-4 border-l-red-500 border-b-2 border-b-red-500'}`}>
                <h4 className="font-semibold capitalize mb-1 text-gray-800 text-sm">{tax.replace(/_/g, ' ')}</h4>
                <div className="grid grid-cols-3 gap-2 items-center">
                    <div>
                        <label className="text-xs font-medium text-gray-600 block">Status</label>
                        {editable ? (
                            <Select
                                value={localCompany[`${tax}_status`] || 'Missing'}
                                onValueChange={(newValue) => handleFieldChange(`${tax}_status`, newValue)}
                            >
                                <SelectTrigger className="w-full h-7 text-xs">
                                    <SelectValue>{localCompany[`${tax}_status`] || 'Missing'}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Registered">Registered</SelectItem>
                                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                                    <SelectItem value="Dormant">Dormant</SelectItem>
                                    <SelectItem value="No Obligation">No Obligation</SelectItem>
                                    <SelectItem value="Missing">Missing</SelectItem>
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="mt-1">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${localCompany[`${tax}_status`] === 'Registered' ? 'bg-green-100 text-green-700' :
                                        localCompany[`${tax}_status`] === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                            localCompany[`${tax}_status`] === 'Dormant' ? 'bg-blue-100 text-blue-700' :
                                                localCompany[`${tax}_status`] === 'No Obligation' ? 'bg-purple-100 text-red-500' :
                                                    'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {localCompany[`${tax}_status`] || 'No Obligation'}
                                </span>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block">From</label>
                        {editable ? (
                            <Input
                                type="date"
                                value={localCompany[`${tax}_effective_from`] || ''}
                                onChange={(e) => handleFieldChange(`${tax}_effective_from`, e.target.value)}
                                className="w-full h-7 text-xs"
                            />
                        ) : (
                            <p className="text-xs font-medium text-gray-700">{localCompany[`${tax}_effective_from`] || 'N/A'}</p>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block">To</label>
                        {editable ? (
                            <Input
                                type="date"
                                value={localCompany[`${tax}_effective_to`] || ''}
                                onChange={(e) => handleFieldChange(`${tax}_effective_to`, e.target.value)}
                                className="w-full h-7 text-xs"
                            />
                        ) : (
                            <p className="text-xs font-medium text-gray-700">{localCompany[`${tax}_effective_to`] || 'N/A'}</p>
                        )}
                    </div>
                </div>
            </div>
        );

        return (
            <Dialog open={dialogOpen} >
                <DialogContent className="max-w-5xl p-4 bg-white rounded-lg shadow-lg max-h-screen overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-gray-900">{localCompany?.company_name || 'Company Name'}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-grow overflow-auto">
                        <div className="mb-3">
                            <h3 className="font-semibold mb-2 uppercase text-red-600 text-sm">Uneditable Taxes</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {uneditableTaxes.map((tax) => (
                                    <TaxCard key={tax} tax={tax} editable={false} />
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2 uppercase text-green-600 text-sm">Editable Taxes</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {taxTypes.filter(tax => !uneditableTaxes.includes(tax)).map((tax) => (
                                    <TaxCard key={tax} tax={tax} editable={true} />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end space-x-3">
                        <DialogClose asChild>
                            <Button variant="outline" className="px-4 py-2 text-sm">
                                Cancel
                            </Button>
                        </DialogClose>
                        <DialogClose asChild>
                            <Button
                                onClick={handleSave}
                                disabled={!hasChanges}
                                className="bg-green-500 text-white hover:bg-green-600 px-4 py-2 text-sm"
                            >
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </Button>
                        </DialogClose>
                    </div>
                </DialogContent>
            </Dialog>
        );
    };

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
        columnHelper.accessor('nita_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'NITA',
        }),
        columnHelper.accessor('housing_levy_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'Housing Levy',
        }),
        columnHelper.accessor('actions', {
            cell: info => (
                <div className="flex space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(info.row.original)}
                        disabled={info.row.original.is_locked}
                        className="bg-blue-500 text-white hover:bg-blue-600"
                    >
                        <Edit size={16} className="mr-1" />
                        Edit
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleLock(info.row.original.id, info.row.original.is_locked)}
                        className={info.row.original.is_locked ? "bg-green-500 text-white hover:bg-green-600" : "bg-red-500 text-white hover:bg-red-600"}
                    >
                        {info.row.original.is_locked ? <Lock size={16} /> : <Unlock size={16} />}
                    </Button>
                </div>
            ),
            header: 'Actions',
        }),
    ], []);

    const handleEdit = (company) => {
        setEditCompany(company);
        setDialogOpen(true);
    };

    const data = useMemo(() =>
        companies.map((company, index) => ({
            ...company,
            index: index + 1
        })),
        [companies]);

    const table = useReactTable({
        data: data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
    });

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
                <div className="space-x-2">
                    <Button onClick={exportToExcel} size="sm">
                        <FileDown className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>
            <ScrollArea className="h-[750px]">
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
                            {table.getRowModel().rows.map((row, index) => (
                                <TableRow key={row.id} className={index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                                    {row.getVisibleCells().map(cell => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TooltipProvider>
            </ScrollArea>
            {editCompany && <EditDialog company={editCompany} />}
        </div>
    );
}