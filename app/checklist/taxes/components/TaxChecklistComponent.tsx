// @ts-nocheck
"use client"

import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TaxChecklistMonthlyView from './TaxChecklistMonthlyView';
import TaxChecklistDetailedView from './TaxChecklistDetailedView';
import TaxChecklistAllDataView from './TaxChecklistAllDataView';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';


const MemoizedTaxChecklistMonthlyView = React.memo(TaxChecklistMonthlyView);
const MemoizedTaxChecklistDetailedView = React.memo(TaxChecklistDetailedView);
const MemoizedTaxChecklistAllDataView = React.memo(TaxChecklistAllDataView);

export default function TaxChecklistComponent({ companies, checklist, taxType }) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activeView, setActiveView] = useState("monthly");
    const [localChecklist, setLocalChecklist] = useState(checklist);

    const updateTaxStatus = async (companyName, year, month, status) => {
        try {
            const { data, error } = await supabase
                .from('checklist')
                .upsert({
                    company_name: companyName,
                    taxes: {
                        ...localChecklist[companyName]?.taxes,
                        [taxType]: {
                            ...localChecklist[companyName]?.taxes?.[taxType],
                            [year]: {
                                ...localChecklist[companyName]?.taxes?.[taxType]?.[year],
                                [month]: {
                                    ...localChecklist[companyName]?.taxes?.[taxType]?.[year]?.[month],
                                    ...status
                                }
                            }
                        }
                    }
                }, { onConflict: 'company_name' });

            if (error) throw error;

            setLocalChecklist(prevChecklist => ({
                ...prevChecklist,
                [companyName]: {
                    ...prevChecklist[companyName],
                    taxes: {
                        ...prevChecklist[companyName]?.taxes,
                        [taxType]: {
                            ...prevChecklist[companyName]?.taxes?.[taxType],
                            [year]: {
                                ...prevChecklist[companyName]?.taxes?.[taxType]?.[year],
                                [month]: {
                                    ...prevChecklist[companyName]?.taxes?.[taxType]?.[year]?.[month],
                                    ...status
                                }
                            }
                        }
                    }
                }
            }));

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
                    <MemoizedTaxChecklistMonthlyView
                        companies={companies}
                        checklist={localChecklist}
                        taxType={taxType}
                        selectedDate={selectedDate}
                        updateTaxStatus={updateTaxStatus}
                    />
                </TabsContent>
                <TabsContent value="detailed">
                    <MemoizedTaxChecklistDetailedView
                        companies={companies}
                        checklist={localChecklist}
                        taxType={taxType}
                        selectedDate={selectedDate}
                    />
                </TabsContent>
                <TabsContent value="allData">
                    <MemoizedTaxChecklistAllDataView
                        companies={companies}
                        checklist={localChecklist}
                        taxType={taxType}
                        selectedDate={selectedDate}
                    />
                </TabsContent>
            </Tabs>
           
        </div>
    );
}