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
    const monthsToShow = 12;

    const formatDateTime = (dateTimeString) => {
        if (!dateTimeString) return { date: '-', time: '-' };
        const date = new Date(dateTimeString);
        return {
            date: format(date, 'dd.MM.yyyy'),
            time: format(date, 'HH:mm')
        };
    };

    const months = Array.from({ length: monthsToShow }, (_, i) => {
        const month = (currentMonth - i + 12) % 12;
        return {
            monthIndex: month,
            monthKey: (month + 1).toString().padStart(2, '0'),
            year: month > currentMonth ? year - 1 : year
        };
    });

    return (
        <div className="flex space-x-6">
            <div className="w-2/8 pr-4">
                <h2 className="text-xl font-bold mb-4">Companies</h2>
                <ScrollArea className="h-[600px] border rounded-lg shadow-inner bg-gray-50">
                    <ul className="space-y-1 p-2">
                        {filteredClients.map((client, index) => (
                            <li
                                key={client.company_name}
                                className={`cursor-pointer p-2 rounded-md text-sm transition-colors duration-150 ease-in-out ${
                                    selectedCompany === client.company_name 
                                    ? 'bg-blue-500 text-white font-semibold' 
                                    : 'hover:bg-gray-200'
                                }`}
                                onClick={() => setSelectedCompany(client.company_name)}
                            >
                                {index + 1}. {client.company_name}
                            </li>
                        ))}
                    </ul>
                </ScrollArea>
            </div>
            <div className="w-full">
                <h2 className="text-2xl font-bold mb-4">Detailed View</h2>
                <ScrollArea className="h-[600px] border rounded-lg shadow-lg">
                    <Table>
                        <TableHeader>
                            {selectedCompany && (
                                <TableRow>
                                    <TableHead colSpan={8} className="bg-blue-100 text-left text-black font-bold">
                                        {selectedCompany}
                                    </TableHead>
                                </TableRow>
                            )}
                            <TableRow className="bg-gray-100">
                                <TableHead className="w-8 font-bold">#</TableHead>
                                <TableHead className="w-2/12 font-bold whitespace-nowrap">Month</TableHead>
                                <TableHead className="w-1/12 font-bold whitespace-nowrap">Received</TableHead>
                                <TableHead className="w-2/12 font-bold whitespace-nowrap">Received Date</TableHead>
                                <TableHead className="w-1/12 font-bold whitespace-nowrap">Received Time</TableHead>
                                <TableHead className="w-1/12 font-bold whitespace-nowrap">Delivered</TableHead>
                                <TableHead className="w-2/12 font-bold whitespace-nowrap">Delivered Date</TableHead>
                                <TableHead className="w-2/12 font-bold whitespace-nowrap">Delivered Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedCompany && months.map(({ monthIndex, monthKey, year }, index) => {
                                const clientData = checklist[selectedCompany]?.file_management?.[year]?.[monthKey];
                                const receivedDateTime = formatDateTime(clientData?.receivedAt);
                                const deliveredDateTime = formatDateTime(clientData?.deliveredAt);
                                
                                return (
                                    <TableRow key={`${year}-${monthKey}`} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                        <TableCell className="font-semibold">{index + 1}</TableCell>
                                        <TableCell className="font-semibold whitespace-nowrap">
                                            {format(new Date(year, monthIndex), 'MMMM yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            {clientData?.receivedAt ? (
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-500" />
                                            )}
                                        </TableCell>
                                        <TableCell>{receivedDateTime.date}</TableCell>
                                        <TableCell>{receivedDateTime.time}</TableCell>
                                        <TableCell>
                                            {clientData?.filesDelivered ? (
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-500" />
                                            )}
                                        </TableCell>
                                        <TableCell>{deliveredDateTime.date}</TableCell>
                                        <TableCell>{deliveredDateTime.time}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    );
}