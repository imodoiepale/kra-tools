// @ts-nocheck
'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CompanyPayrollRecord, DocumentType } from '../types'
import { ExtractionReportTable } from './components/ExtractionReportTable'
import { MonthYearSelector } from '../components/MonthYearSelector'
import { CategoryFilters } from '../components/CategoryFilters'
import { ObligationFilters } from '../components/ObligationFilters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

import { PayslipPaymentReceiptsTable } from './components/PayslipPaymentReceiptsTable'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from '@/components/ui/checkbox'
import { ExtractAllDialog } from './components/ExtractAllDialog'

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
    {
        id: 'bank_name',
        label: 'Bank Name',
        width: 'min-w-[80px]'
    }
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
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['acc']);
    const [selectedObligations, setSelectedObligations] = useState<string[]>(['active']);

    const handleFilterChange = useCallback((categories: string[]) => {
        setSelectedCategories(categories);
    }, []);

    const handleObligationFilterChange = useCallback((obligations: string[]) => {
        setSelectedObligations(obligations);
    }, []);

    const handleDocumentUploadWithFolder = (recordId: string, file: File, documentType: DocumentType) => {
        return handleDocumentUpload(recordId, file, documentType, 'PAYMENT RECEIPTS')
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
    };

    // Filter records based on search term and selected categories
    const filteredRecords = useMemo(() => {
        return payrollRecords.filter(record => {
            // Check if record and company exist
            if (!record || !record.company) return false;

            const matchesSearch = record.company.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;

            // Check category filters
            let matchesCategory = true;
            if (selectedCategories.length > 0) {
                matchesCategory = selectedCategories.some(category => {
                    const currentDate = new Date();

                    // Extract the base category without status suffix
                    const baseCategory = category.split('_status_')[0];
                    const status = category.includes('_status_')
                        ? category.split('_status_')[1] as 'active' | 'inactive'
                        : 'active'; // Default to active status if not specified

                    let isInCategory = false;
                    let isActive = false;

                    switch (baseCategory) {
                        case 'acc':
                            isInCategory = true;
                            isActive = isDateInRange(currentDate, record.company.acc_client_effective_from, record.company.acc_client_effective_to);
                            break;
                        case 'audit_tax':
                            isInCategory = true;
                            isActive = isDateInRange(currentDate, record.company.audit_client_effective_from, record.company.audit_client_effective_to);
                            break;
                        case 'cps_sheria':
                            isInCategory = true;
                            isActive = isDateInRange(currentDate, record.company.sheria_client_effective_from, record.company.sheria_client_effective_from);
                            break;
                        case 'imm':
                            isInCategory = true;
                            isActive = isDateInRange(currentDate, record.company.imm_client_effective_from, record.company.imm_client_effective_to);
                            break;
                        default:
                            return false;
                    }

                    // If status is 'all', return whether it's in the category
                    if (status === 'all') {
                        return isInCategory;
                    }

                    // Otherwise, check if the active status matches the requested status
                    return isInCategory && ((status === 'active' && isActive) || (status === 'inactive' && !isActive));
                });
            }

            // Check obligation filters
            let matchesObligation = true;
            if (selectedObligations.length > 0) {
                const obligationStatus = record.pin_details?.paye_status?.toLowerCase() || '';
                const effectiveFrom = record.pin_details?.paye_effective_from || '';

                // Determine specific status types
                const isCancelled = obligationStatus === 'cancelled';
                const isDormant = obligationStatus === 'dormant';
                const isNoObligation = effectiveFrom.toLowerCase().includes('no obligation');
                const isMissing = !effectiveFrom || effectiveFrom.toLowerCase().includes('missing');

                // Explicitly check if it has an active date (not any of the special cases)
                const hasActiveDate = effectiveFrom &&
                    !isNoObligation &&
                    !isMissing &&
                    !isCancelled &&
                    !isDormant;

                // Match against selected filters
                matchesObligation = selectedObligations.length === 0 || (
                    (selectedObligations.includes('active') && hasActiveDate) ||
                    (selectedObligations.includes('cancelled') && isCancelled) ||
                    (selectedObligations.includes('dormant') && isDormant) ||
                    (selectedObligations.includes('no_obligation') && isNoObligation) ||
                    (selectedObligations.includes('missing') && isMissing)
                );
            }

            return matchesSearch && matchesCategory && matchesObligation;
        });
    }, [payrollRecords, searchTerm, selectedCategories, selectedObligations]);

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
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                    />
                    <ObligationFilters
                        payrollRecords={payrollRecords}
                        onFilterChange={handleObligationFilterChange}
                        selectedObligations={selectedObligations}
                    />
                    <CategoryFilters
                        companyDates={filteredRecords[0]?.company}
                        onFilterChange={handleFilterChange}
                        selectedCategories={selectedCategories}
                    />
                    <div className="flex gap-2">
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