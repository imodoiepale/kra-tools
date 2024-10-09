// @ts-nocheck
"use client"

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '@/lib/supabase';
import TaxTypeTable from './TaxTypeTable';
import OverallTaxesTable from './OverallTaxesTable';

const taxTypes = [
    { key: 'overall', label: 'Overall Taxes' },
    { key: 'income_tax_company', label: 'Income Tax (Company)', statusField: 'income_tax_company_status', fromField: 'income_tax_company_effective_from', toField: 'income_tax_company_effective_to' },
    { key: 'vat', label: 'VAT', statusField: 'vat_status', fromField: 'vat_effective_from', toField: 'vat_effective_to' },
    { key: 'paye', label: 'PAYE', statusField: 'paye_status', fromField: 'paye_effective_from', toField: 'paye_effective_to' },
    { key: 'rent_income', label: 'Rent Income', statusField: 'rent_income_status', fromField: 'rent_income_effective_from', toField: 'rent_income_effective_to' },
    { key: 'resident_individual', label: 'Resident Individual', statusField: 'resident_individual_status', fromField: 'resident_individual_effective_from', toField: 'resident_individual_effective_to' },
    { key: 'rent_income_mri', label: 'Rent Income (MRI)', statusField: 'rent_income_mri_status', fromField: 'rent_income_mri_effective_from', toField: 'rent_income_mri_effective_to' },
    { key: 'turnover_tax', label: 'Turnover Tax', statusField: 'turnover_tax_status', fromField: 'turnover_tax_effective_from', toField: 'turnover_tax_effective_to' },
];

export default function TaxesPage() {
    const [companies, setCompanies] = useState([]);
    const [activeTab, setActiveTab] = useState("overall");

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        const { data, error } = await supabase
            .from('PinCheckerDetails')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching from PinCheckerDetails:', error);
            return;
        }

        setCompanies(data);
    };

    return (
        <div className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4 flex flex-wrap">
                    {taxTypes.map(tax => (
                        <TabsTrigger key={tax.key} value={tax.key} className="flex-grow">
                            {tax.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <ScrollArea className="h-[calc(100vh-200px)]">
                    {taxTypes.map(tax => (
                        <TabsContent key={tax.key} value={tax.key}>
                            {tax.key === 'overall' ? (
                                <OverallTaxesTable companies={companies} />
                            ) : (
                                <TaxTypeTable 
                                    companies={companies} 
                                    taxType={tax.key}
                                    statusField={tax.statusField}
                                    fromField={tax.fromField}
                                    toField={tax.toField}
                                />
                            )}
                        </TabsContent>
                    ))}
                </ScrollArea>
            </Tabs>
        </div>
    );
}