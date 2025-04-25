// @ts-nocheck
"use client"


import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, Search } from "lucide-react";
import CompanyListTable from './taxes/components/CompanyListTable';
import { supabase } from '@/lib/supabase';
import ClientFileManagement from './file-management/page';
import TaxesPage from './taxes/page';
import { ClientCategoryFilter } from '@/components/ClientCategoryFilter';
import { toast } from 'react-hot-toast';

// Main Page Component
export default function MainPage() {
    const [companies, setCompanies] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
    const [categoryFilters, setCategoryFilters] = useState({});
    
    // State for checklist tab
    const [checklistSearchTerm, setChecklistSearchTerm] = useState('');
    const [isChecklistCategoryFilterOpen, setIsChecklistCategoryFilterOpen] = useState(false);
    const [checklistCategoryFilters, setChecklistCategoryFilters] = useState({});

    useEffect(() => {
        fetchCompanies();
    }, []);
    
    // Debug the filter state when it changes
    useEffect(() => {
        console.log('Category filters changed:', categoryFilters);
    }, [categoryFilters]);

    async function fetchCompanies() {
        try {
            const { data, error } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*');

            if (error) throw error;
            setCompanies(data);
            console.log('Fetched companies:', data.length);
        } catch (error) {
            console.error('Error fetching companies:', error);
            toast.error('Failed to fetch companies');
        }
    }

    // Filter companies based on search term and category filters
    const filteredCompanies = React.useMemo(() => {
        if (!companies || companies.length === 0) {
            console.log('No companies to filter');
            return [];
        }
        
        let filtered = [...companies];
        console.log('Starting with companies:', filtered.length);
        
        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(company => {
                return (
                    (company.company_name && company.company_name.toLowerCase().includes(term)) || 
                    (company.kra_pin && company.kra_pin.toLowerCase().includes(term))
                );
            });
            console.log('After search filter:', filtered.length);
        }
        
        // Apply category filters
        if (Object.keys(categoryFilters).length > 0) {
            const hasActiveFilters = Object.values(categoryFilters).some(categoryStatus => 
                Object.values(categoryStatus as Record<string, boolean>).some(isSelected => isSelected)
            );
            
            if (hasActiveFilters) {
                console.log('Applying category filters:', categoryFilters);
                filtered = filtered.filter(company => {
                    // Check if any selected filter matches
                    for (const [category, statuses] of Object.entries(categoryFilters)) {
                        const statusObj = statuses as Record<string, boolean>;
                        
                        // Skip if this category doesn't have any selected statuses
                        if (!Object.values(statusObj).some(isSelected => isSelected)) {
                            continue;
                        }
                        
                        // For 'all' category, check all service types
                        if (category === 'all') {
                            // If 'all' status is selected, include all companies
                            if (statusObj.all) {
                                return true;
                            }
                            
                            // Check each service type
                            const serviceTypes = ['acc', 'imm', 'audit', 'sheria'];
                            for (const serviceType of serviceTypes) {
                                const fromField = `${serviceType === 'sheria' ? 'cps_sheria' : serviceType}${serviceType === 'audit' ? '_tax' : ''}_client_effective_from`;
                                const toField = `${serviceType === 'sheria' ? 'cps_sheria' : serviceType}${serviceType === 'audit' ? '_tax' : ''}_client_effective_to`;
                                
                                const status = calculateClientStatus(company[fromField], company[toField]);
                                
                                if ((status === 'Active' && statusObj.active) || 
                                    (status === 'Inactive' && statusObj.inactive)) {
                                    return true;
                                }
                            }
                        } else {
                            // For specific categories
                            const fromField = `${category === 'sheria' ? 'cps_sheria' : category}${category === 'audit' ? '_tax' : ''}_client_effective_from`;
                            const toField = `${category === 'sheria' ? 'cps_sheria' : category}${category === 'audit' ? '_tax' : ''}_client_effective_to`;
                            
                            const status = calculateClientStatus(company[fromField], company[toField]);
                            
                            if ((status === 'Active' && statusObj.active) || 
                                (status === 'Inactive' && statusObj.inactive) ||
                                statusObj.all) {
                                return true;
                            }
                        }
                    }
                    
                    return false;
                });
                console.log('After category filter:', filtered.length);
            }
        }
        
        return filtered;
    }, [companies, searchTerm, categoryFilters]);
    
    // Helper function to calculate client status based on from/to dates
    function calculateClientStatus(fromDate, toDate) {
        try {
            const currentDate = new Date();
            if (!fromDate || !toDate) return 'Inactive';
            const fromDateObj = new Date(fromDate);
            const toDateObj = new Date(toDate);
            return fromDateObj <= currentDate && currentDate <= toDateObj ? 'Active' : 'Inactive';
        } catch (error) {
            console.error('Error calculating status:', error);
            return 'Inactive';
        }
    }
    
    // Filter companies for checklist tab
    const filteredChecklistCompanies = React.useMemo(() => {
        let filtered = companies;
        
        // Apply search filter
        if (checklistSearchTerm) {
            const term = checklistSearchTerm.toLowerCase();
            filtered = filtered.filter(company => 
                company.company_name?.toLowerCase().includes(term) || 
                company.kra_pin?.toLowerCase().includes(term)
            );
        }
        
        // Apply category filters
        if (Object.keys(checklistCategoryFilters).length > 0) {
            const hasActiveFilters = Object.values(checklistCategoryFilters).some(categoryStatus => 
                Object.values(categoryStatus as Record<string, boolean>).some(isSelected => isSelected)
            );
            
            if (hasActiveFilters) {
                filtered = filtered.filter(company => {
                    // Get the company's category and status
                    const category = company.category || 'all';
                    const status = company.status === 'active' ? 'active' : 'inactive';
                    
                    // Check if this category has any filters
                    const categoryFilter = checklistCategoryFilters[category] as Record<string, boolean> | undefined;
                    if (!categoryFilter) {
                        // Check if 'all' category has this status selected
                        const allCategoryFilter = checklistCategoryFilters['all'] as Record<string, boolean> | undefined;
                        return allCategoryFilter?.[status] || allCategoryFilter?.['all'];
                    }
                    
                    // Check if this specific status is selected for this category
                    return categoryFilter[status] || categoryFilter['all'];
                });
            }
        }
        
        return filtered;
    }, [companies, checklistSearchTerm, checklistCategoryFilters]);

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
    
    async function deleteCompany(companyId) {
        try {
            const { error } = await supabase
                .from('companyMainList')
                .delete()
                .eq('id', companyId);

            if (error) throw error;

            // Update local state
            setCompanies(companies.filter(company => company.id !== companyId));
        } catch (error) {
            console.error('Error deleting company:', error);
        }
    }

    return (
        <div className="p-4">
            <Tabs defaultValue="company-list">
                <TabsList>
                    <TabsTrigger value="company-list">Company Categories</TabsTrigger>
                    <TabsTrigger value="checklist">Checklist</TabsTrigger>
                </TabsList>
                <TabsContent value="company-list">
                    <div className="flex items-center space-x-2 mb-4">
                        <div className="relative max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search companies..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 max-w-sm"
                            />
                        </div>
                        <Button variant="outline" onClick={() => setIsCategoryFilterOpen(true)}>
                            <Filter className="mr-2 h-4 w-4" /> Categories Filters
                        </Button>
                    </div>
                    <ClientCategoryFilter 
                        isOpen={isCategoryFilterOpen} 
                        onClose={() => setIsCategoryFilterOpen(false)} 
                        onApplyFilters={(filters) => setCategoryFilters(filters)}
                        onClearFilters={() => setCategoryFilters({})}
                        selectedFilters={categoryFilters}
                    />
                    <CompanyListTable
                        companies={filteredCompanies}
                        updateCompany={updateCompany}
                        toggleLock={toggleLock}
                        deleteCompany={deleteCompany}
                        hideFilterButton={true}
                    />
                </TabsContent>
                <TabsContent value="checklist">
                    <div className="flex items-center space-x-2 mb-4">
                        <div className="relative max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search checklist..."
                                value={checklistSearchTerm}
                                onChange={(e) => setChecklistSearchTerm(e.target.value)}
                                className="pl-8 max-w-sm"
                            />
                        </div>
                        <Button variant="outline" onClick={() => setIsChecklistCategoryFilterOpen(true)}>
                            <Filter className="mr-2 h-4 w-4" /> Categories Filters
                        </Button>
                    </div>
                    <ClientCategoryFilter 
                        isOpen={isChecklistCategoryFilterOpen} 
                        onClose={() => setIsChecklistCategoryFilterOpen(false)} 
                        onApplyFilters={(filters) => setChecklistCategoryFilters(filters)}
                        onClearFilters={() => setChecklistCategoryFilters({})}
                        selectedFilters={checklistCategoryFilters}
                    />
                    <Tabs defaultValue="taxes">
                        <TabsList>
                            <TabsTrigger value="taxes">Taxes Checklist</TabsTrigger>
                            <TabsTrigger value="client-files">Client Files Management</TabsTrigger>
                        </TabsList>
                        <TabsContent value="taxes">
                            <TaxesPage filteredCompanies={filteredChecklistCompanies} />
                        </TabsContent>
                        <TabsContent value="client-files">
                            <ClientFileManagement filteredCompanies={filteredChecklistCompanies} />
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>
        </div>
    );
}
