// pages/auto-population.js
// @ts-nocheck
"use client"

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoPopulationStart } from '@/app/pentasoft/components/PentasoftExtractionStart';
// import { AutoPopulationRunning } from '@/app/pentasoft/components/AutoPopulationRunning';
import { AutoPopulationReports } from '@/app/pentasoft/components/PentasoftExtractionReports';
import { PentasoftExtractionStart } from './components/PentasoftExtractionStart';
import { PentasoftExtractionReports } from './components/PentasoftExtractionReports';

export default function PentasoftExtraction() {
    const [activeTab, setActiveTab] = useState("reports");

    const handleExtractionStart = () => {
        setActiveTab("reports");
    };

    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader>
                    <CardTitle>PENTASOFT Extraction Tool</CardTitle>
                    <CardDescription>Extract and manage PAYE, NITA Housing Levy, NHIF, and NSSF reports from PENTASOFT</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="start">Start Extraction</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                        </TabsList>
                        <TabsContent value="start">
                            <PentasoftExtractionStart onStart={handleExtractionStart} />
                        </TabsContent>
                        <TabsContent value="reports">
                            <PentasoftExtractionReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}