// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoLedgerStart } from './components/AutoLedgerStart';
import { AutoLedgerRunning } from './components/AutoledgerRunning';
import { AutoLedgerReports } from './components/AutoledgerReports';

export default function LiabilityExtractorPage() {
    const [activeTab, setActiveTab] = useState("reports");
    const [shouldStop, setShouldStop] = useState(false);

    const handleStart = () => {
        setActiveTab("running");
        setShouldStop(false);
    };

    const handleStop = () => {
        setShouldStop(true);
    };

    const handleComplete = () => {
        setActiveTab("reports");
    };

    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader>
                    <CardTitle>Ledger Extractor</CardTitle>
                    <CardDescription>Extract and manage ledger information for companies</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="start">Start</TabsTrigger>
                            <TabsTrigger value="running">Running</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                        </TabsList>
                        <TabsContent value="start">
                            <AutoLedgerStart onStart={handleStart} onStop={handleStop} />
                        </TabsContent>
                        <TabsContent value="running">
                            <AutoLedgerRunning onComplete={handleComplete} shouldStop={shouldStop} />
                        </TabsContent>
                        <TabsContent value="reports">
                            <AutoLedgerReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}