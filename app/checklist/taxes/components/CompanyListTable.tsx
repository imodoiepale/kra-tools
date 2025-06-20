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
import { Edit, Lock, Unlock, FileDown, X, Filter, Eye, EyeOff, Search } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabase';
import { ClientCategoryFilter } from '@/components/ClientCategoryFilter';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const columnHelper = createColumnHelper();

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return format(date, 'dd.MM.yyyy');
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'N/A';
    }
};

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

const StatusBadge = ({ status }) => {
    if (!status) {
        return <X className="h-3 w-3 text-red-500 mx-auto" />;
    }

    const badgeColor = status.toLowerCase() === 'active' ? 'bg-green-500' : 'bg-red-500';

    return (
        <div className="flex justify-center">
            <Badge className={`${badgeColor} text-white text-[8px] px-1 py-0`}>
                {status}
            </Badge>
        </div>
    );
};

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

    const handleDateChange = (field, value) => {
        setEditedCompany(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const CompanyInfoSection = ({ label, fromDateField, toDateField }) => {
        const status = calculateStatus(editedCompany[fromDateField], editedCompany[toDateField]);

        return (
            <div className="p-2 border rounded-md mb-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-2 text-[10px] font-medium">{label}</Label>
                    <Badge className={`col-span-2 justify-center text-[8px] ${status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {status}
                    </Badge>
                    <div className="col-span-8 grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                            <Label className="text-[8px] whitespace-nowrap">From:</Label>
                            <Input
                                type="date"
                                value={editedCompany[fromDateField] || ''}
                                onChange={(e) => handleDateChange(fromDateField, e.target.value)}
                                className="h-6 text-[10px]"
                                disabled={company.is_locked}
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <Label className="text-[8px] whitespace-nowrap">To:</Label>
                            <Input
                                type="date"
                                value={editedCompany[toDateField] || ''}
                                onChange={(e) => handleDateChange(toDateField, e.target.value)}
                                className="h-6 text-[10px]"
                                disabled={company.is_locked}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Edit className="h-3 w-3" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
                {!showDeleteConfirm ? (
                    <>
                        <DialogHeader className="pb-2">
                            <DialogTitle className="text-sm">Edit Company</DialogTitle>
                            <DialogDescription className="text-xs">
                                {company.is_locked
                                    ? "This profile is locked. Unlock to make changes."
                                    : "Make changes to the company profile here."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 py-2">
                            <div className="grid grid-cols-12 gap-2 items-center">
                                <Label className="col-span-2 text-[10px]">Name</Label>
                                <Input
                                    value={editedCompany.company_name}
                                    className="col-span-10 h-6 text-[10px]"
                                    disabled
                                />
                            </div>
                            <div className="grid grid-cols-12 gap-2 items-center">
                                <Label className="col-span-2 text-[10px]">KRA PIN</Label>
                                <Input
                                    value={editedCompany.kra_pin}
                                    className="col-span-10 h-6 text-[10px]"
                                    disabled
                                />
                            </div>

                            <CompanyInfoSection
                                label="ACC"
                                fromDateField="acc_client_effective_from"
                                toDateField="acc_client_effective_to"
                            />
                            <CompanyInfoSection
                                label="IMM"
                                fromDateField="imm_client_effective_from"
                                toDateField="imm_client_effective_to"
                            />
                            <CompanyInfoSection
                                label="Audit"
                                fromDateField="audit_client_effective_from"
                                toDateField="audit_client_effective_to"
                            />
                            <CompanyInfoSection
                                label="Sheria"
                                fromDateField="sheria_client_effective_from"
                                toDateField="sheria_client_effective_from"
                            />
                        </div>

                        <DialogFooter className="flex justify-between pt-2">
                            <div className="flex space-x-2">
                                {!company.is_locked && (
                                    <Button onClick={handleSave} size="sm" className="text-[10px] h-7">Save changes</Button>
                                )}
                                <Button
                                    variant="outline"
                                    onClick={() => onLockToggle(company.id)}
                                    size="sm"
                                    className="text-[10px] h-7"
                                >
                                    {company.is_locked ? 'Unlock Profile' : 'Lock Profile'}
                                </Button>
                            </div>
                            <Button
                                variant="destructive"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={company.is_locked}
                                size="sm"
                                className="text-[10px] h-7"
                            >
                                Delete
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-sm">Confirm Delete</DialogTitle>
                            <DialogDescription className="text-xs">
                                Are you sure you want to delete {company.company_name}? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-end space-x-2 mt-4">
                            <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" size="sm" className="text-[10px] h-7" onClick={handleDelete}>
                                Delete Company
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default function CompanyListTable({ companies = [], updateCompany, toggleLock, deleteCompany, hideFilterButton = false }) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
    const [categoryFilters, setCategoryFilters] = useState({});
    const [showStats, setShowStats] = useState(false);
    const [localCompanies, setLocalCompanies] = useState([]);

    // Update local companies when prop changes
    useEffect(() => {
        if (Array.isArray(companies) && companies.length > 0) {
            setLocalCompanies(companies);
        } else {
            // Fallback to fetch companies if none are provided
            fetchCompanies();
        }
    }, [companies]);

    const fetchCompanies = async () => {
        const { data, error } = await supabase
            .from('acc_portal_company_duplicate')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching companies:', error);
            toast.error('Failed to fetch companies');
            return;
        }

        setLocalCompanies(data);
    };

    const handleUpdateCompany = async (updatedCompany) => {
        try {
            // Use passed-in updateCompany if available, otherwise fall back to local update
            if (typeof updateCompany === 'function') {
                updateCompany(updatedCompany);
                toast.success('Company updated successfully');
            } else {
                const { data, error } = await supabase
                    .from('acc_portal_company_duplicate')
                    .upsert({
                        id: updatedCompany.id,
                        acc_client_effective_from: updatedCompany.acc_client_effective_from,
                        acc_client_effective_to: updatedCompany.acc_client_effective_to,
                        imm_client_effective_from: updatedCompany.imm_client_effective_from,
                        imm_client_effective_to: updatedCompany.imm_client_effective_to,
                        audit_client_effective_from: updatedCompany.audit_client_effective_from,
                        audit_client_effective_to: updatedCompany.audit_client_effective_to,
                        sheria_client_effective_from: updatedCompany.sheria_client_effective_from,
                        sheria_client_effective_from: updatedCompany.sheria_client_effective_from,
                        is_locked: updatedCompany.is_locked
                    });

                if (error) throw error;
                toast.success('Company updated successfully');
                await fetchCompanies();
            }
        } catch (error) {
            console.error('Error updating company:', error);
            toast.error('Failed to update company');
        }
    };

    const handleDeleteCompany = async (companyId) => {
        try {
            // If there's a parent delete function, use it
            if (typeof deleteCompany === 'function') {
                deleteCompany(companyId);
                toast.success('Company deleted successfully');
            } else {
                // Otherwise, handle deletion locally
                const { error } = await supabase
                    .from('acc_portal_company_duplicate')
                    .delete()
                    .eq('id', companyId);

                if (error) throw error;
                toast.success('Company deleted successfully');
                await fetchCompanies();
            }
        } catch (error) {
            console.error('Error deleting company:', error);
            toast.error('Failed to delete company');
        }
    };

    const handleToggleLock = async (companyId) => {
        const companyToUpdate = localCompanies.find(c => c.id === companyId);
        if (!companyToUpdate) return;

        const updatedCompany = { ...companyToUpdate, is_locked: !companyToUpdate.is_locked };

        // Use passed-in toggleLock if available, otherwise fall back to handleUpdateCompany
        if (typeof toggleLock === 'function') {
            toggleLock(companyId);
        } else {
            await handleUpdateCompany(updatedCompany);
        }
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
        columnHelper.accessor('audit_client_effective_from', {
            cell: info => formatDate(info.getValue()),
            header: 'Audit From',
        }),
        columnHelper.accessor('audit_client_effective_to', {
            cell: info => formatDate(info.getValue()),
            header: 'Audit To',
        }),
        columnHelper.accessor('audit_status', {
            cell: info => <StatusBadge status={calculateStatus(info.row.original.audit_client_effective_from, info.row.original.audit_client_effective_to)} />,
            header: 'Audit Status',
        }),
        columnHelper.accessor('sheria_client_effective_from', {
            cell: info => formatDate(info.getValue()),
            header: 'Sheria From',
        }),
        columnHelper.accessor('sheria_client_effective_from', {
            cell: info => formatDate(info.getValue()),
            header: 'Sheria To',
        }),
        columnHelper.accessor('sheria_status', {
            cell: info => <StatusBadge status={calculateStatus(info.row.original.sheria_client_effective_from, info.row.original.sheria_client_effective_from)} />,
            header: 'Sheria Status',
        }),
        columnHelper.accessor('actions', {
            cell: info => (
                <div className="flex justify-center space-x-1">
                    <EditCompanyDialog
                        company={info.row.original}
                        onSave={handleUpdateCompany}
                        onLockToggle={handleToggleLock}
                        onDelete={handleDeleteCompany}
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleLock(info.row.original.id)}
                        className={`h-6 w-6 p-0 ${info.row.original.is_locked ? "bg-green-100" : "bg-red-100"}`}
                    >
                        {info.row.original.is_locked ? (
                            <Lock className="h-3 w-3 text-green-500" />
                        ) : (
                            <Unlock className="h-3 w-3 text-red-500" />
                        )}
                    </Button>
                </div>
            ),
            header: 'Actions',
        }),
    ], [handleUpdateCompany, handleToggleLock, handleDeleteCompany]);

    // Apply category filters to data
    const filteredData = useMemo(() => {
        if (Object.keys(categoryFilters).length === 0) return localCompanies;

        return localCompanies.filter(item => {
            // Check if any category filter is active
            const hasActiveFilters = Object.values(categoryFilters).some(categoryStatus =>
                Object.values(categoryStatus as Record<string, boolean>).some(isSelected => isSelected)
            );

            if (!hasActiveFilters) return true;

            // Get the item's category and status
            const accStatus = calculateStatus(item.acc_client_effective_from, item.acc_client_effective_to);
            const immStatus = calculateStatus(item.imm_client_effective_from, item.imm_client_effective_to);
            const auditStatus = calculateStatus(item.audit_client_effective_from, item.audit_client_effective_to);
            const sheriaStatus = calculateStatus(item.sheria_client_effective_from, item.sheria_client_effective_from);

            // Check if ACC category filter matches
            if (categoryFilters['acc']) {
                const accFilter = categoryFilters['acc'] as Record<string, boolean>;
                if ((accStatus === 'Active' && accFilter['active']) ||
                    (accStatus === 'Inactive' && accFilter['inactive']) ||
                    accFilter['all']) {
                    return true;
                }
            }

            // Check if IMM category filter matches
            if (categoryFilters['imm']) {
                const immFilter = categoryFilters['imm'] as Record<string, boolean>;
                if ((immStatus === 'Active' && immFilter['active']) ||
                    (immStatus === 'Inactive' && immFilter['inactive']) ||
                    immFilter['all']) {
                    return true;
                }
            }

            // Check if Audit category filter matches
            if (categoryFilters['audit']) {
                const auditFilter = categoryFilters['audit'] as Record<string, boolean>;
                if ((auditStatus === 'Active' && auditFilter['active']) ||
                    (auditStatus === 'Inactive' && auditFilter['inactive']) ||
                    auditFilter['all']) {
                    return true;
                }
            }

            // Check if Sheria category filter matches
            if (categoryFilters['sheria']) {
                const sheriaFilter = categoryFilters['sheria'] as Record<string, boolean>;
                if ((sheriaStatus === 'Active' && sheriaFilter['active']) ||
                    (sheriaStatus === 'Inactive' && sheriaFilter['inactive']) ||
                    sheriaFilter['all']) {
                    return true;
                }
            }

            // Check if 'all' category has this status selected
            if (categoryFilters['all']) {
                const allFilter = categoryFilters['all'] as Record<string, boolean>;
                if (allFilter['all'] ||
                    (accStatus === 'Active' && allFilter['active']) ||
                    (accStatus === 'Inactive' && allFilter['inactive']) ||
                    (immStatus === 'Active' && allFilter['active']) ||
                    (immStatus === 'Inactive' && allFilter['inactive']) ||
                    (auditStatus === 'Active' && allFilter['active']) ||
                    (auditStatus === 'Inactive' && allFilter['inactive']) ||
                    (sheriaStatus === 'Active' && allFilter['active']) ||
                    (sheriaStatus === 'Inactive' && allFilter['inactive'])) {
                    return true;
                }
            }

            return false;
        });
    }, [companies, categoryFilters]);

    // Calculate statistics for complete and missing entries
    const calculateStats = () => {
        const stats = {
            complete: {},
            missing: {}
        };

        // Define fields to check for completeness
        const fieldsToCheck = [
            'company_name',
            'acc_client_effective_from',
            'acc_client_effective_to',
            'imm_client_effective_from',
            'imm_client_effective_to',
            'audit_client_effective_from',
            'audit_client_effective_to',
            'sheria_client_effective_from',
            'sheria_client_effective_from'
        ];

        // Initialize stats for each field
        fieldsToCheck.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        // Calculate stats for each field individually
        filteredData.forEach(item => {
            fieldsToCheck.forEach(field => {
                if (item[field] && item[field].toString().trim() !== '') {
                    stats.complete[field]++;
                } else {
                    stats.missing[field]++;
                }
            });
        });

        return stats;
    };

    const stats = calculateStats();

    const table = useReactTable({
        data: filteredData,
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

        worksheet.addRow([
            '#',
            'Company Name',
            'ACC From',
            'ACC To',
            'ACC Status',
            'IMM From',
            'IMM To',
            'IMM Status',
            'Audit From',
            'Audit To',
            'Audit Status',
            'Sheria From',
            'Sheria To',
            'Sheria Status'
        ]);

        filteredData.forEach((company, index) => {
            worksheet.addRow([
                index + 1,
                company.company_name,
                formatDate(company.acc_client_effective_from),
                formatDate(company.acc_client_effective_to),
                calculateStatus(company.acc_client_effective_from, company.acc_client_effective_to),
                formatDate(company.imm_client_effective_from),
                formatDate(company.imm_client_effective_to),
                calculateStatus(company.imm_client_effective_from, company.imm_client_effective_to),
                formatDate(company.audit_client_effective_from),
                formatDate(company.audit_client_effective_to),
                calculateStatus(company.audit_client_effective_from, company.audit_client_effective_to),
                formatDate(company.sheria_client_effective_from),
                formatDate(company.sheria_client_effective_from),
                calculateStatus(company.sheria_client_effective_from, company.sheria_client_effective_from),
            ]);
        });

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
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <div className="flex space-x-2 items-center">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                        <Input
                            placeholder="Search companies..."
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="max-w-sm text-[10px] h-7 pl-7"
                        />
                    </div>
                    {!hideFilterButton && (
                        <Button variant="outline" size="sm" onClick={() => setIsCategoryFilterOpen(true)} className="text-[10px] h-7">
                            <Filter className="mr-1 h-3 w-3" /> Categories Filters
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setShowStats(!showStats)} className="text-[10px] h-7">
                        {showStats ? (
                            <>
                                <EyeOff className="mr-1 h-3 w-3" /> Hide Statistics
                            </>
                        ) : (
                            <>
                                <Eye className="mr-1 h-3 w-3" /> Show Statistics
                            </>
                        )}
                    </Button>
                </div>
                <Button onClick={exportToExcel} size="sm" className="text-[10px] h-7">
                    <FileDown className="mr-1 h-3 w-3" />
                    Export to Excel
                </Button>
            </div>
            <ClientCategoryFilter
                isOpen={isCategoryFilterOpen}
                onClose={() => setIsCategoryFilterOpen(false)}
                onApplyFilters={(filters) => setCategoryFilters(filters)}
                onClearFilters={() => setCategoryFilters({})}
                selectedFilters={categoryFilters}
            />
            <ScrollArea className="h-[750px] mb-10 pb-8">
                <Table className="text-[10px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead rowSpan={2} className="font-bold text-black bg-gray-300 text-center border border-gray-400 p-1 text-[10px]">#</TableHead>
                            <TableHead rowSpan={2} className="font-bold text-black bg-gray-300 text-left border border-gray-400 p-1 text-[10px]">Company Name</TableHead>
                            <TableHead colSpan={3} className="font-bold text-black bg-green-100 text-center border border-gray-400 p-1 text-[10px]">ACC</TableHead>
                            <TableHead colSpan={3} className="font-bold text-black bg-blue-100 text-center border border-gray-400 p-1 text-[10px]">IMM</TableHead>
                            <TableHead colSpan={3} className="font-bold text-black bg-yellow-100 text-center border border-gray-400 p-1 text-[10px]">Audit</TableHead>
                            <TableHead colSpan={3} className="font-bold text-black bg-pink-100 text-center border border-gray-400 p-1 text-[10px]">Sheria</TableHead>
                            <TableHead rowSpan={2} className="font-bold text-black bg-gray-300 text-center border border-gray-400 p-1 text-[10px]">Actions</TableHead>
                        </TableRow>
                        <TableRow>
                            {['ACC', 'IMM', 'Audit', 'Sheria'].map((section) => (
                                <React.Fragment key={section}>
                                    <TableHead className={`font-bold text-black ${section === 'ACC' ? 'bg-green-50' :
                                        section === 'IMM' ? 'bg-blue-50' :
                                            section === 'Audit' ? 'bg-yellow-50' :
                                                'bg-pink-50'
                                        } text-center border border-gray-400 p-1 text-[10px]`}>From</TableHead>
                                    <TableHead className={`font-bold text-black ${section === 'ACC' ? 'bg-green-50' :
                                        section === 'IMM' ? 'bg-blue-50' :
                                            section === 'Audit' ? 'bg-yellow-50' :
                                                'bg-pink-50'
                                        } text-center border border-gray-400 p-1 text-[10px]`}>To</TableHead>
                                    <TableHead className={`font-bold text-black ${section === 'ACC' ? 'bg-green-50' :
                                        section === 'IMM' ? 'bg-blue-50' :
                                            section === 'Audit' ? 'bg-yellow-50' :
                                                'bg-pink-50'
                                        } text-center border border-gray-400 p-1 text-[10px]`}>Status</TableHead>
                                </React.Fragment>
                            ))}
                        </TableRow>
                        {showStats && (
                            <>
                                <TableRow>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">Complete</TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.complete.company_name || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.complete.acc_client_effective_from || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.complete.acc_client_effective_to || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">-</TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.complete.imm_client_effective_from || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.complete.imm_client_effective_to || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">-</TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.complete.audit_client_effective_from || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.complete.audit_client_effective_to || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">-</TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.complete.sheria_client_effective_from || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.complete.sheria_client_effective_from || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">-</TableHead>
                                    <TableHead className="font-bold text-black bg-blue-50 text-center border border-gray-400 p-1 text-[10px]">-</TableHead>
                                </TableRow>
                                <TableRow>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">Missing</TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.missing.company_name || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.missing.acc_client_effective_from || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.missing.acc_client_effective_to || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">-</TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.missing.imm_client_effective_from || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.missing.imm_client_effective_to || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">-</TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.missing.audit_client_effective_from || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.missing.audit_client_effective_to || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">-</TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.missing.sheria_client_effective_from || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">
                                        {stats.missing.sheria_client_effective_from || 0}
                                    </TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">-</TableHead>
                                    <TableHead className="font-bold text-black bg-red-50 text-center border border-gray-400 p-1 text-[10px]">-</TableHead>
                                </TableRow>
                            </>
                        )}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.map(row => (
                            <TableRow key={row.id} className={`${row.index % 2 === 0 ? 'bg-blue-50' : 'bg-white'} h-6`}>
                                {row.getVisibleCells().map(cell => (
                                    <TableCell
                                        key={cell.id}
                                        className={`p-1 ${cell.column.id === 'company_name'
                                            ? 'text-left'
                                            : cell.column.id === 'index'
                                                ? 'text-center w-8'
                                                : 'text-center'
                                            } border border-gray-200`}
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