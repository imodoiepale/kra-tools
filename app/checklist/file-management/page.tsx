// @ts-nocheck
"use client"



import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast, Toaster } from 'react-hot-toast';
import SearchBar from './components/SearchBar';
import ExportDialog from './components/ExportDialog';
import MonthlyTable from './components/MonthlyTable';
import DetailedView from './components/DetailedView';
import AllDataView from './components/AllDataView';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function ClientFileManagement() {
    const [clients, setClients] = useState([]);
    const [checklist, setChecklist] = useState({});
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState('');
    const [sortDirection, setSortDirection] = useState('asc');

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const fetchData = async () => {
        try {
            const [clientsResult, checklistResult] = await Promise.all([
                supabase.from('PasswordChecker').select('id, company_name, kra_pin').order('id'),
                supabase.from('checklist').select('*')
            ]);

            if (clientsResult.error) throw new Error(`Error fetching clients: ${clientsResult.error.message}`);
            if (checklistResult.error) throw new Error(`Error fetching checklist: ${checklistResult.error.message}`);

            setClients(clientsResult.data);

            const checklistMap = {};
            checklistResult.data.forEach(item => {
                checklistMap[item.company_name] = {
                    ...item,
                    file_management: item.file_management || {}
                };
            });
            setChecklist(checklistMap);

            toast.success('Data fetched successfully');
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error(error.message);
        }
    };

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const sortedClients = [...clients].sort((a, b) => {
        if (sortColumn) {
            const aValue = a[sortColumn].toLowerCase();
            const bValue = b[sortColumn].toLowerCase();
            return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return 0;
    });

    const filteredClients = sortedClients.filter(client =>
        client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.kra_pin.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const updateClientStatus = async (companyName, year, month, status, kraPin) => {
        const updatedFileManagement = {
            ...checklist[companyName]?.file_management,
            [year]: {
                ...checklist[companyName]?.file_management?.[year],
                [month]: {
                    ...checklist[companyName]?.file_management?.[year]?.[month],
                    ...status,
                    filesDelivered: status.filesDelivered !== undefined ? status.filesDelivered : checklist[companyName]?.file_management?.[year]?.[month]?.filesDelivered
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
        } catch (error) {
            console.error('Error updating client status:', error);
            toast.error(error.message);
        }
    };

    return (
        <div className="space-y-6 p-6">
            <Toaster position="top-right" />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Client File Management</h1>
            </div>
            <div className="flex space-x-4 items-end">
                <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
                <ExportDialog filteredClients={filteredClients} checklist={checklist} selectedDate={selectedDate} />
            </div>
            <Tabs defaultValue="monthly">
                <TabsList>
                    <TabsTrigger value="monthly">Monthly View</TabsTrigger>
                    <TabsTrigger value="detailed">Detailed View</TabsTrigger>
                    <TabsTrigger value="allData">All Data</TabsTrigger>
                </TabsList>
                <TabsContent value="monthly">
                    <MonthlyTable
                        filteredClients={filteredClients}
                        checklist={checklist}
                        selectedDate={selectedDate}
                        handleSort={handleSort}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        updateClientStatus={updateClientStatus}
                    />
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