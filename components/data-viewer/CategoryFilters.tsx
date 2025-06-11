import React from 'react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator,
    DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuSub, DropdownMenuSubTrigger,
    DropdownMenuSubContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export type CategoryStatus = 'all' | 'active' | 'inactive';


// These are the props the component will now receive from its parent
interface CategoryFiltersProps {
    selectedCategories: string[];
    categoryStatuses: Record<string, CategoryStatus>;
    onCategoryToggle: (categoryKey: string) => void;
    onStatusChange: (categoryKey: string, status: CategoryStatus) => void;
}

const CATEGORY_DEFINITIONS = [
    { label: 'Accounting', key: 'acc' },
    { label: 'Audit Tax', key: 'audit_tax' },
    { label: 'Sheria', key: 'cps_sheria' },
    { label: 'Immigration', key: 'imm' },
];

export function CategoryFilters({
    selectedCategories,
    categoryStatuses,
    onCategoryToggle,
    onStatusChange,
}: CategoryFiltersProps) {
    const selectedCount = selectedCategories.length;

    const getStatusBadgeText = (categoryKey: string): string => {
        const status = categoryStatuses[categoryKey] || 'all';
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 flex items-center w-full justify-start">
                    <Filter className="mr-2 h-4 w-4" />
                    Client Category Filters
                    {selectedCount > 0 && <Badge variant="secondary" className="ml-auto">{selectedCount}</Badge>}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs font-medium">Service Categories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2">
                    <label className="flex items-center space-x-2 mb-3 cursor-pointer">
                        <Checkbox
                            checked={selectedCategories.length === 0}
                            onCheckedChange={() => onCategoryToggle('all')}
                            className="h-4 w-4"
                        />
                        <span className="text-sm font-medium">All Categories</span>
                    </label>
                    <DropdownMenuSeparator className="my-2" />
                    {CATEGORY_DEFINITIONS.map((filter) => (
                        <DropdownMenuGroup key={filter.key}>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="px-0 py-1.5 cursor-pointer">
                                    <div className="flex items-center space-x-2 w-full">
                                        <Checkbox
                                            checked={selectedCategories.includes(filter.key)}
                                            onCheckedChange={() => onCategoryToggle(filter.key)}
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
                                    <DropdownMenuItem onClick={() => onStatusChange(filter.key, 'all')}>
                                        <Checkbox checked={categoryStatuses[filter.key] === 'all'} className="h-4 w-4 mr-2" />
                                        <span>All</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onStatusChange(filter.key, 'active')}>
                                        <Checkbox checked={categoryStatuses[filter.key] === 'active'} className="h-4 w-4 mr-2" />
                                        <span>Active Only</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onStatusChange(filter.key, 'inactive')}>
                                        <Checkbox checked={categoryStatuses[filter.key] === 'inactive'} className="h-4 w-4 mr-2" />
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