// @ts-nocheck
import React from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Filter, Building, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

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
        label: 'All',
        key: 'all',
    },
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
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs font-medium">Filter by Client Type</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="p-2">
                            {clientTypeCategories.map((filter) => (
                                <label
                                    key={filter.key}
                                    className="flex items-center space-x-2 mb-2 last:mb-0 cursor-pointer"
                                >
                                    <Checkbox
                                        checked={selectedClientTypes.includes(filter.key)}
                                        onCheckedChange={() => handleClientTypeChange(filter.key)}
                                        className="h-4 w-4"
                                    />
                                    <span className="text-sm">{filter.label}</span>
                                </label>
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
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs font-medium">Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="p-2">
                        {bankStatementFilters.map((filter) => (
                            <label
                                key={filter.key}
                                className="flex items-center space-x-2 mb-2 last:mb-0 cursor-pointer"
                            >
                                <Checkbox
                                    checked={filter.key === 'all' ? selectedCategories.length === 0 : selectedCategories.includes(filter.key)}
                                    onCheckedChange={() => handleFilterChange(filter.key)}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">{filter.label}</span>
                            </label>
                        ))}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}