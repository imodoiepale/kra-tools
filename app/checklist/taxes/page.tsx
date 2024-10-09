// @ts-nocheck
"use client"

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '@/lib/supabase';
import TaxTypeTable from './TaxTypeTable';
import OverallTaxesTable from './OverallTaxesTable';

export default function TaxesPage() {
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        // Fetch data from PasswordChecker table
        const { data: passwordCheckerData, error: passwordCheckerError } = await supabase
            .from('PasswordChecker')
            .select('id, company_name, kra_pin');

        if (passwordCheckerError) {
            console.error('Error fetching from PasswordChecker:', passwordCheckerError);
            return;
        }

        // Fetch data from PinCheckerDetails table
        const { data: pinCheckerData, error: pinCheckerError } = await supabase
            .from('PinCheckerDetails')
            .select('*');

        if (pinCheckerError) {
            console.error('Error fetching from PinCheckerDetails:', pinCheckerError);
            return;
        }

        // Combine the data
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
            <h1 className="text-2xl font-bold mb-4">Taxes</h1>
            <Tabs defaultValue="overall">
                <TabsList className="mb-4">
                    <TabsTrigger value="overall">Overall Taxes</TabsTrigger>
                    <TabsTrigger value="vat">VAT</TabsTrigger>
                    <TabsTrigger value="paye">PAYE - Income Tax</TabsTrigger>
                    <TabsTrigger value="mri">MRI Turn Over</TabsTrigger>
                    <TabsTrigger value="nssf">NSSF</TabsTrigger>
                    <TabsTrigger value="nhif">NHIF</TabsTrigger>
                    <TabsTrigger value="housing">Housing Levy</TabsTrigger>
                </TabsList>
                <ScrollArea className="h-[calc(100vh-200px)]">
                    <TabsContent value="overall">
                        <OverallTaxesTable companies={companies} />
                    </TabsContent>
                    <TabsContent value="vat">
                        <TaxTypeTable 
                            companies={companies} 
                            taxType="vat" 
                            statusField="vat_status"
                            fromField="vat_effective_from"
                            toField="vat_effective_to"
                        />
                    </TabsContent>
                    <TabsContent value="paye">
                        <TaxTypeTable 
                            companies={companies} 
                            taxType="paye" 
                            statusField="paye_status"
                            fromField="paye_effective_from"
                            toField="paye_effective_to"
                        />
                    </TabsContent>
                    <TabsContent value="mri">
                        <TaxTypeTable 
                            companies={companies} 
                            taxType="mri" 
                            statusField="rent_income_mri_status"
                            fromField="rent_income_mri_effective_from"
                            toField="rent_income_mri_effective_to"
                        />
                    </TabsContent>
                    <TabsContent value="nssf">
                        <TaxTypeTable 
                            companies={companies} 
                            taxType="nssf" 
                            statusField="nssf_status"
                            fromField="nssf_effective_from"
                            toField="nssf_effective_to"
                        />
                    </TabsContent>
                    <TabsContent value="nhif">
                        <TaxTypeTable 
                            companies={companies} 
                            taxType="nhif" 
                            statusField="nhif_status"
                            fromField="nhif_effective_from"
                            toField="nhif_effective_to"
                        />
                    </TabsContent>
                    <TabsContent value="housing">
                        <TaxTypeTable 
                            companies={companies} 
                            taxType="housing" 
                            statusField="housing_levy_status"
                            fromField="housing_levy_effective_from"
                            toField="housing_levy_effective_to"
                        />
                    </TabsContent>
                </ScrollArea>
            </Tabs>
        </div>
    );
}