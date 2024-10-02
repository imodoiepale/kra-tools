// @ts-nocheck
"use client";
import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PasswordCheckerRunning } from '@/components/PasswordCheckerRunning'
import { PasswordCheckerReports } from '@/components/PasswordCheckerReports'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion } from "framer-motion"
import { supabase } from '@/lib/supabase'

export default function PasswordChecker() {
    const [isChecking, setIsChecking] = useState(false)
    const [activeTab, setActiveTab] = useState("reports")
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState("Not Started")
    const [companies, setCompanies] = useState([])
    const [selectedCompanies, setSelectedCompanies] = useState([])
    const [runOption, setRunOption] = useState('all')

    useEffect(() => {
        fetchCompanies()
    }, [])

    useEffect(() => {
        if (isChecking) {
            const interval = setInterval(checkProgress, 5000)
            return () => clearInterval(interval)
        }
    }, [isChecking])

    const fetchCompanies = async () => {
        const { data, error } = await supabase
            .from('PasswordChecker')
            .select('id, company_name, kra_pin, kra_password, status')
            .order('id', { ascending: true })

        if (error) {
            console.error('Error fetching companies:', error)
        } else {
            setCompanies(data || [])
        }
    }

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
            }
        } catch (error) {
            console.error('Error checking progress:', error);
            setIsChecking(false);
            setStatus("Not Started");
            setProgress(0);
        }
    };

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
                body: JSON.stringify({
                    action: "start",
                    runOption,
                    selectedIds: runOption === 'selected' ? selectedCompanies : []
                })
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

    const handleCheckboxChange = (id) => {
        setSelectedCompanies(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
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
                                    <CardDescription>Begin the password validation process for companies.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="mb-4">
                                        <label className="block mb-2">Run option:</label>
                                        <Select value={runOption} onValueChange={(value) => setRunOption(value)}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Select run option" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Companies</SelectItem>
                                                <SelectItem value="selected">Selected Companies</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {runOption === 'selected' && (
                                        <div className="flex">
                                            <motion.div
                                                className="pr-2"
                                                initial={{ width: "100%" }}
                                                animate={{ width: selectedCompanies.length > 0 ? "50%" : "100%" }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <div className="max-h-[580px] overflow-y-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[50px] sticky top-0 bg-white">Select</TableHead>
                                                                <TableHead className="sticky top-0 bg-white">#</TableHead>
                                                                <TableHead className="sticky top-0 bg-white">Company Name</TableHead>
                                                                <TableHead className="sticky top-0 bg-white">KRA PIN</TableHead>
                                                                <TableHead className="sticky top-0 bg-white">KRA Password</TableHead>
                                                                <TableHead className="sticky top-0 bg-white">Status</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {companies.map((company, index) => (
                                                                <TableRow key={company.id}>
                                                                    <TableCell>
                                                                        <Checkbox
                                                                            checked={selectedCompanies.includes(company.id)}
                                                                            onCheckedChange={() => handleCheckboxChange(company.id)}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell className="text-center">{index + 1}</TableCell>
                                                                    <TableCell>{company.company_name}</TableCell>
                                                                    <TableCell>{company.kra_pin || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                                                                    <TableCell>{company.kra_password || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                                                                    <TableCell className="">
                                                                        {company.status?.toLowerCase() === 'valid' && <span className="bg-green-500 text-white px-2 py-1 rounded">{company.status}</span>}
                                                                        {company.status?.toLowerCase() === 'invalid' && <span className="bg-red-500 text-white px-2 py-1 rounded">{company.status}</span>}
                                                                        {company.status?.toLowerCase() !== 'valid' && company.status?.toLowerCase() !== 'invalid' && <span className="bg-yellow-500 text-white px-2 py-1 rounded">{company.status}</span>}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </motion.div>
                                            {selectedCompanies.length > 0 && (
                                                <motion.div
                                                    className="pl-2"
                                                    initial={{ width: "0%", opacity: 0 }}
                                                    animate={{ width: "50%", opacity: 1 }}
                                                    transition={{ duration: 0.3 }}
                                                >
                                                    <div className="mb-4">
                                                        <h3 className="text-lg font-semibold mb-2">Selected Companies</h3>
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>#</TableHead>
                                                                    <TableHead>Company Name</TableHead>
                                                                    <TableHead>KRA PIN</TableHead>
                                                                    <TableHead>KRA Password</TableHead>
                                                                    <TableHead>Status</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {companies.filter(c => selectedCompanies.includes(c.id)).map((company, index) => (
                                                                    <TableRow key={company.id} className="bg-blue-100">
                                                                        <TableCell className="text-center">{index + 1}</TableCell>
                                                                        <TableCell>{company.company_name}</TableCell>
                                                                        <TableCell>{company.kra_pin || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                                                                        <TableCell>{company.kra_password || <span className="text-red-500 font-bold">Missing</span>}</TableCell>
                                                                        <TableCell className="">
                                                                            {company.status?.toLowerCase() === 'valid' && <span className="bg-green-500 text-white px-2 py-1 rounded">{company.status}</span>}
                                                                            {company.status?.toLowerCase() === 'invalid' && <span className="bg-red-500 text-white px-2 py-1 rounded">{company.status}</span>}
                                                                            {company.status?.toLowerCase() !== 'valid' && company.status?.toLowerCase() !== 'invalid' && <span className="bg-yellow-500 text-white px-2 py-1 rounded">{company.status}</span>}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                    <div className="mt-4">
                                                        <Button onClick={handleStartCheck} disabled={isChecking || selectedCompanies.length === 0}>
                                                            {isChecking ? 'Running...' : 'Start Password Check'}
                                                        </Button>
                                                        <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" className="ml-2">
                                                            Stop Password Check
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                                {runOption === 'all' && (
                                    <CardFooter>
                                        <Button onClick={handleStartCheck} disabled={isChecking}>
                                            {isChecking ? 'Running...' : 'Start Password Check'}
                                        </Button>
                                        <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" className="ml-2">
                                            Stop Password Check
                                        </Button>
                                    </CardFooter>
                                )}
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