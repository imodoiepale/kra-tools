// components/AutoPopulationStart.tsx
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface AutoPopulationStartProps {
    onStart: () => void;
}

export function AutoPopulationStart({ onStart }: AutoPopulationStartProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleStart = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/auto-population', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'start' }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start VAT auto-population');
            }

            onStart();
        } catch (err) {
            console.error('Error starting VAT auto-population:', err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Start VAT Auto-Population</CardTitle>
                <CardDescription>Begin the process of auto-populating VAT data for all companies.</CardDescription>
            </CardHeader>
            <CardContent>
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <Button onClick={handleStart} disabled={isLoading}>
                    {isLoading ? 'Starting...' : 'Start Auto-Population'}
                </Button>
            </CardContent>
        </Card>
    );
}