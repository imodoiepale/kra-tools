// @ts-nocheck
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from 'react-hot-toast';
import {
    LayoutDashboard,
    Table as TableIcon,
    List,
    Settings,
    Download,
    Upload,
    Plus,
    RefreshCw
} from "lucide-react";

import Dashboard from './Dashboard';
import AdvancedSidebar from './AdvancedSidebar';
import EnhancedMonthlyTable from './EnhancedMonthlyTable';
import DetailedView from './DetailedView';
import BulkOperationsDialog from './BulkOperationsDialog';
import AddCompanyDialog from './AddCompanyDialog';

import { FileManagementService } from '../services/fileManagementService';
import { Company, FileRecord, FilterState, FileManagementStats } from '../types/fileManagement';

export default function AdvancedFileManagement() {
    // State management
    const [companies, setCompanies] = useState<Company[]>([]);
    const [fileRecords, setFileRecords] = useState<FileRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState('dashboard');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [filters, setFilters] = useState<FilterState>({
        search: '',
        categories: [],
        industries: [],
        status: [],
        dateRange: { start: null, end: null },
        priority: [],
        processingStatus: []
    });

    // Filtered companies based on sidebar filters
    const filteredCompanies = useMemo(() => {
        return companies.filter(company => {
            // Search filter
            if (filters.search &&
                !company.company_name.toLowerCase().includes(filters.search.toLowerCase()) &&
                !company.kra_pin.toLowerCase().includes(filters.search.toLowerCase())) {
                return false;
            }

            // Category filter
            if (filters.categories.length > 0 && !filters.categories.includes(company.category)) {
                return false;
            }

            // Industry filter
            if (filters.industries.length > 0 && !filters.industries.includes(company.industry)) {
                return false;
            }

            // Status filter
            if (filters.status.length > 0 && !filters.status.includes(company.status)) {
                return false;
            }

            // Priority filter
            if (filters.priority.length > 0 && !filters.priority.includes(company.priority)) {
                return false;
            }

            return true;
        });
    }, [companies, filters]);

    // Calculate dashboard stats
    const dashboardStats = useMemo(() => {
        const currentMonth = selectedDate.getMonth() + 1;
        const currentYear = selectedDate.getFullYear();

        const thisMonthRecords = fileRecords.filter(record =>
            record.month === currentMonth && record.year === currentYear
        );

        const received = thisMonthRecords.filter(r => r.received_at).length;
        const delivered = thisMonthRecords.filter(r => r.delivered_at).length;
        const nil = thisMonthRecords.filter(r => r.is_nil).length;

        return {
            total_companies: filteredCompanies.length,
            received_this_month: received,
            delivered_this_month: delivered,
            pending_receipt: filteredCompanies.length - received,
            pending_delivery: received - delivered,
            nil_records: nil,
            overdue_count: 0, // Calculate based on your business rules
            completion_rate: filteredCompanies.length > 0 ? (received / filteredCompanies.length) * 100 : 0,
            delivery_rate: received > 0 ? (delivered / received) * 100 : 0
        };
    }, [filteredCompanies, fileRecords, selectedDate]);

    // Load initial data
    useEffect(() => {
        fetchData();
    }, []);

    // Fetch data from service
    const fetchData = async () => {
        setLoading(true);
        try {
            const [companiesData, recordsData] = await Promise.all([
                FileManagementService.getCompanies(),
                FileManagementService.getFileRecords()
            ]);

            setCompanies(companiesData);
            setFileRecords(recordsData);

            toast.success('Data loaded successfully', {
                icon: '✅',
                style: {
                    borderRadius: '10px',
                    background: '#1e40af',
                    color: '#fff',
                },
            });
        } catch (error: any) {
            console.error('Error fetching data:', error);
            toast.error(`Failed to load data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle file record updates (for reception/delivery dialogs)
    const handleUpdateFileRecord = async (companyId: string, year: number, month: number, updates: any) => {
        try {
            const updatedRecord = await FileManagementService.upsertFileRecord(companyId, year, month, updates);

            // Update local state
            setFileRecords(prev => {
                const existingIndex = prev.findIndex(r =>
                    r.company_id === companyId && r.year === year && r.month === month
                );

                if (existingIndex >= 0) {
                    const newRecords = [...prev];
                    newRecords[existingIndex] = updatedRecord;
                    return newRecords;
                } else {
                    return [...prev, updatedRecord];
                }
            });

            return updatedRecord;
        } catch (error: any) {
            console.error('Error updating file record:', error);
            throw error;
        }
    };

    // Handle company creation
    const handleCreateCompany = async (companyData: Omit<Company, 'id' | 'created_at' | 'updated_at'>) => {
        try {
            const newCompany = await FileManagementService.createCompany(companyData);
            setCompanies(prev => [...prev, newCompany]);

            toast.success(`Company "${newCompany.company_name}" created successfully`, {
                icon: '🏢',
                style: {
                    borderRadius: '10px',
                    background: '#1e40af',
                    color: '#fff',
                },
            });

            return newCompany;
        } catch (error: any) {
            console.error('Error creating company:', error);
            toast.error(`Failed to create company: ${error.message}`);
            throw error;
        }
    };

    // Handle bulk operations
    const handleBulkOperation = async (operation: any) => {
        try {
            await FileManagementService.performBulkOperation(operation);
            await fetchData(); // Refresh data

            toast.success(`Bulk operation completed successfully`, {
                icon: '⚡',
                style: {
                    borderRadius: '10px',
                    background: '#1e40af',
                    color: '#fff',
                },
            });
        } catch (error: any) {
            console.error('Error performing bulk operation:', error);
            toast.error(`Bulk operation failed: ${error.message}`);
            throw error;
        }
    };

    // Loading screen
    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center space-y-4">
                    <div className="relative">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 absolute top-0"></div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-lg font-semibold text-blue-800">Loading File Management System</p>
                        <p className="text-sm text-blue-600">Please wait while we fetch your data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex bg-background">
            <Toaster position="top-right" />

            {/* Sidebar */}
            <AdvancedSidebar
                filters={filters}
                onFiltersChange={setFilters}
                companies={companies}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                File Management System
                            </h1>
                            <p className="text-blue-600 mt-1">
                                Managing document flow for <span className="font-semibold">{filteredCompanies.length}</span> companies
                                {filters.search || filters.categories.length > 0 || filters.status.length > 0 ?
                                    <span className="text-blue-500"> (filtered from {companies.length})</span> : ''
                                }
                            </p>
                        </div>

                        <div className="flex items-center space-x-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchData}
                                disabled={loading}
                                className="border-blue-200 hover:bg-blue-50"
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-200 hover:bg-blue-50"
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                Import
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-200 hover:bg-blue-50"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Export All
                            </Button>

                            <AddCompanyDialog onCreateCompany={handleCreateCompany}>
                                <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Company
                                </Button>
                            </AddCompanyDialog>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs
                    value={selectedTab}
                    onValueChange={setSelectedTab}
                    className="flex-1 flex flex-col"
                >
                    <div className="border-b bg-card px-6 shadow-sm">
                        <TabsList className="grid w-full max-w-lg grid-cols-4 bg-blue-50">
                            <TabsTrigger
                                value="dashboard"
                                className="flex items-center data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                            >
                                <LayoutDashboard className="h-4 w-4 mr-2" />
                                Dashboard
                            </TabsTrigger>
                            <TabsTrigger
                                value="monthly"
                                className="flex items-center data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                            >
                                <TableIcon className="h-4 w-4 mr-2" />
                                Monthly
                            </TabsTrigger>
                            <TabsTrigger
                                value="detailed"
                                className="flex items-center data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                            >
                                <List className="h-4 w-4 mr-2" />
                                Detailed
                            </TabsTrigger>
                            <TabsTrigger
                                value="settings"
                                className="flex items-center data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                            >
                                <Settings className="h-4 w-4 mr-2" />
                                Settings
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        <TabsContent value="dashboard" className="h-full">
                            <Dashboard
                                stats={dashboardStats}
                                companies={filteredCompanies}
                                fileRecords={fileRecords}
                                onRefresh={fetchData}
                                isLoading={loading}
                            />
                        </TabsContent>

                        <TabsContent value="monthly" className="h-full">
                            <EnhancedMonthlyTable
                                companies={filteredCompanies}
                                fileRecords={fileRecords}
                                selectedDate={selectedDate}
                                onDateChange={setSelectedDate}
                                onUpdateRecord={handleUpdateFileRecord}
                                onBulkOperation={handleBulkOperation}
                            />
                        </TabsContent>

                        <TabsContent value="detailed" className="h-full">
                            <DetailedView
                                filteredClients={filteredCompanies}
                                checklist={{}}
                                selectedDate={selectedDate}
                            />
                        </TabsContent>

                        <TabsContent value="settings" className="h-full p-6">
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold text-blue-800">System Settings</h2>
                                    <p className="text-blue-600 mt-2">Configure your file management preferences</p>
                                </div>

                                {/* Settings content would go here */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 border border-blue-200 rounded-lg bg-blue-50">
                                        <h3 className="font-semibold text-blue-800 mb-2">Notification Settings</h3>
                                        <p className="text-sm text-blue-600">Configure email and system notifications</p>
                                    </div>

                                    <div className="p-6 border border-blue-200 rounded-lg bg-blue-50">
                                        <h3 className="font-semibold text-blue-800 mb-2">Data Export</h3>
                                        <p className="text-sm text-blue-600">Set up automated data export schedules</p>
                                    </div>

                                    <div className="p-6 border border-blue-200 rounded-lg bg-blue-50">
                                        <h3 className="font-semibold text-blue-800 mb-2">User Management</h3>
                                        <p className="text-sm text-blue-600">Manage user access and permissions</p>
                                    </div>

                                    <div className="p-6 border border-blue-200 rounded-lg bg-blue-50">
                                        <h3 className="font-semibold text-blue-800 mb-2">System Backup</h3>
                                        <p className="text-sm text-blue-600">Configure automatic data backups</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}