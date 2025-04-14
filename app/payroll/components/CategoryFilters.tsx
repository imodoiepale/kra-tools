// @ts-nocheck
import React, { useState, useCallback, useMemo } from 'react';
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
import { Filter, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export type CategoryStatus = 'all' | 'active' | 'inactive';

interface CategoryCounts {
    active: number;
    inactive: number;
    total: number;
}

interface Category {
    label: string;
    key: string;
    selected: boolean;
    count?: number;
    counts?: CategoryCounts;
    status?: CategoryStatus;
}

interface CategoryFiltersProps {
    onFilterChange: (selectedCategories: string[]) => void;
    selectedCategories: string[] | undefined;
    payrollRecords?: any[]; // Optional prop with better typing
}

export function CategoryFilters({ onFilterChange, selectedCategories = [], payrollRecords = [] }: CategoryFiltersProps) {
    const currentDate = new Date();

    // Keep track of selected status for each category
    const [categoryStatuses, setCategoryStatuses] = useState<Record<string, CategoryStatus>>({
        acc: 'active',
        audit_tax: 'active',
        cps_sheria: 'active',
        imm: 'active'
    });

    // Calculate category counts based on the actual data
    const categoryCounts = useMemo(() => {
        const counts = {
            acc: { active: 0, inactive: 0, total: 0 },
            audit_tax: { active: 0, inactive: 0, total: 0 },
            cps_sheria: { active: 0, inactive: 0, total: 0 },
            imm: { active: 0, inactive: 0, total: 0 },
            total: 0
        };

        // Safety checks to ensure arrays are properly initialized
        if (!payrollRecords || !Array.isArray(payrollRecords)) {
            return counts;
        }

        payrollRecords.forEach(record => {
            if (!record || !record.company) return;

            counts.total++;

            // Helper function to determine if a category is active
            const isDateInRange = (fromDate, toDate) => {
                if (!fromDate || !toDate) return false;

                try {
                    // Handle both formats: DD/MM/YYYY and YYYY-MM-DD
                    const parseDate = (dateStr) => {
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

            // Check each category
            const isAccActive = isDateInRange(
                record.company.acc_client_effective_from,
                record.company.acc_client_effective_to
            );
            const isAuditTaxActive = isDateInRange(
                record.company.audit_tax_client_effective_from,
                record.company.audit_tax_client_effective_to
            );
            const isCpsSheriaActive = isDateInRange(
                record.company.cps_sheria_client_effective_from,
                record.company.cps_sheria_client_effective_to
            );
            const isImmActive = isDateInRange(
                record.company.imm_client_effective_from,
                record.company.imm_client_effective_to
            );

            // Update Accounting counts
            if (record.company.acc_client_effective_from || record.company.acc_client_effective_to) {
                counts.acc.total++;
                if (isAccActive) {
                    counts.acc.active++;
                } else {
                    counts.acc.inactive++;
                }
            }

            // Update Audit Tax counts
            if (record.company.audit_tax_client_effective_from || record.company.audit_tax_client_effective_to) {
                counts.audit_tax.total++;
                if (isAuditTaxActive) {
                    counts.audit_tax.active++;
                } else {
                    counts.audit_tax.inactive++;
                }
            }

            // Update CPS Sheria counts
            if (record.company.cps_sheria_client_effective_from || record.company.cps_sheria_client_effective_to) {
                counts.cps_sheria.total++;
                if (isCpsSheriaActive) {
                    counts.cps_sheria.active++;
                } else {
                    counts.cps_sheria.inactive++;
                }
            }

            // Update Immigration counts
            if (record.company.imm_client_effective_from || record.company.imm_client_effective_to) {
                counts.imm.total++;
                if (isImmActive) {
                    counts.imm.active++;
                } else {
                    counts.imm.inactive++;
                }
            }
        });

        return counts;
    }, [payrollRecords, currentDate]);

    // Handle main category selection
    const handleFilterChange = (key: string) => {
        if (key === 'all') {
            // If All is selected, clear all filters and reset status
            onFilterChange([]);
            // Reset all statuses to active
            setCategoryStatuses({
                acc: 'active',
                audit_tax: 'active',
                cps_sheria: 'active',
                imm: 'active'
            });
            return;
        }

        // Get the true category key without any status suffix
        const baseCategory = key.split('_status_')[0];

        // Safety check for selectedCategories
        const safeSelectedCategories = selectedCategories || [];

        // Check if this category is already selected
        const existingIndex = safeSelectedCategories.findIndex(cat =>
            cat.startsWith(baseCategory + '_status_') || cat === baseCategory
        );

        // Create a new array safely, ensuring it's always initialized
        let newSelectedCategories = safeSelectedCategories ? [...safeSelectedCategories] : [];

        if (existingIndex >= 0) {
            // Update the status of the existing category
            const existingCategory = safeSelectedCategories[existingIndex];

            // Remove this category
            newSelectedCategories.splice(existingIndex, 1);

            // Also reset its status to active
            setCategoryStatuses(prev => ({
                ...prev,
                [baseCategory]: 'active'
            }));
        } else {
            // Add this category with active status
            newSelectedCategories.push(`${baseCategory}_status_${categoryStatuses[baseCategory]}`);
        }

        onFilterChange(newSelectedCategories);
    };

    // Handle status selection for a category
    const handleStatusChange = (category: string, status: CategoryStatus) => {
        // Update the internal status
        setCategoryStatuses(prev => ({
            ...prev,
            [category]: status
        }));

        // Safety check for selectedCategories
        const safeSelectedCategories = selectedCategories || [];

        // Find if this category is already in the selections
        const existingIndex = safeSelectedCategories.findIndex(cat =>
            cat.startsWith(category + '_status_') || cat === category
        );

        // Create a safe copy of the array
        let newSelectedCategories = safeSelectedCategories ? [...safeSelectedCategories] : [];

        // Remove the existing entry if it exists
        if (existingIndex >= 0) {
            newSelectedCategories.splice(existingIndex, 1);
        }

        // Add the new status if it's not 'all'
        if (status !== 'all') {
            newSelectedCategories.push(`${category}_status_${status}`);
        } else {
            // For 'all', we just push the base category
            newSelectedCategories.push(category);
        }

        onFilterChange(newSelectedCategories);
    };

    const categories: Category[] = [
        {
            label: 'All Categories',
            key: 'all',
            selected: !selectedCategories || selectedCategories.length === 0,
            count: categoryCounts.total
        },
        {
            label: 'Accounting',
            key: 'acc',
            selected: selectedCategories ? selectedCategories.some(cat => cat === 'acc' || cat.startsWith('acc_status_')) : false,
            counts: categoryCounts.acc,
            status: categoryStatuses.acc
        },
        {
            label: 'Audit Tax',
            key: 'audit_tax',
            selected: selectedCategories ? selectedCategories.some(cat => cat === 'audit_tax' || cat.startsWith('audit_tax_status_')) : false,
            counts: categoryCounts.audit_tax,
            status: categoryStatuses.audit_tax
        },
        {
            label: 'Sheria',
            key: 'cps_sheria',
            selected: selectedCategories ? selectedCategories.some(cat => cat === 'cps_sheria' || cat.startsWith('cps_sheria_status_')) : false,
            counts: categoryCounts.cps_sheria,
            status: categoryStatuses.cps_sheria
        },
        {
            label: 'Immigration',
            key: 'imm',
            selected: selectedCategories ? selectedCategories.some(cat => cat === 'imm' || cat.startsWith('imm_status_')) : false,
            counts: categoryCounts.imm,
            status: categoryStatuses.imm
        }
    ];

    const selectedCount = selectedCategories ? selectedCategories.length : 0;

    // Get status badge text
    const getStatusBadgeText = (category: string): string => {
        const status = categoryStatuses[category];
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    const badgeCount = useMemo(() => selectedCategories ? selectedCategories.length : 0, [selectedCategories]);
    const selectedStatusBadges = useMemo(() => {
        // Count how many categories are selected with each status
        const statusCounts = { active: 0, inactive: 0, all: 0 };

        // Safely handle undefined selectedCategories
        if (!selectedCategories) return statusCounts;

        selectedCategories.forEach(cat => {
            if (cat.includes('_status_active')) {
                statusCounts.active++;
            } else if (cat.includes('_status_inactive')) {
                statusCounts.inactive++;
            } else if (!cat.includes('_status_')) {
                statusCounts.all++;
            }
        });

        return statusCounts;
    }, [selectedCategories]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 flex items-center">
                    <Filter className="mr-2 h-4 w-4" />
                    Client Categories
                    {selectedCount > 0 && (
                        <Badge variant="secondary" className="ml-2">
                            {selectedCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs font-medium">Service Categories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2">
                    {/* All option */}
                    <label
                        className="flex items-center justify-between py-1.5 px-1 mb-2 cursor-pointer hover:bg-gray-100 rounded"
                    >
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                checked={selectedCategories.length === 0}
                                onCheckedChange={() => handleFilterChange('all')}
                                className="h-4 w-4"
                            />
                            <span className="text-sm font-medium">All Categories</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                            {categoryCounts.total}
                        </Badge>
                    </label>

                    <DropdownMenuSeparator className="my-1" />

                    {/* Category options with nested status filters */}
                    {categories.filter(f => f.key !== 'all').map((category) => (
                        <DropdownMenuGroup key={category.key}>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="py-1.5 px-1 cursor-pointer hover:bg-gray-100 rounded">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                checked={category.selected}
                                                onCheckedChange={() => handleFilterChange(category.key)}
                                                className="h-4 w-4"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span className="text-sm">{category.label}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {category.selected && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {getStatusBadgeText(category.key)}
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className="text-xs">
                                                {category.counts?.total || 0}
                                            </Badge>
                                            <ChevronRight className="h-4 w-4 ml-auto" />
                                        </div>
                                    </div>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-48">
                                    <DropdownMenuItem
                                        className="cursor-pointer flex items-center justify-between"
                                        onClick={() => handleStatusChange(category.key, 'all')}
                                    >
                                        <div className="flex items-center">
                                            <Checkbox
                                                checked={categoryStatuses[category.key] === 'all'}
                                                className="h-4 w-4 mr-2"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span>All</span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {category.counts?.total || 0}
                                        </Badge>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="cursor-pointer flex items-center justify-between"
                                        onClick={() => handleStatusChange(category.key, 'active')}
                                    >
                                        <div className="flex items-center">
                                            <Checkbox
                                                checked={categoryStatuses[category.key] === 'active'}
                                                className="h-4 w-4 mr-2"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span>Active Only</span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {category.counts?.active || 0}
                                        </Badge>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="cursor-pointer flex items-center justify-between"
                                        onClick={() => handleStatusChange(category.key, 'inactive')}
                                    >
                                        <div className="flex items-center">
                                            <Checkbox
                                                checked={categoryStatuses[category.key] === 'inactive'}
                                                className="h-4 w-4 mr-2"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span>Inactive Only</span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {category.counts?.inactive || 0}
                                        </Badge>
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </DropdownMenuGroup>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}