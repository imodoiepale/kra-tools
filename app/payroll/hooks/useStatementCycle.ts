// @ts-nocheck
import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

export const useStatementCycle = () => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(false)
    const [statementCycleId, setStatementCycleId] = useState<string | null>(null)
    
    const { toast } = useToast()

    const selectedMonthYear = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`

    const fetchOrCreateStatementCycle = useCallback(async () => {
        setLoading(true)
        try {
            // Use upsert with onConflict to ensure uniqueness
            const { data: cycle, error } = await supabase
                .from('statement_cycles')
                .upsert(
                    {
                        month_year: selectedMonthYear,
                        status: 'active',
                        created_at: new Date().toISOString()
                    },
                    {
                        onConflict: 'month_year',
                        ignoreDuplicates: true // This ensures we don't update existing records
                    }
                )
                .select()
                .single()

            if (error) {
                throw error;
            }

            // If no cycle was returned from upsert (because it already existed)
            // fetch the existing one
            if (!cycle) {
                const { data: existingCycle, error: fetchError } = await supabase
                    .from('statement_cycles')
                    .select('*')
                    .eq('month_year', selectedMonthYear)
                    .single()

                if (fetchError) throw fetchError;

                setStatementCycleId(existingCycle.id);
                return existingCycle.id;
            }

            // Store the cycle ID
            setStatementCycleId(cycle.id);
            return cycle.id;
        } catch (error) {
            console.error('Failed to initialize statement cycle:', error);
            toast({
                title: 'Error',
                description: 'Failed to initialize statement cycle',
                variant: 'destructive'
            });
            return null;
        } finally {
            setLoading(false);
        }
    }, [selectedMonthYear, toast]);

    // Function to get bank statements for the current cycle
    const fetchBankStatements = async (cycleId: string, filters = {}) => {
        try {
            // Build the query
            let query = supabase
                .from('acc_cycle_bank_statements')
                .select(`
                    *,
                    bank:acc_portal_banks(
                        id,
                        bank_name,
                        account_number,
                        bank_currency,
                        company_id,
                        company_name
                    )
                `)
                .eq('statement_cycle_id', cycleId)

            // Add search filter if provided
            if (searchTerm) {
                query = query.or(`bank.company_name.ilike.%${searchTerm}%,bank.bank_name.ilike.%${searchTerm}%`)
            }

            // Execute the query
            const { data, error } = await query

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error fetching bank statements:', error)
            toast({
                title: 'Error',
                description: 'Failed to load bank statements',
                variant: 'destructive'
            })
            return []
        }
    }

    // Function to update bank statement
    const updateBankStatement = async (statementId: string, updateData: any) => {
        try {
            const { data, error } = await supabase
                .from('acc_cycle_bank_statements')
                .update(updateData)
                .eq('id', statementId)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error updating bank statement:', error)
            toast({
                title: 'Error',
                description: 'Failed to update bank statement',
                variant: 'destructive'
            })
            return null
        }
    }

    // Function to handle document upload to Statement-Cycle storage
    const uploadStatementDocument = async (file: File, path: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('Statement-Cycle')
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: true
                })

            if (error) throw error
            return data.path
        } catch (error) {
            console.error('Error uploading document:', error)
            toast({
                title: 'Error',
                description: 'Failed to upload document',
                variant: 'destructive'
            })
            return null
        }
    }

    // Function to delete a document from storage
    const deleteStatementDocument = async (path: string) => {
        try {
            const { error } = await supabase.storage
                .from('Statement-Cycle')
                .remove([path])

            if (error) throw error
            return true
        } catch (error) {
            console.error('Error deleting document:', error)
            toast({
                title: 'Error',
                description: 'Failed to delete document',
                variant: 'destructive'
            })
            return false
        }
    }

    // Function to fetch banks
    const fetchBanks = async (filters = {}) => {
        try {
            let query = supabase
                .from('acc_portal_banks')
                .select('*')
                .not('company_id', 'is', null) // Ensure company_id is not null
                .order('company_name', { ascending: true }) // Order by company name

            if (searchTerm) {
                query = query.or(`company_name.ilike.%${searchTerm}%,bank_name.ilike.%${searchTerm}%`)
            }

            const { data, error } = await query
            if (error) throw error

            // Filter out any banks that might have null company_id (double check)
            const validBanks = data?.filter(bank => bank.company_id !== null) || []
            
            return validBanks
        } catch (error) {
            console.error('Error fetching banks:', error)
            toast({
                title: 'Error',
                description: 'Failed to load bank data',
                variant: 'destructive'
            })
            return []
        }
    }

    // Function to get bank statement statistics
    const fetchStatementStats = async (cycleId: string) => {
        try {
            // Get total banks count
            const { data: banksData, error: banksError } = await supabase
                .from('acc_portal_banks')
                .select('id', { count: 'exact' })

            if (banksError) throw banksError

            // Get statements for the current cycle
            const { data: statements, error: statementsError } = await supabase
                .from('acc_cycle_bank_statements')
                .select(`
                    id, 
                    statement_document, 
                    statement_extractions,
                    quickbooks_balance
                `)
                .eq('statement_cycle_id', cycleId)

            if (statementsError) throw statementsError

            // Calculate stats
            const statementsUploaded = statements?.filter(s => 
                s.statement_document?.statement_pdf !== null
            ).length || 0

            const reconciled = statements?.filter(s =>
                s.statement_extractions?.closing_balance !== null &&
                s.quickbooks_balance !== null &&
                Math.abs(s.statement_extractions.closing_balance - s.quickbooks_balance) < 0.01
            ).length || 0

            const mismatches = statements?.filter(s =>
                s.statement_extractions?.closing_balance !== null &&
                s.quickbooks_balance !== null &&
                Math.abs(s.statement_extractions.closing_balance - s.quickbooks_balance) >= 0.01
            ).length || 0

            return {
                totalBanks: banksData?.length || 0,
                statementsUploaded,
                reconciled,
                mismatches
            }
        } catch (error) {
            console.error('Error fetching statement stats:', error)
            toast({
                title: 'Error',
                description: 'Failed to load bank statement statistics',
                variant: 'destructive'
            })
            return {
                totalBanks: 0,
                statementsUploaded: 0,
                reconciled: 0,
                mismatches: 0
            }
        }
    }

    return {
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        searchTerm,
        setSearchTerm,
        loading,
        statementCycleId,
        fetchOrCreateStatementCycle,
        fetchBankStatements,
        updateBankStatement,
        uploadStatementDocument,
        deleteStatementDocument,
        fetchBanks,
        fetchStatementStats
    }
}