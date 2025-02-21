// @ts-nocheck
import { useEffect, useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CompanyPayrollRecord, DocumentType } from '../types'
import { PayrollTable } from './components/PayrollTable'
import { MonthYearSelector } from '../components/MonthYearSelector'
import { CategoryFilters } from '../components/CategoryFilters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings2 } from 'lucide-react'

interface PayrollManagementProps {
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

export default function PayrollManagementWingu({
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
}: PayrollManagementProps) {
    const handleDocumentUploadWithFolder = (recordId: string, file: File, documentType: DocumentType) => {
        return handleDocumentUpload(recordId, file, documentType, 'PREP DOCS')
    }

    const [selectedCategories, setSelectedCategories] = useState<string[]>(['acc']);

    const handleFilterChange = useCallback((categories: string[]) => {
        setSelectedCategories(categories.length > 0 ? categories : ['acc']);
    }, []);

    const columnDefinitions = [
        { id: 'index', label: 'Index (#)', defaultVisible: true },
        { id: 'companyName', label: 'Company Name', defaultVisible: true },
        { id: 'obligationDate', label: 'Obligation Date', defaultVisible: false },
        { id: 'numberOfEmployees', label: 'No. of Employees', defaultVisible: false },
        { id: 'finalizationDate', label: 'Finalization Date', defaultVisible: true },
        { id: 'payeCsv', label: 'PAYE (CSV)', defaultVisible: true },
        { id: 'hslevyCsv', label: 'HSLEVY (CSV)', defaultVisible: true },
        { id: 'shifExl', label: 'SHIF (EXL)', defaultVisible: true },
        { id: 'nssfExl', label: 'NSSF (EXL)', defaultVisible: true },
        { id: 'zipFileKra', label: 'ZIP FILE-KRA', defaultVisible: true },
        { id: 'allCsv', label: 'All CSV', defaultVisible: true },
        { id: 'readyToFile', label: 'Ready to File', defaultVisible: true },
        { id: 'assignedTo', label: 'Assigned To', defaultVisible: false },
        { id: 'actions', label: 'Actions', defaultVisible: true },
    ];

    // Initialize column visibility state from definitions
    const [columnVisibility, setColumnVisibility] = useState(() => {
        const initialState = {};
        columnDefinitions.forEach(col => {
            initialState[col.id] = col.defaultVisible;
        });
        return initialState;
    });

    // Toggle column visibility
    const toggleColumnVisibility = (columnId: string, isVisible: boolean) => {
        setColumnVisibility(prev => ({
            ...prev,
            [columnId]: isVisible
        }));
    };

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
            
            const categoriesToCheck = selectedCategories;
            
            const matchesCategory = categoriesToCheck.every(category => {
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
            <div className="flex items-center justify-between">
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-10 w-10">
                                <Settings2 className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {columnDefinitions.map(column => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    checked={columnVisibility[column.id]}
                                    onCheckedChange={(checked) => toggleColumnVisibility(column.id, checked)}
                                >
                                    {column.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline">Export</Button>
                    <Button variant="outline">Extract All</Button>
                </div>
            </div>

            <PayrollTable
                records={filteredRecords}
                onDocumentUpload={handleDocumentUploadWithFolder}
                onDocumentDelete={handleDocumentDelete}
                onStatusUpdate={handleStatusUpdate}
                loading={loading}
                setPayrollRecords={setPayrollRecords}
                columnVisibility={columnVisibility}
            />
        </div>
    )
}