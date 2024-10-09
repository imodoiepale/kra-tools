// @ts-nocheck
"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import TaxChecklistMonthlyView from './TaxChecklistMonthlyView';
import TaxChecklistDetailedView from './TaxChecklistDetailedView';
import TaxChecklistAllDataView from './TaxChecklistAllDataView';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

export default function TaxChecklistComponent({ companies, checklist, taxType }) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activeView, setActiveView] = useState("monthly");

    const updateTaxStatus = async (companyName, year, month, status) => {
        const company = companies.find(c => c.company_name === companyName);
        if (!company) {
            console.error('Company not found:', companyName);
            toast.error('Failed to update tax status: Company not found');
            return;
        }

        const updatedTaxes = {
            ...checklist[companyName]?.taxes,
            [taxType]: {
                ...checklist[companyName]?.taxes?.[taxType],
                [year]: {
                    ...checklist[companyName]?.taxes?.[taxType]?.[year],
                    [month]: {
                        ...checklist[companyName]?.taxes?.[taxType]?.[year]?.[month],
                        ...status
                    }
                }
            }
        };

        try {
            const upsertData = {
                company_name: companyName,
                taxes: updatedTaxes
            };

            if (company.kra_pin) {
                upsertData.kra_pin = company.kra_pin;
            }

            const { data, error } = await supabase
                .from('checklist')
                .upsert(upsertData, { onConflict: 'company_name' });

            if (error) throw error;

            checklist[companyName] = {
                ...checklist[companyName],
                taxes: updatedTaxes
            };

            toast.success('Tax status updated successfully');
        } catch (error) {
            console.error('Error updating tax status:', error);
            toast.error('Failed to update tax status');
        }
    };

    return (
        <div>
            <Tabs value={activeView} onValueChange={setActiveView}>
                <TabsList>
                    <TabsTrigger value="monthly">Monthly View</TabsTrigger>
                    <TabsTrigger value="detailed">Detailed View</TabsTrigger>
                    <TabsTrigger value="allData">All Data</TabsTrigger>
                </TabsList>
                <TabsContent value="monthly">
                    <h2 className="text-md font-bold mb-4">
                        {taxType.toUpperCase()} Checklist - {format(selectedDate, 'MMMM yyyy')}
                    </h2>
                    <TaxChecklistMonthlyView
                        companies={companies}
                        checklist={checklist}
                        taxType={taxType}
                        selectedDate={selectedDate}
                        updateTaxStatus={updateTaxStatus}
                    />
                </TabsContent>
                <TabsContent value="detailed">
                    <TaxChecklistDetailedView
                        companies={companies}
                        checklist={checklist}
                        taxType={taxType}
                        selectedDate={selectedDate}
                    />
                </TabsContent>
                <TabsContent value="allData">
                    <TaxChecklistAllDataView
                        companies={companies}
                        checklist={checklist}
                        taxType={taxType}
                        selectedDate={selectedDate}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}