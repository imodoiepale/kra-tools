// pages/pin-checker-details.tsx
// @ts-nocheck
"use client"

import { useState, useEffect, useCallback } from 'react' // Added useCallback
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PinCheckerDetailsRunning } from '@/app/pin-checker-details/components/PinCheckerDetailsRunning'
import { PinCheckerDetailsReports } from '@/app/pin-checker-details/components/PinCheckerDetailsReports'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion } from "framer-motion"
import { supabase } from '@/lib/supabase'
import { EditDatesDialog } from './components/EditDatesDialog' // Make sure this path is correct, might be @/app/...

export default function PinCheckerDetails() {
    const [isChecking, setIsChecking] = useState(false)
    const [activeTab, setActiveTab] = useState("reports") // Default to reports, can change based on initial check
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState("Not Started")
    const [companies, setCompanies] = useState([])
    const [selectedCompanies, setSelectedCompanies] = useState([])
    const [runOption, setRunOption] = useState('all')
    const [clientType, setClientType] = useState('acc') // <--- FIXED: Default to 'acc'
    const [selectedCompany, setSelectedCompany] = useState<any>(null); // Not used in this component, but kept
    const [editDialogOpen, setEditDialogOpen] = useState(false); // Not used in this component, but kept

    // useCallback for fetchCompanies to avoid re-creation on every render
    const fetchCompanies = useCallback(async () => {
        const currentDate = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

        let query = supabase
            .from('acc_portal_company_duplicate')
            .select('id, company_name, kra_pin, acc_client_effective_from, acc_client_effective_to, audit_client_effective_from, audit_client_effective_to')
            .order('company_name', { ascending: true }); // Order for consistent display

        // <--- FIXED: Filter data directly in Supabase query for efficiency
        if (clientType === 'all') {
            query = query.or(
                `acc_client_effective_from.lte.${currentDate},acc_client_effective_to.gte.${currentDate}`,
                `audit_client_effective_from.lte.${currentDate},audit_client_effective_to.gte.${currentDate}`
            );
        } else if (clientType === 'acc') {
            query = query.and(
                `acc_client_effective_from.lte.${currentDate}`,
                `acc_client_effective_to.gte.${currentDate}`
            );
        } else if (clientType === 'audit') {
            query = query.and(
                `audit_client_effective_from.lte.${currentDate}`,
                `audit_client_effective_to.gte.${currentDate}`
            );
        }
        // Removed the redundant JS-side filtering. Supabase handles it now.

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching companies:', error);
            return;
        }

        console.log(`Fetched companies for ${clientType} client type:`, data);
        setCompanies(data || []);
        setSelectedCompanies([]); // Clear selected companies when client type changes
    }, [clientType]); // Only re-create if clientType changes

    // <--- FIXED: Initial fetch of progress status on component mount
    const checkProgress = useCallback(async () => {
        try {
            const response = await fetch('/api/pin-checker-details', { // Ensure this is the correct API endpoint
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: "getProgress" })
            });
            if (!response.ok) throw new Error('Failed to fetch progress');
            const data = await response.json();
            setProgress(data.progress);
            setStatus(data.status);
            setIsChecking(data.status === "Running"); // Set isChecking based on fetched status
            if (data.status === "Running") {
                setActiveTab("running");
            } else if (data.status === "Completed" || data.status === "Stopped" || data.status === "Error") {
                setActiveTab("reports");
            }
        } catch (error) {
            console.error('Error checking progress:', error);
            setIsChecking(false); // Assume not checking on error
            setStatus("Error fetching progress");
        }
    }, []); // No dependencies, runs once on mount and can be called explicitly

    // Run initial fetch of companies and progress
    useEffect(() => {
        fetchCompanies();
        checkProgress(); // <--- FIXED: Check progress on mount
    }, [fetchCompanies, checkProgress]); // Dependencies to ensure they are fetched

    // Polling for progress (only if isChecking is true)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isChecking) {
            interval = setInterval(checkProgress, 5000); // Poll every 5 seconds
        }
        return () => clearInterval(interval); // Clean up interval on unmount or if isChecking becomes false
    }, [isChecking, checkProgress]); // <--- FIXED: Poll only if isChecking

    // Reset any existing automation status before starting a new one
    const resetAutomationStatus = async () => {
        try {
            const response = await fetch('/api/pin-checker-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: "stop"
                })
            });

            if (!response.ok) {
                console.warn('Failed to reset automation status, but continuing anyway');
            } else {
                console.log('Successfully reset automation status');
                // Wait a short time to ensure status is updated in database
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.warn('Error resetting automation status:', error);
            // Continue anyway
        }
    };

    const handleStartCheck = async () => {
        if (isChecking) {
            alert('An automation is already running. Please wait for it to complete or stop it before starting a new one.');
            return;
        }

        try {
            // Check if we have companies selected when needed
            if (runOption === 'selected' && selectedCompanies.length === 0) {
                throw new Error('Please select at least one company when using the Selected Companies option');
            }

            // First, reset any existing automation status
            await resetAutomationStatus();

            // Determine which IDs to send based on the run option
            const idsToSend = runOption === 'selected' ? selectedCompanies : companies.map(company => company.id);

            console.log('Sending request with:', {
                action: "start",
                runOption,
                selectedIds: idsToSend
            });

            const response = await fetch('/api/pin-checker-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: "start",
                    runOption,
                    selectedIds: idsToSend
                })
            })

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API request failed: ${errorData.message || response.statusText}`);
            }

            const data = await response.json()
            console.log('PIN Checker Details started:', data)
            setIsChecking(true)
            setStatus("Running")
            setActiveTab("running")
            setProgress(0); // Reset progress on start
        } catch (error) {
            console.error('Error starting PIN Checker Details:', error)
            alert(`Failed to start PIN Checker Details. ${error.message}. Please try again.`)
            setIsChecking(false); // Reset state if start fails
            setStatus("Not Started / Error");
        }
    }

    const handleStopCheck = async () => {
        if (!isChecking) {
            alert('There is no automation currently running.');
            return;
        }

        try {
            const response = await fetch('/api/pin-checker-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: "stop" })
            })

            if (!response.ok) throw new Error('Failed to stop automation')

            const data = await response.json()
            console.log('Automation stopped:', data)
            setIsChecking(false)
            setStatus("Stopped")
            alert('Automation stopped successfully.')
            checkProgress(); // Immediately check progress after stopping to update state
        } catch (error) {
            console.error('Error stopping automation:', error)
            alert('Failed to stop automation. Please try again.')
        }
    }

    const handleCheckboxChange = (id: string) => {
        setSelectedCompanies((prev: string[] | never[]) =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader>
                    <CardTitle>PIN Checker Details (Obligations)</CardTitle>
                    <CardDescription>Extract obligation details for multiple companies</CardDescription>
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
                                    <CardTitle>Start PIN Checker Details</CardTitle>
                                    <CardDescription>Begin the obligation details extraction process for companies.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="mb-4 flex space-x-4">
                                        <div className="mb-4">
                                            <label className="block mb-2">Client Type:</label>
                                            <Select value={clientType} onValueChange={(value) => {
                                                setClientType(value)
                                                setSelectedCompanies([]) // Clear selected companies when client type changes
                                            }}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Select client type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Clients</SelectItem>
                                                    <SelectItem value="acc">ACC Clients</SelectItem>
                                                    <SelectItem value="audit">Audit Clients</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

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
                                                                <TableHead className="w-[50px] sticky top-0 bg-white">
                                                                    <Checkbox
                                                                        checked={selectedCompanies.length === companies.length && companies.length > 0}
                                                                        onCheckedChange={(checked) => {
                                                                            if (checked) {
                                                                                setSelectedCompanies(companies.map(c => c.id))
                                                                            } else {
                                                                                setSelectedCompanies([])
                                                                            }
                                                                        }}
                                                                    />
                                                                </TableHead>
                                                                <TableHead className="sticky top-0 bg-white">#</TableHead>
                                                                <TableHead className="sticky top-0 bg-white">Company Name</TableHead>
                                                                <TableHead className="sticky top-0 bg-white">KRA PIN</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {[...companies]
                                                                .sort((a, b) => a.company_name.localeCompare(b.company_name, undefined, { sensitivity: 'base' }))
                                                                .map((company, index) => (
                                                                    <TableRow key={company.id}>
                                                                        <TableCell>
                                                                            <Checkbox
                                                                                checked={selectedCompanies.includes(company.id)}
                                                                                onCheckedChange={() => handleCheckboxChange(company.id)}
                                                                            />
                                                                        </TableCell>
                                                                        <TableCell className="text-center">{index + 1}</TableCell>
                                                                        <TableCell>{company.company_name}</TableCell>
                                                                        <TableCell>{company.kra_pin}</TableCell>
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
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {[...companies]
                                                                    .filter(c => selectedCompanies.includes(c.id))
                                                                    .sort((a, b) => a.company_name.localeCompare(b.company_name, undefined, { sensitivity: 'base' }))
                                                                    .map((company, index) => (
                                                                        <TableRow key={company.id} className="bg-blue-100">
                                                                            <TableCell>{index + 1}</TableCell>
                                                                            <TableCell>{company.company_name}</TableCell>
                                                                            <TableCell>{company.kra_pin}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                    <div className="mt-4">
                                                        <Button onClick={handleStartCheck} disabled={isChecking || (runOption === 'selected' && selectedCompanies.length === 0)}>
                                                            {isChecking ? 'Running...' : 'Start PIN Checker Details'}
                                                        </Button>
                                                        <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" className="ml-2">
                                                            Stop PIN Checker Details
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                                {runOption !== 'selected' && (
                                    <CardFooter>
                                        <Button onClick={handleStartCheck} disabled={isChecking || (runOption === 'selected' && selectedCompanies.length === 0)}>
                                            {isChecking ? 'Running...' : 'Start PIN Checker Details'}
                                        </Button>
                                        <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" className="ml-2">
                                            Stop PIN Checker Details
                                        </Button>
                                    </CardFooter>
                                )}
                            </Card>
                        </TabsContent>
                        <TabsContent value="running">
                            <PinCheckerDetailsRunning
                                onComplete={() => {
                                    setActiveTab("reports");
                                    setIsChecking(false);
                                    setStatus("Completed");
                                }}
                                progress={progress}
                                status={status}
                            />
                            <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" className="mt-4">
                                Stop PIN Checker Details
                            </Button>
                        </TabsContent>
                        <TabsContent value="reports">
                            <PinCheckerDetailsReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}