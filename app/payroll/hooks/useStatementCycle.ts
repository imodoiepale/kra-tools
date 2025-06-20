// app/payroll/hooks/useStatementCycle.ts
// @ts-nocheck
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export const useStatementCycle = () => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const getOrCreateStatementCycle = useCallback(async (year: number, month: number): Promise<string | null> => {
        const monthYearStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;

        try {
            const { data: existingCycle, error: fetchError } = await supabase
                .from('statement_cycles')
                .select('id')
                .eq('month_year', monthYearStr)
                .maybeSingle();

            if (existingCycle) return existingCycle.id;

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
                if (createError.code === '23505') {
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
                supabase.from('acc_cycle_bank_statements').select('statement_extractions, status, statement_type').eq('statement_cycle_id', cycleId)
            ]);

            if (banksRes.error) throw banksRes.error;
            if (statementsRes.error) throw statementsRes.error;

            const statements = statementsRes.data || [];
            const totalBanks = banksRes.count || 0;

            const calculatedStats = statements.reduce((acc, statement) => {
                const closingBal = parseFloat(statement.statement_extractions?.closing_balance);
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
        if (!cycleId) return { companies: [], banks: [], statements: [], banksWithMultipleTypes: [] };
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

            const statements = statementsRes.data || [];
            const banksWithMultipleTypes = identifyBanksWithMultipleTypes(statements);

            return {
                companies: companiesRes.data || [],
                banks: banksRes.data || [],
                statements: statements,
                banksWithMultipleTypes
            };
        } catch (error) {
            toast({ title: 'Data Fetch Error', description: 'Failed to fetch reconciliation table data.', variant: 'destructive' });
            return { companies: [], banks: [], statements: [], banksWithMultipleTypes: [] };
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const identifyBanksWithMultipleTypes = useCallback((statements: any[]) => {
        const bankGroups = new Map();
        const banksWithMultipleTypes = [];

        statements.forEach(statement => {
            const bankId = statement.bank_id;

            if (!bankGroups.has(bankId)) {
                bankGroups.set(bankId, {
                    bankId,
                    monthly: null,
                    range: null,
                    allStatements: []
                });
            }

            const group = bankGroups.get(bankId);
            group.allStatements.push(statement);

            if (statement.statement_type === 'monthly') {
                group.monthly = statement;
            } else if (statement.statement_type === 'range') {
                group.range = statement;
            }

            bankGroups.set(bankId, group);
        });

        bankGroups.forEach((group, bankId) => {
            if (group.monthly && group.range) {
                banksWithMultipleTypes.push({
                    bankId,
                    monthly: group.monthly,
                    range: group.range,
                    hasMultipleTypes: true
                });
            }
        });

        return banksWithMultipleTypes;
    }, []);

    const fetchStatementsWithTypes = useCallback(async (cycleId: string) => {
        if (!cycleId) return { statements: [], banksWithMultipleTypes: [] };

        try {
            const { data: statements, error } = await supabase
                .from('acc_cycle_bank_statements')
                .select(`
                    *,
                    acc_portal_banks!inner(*)
                `)
                .eq('statement_cycle_id', cycleId)
                .order('statement_type', { ascending: true });

            if (error) throw error;

            const banksWithMultipleTypes = identifyBanksWithMultipleTypes(statements || []);

            return {
                statements: statements || [],
                banksWithMultipleTypes
            };

        } catch (error) {
            console.error('Error fetching statements with types:', error);
            throw error;
        }
    }, [identifyBanksWithMultipleTypes]);

    const getStatementByType = useCallback(async (
        bankId: number,
        cycleId: string,
        statementType: 'monthly' | 'range'
    ) => {
        const { data, error } = await supabase
            .from('acc_cycle_bank_statements')
            .select('*')
            .eq('bank_id', bankId)
            .eq('statement_cycle_id', cycleId)
            .eq('statement_type', statementType)
            .maybeSingle();

        if (error) throw error;
        return data;
    }, []);

    const checkBankStatementTypes = useCallback(async (bankId: number, cycleId: string) => {
        const { data, error } = await supabase
            .from('acc_cycle_bank_statements')
            .select('statement_type')
            .eq('bank_id', bankId)
            .eq('statement_cycle_id', cycleId);

        if (error) throw error;

        const types = data?.map(s => s.statement_type) || [];
        return {
            hasMonthly: types.includes('monthly'),
            hasRange: types.includes('range'),
            hasMultipleTypes: types.length > 1,
            types
        };
    }, []);

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
        fetchStatementsWithTypes,
        getStatementByType,
        checkBankStatementTypes,
        identifyBanksWithMultipleTypes,
        deleteStatement,
    };
};