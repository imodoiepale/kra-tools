// components/AutoPopulation/AutoPopulationRunning.js
// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from 'lucide-react';

export function AutoPopulationRunning({ onComplete }) {
    const [progress, setProgress] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const [currentCompany, setCurrentCompany] = useState('');
    const [processedCount, setProcessedCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(fetchProgress, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchProgress = async () => {
        const response = await fetch('/api/auto-population', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'progress' })
        });
        const data = await response.json();
        setProgress(data.progress);
        setIsRunning(data.isRunning);
        setCurrentCompany(data.currentCompany);
        setProcessedCount(data.processedCount);
        setTotalCount(data.totalCount);
        if (!data.isRunning && data.progress === 100) {
            onComplete();
        }
    };

    const handleStop = async () => {
        try {
            const response = await fetch('/api/auto-population', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });
            if (response.ok) {
                setIsRunning(false);
            } else {
                throw new Error('Failed to stop VAT auto-population');
            }
        } catch (error) {
            console.error('Error stopping VAT auto-population:', error);
            alert('Failed to stop VAT auto-population. Please try again.');
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>VAT Auto-Population in Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Progress value={progress} className="w-full" />
                <div className="flex justify-between items-center">
                    <p className="text-lg font-medium">{progress}% complete ({processedCount} of {totalCount})</p>
                    <Button onClick={handleStop} disabled={!isRunning} variant="destructive" size="lg">
                        Stop Auto-Population
                    </Button>
                </div>
                {isRunning && currentCompany && (
                    <div className="flex items-center p-4 text-sm text-blue-800 border border-blue-300 rounded-lg bg-blue-50" role="alert">
                        <AlertCircle className="flex-shrink-0 inline w-4 h-4 mr-3" />
                        <span className="sr-only">Info</span>
                        <div>
                            <span className="font-medium">Currently processing:</span> {currentCompany}
                        </div>
                    </div>
                )}
                {isRunning && processedCount > 0 && totalCount > 0 && (
                    <div className="flex items-center p-4 text-sm text-blue-800 border border-blue-300 rounded-lg bg-blue-50" role="alert">
                        <AlertCircle className="flex-shrink-0 inline w-4 h-4 mr-3" />
                        <span className="sr-only">Info</span>
                        <div>
                            <span className="font-medium">Processing:</span> {processedCount} of {totalCount}
                        </div>
                    </div>
                )}
                {/* <div className="h-[300px] overflow-y-auto border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Company</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log, index) => (
                                <TableRow key={index}>
                                    <TableCell>{log.company}</TableCell>
                                    <TableCell>{log.status}</TableCell>
                                    <TableCell>{log.timestamp}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div> */}
            </CardContent>
        </Card>
    );
}