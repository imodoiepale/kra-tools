// @ts-nocheck
import { useEffect, useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CompanyPayrollRecord, DocumentType } from '../types'
import { TaxPaymentTable } from './components/TaxPaymentTable'
import { TableControls } from '../components/TableControls'
import { useToast } from '@/hooks/use-toast'
import { ContactModal } from '../payslip-receipts/components/ContactModal'
import { MonthYearSelector } from '../components/MonthYearSelector'
import { CategoryFilters } from '../components/CategoryFilters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

export default function TaxPaymentSlips({
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
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['acc']);

    const handleFilterChange = useCallback((categories: string[]) => {
        setSelectedCategories(categories);
    }, []);

    const handleDocumentUploadWithFolder = (recordId: string, file: File, documentType: DocumentType) => {
        return handleDocumentUpload(recordId, file, documentType, 'PAYMENT SLIPS')
    }

    const isDateInRange = (date: Date, from?: string | null, to?: string | null): boolean => {
        if (!from || !to) return false;
        try {
            const fromDate = new Date(from.split('/').reverse().join('-'));
            const toDate = new Date(to.split('/').reverse().join('-'));
            return date >= fromDate && date <= toDate;
        } catch (error) {
            console.error('Error parsing dates:', error);
            return false;
        }
    }

    // Filter records based on search term and selected categories
    const filteredRecords = useMemo(() => {
        return payrollRecords.filter(record => {
            // Check if record and company exist
            if (!record || !record.company) return false;

            const matchesSearch = record.company.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
            
            // If no categories are selected (All is selected), show all records
            if (selectedCategories.length === 0) return matchesSearch;
            
            // Check if record matches any of the selected categories
            const matchesCategory = selectedCategories.some(category => {
                const currentDate = new Date();
                switch (category) {
                    case 'acc':
                        return isDateInRange(currentDate, record.company.acc_client_effective_from, record.company.acc_client_effective_to);
                    case 'audit_tax':
                        return isDateInRange(currentDate, record.company.audit_tax_client_effective_from, record.company.audit_tax_client_effective_to);
                    case 'cps_sheria':
                        return isDateInRange(currentDate, record.company.cps_sheria_client_effective_from, record.company.cps_sheria_client_effective_to);
                    case 'imm':
                        return isDateInRange(currentDate, record.company.imm_client_effective_from, record.company.imm_client_effective_to);
                    default:
                        return false;
                }
            });

            return matchesSearch && matchesCategory;
        });
    }, [payrollRecords, searchTerm, selectedCategories]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <MonthYearSelector
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    onYearChange={setSelectedYear}
                    onMonthChange={setSelectedMonth}
                />
                <div className="flex items-center gap-4">
                    <Input
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                    />
                    <CategoryFilters
                        companyDates={filteredRecords[0]?.company}
                        onFilterChange={handleFilterChange}
                        selectedCategories={selectedCategories}
                    />
                    <Button variant="outline" size="sm">Export</Button>
                    <Button variant="outline" size="sm">Extract All</Button>
                </div>
            </div>

            <TaxPaymentTable
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