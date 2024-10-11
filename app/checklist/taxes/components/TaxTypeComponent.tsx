// @ts-nocheck
"use client"

import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RegisteredCompaniesTable from './RegisteredCompaniesTable';
import TaxChecklistComponent from './TaxChecklistComponent';

export default function TaxTypeComponent({ taxType, companies, checklist }) {
    const [activeSubTab, setActiveSubTab] = useState("registered");

    const registeredCompanies = useMemo(() => {
        return companies.filter(company => 
            company[`${taxType}_status`]?.toLowerCase() === 'registered'
        );
    }, [companies, taxType]);

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
                <TaxChecklistComponent
                    companies={registeredCompanies}
                    checklist={checklist}
                    taxType={taxType}
                />
            </TabsContent>
        </Tabs>
    );
}