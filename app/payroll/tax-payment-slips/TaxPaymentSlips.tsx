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
import { Settings2, Download, Upload } from 'lucide-react'
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
    handleBulkExport
}: TaxPaymentSlipsProps) {
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['acc']);
    const [selectedObligations, setSelectedObligations] = useState<string[]>(['active']);
    const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);

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

    const handleFilterChange = useCallback((categories: string[]) => {
        setSelectedCategories(categories);
    }, []);

    const handleObligationFilterChange = useCallback((obligations: string[]) => {
        setSelectedObligations(obligations);
    }, []);

    const handleDocumentUploadWithFolder = (recordId: string, file: File, documentType: DocumentType) => {
        return handlePaymentSlipsDocumentUpload(recordId, file, documentType, 'payment-slips')
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
                            isActive = isDateInRange(currentDate, record.company.audit_tax_client_effective_from, record.company.audit_tax_client_effective_to);
                            break;
                        case 'cps_sheria':
                            isInCategory = true;
                            isActive = isDateInRange(currentDate, record.company.cps_sheria_client_effective_from, record.company.cps_sheria_client_effective_to);
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
                        companyDates={filteredRecords[0]?.company}
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
                onDocumentUpload={handleDocumentUploadWithFolder}
                onDocumentDelete={handlePaymentSlipsDocumentDelete}
                onStatusUpdate={handleStatusUpdate}
                loading={loading}
                columnVisibility={columnVisibility}
                onExportCsv={handleBulkExport}
                bulkUploadDialogOpen={bulkUploadDialogOpen}
                setBulkUploadDialogOpen={setBulkUploadDialogOpen}
            />
        </div>
    )
}