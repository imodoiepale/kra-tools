// components/AutoPopulation/AutoPopulationRunning.tsx
// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AutoPopulationRunning({ onComplete }) {
    const [progress, setProgress] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const [currentCompany, setCurrentCompany] = useState('');
    const [processedCount, setProcessedCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [isStopping, setIsStopping] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const interval = setInterval(fetchProgress, 2000); // Increased frequency for better responsiveness
        return () => clearInterval(interval);
    }, []);

    const fetchProgress = async () => {
        try {
            const response = await fetch('/api/auto-population', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'progress' })
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch progress');
            }

            const data = await response.json();
            setProgress(data.progress);
            setIsRunning(data.isRunning);
            setCurrentCompany(data.currentCompany);
            setProcessedCount(data.processedCount);
            setTotalCount(data.totalCount);

            // If the process has stopped naturally
            if (!data.isRunning && data.progress === 100) {
                onComplete();
            }

            // If the process was stopped manually
            if (!data.isRunning && isStopping) {
                setIsStopping(false);
                onComplete();
            }
        } catch (err) {
            console.error('Error fetching progress:', err);
            setError('Failed to fetch progress. Please refresh the page.');
        }
    };

    const handleStop = async () => {
        try {
            setIsStopping(true);
            const response = await fetch('/api/auto-population', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to stop VAT auto-population');
            }

            setIsRunning(false);
            // Don't call onComplete here - wait for the next progress update to confirm
        } catch (error) {
            console.error('Error stopping VAT auto-population:', error);
            setError('Failed to stop auto-population. Please try again.');
            setIsStopping(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>VAT Auto-Population in Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <Progress value={progress} className="w-full" />
                
                <div className="flex justify-between items-center">
                    <p className="text-lg font-medium">
                        {progress}% complete ({processedCount} of {totalCount})
                    </p>
                    <Button 
                        onClick={handleStop} 
                        disabled={!isRunning || isStopping} 
                        variant="destructive" 
                        size="lg"
                    >
                        {isStopping ? 'Stopping...' : 'Stop Auto-Population'}
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

                {isStopping && (
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            Stopping the process... Please wait while the current company is completed.
                        </AlertDescription>
                    </Alert>
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
            </CardContent>
        </Card>
    );
}