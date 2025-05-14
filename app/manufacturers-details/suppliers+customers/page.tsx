// components/ManufacturersDetails.tsx
// @ts-nocheck
"use client";

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { ManufacturersDetailsRunning } from './components/ManufacturersDetailsRunning'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion } from "framer-motion"
import { ManufacturersDetailsReports } from './components/ManufacturersDetailsReports'
import { Input } from "@/components/ui/input"
import { Search, ArrowUpDown } from "lucide-react"
import { kraService } from '../services/kra-service'
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { fetchSuppliers, type Supplier } from './utils/suppliers';

interface Manufacturer {
    id: number;
    manufacturer_name: string;
    pin_no: string;
    last_checked_at: string | null;
}

interface ManufacturersDetailsRunningProps {
    onComplete: () => void
    shouldStop: boolean
    initialResults?: Array<{
        kra_pin: string
        success: boolean
        data: any
    }>
    initialSummary?: {
        successful: number
        failed: number
    }
}

export default function ManufacturersDetailsSuppliers() {
    const [isChecking, setIsChecking] = useState(false)
    const [activeTab, setActiveTab] = useState("reports")
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
    const [selectedManufacturers, setSelectedManufacturers] = useState<number[]>([])
    const [runOption, setRunOption] = useState<'all' | 'selected' | 'missing'>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [newPins, setNewPins] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [kraResults, setKraResults] = useState<any[]>([])
    const [kraSummary, setKraSummary] = useState<any>(null)
    const [sortConfig, setSortConfig] = useState<{
        key: keyof Manufacturer | '';
        direction: 'ascending' | 'descending';
    }>({ key: '', direction: 'ascending' })

    useEffect(() => {
        fetchManufacturers()
    }, [])

    useEffect(() => {
        if (runOption === 'missing') {
            const missingSuppliers = manufacturers
                .filter(m => !m.manufacturer_name)
                .map(m => m.id);
            setSelectedManufacturers(missingSuppliers);
        } else if (runOption === 'all') {
            setSelectedManufacturers([]);
        }
    }, [runOption, manufacturers]);

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
            manufacturer.manufacturer_name?.toLowerCase().includes(searchLower)
        );
    });

    const handleSort = (key: keyof Manufacturer) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'ascending'
                ? 'descending'
                : 'ascending'
        }));
    };

    const sortedManufacturers = [...filteredManufacturers].sort((a, b) => {
        if (sortConfig.key === '') return 0;

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        // Put missing values at the top when sorting
        if (!aValue && !bValue) return 0;
        if (!aValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (!bValue) return sortConfig.direction === 'ascending' ? 1 : -1;

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
    });

    const handleStartCheck = async () => {
        setIsChecking(true)
        try {
            let kraPins;
            if (runOption === 'selected' || runOption === 'missing') {
                kraPins = manufacturers
                    .filter(m => selectedManufacturers.includes(m.id))
                    .map(m => m.pin_no);
            } else {
                kraPins = manufacturers.map(m => m.pin_no);
            }

            const { results, summary } = await kraService.startManufacturerDetailsCheck({
                kraPins,
                type: 'suppliers_and_customers'
            });
            setKraResults(results)
            setKraSummary(summary)
            setActiveTab("running")
        } catch (error) {
            console.error('Error starting manufacturers details check:', error)
            alert('Failed to start manufacturers details check. Please try again.')
        } finally {
            setIsChecking(false)
        }
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
                                            <Select value={runOption} onValueChange={(value) => setRunOption(value as 'all' | 'selected' | 'missing')}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Select run option" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Supplier Pins</SelectItem>
                                                    <SelectItem value="selected">Selected Supplier Pin</SelectItem>
                                                    <SelectItem value="missing">Selected Missing</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button size="sm">
                                                    Process New Supplier PIN
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle>Process New Supplier PINs</DialogTitle>
                                                    <DialogDescription>
                                                        Enter multiple PINs (one per line) to process them in batch.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4">
                                                    <div className="flex flex-col space-y-2">
                                                        <label className="text-sm font-medium">Enter Manufacturer PINs (one per line)</label>
                                                        <textarea
                                                            placeholder="Enter manufacturer PINs (one per line)"
                                                            value={newPins}
                                                            onChange={(e) => setNewPins(e.target.value)}
                                                            className="min-h-[100px] w-full p-2 border rounded-md"
                                                        />
                                                        <div className="text-sm text-muted-foreground">
                                                            {newPins.split('\n').filter(pin => pin.trim()).length} PINs entered
                                                        </div>
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <Button
                                                            onClick={() => {
                                                                const kraPins = newPins
                                                                    .split('\n')
                                                                    .map(pin => pin.trim())
                                                                    .filter(pin => pin.length > 0);

                                                                if (kraPins.length > 0) {
                                                                    kraService.startManufacturerDetailsCheck({
                                                                        kraPins,
                                                                        type: 'suppliers_and_customers'
                                                                    }).then(({ results, summary }) => {
                                                                        setKraResults(results);
                                                                        setKraSummary(summary);
                                                                        setActiveTab("running");
                                                                        setNewPins('');
                                                                        setDialogOpen(false);
                                                                    }).catch(error => {
                                                                        console.error('Error checking PINs:', error);
                                                                        alert('Failed to check PINs. Please try again.');
                                                                    });
                                                                }
                                                            }}
                                                            size="sm"
                                                            disabled={!newPins.trim()}
                                                        >
                                                            Start Manufacturers Check
                                                        </Button>
                                                        <Button
                                                            onClick={() => {
                                                                setNewPins('');
                                                                setShowPinInput(false);
                                                            }}
                                                            variant="outline"
                                                            size="sm"
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>

                                        <div className="relative">
                                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by PIN or supplier name..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-8"
                                            />
                                        </div>

                                        {(runOption === 'selected' || runOption === 'missing') && (
                                            <div className="flex">
                                                <motion.div
                                                    className="pr-2"
                                                    initial={{ width: "100%" }}
                                                    animate={{ width: selectedManufacturers.length > 0 ? "50%" : "100%" }}
                                                    transition={{ duration: 0.3 }}
                                                >
                                                    <div className="max-h-[580px] overflow-y-auto mt-2">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="w-[50px] sticky top-0 bg-white">Select</TableHead>
                                                                    <TableHead className="sticky top-0 bg-white">#</TableHead>
                                                                    <TableHead className="sticky top-0 bg-white">
                                                                        <Button
                                                                            variant="ghost"
                                                                            onClick={() => handleSort('pin_no')}
                                                                            className="h-8 p-0"
                                                                        >
                                                                            PIN Number
                                                                            <ArrowUpDown className="ml-2 h-4 w-4" />
                                                                        </Button>
                                                                    </TableHead>
                                                                    <TableHead className="sticky top-0 bg-white">
                                                                        <Button
                                                                            variant="ghost"
                                                                            onClick={() => handleSort('manufacturer_name')}
                                                                            className="h-8 p-0"
                                                                        >
                                                                            Supplier Name As Per Pin
                                                                            <ArrowUpDown className="ml-2 h-4 w-4" />
                                                                        </Button>
                                                                    </TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {sortedManufacturers.map((manufacturer, index) => (
                                                                    <TableRow key={manufacturer.id}>
                                                                        <TableCell>
                                                                            <Checkbox
                                                                                checked={selectedManufacturers.includes(manufacturer.id)}
                                                                                onCheckedChange={() => runOption === 'selected' && handleCheckboxChange(manufacturer.id)}
                                                                                disabled={runOption === 'missing'}
                                                                            />
                                                                        </TableCell>
                                                                        <TableCell className="text-center">{index + 1}</TableCell>
                                                                        <TableCell>
                                                                            {manufacturer.pin_no ? manufacturer.pin_no : <span className="text-red-500 font-medium">Missing</span>}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {manufacturer.manufacturer_name ? manufacturer.manufacturer_name : <span className="text-red-500 font-medium">Missing</span>}
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
                                                            <div className="max-h-[580px] overflow-y-auto">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead>#</TableHead>
                                                                            <TableHead>PIN Number</TableHead>
                                                                            <TableHead>
                                                                                Supplier Name As Per Pin
                                                                                {selectedManufacturers.length > 0 && (
                                                                                    <Badge variant="secondary" className="ml-2">
                                                                                        {selectedManufacturers.length}
                                                                                    </Badge>
                                                                                )}</TableHead>
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
                                                                                    {manufacturer.manufacturer_name ? manufacturer.manufacturer_name : <span className="text-red-500 font-medium">Missing</span>}
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                            <div className="flex space-x-2">
                                                                <Button onClick={handleStartCheck} disabled={isChecking || selectedManufacturers.length === 0} size="sm">
                                                                    {isChecking ? 'Starting...' : 'Start Manufacturers Details Check'}
                                                                </Button>
                                                            </div>
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
                                        </div>
                                    </CardFooter>
                                )}
                            </Card>
                        </TabsContent>
                        <TabsContent value="running">
                            <ManufacturersDetailsRunning
                                onComplete={() => setActiveTab("reports")}
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