// @ts-nocheck
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '@/lib/supabase';
import TaxTypeComponent from './components/TaxTypeComponent';
import OverallTaxesTable from './components/OverallTaxesTable';

const taxTypes = [
    { key: 'overall', label: 'Overall Taxes' },
    { key: 'income_tax_company', label: 'Income Tax (Company)' },
    { key: 'vat', label: 'VAT' },
    { key: 'wh_vat', label: 'WH VAT' },
    { key: 'paye', label: 'PAYE' },
    { key: 'nita', label: 'NITA' },
    { key: 'housing_levy', label: 'Housing Levy' },
    { key: 'resident_individual', label: 'Resident Individual' },
    { key: 'rent_income_mri', label: 'Rent Income (MRI)' },
    { key: 'turnover_tax', label: 'Turnover Tax' },
];

export default function TaxesPage() {
    const [data, setData] = useState({
        companies: [],
        checklist: {},
    });
    const [activeTab, setActiveTab] = useState("overall");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const [passwordCheckerResult, pinCheckerDetailsResult, checklistResult, companyMainListResult] = await Promise.all([
                supabase
                    .from('PasswordChecker')
                    .select('id, company_name, kra_pin')
                    .order('id', { ascending: true }),
                supabase
                    .from('PinCheckerDetails')
                    .select('*')
                    .order('id', { ascending: true }),
                supabase
                    .from('checklist')
                    .select('*'),
                supabase
                    .from('companyMainList')
                    .select('*')
            ]);

            if (passwordCheckerResult.error) throw passwordCheckerResult.error;
            if (pinCheckerDetailsResult.error) throw pinCheckerDetailsResult.error;
            if (checklistResult.error) throw checklistResult.error;
            if (companyMainListResult.error) throw companyMainListResult.error;

            const combinedCompanies = passwordCheckerResult.data.map(pcData => {
                const detailsData = pinCheckerDetailsResult.data.find(pcdData => pcdData.id === pcData.id);
                return { ...pcData, ...detailsData };
            });

            const checklistMap = {};
            checklistResult.data.forEach(item => {
                checklistMap[item.company_name] = {
                    ...item,
                    taxes: item.taxes || {}
                };
            });

            const activeCompanies = combinedCompanies.filter(company => {
                const companyMainListData = companyMainListResult.data.find(cmlData => cmlData.company_name === company.company_name);
                return companyMainListData && companyMainListData.status === 'active';
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

    const memoizedTaxTypeComponents = useMemo(() => {
        return taxTypes.slice(1).map(tax => (
            <TabsContent key={tax.key} value={tax.key}>
                <TaxTypeComponent
                    taxType={tax.key}
                    companies={data.companies}
                    checklist={data.checklist}
                />
            </TabsContent>
        ));
    }, [data.companies, data.checklist]);

    if (isLoading) {
        return <div>Loading all tax data...</div>;
    }

    return (
        <div className="">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    {taxTypes.map(tax => (
                        <TabsTrigger key={tax.key} value={tax.key}>
                            {tax.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <ScrollArea className="h-[calc(100vh-200px)]">
                    <TabsContent value="overall">
                        <OverallTaxesTable companies={data.companies} />
                    </TabsContent>
                    {memoizedTaxTypeComponents}
                </ScrollArea>
            </Tabs>
        </div>
    );
}