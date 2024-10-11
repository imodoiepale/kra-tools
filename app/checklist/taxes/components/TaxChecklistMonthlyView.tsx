// @ts-nocheck
"use client"

import React, { useMemo, useState, useCallback } from 'react';
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
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

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
                    <DialogClose asChild>
                        <Button onClick={handleUpdate}>Update</Button>
                    </DialogClose>
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

const getTaxCategoryLabel = (taxType) => {
    const labels = {
        vat: "VAT Amount",
        paye: "PAYE Amount",
        income_tax_company: "Income Tax",
        nita: "NITA Amount",
        housing_levy: "Housing Levy",
        resident_individual: "Resident Individual Tax",
        rent_income_mri: "Rent Income",
        turnover_tax: "Turnover Tax"
    };
    return labels[taxType] || `${taxType.toUpperCase()} Amount`;
};

const getTaxAmountField = (taxType) => {
    const fields = {
        vat: "vatAmount",
        paye: "payeAmount",
        income_tax_company: "incomeTaxAmount",
        nita: "nitaAmount",
        housing_levy: "housingLevyAmount",
        resident_individual: "residentIndividualAmount",
        rent_income_mri: "rentIncomeAmount",
        turnover_tax: "turnoverTaxAmount"
    };
    return fields[taxType] || `${taxType}Amount`;
};

const updateTaxStatus = async (companyName, year, month, status, taxType, companies) => {
    try {
        const company = companies.find(c => c.company_name === companyName);
        if (!company) {
            throw new Error('Company not found');
        }

        const { data, error } = await supabase
            .from('checklist')
            .select('taxes')
            .eq('company_name', companyName)
            .maybeSingle();

        let existingTaxes = data?.taxes || {};

        const updatedTaxes = {
            ...existingTaxes,
            [taxType]: {
                ...existingTaxes[taxType],
                [year]: {
                    ...existingTaxes[taxType]?.[year],
                    [month]: {
                        ...existingTaxes[taxType]?.[year]?.[month],
                        ...status
                    }
                }
            }
        };

        const upsertData = {
            company_name: companyName,
            kra_pin: company.kra_pin,
            taxes: updatedTaxes
        };

        const { error: upsertError } = await supabase
            .from('checklist')
            .upsert(upsertData, { onConflict: 'company_name' });

        if (upsertError) throw upsertError;

        toast.success('Tax status updated successfully');
        return updatedTaxes;
    } catch (error) {
        console.error('Error updating tax status:', error);
        toast.error('Failed to update tax status');
        throw error;
    }
};

const formatAmount = (amount) => {
    return `Ksh ${Number(amount).toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    })}`;
};

export default function TaxChecklistMonthlyView({ companies, checklist: initialChecklist, taxType, selectedDate }) {
    const [localChecklist, setLocalChecklist] = useState(initialChecklist);
    const year = selectedDate.getFullYear().toString();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');

    const taxCategoryLabel = getTaxCategoryLabel(taxType);
    const taxAmountField = getTaxAmountField(taxType);

    const fetchLatestData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('checklist')
                .select('*')
                .in('company_name', companies.map(c => c.company_name));

            if (error) throw error;

            const newChecklist = {};
            data.forEach(item => {
                newChecklist[item.company_name] = item;
            });

            setLocalChecklist(newChecklist);
        } catch (error) {
            console.error('Error fetching latest data:', error);
            toast.error('Failed to refresh data');
        }
    }, [companies]);

    const handleUpdate = async (companyName, year, month, status) => {
        try {
            await updateTaxStatus(companyName, year, month, status, taxType, companies);
            await fetchLatestData(); // Refetch data after successful update
            toast.success('Updated successfully');
        } catch (error) {
            console.error('Error updating:', error);
            toast.error('Failed to update');
        }
    };


    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => info.getValue(),
            header: '#',
            size: 50,
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
            header: 'Company Name',
            size: 200,
        }),
        columnHelper.accessor(row => {
            const taxData = localChecklist[row.company_name]?.taxes?.[taxType];
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
        columnHelper.accessor(row => localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.itaxSubmitDate, {
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
            header: <div className="text-center">ITAX Submission Date</div>,
            size: 120,
        }),
        columnHelper.accessor(row => localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.submittedBy, {
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
        columnHelper.accessor(row => localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.clientPaymentDate, {
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
        columnHelper.accessor(row => {
            const taxData = localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month];
            return taxData ? taxData[taxAmountField] : undefined;
        }, {
            id: 'taxAmount',
            cell: info => {
                const value = info.getValue();
                return (
                    <UpdateDialog
                        title={`Update ${taxCategoryLabel}`}
                        initialValue={value !== undefined ? value.toString() : ""}
                        onUpdate={(newValue) => handleUpdate(info.row.original.company_name, year, month, { [taxAmountField]: parseFloat(newValue) })}
                        type="amount"
                    >
                        {value !== undefined ? (
                            <Button variant="ghost" size="sm">
                                <span className="text-green-600 font-medium">Ksh {parseFloat(value).toFixed(2)}</span>
                            </Button>
                        ) : (
                            <Button variant="ghost" size="sm">
                                <XCircle className="h-5 w-5 text-red-500" />
                            </Button>
                        )}
                    </UpdateDialog>
                );
            },
            header: <div className="text-center">{taxCategoryLabel} Amount</div>,
            size: 120,
        }),
        columnHelper.accessor(row => localChecklist[row.company_name]?.taxes?.[taxType]?.[year]?.[month]?.advice, {
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
    ], [year, month, localChecklist, taxType, handleUpdate, taxCategoryLabel]);

    const data = useMemo(() =>
        companies.map((company, index) => ({
            ...company,
            index: index + 1,
            checklistData: localChecklist[company.company_name]?.taxes?.[taxType]?.[year]?.[month] || {}
        })),
        [companies, localChecklist, taxType, year, month]
    );

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <div>
            <h2 className="text-md font-bold mb-4 uppercase">
                Checklist - {format(selectedDate, 'MMMM yyyy')}
            </h2>
            <ScrollArea className="h-[600px]">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <TableHead
                                        key={header.id}
                                        className={`font-bold text-white bg-gray-600 text-left ${header.column.id.startsWith('separator') ? 'bg-gray-400' : ''}`}
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
                                        className={`text-left ${cell.column.id.startsWith('separator') ? 'bg-gray-200' : ''}`}
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
        </div>
    );
}