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
import { Settings2, Download } from 'lucide-react'
import { ObligationFilters } from '../components/ObligationFilters'
import { toast } from '@/hooks/use-toast'
import { ExtractDialog } from './components/dialogs/ExtractDialog'
import { ExportDialog } from './components/dialogs/ExportDialog'

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
    setPayrollRecords,
    updateExistingEmployeeCounts
}: PayrollManagementProps) {
    const handleDocumentUploadWithFolder = (recordId: string, file: File, documentType: DocumentType) => {
        return handleDocumentUpload(recordId, file, documentType, 'PREP DOCS')
    }

    const [selectedCategories, setSelectedCategories] = useState<string[]>(['acc']);
    const [selectedObligations, setSelectedObligations] = useState<string[]>([]);
    const [extractDialogOpen, setExtractDialogOpen] = useState(false)
    const [exportDialogOpen, setExportDialogOpen] = useState(false)

    const handleFilterChange = useCallback((categories: string[]) => {
        setSelectedCategories(categories);
    }, []);

    const handleObligationFilterChange = useCallback((obligations: string[]) => {
        setSelectedObligations(obligations);
    }, []);

    const columnDefinitions = [
        { id: 'index', label: 'Index (#)', defaultVisible: true },
        { id: 'companyName', label: 'Company Name', defaultVisible: true },
        { id: 'kraPin', label: 'KRA PIN', defaultVisible: true },
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

            // Check if record matches search term
            const matchesSearch = record.company.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;

            // Check category filters
            let matchesCategory = true;
            if (selectedCategories.length > 0) {
                matchesCategory = selectedCategories.some(category => {
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
            }

            // Check obligation filters
            let matchesObligation = true;
            if (selectedObligations.length > 0) {
                const obligationStatus = record.pin_details?.paye_status?.toLowerCase();
                const effectiveFrom = record.pin_details?.paye_effective_from;

                // Determine specific status types
                const isCancelled = obligationStatus === 'cancelled';
                const isDormant = obligationStatus === 'dormant';
                const isNoObligation = effectiveFrom?.toLowerCase() === 'no obligation';
                const isMissing = !effectiveFrom || effectiveFrom === 'Missing';

                // Explicitly check if it has an active date (not any of the special cases)
                const hasActiveDate = effectiveFrom &&
                    !isNoObligation &&
                    !isCancelled &&
                    !isDormant &&
                    !isMissing;

                // Match against selected filters
                matchesObligation = (
                    (selectedObligations.includes('active') && hasActiveDate) ||
                    (selectedObligations.includes('cancelled') && isCancelled) ||
                    (selectedObligations.includes('dormant') && isDormant) ||
                    (selectedObligations.includes('no_obligation') && isNoObligation) ||
                    (selectedObligations.includes('missing') && isMissing)
                );
            }

            // Return true only if record matches all active filters
            return matchesSearch && matchesCategory && matchesObligation;
        });
    }, [payrollRecords, searchTerm, selectedCategories, selectedObligations]);

    const handleExtractAll = async () => {
        // Open the extract dialog instead of directly extracting
        setExtractDialogOpen(true)
    }

    const handleExportAll = () => {
        // Open the export dialog
        setExportDialogOpen(true)
    }

    // Month names array for display and API calls
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                    <DropdownMenu className="bg-white">
                        <DropdownMenuTrigger asChild>
                            <Button
                                className="h-8 flex items-center gap-1 px-2 bg-violet-500 hover:bg-violet-600"
                            >
                                <Settings2 className="h-4 w-4 text-white" />
                                Column Visibility
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white">
                            <DropdownMenuLabel className="text-violet-500">Toggle Columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {columnDefinitions.map(column => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    checked={columnVisibility[column.id]}
                                    onCheckedChange={(checked) => toggleColumnVisibility(column.id, checked)}
                                    className=""
                                >
                                    {column.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        onClick={updateExistingEmployeeCounts}
                        className="h-8 px-2 bg-orange-500 text-white hover:bg-orange-600"
                    >
                        Update Employee Counts
                    </Button>
                    <Button
                        onClick={handleExtractAll}
                        className="h-8 px-2 bg-green-500 text-white hover:bg-green-600"
                    >
                        Extract All
                    </Button>
                    <Button 
                        onClick={handleExportAll}
                        className="h-8 px-2 bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1"
                    >
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Extract Dialog */}
            <ExtractDialog
                open={extractDialogOpen}
                onOpenChange={setExtractDialogOpen}
                payrollRecords={payrollRecords}
                monthNames={monthNames}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
            />

            {/* Export Dialog */}
            <ExportDialog
                open={exportDialogOpen}
                onOpenChange={setExportDialogOpen}
                payrollRecords={payrollRecords}
                monthNames={monthNames}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
            />

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