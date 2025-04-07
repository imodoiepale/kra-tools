// @ts-nocheck
import React, { useMemo } from 'react';
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

interface ObligationFiltersProps {
    onFilterChange: (selectedObligations: string[]) => void;
    selectedObligations: string[];
    payrollRecords: any[]; // Replace with your record type
}

export function ObligationFilters({ onFilterChange, selectedObligations, payrollRecords }: ObligationFiltersProps) {
    // Calculate counts for each obligation type
    const obligationCounts = useMemo(() => {
        const counts = {
            active: 0,
            cancelled: 0,
            dormant: 0,
            no_obligation: 0,
            missing: 0,
            total: 0
        };

        payrollRecords.forEach(record => {
            if (!record || !record.company) return;

            counts.total++;

            if (!record.pin_details) {
                counts.missing++;
                return;
            }

            const obligationStatus = record.pin_details?.paye_status?.toLowerCase() || '';
            const effectiveFrom = record.pin_details?.paye_effective_from || '';

            // Determine specific status types
            const isCancelled = obligationStatus === 'cancelled';
            const isDormant = obligationStatus === 'dormant';
            const isNoObligation = effectiveFrom.toLowerCase().includes('no obligation');
            const isMissing = !effectiveFrom || effectiveFrom.toLowerCase().includes('missing');

            // Explicitly check if it has an active date (not any of the special cases)
            const hasActiveDate = effectiveFrom &&
                !isNoObligation &&
                !isMissing &&
                !isCancelled &&
                !isDormant;

            if (hasActiveDate) counts.active++;
            if (isCancelled) counts.cancelled++;
            if (isDormant) counts.dormant++;
            if (isNoObligation) counts.no_obligation++;
            if (isMissing && !hasActiveDate && !isCancelled && !isDormant && !isNoObligation) counts.missing++;
        });

        return counts;
    }, [payrollRecords]);

    const handleFilterChange = (key: string) => {
        if (key === 'all') {
            // All - clear obligation filters
            onFilterChange([]);
            return;
        }

        let newSelectedObligations = [...selectedObligations];

        if (selectedObligations.includes(key)) {
            // Remove the filter
            newSelectedObligations = newSelectedObligations.filter(k => k !== key);
        } else {
            // Add the filter
            newSelectedObligations.push(key);
        }

        // Always pass the complete set of filters, not just the new one
        onFilterChange(newSelectedObligations);
    };

    const obligations = [
        {
            label: 'All Obligations',
            key: 'all',
            selected: selectedObligations.length === 0,
            count: obligationCounts.total
        },
        {
            label: 'Active',
            key: 'active',
            selected: selectedObligations.includes('active'),
            count: obligationCounts.active
        },
        {
            label: 'Cancelled',
            key: 'cancelled',
            selected: selectedObligations.includes('cancelled'),
            count: obligationCounts.cancelled
        },
        {
            label: 'Dormant',
            key: 'dormant',
            selected: selectedObligations.includes('dormant'),
            count: obligationCounts.dormant
        },
        {
            label: 'No Obligation',
            key: 'no_obligation',
            selected: selectedObligations.includes('no_obligation'),
            count: obligationCounts.no_obligation
        },
        {
            label: 'Missing Data',
            key: 'missing',
            selected: selectedObligations.includes('missing'),
            count: obligationCounts.missing
        }
    ];

    const selectedCount = selectedObligations.length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 flex items-center">
                    <Filter className="mr-2 h-4 w-4" />
                    PAYE Obligations
                    {selectedCount > 0 && (
                        <Badge variant="secondary" className="ml-2">
                            {selectedCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs font-medium">PAYE Obligation Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2">
                    {obligations.map((obligation) => (
                        <label
                            key={obligation.key}
                            className="flex items-center justify-between py-1.5 px-1 mb-1 last:mb-0 cursor-pointer hover:bg-gray-100 rounded"
                        >
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    checked={obligation.key === 'all' ? selectedObligations.length === 0 : obligation.selected}
                                    onCheckedChange={() => handleFilterChange(obligation.key)}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">{obligation.label}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                                {obligation.count}
                            </Badge>
                        </label>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}