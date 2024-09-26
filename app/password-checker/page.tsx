// @ts-nocheck
"use client";
import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PasswordCheckerRunning } from '@/components/PasswordCheckerRunning'
import { PasswordCheckerReports } from '@/components/PasswordCheckerReports'

export default function PasswordChecker() {
    const [isChecking, setIsChecking] = useState(false)
    const [activeTab, setActiveTab] = useState("start")
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState("Not Started")

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
    
        const checkProgress = async () => {
            try {
                const response = await fetch('/api/password-checker', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: "getProgress" })
                });
                if (!response.ok) throw new Error('Failed to fetch progress');
                const data = await response.json();
                setProgress(data.progress);
                setStatus(data.status);
                setIsChecking(data.status === "Running");
                if (data.status === "Running") {
                    setActiveTab("running");
                } else if (data.status === "Completed") {
                    setActiveTab("reports");
                    // Stop checking progress if automation is completed
                    if (interval) clearInterval(interval);
                }
            } catch (error) {
                console.error('Error checking progress:', error);
                setIsChecking(false);
                setStatus("Not Started");
                setProgress(0);
                // Stop checking progress if there's an error
                if (interval) clearInterval(interval);
            }
        };
    
        checkProgress(); // Initial check
    
        if (isChecking) {
            interval = setInterval(checkProgress, 5000); // Check every 5 seconds only if automation is running
        }
    
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isChecking]);

    const handleStartCheck = async () => {
        if (isChecking) {
            alert('An automation is already running. Please wait for it to complete or stop it before starting a new one.');
            return;
        }

        try {
            const response = await fetch('/api/password-checker', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: "start" })
            })

            if (!response.ok) throw new Error('API request failed')

            const data = await response.json()
            console.log('Password check started:', data)
            setIsChecking(true)
            setStatus("Running")
            setActiveTab("running")
        } catch (error) {
            console.error('Error starting password check:', error)
            alert('Failed to start password check. Please try again.')
        }
    }

    const handleStopCheck = async () => {
        if (!isChecking) {
            alert('There is no automation currently running.');
            return;
        }

        try {
            const response = await fetch('/api/password-checker', {
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

    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader>
                    <CardTitle>KRA Password Checker</CardTitle>
                    <CardDescription>Validate KRA passwords for multiple companies</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="start">Start</TabsTrigger>
                            <TabsTrigger value="running">Running</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                        </TabsList>
                        <TabsContent value="start">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Start Password Check</CardTitle>
                                    <CardDescription>Begin the password validation process for all companies.</CardDescription>
                                </CardHeader>
                                <CardFooter>
                                    <Button onClick={handleStartCheck} disabled={isChecking}>
                                        {isChecking ? 'Running...' : 'Start Password Check'}
                                    </Button>
                                    <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" className="ml-2">
                                        Stop Password Check
                                    </Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>
                        <TabsContent value="running">
                            <PasswordCheckerRunning 
                                onComplete={() => {
                                    setActiveTab("reports");
                                    setIsChecking(false);
                                    setStatus("Completed");
                                }} 
                                progress={progress}
                                status={status}
                            />
                            <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" className="mt-4">
                                Stop Password Check
                            </Button>
                        </TabsContent>
                        <TabsContent value="reports">
                            <PasswordCheckerReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}