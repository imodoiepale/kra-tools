// @ts-nocheck
"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '@/lib/supabase';
import TaxTypeComponent from './components/TaxTypeComponent';
import OverallTaxesTable from './components/OverallTaxesTable';

const taxTypes = [
    { key: 'overall', label: 'Overall Taxes' },
    { key: 'income_tax_company', label: 'Income Tax (Company)' },
    { key: 'vat', label: 'VAT' },
    { key: 'paye', label: 'PAYE' },
    { key: 'nita', label: 'NITA' },
    { key: 'housing_levy', label: 'Housing Levy' },
    { key: 'resident_individual', label: 'Resident Individual' },
    { key: 'rent_income_mri', label: 'Rent Income (MRI)' },
    { key: 'turnover_tax', label: 'Turnover Tax' },
];

export default function TaxesPage() {
    const [companies, setCompanies] = useState([]);
    const [activeTab, setActiveTab] = useState("overall");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = useCallback(async () => {
        setIsLoading(true);
        console.log("Fetching companies...");

        try {
            // Fetch data from PasswordChecker
            const { data: passwordCheckerData, error: passwordCheckerError } = await supabase
                .from('PasswordChecker')
                .select('id, company_name, kra_pin')
                .order('id', { ascending: true });

            if (passwordCheckerError) throw passwordCheckerError;

            // Fetch data from PinCheckerDetails
            const { data: pinCheckerDetailsData, error: pinCheckerDetailsError } = await supabase
                .from('PinCheckerDetails')
                .select('*')
                .order('id', { ascending: true });

            if (pinCheckerDetailsError) throw pinCheckerDetailsError;

            // Combine the data
            const combinedData = passwordCheckerData.map(pcData => {
                const detailsData = pinCheckerDetailsData.find(pcdData => pcdData.id === pcData.id);
                return {
                    ...pcData,
                    ...detailsData
                };
            });

            console.log("Companies fetched:", combinedData.length);
            setCompanies(combinedData);
        } catch (error) {
            console.error('Error fetching company data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

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
                    {isLoading ? (
                        <div>Loading...</div>
                    ) : (
                        <>
                            <TabsContent value="overall">
                                <OverallTaxesTable companies={companies} />
                            </TabsContent>
                            {taxTypes.slice(1).map(tax => (
                                <TabsContent key={tax.key} value={tax.key}>
                                    <TaxTypeComponent
                                        taxType={tax.key}
                                        companies={companies}
                                    />
                                </TabsContent>
                            ))}
                        </>
                    )}
                </ScrollArea>
            </Tabs>
        </div>
    );
}