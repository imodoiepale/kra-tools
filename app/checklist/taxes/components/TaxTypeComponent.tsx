// @ts-nocheck
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RegisteredCompaniesTable from './RegisteredCompaniesTable';
import TaxChecklistComponent from './TaxChecklistComponent';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

export default function TaxTypeComponent({ taxType, companies }) {
    const [activeSubTab, setActiveSubTab] = useState("registered");
    const [checklistData, setChecklistData] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const registeredCompanies = useMemo(() => {
        return companies.filter(company => 
            company[`${taxType}_status`]?.toLowerCase() === 'registered'
        );
    }, [companies, taxType]);

    useEffect(() => {
        if (activeSubTab === "checklist") {
            fetchChecklistData();
        }
    }, [activeSubTab, taxType]);

    const fetchChecklistData = async () => {
        setIsLoading(true);
        try {
            const [checklistResult] = await Promise.all([
                supabase
                    .from('checklist')
                    .select('*')
                    .in('company_name', registeredCompanies.map(c => c.company_name))
            ]);

            if (checklistResult.error) throw checklistResult.error;

            const checklistMap = {};
            checklistResult.data.forEach(item => {
                checklistMap[item.company_name] = {
                    ...item,
                    taxes: item.taxes || {}
                };
            });
            setChecklistData(checklistMap);
        } catch (error) {
            console.error('Error fetching checklist data:', error);
            toast.error('Failed to fetch checklist data');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
            <TabsList>
                <TabsTrigger value="registered">Registered Companies</TabsTrigger>
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
            </TabsList>
            <TabsContent value="registered">
                <RegisteredCompaniesTable
                    companies={registeredCompanies}
                    taxType={taxType}
                />
            </TabsContent>
            <TabsContent value="checklist">
                {isLoading ? (
                    <div>Loading checklist data...</div>
                ) : (
                    <TaxChecklistComponent
                        companies={registeredCompanies}
                        checklist={checklistData}
                        taxType={taxType}
                    />
                )}
            </TabsContent>
        </Tabs>
    );
}