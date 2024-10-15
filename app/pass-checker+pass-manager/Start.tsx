// @ts-nocheck
"use client";
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function StartTab({ companies, isChecking, handleStartCheck, handleStopCheck }) {
    const [selectedCompanies, setSelectedCompanies] = useState([]);
    const [runOption, setRunOption] = useState('all');

    const handleCheckboxChange = (id) => {
        setSelectedCompanies(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    return (
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
                                    <Button onClick={() => handleStartCheck(runOption, selectedCompanies)} disabled={isChecking || selectedCompanies.length === 0}>
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
                    <Button onClick={() => handleStartCheck(runOption, selectedCompanies)} disabled={isChecking}>
                        {isChecking ? 'Running...' : 'Start Password Check'}
                    </Button>
                    <Button onClick={handleStopCheck} disabled={!isChecking} variant="destructive" className="ml-2">
                        Stop Password Check
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}