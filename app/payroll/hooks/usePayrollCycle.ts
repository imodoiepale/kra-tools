// @ts-nocheck
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
            // Check if the cycle exists or create it if needed
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
            }

            // Fetch all companies regardless of whether they're in payroll_records
            const { data: companies, error: companiesError } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .ilike('company_name', `%${searchTerm}%`)

            if (companiesError) throw companiesError
            if (!companies) {
                setPayrollRecords([])
                setLoading(false)
                return
            }

            // Fetch existing payroll records for this cycle
            const { data: existingRecords, error: existingError } = await supabase
                .from('company_payroll_records')
                .select('*')
                .eq('payroll_cycle_id', cycle.id)

            if (existingError) throw existingError

            // Create a map of existing records for quick lookup
            const recordMap = new Map()
            existingRecords?.forEach(record => {
                recordMap.set(record.company_id, record)
            })

            // Get company names for PIN checker details
            const companyNames = companies.map(company => company.company_name)

            // Fetch PIN details for companies
            const { data: pinData, error: pinError } = await supabase
                .from('PinCheckerDetails')
                .select('*')
                .in('company_name', companyNames)

            if (pinError) throw pinError

            // Create a map of PIN details for quick lookup
            const pinDetailsMap = (pinData || []).reduce((acc, detail) => {
                acc[detail.company_name] = detail
                return acc
            }, {} as Record<string, any>)

            // Combine all data to create complete records for UI display
            const displayRecords = companies.map(company => {
                // Get existing record if any
                const existingRecord = recordMap.get(company.id)

                // Find corresponding PIN details
                const pinDetails = pinDetailsMap[company.company_name] || null

                // Create a record object - if company exists in payroll_records, use that data
                // otherwise create a temporary display-only record
                return {
                    // Use existing record ID if available, otherwise use temporary ID
                    id: existingRecord?.id || `temp_${company.id}`,
                    company_id: company.id,
                    payroll_cycle_id: cycle.id,
                    // Use existing data or set defaults
                    documents: existingRecord?.documents || {},
                    status: existingRecord?.status || {
                        finalization_date: null,
                        assigned_to: null,
                        filing: null
                    },
                    number_of_employees: existingRecord?.number_of_employees || 0,
                    // Include the full company object and pin details
                    company: company,
                    pin_details: pinDetails,
                    // Flag to know if this is a real record or just for display
                    is_temporary: !existingRecord
                }
            })

            setPayrollRecords(displayRecords)
        } catch (error) {
            console.error('Fetch error:', error)
            toast({
                title: 'Error',
                description: 'Failed to initialize payroll cycle',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }, [selectedMonthYear, searchTerm, toast])

    const fetchPayrollRecords = async (cycleId: string) => {
        try {
            setLoading(true)

            // Get all companies first (this shows all companies regardless of payroll records)
            const { data: companiesData, error: companiesError } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .ilike('company_name', `%${searchTerm}%`)

            if (companiesError) throw companiesError
            if (!companiesData) {
                setPayrollRecords([])
                setLoading(false)
                return
            }

            // Create company lookup map
            const companyMap = companiesData.reduce((map, company) => {
                map[company.id] = company
                return map
            }, {})

            // Fetch existing payroll records for this cycle
            const { data: recordsData, error: recordsError } = await supabase
                .from('company_payroll_records')
                .select('*')
                .eq('payroll_cycle_id', cycleId)

            if (recordsError) throw recordsError

            // Create a map of existing records by company ID
            const recordMap = new Map()
            recordsData?.forEach(record => {
                recordMap.set(record.company_id, record)
            })

            // Get all company names for PIN details
            const companyNames = companiesData.map(company => company.company_name)

            // Fetch PIN details
            const { data: pinData, error: pinError } = await supabase
                .from('PinCheckerDetails')
                .select('*')
                .in('company_name', companyNames)

            if (pinError) throw pinError

            // Create PIN details lookup map
            const pinDetailsMap = (pinData || []).reduce((map, detail) => {
                map[detail.company_name] = detail
                return map
            }, {})

            // Create complete records for display - for ALL companies
            const completeRecords = companiesData.map(company => {
                // Find existing record if any
                const record = recordMap.get(company.id)

                // Find PIN details
                const pinDetails = pinDetailsMap[company.company_name] || null

                // Create record object
                return {
                    id: record?.id || `temp_${company.id}`,
                    company_id: company.id,
                    payroll_cycle_id: cycleId,
                    // Use existing data or set defaults with proper structure
                    documents: record?.documents || {
                        paye_csv: null,
                        hslevy_csv: null,
                        zip_file_kra: null,
                        shif_exl: null,
                        nssf_exl: null,
                    },
                    status: record?.status || {
                        finalization_date: null,
                        assigned_to: null,
                        filing: null
                    },
                    number_of_employees: record?.number_of_employees || 0,
                    // Include full objects
                    company: company,
                    pin_details: pinDetails,
                    // Flag to know if this is a real record or just for display
                    is_temporary: !record
                }
            })

            setPayrollRecords(completeRecords)
        } catch (error) {
            console.error('Fetch error:', error)
            toast({
                title: 'Error',
                description: 'Failed to fetch payroll records',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const handleDocumentUpload = async (
        recordId: string,
        file: File,
        documentType: DocumentType,
        subFolder: string
    ) => {
        try {
            // Find the record in our state
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) return

            // If this is a temporary record, we need to create a real record first
            let realRecordId = recordId

            if (record.is_temporary) {
                // Create a new record in the database
                const { data: newRecord, error: insertError } = await supabase
                    .from('company_payroll_records')
                    .insert([
                        {
                            company_id: record.company_id,
                            payroll_cycle_id: record.payroll_cycle_id,
                            documents: {},
                            status: {
                                finalization_date: null,
                                assigned_to: null,
                                filing: null
                            },
                            number_of_employees: 0
                        }
                    ])
                    .select()
                    .single()

                if (insertError) throw insertError
                realRecordId = newRecord.id

                // Update our record with the real ID
                record.id = realRecordId
                record.is_temporary = false
            }

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
                .eq('id', realRecordId)
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
                .eq('id', realRecordId)

            if (updateError) throw updateError

            // Update employee count if this is a PAYE CSV
            if (documentType === 'paye_csv') {
                const text = await file.text()
                const rows = text.split('\n')
                const employeeCount = rows.length // Subtract 1 for header row if needed

                // Update record with employee count
                const { error: updateError } = await supabase
                    .from('company_payroll_records')
                    .update({
                        number_of_employees: employeeCount
                    })
                    .eq('id', realRecordId)

                if (updateError) throw updateError
            }

            // Refresh the data
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

            // If this is a temporary record, we can't delete anything
            if (record.is_temporary) {
                toast({
                    title: 'Error',
                    description: 'Cannot delete document from an unfinalized record',
                    variant: 'destructive'
                })
                return
            }

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

            // If this is a temporary record, create a real record first
            let realRecordId = recordId

            if (record.is_temporary) {
                // Create a new record in the database
                const { data: newRecord, error: insertError } = await supabase
                    .from('company_payroll_records')
                    .insert([
                        {
                            company_id: record.company_id,
                            payroll_cycle_id: record.payroll_cycle_id,
                            documents: {},
                            status: {
                                finalization_date: null,
                                assigned_to: null,
                                filing: null
                            },
                            number_of_employees: 0
                        }
                    ])
                    .select()
                    .single()

                if (insertError) throw insertError
                realRecordId = newRecord.id

                // Update our record with the real ID
                record.id = realRecordId
                record.is_temporary = false
            }

            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    status: {
                        ...record.status,
                        ...statusUpdate
                    }
                })
                .eq('id', realRecordId)

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

    const updateExistingEmployeeCounts = async () => {
        try {
            // First get the current cycle ID
            const { data: cycle, error: cycleError } = await supabase
                .from('payroll_cycles')
                .select('id')
                .eq('month_year', selectedMonthYear)
                .single()

            if (cycleError) throw cycleError
            if (!cycle) {
                toast({
                    title: 'No Cycle Found',
                    description: 'No payroll cycle exists for the selected month',
                    variant: 'destructive'
                })
                return
            }

            // Get ONLY existing records for current cycle
            const { data: records, error } = await supabase
                .from('company_payroll_records')
                .select('*')
                .eq('payroll_cycle_id', cycle.id)

            if (error) throw error

            if (records && records.length > 0) {
                const updates = await Promise.all(records.map(async (record) => {
                    try {
                        // Check if PAYE CSV exists
                        if (!record.documents?.paye_csv) {
                            // No PAYE CSV, set to 0
                            await supabase
                                .from('company_payroll_records')
                                .update({ number_of_employees: 0 })
                                .eq('id', record.id)
                            return { recordId: record.id, employeeCount: 0, success: true }
                        }

                        const { data: fileData, error: downloadError } = await supabase.storage
                            .from('Payroll-Cycle')
                            .download(record.documents.paye_csv)

                        if (downloadError) {
                            // Failed to download, set to 0
                            await supabase
                                .from('company_payroll_records')
                                .update({ number_of_employees: 0 })
                                .eq('id', record.id)
                            return { recordId: record.id, employeeCount: 0, success: true }
                        }

                        // Determine file type
                        const filePath = record.documents.paye_csv
                        const fileExt = filePath.split('.').pop().toLowerCase()

                        let employeeCount = 0

                        if (fileExt === 'csv') {
                            // Handle CSV file - No header row, so count all rows
                            const text = await fileData.text()
                            const rows = text.split('\n').filter(row => row.trim())
                            employeeCount = rows.length // Count all rows as they're all employee data
                        } else if (['xls', 'xlsx'].includes(fileExt)) {
                            // For Excel files, set to 1 as placeholder
                            employeeCount = 1
                        } else {
                            // Unknown file type, set to 0
                            employeeCount = 0
                        }

                        await supabase
                            .from('company_payroll_records')
                            .update({ number_of_employees: employeeCount })
                            .eq('id', record.id)

                        return {
                            recordId: record.id,
                            employeeCount,
                            success: true
                        }
                    } catch (error) {
                        // On any error, set to 0
                        await supabase
                            .from('company_payroll_records')
                            .update({ number_of_employees: 0 })
                            .eq('id', record.id)

                        return {
                            recordId: record.id,
                            employeeCount: 0,
                            success: true
                        }
                    }
                }))

                await fetchPayrollRecords(cycle.id)

                toast({
                    title: 'Update Complete',
                    description: `Updated employee counts for ${updates.length} records`,
                    variant: 'default'
                })
            } else {
                toast({
                    title: 'No Updates Needed',
                    description: 'No records found for the current cycle',
                    variant: 'default'
                })
            }
        } catch (error) {
            console.error('Error updating existing employee counts:', error)
            toast({
                title: 'Error',
                description: 'Failed to update employee counts',
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
        handleStatusUpdate,
        updateExistingEmployeeCounts
    }
}