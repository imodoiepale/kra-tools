// @ts-nocheck
import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CompanyPayrollRecord, DocumentType } from '../types'
import { PayslipPaymentReceiptsTable } from './components/PayslipPaymentReceiptsTable'
import { MonthYearSelector } from '../components/MonthYearSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { CategoryFilters, type CategoryFilter } from '../components/CategoryFilters'

interface TaxPaymentSlipsProps {
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

export default function PayslipPaymentReceipts({
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
}: TaxPaymentSlipsProps) {
    const handleDocumentUploadWithFolder = (recordId: string, file: File, documentType: DocumentType) => {
        return handleDocumentUpload(recordId, file, documentType, 'PAYMENT SLIPS')
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

    const handleCategoryFilterChange = (key) => {
        setCategoryFilters(filters =>
            filters.map(filter =>
                filter.key === key ? { ...filter, checked: !filter.checked } : filter
            )
        );
        fetchAllData();
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <MonthYearSelector
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    onYearChange={setSelectedYear}
                    onMonthChange={setSelectedMonth}
                />
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                        <Input
                            placeholder="Search companies..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-48"
                        />
                        <CategoryFilters onFilterChange={handleCategoryFilterChange} />
                        <Button variant="outline" size="sm">Export</Button>
                        <Button variant="outline" size="sm">Extract All</Button>
                    </div>
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
        </div>
    )
}