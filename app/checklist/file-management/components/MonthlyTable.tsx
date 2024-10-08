// @ts-nocheck
"use client"


import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, ArrowUpDown, Send } from "lucide-react";
import ConfirmDocumentDialog from './ConfirmDocumentDialog';

export default function MonthlyTable({ filteredClients, checklist, selectedDate, handleSort, sortColumn, sortDirection, updateClientStatus }) {
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');

    const getStatusCounts = () => {
        const received = filteredClients.filter(client => checklist[client.company_name]?.file_management?.[year]?.[month]?.receivedAt).length;
        const delivered = filteredClients.filter(client => checklist[client.company_name]?.file_management?.[year]?.[month]?.filesDelivered).length;
        return { received, delivered, pending: filteredClients.length - received, notDelivered: filteredClients.length - delivered };
    };

    const counts = getStatusCounts();

    return (
        <ScrollArea className="h-[600px]">
            <Table>
                <TableHeader>
                    <TableRow className='bg-gray-600 font-bold'>
                        <TableHead className="font-bold text-white">Index</TableHead>
                        <TableHead className="cursor-pointer font-bold text-white" onClick={() => handleSort('company_name')}>
                            Company Name {sortColumn === 'company_name' && <ArrowUpDown className="inline h-4 w-4" />}
                        </TableHead>
                        <TableHead className="cursor-pointer font-bold text-white" onClick={() => handleSort('kra_pin')}>
                            KRA PIN {sortColumn === 'kra_pin' && <ArrowUpDown className="inline h-4 w-4" />}
                        </TableHead>
                        <TableHead className="font-bold text-white text-center ">
                            Files Received
                            <div className="flex items-center space-x-1 mt-1 justify-center">
                                <span className="bg-green-500 text-white rounded-full px-1 py-0.5 text-xxs w-5 h-5 flex items-center justify-center">{counts.received}</span>
                                <span className="bg-red-500 text-white rounded-full px-1 py-0.5 text-xxs w-5 h-5 flex items-center justify-center">{counts.pending}</span>
                            </div>
                        </TableHead>
                        <TableHead className="font-bold text-white text-center">
                            Files Delivered
                            <div className="flex items-center space-x-2 mt-1 justify-center">
                                <span className="bg-green-500 text-white rounded-full px-2 py-1 text-xs">{counts.delivered}</span>
                                <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">{counts.notDelivered}</span>
                            </div>
                        </TableHead>
                        <TableHead className="font-bold text-white">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredClients.map((client, index) => {
                        const clientData = checklist[client.company_name]?.file_management?.[year]?.[month];
                        return (
                            <TableRow key={client.company_name} className={index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{client.company_name}</TableCell>
                                <TableCell>{client.kra_pin}</TableCell>
                                <TableCell className="text-center">
                                    {clientData?.receivedAt ? (
                                        <div className="text-xs text-gray-500">
                                            {new Date(clientData.receivedAt).toLocaleString()}
                                            <CheckCircle className="h-3 w-3 text-green-500 ml-2 inline" />
                                        </div>
                                    ) : (
                                        <ConfirmDocumentDialog
                                            companyName={client.company_name}
                                            year={year}
                                            month={month}
                                            kraPin={client.kra_pin}
                                            onConfirm={(status, kraPin) => updateClientStatus(client.company_name, year, month, status, kraPin)}
                                        />
                                    )}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => updateClientStatus(
                                            client.company_name,
                                            year,
                                            month,
                                            {
                                                filesDelivered: !clientData?.filesDelivered,
                                                deliveredAt: new Date().toISOString()
                                            },
                                            client.kra_pin
                                        )}
                                    >
                                        {clientData?.filesDelivered ? (
                                            <CheckCircle className="h-3 w-3 text-green-500" />
                                        ) : (
                                            <XCircle className="h-3 w-3 text-red-500" />
                                        )}
                                    </Button>
                                </TableCell>
                                <TableCell>
                                    <Button variant="outline" size="sm" onClick={() => sendReminder(client.company_name)}>
                                        <Send className="h-3 w-3 mr-1" />
                                        Remind
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </ScrollArea>
    );
};
