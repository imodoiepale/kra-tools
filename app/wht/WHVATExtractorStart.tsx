// @ts-nocheck
'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function WHVATExtractorStart({ onStart, onStop }) {
    const [isRunning, setIsRunning] = useState(false);
    const [startMonth, setStartMonth] = useState('');
    const [startYear, setStartYear] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [endYear, setEndYear] = useState('');
    const [downloadDocuments, setDownloadDocuments] = useState(false);

    const months = [
        { value: "1", label: "January" },
        { value: "2", label: "February" },
        { value: "3", label: "March" },
        { value: "4", label: "April" },
        { value: "5", label: "May" },
        { value: "6", label: "June" },
        { value: "7", label: "July" },
        { value: "8", label: "August" },
        { value: "9", label: "September" },
        { value: "10", label: "October" },
        { value: "11", label: "November" },
        { value: "12", label: "December" }
    ];

    const years = Array.from({ length: 16 }, (_, i) => (2010 + i).toString());

    const handleStart = async () => {
        try {
            const response = await fetch('/api/whvat-extractor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'start',
                    startMonth: parseInt(startMonth),
                    startYear: parseInt(startYear),
                    endMonth: parseInt(endMonth),
                    endYear: parseInt(endYear),
                    downloadDocuments
                })
            });
            if (response.ok) {
                setIsRunning(true);
                onStart();
            } else {
                throw new Error('Failed to start WHVAT extraction');
            }
        } catch (error) {
            console.error('Error starting WHVAT extraction:', error);
            alert('Failed to start WHVAT extraction. Please try again.');
        }
    };

    const handleStop = async () => {
        try {
            const response = await fetch('/api/whvat-extractor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });
            if (response.ok) {
                setIsRunning(false);
                onStop();
            } else {
                throw new Error('Failed to stop WHVAT extraction');
            }
        } catch (error) {
            console.error('Error stopping WHVAT extraction:', error);
            alert('Failed to stop WHVAT extraction. Please try again.');
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>WHVAT Extraction Control</CardTitle>
                <CardDescription>Manage the WHVAT extraction process.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                        <Label>From</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label htmlFor="startMonth">Month</Label>
                                <Select onValueChange={setStartMonth} value={startMonth}>
                                    <SelectTrigger id="startMonth">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map((month) => (
                                            <SelectItem key={month.value} value={month.value}>
                                                {month.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="startYear">Year</Label>
                                <Select onValueChange={setStartYear} value={startYear}>
                                    <SelectTrigger id="startYear">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map((year) => (
                                            <SelectItem key={year} value={year}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <Label>To</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label htmlFor="endMonth">Month</Label>
                                <Select onValueChange={setEndMonth} value={endMonth}>
                                    <SelectTrigger id="endMonth">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map((month) => (
                                            <SelectItem key={month.value} value={month.value}>
                                                {month.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="endYear">Year</Label>
                                <Select onValueChange={setEndYear} value={endYear}>
                                    <SelectTrigger id="endYear">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map((year) => (
                                            <SelectItem key={year} value={year}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex items-center space-x-2">
                    <Checkbox 
                        id="downloadDocuments" 
                        checked={downloadDocuments}
                        onCheckedChange={(checked) => setDownloadDocuments(checked)}
                    />
                    <Label 
                        htmlFor="downloadDocuments" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Download Documents
                    </Label>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button 
                    onClick={handleStart} 
                    disabled={isRunning || !startMonth || !startYear || !endMonth || !endYear}
                >
                    Start Extraction
                </Button>
                <Button onClick={handleStop} disabled={!isRunning} variant="destructive">
                    Stop Extraction
                </Button>
            </CardFooter>
        </Card>
    );
}   