// pages/auto-population.js
// @ts-nocheck
"use client"

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoPopulationStart } from '@/components/AutoPopulationStart';
import { AutoPopulationRunning } from '@/components/AutoPopulationRunning';
import { AutoPopulationReports } from '@/components/AutoPopulationReports';

export default function AutoPopulation() {
  const [activeTab, setActiveTab] = useState("reports");

  return (
    <div className="p-4 w-full">
      <Card>
        <CardHeader>
          <CardTitle>Auto-Population Tool</CardTitle>
          <CardDescription>Process and manage auto-populated data for companies</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="start">Start</TabsTrigger>
              <TabsTrigger value="running">Running</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="start">
              <AutoPopulationStart onStart={() => setActiveTab("running")} />
            </TabsContent>
            <TabsContent value="running">
              <AutoPopulationRunning onComplete={() => setActiveTab("reports")} />
            </TabsContent>
            <TabsContent value="reports">
              <AutoPopulationReports />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}