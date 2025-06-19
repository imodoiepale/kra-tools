// @ts-nocheck
"use client"

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    parseStatementPeriod,
    generateMonthRange,
    generateCompleteMonthRange
} from '@/lib/bankExtractionUtils';
import { useStatementCycle } from '@/app/payroll/hooks/useStatementCycle';
import { AlertTriangle, Trash,Plus,X, Loader2,CheckCircle,Check,Calendar,XCircle,Save } from 'lucide-react';

// --- Interface Definitions ---

interface ValidationStatus {
    is_validated: boolean;
    validation_date: string | null;
    validated_by: string | null;
    mismatches: string[];
}

interface MonthlyBalance {
    month: number; // 1-indexed for consistency with generateMonthRange
    year: number;
    closing_balance: number | null; // Can be null for empty input
    opening_balance: number | null; // Can be null for empty input
    statement_page: number;
    closing_date: string | null;
    is_verified: boolean;
    verified_by: string | null;
    verified_at: string | null;
    highlight_coordinates?: { x1: number; y1: number; x2: number; y2: number; page: number; } | null;
}

interface BankStatementExtraction {
    bank_name: string | null;
    account_number: string | null;
    currency: string | null;
    statement_period: string | null;
    opening_balance: number | null;
    closing_balance: number | null;
    monthly_balances: MonthlyBalance[];
    total_pages?: number;
}

interface BankStatement {
    id: string;
    bank_id: number;
    statement_month: number; // 0-indexed month (for DB column)
    statement_year: number;
    quickbooks_balance: number | null;
    statement_document: {
        statement_pdf: string | null;
        statement_excel: string | null;
        document_size?: number;
        document_type?: string;
    };
    statement_extractions: BankStatementExtraction;
    has_soft_copy: boolean;
    has_hard_copy: boolean;
    validation_status: ValidationStatus;
    status: {
        status: string;
        assigned_to: string | null;
        verification_date: string | null;
        quickbooks_balance?: number | null;
    };
}

interface Bank {
    id: number;
    bank_name: string;
    account_number: string;
    bank_currency: string;
    company_id: number;
    company_name: string;
}

interface BankExtractionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    bank: Bank;
    statement: BankStatement;
    onStatementUpdated: (statement: BankStatement | null) => void;
    onStatementDeleted?: (statementId: string) => void;
}

// --- Main Component ---
export default function BankExtractionDialog({
    isOpen,
    onClose,
    bank,
    statement,
    onStatementUpdated,
    onStatementDeleted
}: BankExtractionDialogProps) {
    const { getOrCreateStatementCycle, loading: cycleLoading, error: cycleError } = useStatementCycle();

    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [monthlyBalances, setMonthlyBalances] = useState<MonthlyBalance[]>([]);
    const [formData, setFormData] = useState({
        bank_name: '',
        account_number: '',
        currency: '',
        statementPeriod: '',
        quickbooks_balance: null as number | null,
    });
    const [activeTab, setActiveTab] = useState('overview');
    const [error, setError] = useState<Error | null>(null);
    const totalPages = statement.statement_extractions?.total_pages || 0;

    const [showUpdateConfirmation, setShowUpdateConfirmation] = useState(false);
    const [pendingUpdates, setPendingUpdates] = useState<{
        type: 'single-month' | 'multi-month';
        monthsInRange?: any[];
        cycleIds?: string[];
        extractionData: any;
        validationStatus: any;
        monthlyBalances: MonthlyBalance[];
        statementId?: string;
    } | null>(null);
    
    // --- Effects ---
    useEffect(() => {
        if (isOpen) {
            setError(null);
        }
    }, [isOpen]);

    // In BankExtractionDialog.tsx - Add at the top of the component
    useEffect(() => {
        console.log('BankExtractionDialog - Props received:', {
            isOpen,
            statement: statement ? {
                id: statement.id,
                extractions: statement.statement_extractions
            } : null,
            bank
        });
    }, [isOpen, statement, bank]);

    const parsedPeriod = useMemo(() => {
        if (formData.statementPeriod) {
            return parseStatementPeriod(formData.statementPeriod);
        }
        return null;
    }, [formData.statementPeriod]);

    const loadPdfDocument = useCallback(async () => {
        if (!statement?.statement_document?.statement_pdf) {
            setIsLoading(false);
            return;
        }
        try {
            const { data, error } = await supabase.storage
                .from('Statement-Cycle')
                .createSignedUrl(statement.statement_document.statement_pdf, 3600); // 1 hour validity
            if (error) throw error;
            setPdfUrl(data.signedUrl);
        } catch (error) {
            console.error('Error loading PDF:', error);
            toast({ title: 'Error', description: 'Failed to load PDF document', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [statement, toast]);

    const handleStatementRangeData = useCallback(async () => {
        try {
            const periodDates = parseStatementPeriod(formData.statementPeriod);
            if (!periodDates) {
                console.warn("Could not parse statement period:", formData.statementPeriod);
                return;
            }

            const { startMonth, startYear, endMonth, endYear } = periodDates;

            // Generate complete month range
            const completeMonthRange = generateCompleteMonthRange(
                startMonth,
                startYear,
                endMonth,
                endYear
            );

            // Merge with existing monthly balances
            const mergedBalances = completeMonthRange.map(rangeMonth => {
                const existingBalance = monthlyBalances.find(
                    b => b.month === rangeMonth.month && b.year === rangeMonth.year
                );
                return existingBalance || rangeMonth;
            });

            // Sort by year and month
            mergedBalances.sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.month - b.month;
            });

            // Update the monthly balances state
            setMonthlyBalances(mergedBalances);

            toast({
                description: `Loaded ${mergedBalances.length} months from the statement period`,
                variant: 'default'
            });

        } catch (error) {
            console.error('Error handling statement range data:', error);
            toast({
                title: 'Error',
                description: 'Failed to process statement period',
                variant: 'destructive'
            });
        }
    }, [formData.statementPeriod, monthlyBalances, toast]);

    useEffect(() => {
        if (isOpen && statement) {
            setIsLoading(true);

            const extractions = statement.statement_extractions || {};

            setFormData({
                bank_name: extractions.bank_name || '',
                account_number: extractions.account_number || '',
                currency: extractions.currency || '',
                statementPeriod: extractions.statement_period || ''
            });

            // Initialize monthly balances ONCE
            const initializeMonthlyBalances = () => {
                const extractedMonthlyBalances = extractions.monthly_balances || [];
                const statementPeriodString = extractions.statement_period;

                let compiledMonthlyBalances: MonthlyBalance[] = [];

                if (statementPeriodString) {
                    const period = parseStatementPeriod(statementPeriodString);
                    if (period) {
                        const allMonthsInPeriod = generateMonthRange(
                            period.startMonth,
                            period.startYear,
                            period.endMonth,
                            period.endYear
                        );

                        compiledMonthlyBalances = allMonthsInPeriod.map(monthInPeriod => {
                            const foundBalance = extractedMonthlyBalances.find(
                                eb => eb.month === monthInPeriod.month && eb.year === monthInPeriod.year
                            );

                            return foundBalance || {
                                month: monthInPeriod.month,
                                year: monthInPeriod.year,
                                closing_balance: null,
                                qb_balance: null, // FIXED: Add qb_balance field
                                statement_page: 0,
                                closing_date: null,
                                is_verified: false,
                                verified_by: null,
                                verified_at: null,
                                highlight_coordinates: null,
                            };
                        });
                    }
                } else {
                    // Single month fallback
                    compiledMonthlyBalances = [{
                        month: statement.statement_month + 1,
                        year: statement.statement_year,
                        closing_balance: extractions.closing_balance || null,
                        statement_page: 0,
                        closing_date: null,
                        is_verified: false,
                        verified_by: null,
                        verified_at: null,
                        highlight_coordinates: null,
                    }];
                }

                setMonthlyBalances(compiledMonthlyBalances);
            };

            initializeMonthlyBalances();
            loadPdfDocument();
        } else {
            setPdfUrl(null);
        }
    }, [isOpen, statement]);

    // Automatically handle range data when statement period changes
    // useEffect(() => {
    //     if (statement?.statement_extractions?.statement_period && isOpen) {
    //         const timer = setTimeout(() => {
    //             handleStatementRangeData();
    //         }, 500);
    //         return () => clearTimeout(timer);
    //     }
    // }, [statement?.statement_extractions?.statement_period, isOpen, handleStatementRangeData]);

    // --- Helper Functions ---
    const normalizeCurrencyCode = (code: string | null | undefined): string => {
        if (!code) return 'USD';
        const upperCode = code.toUpperCase().trim();
        const currencyMap: { [key: string]: string } = {
            'EURO': 'EUR', 'EUROS': 'EUR', 'US DOLLAR': 'USD', 'US DOLLARS': 'USD', 'USDOLLAR': 'USD',
            'POUND': 'GBP', 'POUNDS': 'GBP', 'STERLING': 'GBP', 'KENYA SHILLING': 'KES',
            'KENYA SHILLINGS': 'KES', 'KENYAN SHILLING': 'KES', 'KSH': 'KES', 'K.SH': 'KES',
            'KSHS': 'KES', 'K.SHS': 'KES', 'SH': 'KES'
        };
        return currencyMap[upperCode] || upperCode;
    };

    const formatFileSize = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    const formatNumberWithCommas = (value: string | number | null | undefined) => {
        if (value === '' || value === null || value === undefined) return '';
        const stringValue = String(value);
        const parts = stringValue.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    };

    const formatCurrency = (value: number | null | undefined, currency: string | null | undefined) => {
        if (value === null || value === undefined) return '-';
        const normalizedCurrency = normalizeCurrencyCode(currency);
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: normalizedCurrency }).format(value);
        } catch {
            return `${normalizedCurrency} ${formatNumberWithCommas(value)}`;
        }
    }

    // --- Validation & Data Update Functions ---
    const validateStatement = async (): Promise<boolean> => {
        setError(null);
        if (!statement) return false;

        setIsValidating(true);
        const mismatches: string[] = [];
        const extractions = statement.statement_extractions;

        try {
            if (!extractions?.bank_name || !extractions.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())) {
                mismatches.push(`Bank name does not match. Expected: ${bank.bank_name}, Found: ${extractions?.bank_name || 'Not found'}`);
            }
            if (!extractions?.account_number || !extractions.account_number.includes(bank.account_number)) {
                mismatches.push(`Account number does not match. Expected: ${bank.account_number}, Found: ${extractions?.account_number || 'Not found'}`);
            }
            if (!extractions?.currency || normalizeCurrencyCode(extractions.currency) !== normalizeCurrencyCode(bank.bank_currency)) {
                mismatches.push(`Currency does not match. Expected: ${bank.bank_currency}, Found: ${extractions?.currency || 'Not found'}`);
            }
            if (extractions.monthly_balances?.length === 0) {
                mismatches.push('No monthly balances extracted from the document.');
            }

            const updatedStatement = {
                ...statement,
                validation_status: {
                    is_validated: mismatches.length === 0,
                    validation_date: new Date().toISOString(),
                    validated_by: 'current_user_id',
                    mismatches
                }
            };

            const { error } = await supabase
                .from('acc_cycle_bank_statements')
                .update({ validation_status: updatedStatement.validation_status })
                .eq('id', statement.id);

            if (error) throw error;

            onStatementUpdated(updatedStatement);

            toast({
                title: mismatches.length === 0 ? 'Validation Successful' : 'Validation Completed with Issues',
                description: mismatches.length === 0 ? 'All validations passed.' : `Found ${mismatches.length} issue(s).`,
                variant: mismatches.length === 0 ? 'default' : 'destructive'
            });

            return mismatches.length === 0;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to validate statement');
            setError(error);
            toast({ title: 'Validation Error', description: error.message, variant: 'destructive' });
            return false;
        } finally {
            setIsValidating(false);
        }
    };

    // In BankExtractionDialog.tsx - Fix verifyBalance function
    const verifyBalance = async (balanceIndex: number): Promise<void> => {
        if (!monthlyBalances[balanceIndex]) return;

        setError(null);
        try {
            // Update local state first
            const updatedBalances = [...monthlyBalances];
            updatedBalances[balanceIndex] = {
                ...updatedBalances[balanceIndex],
                is_verified: true,
                verified_by: 'current_user_id',
                verified_at: new Date().toISOString()
            };

            // Update state immediately for UI responsiveness
            setMonthlyBalances(updatedBalances);

            // Update database
            const updatedExtractions = {
                ...statement.statement_extractions,
                monthly_balances: updatedBalances
            };

            const { error, data } = await supabase
                .from('acc_cycle_bank_statements')
                .update({ statement_extractions: updatedExtractions })
                .eq('id', statement.id)
                .select()
                .single();

            if (error) {
                // Revert local state on error
                setMonthlyBalances(monthlyBalances);
                throw error;
            }

            onStatementUpdated(data);

            toast({
                title: 'Balance Verified',
                description: 'The monthly balance has been verified successfully.'
            });
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to verify balance');
            setError(error);
            toast({
                title: 'Verification Failed',
                description: error.message,
                variant: 'destructive'
            });
        }
    };

    // --- Event Handlers ---
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // In BankExtractionDialog.tsx - Remove qb_balance handling
    const handleUpdateBalance = (index: number, field: string, value: string) => {
        const newBalances = [...monthlyBalances];
        const rawValue = String(value).replace(/,/g, '');
        newBalances[index] = {
            ...newBalances[index],
            [field]: field === 'closing_balance'
                ? (rawValue ? parseFloat(rawValue) : null)
                : value,
            is_verified: false // Reset verification when edited
        };
        setMonthlyBalances(newBalances);
    };

    const handleAddBalance = () => {
        const latestMonth = monthlyBalances.reduce((latest, current) => {
            const currentMonthDate = new Date(current.year, current.month - 1);
            const latestMonthDate = new Date(latest.year, latest.month - 1);
            return currentMonthDate > latestMonthDate ? current : latest;
        }, { month: statement.statement_month + 1, year: statement.statement_year });

        const nextDate = new Date(latestMonth.year, latestMonth.month);
        const newMonth = nextDate.getMonth() + 1;
        const newYear = nextDate.getFullYear();

        if (monthlyBalances.some(b => b.month === newMonth && b.year === newYear)) {
            toast({ description: `Balance for ${format(new Date(newYear, newMonth - 1), 'MMMM yyyy')} already exists.` });
            return;
        }

        setMonthlyBalances(prev => [...prev, {
            month: newMonth,
            year: newYear,
            closing_balance: null,
            opening_balance: null,
            is_verified: false,
            statement_page: 0,
            closing_date: null,
            verified_by: null,
            verified_at: null
        }]);
    };

    const handleRemoveBalance = (index: number) => {
        setMonthlyBalances(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!statement || !bank) {
            toast({
                title: 'Error',
                description: 'Missing required data to save statement',
                variant: 'destructive'
            });
            return;
        }

        setIsSaving(true);

        try {
            console.log('Starting save operation...');

            // Parse statement period to determine if this is multi-month
            const periodDates = parseStatementPeriod(formData.statementPeriod);
            const isMultiMonth = periodDates && (
                periodDates.startMonth !== periodDates.endMonth ||
                periodDates.startYear !== periodDates.endYear
            );

            console.log('Save operation details:', {
                isMultiMonth,
                periodDates,
                statementPeriod: formData.statementPeriod,
                monthlyBalancesCount: monthlyBalances.length
            });

            // Prepare complete extraction data
            const completeExtractionData = {
                bank_name: formData.bank_name || null,
                account_number: formData.account_number || null,
                currency: formData.currency || null,
                statement_period: formData.statementPeriod || null,
                opening_balance: statement.statement_extractions?.opening_balance || null,
                closing_balance: monthlyBalances[0]?.closing_balance || null,
                monthly_balances: monthlyBalances,
                total_pages: statement.statement_extractions?.total_pages || 0
            };

            // Prepare validation status
            const validationStatus = {
                is_validated: true,
                validation_date: new Date().toISOString(),
                validated_by: 'current_user_id',
                mismatches: []
            };

            if (isMultiMonth && periodDates) {
                console.log('Processing multi-month statement...');

                // Generate all months in the range
                const { startMonth, startYear, endMonth, endYear } = periodDates;
                const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

                console.log('Months in range:', monthsInRange);

                // Create statement cycles for all months
                const cyclePromises = monthsInRange.map(({ month, year }) =>
                    getOrCreateStatementCycle(year, month - 1) // Convert to 0-indexed
                );

                const cycleIds = await Promise.all(cyclePromises);
                console.log('Created/retrieved cycle IDs:', cycleIds);

                // Check for existing statements before proceeding
                const existingStatementsPromises = monthsInRange.map(({ month, year }) =>
                    supabase
                        .from('acc_cycle_bank_statements')
                        .select('id, statement_month, statement_year')
                        .eq('bank_id', bank.id)
                        .eq('statement_month', month - 1)
                        .eq('statement_year', year)
                        .maybeSingle()
                );

                const existingResults = await Promise.all(existingStatementsPromises);
                const hasExistingStatements = existingResults.some(result => result.data !== null);

                if (hasExistingStatements) {
                    console.log('Found existing statements, showing confirmation...');
                    setPendingUpdates({
                        type: 'multi-month',
                        monthsInRange,
                        cycleIds,
                        extractionData: completeExtractionData,
                        validationStatus,
                        monthlyBalances
                    });
                    setShowUpdateConfirmation(true);
                    return;
                }

                // Process each month
                const insertPromises = monthsInRange.map(async ({ month, year }, index) => {
                    const cycleId = cycleIds[index];

                    if (!cycleId) {
                        console.error(`No cycle ID for ${month}/${year}`);
                        return null;
                    }

                    // Find balance for this specific month
                    const monthBalance = monthlyBalances.find(
                        b => b.month === month && b.year === year
                    ) || {
                        month,
                        year,
                        closing_balance: null,
                        opening_balance: null,
                        statement_page: 1,
                        closing_date: null,
                        is_verified: false,
                        verified_by: null,
                        verified_at: null
                    };

                    // Create individual statement data for this month
                    const individualStatementData = {
                        bank_id: bank.id,
                        company_id: bank.company_id,
                        statement_cycle_id: cycleId,
                        statement_month: month - 1, // Convert to 0-indexed
                        statement_year: year,
                        statement_document: statement.statement_document,
                        statement_extractions: {
                            ...completeExtractionData,
                            monthly_balances: [monthBalance],
                            closing_balance: monthBalance.closing_balance,
                            opening_balance: monthBalance.opening_balance
                        },
                        has_soft_copy: statement.has_soft_copy || false,
                        has_hard_copy: statement.has_hard_copy || false,
                        validation_status: validationStatus,
                        status: {
                            status: 'validated',
                            verification_date: new Date().toISOString(),
                            assigned_to: statement.status?.assigned_to || null,
                            quickbooks_balance: null
                        }
                    };

                    return supabase
                        .from('acc_cycle_bank_statements')
                        .insert(individualStatementData)
                        .select()
                        .single();
                });

                const results = await Promise.all(insertPromises);
                const successfulInserts = results.filter(result => result && !result.error);
                const errorInserts = results.filter(result => result && result.error);

                if (errorInserts.length > 0) {
                    console.error('Some inserts failed:', errorInserts);
                    throw new Error(`Failed to create ${errorInserts.length} statement records`);
                }

                // Delete the original combined statement if it exists
                if (statement.id) {
                    console.log('Deleting original combined statement:', statement.id);
                    await supabase
                        .from('acc_cycle_bank_statements')
                        .delete()
                        .eq('id', statement.id);
                }

                console.log(`Successfully created ${successfulInserts.length} individual statement records`);

                toast({
                    title: 'Success',
                    description: `Successfully created ${successfulInserts.length} individual statement records`,
                    variant: 'default'
                });

            } else {
                console.log('Processing single-month statement...');

                // Check if statement already exists
                const { data: existingStatement } = await supabase
                    .from('acc_cycle_bank_statements')
                    .select('id')
                    .eq('id', statement.id)
                    .single();

                if (existingStatement) {
                    console.log('Found existing single statement, showing confirmation...');
                    setPendingUpdates({
                        type: 'single-month',
                        extractionData: completeExtractionData,
                        validationStatus,
                        monthlyBalances,
                        statementId: statement.id
                    });
                    setShowUpdateConfirmation(true);
                    return;
                }

                // Update the existing statement
                const updatedStatus = {
                    ...statement.status,
                    status: 'validated',
                    verification_date: new Date().toISOString(),
                    quickbooks_balance: monthlyBalances[0]?.quickbooks_balance || statement.status?.quickbooks_balance || null
                };

                const { data: updatedStatement, error } = await supabase
                    .from('acc_cycle_bank_statements')
                    .update({
                        statement_extractions: completeExtractionData,
                        status: updatedStatus,
                        validation_status: validationStatus
                    })
                    .eq('id', statement.id)
                    .select()
                    .single();

                if (error) {
                    console.error('Single month update error:', error);
                    throw error;
                }

                console.log('Successfully updated single statement:', updatedStatement.id);

                toast({
                    title: 'Success',
                    description: 'Statement data saved successfully'
                });

                // Update parent component
                onStatementUpdated(updatedStatement);
            }

            // Close dialog
            onClose();

        } catch (error) {
            console.error('Save operation failed:', error);
            toast({
                title: 'Save Error',
                description: `Failed to save statement data: ${error.message}`,
                variant: 'destructive'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteStatement = async () => {
        try {
            setIsDeleting(true);

            // Parse statement period to check if it's a range statement
            const periodDates = parseStatementPeriod(formData.statementPeriod);
            const isMultiMonth = periodDates && (
                periodDates.startMonth !== periodDates.endMonth ||
                periodDates.startYear !== periodDates.endYear
            );

            if (isMultiMonth && periodDates) {
                // For range statements, ask user which periods to delete
                const { startMonth, startYear, endMonth, endYear } = periodDates;
                const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

                const confirmed = window.confirm(
                    `This statement covers ${monthsInRange.length} months. Do you want to delete the entry for all these months? The statement file will be preserved.`
                );

                if (!confirmed) return;

                // Delete entries for all months in range
                let deletedCount = 0;
                for (const { month, year } of monthsInRange) {
                    try {
                        const { error: deleteError } = await supabase
                            .from('acc_cycle_bank_statements')
                            .delete()
                            .eq('bank_id', bank.id)
                            .eq('statement_month', month - 1) // Convert to 0-indexed
                            .eq('statement_year', year);

                        if (!deleteError) {
                            deletedCount++;
                        }
                    } catch (monthDeleteError) {
                        console.error(`Error deleting statement for ${month}/${year}:`, monthDeleteError);
                    }
                }

                if (deletedCount > 0) {
                    toast({
                        title: 'Success',
                        description: `Deleted statement entries for ${deletedCount} month(s). Statement file preserved.`
                    });
                    onStatementDeleted(statement.id);
                    onClose();
                } else {
                    throw new Error('Failed to delete any statement entries');
                }
            } else {
                // Single month deletion - only delete the database entry
                const confirmed = window.confirm(
                    'Are you sure you want to delete this statement entry? The statement file will be preserved for other periods that may reference it.'
                );

                if (!confirmed) return;

                const { error: deleteError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .delete()
                    .eq('id', statement.id);

                if (deleteError) throw deleteError;

                toast({
                    title: 'Success',
                    description: 'Statement entry deleted. File preserved.'
                });

                onStatementDeleted(statement.id);
                onClose();
            }
        } catch (error) {
            console.error('Delete error:', error);
            toast({
                title: 'Delete Error',
                description: 'Failed to delete statement entry',
                variant: 'destructive'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmDeleteStatement = async () => {
        setIsDeleting(true);
        try {
            // Check if this is part of a multi-month statement
            const periodDates = parseStatementPeriod(formData.statementPeriod);
            const isMultiMonth = periodDates && (
                periodDates.startMonth !== periodDates.endMonth ||
                periodDates.startYear !== periodDates.endYear
            );

            if (isMultiMonth) {
                // Check if other statements use the same files
                const { data: relatedStatements } = await supabase
                    .from('acc_cycle_bank_statements')
                    .select('id, statement_month, statement_year')
                    .eq('bank_id', bank.id)
                    .neq('id', statement.id);

                let hasSharedFiles = false;
                if (relatedStatements && relatedStatements.length > 0) {
                    for (const related of relatedStatements) {
                        const { data: relatedFull } = await supabase
                            .from('acc_cycle_bank_statements')
                            .select('statement_document')
                            .eq('id', related.id)
                            .single();

                        if (relatedFull) {
                            const samePdf = relatedFull.statement_document?.statement_pdf ===
                                statement.statement_document?.statement_pdf;
                            const sameExcel = relatedFull.statement_document?.statement_excel ===
                                statement.statement_document?.statement_excel;

                            if (samePdf || sameExcel) {
                                hasSharedFiles = true;
                                break;
                            }
                        }
                    }
                }

                // For multi-month statements, only delete the current entry
                const { error } = await supabase
                    .from('acc_cycle_bank_statements')
                    .delete()
                    .eq('id', statement.id);

                if (error) throw error;

                toast({
                    title: 'Success',
                    description: hasSharedFiles
                        ? 'Statement entry deleted. Files preserved for other periods.'
                        : 'Statement entry deleted.',
                    variant: 'default'
                });
            } else {
                // For single-month statements, delete both entry and files
                if (statement.statement_document?.statement_pdf) {
                    await supabase.storage
                        .from('Statement-Cycle')
                        .remove([statement.statement_document.statement_pdf]);
                }

                if (statement.statement_document?.statement_excel) {
                    await supabase.storage
                        .from('Statement-Cycle')
                        .remove([statement.statement_document.statement_excel]);
                }

                const { error } = await supabase
                    .from('acc_cycle_bank_statements')
                    .delete()
                    .eq('id', statement.id);

                if (error) throw error;

                toast({
                    title: 'Success',
                    description: 'Bank statement and files deleted successfully'
                });
            }

            onClose();
            if (onStatementDeleted) {
                onStatementDeleted(statement.id);
            }

        } catch (error: any) {
            console.error('Error deleting statement:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete statement',
                variant: 'destructive'
            });
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirmation(false);
        }
    };

    if (!isOpen) return null;


    const processUpdates = async (updates: any) => {
        if (!updates) {
            toast({
                title: 'Error',
                description: 'No updates to process',
                variant: 'destructive'
            });
            return;
        }

        setIsSaving(true);

        try {
            console.log('Processing confirmed updates:', updates);

            if (updates.type === 'multi-month') {
                const { monthsInRange, cycleIds, extractionData, validationStatus, monthlyBalances } = updates;

                console.log('Processing multi-month updates...');

                // Delete existing statements for these months
                const deletePromises = monthsInRange.map(({ month, year }) =>
                    supabase
                        .from('acc_cycle_bank_statements')
                        .delete()
                        .eq('bank_id', bank.id)
                        .eq('statement_month', month - 1)
                        .eq('statement_year', year)
                );

                await Promise.all(deletePromises);
                console.log('Deleted existing statements');

                // Insert new statements
                const insertPromises = monthsInRange.map(async ({ month, year }, index) => {
                    const cycleId = cycleIds[index];

                    if (!cycleId) {
                        console.error(`No cycle ID for ${month}/${year}`);
                        return null;
                    }

                    const monthBalance = monthlyBalances.find(
                        b => b.month === month && b.year === year
                    ) || {
                        month,
                        year,
                        closing_balance: null,
                        opening_balance: null,
                        statement_page: 1,
                        closing_date: null,
                        is_verified: false,
                        verified_by: null,
                        verified_at: null
                    };

                    const statementData = {
                        bank_id: bank.id,
                        company_id: bank.company_id,
                        statement_cycle_id: cycleId,
                        statement_month: month - 1,
                        statement_year: year,
                        statement_document: statement.statement_document,
                        statement_extractions: {
                            ...extractionData,
                            monthly_balances: [monthBalance],
                            closing_balance: monthBalance.closing_balance,
                            opening_balance: monthBalance.opening_balance
                        },
                        has_soft_copy: statement.has_soft_copy || false,
                        has_hard_copy: statement.has_hard_copy || false,
                        validation_status: validationStatus,
                        status: {
                            status: 'validated',
                            verification_date: new Date().toISOString(),
                            assigned_to: statement.status?.assigned_to || null,
                            quickbooks_balance: null
                        }
                    };

                    return supabase
                        .from('acc_cycle_bank_statements')
                        .insert(statementData)
                        .select()
                        .single();
                });

                const results = await Promise.all(insertPromises);
                const successfulInserts = results.filter(result => result && !result.error);
                const errorInserts = results.filter(result => result && result.error);

                if (errorInserts.length > 0) {
                    console.error('Some inserts failed:', errorInserts);
                    throw new Error(`Failed to create ${errorInserts.length} statement records`);
                }

                // Delete the original combined statement
                if (statement.id) {
                    await supabase
                        .from('acc_cycle_bank_statements')
                        .delete()
                        .eq('id', statement.id);
                }

                console.log(`Successfully processed ${successfulInserts.length} multi-month records`);

                toast({
                    title: 'Success',
                    description: `Successfully updated ${successfulInserts.length} statement records`,
                    variant: 'default'
                });

            } else if (updates.type === 'single-month') {
                const { extractionData, validationStatus, monthlyBalances, statementId } = updates;

                console.log('Processing single-month update...');

                const updatedStatus = {
                    ...statement.status,
                    status: 'validated',
                    verification_date: new Date().toISOString(),
                    quickbooks_balance: monthlyBalances[0]?.quickbooks_balance || statement.status?.quickbooks_balance || null
                };

                const { data: updatedStatement, error } = await supabase
                    .from('acc_cycle_bank_statements')
                    .update({
                        statement_extractions: extractionData,
                        status: updatedStatus,
                        validation_status: validationStatus
                    })
                    .eq('id', statementId)
                    .select()
                    .single();

                if (error) {
                    console.error('Single month update error:', error);
                    throw error;
                }

                console.log('Successfully updated single statement:', updatedStatement.id);

                toast({
                    title: 'Success',
                    description: 'Statement data updated successfully'
                });

                // Update parent component
                onStatementUpdated(updatedStatement);
            }

            // Close dialog and clear state
            onClose();

        } catch (error) {
            console.error('Process updates failed:', error);
            toast({
                title: 'Update Error',
                description: `Failed to process updates: ${error.message}`,
                variant: 'destructive'
            });
        } finally {
            setIsSaving(false);
            setShowUpdateConfirmation(false);
            setPendingUpdates(null);
        }
    };

    // --- JSX Render ---
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-[1600px] max-h-[95vh] h-[95vh] p-6 flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="text-xl flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">{bank?.company_name || 'N/A'}</span>
                            <div className="flex items-center gap-3 pr-16">
                                <div className="text-sm text-muted-foreground">
                                    Document Size: {statement?.statement_document?.document_size ? formatFileSize(statement.statement_document.document_size) : 'N/A'}
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteStatement}
                                    disabled={isDeleting}
                                    className="gap-1"
                                >
                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                                    Delete Statement
                                </Button>
                            </div>
                        </div>
                        <div className="text-base">
                            Bank Statement - {bank?.bank_name || 'N/A'} {bank?.account_number || ''} | {statement?.statement_year && statement?.statement_month !== undefined ? format(new Date(statement.statement_year, statement.statement_month), 'MMMM yyyy') : 'N/A'}
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="validation">Validation</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="flex-1 flex flex-col overflow-hidden pt-4">
                        <div className="grid grid-cols-5 gap-4 h-full overflow-hidden">
                            <div className="col-span-3 flex flex-col h-full overflow-auto border rounded-md bg-muted p-2">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : pdfUrl ? (
                                    <iframe src={pdfUrl} className="w-full h-full" title="Bank Statement PDF" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                        No PDF document available.
                                    </div>
                                )}
                            </div>
                            <div className="col-span-2 flex flex-col h-full gap-4 overflow-hidden">
                                <Card className="shrink-0">
                                    <CardHeader className="py-2">
                                        <CardTitle className="text-base">Account & QB Details</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="bank_name">Bank Name</Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    id="bank_name"
                                                    name="bank_name"
                                                    value={formData.bank_name}
                                                    onChange={handleFormChange}
                                                    className={formData.bank_name && !formData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase()) ? "border-yellow-500" : ""}
                                                />
                                                {formData.bank_name && (
                                                    formData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase()) ?
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                            <Check className="h-3 w-3 mr-1" />Match
                                                        </Badge> :
                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                            <AlertTriangle className="h-3 w-3 mr-1" />Mismatch
                                                        </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="account_number">Account Number</Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    id="account_number"
                                                    name="account_number"
                                                    value={formData.account_number}
                                                    onChange={handleFormChange}
                                                    className={formData.account_number && !formData.account_number.includes(bank.account_number) ? "border-yellow-500" : ""}
                                                />
                                                {formData.account_number && (
                                                    formData.account_number.includes(bank.account_number) ?
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                            <Check className="h-3 w-3 mr-1" />Match
                                                        </Badge> :
                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                            <AlertTriangle className="h-3 w-3 mr-1" />Mismatch
                                                        </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="currency">Currency</Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    id="currency"
                                                    name="currency"
                                                    value={formData.currency}
                                                    onChange={handleFormChange}
                                                    className={formData.currency && normalizeCurrencyCode(formData.currency) !== normalizeCurrencyCode(bank.bank_currency) ? "border-yellow-500" : ""}
                                                />
                                                {formData.currency && (
                                                    normalizeCurrencyCode(formData.currency) === normalizeCurrencyCode(bank.bank_currency) ?
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                            <Check className="h-3 w-3 mr-1" />Match
                                                        </Badge> :
                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                            <AlertTriangle className="h-3 w-3 mr-1" />Mismatch
                                                        </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="statementPeriod">Statement Period</Label>
                                            <Input
                                                id="statementPeriod"
                                                name="statementPeriod"
                                                value={formData.statementPeriod}
                                                onChange={handleFormChange}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="quickbooks_balance">QuickBooks Balance</Label>
                                            <Input
                                                id="quickbooks_balance"
                                                name="quickbooks_balance"
                                                placeholder="Enter QB balance..."
                                                value={formData.quickbooks_balance !== null ? formatNumberWithCommas(formData.quickbooks_balance) : ''}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9.]/g, '');
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        quickbooks_balance: value ? parseFloat(value) : null
                                                    }));
                                                }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="flex-1 flex flex-col overflow-hidden">
                                    <CardHeader className="py-2 flex flex-row items-center justify-between">
                                        <CardTitle className="text-base">Monthly Balances</CardTitle>
                                        <Button variant="outline" size="sm" onClick={handleAddBalance}>
                                            <Plus className="h-4 w-4 mr-1" />Add
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="p-0 flex-1 overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Period</TableHead>
                                                    <TableHead>Closing Balance</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {monthlyBalances.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                                            <p>No monthly balances found</p>
                                                            <p className="text-sm mt-1">Click "Add" to add balance entries</p>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    monthlyBalances
                                                        .sort((a, b) => {
                                                            if (a.year !== b.year) return a.year - b.year;
                                                            return a.month - b.month;
                                                        })
                                                        .map((balance, index) => (
                                                            <TableRow key={`${balance.year}-${balance.month}`}>
                                                                <TableCell>
                                                                    {format(new Date(balance.year, balance.month - 1), 'MMM yyyy')}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="text"
                                                                        value={formatNumberWithCommas(balance.closing_balance)}
                                                                        onChange={(e) => handleUpdateBalance(index, 'closing_balance', e.target.value)}
                                                                        placeholder="0.00"
                                                                        className="w-full max-w-[200px]"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex gap-2">
                                                                        {balance.is_verified ? (
                                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                                                <Check className="h-3 w-3 mr-1" />Verified
                                                                            </Badge>
                                                                        ) : (
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => verifyBalance(index)}
                                                                            >
                                                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                                                Verify
                                                                            </Button>
                                                                        )}
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleRemoveBalance(index)}
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="validation" className="flex-1 overflow-auto p-4 space-y-4">
                        {error && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>
                                    <p className="mb-2">{error.message}</p>
                                    <Button variant="outline" size="sm" onClick={() => setError(null)} className="mt-2">
                                        Dismiss
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}
                        <Card className="border-l-4 border-blue-500">
                            <CardContent className="p-4">
                                <div className="flex flex-col space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-medium text-sm text-muted-foreground">Validation Status</h4>
                                            <div className="mt-1 flex items-center">
                                                {statement.validation_status?.is_validated ?
                                                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" /> :
                                                    <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                                                }
                                                <span className="text-lg font-medium">
                                                    {statement.validation_status?.is_validated ?
                                                        'All validations passed' :
                                                        (statement.validation_status?.mismatches?.length > 0 ?
                                                            `${statement.validation_status.mismatches.length} issues found` :
                                                            'Not validated yet'
                                                        )
                                                    }
                                                </span>
                                            </div>
                                            {statement.validation_status?.validation_date && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Last validated: {format(new Date(statement.validation_status.validation_date), 'PPpp')}
                                                    {statement.validation_status.validated_by && (
                                                        <span> by {statement.validation_status.validated_by}</span>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            onClick={validateStatement}
                                            disabled={isValidating}
                                            variant={statement.validation_status?.is_validated ? 'outline' : 'default'}
                                            className="gap-2"
                                        >
                                            {isValidating ?
                                                <><Loader2 className="h-4 w-4 animate-spin" />Validating...</> :
                                                <><CheckCircle className="h-4 w-4" />{statement.validation_status?.is_validated ? 'Re-validate' : 'Validate Statement'}</>
                                            }
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Document Type</p>
                                            <p className="font-medium">{statement.statement_document?.document_type || 'Bank Statement'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Document Size</p>
                                            <p className="font-medium">{formatFileSize(statement.statement_document?.document_size || 0)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Pages</p>
                                            <p className="font-medium">{totalPages || 'N/A'}</p>
                                        </div>
                                    </div>
                                    {statement.validation_status?.mismatches?.length > 0 && (
                                        <div className="mt-2 pt-4 border-t">
                                            <div className="flex items-center justify-between mb-2">
                                                <h5 className="text-sm font-medium text-muted-foreground">Issues to resolve</h5>
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    {statement.validation_status.mismatches.length} issue{statement.validation_status.mismatches.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <ul className="space-y-2">
                                                {statement.validation_status.mismatches.map((issue, idx) => (
                                                    <li key={idx} className="flex items-start p-2 bg-red-50 rounded-md">
                                                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-sm font-medium text-red-800">{issue}</p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="py-3 bg-blue-50">
                                <CardTitle className="text-base">Monthly Balances Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-gray-50">
                                        <TableRow>
                                            <TableHead>Period</TableHead>
                                            <TableHead>Closing Balance</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlyBalances.length > 0 ? (
                                            monthlyBalances
                                                .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
                                                .map((balance, index) => (
                                                    <TableRow
                                                        key={index}
                                                        className={balance.month === statement.statement_month + 1 && balance.year === statement.statement_year ? "bg-blue-50" : ""}
                                                    >
                                                        <TableCell>
                                                            {format(new Date(balance.year, balance.month - 1), 'MMMM yyyy')}
                                                            {balance.month === statement.statement_month + 1 && balance.year === statement.statement_year && (
                                                                <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-500 border-blue-200">
                                                                    Current
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {formatCurrency(balance.closing_balance, statement.statement_extractions?.currency || bank.bank_currency)}
                                                        </TableCell>
                                                        <TableCell>
                                                            {balance.is_verified ? (
                                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                                    <Check className="h-3 w-3 mr-1" />Verified
                                                                </Badge>
                                                            ) : (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 text-xs bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        verifyBalance(index);
                                                                    }}
                                                                >
                                                                    Verify
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                                                    No monthly balances added yet
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="py-3 bg-blue-50">
                                <CardTitle className="text-base">QuickBooks Reconciliation</CardTitle>
                            </CardHeader>
                            <CardContent className="py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-gray-50 rounded-md">
                                        <p className="text-sm text-muted-foreground mb-1">Bank Statement</p>
                                        <p className="font-medium">
                                            {formatCurrency(
                                                statement.statement_extractions.closing_balance,
                                                statement.statement_extractions.currency || bank.bank_currency
                                            )}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-md">
                                        <p className="text-sm text-muted-foreground mb-1">QuickBooks</p>
                                        <p className="font-medium">
                                            {formatCurrency(statement.status?.quickbooks_balance, bank.bank_currency)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>
                        Close
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || isDeleting}>
                        {isSaving ?
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> :
                            <><Save className="mr-2 h-4 w-4" />Save All Changes</>
                        }
                    </Button>
                </DialogFooter>

                <AlertDialog open={showUpdateConfirmation} onOpenChange={setShowUpdateConfirmation}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Updates</AlertDialogTitle>
                            <AlertDialogDescription>
                                You are about to update existing bank statement records. Please review the changes carefully before proceeding.

                                {pendingUpdates?.isMultiMonth && (
                                    <div className="mt-4 bg-yellow-50 p-3 rounded-md">
                                        <p className="text-sm text-yellow-700">
                                            This will update {pendingUpdates.monthlyBalances.length} monthly records.
                                        </p>
                                    </div>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => pendingUpdates && processUpdates(pendingUpdates)}>
                                {isSaving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Confirm Updates
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>


                <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Bank Statement</AlertDialogTitle>
                            <AlertDialogDescription>
                                {(() => {
                                    const periodDates = parseStatementPeriod(formData.statementPeriod);
                                    const isMultiMonth = periodDates && (
                                        periodDates.startMonth !== periodDates.endMonth ||
                                        periodDates.startYear !== periodDates.endYear
                                    );

                                    return (
                                        <div className="space-y-2">
                                            <p>Are you sure you want to delete this bank statement?</p>
                                            {isMultiMonth && (
                                                <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-md">
                                                    <p className="text-sm text-amber-800 dark:text-amber-200">
                                                        <AlertTriangle className="h-4 w-4 inline mr-1" />
                                                        This is part of a multi-month statement. Only the entry for {format(new Date(statement.statement_year, statement.statement_month), 'MMMM yyyy')} will be deleted. The statement file will be preserved for other months.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDeleteStatement}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent >
        </Dialog >
    );
}