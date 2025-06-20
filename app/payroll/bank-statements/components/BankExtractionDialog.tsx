// app/payroll/bank-statements/components/BankExtractionDialog.tsx
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
import { AlertTriangle, Trash, Plus, X, Loader2, CheckCircle, Check, Calendar, XCircle, Save } from 'lucide-react';
import { MonthlyBalancesTable } from './MonthlyBalancesTable';

interface ValidationStatus {
    is_validated: boolean;
    validation_date: string | null;
    validated_by: string | null;
    mismatches: string[];
}

interface MonthlyBalance {
    month: number;
    year: number;
    closing_balance: number | null;
    opening_balance: number | null;
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
    statement_month: number;
    statement_year: number;
    statement_type: 'monthly' | 'range';
    quickbooks_balance: number | null;
    statement_document: {
        statement_pdf: string | null;
        statement_excel: string | null;
        document_size?: number;
        document_type?: string;
        password?: string | null;
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

interface StatementData {
    monthly?: BankStatement;
    range?: BankStatement;
    hasMultipleTypes: boolean;
}

interface BankExtractionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    bank: Bank;
    statement: BankStatement;
    onStatementUpdated: (statement: BankStatement | null) => void;
    onStatementDeleted?: (statementId: string) => void;
}

const isRangeStatement = (statement: any): boolean => {
    if (!statement) return false;

    const statementType = statement.statement_type;
    const monthlyBalances = statement.statement_extractions?.monthly_balances || [];
    const statementPeriod = statement.statement_extractions?.statement_period;

    // Explicit type check first
    if (statementType === 'range') return true;
    if (statementType === 'monthly') return false;

    // Multiple monthly balances indicate a range statement
    if (monthlyBalances.length > 1) return true;

    // Parse statement period to check actual date span
    if (statementPeriod) {
        const periodCheck = parseStatementPeriodSafe(statementPeriod);
        if (periodCheck) {
            const { startMonth, startYear, endMonth, endYear } = periodCheck;

            // Only consider it range if it spans multiple months or years
            if (startYear !== endYear || startMonth !== endMonth) {
                return true;
            }
            return false; // Same month = not range
        }

        // Fallback to keyword detection for edge cases
        const period = statementPeriod.toLowerCase();
        return period.includes('quarter') || /q[1-4]/i.test(period);
    }

    return false;
};

export default function BankExtractionDialog({
    isOpen,
    onClose,
    bank,
    statement,
    onStatementUpdated,
    onStatementDeleted
}: BankExtractionDialogProps) {
    const { getOrCreateStatementCycle, getStatementByType, checkBankStatementTypes } = useStatementCycle();

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

    const [statementData, setStatementData] = useState<StatementData>({
        monthly: undefined,
        range: undefined,
        hasMultipleTypes: false
    });
    const [activeStatementTab, setActiveStatementTab] = useState<'monthly' | 'range'>('monthly');
    const [currentStatement, setCurrentStatement] = useState<BankStatement | null>(null);

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

    const totalPages = currentStatement?.statement_extractions?.total_pages || 0;

    useEffect(() => {
        if (isOpen) {
            setError(null);
            loadStatementData();
        }
    }, [isOpen]);

    const loadStatementData = async () => {
        if (!statement || !bank) return;

        setIsLoading(true);
        try {
            // FIX: Get all statements for this bank across all cycles for this period
            const { data: allStatements, error } = await supabase
                .from('acc_cycle_bank_statements')
                .select('*')
                .eq('bank_id', bank.id)
                .eq('statement_month', statement.statement_month)
                .eq('statement_year', statement.statement_year);

            if (error) throw error;

            const statements = allStatements || [];
            let monthlyStatement = null;
            let rangeStatement = null;

            // Separate statements by type (they might be in different cycles)
            statements.forEach(stmt => {
                if (stmt.statement_type === 'range') {
                    rangeStatement = stmt;
                } else if (stmt.statement_type === 'monthly') {
                    monthlyStatement = stmt;
                }
            });

            const hasMultipleTypes = !!(monthlyStatement && rangeStatement);

            setStatementData({
                monthly: monthlyStatement,
                range: rangeStatement,
                hasMultipleTypes
            });

            // Set current statement based on the one passed in
            let currentStmt = statement;
            if (statement.statement_type === 'monthly' && monthlyStatement) {
                currentStmt = monthlyStatement;
                setActiveStatementTab('monthly');
            } else if (statement.statement_type === 'range' && rangeStatement) {
                currentStmt = rangeStatement;
                setActiveStatementTab('range');
            } else {
                setActiveStatementTab(isRangeStatement(statement) ? 'range' : 'monthly');
            }

            setCurrentStatement(currentStmt);
            await loadStatementFormData(currentStmt);
            await loadPdfDocument(currentStmt);

        } catch (error) {
            console.error('Error loading statement data:', error);
            setCurrentStatement(statement);
            await loadStatementFormData(statement);
            await loadPdfDocument(statement);
        } finally {
            setIsLoading(false);
        }
    };

    const loadStatementFormData = async (stmt: BankStatement) => {
        const extractions = stmt.statement_extractions || {};

        setFormData({
            bank_name: extractions.bank_name || '',
            account_number: extractions.account_number || '',
            currency: extractions.currency || '',
            statementPeriod: extractions.statement_period || '',
            quickbooks_balance: stmt.status?.quickbooks_balance || null
        });

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
                            opening_balance: null,
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
                compiledMonthlyBalances = [{
                    month: stmt.statement_month + 1,
                    year: stmt.statement_year,
                    closing_balance: extractions.closing_balance || null,
                    opening_balance: extractions.opening_balance || null,
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
    };

    const loadPdfDocument = async (stmt: BankStatement) => {
        if (!stmt?.statement_document?.statement_pdf) {
            return;
        }
        try {
            const { data, error } = await supabase.storage
                .from('Statement-Cycle')
                .createSignedUrl(stmt.statement_document.statement_pdf, 3600);
            if (error) throw error;
            setPdfUrl(data.signedUrl);
        } catch (error) {
            console.error('Error loading PDF:', error);
            toast({ title: 'Error', description: 'Failed to load PDF document', variant: 'destructive' });
        }
    };

    const handleStatementTabChange = (tab: 'monthly' | 'range') => {
        setActiveStatementTab(tab);
        const newStatement = tab === 'monthly' ? statementData.monthly : statementData.range;
        if (newStatement) {
            setCurrentStatement(newStatement);
            loadStatementFormData(newStatement);
            loadPdfDocument(newStatement);
        }
    };

    const parsedPeriod = useMemo(() => {
        if (formData.statementPeriod) {
            return parseStatementPeriod(formData.statementPeriod);
        }
        return null;
    }, [formData.statementPeriod]);

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
    };

    const validateStatement = async (): Promise<boolean> => {
        setError(null);
        if (!currentStatement) return false;

        setIsValidating(true);
        const mismatches: string[] = [];
        const extractions = currentStatement.statement_extractions;

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
                ...currentStatement,
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
                .eq('id', currentStatement.id);

            if (error) throw error;

            setCurrentStatement(updatedStatement);
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

    const verifyBalance = async (balanceIndex: number): Promise<void> => {
        if (!monthlyBalances[balanceIndex] || !currentStatement) return;

        setError(null);
        try {
            const updatedBalances = [...monthlyBalances];
            updatedBalances[balanceIndex] = {
                ...updatedBalances[balanceIndex],
                is_verified: true,
                verified_by: 'current_user_id',
                verified_at: new Date().toISOString()
            };

            setMonthlyBalances(updatedBalances);

            const updatedExtractions = {
                ...currentStatement.statement_extractions,
                monthly_balances: updatedBalances
            };

            const { error, data } = await supabase
                .from('acc_cycle_bank_statements')
                .update({ statement_extractions: updatedExtractions })
                .eq('id', currentStatement.id)
                .select()
                .single();

            if (error) {
                setMonthlyBalances(monthlyBalances);
                throw error;
            }

            setCurrentStatement(data);
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

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateBalance = (index: number, field: string, value: string) => {
        const newBalances = [...monthlyBalances];
        const rawValue = String(value).replace(/,/g, '');
        newBalances[index] = {
            ...newBalances[index],
            [field]: field === 'closing_balance'
                ? (rawValue ? parseFloat(rawValue) : null)
                : value,
            is_verified: false
        };
        setMonthlyBalances(newBalances);
    };

    const handleAddBalance = () => {
        const latestMonth = monthlyBalances.reduce((latest, current) => {
            const currentMonthDate = new Date(current.year, current.month - 1);
            const latestMonthDate = new Date(latest.year, latest.month - 1);
            return currentMonthDate > latestMonthDate ? current : latest;
        }, { month: (currentStatement?.statement_month || 0) + 1, year: currentStatement?.statement_year || new Date().getFullYear() });

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
        if (!currentStatement || !bank) {
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

            const periodDates = parseStatementPeriod(formData.statementPeriod);
            const isMultiMonth = periodDates && (
                periodDates.startMonth !== periodDates.endMonth ||
                periodDates.startYear !== periodDates.endYear
            );

            const completeExtractionData = {
                bank_name: formData.bank_name || null,
                account_number: formData.account_number || null,
                currency: formData.currency || null,
                statement_period: formData.statementPeriod || null,
                opening_balance: currentStatement.statement_extractions?.opening_balance || null,
                closing_balance: monthlyBalances[0]?.closing_balance || null,
                monthly_balances: monthlyBalances,
                total_pages: currentStatement.statement_extractions?.total_pages || 0
            };

            const validationStatus = {
                is_validated: true,
                validation_date: new Date().toISOString(),
                validated_by: 'current_user_id',
                mismatches: []
            };

            if (isMultiMonth && periodDates) {
                console.log('Processing multi-month statement...');

                const { startMonth, startYear, endMonth, endYear } = periodDates;
                const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

                const cyclePromises = monthsInRange.map(({ month, year }) =>
                    getOrCreateStatementCycle(year, month - 1)
                );

                const cycleIds = await Promise.all(cyclePromises);

                // Check for existing statements of the SAME TYPE only
                const existingStatementsPromises = monthsInRange.map(({ month, year }) =>
                    supabase
                        .from('acc_cycle_bank_statements')
                        .select('id, statement_month, statement_year')
                        .eq('bank_id', bank.id)
                        .eq('statement_month', month - 1)
                        .eq('statement_year', year)
                        .eq('statement_type', currentStatement.statement_type) // ADD THIS LINE
                        .maybeSingle()
                );

                const existingResults = await Promise.all(existingStatementsPromises);
                const hasExistingStatements = existingResults.some(result => result.data !== null);

                if (hasExistingStatements) {
                    console.log('Found existing statements of same type, showing confirmation...');
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

                // Process new multi-month statement
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

                    const individualStatementData = {
                        bank_id: bank.id,
                        company_id: bank.company_id,
                        statement_cycle_id: cycleId,
                        statement_month: month - 1,
                        statement_year: year,
                        statement_type: currentStatement.statement_type, // Preserve type
                        statement_document: currentStatement.statement_document,
                        statement_extractions: {
                            ...completeExtractionData,
                            monthly_balances: [monthBalance],
                            closing_balance: monthBalance.closing_balance,
                            opening_balance: monthBalance.opening_balance
                        },
                        has_soft_copy: currentStatement.has_soft_copy || false,
                        has_hard_copy: currentStatement.has_hard_copy || false,
                        validation_status: validationStatus,
                        status: {
                            status: 'validated',
                            verification_date: new Date().toISOString(),
                            assigned_to: currentStatement.status?.assigned_to || null,
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

                // Only delete the original if it was a combined range statement
                if (currentStatement.id && isMultiMonth) {
                    console.log('Deleting original combined statement:', currentStatement.id);
                    await supabase
                        .from('acc_cycle_bank_statements')
                        .delete()
                        .eq('id', currentStatement.id);
                }

                console.log(`Successfully created ${successfulInserts.length} individual statement records`);

                toast({
                    title: 'Success',
                    description: `Successfully created ${successfulInserts.length} individual statement records`,
                    variant: 'default'
                });

            } else {
                console.log('Processing single-month statement...');

                // For single-month, just update the current statement
                const updatedStatus = {
                    ...currentStatement.status,
                    status: 'validated',
                    verification_date: new Date().toISOString(),
                    quickbooks_balance: monthlyBalances[0]?.quickbooks_balance || currentStatement.status?.quickbooks_balance || null
                };

                const { data: updatedStatement, error } = await supabase
                    .from('acc_cycle_bank_statements')
                    .update({
                        statement_extractions: completeExtractionData,
                        status: updatedStatus,
                        validation_status: validationStatus
                    })
                    .eq('id', currentStatement.id)
                    .select()
                    .single();

                if (error) throw error;

                console.log('Successfully updated single statement:', updatedStatement.id);

                toast({
                    title: 'Success',
                    description: 'Statement data saved successfully'
                });

                setCurrentStatement(updatedStatement);
                onStatementUpdated(updatedStatement);
            }

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

            const periodDates = parseStatementPeriod(formData.statementPeriod);
            const isMultiMonth = periodDates && (
                periodDates.startMonth !== periodDates.endMonth ||
                periodDates.startYear !== periodDates.endYear
            );

            if (isMultiMonth && periodDates) {
                const { startMonth, startYear, endMonth, endYear } = periodDates;
                const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

                const confirmed = window.confirm(
                    `This statement covers ${monthsInRange.length} months. Do you want to delete the ${currentStatement?.statement_type} entries for all these months? Other statement types will be preserved.`
                );

                if (!confirmed) return;

                let deletedCount = 0;
                for (const { month, year } of monthsInRange) {
                    try {
                        const { error: deleteError } = await supabase
                            .from('acc_cycle_bank_statements')
                            .delete()
                            .eq('bank_id', bank.id)
                            .eq('statement_month', month - 1)
                            .eq('statement_year', year)
                            .eq('statement_type', currentStatement?.statement_type); // ADD THIS LINE

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
                        description: `Deleted ${currentStatement?.statement_type} entries for ${deletedCount} month(s). Other statement types preserved.`
                    });
                    onStatementDeleted?.(currentStatement?.id || '');
                    onClose();
                } else {
                    throw new Error('Failed to delete any statement entries');
                }
            } else {
                const confirmed = window.confirm(
                    `Are you sure you want to delete this ${currentStatement?.statement_type} statement entry? Other statement types for this period will be preserved.`
                );

                if (!confirmed) return;

                const { error: deleteError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .delete()
                    .eq('id', currentStatement?.id); // This is fine since it's by ID

                if (deleteError) throw deleteError;

                toast({
                    title: 'Success',
                    description: `${currentStatement?.statement_type} statement entry deleted. Other types preserved.`
                });

                onStatementDeleted?.(currentStatement?.id || '');
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

                // FIX: Only delete statements of the SAME TYPE, not all statements for the period
                const deletePromises = monthsInRange.map(({ month, year }) =>
                    supabase
                        .from('acc_cycle_bank_statements')
                        .delete()
                        .eq('bank_id', bank.id)
                        .eq('statement_month', month - 1)
                        .eq('statement_year', year)
                        .eq('statement_type', currentStatement?.statement_type) // ADD THIS LINE
                );

                await Promise.all(deletePromises);
                console.log('Deleted existing statements of the same type');

                // Rest of the insertion logic remains the same...
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
                        statement_type: currentStatement?.statement_type, // Preserve the type
                        statement_document: currentStatement?.statement_document,
                        statement_extractions: {
                            ...extractionData,
                            monthly_balances: [monthBalance],
                            closing_balance: monthBalance.closing_balance,
                            opening_balance: monthBalance.opening_balance
                        },
                        has_soft_copy: currentStatement?.has_soft_copy || false,
                        has_hard_copy: currentStatement?.has_hard_copy || false,
                        validation_status: validationStatus,
                        status: {
                            status: 'validated',
                            verification_date: new Date().toISOString(),
                            assigned_to: currentStatement?.status?.assigned_to || null,
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

                // FIX: Only delete the original statement if we're replacing it entirely
                if (currentStatement?.id) {
                    // Check if this was a range statement that we're splitting
                    const periodDates = parseStatementPeriod(extractionData.statement_period);
                    const isOriginalMultiMonth = periodDates && (
                        periodDates.startMonth !== periodDates.endMonth ||
                        periodDates.startYear !== periodDates.endYear
                    );

                    if (isOriginalMultiMonth) {
                        console.log('Deleting original range statement:', currentStatement.id);
                        await supabase
                            .from('acc_cycle_bank_statements')
                            .delete()
                            .eq('id', currentStatement.id);
                    }
                }

                console.log(`Successfully processed ${successfulInserts.length} multi-month records`);

                toast({
                    title: 'Success',
                    description: `Successfully updated ${successfulInserts.length} statement records`,
                    variant: 'default'
                });

            } else if (updates.type === 'single-month') {
                // Single month updates - no deletion needed, just update
                const { extractionData, validationStatus, monthlyBalances, statementId } = updates;

                console.log('Processing single-month update...');

                const updatedStatus = {
                    ...currentStatement?.status,
                    status: 'validated',
                    verification_date: new Date().toISOString(),
                    quickbooks_balance: monthlyBalances[0]?.quickbooks_balance || currentStatement?.status?.quickbooks_balance || null
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

                setCurrentStatement(updatedStatement);
                onStatementUpdated(updatedStatement);
            }

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

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-[1600px] max-h-[95vh] h-[95vh] p-6 flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="text-xl flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">{bank?.company_name || 'N/A'}</span>
                            <div className="flex items-center gap-3 pr-16">
                                {statementData.hasMultipleTypes && (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                        Multiple Statement Types Available
                                    </Badge>
                                )}
                                <div className="text-sm text-muted-foreground">
                                    Document Size: {currentStatement?.statement_document?.document_size ?
                                        formatFileSize(currentStatement.statement_document.document_size) : 'N/A'}
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
                        {/* <div className="text-base">
                            Bank Statement - {bank?.bank_name || 'N/A'} {bank?.account_number || ''} |
                            {currentStatement?.statement_year && currentStatement?.statement_month !== undefined ?
                                format(new Date(currentStatement.statement_year, currentStatement.statement_month), 'MMMM yyyy') : 'N/A'}
                        </div> */}
                        <div className="text-base flex flex-wrap items-center gap-4 text-gray-700">
                            <span><span className="font-medium">Bank Name:</span> {bank.bank_name}</span> |
                            <span><span className="font-medium">Account Number:</span> {bank.account_number}</span> |
                            <span><span className="font-medium">Statement Period:</span> {format(new Date(statement.statement_year, statement.statement_month, 1), 'MMMM yyyy')}</span> |
                            <span className="text-gray-500">
                                <span className="font-medium">Password:</span> <span className="font-semibold text-blue-600">{bank.acc_password}</span>
                            </span>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {statementData.hasMultipleTypes && (
                    <div className="border-b">
                        <Tabs value={activeStatementTab} onValueChange={handleStatementTabChange}>
                            <TabsList className="grid w-full grid-cols-2 max-w-md">
                                <TabsTrigger
                                    value="monthly"
                                    disabled={!statementData.monthly}
                                    className="flex items-center gap-2"
                                >
                                    <Calendar className="h-4 w-4" />
                                    Monthly Statement
                                    {!statementData.monthly && <span className="text-xs">(None)</span>}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="range"
                                    disabled={!statementData.range}
                                    className="flex items-center gap-2"
                                >
                                    <Calendar className="h-4 w-4" />
                                    Range Statement
                                    {!statementData.range && <span className="text-xs">(None)</span>}
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="validation">Validation</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="flex-1 flex flex-col overflow-hidden pt-4">
                        {currentStatement ? (
                            <div className="grid grid-cols-5 gap-4 h-full overflow-hidden">
                                {/* PDF Viewer */}
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

                                {/* Right Panel with Statement Type Tabs */}
                                <div className="col-span-2 flex flex-col h-full gap-4 overflow-hidden">
                                    {/* Account Details */}
                                    <Card className="shrink-0">
                                        <CardHeader className="py-2">
                                            <CardTitle className="text-base flex items-center justify-between">
                                                Account & QB Details
                                                <div className="flex gap-2">
                                                    <Badge variant={activeStatementTab === 'range' ? "default" : "secondary"}>
                                                        {activeStatementTab === 'range' ? 'Range Statement' : 'Monthly Statement'}
                                                    </Badge>
                                                    {currentStatement?.statement_type && (
                                                        <Badge variant="outline">
                                                            {currentStatement.statement_type}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </CardTitle>
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

                                    {/* Statement Data with Tabs */}
                                    <Card className="flex-1 flex flex-col overflow-hidden">
                                        <CardHeader className="py-2">
                                            <CardTitle className="text-base">Statement Data</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0 flex-1 overflow-hidden">
                                            {/* Check if we have multiple statement types for this bank/period */}
                                            {statementData.hasMultipleTypes ? (
                                                <Tabs value={activeStatementTab} onValueChange={handleStatementTabChange} className="h-full flex flex-col">
                                                    <TabsList className="grid w-full grid-cols-2 mx-2 mt-2">
                                                        <TabsTrigger
                                                            value="monthly"
                                                            disabled={!statementData.monthly}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <Calendar className="h-4 w-4" />
                                                            Monthly
                                                            {!statementData.monthly && <span className="text-xs">(None)</span>}
                                                        </TabsTrigger>
                                                        <TabsTrigger
                                                            value="range"
                                                            disabled={!statementData.range}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <Calendar className="h-4 w-4" />
                                                            Range
                                                            {!statementData.range && <span className="text-xs">(None)</span>}
                                                        </TabsTrigger>
                                                    </TabsList>

                                                    <TabsContent value="monthly" className="flex-1 overflow-auto p-2 mt-2">
                                                        {statementData.monthly ? (
                                                            <MonthlyBalancesTable
                                                                monthlyBalances={monthlyBalances}
                                                                onUpdateBalance={handleUpdateBalance}
                                                                onVerifyBalance={verifyBalance}
                                                                onRemoveBalance={handleRemoveBalance}
                                                                onAddBalance={handleAddBalance}
                                                            />
                                                        ) : (
                                                            <div className="text-center py-8 text-muted-foreground">
                                                                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                                                <p>No monthly statement available</p>
                                                                <p className="text-sm mt-1">Upload a monthly statement to view data here</p>
                                                            </div>
                                                        )}
                                                    </TabsContent>

                                                    <TabsContent value="range" className="flex-1 overflow-auto p-2 mt-2">
                                                        {statementData.range ? (
                                                            <div className="space-y-4">
                                                                <div className="p-3 bg-purple-50 rounded-md border border-purple-200">
                                                                    <h4 className="font-medium text-purple-800 mb-2">Range Statement Overview</h4>
                                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                                        <div>
                                                                            <p className="text-purple-600">Statement Period:</p>
                                                                            <p className="font-medium">{formData.statementPeriod || 'Not specified'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-purple-600">Total Months:</p>
                                                                            <p className="font-medium">{monthlyBalances.length}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <MonthlyBalancesTable
                                                                    monthlyBalances={monthlyBalances}
                                                                    onUpdateBalance={handleUpdateBalance}
                                                                    onVerifyBalance={verifyBalance}
                                                                    onRemoveBalance={handleRemoveBalance}
                                                                    onAddBalance={handleAddBalance}
                                                                    isRangeView={true}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-8 text-muted-foreground">
                                                                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                                                <p>No range statement available</p>
                                                                <p className="text-sm mt-1">Upload a range statement to view data here</p>
                                                            </div>
                                                        )}
                                                    </TabsContent>
                                                </Tabs>
                                            ) : (
                                                // Single statement type - show without tabs
                                                <div className="p-2 h-full overflow-auto">
                                                    <MonthlyBalancesTable
                                                        monthlyBalances={monthlyBalances}
                                                        onUpdateBalance={handleUpdateBalance}
                                                        onVerifyBalance={verifyBalance}
                                                        onRemoveBalance={handleRemoveBalance}
                                                        onAddBalance={handleAddBalance}
                                                        isRangeView={currentStatement?.statement_type === 'range'}
                                                    />
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <div className="text-center">
                                    <AlertTriangle className="h-12 w-12 mb-4 opacity-50 mx-auto" />
                                    <p>No statement available for {activeStatementTab} view</p>
                                    <p className="text-sm mt-2">Upload a {activeStatementTab} statement to view data here</p>
                                </div>
                            </div>
                        )}
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
                                                {currentStatement?.validation_status?.is_validated ?
                                                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" /> :
                                                    <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                                                }
                                                <span className="text-lg font-medium">
                                                    {currentStatement?.validation_status?.is_validated ?
                                                        'All validations passed' :
                                                        (currentStatement?.validation_status?.mismatches?.length > 0 ?
                                                            `${currentStatement.validation_status.mismatches.length} issues found` :
                                                            'Not validated yet'
                                                        )
                                                    }
                                                </span>
                                            </div>
                                            {currentStatement?.validation_status?.validation_date && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Last validated: {format(new Date(currentStatement.validation_status.validation_date), 'PPpp')}
                                                    {currentStatement.validation_status.validated_by && (
                                                        <span> by {currentStatement.validation_status.validated_by}</span>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            onClick={validateStatement}
                                            disabled={isValidating}
                                            variant={currentStatement?.validation_status?.is_validated ? 'outline' : 'default'}
                                            className="gap-2"
                                        >
                                            {isValidating ?
                                                <><Loader2 className="h-4 w-4 animate-spin" />Validating...</> :
                                                <><CheckCircle className="h-4 w-4" />{currentStatement?.validation_status?.is_validated ? 'Re-validate' : 'Validate Statement'}</>
                                            }
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Document Type</p>
                                            <p className="font-medium">{currentStatement?.statement_document?.document_type || 'Bank Statement'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Document Size</p>
                                            <p className="font-medium">{formatFileSize(currentStatement?.statement_document?.document_size || 0)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Pages</p>
                                            <p className="font-medium">{totalPages || 'N/A'}</p>
                                        </div>
                                    </div>
                                    {currentStatement?.validation_status?.mismatches?.length > 0 && (
                                        <div className="mt-2 pt-4 border-t">
                                            <div className="flex items-center justify-between mb-2">
                                                <h5 className="text-sm font-medium text-muted-foreground">Issues to resolve</h5>
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    {currentStatement.validation_status.mismatches.length} issue{currentStatement.validation_status.mismatches.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <ul className="space-y-2">
                                                {currentStatement.validation_status.mismatches.map((issue, idx) => (
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
                                                        className={balance.month === (currentStatement?.statement_month || 0) + 1 && balance.year === currentStatement?.statement_year ? "bg-blue-50" : ""}
                                                    >
                                                        <TableCell>
                                                            {format(new Date(balance.year, balance.month - 1), 'MMMM yyyy')}
                                                            {balance.month === (currentStatement?.statement_month || 0) + 1 && balance.year === currentStatement?.statement_year && (
                                                                <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-500 border-blue-200">
                                                                    Current
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {formatCurrency(balance.closing_balance, currentStatement?.statement_extractions?.currency || bank.bank_currency)}
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
                                                currentStatement?.statement_extractions?.closing_balance,
                                                currentStatement?.statement_extractions?.currency || bank.bank_currency
                                            )}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-md">
                                        <p className="text-sm text-muted-foreground mb-1">QuickBooks</p>
                                        <p className="font-medium">
                                            {formatCurrency(currentStatement?.status?.quickbooks_balance, bank.bank_currency)}
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
                    <Button onClick={handleSave} disabled={isSaving || isDeleting || !currentStatement}>
                        {isSaving ?
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> :
                            <><Save className="mr-2 h-4 w-4" />Save {activeStatementTab} Statement</>
                        }
                    </Button>
                </DialogFooter>


                <AlertDialog open={showUpdateConfirmation} onOpenChange={setShowUpdateConfirmation}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Updates</AlertDialogTitle>
                            <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                    <span className="text-sm text-muted-foreground">
                                        You are about to update existing bank statement records. Please review the changes carefully before proceeding.
                                    </span>

                                    {pendingUpdates?.type === 'multi-month' && (
                                        <div className="mt-4 bg-yellow-50 p-3 rounded-md">
                                            <span className="text-sm text-yellow-700">
                                                This will update {pendingUpdates.monthlyBalances.length} monthly records.
                                            </span>
                                        </div>
                                    )}
                                </div>
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
                            <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                    <span className="text-sm text-muted-foreground">Are you sure you want to delete this bank statement?</span>
                                    {(() => {
                                        const periodDates = parseStatementPeriod(formData.statementPeriod);
                                        const isMultiMonth = periodDates && (
                                            periodDates.startMonth !== periodDates.endMonth ||
                                            periodDates.startYear !== periodDates.endYear
                                        );

                                        return isMultiMonth ? (
                                            <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-md">
                                                <span className="text-sm text-amber-800 dark:text-amber-200 flex items-center">
                                                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                                                    This is part of a multi-month statement. Only the entry for {format(new Date((currentStatement?.statement_year || 0), (currentStatement?.statement_month || 0)), 'MMMM yyyy')} will be deleted. The statement file will be preserved for other months.
                                                </span>
                                            </div>
                                        ) : null;
                                    })()}
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteStatement}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    );
}