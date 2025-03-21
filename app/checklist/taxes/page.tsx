// @ts-nocheck
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '@/lib/supabase';
import TaxTypeComponent from './components/TaxTypeComponent';
import OverallTaxesTable from './components/OverallTaxesTable';
import { Badge } from "@/components/ui/badge";
import { type CategoryFilter } from './components/CategoryFilters';

const taxTypes = [
    { key: 'overall', label: 'Overall Taxes' },
    { key: 'income_tax_company', label: 'Income Tax (Company)' },
    { key: 'vat', label: 'VAT' },
    { key: 'wh_vat', label: 'WH VAT' },
    { key: 'paye', label: 'PAYE' },
    { key: 'resident_individual', label: 'Resident Individual' },
    { key: 'rent_income_mri', label: 'Rent Income (MRI)' },
    { key: 'turnover_tax', label: 'Turnover Tax' },
    { key: 'nita', label: 'NITA' },
    { key: 'nhif', label: 'NHIF' },
    { key: 'nssf', label: 'NSSF' },
    { key: 'housing_levy', label: 'Housing Levy' },
    { key: 'kebs', label: 'KEBS' },
];

const calculateStatus = (from, to) => {
    try {
        const currentDate = new Date();
        if (!from || !to) return 'Inactive';
        const fromDate = new Date(from);
        const toDate = new Date(to);
        return fromDate <= currentDate && currentDate <= toDate ? 'Active' : 'Inactive';
    } catch (error) {
        console.error('Error calculating status:', error);
        return 'Error';
    }
};



export default function TaxesPage() {
    const [data, setData] = useState({
        companies: [],
        checklist: {},
    });
    const [activeTab, setActiveTab] = useState("overall");
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilters, setCategoryFilters] = useState([
        { label: 'Accounting', key: 'acc', checked: true },
        { label: 'Audit Tax', key: 'audit_tax', checked: false },
        { label: 'Sheria', key: 'cps_sheria', checked: false },
        { label: 'Immigration', key: 'imm', checked: false },
    ]);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const [accPortalResult, checklistResult] = await Promise.all([
                supabase
                    .from('acc_portal_company_duplicate')
                    .select('*')
                    .order('id', { ascending: true }),
                supabase
                    .from('checklist')
                    .select('*')
            ]);

            if (accPortalResult.error) throw accPortalResult.error;
            if (checklistResult.error) throw checklistResult.error;

            const checklistMap = {};
            checklistResult.data.forEach(item => {
                checklistMap[item.company_name] = {
                    ...item,
                    taxes: item.taxes || {}
                };
            });

            const activeCompanies = accPortalResult.data.filter(company => {
                // Check if company is active in any of the selected categories
                return categoryFilters.some(filter => {
                    if (!filter.checked) return false;
                    
                    switch (filter.key) {
                        case 'acc':
                            return calculateStatus(company.acc_client_effective_from, company.acc_client_effective_to) === 'Active';
                        case 'audit_tax':
                            return calculateStatus(company.audit_tax_client_effective_from, company.audit_tax_client_effective_to) === 'Active';
                        case 'cps_sheria':
                            return calculateStatus(company.cps_sheria_client_effective_from, company.cps_sheria_client_effective_to) === 'Active';
                        case 'imm':
                            return calculateStatus(company.imm_client_effective_from, company.imm_client_effective_to) === 'Active';
                        default:
                            return false;
                    }
                });
            });

            setData({
                companies: activeCompanies,
                checklist: checklistMap,
            });
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCategoryFilterChange = (key) => {
        setCategoryFilters(filters => 
            filters.map(filter => 
                filter.key === key ? { ...filter, checked: !filter.checked } : filter
            )
        );
        fetchAllData();
    };

    // Filter companies based on search term
    const filteredCompanies = useMemo(() => {
        return data.companies.filter(company => {
            if (!searchTerm) return true;
            const searchLower = searchTerm.toLowerCase();
            return (
                (company.company_name || '').toLowerCase().includes(searchLower) ||
                (company.kra_pin || '').toLowerCase().includes(searchLower)
            );
        });
    }, [data.companies, searchTerm]);

    // Calculate tax totals for the current tab
    const getTaxTotals = (companies) => {
        if (!Array.isArray(companies)) return null;
        
        const total = companies.length;
        let active = 0;
        let inactive = 0;

        companies.forEach(company => {
            const status = calculateStatus(
                company[`${activeTab}_client_effective_from`],
                company[`${activeTab}_client_effective_to`]
            );
            if (status === 'Active') active++;
            else inactive++;
        });

        return { active, inactive, total };
    };

    if (isLoading) {
        return <div>Loading all tax data...</div>;
    }

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    {taxTypes.map(tax => (
                        <TabsTrigger key={tax.key} value={tax.key}>
                            {tax.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent value="overall">
                    <div className="space-y-2">
                        <OverallTaxesTable companies={data.companies} />
                    </div>
                </TabsContent>
                {taxTypes.slice(1).map(tax => (
                    <TabsContent key={tax.key} value={tax.key}>
                        <div className="space-y-2">
                            <TaxTypeComponent
                                taxType={tax.key}
                                companies={data.companies}
                                checklist={data.checklist}
                            />
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}