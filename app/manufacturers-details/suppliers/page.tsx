// components/ManufacturersDetails.tsx
"use client";

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow,TableFooter } from "@/components/ui/table"
import { ManufacturersDetailsRunning } from './components/ManufacturersDetailsRunning'
import { fetchSuppliers, type Supplier } from './utils/suppliers'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion } from "framer-motion"
import { ManufacturersDetailsReports } from './components/ManufacturersDetailsReports'
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface Manufacturer {
    id: number;
    supplier_name_as_per_pin: string;
    pin_no: string;
    last_checked_at: string | null;
}

export default function ManufacturersDetailsSuppliers() {
    const [isChecking, setIsChecking] = useState(false)
    const [activeTab, setActiveTab] = useState("reports")
    const [shouldStop, setShouldStop] = useState(false)
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
    const [selectedManufacturers, setSelectedManufacturers] = useState<number[]>([])
    const [runOption, setRunOption] = useState<'all' | 'selected'>('all')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchManufacturers()
    }, [])

    const fetchManufacturers = async () => {
        console.log('Fetching manufacturers data...');
        try {
            const data = await fetchSuppliers();
            console.log('Manufacturers data fetched successfully:', data);
            setManufacturers(data || []);
        } catch (error) {
            console.error('Error fetching manufacturers:', error);
        }
    }

    const filteredManufacturers = manufacturers.filter(manufacturer => {
        const searchLower = searchTerm.toLowerCase();
        return (
            manufacturer.pin_no?.toLowerCase().includes(searchLower) ||
            manufacturer.supplier_name_as_per_pin?.toLowerCase().includes(searchLower)
        );
    });

    const handleStartCheck = async () => {
        setIsChecking(true)
        setShouldStop(false)
        try {
            let kraPins;
            if (runOption === 'selected') {
                kraPins = manufacturers
                    .filter(m => selectedManufacturers.includes(m.id))
                    .map(m => m.pin_no);
            } else {
                kraPins = manufacturers.map(m => m.pin_no);
            }

            // Process each KRA PIN through the webhook
            const requests = kraPins.map(kra_pin => {
                const url = `https://primary-production-079f.up.railway.app/webhook-test/manufucturerDetails?kra_pin=${encodeURIComponent(kra_pin)}&type=suppliers`;
                
                return fetch(url)
                    .then(res => res.json())
                    .then(data => ({ kra_pin, success: true, data }))
                    .catch(error => ({ kra_pin, success: false, error }));
            });

            // Process all requests concurrently
            const results = await Promise.all(requests);
            console.log("All Results:", results);

            // Still notify the API about the process starting
            const response = await fetch('/api/kra-automation-for-components', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    kra_pins: kraPins,
                    type: 'suppliers',
                    stop: shouldStop,
                    webhook_results: results
                })
            });

            if (!response.ok) throw new Error('API request failed')

            const data = await response.json()
            console.log('Manufacturers details check started:', data)
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
                            <Card>
                                <CardHeader>
                                    <CardTitle>Start Manufacturers Details Check</CardTitle>
                                    <CardDescription>Begin the manufacturers details extraction process for all supplier pins.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-2">
                                            <label className="text-sm font-medium">Run option:</label>
                                            <Select value={runOption} onValueChange={(value) => setRunOption(value as 'all' | 'selected')}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Select run option" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Supplier Pins</SelectItem>
                                                    <SelectItem value="selected">Selected Supplier Pin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="relative">
                                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by PIN or supplier name..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-8"
                                            />
                                        </div>

                                        {runOption === 'selected' && (
                                            <div className="flex">
                                                <motion.div
                                                    className="pr-2"
                                                    initial={{ width: "100%" }}
                                                    animate={{ width: selectedManufacturers.length > 0 ? "50%" : "100%" }}
                                                    transition={{ duration: 0.3 }}
                                                >
                                                    <div className="max-h-[580px] overflow-y-auto">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="w-[50px] sticky top-0 bg-white">Select</TableHead>
                                                                    <TableHead className="sticky top-0 bg-white">#</TableHead>
                                                                    <TableHead className="sticky top-0 bg-white">PIN Number</TableHead>
                                                                    <TableHead className="sticky top-0 bg-white">Supplier Name As Per Pin</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {filteredManufacturers.map((manufacturer, index) => (
                                                                    <TableRow key={manufacturer.id}>
                                                                        <TableCell>
                                                                            <Checkbox
                                                                                checked={selectedManufacturers.includes(manufacturer.id)}
                                                                                onCheckedChange={() => handleCheckboxChange(manufacturer.id)}
                                                                            />
                                                                        </TableCell>
                                                                        <TableCell className="text-center">{index + 1}</TableCell>
                                                                        <TableCell>
                                                                            {manufacturer.pin_no ? manufacturer.pin_no : <span className="text-red-500 font-medium">Missing</span>}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {manufacturer.supplier_name_as_per_pin ? manufacturer.supplier_name_as_per_pin : <span className="text-red-500 font-medium">Missing</span>}
                                                                        </TableCell>
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
                                                            <h3 className="text-lg font-semibold mb-2">Selected Supplier Pin</h3>
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>#</TableHead>
                                                                        <TableHead>PIN Number</TableHead>
                                                                        <TableHead>Supplier Name As Per Pin</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {manufacturers.filter(m => selectedManufacturers.includes(m.id)).map((manufacturer, index) => (
                                                                        <TableRow key={manufacturer.id} className="bg-blue-100">
                                                                            <TableCell>{index + 1}</TableCell>
                                                                            <TableCell>
                                                                                {manufacturer.pin_no ? manufacturer.pin_no : <span className="text-red-500 font-medium">Missing</span>}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                {manufacturer.supplier_name_as_per_pin ? manufacturer.supplier_name_as_per_pin : <span className="text-red-500 font-medium">Missing</span>}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                                <TableFooter>
                                                                    <TableRow>
                                                                        <TableCell colSpan={4}>
                                                                            <div className="flex space-x-2">
                                                                                <Button onClick={handleStartCheck} disabled={isChecking || selectedManufacturers.length === 0} size="sm">
                                                                                    {isChecking ? 'Starting...' : 'Start Manufacturers Details Check'}
                                                                                </Button>
                                                                                <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" size="sm">
                                                                                    Stop Manufacturers Details Check
                                                                                </Button>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                </TableFooter>
                                                            </Table>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </div>
                                        )}
                                    </div>
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
                            <ManufacturersDetailsRunning onComplete={() => setActiveTab("reports")} shouldStop={shouldStop} />
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