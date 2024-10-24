// @ts-nocheck

//original one
"use client";

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoLedgersStart } from './components/AutoLedgersStart';
import { AutoLedgersRunning } from './components/AutoLedgersRunning';
import { AutoLedgersReports } from './components/AutoLedgersReports';

export default function LedgerExtractorPage() {
    const [activeTab, setActiveTab] = useState("reports");
    const [shouldStop, setShouldStop] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    const handleStart = () => {
        setActiveTab("running");
        setShouldStop(false);
    };

    const handleStopCheck = async () => {
        if (!isChecking) {
          alert('There is no automation currently running.');
          return;
        }
      
        try {
          const response = await fetch('/api/ledgers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: "stop" })
          })
      
          if (!response.ok) throw new Error('Failed to stop automation')
      
          const data = await response.json()
          console.log('Automation stopped:', data)
          setIsChecking(false)
          setStatus("Stopped")
          alert('Automation stopped successfully.')
        } catch (error) {
          console.error('Error stopping automation:', error)
          alert('Failed to stop automation. Please try again.')
        }
      }

    const handleComplete = () => {
        setActiveTab("reports");
    };

    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader>
                    <CardTitle>Ledger Extractor</CardTitle>
                    <CardDescription>Extract and manage Ledger information for companies</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="start">Start</TabsTrigger>
                            <TabsTrigger value="running">Running</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                        </TabsList>
                        <TabsContent value="start">
                            <AutoLedgersStart onStart={handleStart} onStop={handleStopCheck} />
                        </TabsContent>
                        <TabsContent value="running">
                            <AutoLedgersRunning onComplete={handleComplete} shouldStop={shouldStop} />
                        </TabsContent>
                        <TabsContent value="reports">
                            <AutoLedgersReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}