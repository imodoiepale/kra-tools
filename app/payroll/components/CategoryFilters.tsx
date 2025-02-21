import React, { useState, useCallback } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export type ServiceCategory = {
    label: string;
    key: string;
    selected: boolean;
    isActive: boolean;
};

const isDateInRange = (currentDate: Date, fromDate?: string | null, toDate?: string | null): boolean => {
    if (!fromDate || !toDate) return false;
    
    try {
        // Handle both formats: DD/MM/YYYY and YYYY-MM-DD
        const parseDate = (dateStr: string) => {
            if (dateStr.includes('/')) {
                const [day, month, year] = dateStr.split('/').map(Number);
                return new Date(year, month - 1, day);
            } else {
                return new Date(dateStr);
            }
        };

        const from = parseDate(fromDate);
        const to = parseDate(toDate);
        
        return currentDate >= from && currentDate <= to;
    } catch (error) {
        console.error('Error parsing dates:', error);
        return false;
    }
};

interface CategoryFiltersProps {
    companyDates?: {
        acc_client_effective_from?: string | null;
        acc_client_effective_to?: string | null;
        audit_tax_client_effective_from?: string | null;
        audit_tax_client_effective_to?: string | null;
        cps_sheria_client_effective_from?: string | null;
        cps_sheria_client_effective_to?: string | null;
        imm_client_effective_from?: string | null;
        imm_client_effective_to?: string | null;
    };
    onFilterChange: (selectedCategories: string[]) => void;
    selectedCategories: string[];
}

export function CategoryFilters({ companyDates = {}, onFilterChange, selectedCategories }: CategoryFiltersProps) {
    const currentDate = new Date();
    
    const getFilters = useCallback((): ServiceCategory[] => {
        const categories = [
            {
                label: 'All',
                key: 'all',
                selected: selectedCategories.includes('all'),
                isActive: true
            },
            {
                label: 'Accounting',
                key: 'acc',
                selected: selectedCategories.includes('acc'),
                isActive: isDateInRange(
                    currentDate,
                    companyDates.acc_client_effective_from,
                    companyDates.acc_client_effective_to
                )
            },
            {
                label: 'Audit Tax',
                key: 'audit_tax',
                selected: selectedCategories.includes('audit_tax'),
                isActive: isDateInRange(
                    currentDate,
                    companyDates.audit_tax_client_effective_from,
                    companyDates.audit_tax_client_effective_to
                )
            },
            {
                label: 'Sheria',
                key: 'cps_sheria',
                selected: selectedCategories.includes('cps_sheria'),
                isActive: isDateInRange(
                    currentDate,
                    companyDates.cps_sheria_client_effective_from,
                    companyDates.cps_sheria_client_effective_to
                )
            },
            {
                label: 'Immigration',
                key: 'imm',
                selected: selectedCategories.includes('imm'),
                isActive: isDateInRange(
                    currentDate,
                    companyDates.imm_client_effective_from,
                    companyDates.imm_client_effective_to
                )
            }
        ];

        return categories;
    }, [companyDates, currentDate, selectedCategories]);

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

    const filters = getFilters();
    const selectedCount = selectedCategories.length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 flex items-center">
                    <Filter className="mr-2 h-4 w-4" />
                    Client Category Filters
                    {selectedCount > 0 && (
                        <Badge variant="secondary" className="ml-2">
                            {selectedCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs font-medium">Service Categories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2">
                    {filters.map((filter) => (
                        <label
                            key={filter.key}
                            className="flex items-center space-x-2 mb-2 last:mb-0 cursor-pointer"
                        >
                            <Checkbox
                                checked={filter.key === 'all' ? selectedCategories.length === 0 : filter.selected}
                                disabled={!filter.isActive && filter.key !== 'all'}
                                onCheckedChange={() => handleFilterChange(filter.key)}
                                className="h-4 w-4"
                            />
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">{filter.label}</span>
                                    {!filter.isActive && filter.key !== 'all' && (
                                        <Badge variant="outline" className="text-xs">
                                            Inactive
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </label>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}