// @ts-nocheck
import React ,{ useEffect, useState, useMemo } from 'react'
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

export type CategoryFilter = {
    label: string;
    key: string;
    checked: boolean;
};

interface CategoryFiltersProps {
    categoryFilters: CategoryFilter[];
    onFilterChange: (key: string) => void;
}

export function CategoryFilters({ onFilterChange }: CategoryFiltersProps) {
    const [categoryFilters, setCategoryFilters] = useState([
        { label: 'Accounting', key: 'acc', checked: true },
        { label: 'Audit Tax', key: 'audit_tax', checked: false },
        { label: 'Sheria', key: 'cps_sheria', checked: false },
        { label: 'Immigration', key: 'imm', checked: false },
    ]);
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7">
                    <Filter className="mr-2 h-3 w-3" />
                    Filter Categories
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs font-medium">Service Categories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2">
                    {categoryFilters.map((filter) => (
                        <label
                            key={filter.key}
                            className="flex items-center space-x-2 mb-2 last:mb-0 cursor-pointer"
                        >
                            <Checkbox
                                checked={filter.checked}
                                onCheckedChange={() => onFilterChange(filter.key)}
                                className="h-3 w-3"
                            />
                            <span className="text-xs">{filter.label}</span>
                        </label>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}