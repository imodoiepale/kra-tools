// @ts-nocheck
import React from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuGroup,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FileText, Building } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export type FilterStatus = 'all' | 'active' | 'inactive';

export interface FilterWithStatus {
    key: string;
    status: FilterStatus;
}

interface BankStatementFiltersProps {
    onStatementFilterChange: (selectedFilters: FilterWithStatus[]) => void;
    selectedStatementFilters?: FilterWithStatus[];
    onClientTypeChange: (selectedFilters: FilterWithStatus[]) => void;
    selectedClientTypes?: FilterWithStatus[];
}

const clientTypeCategories = [
    { label: 'ACC Clients', key: 'acc' },
    { label: 'Audit & Tax Clients', key: 'audit_tax' },
    { label: 'CPS/Sheria Clients', key: 'cps_sheria' },
    { label: 'IMM Clients', key: 'imm' }
];

const bankStatementFilters = [
    { label: 'Validated', key: 'validated' },
    { label: 'Pending Validation', key: 'pending_validation' },
    { label: 'With Issues', key: 'has_issues' },
    { label: 'Reconciled', key: 'reconciled' },
    { label: 'Pending Reconciliation', key: 'pending_reconciliation' }
];

export function BankStatementFilters({
    onStatementFilterChange,
    selectedStatementFilters = [],
    onClientTypeChange,
    selectedClientTypes = [],
}: BankStatementFiltersProps) {

    const handleFilterToggle = (key: string, selectedFilters: FilterWithStatus[], onChange: (filters: FilterWithStatus[]) => void) => {
        const isSelected = selectedFilters.some(f => f.key === key);
        let newFilters: FilterWithStatus[];
        if (isSelected) {
            newFilters = selectedFilters.filter(f => f.key !== key);
        } else {
            newFilters = [...selectedFilters, { key, status: 'active' }];
        }
        onChange(newFilters);
    };

    const handleStatusChange = (key: string, status: FilterStatus, selectedFilters: FilterWithStatus[], onChange: (filters: FilterWithStatus[]) => void) => {
        const isSelected = selectedFilters.some(f => f.key === key);
        if (!isSelected) return;

        const newFilters = selectedFilters.map(f =>
            f.key === key ? { ...f, status } : f
        );
        onChange(newFilters);
    };

    const getFilterStatus = (filters: FilterWithStatus[], key: string): FilterStatus => {
        return filters.find(f => f.key === key)?.status || 'active';
    };

    const getStatusBadgeText = (status: FilterStatus): string => {
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    const selectedStatementCount = selectedStatementFilters.length;
    const selectedClientTypeCount = selectedClientTypes.length;

    const renderFilterGroup = (
        title: string,
        categories: { label: string; key: string }[],
        selectedFilters: FilterWithStatus[],
        onChange: (filters: FilterWithStatus[]) => void
    ) => (
        <>
            <label className="flex items-center space-x-2 mb-3 cursor-pointer">
                <Checkbox
                    checked={selectedFilters.length === 0}
                    onCheckedChange={() => onChange([])}
                    className="h-4 w-4"
                />
                <span className="text-sm font-medium">{title}</span>
            </label>
            <DropdownMenuSeparator className="my-2" />
            {categories.map((filter) => {
                const isSelected = selectedFilters.some(f => f.key === filter.key);
                const currentStatus = getFilterStatus(selectedFilters, filter.key);
                return (
                    <DropdownMenuGroup key={filter.key}>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="px-0 py-1.5 cursor-pointer">
                                <div className="flex items-center space-x-2 w-full">
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => handleFilterToggle(filter.key, selectedFilters, onChange)}
                                        className="h-4 w-4"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex flex-1 items-center justify-between">
                                        <span className="text-sm">{filter.label}</span>
                                        {isSelected && (
                                            <Badge variant="secondary" className="text-xs mr-2">
                                                {getStatusBadgeText(currentStatus)}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-36">
                                {['all', 'active', 'inactive'].map((status) => (
                                    <DropdownMenuItem
                                        key={status}
                                        className="cursor-pointer"
                                        disabled={!isSelected}
                                        onClick={() => handleStatusChange(filter.key, status as FilterStatus, selectedFilters, onChange)}
                                    >
                                        <Checkbox
                                            checked={currentStatus === status}
                                            className="h-4 w-4 mr-2"
                                        />
                                        <span>{status === 'active' ? 'Active Only' : status === 'inactive' ? 'Inactive Only' : 'All'}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    </DropdownMenuGroup>
                );
            })}
        </>
    );

    return (
        <div className="flex gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 flex items-center">
                        <Building className="mr-2 h-4 w-4" />
                        Client Types
                        {selectedClientTypeCount > 0 && (
                            <Badge variant="secondary" className="ml-2">{selectedClientTypeCount}</Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="text-xs font-medium">Filter by Client Type</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="p-2">
                        {renderFilterGroup('All Client Types', clientTypeCategories, selectedClientTypes, onClientTypeChange)}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 flex items-center">
                        <FileText className="mr-2 h-4 w-4" />
                        Statement Status
                        {selectedStatementCount > 0 && (
                            <Badge variant="secondary" className="ml-2">{selectedStatementCount}</Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="text-xs font-medium">Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="p-2">
                        {renderFilterGroup('All Statements', bankStatementFilters, selectedStatementFilters, onStatementFilterChange)}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}