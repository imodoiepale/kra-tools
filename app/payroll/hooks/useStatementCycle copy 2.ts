// @ts-nocheck
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

/**
 * A centralized hook to manage all data interactions for the Bank Statement Reconciliation cycle.
 * This version is aligned with the provided database schema and calculates stats client-side.
 */
export const useStatementCycle = () => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const getOrCreateStatementCycle = useCallback(async (year: number, month: number): Promise<string | null> => {
        const monthYearStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;
        
        try {
            // First, try to get the existing cycle
            const { data: existingCycle, error: fetchError } = await supabase
                .from('statement_cycles')
                .select('id')
                .eq('month_year', monthYearStr)
                .maybeSingle();

            if (existingCycle) return existingCycle.id;
            
            // If we get here, no cycle exists yet - try to create one
            try {
                const { data: newCycle, error: createError } = await supabase
                    .from('statement_cycles')
                    .insert({ 
                        month_year: monthYearStr, 
                        status: 'active',
                        created_at: new Date().toISOString()
                    })
                    .select('id')
                    .single();
                    
                if (newCycle) return newCycle.id;
                if (createError) throw createError;
                
            } catch (createError) {
                // If we get a unique constraint violation, it means another request created the cycle
                if (createError.code === '23505') { // Unique violation
                    // Try to fetch the cycle that was just created by another request
                    const { data: cycle, error: refetchError } = await supabase
                        .from('statement_cycles')
                        .select('id')
                        .eq('month_year', monthYearStr)
                        .single();
                    
                    if (cycle) return cycle.id;
                    if (refetchError) throw refetchError;
                }
                throw createError;
            }
            
            return null;
            
        } catch (error) {
            console.error('Failed to get or create statement cycle:', error);
            // Only show error toast if it's not a unique constraint violation
            if (error.code !== '23505') {
                toast({ 
                    title: 'Cycle Initialization Error', 
                    description: `Could not initialize the statement cycle for ${monthYearStr}.`,
                    variant: 'destructive' 
                });
            }
            return null;
        }
    }, [toast]);

    const fetchInitialData = useCallback(async (year: number, month: number) => {
        setLoading(true);
        try {
            const cycleId = await getOrCreateStatementCycle(year, month);
            if (!cycleId) return { stats: null, banks: [], cycleId: null };

            const [banksRes, statementsRes] = await Promise.all([
                supabase.from('acc_portal_banks').select('*', { count: 'exact' }),
                supabase.from('acc_cycle_bank_statements').select('statement_extractions, status').eq('statement_cycle_id', cycleId)
            ]);

            if (banksRes.error) throw banksRes.error;
            if (statementsRes.error) throw statementsRes.error;

            const statements = statementsRes.data || [];
            const totalBanks = banksRes.count || 0;

            const calculatedStats = statements.reduce((acc, statement) => {
                const closingBal = parseFloat(statement.statement_extractions?.closing_balance);
                // Correctly access quickbooks_balance from the status JSONB
                const qbBal = parseFloat(statement.status?.quickbooks_balance);

                if (!isNaN(closingBal) && !isNaN(qbBal)) {
                    if (Math.abs(closingBal - qbBal) <= 0.01) {
                        acc.reconciled++;
                    } else {
                        acc.mismatches++;
                    }
                }
                return acc;
            }, { reconciled: 0, mismatches: 0 });

            const finalStats = {
                total_banks: totalBanks,
                statements_uploaded: statements.length,
                reconciled: calculatedStats.reconciled,
                mismatches: calculatedStats.mismatches,
            };

            return {
                stats: finalStats,
                banks: banksRes.data || [],
                cycleId: cycleId
            };
        } catch (error) {
            console.error('Failed to fetch initial data:', error);
            toast({ title: 'Data Fetch Error', description: 'Failed to fetch initial page data.', variant: 'destructive' });
            return { stats: null, banks: [], cycleId: null };
        } finally {
            setLoading(false);
        }
    }, [getOrCreateStatementCycle, toast]);

    const fetchCoreData = useCallback(async (cycleId: string) => {
        if (!cycleId) return { companies: [], banks: [], statements: [] };
        setLoading(true);
        try {
            const [companiesRes, banksRes, statementsRes] = await Promise.all([
                supabase.from('acc_portal_company_duplicate').select('*'),
                supabase.from('acc_portal_banks').select('*'),
                supabase.from('acc_cycle_bank_statements').select('*').eq('statement_cycle_id', cycleId)
            ]);

            if (companiesRes.error) throw companiesRes.error;
            if (banksRes.error) throw banksRes.error;
            if (statementsRes.error) throw statementsRes.error;

            return {
                companies: companiesRes.data || [],
                banks: banksRes.data || [],
                statements: statementsRes.data || [],
            };
        } catch (error) {
            toast({ title: 'Data Fetch Error', description: 'Failed to fetch reconciliation table data.', variant: 'destructive' });
            return { companies: [], banks: [], statements: [] };
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const deleteStatement = useCallback(async (statement) => {
        if (!statement?.id) return false;
        setLoading(true);
        try {
            const filesToRemove: string[] = [];
            if (statement.statement_document?.statement_pdf) filesToRemove.push(statement.statement_document.statement_pdf);
            if (statement.statement_document?.statement_excel) filesToRemove.push(statement.statement_document.statement_excel);

            if (filesToRemove.length > 0) {
                await supabase.storage.from('Statement-Cycle').remove(filesToRemove);
            }

            const { error } = await supabase.from('acc_cycle_bank_statements').delete().eq('id', statement.id);
            if (error) throw error;

            toast({ title: 'Success', description: 'Bank statement deleted successfully.' });
            return true;
        } catch (error) {
            console.error('Error deleting statement:', error);
            toast({ title: 'Deletion Error', description: 'Failed to delete the bank statement.', variant: 'destructive' });
            return false;
        } finally {
            setLoading(false);
        }
    }, [toast]);

    return {
        loading,
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        searchTerm,
        setSearchTerm,
        getOrCreateStatementCycle,
        fetchInitialData,
        fetchCoreData,
        deleteStatement,
    };
};