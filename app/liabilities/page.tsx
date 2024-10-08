// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoLiabilitiesStart } from './components/AutoLiabilitiesStart';
import { AutoLiabilitiesRunning } from './components/AutoLiabilitiesRunning';
import { AutoLiabilitiesReports } from './components/AutoLiabilitiesReports';

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
                    <CardTitle>Liability Extractor</CardTitle>
                    <CardDescription>Extract and manage liability information for companies</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="start">Start</TabsTrigger>
                            <TabsTrigger value="running">Running</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                        </TabsList>
                        <TabsContent value="start">
                            <AutoLiabilitiesStart onStart={handleStart} onStop={handleStop} />
                        </TabsContent>
                        <TabsContent value="running">
                            <AutoLiabilitiesRunning onComplete={handleComplete} shouldStop={shouldStop} />
                        </TabsContent>
                        <TabsContent value="reports">
                            <AutoLiabilitiesReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}