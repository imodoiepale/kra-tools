// @ts-nocheck
"use client"
import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, subMonths } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd.MM.yyyy');
};

const getTaxCategoryLabel = (taxType) => {
    const labels = {
        vat: "VAT",
        paye: "PAYE",
        income_tax_company: "Income Tax",
        nita: "NITA",
        housing_levy: "Housing Levy",
        resident_individual: "Resident Individual Tax",
        rent_income_mri: "Rent Income",
        turnover_tax: "Turnover Tax"
    };
    return labels[taxType] || taxType.toUpperCase();
};

const getTaxAmountField = (taxType) => {
    const fields = {
        vat: "vatAmount",
        paye: "payeAmount",
        income_tax_company: "incomeTaxAmount",
        nita: "nitaAmount",
        housing_levy: "housingLevyAmount",
        resident_individual: "residentIndividualAmount",
        rent_income_mri: "rentIncomeAmount",
        turnover_tax: "turnoverTaxAmount"
    };
    return fields[taxType] || `${taxType}Amount`;
};

const ViewReceiptDialog = ({ url }) => (
    <Dialog>
        <DialogTrigger asChild>
            <Button variant="outline" size="sm">
                <Eye className="mr-2 h-4 w-4" />
                View Receipt
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px] sm:max-h-[800px]">
            <DialogHeader>
                <DialogTitle>Receipt View</DialogTitle>
            </DialogHeader>
            <div className="mt-4 h-full">
                <iframe src={url} className="w-full h-[600px]" style={{ objectFit: 'contain' }} />
            </div>
        </DialogContent>
    </Dialog>
);
export default function TaxChecklistDetailedView({ companies, checklist, taxType, selectedDate }) {
    const [selectedCompany, setSelectedCompany] = useState(null);

    const currentDate = new Date();
    const monthsToShow = 12;

    const months = useMemo(() => {
        return Array.from({ length: monthsToShow }, (_, i) => {
            const date = subMonths(currentDate, i);
            return { 
                monthKey: format(date, 'MM'),
                year: format(date, 'yyyy'),
                date: date
            };
        }).sort((a, b) => b.date - a.date);
    }, [currentDate]);

    const taxCategoryLabel = getTaxCategoryLabel(taxType);
    const taxAmountField = getTaxAmountField(taxType);

    return (
        <div className="flex space-x-4">
            <div className="w-1/4">
                <h2 className="text-lg font-bold mb-2">Companies</h2>
                <ScrollArea className="h-[600px] border rounded-lg shadow-inner bg-gray-50">
                    <ul className="space-y-1 p-2">
                        {companies.map((company, index) => (
                            <li
                                key={company.company_name}
                                className={`cursor-pointer p-1 rounded-md text-sm transition-colors duration-150 ease-in-out ${
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
            <div className="w-3/4">
                <h2 className="text-lg font-bold mb-2">Detailed View</h2>
                <ScrollArea className="h-[600px] border rounded-lg shadow-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px] font-bold text-center">#</TableHead>
                                <TableHead className="w-[100px] font-bold">Month</TableHead>
                                <TableHead className="w-[100px] font-bold">ITAX Submission</TableHead>
                                <TableHead className="w-[80px] font-bold">Submitted By</TableHead>
                                <TableHead className="w-[100px] font-bold">Client Payment Date</TableHead>
                                <TableHead className="w-[100px] font-bold">{taxCategoryLabel} Amount</TableHead>
                                <TableHead className="w-[150px] font-bold text-center">Advice</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedCompany && months.map(({ monthKey, year, date }, index) => {
                                const monthData = checklist[selectedCompany]?.taxes?.[taxType]?.[year]?.[monthKey] || {};
                                return (
                                    <TableRow key={`${year}-${monthKey}`} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                        <TableCell className="text-center font-medium">{index + 1}</TableCell>
                                        <TableCell>{format(date, 'MMMM yyyy')}</TableCell>
                                        <TableCell>{formatDate(monthData.itaxSubmitDate)}</TableCell>
                                        <TableCell>{monthData.submittedBy || '-'}</TableCell>
                                        <TableCell>{formatDate(monthData.clientPaymentDate)}</TableCell>
                                        <TableCell>
                                            {monthData[taxAmountField] 
                                                ? `Ksh ${parseFloat(monthData[taxAmountField]).toFixed(2)}` 
                                                : '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {monthData.receiptUrl ? (
                                                <ViewReceiptDialog url={monthData.receiptUrl} />
                                            ) : (
                                                monthData.advice || '-'
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