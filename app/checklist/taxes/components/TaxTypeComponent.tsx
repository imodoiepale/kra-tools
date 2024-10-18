// @ts-nocheck
"use client"

import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompaniesTable from './CompaniesTable';
import TaxChecklistComponent from './TaxChecklistComponent';

export default function TaxTypeComponent({ taxType, companies, checklist }) {
    const [activeSubTab, setActiveSubTab] = useState("all");

    const filteredCompanies = useMemo(() => {
        switch (activeSubTab) {
            case "registered":
                return companies.filter(company => 
                    company[`${taxType}_status`]?.toLowerCase() === 'registered'
                );
            case "noObligation":
                return companies.filter(company => 
                    !company[`${taxType}_status`] || company[`${taxType}_status`]?.toLowerCase() === 'no obligation'
                );
            case "toBeRegistered":
                return companies.filter(company => 
                    company[`${taxType}_status`]?.toLowerCase() === 'to be registered'
                );
            case "all":
            default:
                return companies;
        }
    }, [companies, taxType, activeSubTab]);

    const getTaxCategoryLabel = (taxType) => {
        const labels = {
            vat: "VAT",
            paye: "PAYE",
            income_tax_company: "Income Tax",
            nita: "NITA",
            housing_levy: "Housing Levy",
            resident_individual: "Resident Individual Tax",
            rent_income_mri: "Rent Income",
            turnover_tax: "Turnover Tax"
        };
        return labels[taxType] || taxType.toUpperCase();
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">{getTaxCategoryLabel(taxType)} Management</h2>
            <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                <TabsList className="mb-4">
                    <TabsTrigger value="all">All Companies</TabsTrigger>
                    <TabsTrigger value="registered">Registered</TabsTrigger>
                    <TabsTrigger value="noObligation">No Obligation</TabsTrigger>
                    <TabsTrigger value="toBeRegistered">To Be Registered</TabsTrigger>
                    <TabsTrigger value="checklist">Checklist</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                    <CompaniesTable
                        companies={filteredCompanies}
                        taxType={taxType}
                        tableType="All"
                    />
                </TabsContent>
                <TabsContent value="registered">
                    <CompaniesTable
                        companies={filteredCompanies}
                        taxType={taxType}
                        tableType="Registered"
                    />
                </TabsContent>
                <TabsContent value="noObligation">
                    <CompaniesTable
                        companies={filteredCompanies}
                        taxType={taxType}
                        tableType="No Obligation"
                    />
                </TabsContent>
                <TabsContent value="toBeRegistered">
                    <CompaniesTable
                        companies={filteredCompanies}
                        taxType={taxType}
                        tableType="To Be Registered"
                    />
                </TabsContent>
                <TabsContent value="checklist">
                    <TaxChecklistComponent
                        companies={filteredCompanies}
                        checklist={checklist}
                        taxType={taxType}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}