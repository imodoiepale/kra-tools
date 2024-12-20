// @ts-nocheck
"use client"
import React, { useState, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, subMonths } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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

const ViewReceiptDialog = ({ url }) => {
    const [isLoading, setIsLoading] = useState(true);

    return (
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
                    <div className="w-full h-[600px] relative">
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Skeleton className="w-full h-full" />
                            </div>
                        )}
                        <Image
                            src={url}
                            alt="Receipt"
                            layout="fill"
                            objectFit="contain"
                            sizes="(max-width: 800px) 100vw, 800px"
                            onLoad={() => setIsLoading(false)}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

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

    const exportToExcel = useCallback(async () => {
        if (!selectedCompany) return;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(selectedCompany);

        // Add headers
        const headers = ['Month', 'ITAX Submission', 'Submitted By', 'Client Payment Date', `${taxCategoryLabel} Amount`, 'Advice'];
        worksheet.addRow(headers);

        // Style headers
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF00' } // Yellow background
        };

        // Add data
        months.forEach(({ monthKey, year, date }) => {
            const monthData = checklist[selectedCompany]?.taxes?.[taxType]?.[year]?.[monthKey] || {};
            worksheet.addRow([
                format(date, 'MMMM yyyy'),
                formatDate(monthData.itaxSubmitDate),
                monthData.submittedBy || '-',
                formatDate(monthData.clientPaymentDate),
                monthData[taxAmountField] 
                    ? `Ksh ${parseFloat(monthData[taxAmountField]).toFixed(2)}` 
                    : '-',
                monthData.receiptUrl ? 'Receipt uploaded' : (monthData.advice || '-')
            ]);
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength;
        });

        // Add borders to all cells
        worksheet.eachRow({ includeEmpty: true }, row => {
            row.eachCell({ includeEmpty: true }, cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `${selectedCompany.toUpperCase()}-${taxType.toUpperCase()}-${format(selectedDate, 'MMMM.yyyy').toUpperCase()}.xlsx`);

    }, [selectedCompany, checklist, taxType, taxCategoryLabel, taxAmountField, months, selectedDate]);

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
                <div className="flex justify-between items-center mb-1">
                    <h2 className="text-2xl font-bold">Detailed View</h2>
                    {selectedCompany && (
                        <Button onClick={exportToExcel} className="mb-4">
                            Export to Excel
                        </Button>
                    )}
                </div>
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