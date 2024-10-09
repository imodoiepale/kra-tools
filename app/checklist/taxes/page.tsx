// @ts-nocheck
"use client"

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
    { key: 'vat', label: 'VAT', statusField: 'vat_status', fromField: 'vat_effective_from', toField: 'vat_effective_to' },
    { key: 'paye', label: 'PAYE - Income Tax', statusField: 'paye_status', fromField: 'paye_effective_from', toField: 'paye_effective_to' },
    { key: 'mri', label: 'MRI', statusField: 'rent_income_mri_status', fromField: 'rent_income_mri_effective_from', toField: 'rent_income_mri_effective_to' },
    { key: 'turnover', label: 'Turn Over', statusField: 'turnover_tax_status', fromField: 'turnover_tax_effective_from', toField: 'turnover_tax_effective_to' },
    { key: 'individual', label: 'Resident Individual', statusField: 'resident_individual_status', fromField: 'resident_individual_effective_from', toField: 'resident_individual_effective_to' },
    { key: 'nssf', label: 'NSSF', statusField: 'nssf_status', fromField: 'nssf_effective_from', toField: 'nssf_effective_to' },
    { key: 'nhif', label: 'NHIF', statusField: 'nhif_status', fromField: 'nhif_effective_from', toField: 'nhif_effective_to' },
    { key: 'housing', label: 'Housing Levy', statusField: 'housing_levy_status', fromField: 'housing_levy_effective_from', toField: 'housing_levy_effective_to' },
];

export default function TaxesPage() {
    const [companies, setCompanies] = useState([]);
    const [activeTab, setActiveTab] = useState("overall");

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        const { data: passwordCheckerData, error: passwordCheckerError } = await supabase
            .from('PasswordChecker')
            .select('id, company_name, kra_pin')
            .order('id', { ascending: true });

        if (passwordCheckerError) {
            console.error('Error fetching from PasswordChecker:', passwordCheckerError);
            return;
        }

        const { data: pinCheckerData, error: pinCheckerError } = await supabase
            .from('PinCheckerDetails')
            .select('*')
            .order('id', { ascending: true });

        if (pinCheckerError) {
            console.error('Error fetching from PinCheckerDetails:', pinCheckerError);
            return;
        }

        const combinedData = passwordCheckerData.map(pcData => {
            const pinData = pinCheckerData.find(pData => pData.id === pcData.id);
            return {
                ...pcData,
                ...pinData
            };
        });

        setCompanies(combinedData);
    };

    return (
        <div className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                    {taxTypes.map(tax => (
                        <TabsTrigger key={tax.key} value={tax.key}>{tax.label}</TabsTrigger>
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