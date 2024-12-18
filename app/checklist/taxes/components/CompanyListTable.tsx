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
import { toast } from 'react-hot-toast';
import { format, parse } from 'date-fns';

const columnHelper = createColumnHelper();

// Helper function to format dates
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const parsedDate = parse(dateString, 'yyyy-MM-dd', new Date());
    return format(parsedDate, 'dd.MM.yyyy');
};

// Ensure correct status calculation
const calculateStatus = (from, to) => {
    const currentDate = new Date('2024-12-18T08:51:43+03:00');
    if (!from || !to) return 'Inactive';
    const fromDate = parse(from, 'yyyy-MM-dd', new Date());
    const toDate = parse(to, 'yyyy-MM-dd', new Date());
    return fromDate <= currentDate && currentDate <= toDate ? 'Active' : 'Inactive';
};

// EditCompanyDialog component
const EditCompanyDialog = ({ company, onSave, onLockToggle, onDelete }) => {
    const [editedCompany, setEditedCompany] = useState(company);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleSave = () => {
        onSave(editedCompany);
    };

    const handleDelete = () => {
        onDelete(company.id);
        setShowDeleteConfirm(false);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Edit className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                {!showDeleteConfirm ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Edit Company</DialogTitle>
                            <DialogDescription>
                                {company.is_locked ? "This profile is locked. Unlock to make changes." : "Make changes to the company profile here."}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="name" className="text-right">Name</Label>
                                <Input
                                    id="name"
                                    value={editedCompany.company_name}
                                    className="col-span-2"
                                    disabled
                                />
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="kra_pin" className="text-right">KRA PIN</Label>
                                <Input
                                    id="kra_pin"
                                    value={editedCompany.kra_pin}
                                    className="col-span-2"
                                    disabled
                                />
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="acc_status" className="text-right">ACC Status</Label>
                                <Input
                                    id="acc_status"
                                    value={editedCompany.acc_status || 'N/A'}
                                    className="col-span-1"
                                    disabled
                                />
                                <Label htmlFor="acc_dates" className="text-right">ACC Dates</Label>
                                <Input
                                    id="acc_from"
                                    value={formatDate(editedCompany.acc_client_effective_from) || 'N/A'}
                                    className="col-span-1"
                                />
                                <Input
                                    id="acc_to"
                                    value={formatDate(editedCompany.acc_client_effective_to) || 'N/A'}
                                    className="col-span-1"
                                />
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="imm_status" className="text-right">IMM Status</Label>
                                <Input
                                    id="imm_status"
                                    value={editedCompany.imm_status || 'N/A'}
                                    className="col-span-1"
                                    disabled
                                />
                                <Label htmlFor="imm_dates" className="text-right">IMM Dates</Label>
                                <Input
                                    id="imm_from"
                                    value={formatDate(editedCompany.imm_client_effective_from) || 'N/A'}
                                    className="col-span-1"
                                />
                                <Input
                                    id="imm_to"
                                    value={formatDate(editedCompany.imm_client_effective_to) || 'N/A'}
                                    className="col-span-1"
                                />
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="audit_status" className="text-right">Audit Status</Label>
                                <Input
                                    id="audit_status"
                                    value={editedCompany.audit_status || 'N/A'}
                                    className="col-span-1"
                                    disabled
                                />
                                <Label htmlFor="audit_dates" className="text-right">Audit Dates</Label>
                                <Input
                                    id="audit_from"
                                    value={formatDate(editedCompany.audit_tax_client_effective_from) || 'N/A'}
                                    className="col-span-1"
                                />
                                <Input
                                    id="audit_to"
                                    value={formatDate(editedCompany.audit_tax_client_effective_to) || 'N/A'}
                                    className="col-span-1"
                                />
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="sheria_status" className="text-right">Sheria Status</Label>
                                <Input
                                    id="sheria_status"
                                    value={editedCompany.sheria_status || 'N/A'}
                                    className="col-span-1"
                                    disabled
                                />
                                <Label htmlFor="sheria_dates" className="text-right">Sheria Dates</Label>
                                <Input
                                    id="sheria_from"
                                    value={formatDate(editedCompany.cps_sheria_client_effective_from) || 'N/A'}
                                    className="col-span-1"
                                />
                                <Input
                                    id="sheria_to"
                                    value={formatDate(editedCompany.cps_sheria_client_effective_to) || 'N/A'}
                                    className="col-span-1"
                                />
                            </div>
                        </div>
                        <DialogFooter className="flex justify-between space-x-2">
                            <div className="flex space-x-2">
                                {!company.is_locked && <Button onClick={handleSave}>Save changes</Button>}
                                <Button variant="outline" onClick={() => onLockToggle(company.id)}>
                                    {company.is_locked ? 'Unlock Profile' : 'Lock Profile'}
                                </Button>
                            </div>
                            <Button 
                                variant="destructive" 
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={company.is_locked}
                            >
                                Delete
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Confirm Delete</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete {company.company_name}? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-end space-x-2 mt-4">
                            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDelete}>
                                Delete Company
                            </Button>
                        </div>
                    </>
                )}
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
        // Fetch data from acc_portal_company_duplicate table
        const { data, error } = await supabase
            .from('acc_portal_company_duplicate')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching from acc_portal_company_duplicate:', error);
            return;
        }

        setCompanies(data);
    };

    const upsertCompany = async (updatedCompany) => {
        const { data, error } = await supabase
            .from('companyMainList')
            .upsert({
                id: updatedCompany.id,
                company_name: updatedCompany.company_name,
                kra_pin: updatedCompany.kra_pin,
                status: updatedCompany.status,
                is_locked: updatedCompany.is_locked
            }, { onConflict: 'id' })
            .select();

        if (error) {
            console.error('Error upserting company:', error);
        } else {
            fetchCompanies(); // Refresh the list after update
        }
    };

    const deleteCompany = async (companyId) => {
        try {
            const { error } = await supabase
                .from('companyMainList')
                .delete()
                .eq('id', companyId);
    
            if (error) throw error;
            
            toast.success('Company deleted successfully');
            fetchCompanies(); // Refresh the list
        } catch (error) {
            console.error('Error deleting company:', error);
            toast.error('Failed to delete company');
        }
    };
    

    const toggleLock = async (companyId) => {
        const companyToUpdate = companies.find(c => c.id === companyId);
        if (!companyToUpdate) return;

        const updatedCompany = { ...companyToUpdate, is_locked: !companyToUpdate.is_locked };
        await upsertCompany(updatedCompany);
    };

    const columns = useMemo(() => [
        columnHelper.accessor('index', {
            cell: info => info.row.index + 1,
            header: '#',
        }),
        columnHelper.accessor('company_name', {
            cell: info => info.getValue(),
            header: 'Company Name',
        }),
        columnHelper.accessor('acc_client_effective_from', {
            cell: info => formatDate(info.getValue()),
            header: 'ACC From',
        }),
        columnHelper.accessor('acc_client_effective_to', {
            cell: info => formatDate(info.getValue()),
            header: 'ACC To',
        }),
        columnHelper.accessor('acc_status', {
            cell: info => <StatusBadge status={calculateStatus(info.row.original.acc_client_effective_from, info.row.original.acc_client_effective_to)} />,
            header: 'ACC Status',
        }),
        columnHelper.accessor('imm_client_effective_from', {
            cell: info => formatDate(info.getValue()),
            header: 'IMM From',
        }),
        columnHelper.accessor('imm_client_effective_to', {
            cell: info => formatDate(info.getValue()),
            header: 'IMM To',
        }),
        columnHelper.accessor('imm_status', {
            cell: info => <StatusBadge status={calculateStatus(info.row.original.imm_client_effective_from, info.row.original.imm_client_effective_to)} />,
            header: 'IMM Status',
        }),
        columnHelper.accessor('audit_tax_client_effective_from', {
            cell: info => formatDate(info.getValue()),
            header: 'Audit From',
        }),
        columnHelper.accessor('audit_tax_client_effective_to', {
            cell: info => formatDate(info.getValue()),
            header: 'Audit To',
        }),
        columnHelper.accessor('audit_status', {
            cell: info => <StatusBadge status={calculateStatus(info.row.original.audit_tax_client_effective_from, info.row.original.audit_tax_client_effective_to)} />,
            header: 'Audit Status',
        }),
        columnHelper.accessor('cps_sheria_client_effective_from', {
            cell: info => formatDate(info.getValue()),
            header: 'Sheria From',
        }),
        columnHelper.accessor('cps_sheria_client_effective_to', {
            cell: info => formatDate(info.getValue()),
            header: 'Sheria To',
        }),
        columnHelper.accessor('sheria_status', {
            cell: info => <StatusBadge status={calculateStatus(info.row.original.cps_sheria_client_effective_from, info.row.original.cps_sheria_client_effective_to)} />,
            header: 'Sheria Status',
        }),
        columnHelper.accessor('actions', {
            cell: info => (
                <div className="flex justify-center space-x-2">
                    <EditCompanyDialog
                        company={info.row.original}
                        onSave={upsertCompany}
                        onLockToggle={toggleLock}
                        onDelete={deleteCompany}
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
    ], [upsertCompany, toggleLock, deleteCompany]);

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
        worksheet.addRow(['#', 'Company Name', 'KRA PIN', 'Status', 'ACC From', 'ACC To', 'Audit From', 'Audit To', 'Sheria From', 'Sheria To', 'IMM From', 'IMM To']);

        // Add data
        companies.forEach((company, index) => {
            worksheet.addRow([
                index + 1,
                company.company_name,
                company.kra_pin,
                company.status || 'No Status',
                formatDate(company.acc_client_effective_from) || 'N/A',
                formatDate(company.acc_client_effective_to) || 'N/A',
                formatDate(company.audit_tax_client_effective_from) || 'N/A',
                formatDate(company.audit_tax_client_effective_to) || 'N/A',
                formatDate(company.cps_sheria_client_effective_from) || 'N/A',
                formatDate(company.cps_sheria_client_effective_to) || 'N/A',
                formatDate(company.imm_client_effective_from) || 'N/A',
                formatDate(company.imm_client_effective_to) || 'N/A',
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
            <ScrollArea className="h-[750px] text-xs">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead rowSpan={2} className="font-bold text-black bg-gray-300 text-center border border-gray-400">#</TableHead>
                            <TableHead rowSpan={2} className="font-bold text-black bg-gray-300 text-left border border-gray-400">Company Name</TableHead>
                            <TableHead colSpan={3} className="font-bold text-black bg-green-100 text-center border border-gray-400">ACC</TableHead>
                            <TableHead colSpan={3} className="font-bold text-black bg-blue-100 text-center border border-gray-400">IMM</TableHead>
                            <TableHead colSpan={3} className="font-bold text-black bg-yellow-100 text-center border border-gray-400">Audit</TableHead>
                            <TableHead colSpan={3} className="font-bold text-black bg-pink-100 text-center border border-gray-400">Sheria</TableHead>
                            <TableHead rowSpan={2} className="font-bold text-black bg-gray-300 text-center border border-gray-400">Actions</TableHead>
                        </TableRow>
                        <TableRow>
                            <TableHead className="font-bold text-black bg-green-50 text-center border border-gray-400">From</TableHead>
                            <TableHead className="font-bold text-black bg-green-50 text-center border border-gray-400">To</TableHead>
                            <TableHead className="font-bold text-black bg-green-50 text-center border border-gray-400">Status</TableHead>
                            <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400">From</TableHead>
                            <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400">To</TableHead>
                            <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400">Status</TableHead>
                            <TableHead className="font-bold text-black bg-yellow-50 text-center border border-gray-400">From</TableHead>
                            <TableHead className="font-bold text-black bg-yellow-50 text-center border border-gray-400">To</TableHead>
                            <TableHead className="font-bold text-black bg-yellow-50 text-center border border-gray-400">Status</TableHead>
                            <TableHead className="font-bold text-black bg-pink-50 text-center border border-gray-400">From</TableHead>
                            <TableHead className="font-bold text-black bg-pink-50 text-center border border-gray-400">To</TableHead>
                            <TableHead className="font-bold text-black bg-pink-50 text-center border border-gray-400">Status</TableHead>
                        </TableRow>
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