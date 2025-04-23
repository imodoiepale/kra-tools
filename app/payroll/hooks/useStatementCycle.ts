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
        setLoading(true);
        try {
            console.log('Upserting statement cycle for:', selectedMonthYear);

            // Use upsert operation with "on conflict" handling
            const { data: cycle, error: upsertError } = await supabase
                .from('statement_cycles')
                .upsert({
                    month_year: selectedMonthYear,
                    status: 'active',
                    created_at: new Date().toISOString()
                }, {
                    onConflict: 'month_year',  // Specify the conflict column
                    ignoreDuplicates: true     // Skip update if the row already exists
                })
                .select();

            // If upsert didn't return data (because it was ignored), fetch the existing record
            if ((!cycle || cycle.length === 0) && !upsertError) {
                console.log('Upsert ignored duplicate, fetching existing cycle');
                const { data: existingCycle, error: fetchError } = await supabase
                    .from('statement_cycles')
                    .select('*')
                    .eq('month_year', selectedMonthYear)
                    .single();

                if (fetchError) {
                    console.error('Error fetching existing cycle:', fetchError);
                    throw fetchError;
                }

                console.log('Found existing cycle:', existingCycle);
                setStatementCycleId(existingCycle.id);
                return existingCycle.id;
            }

            if (upsertError) {
                console.error('Error upserting cycle:', upsertError);
                throw upsertError;
            }

            // If the upsert returned data, use the first record
            if (cycle && cycle.length > 0) {
                const createdCycle = cycle[0];
                console.log('Successfully upserted cycle:', createdCycle);
                setStatementCycleId(createdCycle.id);
                return createdCycle.id;
            }

            throw new Error('Failed to create or find cycle: No data returned');
        } catch (error) {
            console.error('Failed to initialize statement cycle:',
                error?.message ? { message: error.message, details: error.details, code: error.code } : error);
            const errorMessage = error?.message || error?.details || JSON.stringify(error) || 'Unknown error';
            toast({
                title: 'Error',
                description: `Failed to initialize statement cycle: ${errorMessage}`,
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
            console.log('Fetching bank statements for cycle:', cycleId);
            
            // Build the query based on the actual database schema
            let query = supabase
                .from('acc_cycle_bank_statements')
                .select(`
                    id, 
                    statement_cycle_id,
                    company_id,
                    bank_id,
                    statement_document, 
                    validation_status,
                    has_soft_copy,
                    status,
                    created_at,
                    bank:acc_portal_banks(
                        id,
                        bank_name,
                        account_number,
                        bank_currency,
                        company_id,
                        company_name,
                        acc_password
                    )
                `)
                .eq('statement_cycle_id', cycleId)

            // Add search filter if provided
            if (searchTerm) {
                query = query.or(`bank.company_name.ilike.%${searchTerm}%,bank.bank_name.ilike.%${searchTerm}%`)
            }

            // Execute the query
            const { data, error } = await query

            if (error) {
                console.error('Error fetching statements:', error);
                throw error;
            }
            
            console.log(`Found ${data?.length || 0} statements for cycle ${cycleId}`);
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
        if (!cycleId) {
            console.log('No cycle ID provided to fetchStatementStats');
            return {
                totalBanks: 0,
                statementsUploaded: 0,
                reconciled: 0,
                mismatches: 0
            };
        }
        
        try {
            console.log('Fetching statement stats for cycle:', cycleId);
            
            // Get total banks count
            const { data: banksData, error: banksError } = await supabase
                .from('acc_portal_banks')
                .select('id', { count: 'exact' });

            if (banksError) {
                console.error('Error fetching banks data:', banksError);
                throw banksError;
            }

            // Get simplified statements data - using only fields we know exist based on the database schema
            const { data: statements, error: statementsError } = await supabase
                .from('acc_cycle_bank_statements')
                .select(`
                    id, 
                    statement_document,
                    validation_status,
                    has_soft_copy, 
                    bank_id,
                    company_id
                `)
                .eq('statement_cycle_id', cycleId);

            if (statementsError) {
                console.error('Error fetching statements:', statementsError);
                throw statementsError;
            }

            console.log(`Found ${statements?.length || 0} statements for cycle ${cycleId}`);
            
            // Calculate statement upload status - checking for document presence
            const statementsUploaded = statements?.filter(s => 
                s?.statement_document?.statement_pdf !== null || 
                s?.statement_document?.statement_excel !== null
            ).length || 0;

            // For reconciliation stats, we'll simplify since the exact schema for balance tracking isn't visible
            // Using validation_status for reconciliation information
            const reconciled = statements?.filter(s => {
                return s?.validation_status?.is_validated === true;
            }).length || 0;

            // For mismatches, count statements that have validation issues
            const mismatches = statements?.filter(s => {
                return s?.validation_status?.mismatches && 
                       Array.isArray(s?.validation_status?.mismatches) && 
                       s?.validation_status?.mismatches.length > 0;
            }).length || 0;

            const stats = {
                totalBanks: banksData?.length || 0,
                statementsUploaded,
                reconciled,
                mismatches
            };
            
            console.log('Generated stats:', stats);
            return stats;
            
        } catch (error) {
            console.error('Error fetching statement stats:', error);
            const errorMessage = error?.message || error?.details || JSON.stringify(error) || 'Unknown error';
            toast({
                title: 'Error',
                description: `Failed to load bank statement statistics: ${errorMessage}`,
                variant: 'destructive'
            });
            return {
                totalBanks: 0,
                statementsUploaded: 0,
                reconciled: 0,
                mismatches: 0
            };
        }
    }

    const createStatementCyclesForPeriod = async (statementPeriod: string) => {
        try {
            const periodDates = parseStatementPeriod(statementPeriod);
            if (!periodDates) return [];

            const { startMonth, startYear, endMonth, endYear } = periodDates;
            const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

            const createdCycles = [];

            for (const { month, year } of monthsInRange) {
                const monthStr = (month + 1).toString().padStart(2, '0');
                const cycleMonthYear = `${year}-${monthStr}`;

                // First check if the cycle already exists
                const { data: existingCycles, error: checkError } = await supabase
                    .from('statement_cycles')
                    .select('*')
                    .eq('month_year', cycleMonthYear);

                if (checkError) {
                    console.error(`Error checking for existing cycle ${cycleMonthYear}:`, checkError);
                    continue;
                }

                // If cycle exists, use it
                if (existingCycles && existingCycles.length > 0) {
                    createdCycles.push(existingCycles[0]);
                    continue;
                }

                // If cycle doesn't exist, create it
                const { data: newCycle, error: insertError } = await supabase
                    .from('statement_cycles')
                    .insert({
                        month_year: cycleMonthYear,
                        status: 'active',
                        created_at: new Date().toISOString()
                    })
                    .select();

                if (insertError) {
                    console.error(`Cycle creation error for ${cycleMonthYear}:`, insertError);
                    continue;
                }

                if (newCycle && newCycle.length > 0) {
                    createdCycles.push(newCycle[0]);
                }
            }

            return createdCycles;
        } catch (error) {
            console.error('Statement cycle creation error:', error);
            return [];
        }
    };


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
        createStatementCyclesForPeriod,
        fetchBankStatements,
        updateBankStatement,
        uploadStatementDocument,
        deleteStatementDocument,
        fetchBanks,
        fetchStatementStats
    }
}