// @ts-nocheck
'use client'

import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CompanyPayrollRecord, DocumentType } from '../types'
import { ExtractionReportTable } from './components/ExtractionReportTable'
import { MonthYearSelector } from '../components/MonthYearSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { ExtractAllDialog } from './components/ExtractAllDialog'
import { PayslipPaymentReceiptsTable } from './components/PayslipPaymentReceiptsTable'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from '@/components/ui/checkbox'

const DOCUMENT_TYPES = [
    {
        id: 'paye',
        label: 'PAYE',
        color: 'bg-blue-600',
        receiptType: 'paye_receipt'
    },
    {
        id: 'housing_levy',
        label: 'Housing Levy',
        color: 'bg-green-600',
        receiptType: 'housing_levy_receipt'
    },
    {
        id: 'nita',
        label: 'NITA',
        color: 'bg-purple-600',
        receiptType: 'nita_receipt'
    },
    {
        id: 'shif',
        label: 'SHIF',
        color: 'bg-orange-600',
        receiptType: 'shif_receipt'
    },
    {
        id: 'nssf',
        label: 'NSSF',
        color: 'bg-red-600',
        receiptType: 'nssf_receipt'
    }
];

const COLUMN_TYPES = [
    {
        id: 'status',
        label: 'Status',
        width: 'min-w-[80px]'
    },
    {
        id: 'amount',
        label: 'Amount',
        width: 'min-w-[80px]'
    },
    {
        id: 'payment_mode',
        label: 'Payment Mode',
        width: 'min-w-[80px]'
    },
    {
        id: 'payment_date',
        label: 'Payment Date',
        width: 'min-w-[80px]'
    },
];

interface ExtractionReportProps {
    payrollRecords: CompanyPayrollRecord[]
    selectedYear: number
    selectedMonth: number
    searchTerm: string
    loading: boolean
    setSelectedYear: (year: number) => void
    setSelectedMonth: (month: number) => void
    setSearchTerm: (term: string) => void
    handleDocumentUpload: (recordId: string, file: File, documentType: DocumentType, subFolder: string) => Promise<string | undefined>
    handleDocumentDelete: (recordId: string, documentType: DocumentType) => Promise<void>
    handleStatusUpdate: (recordId: string, statusUpdate: Partial<CompanyPayrollRecord['status']>) => Promise<void>
    setPayrollRecords: React.Dispatch<React.SetStateAction<CompanyPayrollRecord[]>>
}

export default function ExtractionReport({
    payrollRecords,
    selectedYear,
    selectedMonth,
    searchTerm,
    loading,
    setSelectedYear,
    setSelectedMonth,
    setSearchTerm,
    handleDocumentUpload,
    handleDocumentDelete,
    handleStatusUpdate,
    setPayrollRecords
}: ExtractionReportProps) {

    const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>(DOCUMENT_TYPES.map(doc => doc.id));
    const [selectedColumns, setSelectedColumns] = useState<string[]>(COLUMN_TYPES.map(col => col.id));

    const handleDocumentUploadWithFolder = (recordId: string, file: File, documentType: DocumentType) => {
        return handleDocumentUpload(recordId, file, documentType, 'PAYMENT RECEIPTS')
    }

    // Filter records based on search term
    const filteredRecords = useMemo(() => {
        if (!searchTerm.trim()) return payrollRecords;
        const searchLower = searchTerm.toLowerCase();
        return payrollRecords.filter(record => {
            const companyName = record.company?.company_name || '';
            const companyId = record.company?.id?.toString() || '';
            return companyName.toLowerCase().includes(searchLower) ||
                companyId.includes(searchLower);
        });
    }, [payrollRecords, searchTerm]);

    const [extractAllDialog, setExtractAllDialog] = useState(false)

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <MonthYearSelector
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    onYearChange={setSelectedYear}
                    onMonthChange={setSelectedMonth}
                />
                <div className="flex gap-4">
                    <Input
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64"
                    />
                    <div className="flex gap-4">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">Select TAX</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                {DOCUMENT_TYPES.map(doc => (
                                    <DropdownMenuItem
                                        key={doc.id}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const newSelected = selectedDocTypes.includes(doc.id)
                                                ? selectedDocTypes.filter(id => id !== doc.id)
                                                : [...selectedDocTypes, doc.id];
                                            setSelectedDocTypes(newSelected);
                                        }}
                                    >
                                        <Checkbox
                                            checked={selectedDocTypes.includes(doc.id)}
                                            className="mr-2"
                                        />
                                        {doc.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">Select Fields</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                {COLUMN_TYPES.map(col => (
                                    <DropdownMenuItem
                                        key={col.id}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const newSelected = selectedColumns.includes(col.id)
                                                ? selectedColumns.filter(id => id !== col.id)
                                                : [...selectedColumns, col.id];
                                            setSelectedColumns(newSelected);
                                        }}
                                    >
                                        <Checkbox
                                            checked={selectedColumns.includes(col.id)}
                                            className="mr-2"
                                        />
                                        {col.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <Button variant="outline" size="sm">Export</Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExtractAllDialog(true)}
                    >
                        Extract All
                    </Button>
                </div>
            </div>

            <PayslipPaymentReceiptsTable
                selectedDocTypes={selectedDocTypes}
                selectedColumns={selectedColumns}
                records={filteredRecords}
                onDocumentUpload={handleDocumentUploadWithFolder}
                onDocumentDelete={handleDocumentDelete}
                onStatusUpdate={handleStatusUpdate}
                loading={loading}
                setPayrollRecords={setPayrollRecords}
            />

            <ExtractAllDialog
                isOpen={extractAllDialog}
                onClose={() => setExtractAllDialog(false)}
                records={filteredRecords}
                setPayrollRecords={setPayrollRecords}
            />

        </div>
    )
}