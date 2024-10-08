// @ts-nocheck
'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from 'lucide-react';

export function PINProfileStart({ onStart, onStop }) {
    const [isRunning, setIsRunning] = useState(false);

    const handleStart = async () => {
        try {
            const response = await fetch('/api/pin-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start' })
            });
            if (response.ok) {
                setIsRunning(true);
                onStart();
            } else {
                throw new Error('Failed to start PIN profile extraction');
            }
        } catch (error) {
            console.error('Error starting PIN profile extraction:', error);
            alert('Failed to start PIN profile extraction. Please try again.');
        }
    };

    const handleStop = async () => {
        try {
            const response = await fetch('/api/pin-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });
            if (response.ok) {
                setIsRunning(false);
                onStop();
            } else {
                throw new Error('Failed to stop PIN profile extraction');
            }
        } catch (error) {
            console.error('Error stopping PIN profile extraction:', error);
            alert('Failed to stop PIN profile extraction. Please try again.');
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>PIN Profile Extraction Control</CardTitle>
                <CardDescription>Manage the PIN Profile extraction process.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="mb-4">Use the buttons below to start or stop the PIN profile extraction process for all registered companies.</p>
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
            <CardFooter className="flex gap-6">
                <Button onClick={handleStart} disabled={isRunning}>
                    Start Extraction
                </Button>
                <Button onClick={handleStop} disabled={!isRunning} variant="destructive">
                    Stop Extraction
                </Button>
            </CardFooter>
        </Card>
    );
}
