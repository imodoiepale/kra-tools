// @ts-nocheck
"use client"

import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle } from "lucide-react";
import { format } from 'date-fns';

export default function TaxChecklistDetailedView({ companies, checklist, taxType, selectedDate }) {
    const [selectedCompany, setSelectedCompany] = useState(null);
    const year = selectedDate.getFullYear();
    const monthsToShow = 12;

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return format(new Date(dateString), 'dd.MM.yyyy');
    };

    const months = Array.from({ length: monthsToShow }, (_, i) => {
        const month = (i + 1).toString().padStart(2, '0');
        return { monthKey: month, year };
    });

    return (
        <div className="flex space-x-6">
            <div className="w-2/8 pr-4">
                <h2 className="text-xl font-bold mb-4">Companies</h2>
                <ScrollArea className="h-[600px] border rounded-lg shadow-inner bg-gray-50">
                    <ul className="space-y-1 p-2">
                        {companies.map((company, index) => (
                            <li
                                key={company.company_name}
                                className={`cursor-pointer p-2 rounded-md text-sm transition-colors duration-150 ease-in-out ${
                                    selectedCompany === company.company_name 
                                    ? 'bg-blue-500 text-white font-semibold' 
                                    : 'hover:bg-gray-200'
                                }`}
                                onClick={() => setSelectedCompany(company.company_name)}
                            >
                                {index + 1}. {company.company_name}
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
                            <TableRow>
                                <TableHead className="w-2/12 font-bold">Month</TableHead>
                                <TableHead className="w-2/12 font-bold">Obligation Date</TableHead>
                                <TableHead className="w-2/12 font-bold">ITAX Submit Date</TableHead>
                                <TableHead className="w-1/12 font-bold">Submitted By</TableHead>
                                <TableHead className="w-2/12 font-bold">Client Payment Date</TableHead>
                                <TableHead className="w-1/12 font-bold">PAYE Amount</TableHead>
                                <TableHead className="w-1/12 font-bold">Advice</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedCompany && months.map(({ monthKey, year }, index) => {
                                const monthData = checklist[selectedCompany]?.taxes?.[taxType]?.[year]?.[monthKey] || {};
                                return (
                                    <TableRow key={`${year}-${monthKey}`} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                        <TableCell>{format(new Date(year, parseInt(monthKey) - 1), 'MMMM yyyy')}</TableCell>
                                        <TableCell>{formatDate(monthData.obligationDate)}</TableCell>
                                        <TableCell>{formatDate(monthData.itaxSubmitDate)}</TableCell>
                                        <TableCell>{monthData.submittedBy || '-'}</TableCell>
                                        <TableCell>{formatDate(monthData.clientPaymentDate)}</TableCell>
                                        <TableCell>{monthData.payeAmount ? `KES ${monthData.payeAmount.toFixed(2)}` : '-'}</TableCell>
                                        <TableCell>
                                            {monthData.advice ? (
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-500" />
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
}