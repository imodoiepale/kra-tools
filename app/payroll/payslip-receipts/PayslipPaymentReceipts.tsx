// @ts-nocheck
import { useEffect, useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CompanyPayrollRecord, DocumentType } from '../types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Upload, Filter, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PayslipPaymentReceiptsTable } from './components/PayslipPaymentReceiptsTable'
import { BulkDocumentUpload } from './components/BulkDocumentUpload'
import { CategoryFilter } from './components/CategoryFilter'
import { ObligationFilter } from './components/ObligationFilter'
import { usePayrollCycle } from '../hooks/usePayrollCycle'
import { MonthYearSelector } from '../components/MonthYearSelector'
import { CategoryFilters } from '../components/CategoryFilters'
import { ObligationFilters } from '../components/ObligationFilters'

interface PayslipPaymentReceiptsProps {
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
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
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
    setPayrollRecords,
    setLoading
}: PayslipPaymentReceiptsProps) {
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['acc']);
    const [selectedObligations, setSelectedObligations] = useState<string[]>(['active']);
    const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
    const [showSummaryHeaders, setShowSummaryHeaders] = useState(true);
    const { toast } = useToast();

    // Get the payment receipts document upload and delete functions from the hook
    const { 
        handlePaymentReceiptsDocumentUpload,
        handlePaymentReceiptsDocumentDelete,
        handlePaymentReceiptsDocumentDeleteWithRecord,
        handleBatchPaymentReceiptsDocumentUpload,
        selectedMonthYear,
        setPayrollRecords: setHookPayrollRecords
    } = usePayrollCycle();

    // Update the hook's payroll records whenever our props change
    useEffect(() => {
        setHookPayrollRecords(payrollRecords);
    }, [payrollRecords, setHookPayrollRecords]);

    // Column definitions for visibility toggle
    const columnDefinitions = [
        { id: 'index', label: 'Index (#)', defaultVisible: true },
        { id: 'companyName', label: 'Company Name', defaultVisible: true },
        { id: 'emailDate', label: 'Email Date', defaultVisible: true },
        { id: 'whatsappDate', label: 'WhatsApp Date', defaultVisible: true },
        { id: 'payeReceipt', label: 'PAYE Receipt', defaultVisible: true },
        { id: 'housingLevyReceipt', label: 'Housing Levy Receipt', defaultVisible: true },
        { id: 'nitaReceipt', label: 'NITA Receipt', defaultVisible: true },
        { id: 'shifReceipt', label: 'SHIF Receipt', defaultVisible: true },
        { id: 'nssfReceipt', label: 'NSSF Receipt', defaultVisible: true },
        { id: 'allDocuments', label: 'All Documents', defaultVisible: true },
        { id: 'actions', label: 'Actions', defaultVisible: true },
        { id: 'emailStatus', label: 'Email Status', defaultVisible: true }
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

    // Unified document upload handler that uses the hook's function and updates local state
    const handleDocumentUploadWithFolder = useCallback(async (recordId: string, file: File, documentType: DocumentType) => {
        try {
            // Log the upload request (helpful for debugging)
            console.log('Uploading document:', { recordId, documentType, fileName: file.name });
            
            // Upload the document using the hook's function
            const path = await handlePaymentReceiptsDocumentUpload(recordId, file, documentType, 'PAYMENT RECEIPTS');
            
            if (!path) {
                throw new Error('Failed to upload document - no path returned');
            }
            
            // Successfully uploaded - update local state if needed
            // (The hook should already update its internal state)
            toast({
                title: 'Success',
                description: `${documentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} uploaded successfully`,
            });
            
            return path;
        } catch (error) {
            console.error('Error in document upload:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to upload document',
                variant: 'destructive'
            });
            
            throw error;
        }
    }, [handlePaymentReceiptsDocumentUpload]);

    // Batch document upload handler for multiple documents at once
    const handleBatchDocumentUploadWithFolder = useCallback(async (
        recordId: string, 
        documents: Array<{file: File, documentType: DocumentType}>
    ) => {
        try {
            // Log the batch upload request
            console.log('Batch uploading documents:', { 
                recordId, 
                documentCount: documents.length, 
                types: documents.map(d => d.documentType).join(', ')
            });
            
            // Use the batch upload function from the hook
            const result = await handleBatchPaymentReceiptsDocumentUpload(
                recordId, 
                documents, 
                'PAYMENT RECEIPTS'
            );
            
            if (result.success && Object.keys(result.paths).length > 0) {
                // Successfully uploaded - show success message
                const count = Object.keys(result.paths).length;
                toast({
                    title: 'Success',
                    description: `${count} document${count !== 1 ? 's' : ''} uploaded successfully`,
                });
                
                return result;
            } else {
                throw new Error(result.error || 'Failed to upload documents - no paths returned');
            }
        } catch (error) {
            console.error('Error in batch document upload:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to upload documents',
                variant: 'destructive'
            });
            
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }, [handleBatchPaymentReceiptsDocumentUpload]);

    // Unified document delete handler
    const handleDocumentDeleteWithType = useCallback(async (recordId: string, documentType: DocumentType) => {
        try {
            // Log the delete request (helpful for debugging)
            console.log('Deleting document:', { recordId, documentType });
            
            // Delete the document using the hook's function
            await handlePaymentReceiptsDocumentDelete(recordId, documentType);
            
            // Successfully deleted - toast notification is handled in the hook
            return true;
        } catch (error) {
            console.error('Error deleting document:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to delete document',
                variant: 'destructive'
            });
            throw error;
        }
    }, [handlePaymentReceiptsDocumentDelete, toast]);

    // Handle status update with proper error handling
    const handleStatusUpdateWithLocalUpdate = useCallback(async (recordId: string, statusUpdate: Partial<CompanyPayrollRecord['status']>) => {
        try {
            // Call the API to update the status
            await handleStatusUpdate(recordId, statusUpdate);
            
            // Update local state directly instead of refetching
            // (The hook should already update its internal state)
            setPayrollRecords(prevRecords => prevRecords.map(record => {
                if (record.id === recordId) {
                    return {
                        ...record,
                        status: {
                            ...(record.status || {}),
                            ...statusUpdate
                        }
                    };
                }
                return record;
            }));
            
            toast({
                title: 'Success',
                description: 'Status updated successfully',
            });
        } catch (error) {
            console.error('Error updating status:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to update status',
                variant: 'destructive'
            });
        }
    }, [handleStatusUpdate, setPayrollRecords, toast]);

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

    const handleBulkUpload = () => {
        setBulkUploadDialogOpen(true);
    };

    const handleBulkExport = async () => {
        try {
            // Count how many records have documents
            const recordsWithDocuments = filteredRecords.filter(record => 
                record.payment_receipts_documents && 
                Object.values(record.payment_receipts_documents).some(doc => doc !== null)
            );

            if (recordsWithDocuments.length === 0) {
                toast({
                    title: 'No documents',
                    description: 'There are no documents to export',
                    variant: 'default'
                });
                return;
            }

            // Create a ZIP file with all documents
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            
            let documentCount = 0;
            
            // Add each document to the ZIP file
            for (const record of recordsWithDocuments) {
                if (!record.payment_receipts_documents) continue;
                
                const companyName = record.company?.company_name || 'Unknown';
                const companyFolder = zip.folder(companyName);
                
                for (const [docType, path] of Object.entries(record.payment_receipts_documents)) {
                    if (!path) continue;
                    
                    try {
                        // Get the document from storage
                        const { data, error } = await supabase.storage
                            .from('Payroll-Cycle')
                            .download(path);
                            
                        if (error) throw error;
                        
                        // Get filename from path
                        const fileName = path.split('/').pop() || `${docType}.pdf`;
                        
                        // Add to ZIP
                        companyFolder?.file(fileName, data);
                        documentCount++;
                    } catch (error) {
                        console.error(`Error downloading ${docType} for ${companyName}:`, error);
                    }
                }
            }
            
            if (documentCount === 0) {
                toast({
                    title: 'Export failed',
                    description: 'Could not retrieve any documents to export',
                    variant: 'destructive'
                });
                return;
            }
            
            // Generate the ZIP file
            const content = await zip.generateAsync({ type: 'blob' });
            
            // Create download link
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Payment_Receipts_${format(new Date(), 'yyyy-MM-dd')}.zip`;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 0);
            
            toast({
                title: 'Export successful',
                description: `Exported ${documentCount} documents from ${recordsWithDocuments.length} companies`,
                variant: 'default'
            });
        } catch (error) {
            console.error('Export error:', error);
            toast({
                title: 'Export failed',
                description: error instanceof Error ? error.message : 'An error occurred while exporting documents',
                variant: 'destructive'
            });
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
                        onClick={() => setShowSummaryHeaders(prev => !prev)}
                        className="h-8 flex items-center gap-1 px-2 bg-indigo-500 hover:bg-indigo-600"
                    >
                        <Filter className="h-4 w-4 text-white" />
                        {showSummaryHeaders ? 'Hide Counts' : 'Show Counts'}
                    </Button>
                    <Button
                        onClick={handleBulkUpload}
                        className="h-8 px-2 bg-green-500 text-white hover:bg-green-600 flex items-center gap-1"
                    >
                        <Upload className="h-4 w-4" />
                        Bulk Upload
                    </Button>
                    <Button
                        onClick={handleBulkExport}
                        className="h-8 px-2 bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1"
                    >
                        <Download className="h-4 w-4" />
                        Export All
                    </Button>
                </div>
            </div>

            <PayslipPaymentReceiptsTable
                records={filteredRecords}
                onDocumentUpload={handleDocumentUploadWithFolder}
                onDocumentDelete={handleDocumentDeleteWithType}
                onStatusUpdate={handleStatusUpdateWithLocalUpdate}
                onBatchDocumentUpload={handleBatchDocumentUploadWithFolder}
                loading={loading}
                setPayrollRecords={setPayrollRecords}
                columnVisibility={columnVisibility}
                showSummaryHeaders={showSummaryHeaders}
                onToggleSummaryHeaders={() => setShowSummaryHeaders(prev => !prev)}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
            />

            {bulkUploadDialogOpen && (
                <BulkDocumentUpload
                    open={bulkUploadDialogOpen}
                    onClose={() => setBulkUploadDialogOpen(false)}
                    records={filteredRecords}
                    onDocumentUpload={handleDocumentUploadWithFolder}
                    onBatchDocumentUpload={handleBatchDocumentUploadWithFolder}
                    setPayrollRecords={setPayrollRecords}
                    documentTypes={[
                        { value: 'paye_receipt', label: 'PAYE Receipt' },
                        { value: 'housing_levy_receipt', label: 'Housing Levy Receipt' },
                        { value: 'nita_receipt', label: 'NITA Receipt' },
                        { value: 'shif_receipt', label: 'SHIF Receipt' },
                        { value: 'nssf_receipt', label: 'NSSF Receipt' }
                    ]}
                />
            )}
        </div>
    )
}