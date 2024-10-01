// components/AutoPopulation/AutoPopulationStart.js
// @ts-nocheck
'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AutoPopulationStart({ onStart }) {
    const [isRunning, setIsRunning] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState('');

    const handleStart = async () => {
        if (!selectedMonth || !selectedYear) {
            alert('Please select both month and year before starting.');
            return;
        }

        try {
            const response = await fetch('/api/auto-population', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', month: selectedMonth, year: selectedYear })
            });
            if (response.ok) {
                setIsRunning(true);
                onStart();
            } else {
                throw new Error('Failed to start VAT auto-population');
            }
        } catch (error) {
            console.error('Error starting VAT auto-population:', error);
            alert('Failed to start VAT auto-population. Please try again.');
        }
    };

    return (
        <Card className="w-[350px]">
            <CardHeader>
                <CardTitle>VAT Auto-Population Control</CardTitle>
                <CardDescription>Start the VAT auto-population process for KRA.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <Select onValueChange={setSelectedMonth}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                <SelectItem key={month} value={month.toString()}>
                                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select onValueChange={setSelectedYear}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleStart} disabled={isRunning || !selectedMonth || !selectedYear}>
                    Start Auto-Population
                </Button>
            </CardFooter>
        </Card>
    );
}