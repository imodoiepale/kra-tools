// app/portal/payroll/PayrollManagement.tsx
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CompanyPayrollRecord, DocumentType } from './types'
import { PayrollTable } from './components/PayrollTable'
import { MonthYearSelector } from './components/MonthYearSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

export default function PayrollManagement() {
    const [payrollRecords, setPayrollRecords] = useState<CompanyPayrollRecord[]>([])
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    const selectedMonthYear = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`

    const fetchOrCreatePayrollCycle = async () => {
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
    }

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
        documentType: DocumentType
    ) => {
        try {
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) return

            const fileName = `${documentType}_${record.company.company_name}_${format(new Date(), 'yyyy-MM-dd')}`
            const filePath = `${selectedMonthYear}/${record.company.company_name}/${fileName}`

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('Payroll-Cycle')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    documents: {
                        ...record.documents,
                        [documentType]: uploadData.path
                    }
                })
                .eq('id', recordId)

            if (updateError) throw updateError

            await fetchPayrollRecords(record.payroll_cycle_id)
            toast({
                title: 'Success',
                description: 'Document uploaded successfully'
            })
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to upload document',
                variant: 'destructive'
            })
        }
    }

    const handleDocumentDelete = async (recordId: string, documentType: DocumentType) => {
        try {
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) return

            const documentPath = record.documents[documentType]
            if (!documentPath) return

            const { error: deleteError } = await supabase.storage
                .from('Payroll-Cycle')
                .remove([documentPath])

            if (deleteError) throw deleteError

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    documents: {
                        ...record.documents,
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

    useEffect(() => {
        fetchOrCreatePayrollCycle()
    }, [selectedYear, selectedMonth, searchTerm])

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <MonthYearSelector
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    onYearChange={setSelectedYear}
                    onMonthChange={setSelectedMonth}
                />
                <div className="flex gap-4">
                    <Input
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64"
                    />
                    <Button variant="outline">Export</Button>
                    <Button variant="outline">Extract All</Button>
                </div>
            </div>

            <PayrollTable
                records={payrollRecords}
                onDocumentUpload={handleDocumentUpload}
                onDocumentDelete={handleDocumentDelete}
                onStatusUpdate={handleStatusUpdate}
                loading={loading}
            />
        </div>
    )
}