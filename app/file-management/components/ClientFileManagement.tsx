"use client"

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast, Toaster } from 'react-hot-toast';
import SearchBar from './SearchBar';
import ExportDialog from './ExportDialog';
import MonthlyTable from './MonthlyTable';
import DetailedView from './DetailedView';
import AllDataView from './AllDataView';
import { Company, ChecklistItem, MonthlyTableProps } from './MonthlyTable.types';

// Define types for better type safety
interface ClientFileManagementProps {
    filteredCompanies: Company[];
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function ClientFileManagement({ filteredCompanies = [] as Company[] }: ClientFileManagementProps) {
    const [clients, setClients] = useState<Company[]>([]);
    const [checklist, setChecklist] = useState<Record<string, ChecklistItem>>({});
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [clientsResult, checklistResult] = await Promise.all([
                supabase.from('PasswordChecker_duplicate').select('id, company_name, kra_pin').order('id'),
                supabase.from('checklist').select('*')
            ]);

            if (clientsResult.error) throw new Error(`Error fetching clients: ${clientsResult.error.message}`);
            if (checklistResult.error) throw new Error(`Error fetching checklist: ${checklistResult.error.message}`);

            setClients(clientsResult.data as Company[]);

            const checklistMap: Record<string, ChecklistItem> = {};
            checklistResult.data.forEach((item: any) => {
                checklistMap[item.company_name] = {
                    ...item,
                    file_management: item.file_management || {}
                };
            });
            setChecklist(checklistMap);

            toast.success('Data fetched successfully');
        } catch (error: any) {
            console.error('Error fetching data:', error);
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredClients = filteredCompanies.filter(client =>
        client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.kra_pin.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const updateClientStatus = async (
        companyName: string,
        year: string,
        month: string,
        status: Record<string, any>,
        kraPin: string
    ) => {
        const updatedFileManagement = {
            ...checklist[companyName]?.file_management,
            [year]: {
                ...checklist[companyName]?.file_management?.[year],
                [month]: {
                    ...checklist[companyName]?.file_management?.[year]?.[month],
                    ...status,
                    filesDelivered: status.filesDelivered !== undefined
                        ? status.filesDelivered
                        : checklist[companyName]?.file_management?.[year]?.[month]?.filesDelivered
                }
            }
        };

        try {
            const { data, error } = await supabase
                .from('checklist')
                .upsert({
                    company_name: companyName,
                    file_management: updatedFileManagement,
                    kra_pin: kraPin
                }, { onConflict: 'company_name' });

            if (error) throw new Error(`Error updating client status: ${error.message}`);

            setChecklist(prevChecklist => ({
                ...prevChecklist,
                [companyName]: {
                    ...prevChecklist[companyName],
                    file_management: updatedFileManagement,
                    kra_pin: kraPin
                }
            }));

            toast.success('Client status updated successfully');
        } catch (error: any) {
            console.error('Error updating client status:', error);
            toast.error(error.message);
        }
    };

    return (
        <div className="">
            <Toaster position="top-right" />
            <Tabs defaultValue="monthly">
                <TabsList>
                    <TabsTrigger value="monthly">Monthly View</TabsTrigger>
                    <TabsTrigger value="detailed">Detailed View</TabsTrigger>
                    <TabsTrigger value="allData">All Data</TabsTrigger>
                </TabsList>
                <TabsContent value="monthly">
                    {isLoading ? (
                        <div>Loading...</div>
                    ) : (
                        <MonthlyTable
                            clients={filteredClients}
                            checklist={checklist}
                            selectedDate={selectedDate}
                            updateClientStatus={updateClientStatus}
                        />
                    )}
                </TabsContent>
                <TabsContent value="detailed">
                    <DetailedView
                        filteredClients={filteredClients}
                        checklist={checklist}
                        selectedDate={selectedDate}
                    />
                </TabsContent>
                <TabsContent value="allData">
                    <AllDataView
                        filteredClients={filteredClients}
                        checklist={checklist}
                        selectedDate={selectedDate}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
