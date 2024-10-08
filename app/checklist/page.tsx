// @ts-nocheck
"use client"


import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

// Main Page Component
export default function MainPage() {
    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Company Management System</h1>
            <Tabs defaultValue="company-list">
                <TabsList>
                    <TabsTrigger value="company-list">Company List</TabsTrigger>
                    <TabsTrigger value="checklist">Checklist</TabsTrigger>
                </TabsList>
                <TabsContent value="company-list">
                    <CompanyList />
                </TabsContent>
                <TabsContent value="checklist">
                    <ChecklistTabs />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Company List Component
function CompanyList() {
    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4">Company List</h2>
            {/* Add company list content here */}
        </div>
    );
}

// Checklist Tabs Component
function ChecklistTabs() {
    return (
        <Tabs defaultValue="config-settings">
            <TabsList>
                <TabsTrigger value="config-settings">Configuration Settings</TabsTrigger>
                <TabsTrigger value="client-files">Client Files Management</TabsTrigger>
                <TabsTrigger value="taxes">Taxes Checklist</TabsTrigger>
                <TabsTrigger value="overall">Overall Checklist</TabsTrigger>
            </TabsList>
            <TabsContent value="config-settings">
                <ChecklistConfigSettings />
            </TabsContent>
            <TabsContent value="client-files">
                <ClientFilesManagement />
            </TabsContent>
            <TabsContent value="taxes">
                <TaxesChecklist />
            </TabsContent>
            <TabsContent value="overall">
                <OverallChecklist />
            </TabsContent>
        </Tabs>
    );
}

// Checklist Configuration Settings Component
function ChecklistConfigSettings() {
    return (
        <div>
            <h3 className="text-xl font-semibold mb-4">Checklist Configuration Settings</h3>
            {/* Add configuration settings content here */}
        </div>
    );
}

// Client Files Management Component
function ClientFilesManagement() {
    return (
        <div>
            <h3 className="text-xl font-semibold mb-4">Client Files Management Checklist</h3>
            <Tabs defaultValue="received">
                <TabsList>
                    <TabsTrigger value="received">Received by BCL</TabsTrigger>
                    <TabsTrigger value="delivered">Delivered back to Client</TabsTrigger>
                </TabsList>
                <TabsContent value="received">
                    <h4 className="text-lg font-medium mb-2">Files Received by BCL</h4>
                    {/* Add received files content here */}
                </TabsContent>
                <TabsContent value="delivered">
                    <h4 className="text-lg font-medium mb-2">Files Delivered Back to Client</h4>
                    {/* Add delivered files content here */}
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Taxes Checklist Component
function TaxesChecklist() {
    return (
        <div>
            <h3 className="text-xl font-semibold mb-4">Taxes Checklist</h3>
            <ScrollArea className="h-[400px]">
                <Tabs defaultValue="vat" orientation="vertical">
                    <div className="flex">
                        <TabsList className="w-1/4">
                            <TabsTrigger value="vat">VAT</TabsTrigger>
                            <TabsTrigger value="paye">PAYE - Income Tax</TabsTrigger>
                            <TabsTrigger value="mri">MRI Turn Over</TabsTrigger>
                            <TabsTrigger value="nssf">NSSF</TabsTrigger>
                            <TabsTrigger value="nhif">NHIF</TabsTrigger>
                            <TabsTrigger value="housing">Housing Levy</TabsTrigger>
                        </TabsList>
                        <div className="w-3/4 pl-4">
                            <TabsContent value="vat">
                                <h4 className="text-lg font-medium mb-2">VAT Checklist</h4>
                                {/* Add VAT checklist content here */}
                            </TabsContent>
                            <TabsContent value="paye">
                                <h4 className="text-lg font-medium mb-2">PAYE - Income Tax Checklist</h4>
                                {/* Add PAYE checklist content here */}
                            </TabsContent>
                            <TabsContent value="mri">
                                <h4 className="text-lg font-medium mb-2">MRI Turn Over Checklist</h4>
                                {/* Add MRI Turn Over checklist content here */}
                            </TabsContent>
                            <TabsContent value="nssf">
                                <h4 className="text-lg font-medium mb-2">NSSF Checklist</h4>
                                {/* Add NSSF checklist content here */}
                            </TabsContent>
                            <TabsContent value="nhif">
                                <h4 className="text-lg font-medium mb-2">NHIF Checklist</h4>
                                {/* Add NHIF checklist content here */}
                            </TabsContent>
                            <TabsContent value="housing">
                                <h4 className="text-lg font-medium mb-2">Housing Levy Checklist</h4>
                                {/* Add Housing Levy checklist content here */}
                            </TabsContent>
                        </div>
                    </div>
                </Tabs>
            </ScrollArea>
        </div>
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