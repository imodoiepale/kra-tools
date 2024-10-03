// @ts-nocheck
'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from 'lucide-react';

export function TCCStart({ onStart, onStop }) {
    const [isRunning, setIsRunning] = useState(false);

    const handleStart = async () => {
        try {
            const response = await fetch('/api/tcc-extractor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start' })
            });
            if (response.ok) {
                setIsRunning(true);
                onStart();
            } else {
                throw new Error('Failed to start TCC extraction');
            }
        } catch (error) {
            console.error('Error starting TCC extraction:', error);
            alert('Failed to start TCC extraction. Please try again.');
        }
    };

    const handleStop = async () => {
        try {
            const response = await fetch('/api/tcc-extractor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });
            if (response.ok) {
                setIsRunning(false);
                onStop();
            } else {
                throw new Error('Failed to stop TCC extraction');
            }
        } catch (error) {
            console.error('Error stopping TCC extraction:', error);
            alert('Failed to stop TCC extraction. Please try again.');
        }
    };

    return (
        <Card className="w-[350px]">
            <CardHeader>
                <CardTitle>TCC Extraction Control</CardTitle>
                <CardDescription>Manage the Tax Compliance Certificate extraction process.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="mb-4">Use the buttons below to start or stop the TCC extraction process for all registered companies.</p>
                {isRunning && (
                    <div className="flex items-center p-4 mb-4 text-sm text-yellow-800 border border-yellow-300 rounded-lg bg-yellow-50" role="alert">
                        <AlertCircle className="flex-shrink-0 inline w-4 h-4 mr-3" />
                        <span className="sr-only">Info</span>
                        <div>
                            <span className="font-medium">Extraction in progress!</span> The process is currently running.
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button onClick={handleStart} disabled={isRunning}>
                    Start Extraction
                </Button>
                <Button onClick={handleStop} disabled={!isRunning} variant="destructive">
                    Stop Automation
                </Button>
            </CardFooter>
        </Card>
    );
}