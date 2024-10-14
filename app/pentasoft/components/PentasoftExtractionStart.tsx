// components/PentasoftExtractionStart.tsx
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface PentasoftExtractionStartProps {
    onStart: () => void;
}

export function PentasoftExtractionStart({ onStart }: PentasoftExtractionStartProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleStart = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/pentasoft-extraction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    action: 'extract',
                    company: { name: 'bcl' } // You might want to make this dynamic
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start PENTASOFT extraction');
            }

            onStart();
        } catch (err) {
            console.error('Error starting PENTASOFT extraction:', err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Start PENTASOFT Extraction</CardTitle>
                <CardDescription>Begin the process of extracting PAYE, NITA Housing Levy, NHIF, and NSSF reports from PENTASOFT.</CardDescription>
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
                    {isLoading ? 'Extracting...' : 'Start Extraction'}
                </Button>
            </CardContent>
        </Card>
    );
}