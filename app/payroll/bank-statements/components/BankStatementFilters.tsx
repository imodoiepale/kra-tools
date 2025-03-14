// @ts-nocheck
import React, { useState, useCallback } from 'react';
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


interface FilterWithStatus {
    key: string;
    status: FilterStatus;
}

// Update the props to accept an array of filter objects instead of just strings
interface BankStatementFiltersProps {
    onFilterChange: (selectedFilters: FilterWithStatus[]) => void;
    selectedCategories: FilterWithStatus[];
    onClientTypeChange?: (selectedTypes: FilterWithStatus[]) => void;
    selectedClientTypes?: FilterWithStatus[];
}



// Client type categories
const clientTypeCategories = [
    {
        label: 'ACC Clients',
        key: 'acc',
    },
    {
        label: 'Audit & Tax Clients',
        key: 'audit_tax',
    },
    {
        label: 'CPS/Sheria Clients',
        key: 'cps_sheria',
    },
    {
        label: 'IMM Clients',
        key: 'imm',
    }
];

// Bank statement filters
const bankStatementFilters = [
    {
        label: 'Validated',
        key: 'validated',
    },
    {
        label: 'Pending Validation',
        key: 'pending_validation',
    },
    {
        label: 'With Issues',
        key: 'has_issues',
    },
    {
        label: 'Reconciled',
        key: 'reconciled',
    },
    {
        label: 'Pending Reconciliation',
        key: 'pending_reconciliation',
    }
];

// Define the structure for filter status
export type FilterStatus = 'all' | 'active' | 'inactive';

interface BankStatementFiltersProps {
    onFilterChange: (selectedCategories: string[]) => void;
    selectedCategories: string[];
    onClientTypeChange?: (selectedTypes: string[]) => void;
    selectedClientTypes?: string[];
}

export function BankStatementFilters({
    onFilterChange,
    selectedCategories,
    onClientTypeChange,
    selectedClientTypes = []
}: BankStatementFiltersProps) {
    // Keep track of selected status for each filter
    const [filterStatuses, setFilterStatuses] = useState<Record<string, FilterStatus>>({
        validated: 'active',
        pending_validation: 'active',
        has_issues: 'active',
        reconciled: 'active',
        pending_reconciliation: 'active'
    });

    // Same for client types
    const [clientTypeStatuses, setClientTypeStatuses] = useState<Record<string, FilterStatus>>({
        acc: 'active',
        audit_tax: 'active',
        cps_sheria: 'active',
        imm: 'active'
    });

    const handleFilterChange = (key: string) => {
        if (key === 'all') {
            // If All is selected, clear all filters
            onFilterChange([]);
            return;
        }

        let newSelectedCategories: string[];
        if (selectedCategories.includes(key)) {
            // Remove the category
            newSelectedCategories = selectedCategories.filter(k => k !== key);
        } else {
            // Add the category
            newSelectedCategories = [...selectedCategories, key];
        }

        onFilterChange(newSelectedCategories);
    };

    // Handle status selection for a filter
    const handleFilterStatusChange = (filter: string, status: FilterStatus) => {
        setFilterStatuses(prev => ({
            ...prev,
            [filter]: status
        }));

        // Update the selected filters based on the new status
        let newSelectedFilters = [...selectedCategories];

        // First remove the filter if it exists
        newSelectedFilters = newSelectedFilters.filter(f => f.key !== filter);

        // Then add it back if the status isn't 'all'
        if (status !== 'all') {
            newSelectedFilters.push({ key: filter, status });
        }

        onFilterChange(newSelectedFilters);
    };

    const handleClientTypeChange = (key: string) => {
        if (!onClientTypeChange) return;

        let newSelectedTypes: string[];
        if (selectedClientTypes.includes(key)) {
            // Remove the type
            newSelectedTypes = selectedClientTypes.filter(k => k !== key);
        } else {
            // Add the type
            newSelectedTypes = [...selectedClientTypes, key];
        }

        onClientTypeChange(newSelectedTypes);
    };

    // Handle status selection for a client type
    const handleClientTypeStatusChange = (clientType: string, status: FilterStatus) => {
        if (!onClientTypeChange) return;

        setClientTypeStatuses(prev => ({
            ...prev,
            [clientType]: status
        }));

        // Update the selected client types based on the new status
        let newSelectedTypes = [...selectedClientTypes];

        // First remove the client type if it exists
        newSelectedTypes = newSelectedTypes.filter(t => t !== clientType);

        // Then add it back if the status isn't 'all'
        if (status !== 'all') {
            newSelectedTypes.push(clientType);
        }

        onClientTypeChange(newSelectedTypes);
    };

    // Get status badge text
    const getStatusBadgeText = (category: string, isClientType = false): string => {
        const statuses = isClientType ? clientTypeStatuses : filterStatuses;
        const status = statuses[category] || 'active';
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    const selectedCount = selectedCategories.length;
    const selectedTypesCount = selectedClientTypes.length;

    return (
        <div className="flex gap-2">
            {/* Client Type Filter */}
            {onClientTypeChange && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 flex items-center">
                            <Building className="mr-2 h-4 w-4" />
                            Client Types
                            {selectedTypesCount > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    {selectedTypesCount}
                                </Badge>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel className="text-xs font-medium">Filter by Client Type</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="p-2">
                            {/* All option */}
                            <label className="flex items-center space-x-2 mb-3 cursor-pointer">
                                <Checkbox
                                    checked={selectedClientTypes.length === 0}
                                    onCheckedChange={() => onClientTypeChange([])}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm font-medium">All Client Types</span>
                            </label>

                            <DropdownMenuSeparator className="my-2" />

                            {/* Client type options with nested status filters */}
                            {clientTypeCategories.map((filter) => (
                                <DropdownMenuGroup key={filter.key}>
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="px-0 py-1.5 cursor-pointer">
                                            <div className="flex items-center space-x-2 w-full">
                                                <Checkbox
                                                    checked={selectedClientTypes.includes(filter.key)}
                                                    onCheckedChange={() => handleClientTypeChange(filter.key)}
                                                    className="h-4 w-4"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="flex flex-1 items-center justify-between">
                                                    <span className="text-sm">{filter.label}</span>
                                                    {selectedClientTypes.includes(filter.key) && (
                                                        <Badge variant="secondary" className="text-xs mr-2">
                                                            {getStatusBadgeText(filter.key, true)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="w-36">
                                            <DropdownMenuItem
                                                className="cursor-pointer"
                                                onClick={() => handleClientTypeStatusChange(filter.key, 'all')}
                                            >
                                                <Checkbox
                                                    checked={clientTypeStatuses[filter.key] === 'all'}
                                                    className="h-4 w-4 mr-2"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span>All</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="cursor-pointer"
                                                onClick={() => handleClientTypeStatusChange(filter.key, 'active')}
                                            >
                                                <Checkbox
                                                    checked={clientTypeStatuses[filter.key] === 'active'}
                                                    className="h-4 w-4 mr-2"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span>Active Only</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="cursor-pointer"
                                                onClick={() => handleClientTypeStatusChange(filter.key, 'inactive')}
                                            >
                                                <Checkbox
                                                    checked={clientTypeStatuses[filter.key] === 'inactive'}
                                                    className="h-4 w-4 mr-2"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span>Inactive Only</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                </DropdownMenuGroup>
                            ))}
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            {/* Statement Filter */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 flex items-center">
                        <FileText className="mr-2 h-4 w-4" />
                        Statement Status
                        {selectedCount > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {selectedCount}
                            </Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="text-xs font-medium">Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="p-2">
                        {/* All option */}
                        <label className="flex items-center space-x-2 mb-3 cursor-pointer">
                            <Checkbox
                                checked={selectedCategories.length === 0}
                                onCheckedChange={() => handleFilterChange('all')}
                                className="h-4 w-4"
                            />
                            <span className="text-sm font-medium">All Statements</span>
                        </label>

                        <DropdownMenuSeparator className="my-2" />

                        {/* Filter options with nested status filters */}
                        {bankStatementFilters.map((filter) => (
                            <DropdownMenuGroup key={filter.key}>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="px-0 py-1.5 cursor-pointer">
                                        <div className="flex items-center space-x-2 w-full">
                                            <Checkbox
                                                checked={selectedCategories.includes(filter.key)}
                                                onCheckedChange={() => handleFilterChange(filter.key)}
                                                className="h-4 w-4"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <div className="flex flex-1 items-center justify-between">
                                                <span className="text-sm">{filter.label}</span>
                                                {selectedCategories.includes(filter.key) && (
                                                    <Badge variant="secondary" className="text-xs mr-2">
                                                        {getStatusBadgeText(filter.key)}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-36">
                                        <DropdownMenuItem
                                            className="cursor-pointer"
                                            onClick={() => handleFilterStatusChange(filter.key, 'all')}
                                        >
                                            <Checkbox
                                                checked={filterStatuses[filter.key] === 'all'}
                                                className="h-4 w-4 mr-2"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span>All</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="cursor-pointer"
                                            onClick={() => handleFilterStatusChange(filter.key, 'active')}
                                        >
                                            <Checkbox
                                                checked={filterStatuses[filter.key] === 'active'}
                                                className="h-4 w-4 mr-2"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span>Active Only</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="cursor-pointer"
                                            onClick={() => handleFilterStatusChange(filter.key, 'inactive')}
                                        >
                                            <Checkbox
                                                checked={filterStatuses[filter.key] === 'inactive'}
                                                className="h-4 w-4 mr-2"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span>Inactive Only</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            </DropdownMenuGroup>
                        ))}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}