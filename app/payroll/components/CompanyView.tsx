'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { format, parse } from 'date-fns'
import { Search, Calendar, Download, Trash2, Eye, FolderOpen, Users, MoreHorizontal, CheckCircle, AlertCircle, Mail, MessageSquare } from 'lucide-react'
import { CategoryFilters } from './CategoryFilters'
import { ObligationFilters } from './ObligationFilters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { CompanyPayrollRecord, DocumentType } from '../types'
import { formatDate } from '../payroll-management-wingu/utils/payrollUtils'
import { DocumentUploadDialog } from '../payroll-management-wingu/components/DocumentUploadDialog'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { ContactModal } from '../payslip-receipts/components/ContactModal'
import { WhatsAppModal } from '../payslip-receipts/components/WhatsappModal'

interface CompanyViewProps {
    payrollRecords: CompanyPayrollRecord[]
    onDocumentUpload: (recordId: string, file: File, documentType: DocumentType, subFolder: string) => Promise<string | void>
    onDocumentDelete: (recordId: string, documentType: DocumentType) => Promise<void>
    onStatusUpdate: (recordId: string, statusUpdate: any) => Promise<void>
    tabType?: 'payroll' | 'tax-payment' | 'payslip-receipts' | 'extraction-report'
    documentLabels?: Record<string, string>
    documentsField?: string
    // Shared filter states (optional)
    selectedCategories?: string[]
    setSelectedCategories?: (categories: string[]) => void
    selectedObligations?: string[]
    setSelectedObligations?: (obligations: string[]) => void
}

export function CompanyView({
    payrollRecords,
    onDocumentUpload,
    onDocumentDelete,
    onStatusUpdate,
    tabType = 'payroll',
    documentLabels = {
        paye_csv: "PAYE Returns (CSV)",
        hslevy_csv: "Housing Levy Returns (CSV)",
        zip_file_kra: "KRA ZIP File",
        shif_exl: "SHIF Returns (Excel)",
        nssf_exl: "NSSF Returns (Excel)",
        all_csv: "All CSV Files"
    },
    documentsField = 'documents',
    // Shared filter states with default values
    selectedCategories = [],
    setSelectedCategories = () => {},
    selectedObligations = [],
    setSelectedObligations = () => {}
}: CompanyViewProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { toast } = useToast()

    // Dialogs
    const [finalizeDialog, setFinalizeDialog] = useState<{
        isOpen: boolean;
        recordId: string | null;
        assignedTo: string;
        isNil: boolean;
    }>({ isOpen: false, recordId: null, assignedTo: 'Tushar', isNil: false });

    const [filingDialog, setFilingDialog] = useState<{
        isOpen: boolean;
        recordId: string | null;
        isNil: boolean;
        confirmOpen: boolean;
        record?: CompanyPayrollRecord | null;
    }>({
        isOpen: false,
        recordId: null,
        isNil: false,
        confirmOpen: false,
        record: null
    });

    const [documentDetailsDialog, setDocumentDetailsDialog] = useState<{
        isOpen: boolean;
        record: CompanyPayrollRecord | null;
    }>({ isOpen: false, record: null });

    const [deleteAllDialog, setDeleteAllDialog] = useState<{
        isOpen: boolean;
        record: CompanyPayrollRecord | null;
    }>({ isOpen: false, record: null });

    // Get document subfolder based on tab type
    const getSubFolder = () => {
        switch (tabType) {
            case 'payroll': return 'PREP DOCS';
            case 'tax-payment': return 'payment-slips';
            case 'payslip-receipts': return 'payment-receipts';
            case 'extraction-report': return 'extractions';
            default: return 'documents';
        }
    };

    // Helper functions
    const isNilRecord = useCallback((record: CompanyPayrollRecord): boolean => {
        if (!record || !record.status) return false;
        return record.status.finalization_date === 'NIL';
    }, []);

    // Group records by company
    const companiesByIdMap = useMemo(() => {
        const map = new Map<string, CompanyPayrollRecord[]>()
        payrollRecords.forEach(record => {
            if (!record.company_id) return
            if (!map.has(record.company_id)) {
                map.set(record.company_id, [])
            }
            map.get(record.company_id)?.push(record)
        })
        return map
    }, [payrollRecords])

    // Get unique companies
    const companies = useMemo(() => {
        const uniqueCompanies = new Map()
        payrollRecords.forEach(record => {
            if (record.company && !uniqueCompanies.has(record.company.id)) {
                uniqueCompanies.set(record.company.id, record.company)
            }
        })
        return Array.from(uniqueCompanies.values())
            .sort((a, b) => a.company_name.localeCompare(b.company_name))
    }, [payrollRecords])

    // Helper function for date range checking
    const isDateInRange = (currentDate: Date, fromDate?: string | null, toDate?: string | null): boolean => {
        // Return false if either date is missing or null/empty string
        if (!fromDate || !toDate || fromDate === '' || toDate === '') return false;
        
        // Special handling for "no obligation" or "missing" values
        if (fromDate.toLowerCase().includes('no obligation') || 
            fromDate.toLowerCase().includes('missing') || 
            toDate.toLowerCase().includes('no obligation') || 
            toDate.toLowerCase().includes('missing')) {
            return false;
        }

        try {
            // Handle both formats: DD/MM/YYYY and YYYY-MM-DD
            const parseDate = (dateStr: string) => {
                if (!dateStr) return null;
                
                if (dateStr.includes('/')) {
                    const [day, month, year] = dateStr.split('/').map(Number);
                    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
                    return new Date(year, month - 1, day);
                } else {
                    const parsedDate = new Date(dateStr);
                    return isNaN(parsedDate.getTime()) ? null : parsedDate;
                }
            };

            const from = parseDate(fromDate);
            const to = parseDate(toDate);
            
            if (!from || !to) return false;
            // Compare dates directly as Date objects
            return currentDate.getTime() >= from.getTime() && currentDate.getTime() <= to.getTime();
        } catch (error) {
            console.error('Error parsing dates:', error);
            return false;
        }
    }

    // Filter companies based on search, categories, and obligations
    const filteredCompanies = useMemo(() => {
        if (!companies || companies.length === 0) return [];

        return companies.filter(company => {
            if (!company) return false;
            
            // Search filter
            if (searchTerm && company?.company_name && !company.company_name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false
            }

            // Category filter
            let matchesCategory = true
            if (selectedCategories && selectedCategories.length > 0) {
                matchesCategory = selectedCategories.some(categoryString => {
                    // Parse the category string
                    let baseCategory, status;

                    if (categoryString.includes('_status_')) {
                        [baseCategory, status] = categoryString.split('_status_');
                    } else {
                        baseCategory = categoryString;
                        status = 'all';
                    }

                    const currentDate = new Date();

                    // Determine if the company is in this category and has the right status
                    let isInCategory = false;
                    let isActive = false;
                    
                    // Safely check for null/undefined company properties
                    if (!company) return false;

                    switch (baseCategory) {
                        case 'acc':
                            isInCategory = !!(company.acc_client_effective_from || company.acc_client_effective_to);
                            isActive = isDateInRange(currentDate, company.acc_client_effective_from, company.acc_client_effective_to);
                            break;
                        case 'audit_tax':
                            isInCategory = !!(company.audit_tax_client_effective_from || company.audit_tax_client_effective_to);
                            isActive = isDateInRange(currentDate, company.audit_tax_client_effective_from, company.audit_tax_client_effective_to);
                            break;
                        case 'cps_sheria':
                            isInCategory = !!(company.cps_sheria_client_effective_from || company.cps_sheria_client_effective_to);
                            isActive = isDateInRange(currentDate, company.cps_sheria_client_effective_from, company.cps_sheria_client_effective_to);
                            break;
                        case 'imm':
                            isInCategory = !!(company.imm_client_effective_from || company.imm_client_effective_to);
                            isActive = isDateInRange(currentDate, company.imm_client_effective_from, company.imm_client_effective_to);
                            break;
                        default:
                            return false;
                    }

                    // Check if this company matches the status filter
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
            let matchesObligation = !selectedObligations || selectedObligations.length === 0;

            if (selectedObligations && selectedObligations.length > 0 && company.pin_details) {
                const obligationStatus = company.pin_details?.paye_status?.toLowerCase() || '';
                const effectiveFrom = company.pin_details?.paye_effective_from || '';

                // Determine specific status types
                const isCancelled = obligationStatus === 'cancelled';
                const isDormant = obligationStatus === 'dormant';
                const isNoObligation = effectiveFrom.toLowerCase?.().includes('no obligation') || false;
                const isMissing = !effectiveFrom || (typeof effectiveFrom === 'string' && effectiveFrom.toLowerCase().includes('missing'));

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

            return matchesObligation;
        });
    }, [companies, searchTerm, selectedCategories, selectedObligations]);

    // Get records for selected company
    const selectedCompanyRecords = useMemo(() => {
        if (!selectedCompanyId || !companiesByIdMap || !companiesByIdMap.has(selectedCompanyId)) return []

        // Get all records for this company
        const records = companiesByIdMap.get(selectedCompanyId) || []

        // Sort by month-year in descending order (latest first)
        return [...records].sort((a, b) => {
            const getDate = (record: CompanyPayrollRecord) => {
                try {
                    if (!record.payroll_cycle_id) return new Date(0); // Default date for invalid records
                    const month = parseInt(record.payroll_cycle_id.substring(5, 7))
                    const year = parseInt(record.payroll_cycle_id.substring(0, 4))
                    return new Date(year, month - 1)
                } catch (error) {
                    console.error('Error parsing date from cycle ID:', error);
                    return new Date(0); // Return epoch date as fallback
                }
            }

            return getDate(b).getTime() - getDate(a).getTime()
        })
    }, [selectedCompanyId, companiesByIdMap])
    
    // Generate complete records for all months of the year, including missing months
    const completeMonthlyRecords = useMemo(() => {
        if (!selectedCompanyId) return [];
        
        const existingRecords = selectedCompanyRecords;
        if (!existingRecords || existingRecords.length === 0) return [];
        
        // Get the most recent year from existing records
        const years = new Set<string>();
        existingRecords.forEach(record => {
            if (record.payroll_cycle_id && record.payroll_cycle_id.length >= 4) {
                years.add(record.payroll_cycle_id.substring(0, 4));
            }
        });
        
        // Use the current year if no records exist with a valid year
        const currentYear = new Date().getFullYear().toString();
        const yearsArray = Array.from(years).length > 0 ? Array.from(years) : [currentYear];
        
        // Sort years in descending order (newest first)
        yearsArray.sort((a, b) => parseInt(b) - parseInt(a));
        
        // Create a map of existing records by cycle ID for easy lookup
        const recordsByYearMonth = new Map<string, CompanyPayrollRecord>();
        existingRecords.forEach(record => {
            if (record.payroll_cycle_id) {
                recordsByYearMonth.set(record.payroll_cycle_id, record);
            }
        });
        
        // Generate a complete set of records for all months in all years
        const allRecords: (CompanyPayrollRecord | { 
            id: string; 
            isMissing: true; 
            payroll_cycle_id: string;
            company_id: string;
            company: any; // Use any type to avoid type errors
            // Add missing properties to avoid TypeScript errors
            status?: { 
                finalization_date?: string | null;
                assigned_to?: string | null;
                filing?: { filingDate?: string | null } | null;
            } | null;
            documents?: Record<string, string | null>;
        })[] = [];
        
        yearsArray.forEach(year => {
            // For each month (1-12)
            for (let month = 1; month <= 12; month++) {
                // Format month with leading zero
                const monthStr = month.toString().padStart(2, '0');
                // Construct cycle ID in the same format as existing records (YYYY-MM)
                const cycleId = `${year}-${monthStr}`;
                
                // If a record exists for this cycle, use it
                if (recordsByYearMonth.has(cycleId)) {
                    allRecords.push(recordsByYearMonth.get(cycleId)!);
                } else {
                    // Create a placeholder for missing months
                    // We'll use this to display missing months in the UI
                    allRecords.push({
                        id: `missing-${cycleId}`,
                        isMissing: true,
                        payroll_cycle_id: cycleId,
                        company_id: selectedCompanyId,
                        company: existingRecords[0]?.company,
                        status: null,
                        documents: {}
                    });
                }
            }
        });
        
        // Sort by year and month (descending)
        return allRecords.sort((a, b) => {
            if (!a.payroll_cycle_id || !b.payroll_cycle_id) return 0;
            return b.payroll_cycle_id.localeCompare(a.payroll_cycle_id);
        });
    }, [selectedCompanyId, selectedCompanyRecords]);

    // Set first company as selected if none is selected
    useEffect(() => {
        if (filteredCompanies && filteredCompanies.length > 0 && !selectedCompanyId && filteredCompanies[0]?.id) {
            setSelectedCompanyId(filteredCompanies[0].id)
        }
    }, [filteredCompanies, selectedCompanyId])

    const getMonthYearFromCycleId = (cycleId: string) => {
        try {
            if (!cycleId || typeof cycleId !== 'string' || cycleId.length < 7) {
                return { monthName: 'Unknown', monthShort: 'Unknown', year: 'Unknown' };
            }
            
            const year = cycleId.substring(0, 4)
            const month = parseInt(cycleId.substring(5, 7))
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
            
            if (isNaN(month) || month < 1 || month > 12 || isNaN(parseInt(year))) {
                return { monthName: 'Unknown', monthShort: 'Unknown', year: 'Unknown' };
            }
            
            return {
                monthName: monthNames[month - 1],
                monthShort: format(new Date(parseInt(year), month - 1), 'MMM'),
                year
            }
        } catch (e) {
            console.error('Error parsing cycle ID:', e);
            return { monthName: 'Unknown', monthShort: 'Unknown', year: 'Unknown' }
        }
    }

    const getStatusColor = (record: CompanyPayrollRecord) => {
        if (!record || !record.status) return 'bg-gray-300'
        if (record.status.finalization_date === 'NIL') return 'bg-purple-500'
        if (record.status.finalization_date) return 'bg-green-500'
        return 'bg-yellow-500'
    }

    const getStatusLabel = (record: CompanyPayrollRecord) => {
        if (!record || !record.status) return 'Unknown'
        if (record.status.finalization_date === 'NIL') return 'NIL Return'
        if (record.status.finalization_date) return 'Finalized'
        return 'Pending'
    }

    const handleLocalUpload = async (recordId: string, file: File, documentType: DocumentType) => {
        try {
            setIsSubmitting(true)
            await onDocumentUpload(recordId, file, documentType, getSubFolder())

            toast({
                title: 'Success',
                description: 'Document uploaded successfully'
            })
        } catch (error) {
            console.error('Upload error:', error)
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to upload document',
                variant: 'destructive'
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDownload = async (path: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('Payroll-Cycle')
                .download(path)

            if (error) throw error

            // Create download link
            const url = URL.createObjectURL(data)
            const a = document.createElement('a')
            a.href = url
            a.download = path.split('/').pop() || 'document'
            document.body.appendChild(a)
            a.click()
            URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast({
                title: 'Success',
                description: 'Document downloaded successfully'
            })
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to download document',
                variant: 'destructive'
            })
        }
    }

    const handleDownloadAll = async (record: CompanyPayrollRecord) => {
        try {
            // Safely access documents with proper type casting
            const documents: Record<string, string | null> = 
                (documentsField in record ? (record as any)[documentsField] : record.documents) || {}
            
            const documentsToDownload = Object.entries(documents)
                .filter(([key, value]) => key !== 'all_csv' && value !== null)

            if (documentsToDownload.length === 0) {
                toast({
                    title: 'Warning',
                    description: 'No documents available to download',
                    variant: 'default'
                })
                return
            }

            for (const [_, path] of documentsToDownload) {
                if (path && typeof path === 'string') await handleDownload(path)
            }

            toast({
                title: 'Success',
                description: 'All documents downloaded successfully'
            })
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to download all documents',
                variant: 'destructive'
            })
        }
    }

    const handleDeleteAll = async (record: CompanyPayrollRecord) => {
        try {
            setIsSubmitting(true)
            // Safely access documents with proper type casting
            const documents: Record<string, string | null> = 
                (documentsField in record ? (record as any)[documentsField] : record.documents) || {}

            // Filter out null values
            const documentsToDelete = Object.entries(documents)
                .filter(([key, value]) => key !== 'all_csv' && value !== null)

            if (documentsToDelete.length === 0) {
                toast({
                    title: 'No documents',
                    description: 'No documents to delete'
                })
                return
            }

            // Delete all files from storage
            await Promise.all(
                documentsToDelete.map(async ([_, path]) => {
                    if (path && typeof path === 'string') {
                        const { error } = await supabase.storage
                            .from('Payroll-Cycle')
                            .remove([path])
                        if (error) throw error
                    }
                })
            )

            // Create empty documents object with the right structure for the tab
            const emptyDocuments: Record<string, null> = {}
            
            // Make sure documentLabels is available and is an object
            if (documentLabels && typeof documentLabels === 'object') {
                Object.keys(documentLabels)
                    .filter(key => key !== 'all_csv')
                    .forEach(key => {
                        emptyDocuments[key] = null
                    })
            }

            // Update record to clear all documents
            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    [documentsField]: emptyDocuments
                })
                .eq('id', record.id)

            if (error) throw error

            toast({
                title: 'Success',
                description: `Successfully deleted ${documentsToDelete.length} documents`
            })
            setDeleteAllDialog({ isOpen: false, record: null })

            // Force a refresh of the data (this would ideally come from parent)
            window.location.reload()
        } catch (error) {
            console.error('Delete all error:', error)
            toast({
                title: 'Error',
                description: 'Failed to delete documents',
                variant: 'destructive'
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleFinalize = async (recordId: string) => {
        try {
            await onStatusUpdate(recordId, {
                finalization_date: finalizeDialog.isNil ? 'NIL' : new Date().toISOString(),
                status: 'completed',
                assigned_to: finalizeDialog.assignedTo
            })

            toast({
                title: 'Success',
                description: 'Record finalized successfully'
            })

            setFinalizeDialog({ isOpen: false, recordId: null, assignedTo: 'Tushar', isNil: false })
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to finalize record',
                variant: 'destructive'
            })
        }
    }

    const handleFilingConfirm = async (recordId: string) => {
        try {
            const record = selectedCompanyRecords.find(r => r.id === recordId)
            if (!record) return

            // Fetch current record to get latest status
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('status')
                .eq('id', recordId)
                .single()

            if (fetchError) throw fetchError

            const currentDate = filingDialog.isNil ? 'NIL' : new Date().toISOString()

            // Create the updated status object
            const updatedStatus = {
                ...currentRecord.status, // Preserve existing status fields
                filing: {
                    isReady: true,
                    filingDate: currentDate,
                    isNil: filingDialog.isNil,
                    filedBy: record.status?.assigned_to || 'Unassigned'
                }
            }

            // Update the record in Supabase
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    status: updatedStatus
                })
                .eq('id', recordId)

            if (updateError) throw updateError

            toast({
                title: "Success",
                description: "Filing status updated successfully"
            })

            setFilingDialog({ isOpen: false, recordId: null, isNil: false, confirmOpen: false, record: null })

            // Force a refresh of the data
            window.location.reload()
        } catch (error) {
            console.error('Filing update error:', error)
            toast({
                title: "Error",
                description: "Failed to update filing status",
                variant: "destructive"
            })
        }
    }

    const getDocumentCount = (record: CompanyPayrollRecord) => {
        // Safely access documents using type assertion or optional chaining
        const docs = (documentsField in record && (record as any)[documentsField]) || record.documents || {}

        if (record.status?.finalization_date === 'NIL') {
            return 'N/A'
        }

        const totalDocs = Object.keys(documentLabels).filter(key => key !== 'all_csv').length
        const uploadedDocs = Object.entries(docs)
            .filter(([key]) => key !== 'all_csv' && docs[key] !== null)
            .length

        return `${uploadedDocs}/${totalDocs}`
    }

    const allDocumentsUploaded = (record: CompanyPayrollRecord) => {
        if (!record) return false

        // Safely access documents using type assertion or optional chaining
        const docs = (documentsField in record && (record as any)[documentsField]) || record.documents || {}

        // If it's a NIL record, documents are not required
        if (record.status?.finalization_date === 'NIL') return true

        // Check if all document types (except all_csv) have been uploaded
        return Object.keys(documentLabels)
            .filter(key => key !== 'all_csv')
            .every(key => !!docs[key])
    }

    // Get document columns based on the tab type
    const documentColumns = useMemo(() => {
        return Object.entries(documentLabels)
            .filter(([key]) => key !== 'all_csv')
            .map(([key, label]) => ({
                key,
                label
            }))
    }, [documentLabels])

    const getDocumentsForUpload = (record: CompanyPayrollRecord) => {
        if (!record || (record.status?.finalization_date === 'NIL')) return [];

        // Safely access documents using type assertion or optional chaining
        const docs = (documentsField in record && (record as any)[documentsField]) || record.documents || {};

        // Get all document types that haven't been uploaded yet
        return Object.entries(documentLabels)
            .filter(([key]) => key !== 'all_csv' && !docs[key])
            .map(([key, label]) => ({
                key,
                label
            }));
    };

    const handleEmailSent = async (recordId: string, emailData: { date: string; recipients: string[] }) => {
        try {
            // Fetch current record to get latest email history
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('email_history')
                .eq('id', recordId)
                .single()

            if (fetchError) throw fetchError

            const emailHistory = currentRecord.email_history || []
            const updatedHistory = [...emailHistory, emailData]

            // Update the record in Supabase
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    email_history: updatedHistory
                })
                .eq('id', recordId)

            if (updateError) throw updateError

            toast({
                title: "Success",
                description: "Email history updated successfully"
            })
        } catch (error) {
            console.error('Email history update error:', error)
            toast({
                title: "Error",
                description: "Failed to update email history",
                variant: "destructive"
            })
        }
    }

    const handleMessageSent = async (recordId: string, messageData: { date: string; recipients: string[] }) => {
        try {
            // Fetch current record to get latest message history
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('whatsapp_history')
                .eq('id', recordId)
                .single()

            if (fetchError) throw fetchError

            const messageHistory = currentRecord?.whatsapp_history || []
            const updatedHistory = [...messageHistory, messageData]

            // Update the message history
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    whatsapp_history: updatedHistory
                })
                .eq('id', recordId)

            if (updateError) throw updateError

            toast({
                title: "Success",
                description: "WhatsApp message history updated"
            })
        } catch (error) {
            console.error('WhatsApp history update error:', error)
            toast({
                title: "Error",
                description: "Failed to update WhatsApp history",
                variant: "destructive"
            })
        }
    }

    return (
        <>
        <div className="flex h-[calc(100vh-200px)] border rounded-md overflow-hidden">
            {/* Left sidebar with companies */}
            <div className="w-[300px] border-r flex flex-col">
                <div className="p-4 space-y-3 border-b">
                    <Input
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full"
                        prefix={<Search className="w-4 h-4 text-gray-500" />}
                    />
                    <div className="flex gap-2">
                        <CategoryFilters
                            payrollRecords={payrollRecords}
                            setSelectedCategories={setSelectedCategories}
                            selectedCategories={selectedCategories}
                        />
                        <ObligationFilters
                            payrollRecords={payrollRecords}
                            setSelectedObligations={setSelectedObligations}
                            selectedObligations={selectedObligations}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-grow">
                    <div className="space-y-0.5 py-2">
                        {filteredCompanies.map((company, index) => (
                            <Button
                                key={company.id}
                                variant="ghost"
                                className={`w-full justify-start text-left h-auto py-2 px-3 ${selectedCompanyId === company.id ? 'bg-blue-100 text-blue-700 font-medium' : ''
                                    }`}
                                onClick={() => setSelectedCompanyId(company.id)}
                            >
                                <div className="flex items-center gap-2 w-full">
                                    <div className="min-w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-medium">
                                        {index + 1}
                                    </div>
                                    <div className="overflow-hidden flex-1">
                                        <div className="font-medium truncate">{company.company_name}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <span className="truncate">{company.kra_pin || 'No PIN'}</span>
                                            {(() => {
                                                const companyId = company?.id;
                                                if (!companyId) return null;

                                                const companyCycles = companiesByIdMap ? companiesByIdMap.get(companyId) : undefined;
                                                const cycleCount = companyCycles ? companyCycles.length : 0;
                                                if (cycleCount <= 0) return null;

                                                return (
                                                    <Badge variant="outline" className="text-xs ml-1">
                                                        {cycleCount} cycles
                                                    </Badge>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Right side with table of payroll records */}
            <div className="flex-1 flex flex-col">
                {selectedCompanyId ? (
                    <>
                        <div className="p-4 border-b bg-blue-50">
                            <h2 className="text-xl font-semibold text-blue-700">
                                {filteredCompanies.find(c => c.id === selectedCompanyId)?.company_name}
                            </h2>
                            <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                <span className="flex items-center gap-1">
                                    <Users className="w-4 h-4" />
                                    {/* Use optional chaining and safe access to employee count */}
                                    {selectedCompanyRecords.find(r => r.company_id === selectedCompanyId)?.['number_of_employees'] || 'N/A'} employees
                                </span>
                                <span>•</span>
                                <span>KRA PIN: {filteredCompanies.find(c => c.id === selectedCompanyId)?.['kra_pin'] || 'Not available'}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <Table className="min-w-max">
                                <TableHeader className="sticky top-0 z-10">
                                    <TableRow className="bg-blue-600 text-white hover:bg-blue-700">
                                        <TableHead className="text-white font-semibold w-12">Index</TableHead>
                                        <TableHead className="text-white font-semibold w-20">Year</TableHead>
                                        <TableHead className="text-white font-semibold w-28">Month</TableHead>
                                        <TableHead className="text-white font-semibold w-28">Status</TableHead>
                                        {documentColumns.map(col => (
                                            <TableHead key={col.key} className="text-white font-semibold w-32 px-2 text-center">
                                                {col.label}
                                            </TableHead>
                                        ))}
                                        <TableHead className="text-white font-semibold w-24">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {completeMonthlyRecords.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5 + documentColumns.length} className="text-center py-8 text-gray-500">
                                                No payroll cycles found for this company
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        completeMonthlyRecords.map((record, index) => {
                                            const { monthName, monthShort, year } = getMonthYearFromCycleId(record.payroll_cycle_id)
                                            const isMissing = 'isMissing' in record && record.isMissing;
                                            const documents = !isMissing ? 
                                                (documentsField in record ? (record as any)[documentsField] : (record as CompanyPayrollRecord).documents) || {} : 
                                                {};

                                            return (
                                                <TableRow
                                                    key={record.id}
                                                    className={`${index % 2 === 0 ? 'bg-blue-50' : 'bg-white'} ${isMissing ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-blue-100'}`}
                                                >
                                                    <TableCell className="font-medium text-center">{index + 1}</TableCell>
                                                    <TableCell>{year}</TableCell>
                                                    <TableCell className={isMissing ? 'text-red-600 font-semibold' : ''}>
                                                        {monthName} {isMissing && '(Missing)'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isMissing ? (
                                                            <Badge className="bg-red-500">Missing</Badge>
                                                        ) : (
                                                            <Badge className={getStatusColor(record as CompanyPayrollRecord)}>
                                                                {getStatusLabel(record as CompanyPayrollRecord)}
                                                            </Badge>
                                                        )}
                                                    </TableCell>

                                                    {/* Document columns */}
                                                    {documentColumns.map(col => {
                                                        const isUploaded = !!documents[col.key];

                                                        return (
                                                            <TableCell key={col.key} className="text-center">
                                                                {isMissing ? (
                                                                    <span className="text-gray-400 text-sm italic">N/A</span>
                                                                ) : isUploaded ? (
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <TooltipProvider>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className="h-8 w-8 p-0"
                                                                                        onClick={() => handleDownload(documents[col.key])}
                                                                                    >
                                                                                        <Download className="h-4 w-4 text-blue-600" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>Download {col.label}</TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                        <TooltipProvider>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="ghost"
                                                                                        className="h-8 w-8 p-0 text-red-500"
                                                                                        onClick={() => onDocumentDelete((record as CompanyPayrollRecord).id, col.key as DocumentType)}
                                                                                    >
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>Delete {col.label}</TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                    </div>
                                                                ) : (
                                                                    <DocumentUploadDialog
                                                                        documentType={col.key as DocumentType}
                                                                        recordId={(record as CompanyPayrollRecord).id}
                                                                        onUpload={(file, docType) => handleLocalUpload((record as CompanyPayrollRecord).id, file, docType || col.key as DocumentType)}
                                                                        onDelete={(docType) => onDocumentDelete((record as CompanyPayrollRecord).id, docType || col.key as DocumentType)}
                                                                        existingDocument={null}
                                                                        label={col.label}
                                                                        isNilFiling={(record as CompanyPayrollRecord).status?.finalization_date === 'NIL'}
                                                                        allDocuments={documents ? Object.entries(documents).filter(([_, v]) => v !== null).map(([k, v]) => ({ key: k, path: v as string })) : []}
                                                                        companyName={(record as CompanyPayrollRecord).company?.company_name || 'Unknown Company'}
                                                                    />
                                                                )}
                                                            </TableCell>
                                                        );
                                                    })}

                                                    <TableCell>
                                                        {isMissing ? (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="w-full bg-green-50 hover:bg-green-100 text-green-600 border-green-300"
                                                                onClick={() => {
                                                                    // TODO: Implement functionality to create a new record for this missing month
                                                                    toast({
                                                                        title: "Create New Record",
                                                                        description: `Feature to create new record for ${monthName} ${year} is coming soon.`,
                                                                        variant: "default"
                                                                    });
                                                                }}
                                                            >
                                                                Create Record
                                                            </Button>
                                                        ) : (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="w-full"
                                                                    >
                                                                        Actions
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem
                                                                        className="flex items-center gap-2"
                                                                        onClick={() => setDocumentDetailsDialog({ isOpen: true, record: record as CompanyPayrollRecord })}
                                                                    >
                                                                        <Eye className="h-4 w-4" />
                                                                        View Details
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuSeparator />

                                                                    {!(record as CompanyPayrollRecord).status?.finalization_date && (
                                                                        <DropdownMenuItem
                                                                            className="flex items-center gap-2"
                                                                            onClick={() => setFinalizeDialog({ 
                                                                                isOpen: true, 
                                                                                recordId: (record as CompanyPayrollRecord).id, 
                                                                                assignedTo: (record as CompanyPayrollRecord).status?.assigned_to || 'Tushar', 
                                                                                isNil: false
                                                                            })}
                                                                        >
                                                                            <CheckCircle className="h-4 w-4" />
                                                                            Finalize
                                                                        </DropdownMenuItem>
                                                                    )}

                                                                    {(record as CompanyPayrollRecord).status?.finalization_date && !(record as CompanyPayrollRecord).status?.filing?.filingDate && (
                                                                        <DropdownMenuItem
                                                                            className="flex items-center gap-2"
                                                                            onClick={() => setFilingDialog({ 
                                                                                isOpen: true, 
                                                                                recordId: (record as CompanyPayrollRecord).id, 
                                                                                isNil: false, 
                                                                                confirmOpen: false, 
                                                                                record: record as CompanyPayrollRecord 
                                                                            })}
                                                                        >
                                                                            <FolderOpen className="h-4 w-4" />
                                                                            File Now
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Select a company from the sidebar
                    </div>
                )}
            </div>
        </div>

        {/* Document Details Dialog */}
        <Dialog 
            open={documentDetailsDialog.isOpen} 
            onOpenChange={(open) => {
                if (!open) setDocumentDetailsDialog({ isOpen: false, record: null });
            }}
        >
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Document Details</DialogTitle>
                    <DialogDescription>
                        View document details for {documentDetailsDialog.record?.company?.company_name}
                    </DialogDescription>
                </DialogHeader>

                {documentDetailsDialog.record && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h3 className="font-semibold">Company Information</h3>
                                <div className="text-sm space-y-1 mt-2">
                                    <p><span className="text-muted-foreground">Name:</span> {documentDetailsDialog.record.company?.company_name}</p>
                                    <p><span className="text-muted-foreground">KRA PIN:</span> {documentDetailsDialog.record.company?.kra_pin}</p>
                                    <p><span className="text-muted-foreground">Employees:</span> {documentDetailsDialog.record.number_of_employees || 'N/A'}</p>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold">Status</h3>
                                <div className="text-sm space-y-1 mt-2">
                                    <p>
                                        <span className="text-muted-foreground">Status:</span> 
                                        <Badge className={getStatusColor(documentDetailsDialog.record)}>
                                            {getStatusLabel(documentDetailsDialog.record)}
                                        </Badge>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">Assigned To:</span> 
                                        {documentDetailsDialog.record.status?.assigned_to || 'Not assigned'}
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">Finalized On:</span> 
                                        {documentDetailsDialog.record.status?.finalization_date === 'NIL' 
                                            ? 'NIL Return' 
                                            : documentDetailsDialog.record.status?.finalization_date 
                                                ? formatDate(new Date(documentDetailsDialog.record.status.finalization_date)) 
                                                : 'Not finalized'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold">Documents</h3>
                            <div className="mt-2 border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Document Type</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {documentColumns.map(doc => {
                                            const documents = (documentsField in documentDetailsDialog.record! && 
                                                (documentDetailsDialog.record as any)[documentsField]) || 
                                                documentDetailsDialog.record!.documents || {};
                                            const isUploaded = !!documents[doc.key];

                                            return (
                                                <TableRow key={doc.key}>
                                                    <TableCell>{doc.label}</TableCell>
                                                    <TableCell>
                                                        {isUploaded ? (
                                                            <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800">
                                                                Uploaded
                                                            </Badge>
                                                        ) : documentDetailsDialog.record!.status?.finalization_date === 'NIL' ? (
                                                            <Badge variant="outline" className="bg-purple-100 text-purple-800 hover:bg-purple-100 hover:text-purple-800">
                                                                Not Required (NIL)
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 hover:text-yellow-800">
                                                                Missing
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {isUploaded && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                onClick={() => handleDownload(documents[doc.key])}
                                                            >
                                                                <Download className="w-4 h-4 mr-1" />
                                                                Download
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button 
                        onClick={() => setDocumentDetailsDialog({ isOpen: false, record: null })}
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Finalize Dialog */}
        <Dialog 
            open={finalizeDialog.isOpen} 
            onOpenChange={(open) => {
                if (!open) setFinalizeDialog({ isOpen: false, recordId: null, assignedTo: 'Tushar', isNil: false });
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Finalize Payroll Record</DialogTitle>
                    <DialogDescription>
                        Mark this record as finalized. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="assigned-to">Assigned To</Label>
                        <Input
                            id="assigned-to"
                            value={finalizeDialog.assignedTo}
                            onChange={(e) => setFinalizeDialog({ ...finalizeDialog, assignedTo: e.target.value })}
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="nil-filing"
                            checked={finalizeDialog.isNil}
                            onCheckedChange={(checked) => setFinalizeDialog({ ...finalizeDialog, isNil: !!checked })}
                        />
                        <Label htmlFor="nil-filing">This is a NIL return</Label>
                    </div>

                    {finalizeDialog.isNil && (
                        <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
                            <div className="flex items-start">
                                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">NIL Return</h3>
                                    <div className="mt-1 text-sm text-yellow-700">
                                        <p>A NIL return means no filing is required for this period. Document uploads will be disabled.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button 
                        variant="outline" 
                        onClick={() => setFinalizeDialog({ isOpen: false, recordId: null, assignedTo: 'Tushar', isNil: false })}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={() => finalizeDialog.recordId && handleFinalize(finalizeDialog.recordId)}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Processing...' : 'Finalize'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Filing Dialog */}
        <Dialog 
            open={filingDialog.isOpen} 
            onOpenChange={(open) => {
                if (!open) setFilingDialog({ isOpen: false, recordId: null, isNil: false, confirmOpen: false, record: null });
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>File Record with KRA</DialogTitle>
                    <DialogDescription>
                        Mark this record as filed with KRA. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {filingDialog.record && !allDocumentsUploaded(filingDialog.record) && !filingDialog.isNil && (
                        <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
                            <div className="flex items-start">
                                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">Missing Documents</h3>
                                    <div className="mt-1 text-sm text-yellow-700">
                                        <p>Not all required documents have been uploaded. Filing is not recommended until all documents are uploaded.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="nil-filing-kra"
                            checked={filingDialog.isNil}
                            onCheckedChange={(checked) => setFilingDialog({ ...filingDialog, isNil: !!checked })}
                        />
                        <Label htmlFor="nil-filing-kra">This is a NIL filing</Label>
                    </div>
                </div>

                <DialogFooter>
                    <Button 
                        variant="outline" 
                        onClick={() => setFilingDialog({ isOpen: false, recordId: null, isNil: false, confirmOpen: false, record: null })}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={() => setFilingDialog({ ...filingDialog, confirmOpen: true })}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Processing...' : 'File Now'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Filing Confirmation Dialog */}
        <AlertDialog 
            open={filingDialog.confirmOpen} 
            onOpenChange={(open) => {
                if (!open) setFilingDialog({ ...filingDialog, confirmOpen: false });
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Filing</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. The record will be marked as filed with KRA.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setFilingDialog({ ...filingDialog, confirmOpen: false })}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={() => filingDialog.recordId && handleFilingConfirm(filingDialog.recordId)}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Processing...' : 'Confirm'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Delete All Documents Dialog */}
        <AlertDialog 
            open={deleteAllDialog.isOpen} 
            onOpenChange={(open) => {
                if (!open) setDeleteAllDialog({ isOpen: false, record: null });
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Documents</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will delete all uploaded documents for this record. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteAllDialog({ isOpen: false, record: null })}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={() => deleteAllDialog.record && handleDeleteAll(deleteAllDialog.record)}
                        disabled={isSubmitting}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isSubmitting ? 'Deleting...' : 'Delete All'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Email Contact Dialog */}
        <ContactModal 
            isOpen={selectedCompanyId !== null && selectedCompanyRecords.length > 0} 
            onClose={() => {}} // Modal is always open but hidden until triggered
            onSent={handleEmailSent}
            showModal={false}
            recordId={selectedCompanyId !== null && selectedCompanyRecords.length > 0 ? selectedCompanyRecords[0].id : undefined}
            companyData={selectedCompanyId !== null ? (companies.find(c => c.id === selectedCompanyId) || null) : null}
        />

        {/* WhatsApp Message Dialog */}
        <WhatsAppModal
            isOpen={selectedCompanyId !== null && selectedCompanyRecords.length > 0} 
            onClose={() => {}} // Modal is always open but hidden until triggered
            onSent={handleMessageSent}
            showModal={false}
            recordId={selectedCompanyId !== null && selectedCompanyRecords.length > 0 ? selectedCompanyRecords[0].id : undefined}
            companyData={selectedCompanyId !== null ? (companies.find(c => c.id === selectedCompanyId) || null) : null}
        />
        </>
    );
}