// @ts-nocheck
"use client"

import React, { useState, useEffect, useMemo } from 'react';
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Edit, Lock, Unlock, FileDown, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabase';

const columnHelper = createColumnHelper();

// EditCompanyDialog component
const EditCompanyDialog = ({ company, onSave, onLockToggle }) => {
    const [editedCompany, setEditedCompany] = useState(company);

    const handleSave = () => {
        onSave(editedCompany);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Edit className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Company</DialogTitle>
                    <DialogDescription>
                        {company.is_locked ? "This profile is locked. Unlock to make changes." : "Make changes to the company profile here."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input
                            id="name"
                            value={editedCompany.company_name}
                            className="col-span-3"
                            disabled
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="kra_pin" className="text-right">KRA PIN</Label>
                        <Input
                            id="kra_pin"
                            value={editedCompany.kra_pin}
                            className="col-span-3"
                            disabled
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right">Status</Label>
                        <Select
                            onValueChange={(value) => setEditedCompany({...editedCompany, status: value})}
                            defaultValue={editedCompany.status || ''}
                            disabled={company.is_locked}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">Category</Label>
                        <Select
                            onValueChange={(value) => setEditedCompany({...editedCompany, category: value})}
                            defaultValue={editedCompany.category}
                            disabled={company.is_locked}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="IMM + ACC">IMM + ACC</SelectItem>
                                <SelectItem value="IMM">IMM</SelectItem>
                                <SelectItem value="ACC">ACC</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    {!company.is_locked && <Button onClick={handleSave}>Save changes</Button>}
                    <Button variant="outline" onClick={() => onLockToggle(company.id)}>
                        {company.is_locked ? 'Unlock Profile' : 'Lock Profile'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const StatusBadge = ({ status }) => {
    if (!status) {
        return <X className="h-4 w-4 text-red-500 mx-auto" />;
    }

    const badgeColor = status.toLowerCase() === 'active' ? 'bg-green-500' : 'bg-red-500';

    return (
        <div className="flex justify-center">
            <Badge className={`${badgeColor} text-white`}>
                {status}
            </Badge>
        </div>
    );
};

// Main CompanyListTable component
export default function CompanyListTable() {
    const [companies, setCompanies] = useState([]);
    const [globalFilter, setGlobalFilter] = useState('');

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        // Fetch data from PasswordChecker table
        const { data: passwordCheckerData, error: passwordCheckerError } = await supabase
            .from('PasswordChecker')
            .select('id, company_name, kra_pin')
            .order('id', { ascending: true });

        if (passwordCheckerError) {
            console.error('Error fetching from PasswordChecker:', passwordCheckerError);
            return;
        }

        // Fetch data from companyMainList table
        const { data: companyMainListData, error: companyMainListError } = await supabase
            .from('companyMainList')
            .select('*')
            .order('id', { ascending: true });

        if (companyMainListError) {
            console.error('Error fetching from companyMainList:', companyMainListError);
            return;
        }

        // Combine the data, using companyMainList data if available, otherwise use PasswordChecker data
        const combinedData = passwordCheckerData.map(pcData => {
            const mainListData = companyMainListData.find(cmData => cmData.id === pcData.id);
            return {
                ...pcData,
                ...mainListData
            };
        });

        setCompanies(combinedData);
    };

    const upsertCompany = async (updatedCompany) => {
        const { data, error } = await supabase
            .from('companyMainList')
            .upsert({
                id: updatedCompany.id,
                company_name: updatedCompany.company_name,
                kra_pin: updatedCompany.kra_pin,
                status: updatedCompany.status,
                category: updatedCompany.category,
                is_locked: updatedCompany.is_locked
            }, { onConflict: 'id' })
            .select();

        if (error) {
            console.error('Error upserting company:', error);
        } else {
            fetchCompanies(); // Refresh the list after update
        }
    };

    const toggleLock = async (companyId) => {
        const companyToUpdate = companies.find(c => c.id === companyId);
        if (!companyToUpdate) return;

        const updatedCompany = { ...companyToUpdate, is_locked: !companyToUpdate.is_locked };
        await upsertCompany(updatedCompany);
    };

    const columns = [
        columnHelper.accessor('index', {
            cell: info => info.row.index + 1,
            header: '#',
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
            header: 'Company Name',
        }),
        columnHelper.accessor('kra_pin', {
            cell: info => info.getValue() ? info.getValue() : <span className="font-bold text-red-500">MISSING</span>,
            header: 'KRA PIN',
        }),
        columnHelper.accessor('status', {
            cell: info => <StatusBadge status={info.getValue()} />,
            header: 'Status',
        }),
        columnHelper.accessor('category', {
            cell: info => info.getValue(),
            header: 'Category',
        }),
        columnHelper.accessor('actions', {
            cell: info => (
                <div className="flex justify-center space-x-2">
                    <EditCompanyDialog
                        company={info.row.original}
                        onSave={upsertCompany}
                        onLockToggle={toggleLock}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleLock(info.row.original.id)}
                        className={info.row.original.is_locked ? "bg-green-100" : "bg-red-100"}
                    >
                        {info.row.original.is_locked ? (
                            <Lock className="h-4 w-4 text-green-500" />
                        ) : (
                            <Unlock className="h-4 w-4 text-red-500" />
                        )}
                    </Button>
                </div>
            ),
            header: 'Actions',
        }),
    ];

    const table = useReactTable({
        data: companies,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, filterValue) => {
            const searchValue = filterValue.toLowerCase();
            return Object.values(row.original).some(value => 
                String(value).toLowerCase().includes(searchValue)
            );
        },
        state: {
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
    });

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Companies');

        // Add headers
        worksheet.addRow(['#', 'Company Name', 'KRA PIN', 'Status', 'Category']);

        // Add data
        companies.forEach((company, index) => {
            worksheet.addRow([
                index + 1,
                company.company_name,
                company.kra_pin,
                company.status || 'No Status',
                company.category
            ]);
        });

        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'companies.xlsx';
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
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
            <ScrollArea className="h-[800px]">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <TableHead 
                                        key={header.id} 
                                        className={`font-bold text-white bg-gray-600 ${header.column.id === 'company_name' ? 'text-left' : 'text-center'}`}
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
                                        className={
                                            cell.column.id === 'company_name' 
                                                ? 'text-left' 
                                                : cell.column.id === 'index' 
                                                    ? 'text-center w-12' 
                                                    : 'text-center'
                                        }
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