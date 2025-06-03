//@ts-nocheck
"use client";

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { supabase } from '@/lib/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion } from "framer-motion"
import { ManufacturersDetailsRunning } from '../suppliers+customers/components/ManufacturersDetailsRunning';
import { ManufacturersDetailsReports } from './components/ManufacturersDetailsReports';

interface Manufacturer {
    id: number;
    company_name: string;
    kra_pin: string;
    last_checked_at: string | null;
}

export default function ManufacturersDetailsCompanies() {
    const [isChecking, setIsChecking] = useState(false)
    const [activeTab, setActiveTab] = useState("reports")
    const [shouldStop, setShouldStop] = useState(false)
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
    const [selectedManufacturers, setSelectedManufacturers] = useState<number[]>([])
    const [runOption, setRunOption] = useState<'all' | 'selected'>('all')

    useEffect(() => {
        fetchManufacturers()
    }, [])

    const fetchManufacturers = async () => {
        console.log('Fetching manufacturers data...');
        const { data, error } = await supabase
            .from('acc_portal_company_duplicate')
            .select('id, company_name, kra_pin')
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching manufacturers:', error);
        } else {
            console.log('Manufacturers data fetched successfully:', data);
            setManufacturers(data as Manufacturer[] || []);
        }

        console.log('Manufacturers state updated:', manufacturers);
    }

    const handleStartCheck = async () => {
        setIsChecking(true)
        setShouldStop(false)
        try {
            const response = await fetch('/api/manufacturers-details', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    stop: shouldStop,
                    runOption,
                    selectedIds: runOption === 'selected' ? selectedManufacturers : []
                })
            });

            if (!response.ok) throw new Error('API request failed')

            const data = await response.json()
            console.log('Manufacturers details check completed:', data)
            setActiveTab("running")
        } catch (error) {
            console.error('Error starting manufacturers details check:', error)
            alert('Failed to start manufacturers details check. Please try again.')
        } finally {
            setIsChecking(false)
        }
    }

    const handleStopCheck = () => {
        setShouldStop(true)
        alert('Stopping all automations...')
    }

    const handleCheckboxChange = (id: number) => {
        setSelectedManufacturers(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    return (
        <div className="p-4 w-full">
            <Card>
                <CardHeader>
                    <CardTitle>Manufacturers Details Checker</CardTitle>
                    <CardDescription>Extract and validate manufacturers details from KRA</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="start">Start</TabsTrigger>
                            <TabsTrigger value="running">Running</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                        </TabsList>
                        <TabsContent value="start">
                            <Card className='overflow-y-auto'>
                                <CardHeader>
                                    <CardTitle>Start Manufacturers Details Check</CardTitle>
                                    <CardDescription>Begin the manufacturers details extraction process for all companies.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="mb-4">
                                        <label className="block mb-2">Run option:</label>
                                        <Select value={runOption} onValueChange={(value) => setRunOption(value as 'all' | 'selected')}>
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
                                                animate={{ width: selectedManufacturers.length > 0 ? "50%" : "100%" }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <div className="h-[500px] overflow-y-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[50px] sticky top-0 bg-white">Select</TableHead>
                                                                <TableHead className="sticky top-0 bg-white">#</TableHead>
                                                                <TableHead className="sticky top-0 bg-white">Company Name</TableHead>
                                                                <TableHead className="sticky top-0 bg-white">KRA PIN</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {manufacturers.map((manufacturer, index) => (
                                                                <TableRow key={manufacturer.id}>
                                                                    <TableCell>
                                                                        <Checkbox
                                                                            checked={selectedManufacturers.includes(manufacturer.id)}
                                                                            onCheckedChange={() => handleCheckboxChange(manufacturer.id)}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell className="text-center">{index + 1}</TableCell>
                                                                    <TableCell>{manufacturer.company_name}</TableCell>
                                                                    <TableCell>{manufacturer.kra_pin}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </motion.div>
                                            {selectedManufacturers.length > 0 && (
                                                <motion.div
                                                    className="pl-2"
                                                    initial={{ width: "0%", opacity: 0 }}
                                                    animate={{ width: "50%", opacity: 1 }}
                                                    transition={{ duration: 0.3 }}
                                                >
                                                    <div className="mb-4">
                                                        <h3 className="text-lg font-semibold mb-2">Selected Companies</h3>
                                                        <div className="h-[500px] overflow-auto">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>#</TableHead>
                                                                        <TableHead>Company Name</TableHead>
                                                                        <TableHead>KRA PIN</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {manufacturers.filter(m => selectedManufacturers.includes(m.id)).map((manufacturer, index) => (
                                                                        <TableRow key={manufacturer.id} className="bg-blue-100">
                                                                            <TableCell>{index + 1}</TableCell>
                                                                            <TableCell>{manufacturer.company_name}</TableCell>
                                                                            <TableCell>{manufacturer.kra_pin}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                        <div className="flex space-x-2">
                                                            <Button onClick={handleStartCheck} disabled={isChecking || selectedManufacturers.length === 0} size="sm">
                                                                {isChecking ? 'Starting...' : 'Start Manufacturers Details Check'}
                                                            </Button>
                                                            <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" size="sm">
                                                                Stop Manufacturers Details Check
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                                {runOption === 'all' && (
                                    <CardFooter>
                                        <div className="flex space-x-2">
                                            <Button onClick={handleStartCheck} disabled={isChecking} size="sm">
                                                {isChecking ? 'Starting...' : 'Start Manufacturers Details Check'}
                                            </Button>
                                            <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" size="sm">
                                                Stop Manufacturers Details Check
                                            </Button>
                                        </div>
                                    </CardFooter>
                                )}
                            </Card>
                        </TabsContent>
                        <TabsContent value="running">
                            <ManufacturersDetailsRunning
                                onComplete={() => setActiveTab("reports")}
                                shouldStop={shouldStop}
                                initialResults={kraResults}
                                initialSummary={kraSummary}
                            />
                        </TabsContent>
                        <TabsContent value="reports">
                            <ManufacturersDetailsReports />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}