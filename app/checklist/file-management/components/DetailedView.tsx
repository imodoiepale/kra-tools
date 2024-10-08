// @ts-nocheck
"use client"

import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function DetailedView({ filteredClients, checklist, selectedDate }) {
    const [selectedCompany, setSelectedCompany] = useState(null);
    const year = selectedDate.getFullYear();
    const currentMonth = new Date().getMonth();
    const monthsToShow = 6;

    return (
        <div className="flex">
            <div className="w-1/6 pr-4">
                <h2 className="text-xl font-bold mb-4">Companies</h2>
                <ScrollArea className="h-[500px]">
                    <ul className="space-y-2">
                        {filteredClients.map((client, index) => (
                            <li
                                key={client.company_name}
                                className={`cursor-pointer p-2 rounded ${selectedCompany === client.company_name ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                                onClick={() => setSelectedCompany(client.company_name)}
                            >
                                {index + 1}. {client.company_name}
                            </li>
                        ))}
                    </ul>
                </ScrollArea>
            </div>
            <div className="w-5/6">
                <ScrollArea className="h-[600px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Month</TableHead>
                                <TableHead>Received</TableHead>
                                <TableHead>Delivered</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedCompany && Array.from({ length: monthsToShow }, (_, i) => currentMonth - i).reverse().map((month, index) => {
                                const monthKey = (month + 1).toString().padStart(2, '0');
                                const clientData = checklist[selectedCompany]?.file_management?.[year]?.[monthKey];
                                return (
                                    <TableRow key={month}>
                                        <TableCell>{index + 1}. {format(new Date(year, month), 'MMMM yyyy')}</TableCell>
                                        <TableCell>
                                            {clientData?.receivedAt ? (
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-red-500" />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {clientData?.filesDelivered ? (
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-red-500" />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    );
};
