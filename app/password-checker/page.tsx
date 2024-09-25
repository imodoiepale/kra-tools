// @ts-nocheck
"use client";
// components/PasswordChecker.tsx
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PasswordCheckerRunning } from '@/components/PasswordCheckerRunning'
import { PasswordCheckerReports } from '@/components/PasswordCheckerReports'

export default function PasswordChecker() {
    const [isChecking, setIsChecking] = useState(false)
    const [activeTab, setActiveTab] = useState("start")
    const [shouldStop, setShouldStop] = useState(false) // State to control stopping

    const handleStartCheck = async () => {
        setIsChecking(true)
        setShouldStop(false) // Reset stop state
        try {
            const response = await fetch('/api/password-checker', {
                method: 'POST',
                body: JSON.stringify({ stop: shouldStop }) // Send stop signal
            })

            if (!response.ok) throw new Error('API request failed')

            const data = await response.json()
            console.log('Password check completed:', data)
            setActiveTab("running")
        } catch (error) {
            console.error('Error starting password check:', error)
            alert('Failed to start password check. Please try again.')
        } finally {
            setIsChecking(false)
        }
    }

    const handleStopCheck = () => {
        setShouldStop(true) // Set the state to stop automation
        alert('Stopping all automations...')
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
                                        {isChecking ? 'Starting...' : 'Start Password Check'}
                                    </Button>
                                    <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" className="ml-2">
                                        Stop Password Check
                                    </Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>
                        <TabsContent value="running">
                            <PasswordCheckerRunning onComplete={() => setActiveTab("reports")} shouldStop={shouldStop} />
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
