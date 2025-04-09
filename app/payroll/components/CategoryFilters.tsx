import React, { useState, useCallback, useEffect } from 'react';
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

export type ServiceCategory = {
    label: string;
    key: string;
    selected: boolean;
    isActive: boolean;
};

// Define the structure for category status
export type CategoryStatus = 'all' | 'active' | 'inactive';

// Define the structure for the selected categories with status
export type SelectedCategoryWithStatus = {
    category: string;
    status: CategoryStatus;
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
    
    // Keep track of selected status for each category
    const [categoryStatuses, setCategoryStatuses] = useState<Record<string, CategoryStatus>>({
        acc: 'active',
        audit_tax: 'active',
        cps_sheria: 'active',
        imm: 'active'
    });
    
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

    // Handle main category selection
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

    // Handle status selection for a category
    const handleStatusChange = (category: string, status: CategoryStatus) => {
        setCategoryStatuses(prev => ({
            ...prev,
            [category]: status
        }));
        
        // Update the selected categories based on the new status
        let newSelectedCategories = [...selectedCategories];
        
        // First remove the category if it exists
        newSelectedCategories = newSelectedCategories.filter(cat => cat !== category);
        
        // Then add it back if the status isn't 'none'
        if (status !== 'all') {
            newSelectedCategories.push(category);
        }
        
        onFilterChange(newSelectedCategories);
    };

    const filters = getFilters();
    const selectedCount = selectedCategories.length;

    // Get status badge text
    const getStatusBadgeText = (category: string): string => {
        const status = categoryStatuses[category];
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

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
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs font-medium">Service Categories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2">
                    {/* All option */}
                    <label
                        className="flex items-center space-x-2 mb-3 cursor-pointer"
                    >
                        <Checkbox
                            checked={selectedCategories.length === 0}
                            onCheckedChange={() => handleFilterChange('all')}
                            className="h-4 w-4"
                        />
                        <span className="text-sm font-medium">All Categories</span>
                    </label>
                    
                    <DropdownMenuSeparator className="my-2" />
                    
                    {/* Category options with nested status filters */}
                    {filters.filter(f => f.key !== 'all').map((filter) => (
                        <DropdownMenuGroup key={filter.key}>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="px-0 py-1.5 cursor-pointer">
                                    <div className="flex items-center space-x-2 w-full">
                                        <Checkbox
                                            checked={selectedCategories.includes(filter.key)}
                                            disabled={!filter.isActive}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    handleFilterChange(filter.key);
                                                } else {
                                                    handleFilterChange(filter.key);
                                                }
                                            }}
                                            className="h-4 w-4"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <div className="flex flex-1 items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{filter.label}</span>
                                                {!filter.isActive && (
                                                    <Badge variant="outline" className="text-xs">
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </div>
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
                                        onClick={() => handleStatusChange(filter.key, 'all')}
                                    >
                                        <Checkbox
                                            checked={categoryStatuses[filter.key] === 'all'}
                                            className="h-4 w-4 mr-2"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <span>All</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                        className="cursor-pointer"
                                        onClick={() => handleStatusChange(filter.key, 'active')}
                                    >
                                        <Checkbox
                                            checked={categoryStatuses[filter.key] === 'active'}
                                            className="h-4 w-4 mr-2"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <span>Active Only</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                        className="cursor-pointer"
                                        onClick={() => handleStatusChange(filter.key, 'inactive')}
                                    >
                                        <Checkbox
                                            checked={categoryStatuses[filter.key] === 'inactive'}
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
    );
} 