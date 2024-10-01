// @ts-nocheck
"use client"

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PINCertificateStart } from '@/components/PINCertificateStart';
import { PINCertificateRunning } from '@/components/PINCertificateRunning';
import { PINCertificateReports } from '@/components/PINCertificateReports';

export default function PINCertificateExtractor() {
    const [activeTab, setActiveTab] = useState("reports");

    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader>
                    <CardTitle>KRA PIN Certificate Extractor</CardTitle>
                    <CardDescription>Extract and manage KRA PIN Certificates for companies</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="start">Start</TabsTrigger>
                            <TabsTrigger value="running">Running</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                        </TabsList>
                        <TabsContent value="start">
                            <PINCertificateStart onStart={() => setActiveTab("running")} />
                        </TabsContent>
                        <TabsContent value="running">
                            <PINCertificateRunning onComplete={() => setActiveTab("reports")} />
                        </TabsContent>
                        <TabsContent value="reports">
                            <PINCertificateReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}