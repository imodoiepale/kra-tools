// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast"
import { AlertCircle } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { WHVATCategoryFilters } from "./components/WHVATCategoryFilters";
import { WHVATCompanyTable } from "./components/WHVATCompanyTable";

export function WHVATExtractorStart({ onStart, onStop }) {
    const { toast } = useToast()

    const [isRunning, setIsRunning] = useState(false);
    const [startMonth, setStartMonth] = useState('');
    const [startYear, setStartYear] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [endYear, setEndYear] = useState('');
    const [downloadDocuments, setDownloadDocuments] = useState(false);

    // New states for improved feedback
    const [isInitializing, setIsInitializing] = useState(false);
    const [initProgress, setInitProgress] = useState(0);
    const [initMessage, setInitMessage] = useState('');
    const [initStep, setInitStep] = useState(0);

    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedCompanies, setSelectedCompanies] = useState([]);

    // Progress simulation for better UX
    useEffect(() => {
        if (isInitializing) {
            const steps = [
                'Initializing browser...',
                'Connecting to KRA portal...',
                'Preparing automation...',
                'Starting extraction process...'
            ];

            let currentStep = 0;
            const interval = setInterval(() => {
                if (currentStep < steps.length) {
                    setInitStep(currentStep);
                    setInitMessage(steps[currentStep]);
                    setInitProgress(((currentStep + 1) / steps.length) * 100);
                    currentStep += 1;
                } else {
                    clearInterval(interval);
                }
            }, 1500);

            return () => clearInterval(interval);
        } else {
            setInitProgress(0);
            setInitMessage('');
            setInitStep(0);
        }
    }, [isInitializing]);

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

    // Create years array starting from current year and going backward
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 16 }, (_, i) => (currentYear - i).toString());

    const handleStart = async () => {
        try {
            // Show initializing state immediately for better feedback
            setIsInitializing(true);

            // Display toast notification
            toast({
                title: "Starting WHVAT extraction",
                description: "Connecting to the KRA portal and initializing the process. This may take a moment."
            });

            // Log the selected companies to help with debugging
            console.log(`Starting WHVAT extraction for ${selectedCompanies.length} selected companies:`, selectedCompanies);

            const response = await fetch('/api/whvat-extractor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    startMonth: parseInt(startMonth),
                    startYear: parseInt(startYear),
                    endMonth: parseInt(endMonth),
                    endYear: parseInt(endYear),
                    downloadDocuments,
                    companyIds: selectedCompanies // Changed parameter name to match API expectation
                })
            });

            if (response.ok) {
                setIsInitializing(false);
                setIsRunning(true);

                toast({
                    title: "WHVAT extraction started",
                    description: `Successfully started extraction for ${selectedCompanies.length} companies.`,
                    variant: "success"
                });

                onStart();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start WHVAT extraction');
            }
        } catch (error) {
            setIsInitializing(false);
            console.error('Error starting WHVAT extraction:', error);

            toast({
                title: "Failed to start extraction",
                description: error.message || "An unexpected error occurred. Please try again.",
                variant: "destructive"
            });
        }
    };

    const handleStop = async () => {
        try {
            toast({
                title: "Stopping extraction",
                description: "Attempting to stop the WHVAT extraction process..."
            });

            const response = await fetch('/api/whvat-extractor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });

            if (response.ok) {
                setIsRunning(false);
                setIsInitializing(false);

                toast({
                    title: "Extraction stopped",
                    description: "The WHVAT extraction process has been stopped successfully.",
                    variant: "success"
                });

                onStop();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to stop WHVAT extraction');
            }
        } catch (error) {
            console.error('Error stopping WHVAT extraction:', error);

            toast({
                title: "Failed to stop extraction",
                description: error.message || "An unexpected error occurred. Please try again.",
                variant: "destructive"
            });
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <CardTitle>WHVAT Extraction Control</CardTitle>
                <CardDescription>Extract Withholding VAT records for selected companies.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">

                <div className="space-y-4 bg-muted p-3 rounded-md mb-4">
                    <h3 className="text-sm font-medium mb-3">1. Select Date Range</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        <div>
                            <Label htmlFor="startMonth" className="text-xs">From Month</Label>
                            <Select onValueChange={setStartMonth} value={startMonth}>
                                <SelectTrigger id="startMonth" className="h-8">
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
                            <Label htmlFor="startYear" className="text-xs">From Year</Label>
                            <Select onValueChange={setStartYear} value={startYear}>
                                <SelectTrigger id="startYear" className="h-8">
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
                        <div>
                            <Label htmlFor="endMonth" className="text-xs">To Month</Label>
                            <Select onValueChange={setEndMonth} value={endMonth}>
                                <SelectTrigger id="endMonth" className="h-8">
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
                            <Label htmlFor="endYear" className="text-xs">To Year</Label>
                            <Select onValueChange={setEndYear} value={endYear}>
                                <SelectTrigger id="endYear" className="h-8">
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
                    <div className="mt-3 flex items-center space-x-2">
                        <Checkbox
                            id="downloadDocuments"
                            checked={downloadDocuments}
                            onCheckedChange={(checked) => setDownloadDocuments(checked)}
                        />
                        <Label
                            htmlFor="downloadDocuments"
                            className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Download Documents
                        </Label>
                    </div>
                </div>

                <div className="bg-muted p-3 rounded-md mb-4">
                    <h3 className="text-sm font-medium mb-3">2. Select Service Categories</h3>
                    <WHVATCategoryFilters
                        setSelectedCategories={setSelectedCategories}
                        className="w-full"
                    />
                </div>

                <div>
                    <h3 className="text-sm font-medium mb-3">3. Select Companies</h3>

                    <WHVATCompanyTable
                        selectedCompanies={selectedCompanies}
                        setSelectedCompanies={setSelectedCompanies}
                        filteredCategories={selectedCategories}
                    />

                    {isInitializing && (
                        <div className="mt-6 bg-muted p-4 rounded-md">
                            <div className="flex items-center mb-2">
                                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                <h3 className="text-sm font-medium">{initMessage || 'Initializing...'}</h3>
                            </div>
                            <Progress value={initProgress} className="h-2" />
                            <p className="text-xs text-muted-foreground mt-2">
                                Connecting to the KRA portal and preparing browser automation.
                                This may take a few moments depending on server load and internet connection.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end mt-4">
                        <div className="space-x-2">
                            <Button
                                onClick={handleStart}
                                disabled={isRunning || isInitializing || selectedCompanies.length === 0 || !startMonth || !startYear || !endMonth || !endYear}
                                className={isInitializing ? "opacity-50" : ""}
                            >
                                {isInitializing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Initializing...
                                    </>
                                ) : (
                                    'Start Extraction'
                                )}
                            </Button>
                            <Button
                                onClick={handleStop}
                                disabled={!isRunning && !isInitializing}
                                variant="destructive"
                            >
                                Stop Extraction
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}