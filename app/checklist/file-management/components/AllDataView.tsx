// @ts-nocheck
"use client"


import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function AllDataView({ filteredClients, checklist, selectedDate }) {
    const year = selectedDate.getFullYear();
    const currentMonth = new Date().getMonth();
    const startMonth = 6; // July is the 7th month (0-indexed)
    const monthsToShow = currentMonth - startMonth + 1;

    const getStatusCounts = (clients, year, month) => {
        const received = clients.filter(client => checklist[client.company_name]?.file_management?.[year]?.[month]?.receivedAt).length;
        const delivered = clients.filter(client => checklist[client.company_name]?.file_management?.[year]?.[month]?.filesDelivered).length;
        return { received, delivered, pending: clients.length - received, notDelivered: clients.length - delivered };
    };

    return (
        <ScrollArea className="h-[600px]">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="sticky left-0 z-10 bg-white">#</TableHead>
                            <TableHead className="sticky left-0 z-10 bg-white">Company</TableHead>
                            {Array.from({ length: monthsToShow }, (_, i) => startMonth + i).map((month, i) => (
                                <TableHead key={month} colSpan={2} className={`text-center ${i % 2 === 0 ? 'bg-blue-100' : 'bg-green-100'}`}>
                                    {format(new Date(year, month), 'MMMM yyyy')}
                                </TableHead>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableHead className="sticky left-0 z-10 bg-white"></TableHead>
                            <TableHead className="sticky left-0 z-10 bg-white">Status</TableHead>
                            {Array.from({ length: monthsToShow }, (_, i) => startMonth + i).map((month, i) => (
                                <React.Fragment key={month}>
                                    <TableHead>Received</TableHead>
                                    <TableHead>Delivered</TableHead>
                                </React.Fragment>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableHead className="sticky left-0 z-10 bg-white"></TableHead>
                            <TableHead className="sticky left-0 z-10 bg-white">PENDING/COMPLETED</TableHead>
                            {Array.from({ length: monthsToShow }, (_, i) => {
                                const month = (startMonth + i + 1).toString().padStart(2, '0');
                                const counts = getStatusCounts(filteredClients, year, month);
                                return (
                                    <React.Fragment key={i}>
                                        <TableHead>
                                            <div className="flex items-center space-x-2">
                                                <span className="bg-green-500 text-white rounded-full px-2 py-1 text-xs">{counts.received}</span>
                                                <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">{counts.pending}</span>
                                            </div>
                                        </TableHead>
                                        <TableHead>
                                            <div className="flex items-center space-x-2">
                                                <span className="bg-green-500 text-white rounded-full px-2 py-1 text-xs">{counts.delivered}</span>
                                                <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">{counts.notDelivered}</span>
                                            </div>
                                        </TableHead>
                                    </React.Fragment>
                                );
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredClients.map((client, index) => (
                            <TableRow key={client.company_name} className={index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                                <TableCell className="sticky left-0 z-10 bg-inherit text-center">{index + 1}</TableCell>
                                <TableCell className="sticky left-0 z-10 bg-inherit ">{client.company_name}</TableCell>
                                {Array.from({ length: monthsToShow }, (_, i) => startMonth + i).map((month, i) => {
                                    const monthKey = (month + 1).toString().padStart(2, '0');
                                    const clientData = checklist[client.company_name]?.file_management?.[year]?.[monthKey];
                                    return (
                                        <React.Fragment key={month}>
                                            <TableCell className={`border-r ${i % 2 === 0 ? 'bg-blue-100' : 'bg-green-100'} text-center justify-center`}>
                                                {clientData?.receivedAt ? (
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                )}
                                            </TableCell>
                                            <TableCell className={`border-r ${i % 2 === 0 ? 'bg-blue-100' : 'bg-green-100'} text-center justify-center`}>
                                                {clientData?.filesDelivered ? (
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                )}
                                            </TableCell>
                                        </React.Fragment>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </ScrollArea>
    );
};