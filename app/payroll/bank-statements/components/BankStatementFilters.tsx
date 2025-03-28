// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/lib/supabase';

interface FilterWithStatus {
    key: string;
    status: FilterStatus;
}

interface BankStatementFiltersProps {
    onFilterChange: (selectedFilters: FilterWithStatus[]) => void;
    selectedCategories: FilterWithStatus[];
    selectedClientTypes?: string[];
    onClientTypeChange?: (types: string[]) => void;
}

export type FilterStatus = 'all' | 'active' | 'inactive';

const clientCategories = [
    { label: 'All', key: 'all' },
    { label: 'Acc', key: 'acc' },
    { label: 'Audit', key: 'audit' },
    { label: 'Imm', key: 'imm' },
    { label: 'Sheria', key: 'sheria' },
];

export function BankStatementFilters({
    onFilterChange,
    selectedCategories,
    selectedClientTypes = [],
    onClientTypeChange = () => {},
}: BankStatementFiltersProps) {
    const [selectedFilters, setSelectedFilters] = useState<Record<string, boolean>>({});
    const [companies, setCompanies] = useState([]);
    const [banks, setBanks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: companiesData, error: companiesError } = await supabase
                    .from('acc_portal_company_duplicate')
                    .select('*');

                if (companiesError) {
                    console.error('Error fetching companies:', companiesError);
                    return;
                }

                const { data: banksData, error: banksError } = await supabase
                    .from('acc_portal_banks')
                    .select('*');

                if (banksError) {
                    console.error('Error fetching banks:', banksError);
                    return;
                }

                setCompanies(companiesData || []);
                setBanks(banksData || []);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const initialFilters: Record<string, boolean> = {};

        selectedCategories.forEach(filter => {
            if (typeof filter === 'string') {
                // Handle legacy string format
                initialFilters[`${filter}_client_active`] = true;
            } else {
                // Handle FilterWithStatus format
                const [category, section] = filter.key.split('_');
                initialFilters[`${category}_${section}_${filter.status}`] = true;
            }
        });

        if (selectedClientTypes.length > 0) {
            selectedClientTypes.forEach(type => {
                initialFilters[`${type}_client_active`] = true;
            });

            const allTypesSelected = clientCategories.every(cat =>
                cat.key === 'all' || selectedClientTypes.includes(cat.key)
            );

            if (allTypesSelected) {
                initialFilters['all_client_active'] = true;
            }
        }

        setSelectedFilters(initialFilters);
    }, [selectedCategories, selectedClientTypes]);

    const getCounts = () => {
        const currentDate = new Date();
        const counts = {
            client: { active: {}, inactive: {} },
            bank: { active: {}, inactive: {} }
        };

        // Initialize counts for all categories
        clientCategories.forEach(category => {
            counts.client.active[category.key] = 0;
            counts.client.inactive[category.key] = 0;
            counts.bank.active[category.key] = 0;
            counts.bank.inactive[category.key] = 0;
        });

        // Helper function to parse dates consistently
        const parseDate = (dateString) => {
            if (!dateString) return null;
            // Assuming format is DD/MM/YYYY
            const [day, month, year] = dateString.split('/');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)); // Month is 0-indexed in JS Date
        };

        // Count active/inactive clients for each category
        companies.forEach(company => {
            // Flag to track if company is active in any category (for "all" filter)
            let isActiveInAnyCategory = false;

            clientCategories.forEach(category => {
                if (category.key !== 'all') {
                    const fromField = `${category.key}_client_effective_from`;
                    const toField = `${category.key}_client_effective_to`;

                    if (company[fromField] && company[toField]) {
                        const fromDate = parseDate(company[fromField]);
                        const toDate = parseDate(company[toField]);

                        if (fromDate && toDate && fromDate <= currentDate && toDate >= currentDate) {
                            counts.client.active[category.key]++;
                            isActiveInAnyCategory = true;
                        } else {
                            counts.client.inactive[category.key]++;
                        }
                    }
                }
            });

            // Update "all" category counts
            if (isActiveInAnyCategory) {
                counts.client.active['all']++;
            } else {
                counts.client.inactive['all']++;
            }
        });

        // Count active/inactive banks for each category
        banks.forEach(bank => {
            const company = companies.find(c => c.id === bank.company_id);
            if (company) {
                // Flag to track if bank is active in any category (for "all" filter)
                let isBankActiveInAnyCategory = false;

                // Parse bank valid dates
                const validFrom = parseDate(bank.valid_from || '01/01/2020');
                const validTo = parseDate(bank.valid_to || '31/12/2050');
                const isBankActive = validFrom && validTo && validFrom <= currentDate && validTo >= currentDate;

                clientCategories.forEach(category => {
                    if (category.key !== 'all') {
                        const fromField = `${category.key}_client_effective_from`;
                        const toField = `${category.key}_client_effective_to`;

                        if (company[fromField] && company[toField]) {
                            const companyFromDate = parseDate(company[fromField]);
                            const companyToDate = parseDate(company[toField]);
                            const isCompanyActive = companyFromDate && companyToDate &&
                                companyFromDate <= currentDate &&
                                companyToDate >= currentDate;

                            // Bank is active only if both bank dates AND company dates are active
                            if (isCompanyActive && isBankActive) {
                                counts.bank.active[category.key]++;
                                isBankActiveInAnyCategory = true;
                            } else {
                                counts.bank.inactive[category.key]++;
                            }
                        }
                    }
                });

                // Update "all" category counts for banks
                if (isBankActiveInAnyCategory) {
                    counts.bank.active['all']++;
                } else {
                    counts.bank.inactive['all']++;
                }
            }
        });

        return counts;
    };

    const counts = getCounts();

    const handleCheckboxChange = (category: string, section: string, status: string) => {
        const key = `${category}_${section}_${status}`;

        const newSelectedFilters = { ...selectedFilters };
        newSelectedFilters[key] = !selectedFilters[key];

        // Handle "all" category selection/deselection
        if (category === 'all') {
            if (newSelectedFilters[key]) {
                // If "all" is checked, check all other categories
                clientCategories.forEach(cat => {
                    if (cat.key !== 'all') {
                        newSelectedFilters[`${cat.key}_${section}_${status}`] = true;
                    }
                });
            } else {
                // If "all" is unchecked, uncheck all other categories
                clientCategories.forEach(cat => {
                    if (cat.key !== 'all') {
                        newSelectedFilters[`${cat.key}_${section}_${status}`] = false;
                    }
                });
            }
        } else {
            // Update "all" checkbox state based on other categories
            let allChecked = true;
            clientCategories.forEach(cat => {
                if (cat.key !== 'all' && !newSelectedFilters[`${cat.key}_${section}_${status}`]) {
                    allChecked = false;
                }
            });
            newSelectedFilters[`all_${section}_${status}`] = allChecked;
        }

        setSelectedFilters(newSelectedFilters);

        // Prepare filters to apply and client types
        const filtersToApply: FilterWithStatus[] = [];
        const clientTypesToApply: string[] = [];

        Object.entries(newSelectedFilters).forEach(([key, isSelected]) => {
            if (isSelected) {
                const [cat, section, status] = key.split('_');

                if (cat !== 'all') {
                    filtersToApply.push({
                        key: `${cat}_${section}`,
                        status: status as FilterStatus
                    });

                    if (section === 'client' && status === 'active' && !clientTypesToApply.includes(cat)) {
                        clientTypesToApply.push(cat);
                    }
                } else if (cat === 'all' && section === 'client' && status === 'active') {
                    // When "all" active clients are selected, add all categories
                    clientCategories.forEach(category => {
                        if (category.key !== 'all' && !clientTypesToApply.includes(category.key)) {
                            clientTypesToApply.push(category.key);
                        }
                    });
                }
            }
        });

        onFilterChange(filtersToApply);
        if (clientTypesToApply.length > 0) {
            onClientTypeChange(clientTypesToApply);
        } else {
            // Clear client types if none are selected
            onClientTypeChange([]);
        }
    };

    const isChecked = (category: string, section: string, status: string): boolean => {
        const key = `${category}_${section}_${status}`;
        return !!selectedFilters[key];
    };

    const activeFilterCount = Object.entries(selectedFilters).filter(
        ([key, isSelected]) => isSelected && !key.startsWith('all_')
    ).length;

    return (
        <div className="flex gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 flex items-center">
                        <FileText className="mr-2 h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[600px]">
                    <DropdownMenuLabel className="text-xs font-medium">Category Filters</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="p-4">
                        <div className="border border-gray-300 rounded-md overflow-hidden">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className="w-24 border border-gray-300"></th>
                                        <th colSpan={3} className="text-center border border-gray-300 py-2 text-sm font-medium">
                                            Client Status
                                        </th>
                                        <th colSpan={3} className="text-center border border-gray-300 py-2 text-sm font-medium">
                                            Bank Status
                                        </th>
                                    </tr>
                                    <tr className="bg-muted/50">
                                        <th className="py-2 px-2 text-left text-sm font-medium border border-gray-300">Client Category</th>
                                        <th className="text-center py-2 text-sm font-medium border border-gray-300">All</th>
                                        <th className="text-center py-2 text-sm font-medium border border-gray-300">Active</th>
                                        <th className="text-center py-2 text-sm font-medium border border-gray-300">In-Active</th>
                                        <th className="text-center py-2 text-sm font-medium border border-gray-300">All</th>
                                        <th className="text-center py-2 text-sm font-medium border border-gray-300">Active</th>
                                        <th className="text-center py-2 text-sm font-medium border border-gray-300">In-Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clientCategories.map((category) => (
                                        <tr key={category.key}>
                                            <td className="py-2 px-2 text-sm border border-gray-300">{category.label}</td>
                                            <td className="text-center border border-gray-300">
                                                <Checkbox
                                                    checked={isChecked(category.key, 'client', 'all')}
                                                    onCheckedChange={() => handleCheckboxChange(category.key, 'client', 'all')}
                                                    className="h-4 w-4"
                                                />
                                            </td>
                                            <td className="text-center border border-gray-300">
                                                <Checkbox
                                                    checked={isChecked(category.key, 'client', 'active')}
                                                    onCheckedChange={() => handleCheckboxChange(category.key, 'client', 'active')}
                                                    className="h-4 w-4"
                                                />
                                                {category.key !== 'all' && !loading && (
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        ({counts.client.active[category.key] || 0})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-center border border-gray-300">
                                                <Checkbox
                                                    checked={isChecked(category.key, 'client', 'inactive')}
                                                    onCheckedChange={() => handleCheckboxChange(category.key, 'client', 'inactive')}
                                                    className="h-4 w-4"
                                                />
                                                {category.key !== 'all' && !loading && (
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        ({counts.client.inactive[category.key] || 0})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-center border border-gray-300">
                                                <Checkbox
                                                    checked={isChecked(category.key, 'bank', 'all')}
                                                    onCheckedChange={() => handleCheckboxChange(category.key, 'bank', 'all')}
                                                    className="h-4 w-4"
                                                />
                                            </td>
                                            <td className="text-center border border-gray-300">
                                                <Checkbox
                                                    checked={isChecked(category.key, 'bank', 'active')}
                                                    onCheckedChange={() => handleCheckboxChange(category.key, 'bank', 'active')}
                                                    className="h-4 w-4"
                                                />
                                                {category.key !== 'all' && !loading && (
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        ({counts.bank.active[category.key] || 0})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-center border border-gray-300">
                                                <Checkbox
                                                    checked={isChecked(category.key, 'bank', 'inactive')}
                                                    onCheckedChange={() => handleCheckboxChange(category.key, 'bank', 'inactive')}
                                                    className="h-4 w-4"
                                                />
                                                {category.key !== 'all' && !loading && (
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        ({counts.bank.inactive[category.key] || 0})
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}