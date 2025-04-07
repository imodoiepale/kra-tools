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
import { ObligationFilters } from '../components/ObligationFilters'
import { Settings2, Download, Upload, Filter } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
    handlePaymentSlipsDocumentUpload: (recordId: string, file: File, documentType: DocumentType, subFolder: string) => Promise<string | undefined>
    handlePaymentSlipsDocumentDelete: (recordId: string, documentType: DocumentType) => Promise<void>
    handleBulkExport: (records: CompanyPayrollRecord[]) => Promise<void>
    // Shared filter states
    selectedCategories: string[]
    setSelectedCategories: (categories: string[]) => void
    selectedObligations: string[]
    setSelectedObligations: (obligations: string[]) => void
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
    handlePaymentSlipsDocumentUpload,
    handlePaymentSlipsDocumentDelete,
    handleBulkExport,
    // Use shared filter states from hook
    selectedCategories,
    setSelectedCategories,
    selectedObligations,
    setSelectedObligations
}: TaxPaymentSlipsProps) {
    const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
    const [showSummaryHeaders, setShowSummaryHeaders] = useState(true);
    const { toast } = useToast();

    // Column definitions for visibility toggle
    const columnDefinitions = [
        { id: 'index', label: 'Index (#)', defaultVisible: true },
        { id: 'companyName', label: 'Company Name', defaultVisible: true },
        { id: 'readyToFile', label: 'Ready to File', defaultVisible: true },
        { id: 'payeAcknowledgment', label: 'PAYE Ack.', defaultVisible: true },
        { id: 'payeSlip', label: 'PAYE Slip', defaultVisible: true },
        { id: 'housingLevy', label: 'Housing Levy', defaultVisible: true },
        { id: 'nita', label: 'NITA', defaultVisible: true },
        { id: 'shif', label: 'SHIF', defaultVisible: true },
        { id: 'nssf', label: 'NSSF', defaultVisible: true },
        { id: 'allTaxSlips', label: 'All Tax Slips', defaultVisible: true },
        // { id: 'emailStatus', label: 'Email Status', defaultVisible: true },
        { id: 'email', label: 'Email', defaultVisible: true },
        { id: 'whatsapp', label: 'WhatsApp', defaultVisible: true },
        { id: 'actions', label: 'Actions', defaultVisible: true },
    ];

    const [visibleColumns, setVisibleColumns] = useState<string[]>(() => 
        columnDefinitions.filter(col => col.defaultVisible).map(col => col.id)
    );

    // Toggle column visibility
    const toggleColumnVisibility = (columnId: string, isVisible: boolean) => {
        if (isVisible) {
            setVisibleColumns(prev => [...prev, columnId]);
        } else {
            setVisibleColumns(prev => prev.filter(id => id !== columnId));
        }
    };

    // Convert visibleColumns array to an object for the table component
    const columnVisibility = useMemo(() => {
        const visibility: Record<string, boolean> = {};
        columnDefinitions.forEach(column => {
            visibility[column.id] = visibleColumns.includes(column.id);
        });
        return visibility;
    }, [visibleColumns]);

    const handleDocumentUploadWithFolder = (recordId: string, file: File, documentType: DocumentType) => {
        return handlePaymentSlipsDocumentUpload(recordId, file, documentType, 'payment-slips')
    }

    const handleFilterChange = useCallback((categories: string[]) => {
        setSelectedCategories(categories);
    }, []);

    const handleObligationFilterChange = useCallback((obligations: string[]) => {
        setSelectedObligations(obligations);
    }, []);

    const isDateInRange = (date: Date, from?: string | null, to?: string | null): boolean => {
        if (!from || !to) return false;
        try {
            // Handle both formats: DD/MM/YYYY and YYYY-MM-DD
            const parseDate = (dateStr: string) => {
                if (dateStr.includes('/')) {
                    const [day, month, year] = dateStr.split('/').map(Number);
                    return new Date(year, month - 1, day);
                } else {
                    return new Date(dateStr);
                }
            };

            const fromDate = parseDate(from);
            const toDate = parseDate(to);

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

            // Helper function to check if a date is in range
            const isDateInRange = (fromDate, toDate) => {
                if (!fromDate || !toDate) return false;

                try {
                    // Handle both formats: DD/MM/YYYY and YYYY-MM-DD
                    const parseDate = (dateStr) => {
                        if (dateStr.includes('/')) {
                            const [day, month, year] = dateStr.split('/').map(Number);
                            return new Date(year, month - 1, day);
                        } else {
                            return new Date(dateStr);
                        }
                    };

                    const from = parseDate(fromDate);
                    const to = parseDate(toDate);

                    return currentDate >= from && currentDate <= to;
                } catch (error) {
                    console.error('Error parsing dates:', error);
                    return false;
                }
            };

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
                                record.company.acc_client_effective_from,
                                record.company.acc_client_effective_to
                            );
                            break;
                        case 'audit_tax':
                            isInCategory = record.company.audit_tax_client_effective_from || record.company.audit_tax_client_effective_to;
                            isActive = isDateInRange(
                                record.company.audit_tax_client_effective_from,
                                record.company.audit_tax_client_effective_to
                            );
                            break;
                        case 'cps_sheria':
                            isInCategory = record.company.cps_sheria_client_effective_from || record.company.cps_sheria_client_effective_to;
                            isActive = isDateInRange(
                                record.company.cps_sheria_client_effective_from,
                                record.company.cps_sheria_client_effective_to
                            );
                            break;
                        case 'imm':
                            isInCategory = record.company.imm_client_effective_from || record.company.imm_client_effective_to;
                            isActive = isDateInRange(
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

    const handleExportAll = () => {
        if (filteredRecords.length === 0) {
            return;
        }
        
        // Get all records that have documents
        const recordsWithDocuments = filteredRecords.filter(record => 
            record.payment_slips_documents && 
            Object.values(record.payment_slips_documents).some(doc => doc)
        );
        
        if (recordsWithDocuments.length === 0) {
            return;
        }
        
        // Export CSV with document links
        handleBulkExport(recordsWithDocuments);
    };

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
                        payrollRecords={payrollRecords} // Pass the entire records array
                        onFilterChange={handleFilterChange}
                        selectedCategories={selectedCategories}
                    />
                    <DropdownMenu>
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
                                    checked={visibleColumns.includes(column.id)}
                                    onCheckedChange={(checked) => {
                                        toggleColumnVisibility(column.id, checked);
                                    }}
                                    className=""
                                >
                                    {column.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <Button
                        onClick={() => setShowSummaryHeaders(prev => !prev)}
                        className="h-8 flex items-center gap-1 px-2 bg-indigo-500 hover:bg-indigo-600"
                    >
                        <Filter className="h-4 w-4 text-white" />
                        {showSummaryHeaders ? 'Hide Counts' : 'Show Counts'}
                    </Button>
                    
                    <Button
                        // onClick={handleExtractAll}
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
                    <Button
                        onClick={() => setBulkUploadDialogOpen(true)}
                        className="h-8 px-2 bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1"
                    >
                        <Upload className="h-4 w-4" />
                        Bulk Upload
                    </Button>
                </div>
            </div>

            <TaxPaymentTable
                records={filteredRecords}
                onDocumentUpload={handlePaymentSlipsDocumentUpload}
                onDocumentDelete={handlePaymentSlipsDocumentDelete}
                onStatusUpdate={handleStatusUpdate}
                loading={loading}
                columnVisibility={columnVisibility}
                onExportCsv={handleBulkExport}
                bulkUploadDialogOpen={bulkUploadDialogOpen}
                setBulkUploadDialogOpen={setBulkUploadDialogOpen}
                showSummaryHeaders={showSummaryHeaders}
            />
        </div>
    )
}