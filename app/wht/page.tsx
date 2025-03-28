// @ts-nocheck
'use client'

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WHVATExtractorStart } from '@/app/wht/WHVATExtractorStart';
import { WHVATExtractorRunning } from '@/app/wht/WHVATExtractorRunning';
import { WHVATExtractorReports } from '@/app/wht/WHVATExtractorReports';

export default function WHVATExtractor() {
    const [activeTab, setActiveTab] = useState("reports");

    return (
        <div className="p-4 w-full mb-4">
            <Card>
                <CardHeader>
                    <CardTitle>Withholding VAT/Tax Extractor</CardTitle>
                    <CardDescription>Extract and manage Withholding VAT/Tax certificates for companies</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="start">Start</TabsTrigger>
                            <TabsTrigger value="running">Running</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                        </TabsList>
                        <TabsContent value="start">
                            <WHVATExtractorStart onStart={() => setActiveTab("running")} />
                        </TabsContent>
                        <TabsContent value="running">
                            <WHVATExtractorRunning onComplete={() => setActiveTab("reports")} />
                        </TabsContent>
                        <TabsContent value="reports">
                            <WHVATExtractorReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}