// @ts-nocheck
"use client"

import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
import { Switch } from "@/components/ui/switch";
import { TableToolbar } from './TableToolbar';
import TotalsRow from './TotalsRow';

const columnHelper = createColumnHelper();

const TaxStatus = ({ status }) => {
    if (!status || status === "No obligation") {
        return <div className="flex justify-center"><Badge variant="outline" className="bg-red-600 text-white text-[8px] px-1 py-0">No Obligation</Badge></div>;
    }
    switch (status.toLowerCase()) {
        case 'registered':
            return <div className="flex justify-center"><Badge className="bg-green-500 text-[8px] px-1 py-0">Registered</Badge></div>;
        case 'cancelled':
            return <div className="flex justify-center"><Badge className="bg-red-500 text-[8px] px-1 py-0">Cancelled</Badge></div>;
        case 'dormant':
            return <div className="flex justify-center"><Badge className="bg-blue-500 text-[8px] px-1 py-0">Dormant</Badge></div>;
        case 'to register':
            return <div className="flex justify-center"><Badge className="bg-yellow-500 text-[8px] px-1 py-0">To Register</Badge></div>;
        case 'not sure':
            return <div className="flex justify-center"><Badge className="bg-gray-500 text-[8px] px-1 py-0">Not Sure</Badge></div>;
        case 'to cancel':
            return <div className="flex justify-center"><Badge className="bg-orange-500 text-[8px] px-1 py-0">To Cancel</Badge></div>;
        default:
            return <div className="flex justify-center"><Badge variant="outline" className="bg-red-600 text-white text-[8px] px-1 py-0">No Obligation</Badge></div>;
    }
};


const calculateTotals = (companies) => {
    const totals = {
        income_tax_company: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
        vat: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
        paye: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
        rent_income_mri: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
        turnover_tax: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
        resident_individual: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
        wh_vat: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
        nssf: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
        nhif: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
        housing_levy: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
        nita: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
        kebs: { total: 0, registered: 0, cancelled: 0, dormant: 0, missing: 0, toBeRegistered: 0 },
    };

    companies.forEach(company => {
        Object.keys(totals).forEach(tax => {
            totals[tax].total++;
            const status = company[`${tax}_status`]?.toLowerCase();
            if (status === 'registered') totals[tax].registered++;
            else if (status === 'cancelled') totals[tax].cancelled++;
            else if (status === 'dormant') totals[tax].dormant++;
            else if (status === 'to be registered') totals[tax].toBeRegistered++;
            else totals[tax].missing++;
        });
    });

    return totals;
};

const exportToExcel = async (companies) => {
    // Verify that each company object contains the necessary fields before exporting
    companies.forEach((company) => {
        if (!company.company_name || !company.kra_pin) {
            console.error('Missing essential data:', company);
        }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Overall Taxes');

    // Define headers
    const headers = ['Company Name', 'KRA PIN', 'Income Tax Company', 'VAT', 'PAYE', 'MRI', 'NSSF', 'NHIF', 'Housing Levy', 'NITA', 'WH VAT'];
    worksheet.addRow(headers);

    // Add data rows
    companies.forEach((company) => {
        worksheet.addRow([
            company.company_name || 'N/A',
            company.kra_pin || 'N/A',
            company.income_tax_company_status || 'N/A',
            company.vat_status || 'N/A',
            company.paye_status || 'N/A',
            company.rent_income_mri_status || 'N/A',
            company.nssf_status || 'N/A',
            company.nhif_status || 'N/A',
            company.housing_levy_status || 'N/A',
            company.nita_status || 'N/A',
            company.wh_vat_status || 'N/A',
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



export default function OverallTaxesTable({ companies: initialCompanies }) {
    const [companies, setCompanies] = useState(initialCompanies || []);
    const [isLoading, setIsLoading] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editCompany, setEditCompany] = useState(null);
    const [showTotals, setShowTotals] = useState(true);
    const [categoryFilters, setCategoryFilters] = useState([
        { label: 'Accounting', key: 'acc', checked: true },
        { label: 'Audit Tax', key: 'audit_tax', checked: false },
        { label: 'Sheria', key: 'cps_sheria', checked: false },
        { label: 'Immigration', key: 'imm', checked: false },
    ]);



    const calculateStatus = (from, to) => {
        try {
            const currentDate = new Date();
            if (!from || !to) return 'Inactive';
            const fromDate = new Date(from);
            const toDate = new Date(to);
            return fromDate <= currentDate && currentDate <= toDate ? 'Active' : 'Inactive';
        } catch (error) {
            console.error('Error calculating status:', error);
            return 'Error';
        }
    };

    const handleCategoryFilterChange = (key: string) => {
        setCategoryFilters(prev =>
            prev.map(filter =>
                filter.key === key ? { ...filter, checked: !filter.checked } : filter
            )
        );
    };

    // Filter data based on both search and category filters
    const filteredData = useMemo(() => {
        return companies.filter(company => {
            // Apply global search filter
            const matchesSearch = !globalFilter ||
                company.company_name?.toLowerCase().includes(globalFilter.toLowerCase()) ||
                company.kra_pin?.toLowerCase().includes(globalFilter.toLowerCase());

            // Apply category filters
            const matchesCategory = categoryFilters.some(filter => {
                if (!filter.checked) return false;

                const fromField = `${filter.key}_client_effective_from`;
                const toField = `${filter.key}_client_effective_to`;

                return calculateStatus(company[fromField], company[toField]) === 'Active';
            });

            return matchesSearch && matchesCategory;
        });
    }, [companies, globalFilter, categoryFilters]);

    const fetchCompanies = useCallback(async () => {
        setIsLoading(true);
        try {
            // First, get companies from acc_portal_company_duplicate
            const { data: accPortalCompanies, error: accPortalError } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .order('id', { ascending: true });

            if (accPortalError) throw accPortalError;

            // Get existing companies from PinCheckerDetails
            const { data: pinCheckerCompanies, error: pinCheckerError } = await supabase
                .from('PinCheckerDetails')
                .select('*');

            if (pinCheckerError) throw pinCheckerError;

            // Create a map of existing companies in PinCheckerDetails
            const existingCompaniesMap = new Map(
                pinCheckerCompanies.map(company => [company.company_name, company])
            );

            // Prepare upsert data
            const upsertData = accPortalCompanies.map(accCompany => {
                const existingCompany = existingCompaniesMap.get(accCompany.company_name);
                return {
                    company_name: accCompany.company_name,
                    kra_pin: accCompany.kra_pin,
                    // Preserve existing tax statuses if they exist, otherwise set defaults
                    income_tax_company_status: existingCompany?.income_tax_company_status || 'No Obligation',
                    vat_status: existingCompany?.vat_status || 'No Obligation',
                    paye_status: existingCompany?.paye_status || 'No Obligation',
                    rent_income_mri_status: existingCompany?.rent_income_mri_status || 'No Obligation',
                    turnover_tax_status: existingCompany?.turnover_tax_status || 'No Obligation',
                    resident_individual_status: existingCompany?.resident_individual_status || 'No Obligation',
                    nssf_status: existingCompany?.nssf_status || 'No Obligation',
                    nhif_status: existingCompany?.nhif_status || 'No Obligation',
                    nita_status: existingCompany?.nita_status || 'No Obligation',
                    housing_levy_status: existingCompany?.housing_levy_status || 'No Obligation',
                    wh_vat_status: existingCompany?.wh_vat_status || 'No Obligation',
                    kebs_status: existingCompany?.kebs_status || 'No Obligation',
                    // Copy over the effective dates from acc_portal_company_duplicate
                    acc_client_effective_from: accCompany.acc_client_effective_from,
                    acc_client_effective_to: accCompany.acc_client_effective_to,
                    audit_client_effective_from: accCompany.audit_client_effective_from,
                    audit_client_effective_to: accCompany.audit_client_effective_to,
                    sheria_client_effective_from: accCompany.sheria_client_effective_from,
                    sheria_client_effective_from: accCompany.sheria_client_effective_from,
                    imm_client_effective_from: accCompany.imm_client_effective_from,
                    imm_client_effective_to: accCompany.imm_client_effective_to,
                    is_locked: existingCompany?.is_locked || false
                };
            });

            // Upsert the data into PinCheckerDetails
            const { error: upsertError } = await supabase
                .from('PinCheckerDetails')
                .upsert(upsertData, {
                    onConflict: 'company_name',
                    ignoreDuplicates: false
                });

            if (upsertError) throw upsertError;

            // Set the companies state with the upserted data
            setCompanies(upsertData);
            toast.success('Companies data synchronized successfully');
        } catch (error) {
            console.error('Error fetching and syncing companies:', error);
            toast.error('Failed to sync companies data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateCompanyField = async (companyId, field, newValue) => {
        const toastId = toast.loading('Saving changes...');
        try {
            // Update PinCheckerDetails table
            const { data, error } = await supabase
                .from('PinCheckerDetails')
                .update({ [field]: newValue })
                .eq('id', companyId)
                .select();

            if (error) throw error;

            setCompanies(prevCompanies =>
                prevCompanies.map(company =>
                    company.id === companyId ? { ...company, [field]: newValue } : company
                )
            );

            toast.success('Changes saved successfully!', { id: toastId });
        } catch (error) {
            console.error('Error saving changes:', error);
            toast.error('Failed to save changes. Please try again.', { id: toastId });
        }
    };

    const toggleLock = async (companyId, currentLockStatus) => {
        const newLockStatus = !currentLockStatus;
        await updateCompanyField(companyId, 'is_locked', newLockStatus);
    };

    const EditDialog = ({ company, isOpen, onClose, onSave }) => {
        const [localCompany, setLocalCompany] = useState(company);
        const [hasChanges, setHasChanges] = useState(false);

        useEffect(() => {
            setLocalCompany(company);
            setHasChanges(false);
        }, [company]);

        const handleFieldChange = (field, value) => {
            setLocalCompany(prev => ({ ...prev, [field]: value }));
            setHasChanges(true);
        };

        const handleSave = async () => {
            const toastId = toast.loading('Saving changes...');
            try {
                await onSave(localCompany);
                toast.success('Changes saved successfully!', { id: toastId });
                onClose();
            } catch (error) {
                console.error('Error saving changes:', error);
                toast.error('Failed to save changes. Please try again.', { id: toastId });
            }
        };

        const taxTypes = [
            'vat', 'paye', 'rent_income_mri', 'turnover_tax', 'resident_individual',
            'nssf', 'nhif', 'housing_levy', 'nita', 'wh_vat', 'kebs'
        ];

        const uneditableTaxes = ['income_tax_company', 'vat', 'paye', 'rent_income_mri', 'turnover_tax', 'resident_individual'];

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
                                    <SelectItem value="To Register">To be Registered</SelectItem>
                                    <SelectItem value="Not Sure">Not Sure</SelectItem>
                                    <SelectItem value="To Cancel">To Cancel</SelectItem>
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
            <Dialog open={isOpen} onOpenChange={onClose}>
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
                        <Button variant="outline" onClick={onClose} className="px-4 py-2 text-sm">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className="bg-green-500 text-white hover:bg-green-600 px-4 py-2 text-sm"
                        >
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditCompany(null);
    };


    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => <span className="font-bold text-[10px] text-center">{info.getValue()}</span>,
            header: '#',
        }),
        columnHelper.accessor('company_name', {
            cell: info => <span className="text-[10px]">{info.getValue()}</span>,
            header: 'Company Name',
        }),
        columnHelper.accessor('income_tax_company_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'Income Tax Company',
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
        columnHelper.accessor('wh_vat_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'WH VAT',
        }),
        columnHelper.accessor('kebs_status', {
            cell: info => <TaxStatus status={info.getValue()} />,
            header: 'KEBS',
        }),
        columnHelper.accessor('actions', {
            cell: ({ row }) => (
                <div className="flex space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(row.original)}
                        disabled={row.original.is_locked}
                        className="bg-blue-500 text-white hover:bg-blue-600"
                    >
                        <Edit size={16} />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleLock(row.original.id, row.original.is_locked)}
                        className={row.original.is_locked ? "bg-green-500 text-white hover:bg-green-600" : "bg-red-500 text-white hover:bg-red-600"}
                    >
                        {row.original.is_locked ? <Lock size={16} /> : <Unlock size={16} />}
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
    const handleSaveCompany = async (updatedCompany) => {
        try {
            for (const [key, value] of Object.entries(updatedCompany)) {
                if (value !== editCompany[key]) {
                    await updateCompanyField(updatedCompany.id, key, value);
                }
            }
            setCompanies(prevCompanies =>
                prevCompanies.map(c => c.id === updatedCompany.id ? updatedCompany : c)
            );
            handleCloseDialog(); // Close the dialog after successful save
        } catch (error) {
            console.error('Error saving company:', error);
            toast.error('Failed to save changes. Please try again.');
        }
    };

    const table = useReactTable({
        data: useMemo(() =>
            filteredData.map((company, index) => ({
                ...company,
                index: index + 1
            })),
            [filteredData]
        ),
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
    });

    return (
        <div>
            <TableToolbar
                globalFilter={globalFilter}
                setGlobalFilter={setGlobalFilter}
                showTotals={showTotals}
                setShowTotals={setShowTotals}
                onExport={() => exportToExcel(filteredData)}
                categoryFilters={categoryFilters}
                onFilterChange={handleCategoryFilterChange}
                companies={companies}
                activeTab={null}
            />
            <ScrollArea className="h-[650px] w-full rounded-md border">
                <TooltipProvider>
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map(headerGroup => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <TableHead
                                            key={header.id}
                                            className="font-bold text-white bg-gray-600 py-1 px-2 text-center text-[10px]" // Reduced padding
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
                                                        asc: ' ▲',
                                                        desc: ' ▼',
                                                    }[header.column.getIsSorted()] ?? null}
                                                </div>
                                            )}
                                        </TableHead>
                                    ))}

                                </TableRow>

                            ))}
                            {showTotals && <TotalsRow totals={calculateTotals(filteredData)} />}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.map((row, index) => (
                                <TableRow key={row.id} className={index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                                    {row.getVisibleCells().map(cell => (
                                        <TableCell
                                            key={cell.id}
                                            className={`py-0.5 px-2 whitespace-nowrap ${cell.column.id === 'nssf_status'
                                                ? 'border-l-2 border-black'
                                                : ''
                                                }`}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TooltipProvider>
            </ScrollArea>
            {editCompany &&
                <EditDialog
                    company={editCompany}
                    isOpen={dialogOpen}
                    onClose={handleCloseDialog}
                    onSave={handleSaveCompany}
                />}
        </div>
    );
}