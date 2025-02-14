import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CompanyPayrollRecord, DocumentType } from '../types'
import { useToast } from '@/hooks/use-toast'

export const usePayrollCycle = () => {
    const [payrollRecords, setPayrollRecords] = useState<CompanyPayrollRecord[]>([])
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    const selectedMonthYear = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`

    const fetchOrCreatePayrollCycle = useCallback(async () => {
        setLoading(true)
        try {
            let { data: cycle } = await supabase
                .from('payroll_cycles')
                .select('*')
                .eq('month_year', selectedMonthYear)
                .single()

            if (!cycle) {
                const { data: newCycle, error: cycleError } = await supabase
                    .from('payroll_cycles')
                    .insert([{ month_year: selectedMonthYear }])
                    .select()
                    .single()

                if (cycleError) throw cycleError
                cycle = newCycle

                const { data: companies, error: companiesError } = await supabase
                    .from('acc_portal_company_duplicate')
                    .select('id')

                if (companiesError) throw companiesError
                if (companies) {
                    const { error: recordsError } = await supabase
                        .from('company_payroll_records')
                        .insert(
                            companies.map(company => ({
                                company_id: company.id,
                                payroll_cycle_id: cycle!.id
                            }))
                        )

                    if (recordsError) throw recordsError
                }
            }

            await fetchPayrollRecords(cycle.id)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to initialize payroll cycle',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }, [selectedMonthYear, toast])

    const fetchPayrollRecords = async (cycleId: string) => {
        try {
            const { data, error } = await supabase
                .from('company_payroll_records')
                .select(`
                    *,
                    company:acc_portal_company_duplicate(
                        id,
                        company_name
                    )
                `)
                .eq('payroll_cycle_id', cycleId)
                .ilike('company.company_name', `%${searchTerm}%`)

            if (error) throw error
            if (data) setPayrollRecords(data)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch payroll records',
                variant: 'destructive'
            })
        }
    }

    const handleDocumentUpload = async (
        recordId: string,
        file: File,
        documentType: DocumentType,
        subFolder: string
    ) => {
        try {
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) return

            const fileExtension = file.name.split('.').pop()
            const fileName = `${documentType} - ${record.company.company_name} - ${format(new Date(), 'yyyyMMdd')}.${fileExtension}`
            const filePath = `${selectedMonthYear}/${subFolder}/${record.company.company_name}/${fileName}`

            // First, try to delete existing file if it exists
            const existingPath = record.documents?.[documentType]
            if (existingPath) {
                try {
                    await supabase.storage
                        .from('Payroll-Cycle')
                        .remove([existingPath])
                } catch (error) {
                    console.error('Failed to delete existing file:', error)
                }
            }

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('Payroll-Cycle')
                .upload(filePath, file, {
                    cacheControl: '0',
                    upsert: true
                })

            if (uploadError) throw uploadError

            // Get current documents to ensure we have the latest state
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('documents')
                .eq('id', recordId)
                .single()

            if (fetchError) throw fetchError

            // Merge the new document path with existing documents
            const updatedDocuments = {
                ...(currentRecord?.documents || {}),
                [documentType]: uploadData.path
            }

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    documents: updatedDocuments
                })
                .eq('id', recordId)

            if (updateError) throw updateError

            await fetchPayrollRecords(record.payroll_cycle_id)
            toast({
                title: 'Success',
                description: 'Document uploaded successfully'
            })

            return uploadData.path
        } catch (error) {
            console.error('Upload error:', error)
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to upload document',
                variant: 'destructive'
            })
            throw error
        }
    }

    const handleDocumentDelete = async (recordId: string, documentType: DocumentType) => {
        try {
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) return

            const documentPath = record.documents?.[documentType]
            if (!documentPath) return

            const { error: deleteError } = await supabase.storage
                .from('Payroll-Cycle')
                .remove([documentPath])

            if (deleteError) throw deleteError

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    documents: {
                        ...(record.documents || {}),
                        [documentType]: null
                    }
                })
                .eq('id', recordId)

            if (updateError) throw updateError

            await fetchPayrollRecords(record.payroll_cycle_id)
            toast({
                title: 'Success',
                description: 'Document deleted successfully'
            })
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete document',
                variant: 'destructive'
            })
        }
    }

    const handleStatusUpdate = async (
        recordId: string,
        statusUpdate: Partial<CompanyPayrollRecord['status']>
    ) => {
        try {
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) return

            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    status: {
                        ...record.status,
                        ...statusUpdate
                    }
                })
                .eq('id', recordId)

            if (error) throw error

            await fetchPayrollRecords(record.payroll_cycle_id)
            toast({
                title: 'Success',
                description: 'Status updated successfully'
            })
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update status',
                variant: 'destructive'
            })
        }
    }

    return {
        payrollRecords,
        setPayrollRecords,
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        searchTerm,
        setSearchTerm,
        loading,
        fetchOrCreatePayrollCycle,
        handleDocumentUpload,
        handleDocumentDelete,
        handleStatusUpdate
    }
}
