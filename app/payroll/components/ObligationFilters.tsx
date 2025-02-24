// @ts-nocheck
import React, { useCallback } from 'react';
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

export type ObligationType = {
    label: string;
    key: string;
    selected: boolean;
};

interface ObligationFiltersProps {
    onFilterChange: (selectedObligations: string[]) => void;
    selectedObligations: string[];
    payrollRecords: any[]; // Replace with your record type
}

export function ObligationFilters({ onFilterChange, selectedObligations, payrollRecords }: ObligationFiltersProps) {
    const handleFilterChange = (key: string) => {
        if (key === 'all') {
            // All - clear filters
            onFilterChange([]);
            return;
        }

        let newSelectedObligations: string[];
        if (selectedObligations.includes(key)) {
            // Remove the filter
            newSelectedObligations = selectedObligations.filter(k => k !== key);
        } else {
            // Add the filter
            newSelectedObligations = [...selectedObligations, key];
        }

        onFilterChange(newSelectedObligations);
    };

    const obligations = [
        {
            label: 'All',
            key: 'all',
            selected: selectedObligations.length === 0
        },
        {
            label: 'Active',
            key: 'active',
            selected: selectedObligations.includes('active')
        },
        {
            label: 'Cancelled',
            key: 'cancelled',
            selected: selectedObligations.includes('cancelled')
        },
        {
            label: 'Dormant',
            key: 'dormant',
            selected: selectedObligations.includes('dormant')
        },
        {
            label: 'No Obligation',
            key: 'no_obligation',
            selected: selectedObligations.includes('no_obligation')
        },
        {
            label: 'Missing Data',
            key: 'missing',
            selected: selectedObligations.includes('missing')
        }
    ];

    const selectedCount = selectedObligations.length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 flex items-center">
                    <Filter className="mr-2 h-4 w-4" />
                    Obligation Filters
                    {selectedCount > 0 && (
                        <Badge variant="secondary" className="ml-2">
                            {selectedCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs font-medium">PAYE Obligation Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2">
                    {obligations.map((obligation) => (
                        <label
                            key={obligation.key}
                            className="flex items-center space-x-2 mb-2 last:mb-0 cursor-pointer"
                        >
                            <Checkbox
                                checked={obligation.key === 'all' ? selectedObligations.length === 0 : obligation.selected}
                                onCheckedChange={() => handleFilterChange(obligation.key)}
                                className="h-4 w-4"
                            />
                            <span className="text-sm">{obligation.label}</span>
                        </label>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}