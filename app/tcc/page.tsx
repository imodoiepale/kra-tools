// @ts-nocheck
"use client"
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TCCStart } from '@/app/tcc/components/TCCStart';
import { TCCRunning } from '@/app/tcc/components/TCCRunning';
import { TCCReports } from '@/app/tcc/components/TCCReports';

export default function TCCExtractor() {
    const [activeTab, setActiveTab] = useState("reports");

    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader>
                    <CardTitle>Tax Compliance Certificate Extractor </CardTitle>
                    <CardDescription>Extract and manage Tax Compliance Certificates for companies</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="start">Start</TabsTrigger>
                            <TabsTrigger value="running">Running</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                        </TabsList>
                        <TabsContent value="start">
                            <TCCStart onStart={() => setActiveTab("running")} />
                        </TabsContent>
                        <TabsContent value="running">
                            <TCCRunning onComplete={() => setActiveTab("reports")} />
                        </TabsContent>
                        <TabsContent value="reports">
                            <TCCReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}