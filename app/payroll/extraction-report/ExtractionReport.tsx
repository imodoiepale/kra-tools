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