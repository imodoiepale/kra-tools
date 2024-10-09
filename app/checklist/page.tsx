// @ts-nocheck
"use client"


import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import CompanyListTable from './CompanyListTable';
import { supabase } from '@/lib/supabase';
import ClientFileManagement from './file-management/page';
import TaxesPage from './taxes/page';

// Main Page Component
export default function MainPage() {
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        fetchCompanies();
    }, []);

    async function fetchCompanies() {
        try {
            const { data, error } = await supabase
                .from('PasswordChecker')
                .select('*');

            if (error) throw error;
            setCompanies(data);
        } catch (error) {
            console.error('Error fetching companies:', error);
        }
    }

    async function updateCompany(updatedCompany) {
        try {
            const { data, error } = await supabase
                .from('companyMainList')
                .upsert([updatedCompany], { onConflict: 'id' })
                .select();

            if (error) throw error;

            // Update local state
            setCompanies(companies.map(company =>
                company.id === updatedCompany.id ? updatedCompany : company
            ));
        } catch (error) {
            console.error('Error updating company:', error);
        }
    }

    async function toggleLock(companyId) {
        const companyToUpdate = companies.find(company => company.id === companyId);
        if (!companyToUpdate) return;

        const updatedCompany = { ...companyToUpdate, isLocked: !companyToUpdate.isLocked };

        try {
            const { data, error } = await supabase
                .from('companyMainList')
                .upsert([updatedCompany], { onConflict: 'id' })
                .select();

            if (error) throw error;

            // Update local state
            setCompanies(companies.map(company =>
                company.id === companyId ? updatedCompany : company
            ));
        } catch (error) {
            console.error('Error toggling lock:', error);
        }
    }

    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-2">Company Management System</h1>
            <Tabs defaultValue="company-list">
                <TabsList>
                    <TabsTrigger value="company-list">Company List</TabsTrigger>
                    <TabsTrigger value="checklist">Checklist</TabsTrigger>
                </TabsList>
                <TabsContent value="company-list">
                    <CompanyListTable
                        companies={companies}
                        updateCompany={updateCompany}
                        toggleLock={toggleLock}
                    />
                </TabsContent>
                <TabsContent value="checklist">
                    <ChecklistTabs />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Checklist Tabs Component
function ChecklistTabs() {
    return (
        <Tabs defaultValue="taxes">
            <TabsList>
                <TabsTrigger value="client-files">Client Files Management</TabsTrigger>
                <TabsTrigger value="taxes">Taxes Checklist</TabsTrigger>
                <TabsTrigger value="overall">Overall Checklist</TabsTrigger>
            </TabsList>
            <TabsContent value="client-files">
                <ClientFileManagement />
            </TabsContent>
            <TabsContent value="taxes">
                <TaxesPage />
            </TabsContent>
            <TabsContent value="overall">
                <OverallChecklist />
            </TabsContent>
        </Tabs>
    );
}

// Overall Checklist Component
function OverallChecklist() {
    return (
        <div>
            <h3 className="text-xl font-semibold mb-4">Overall Checklist</h3>
            <Tabs defaultValue="summary">
                <TabsList>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="detailed">Detailed</TabsTrigger>
                </TabsList>
                <TabsContent value="summary">
                    <h4 className="text-lg font-medium mb-2">Summary Checklist</h4>
                    {/* Add summary checklist content here */}
                </TabsContent>
                <TabsContent value="detailed">
                    <h4 className="text-lg font-medium mb-2">Detailed Checklist</h4>
                    {/* Add detailed checklist content here */}
                </TabsContent>
            </Tabs>
        </div>
    );
}