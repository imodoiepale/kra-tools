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
import { Settings2, Download, FileText } from 'lucide-react'
import { ObligationFilters } from '../components/ObligationFilters'
import { toast } from '@/hooks/use-toast'
import { ExtractDialog } from './components/dialogs/ExtractDialog'
import { ExportDialog } from './components/dialogs/ExportDialog'
import { BulkFilingDialog } from './components/dialogs/BulkFilingDialog'

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
    updateExistingEmployeeCounts?: () => Promise<void>
    // Shared filter states
    selectedCategories: string[]
    setSelectedCategories: (categories: string[]) => void
    selectedObligations: string[]
    setSelectedObligations: (obligations: string[]) => void
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
    updateExistingEmployeeCounts,
    // Use shared filter states from hook
    selectedCategories,
    setSelectedCategories,
    selectedObligations,
    setSelectedObligations
}: PayrollManagementProps) {
    const handleDocumentUploadWithFolder = (recordId: string, file: File, documentType: DocumentType) => {
        return handleDocumentUpload(recordId, file, documentType, 'PREP DOCS')
    }

    const [extractDialogOpen, setExtractDialogOpen] = useState(false)
    const [exportDialogOpen, setExportDialogOpen] = useState(false)
    const [bulkFilingDialogOpen, setBulkFilingDialogOpen] = useState(false)
    const [showSummaryHeaders, setShowSummaryHeaders] = useState(true)

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
        { id: 'obligationDate', label: 'PAYE Obligation Date', defaultVisible: true },
        { id: 'numberOfEmployees', label: 'No. of Employees(Wingu)', defaultVisible: false },
        { id: 'numberOfEmployeesBcl', label: 'No. of Employees(BCL)', defaultVisible: false },
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

    // Filter records based on search term, categories, and obligations
    const filteredRecords = useMemo(() => {
        return payrollRecords.filter(record => {
            // Check if record and company exist
            if (!record || !record.company) return false;

            // Search term filter
            const matchesSearch = record.company.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
            if (!matchesSearch) return false;

            const currentDate = new Date();

            // Category filters - if no categories selected, show all
            let matchesCategory = selectedCategories.length === 0;

            if (selectedCategories.length > 0) {
                matchesCategory = selectedCategories.some(categoryString => {
                    // Parse the category string
                    let baseCategory, status;

                    if (categoryString.includes('_status_')) {
                        [baseCategory, status] = categoryString.split('_status_');
                    } else {
                        baseCategory = categoryString;
                        status = 'all';
                    }

                    // Determine if the record is in this category and has the right status
                    let isInCategory = false;
                    let isActive = false;

                    switch (baseCategory) {
                        case 'acc':
                            isInCategory = record.company.acc_client_effective_from || record.company.acc_client_effective_to;
                            isActive = isDateInRange(
                                currentDate,
                                record.company.acc_client_effective_from,
                                record.company.acc_client_effective_to
                            );
                            break;
                        case 'audit_tax':
                            isInCategory = record.company.audit_tax_client_effective_from || record.company.audit_tax_client_effective_to;
                            isActive = isDateInRange(
                                currentDate,
                                record.company.audit_tax_client_effective_from,
                                record.company.audit_tax_client_effective_to
                            );
                            break;
                        case 'cps_sheria':
                            isInCategory = record.company.cps_sheria_client_effective_from || record.company.cps_sheria_client_effective_to;
                            isActive = isDateInRange(
                                currentDate,
                                record.company.cps_sheria_client_effective_from,
                                record.company.cps_sheria_client_effective_to
                            );
                            break;
                        case 'imm':
                            isInCategory = record.company.imm_client_effective_from || record.company.imm_client_effective_to;
                            isActive = isDateInRange(
                                currentDate,
                                record.company.imm_client_effective_from,
                                record.company.imm_client_effective_to
                            );
                            break;
                        default:
                            return false;
                    }

                    // Check if this record matches the status filter
                    if (status === 'all') {
                        return isInCategory;
                    } else if (status === 'active') {
                        return isInCategory && isActive;
                    } else if (status === 'inactive') {
                        return isInCategory && !isActive;
                    }

                    return false;
                });
            }

            // If it doesn't match the category filter, exclude it
            if (!matchesCategory) return false;

            // Obligation filters - if no obligations selected, show all
            let matchesObligation = selectedObligations.length === 0;

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
                matchesObligation = (
                    (selectedObligations.includes('active') && hasActiveDate) ||
                    (selectedObligations.includes('cancelled') && isCancelled) ||
                    (selectedObligations.includes('dormant') && isDormant) ||
                    (selectedObligations.includes('no_obligation') && isNoObligation) ||
                    (selectedObligations.includes('missing') && isMissing)
                );
            }

            // Return true only if the record matches both category and obligation filters
            return matchesObligation;
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
                        setSelectedObligations={setSelectedObligations}
                        selectedObligations={selectedObligations}
                    />
                    <CategoryFilters
                        payrollRecords={payrollRecords} // Pass the full records array
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
                        size="sm"
                    >
                        Update Employee Counts
                    </Button>
                    <Button
                        onClick={handleExtractAll}
                        className="h-8 px-2 bg-green-500 text-white hover:bg-green-600"
                        size="sm"
                    >
                        Extract All
                    </Button>
                    <Button 
                        onClick={handleExportAll}
                        className="h-8 px-2 bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1"
                        size="sm"
                    >
                        <Download className="h-4 w-4" />
                        Export Docs
                    </Button>
                    <Button
                        onClick={() => setShowSummaryHeaders(prev => !prev)}
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                    >
                        {showSummaryHeaders ? "Hide Counts" : "Show Counts"}
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

            <BulkFilingDialog
                open={bulkFilingDialogOpen}
                onOpenChange={setBulkFilingDialogOpen}
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
                showSummaryHeaders={showSummaryHeaders}
                onToggleSummaryHeaders={() => setShowSummaryHeaders(prev => !prev)}
            />
        </div>
    )
}