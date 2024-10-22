// @ts-nocheck
"use client"

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PINProfileStart } from '@/app/pin-profile/components/PINProfileStart';
import { PINProfileRunning } from '@/app/pin-profile/components/PINProfileRunning';
import { PINProfileReports } from '@/app/pin-profile/components/PINProfileReports';

export default function PINProfileExtractor() {
    const [activeTab, setActiveTab] = useState("reports");

    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader>
                    <CardTitle>KRA PIN Profile Extractor</CardTitle>
                    <CardDescription>Extract and manage KRA PIN Profiles for companies</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="start">Start</TabsTrigger>
                            <TabsTrigger value="running">Running</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                        </TabsList>
                        <TabsContent value="start">
                            <PINProfileStart onStart={() => setActiveTab("running")} />
                        </TabsContent>
                        <TabsContent value="running">
                            <PINProfileRunning onComplete={() => setActiveTab("reports")} />
                        </TabsContent>
                        <TabsContent value="reports">
                            <PINProfileReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}