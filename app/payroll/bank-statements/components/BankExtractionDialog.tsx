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
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
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
    acc_password?: string;
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

    if (statementType === 'range') return true;
    if (statementType === 'monthly') return false;

    if (monthlyBalances.length > 1) return true;

    if (statementPeriod) {
        const periodCheck = parseStatementPeriod(statementPeriod);
        if (periodCheck) {
            const { startMonth, startYear, endMonth, endYear } = periodCheck;
            return startYear !== endYear || startMonth !== endMonth;
        }
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
    const { getOrCreateStatementCycle } = useStatementCycle();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
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
    const [currentStatement, setCurrentStatement] = useState<BankStatement | null>(null);
    const [statementData, setStatementData] = useState<StatementData>({
        monthly: undefined,
        range: undefined,
        hasMultipleTypes: false
    });
    const [activeStatementTab, setActiveStatementTab] = useState<'monthly' | 'range'>('monthly');

    const [showUpdateConfirmation, setShowUpdateConfirmation] = useState(false);
    const [pendingUpdates, setPendingUpdates] = useState<any>(null);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    const isTemporaryStatement = useMemo(() => statement?.id?.toString().startsWith('temp-'), [statement]);
    const totalPages = currentStatement?.statement_extractions?.total_pages || 0;

    useEffect(() => {
        if (isOpen && statement && bank) {
            setError(null);
            loadStatementData();
        }
    }, [isOpen, statement, bank]);

    const loadStatementData = async () => {
        if (!statement || !bank) return;
        setIsLoading(true);

        try {
            if (isTemporaryStatement) {
                const tempStatement = { ...statement };
                setStatementData({ monthly: tempStatement, range: undefined, hasMultipleTypes: false });
                setCurrentStatement(tempStatement);
                await loadStatementFormData(tempStatement);
                await loadPdfDocument(tempStatement);
                setActiveStatementTab(isRangeStatement(tempStatement) ? 'range' : 'monthly');
            } else {
                const { data: allStatements, error: dbError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .select('*')
                    .eq('bank_id', bank.id)
                    .eq('statement_month', statement.statement_month)
                    .eq('statement_year', statement.statement_year);

                if (dbError) throw dbError;

                let monthlyStatement: BankStatement | null = null;
                let rangeStatement: BankStatement | null = null;
                (allStatements || []).forEach(stmt => {
                    if (stmt.statement_type === 'range') rangeStatement = stmt;
                    else if (stmt.statement_type === 'monthly') monthlyStatement = stmt;
                });

                const hasMultipleTypes = !!(monthlyStatement && rangeStatement);
                setStatementData({ monthly: monthlyStatement, range: rangeStatement, hasMultipleTypes });

                let currentStmt = statement.statement_type === 'range' ? rangeStatement : monthlyStatement;
                if (!currentStmt) currentStmt = statement;

                setCurrentStatement(currentStmt);
                setActiveStatementTab(currentStmt.statement_type || 'monthly');
                await loadStatementFormData(currentStmt);
                await loadPdfDocument(currentStmt);
            }
        } catch (err) {
            console.error('Error loading statement data:', err);
            toast({ title: "Error", description: "Failed to load statement data.", variant: "destructive" });
            setCurrentStatement(statement);
            await loadStatementFormData(statement);
            await loadPdfDocument(statement);
        } finally {
            setIsLoading(false);
        }
    };

    const loadStatementFormData = async (stmt: BankStatement) => {
        const extractions = stmt?.statement_extractions || {};
        setFormData({
            bank_name: extractions.bank_name || '',
            account_number: extractions.account_number || '',
            currency: extractions.currency || '',
            statementPeriod: extractions.statement_period || '',
            quickbooks_balance: stmt.status?.quickbooks_balance || null
        });

        const extractedMonthlyBalances = extractions.monthly_balances || [];
        const statementPeriodString = extractions.statement_period;
        let compiledMonthlyBalances: MonthlyBalance[] = [];

        if (statementPeriodString) {
            const period = parseStatementPeriod(statementPeriodString);
            if (period) {
                const allMonthsInPeriod = generateMonthRange(period.startMonth, period.startYear, period.endMonth, period.endYear);
                compiledMonthlyBalances = allMonthsInPeriod.map(monthInPeriod => {
                    const foundBalance = extractedMonthlyBalances.find(eb => eb.month === monthInPeriod.month && eb.year === monthInPeriod.year);
                    return foundBalance || {
                        month: monthInPeriod.month, year: monthInPeriod.year, closing_balance: null, opening_balance: null,
                        statement_page: 0, closing_date: null, is_verified: false, verified_by: null, verified_at: null, highlight_coordinates: null,
                    };
                });
            }
        }

        if (compiledMonthlyBalances.length === 0 && stmt) {
            compiledMonthlyBalances = [{
                month: stmt.statement_month + 1, year: stmt.statement_year,
                closing_balance: extractions.closing_balance || null, opening_balance: extractions.opening_balance || null,
                statement_page: 0, closing_date: null, is_verified: false, verified_by: null, verified_at: null, highlight_coordinates: null,
            }];
        }
        setMonthlyBalances(compiledMonthlyBalances);
    };

    const loadPdfDocument = async (stmt: BankStatement) => {
        const pdfPath = stmt?.statement_document?.statement_pdf;
        if (!pdfPath) {
            setPdfUrl(null);
            return;
        }

        if (pdfPath.startsWith('blob:')) {
            setPdfUrl(pdfPath);
            return;
        }

        try {
            const { data, error } = await supabase.storage
                .from('Statement-Cycle')
                .createSignedUrl(pdfPath, 3600);
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

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateBalance = (index: number, field: string, value: string) => {
        const newBalances = [...monthlyBalances];
        const rawValue = String(value).replace(/,/g, '');
        newBalances[index] = {
            ...newBalances[index],
            [field]: field.includes('balance') ? (rawValue ? parseFloat(rawValue) : null) : value,
            is_verified: false
        };
        setMonthlyBalances(newBalances);
    };

    const handleAddBalance = () => {
        const latestMonth = monthlyBalances[monthlyBalances.length - 1] || { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
        const nextDate = new Date(latestMonth.year, latestMonth.month);
        setMonthlyBalances(prev => [...prev, {
            month: nextDate.getMonth() + 1, year: nextDate.getFullYear(),
            closing_balance: null, opening_balance: null, is_verified: false, statement_page: 0,
            closing_date: null, verified_by: null, verified_at: null
        }]);
    };

    const handleRemoveBalance = (index: number) => {
        setMonthlyBalances(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!currentStatement || !bank) {
            toast({ title: 'Error', description: 'Missing required data to save statement', variant: 'destructive' });
            return;
        }

        setIsSaving(true);

        const completeExtractionData = {
            bank_name: formData.bank_name || null,
            account_number: formData.account_number || null,
            currency: formData.currency || null,
            statement_period: formData.statementPeriod || null,
            opening_balance: currentStatement.statement_extractions?.opening_balance || null,
            closing_balance: monthlyBalances.length > 0 ? monthlyBalances[monthlyBalances.length - 1].closing_balance : null,
            monthly_balances: monthlyBalances,
            total_pages: currentStatement.statement_extractions?.total_pages || 0
        };

        const validationStatus = {
            is_validated: true,
            validation_date: new Date().toISOString(),
            validated_by: 'current_user_id',
            mismatches: []
        };

        const updatedStatus = {
            ...currentStatement.status,
            status: 'validated',
            verification_date: new Date().toISOString(),
            quickbooks_balance: formData.quickbooks_balance,
        };

        if (isTemporaryStatement) {
            const updatedTempStatement = {
                ...currentStatement,
                statement_extractions: completeExtractionData,
                validation_status: validationStatus,
                status: updatedStatus,
            };
            onStatementUpdated(updatedTempStatement);
            setIsSaving(false);
            return;
        }

        try {
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

            toast({ title: 'Success', description: 'Statement data saved successfully' });
            setCurrentStatement(updatedStatement);
            onStatementUpdated(updatedStatement);
            onClose();

        } catch (error) {
            console.error('Save operation failed:', error);
            toast({ title: 'Save Error', description: `Failed to save statement data: ${error.message}`, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteStatement = async () => {
        if (isTemporaryStatement || !currentStatement) {
            toast({ title: 'Action Not Allowed', description: 'Cannot delete an unsaved statement.', variant: 'warning' });
            return;
        }
        setShowDeleteConfirmation(true);
    };

    const confirmDelete = async () => {
        if (isTemporaryStatement || !currentStatement) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('acc_cycle_bank_statements')
                .delete()
                .eq('id', currentStatement.id);

            if (error) throw error;

            toast({ title: 'Success', description: 'Statement entry deleted.' });
            onStatementDeleted?.(currentStatement.id);
            onClose();
        } catch (error) {
            console.error('Delete error:', error);
            toast({ title: 'Delete Error', description: 'Failed to delete statement entry', variant: 'destructive' });
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirmation(false);
        }
    };

    const validateStatement = async (): Promise<boolean> => {
        if (!currentStatement || !bank) return false;
        setIsValidating(true);
        const mismatches: string[] = [];
        const extractions = currentStatement.statement_extractions;
        if (!extractions?.bank_name || !extractions.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())) {
            mismatches.push(`Bank name does not match. Expected: ${bank.bank_name}, Found: ${extractions?.bank_name || 'Not found'}`);
        }
        if (!extractions?.account_number || !extractions.account_number.includes(bank.account_number)) {
            mismatches.push(`Account number does not match. Expected: ${bank.account_number}, Found: ${extractions?.account_number || 'Not found'}`);
        }
        if (!extractions?.currency || normalizeCurrencyCode(extractions.currency) !== normalizeCurrencyCode(bank.bank_currency)) {
            mismatches.push(`Currency does not match. Expected: ${bank.bank_currency}, Found: ${extractions?.currency || 'Not found'}`);
        }
        const updatedValidationStatus = {
            is_validated: mismatches.length === 0,
            validation_date: new Date().toISOString(),
            validated_by: 'current_user_id',
            mismatches
        };
        const updatedStatement = { ...currentStatement, validation_status: updatedValidationStatus };
        setCurrentStatement(updatedStatement);

        if (!isTemporaryStatement) {
            await supabase.from('acc_cycle_bank_statements').update({ validation_status: updatedValidationStatus }).eq('id', currentStatement.id);
        }
        onStatementUpdated(updatedStatement);

        toast({
            title: mismatches.length === 0 ? 'Validation Successful' : 'Validation Completed with Issues',
            description: mismatches.length === 0 ? 'All validations passed.' : `Found ${mismatches.length} issue(s).`,
            variant: mismatches.length === 0 ? 'default' : 'destructive'
        });
        setIsValidating(false);
        return mismatches.length === 0;
    };

    const verifyBalance = async (balanceIndex: number): Promise<void> => {
        if (!monthlyBalances[balanceIndex] || !currentStatement) return;
        const updatedBalances = [...monthlyBalances];
        updatedBalances[balanceIndex] = {
            ...updatedBalances[balanceIndex],
            is_verified: true,
            verified_by: 'current_user_id',
            verified_at: new Date().toISOString()
        };
        setMonthlyBalances(updatedBalances);
        const updatedStatement = { ...currentStatement, statement_extractions: { ...currentStatement.statement_extractions, monthly_balances: updatedBalances } };
        setCurrentStatement(updatedStatement);

        if (!isTemporaryStatement) {
            await supabase.from('acc_cycle_bank_statements').update({ statement_extractions: updatedStatement.statement_extractions }).eq('id', currentStatement.id);
        }
        onStatementUpdated(updatedStatement);

        toast({ title: 'Balance Verified' });
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-[1720px] max-h-[95vh] h-[95vh] p-6 flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="text-xl flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">{bank?.company_name || 'N/A'}</span>
                            <div className="flex items-center gap-3 pr-16">
                                {statementData.hasMultipleTypes && !isTemporaryStatement && (
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
                                    disabled={isDeleting || isTemporaryStatement}
                                    className="gap-1"
                                    title={isTemporaryStatement ? "Cannot delete an unsaved statement" : "Delete Statement"}
                                >
                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                                    Delete Statement
                                </Button>
                            </div>
                        </div>
                        <div className="text-base flex flex-wrap items-center gap-4 text-gray-700">
                            <span><span className="font-medium">Bank Name:</span> {bank?.bank_name || 'N/A'}</span> |
                            <span><span className="font-medium">Account Number:</span> {bank?.account_number || 'N/A'}</span> |
                            <span><span className="font-medium">Statement Period:</span> {statement?.statement_year != null && statement?.statement_month != null ? format(new Date(statement.statement_year, statement.statement_month, 1), 'MMMM yyyy') : 'N/A'}</span> |
                            <span className="text-gray-500">
                                <span className="font-medium">Password:</span> <span className="font-semibold text-blue-600">{bank?.acc_password || 'N/A'}</span>
                            </span>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {statementData.hasMultipleTypes && !isTemporaryStatement && (
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
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : currentStatement ? (
                            <div className="grid grid-cols-5 gap-4 h-full overflow-hidden">
                                <div className="col-span-3 flex flex-col h-full overflow-auto border rounded-md bg-muted p-2">
                                    {pdfUrl ? (
                                        <iframe src={pdfUrl} className="w-full h-full" title="Bank Statement PDF" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">No PDF document available.</div>
                                    )}
                                </div>
                                    <div className="col-span-2 flex flex-col h-full overflow-hidden">
                                        <Accordion type="multiple" defaultValue={["details"]} className="w-full space-y-4">
                                            {/* First Accordion Item: Account & QB Details */}
                                            <AccordionItem value="details" className="border rounded-lg">
                                                <AccordionTrigger className="px-4 py-2 hover:no-underline">
                                                    <div className="flex items-center justify-between w-full pr-2">
                                                        <span className="text-base font-semibold">Account & QB Details</span>
                                                        <div className="flex gap-2">
                                                            <Badge variant={isRangeStatement(currentStatement) ? "default" : "secondary"}>
                                                                {isRangeStatement(currentStatement) ? 'Range Statement' : 'Monthly Statement'}
                                                            </Badge>
                                                            {currentStatement?.statement_type && (
                                                                <Badge variant="outline">
                                                                    {currentStatement.statement_type}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-4 pt-2 pb-4">
                                                    <div className="space-y-3">
                                                        <div className="space-y-1">
                                                            <Label htmlFor="bank_name">Bank Name</Label>
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    id="bank_name"
                                                                    name="bank_name"
                                                                    value={formData.bank_name}
                                                                    onChange={handleFormChange}
                                                                    className={formData.bank_name && bank && !formData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase()) ? "border-yellow-500" : ""}
                                                                />
                                                                {formData.bank_name && bank && (
                                                                    formData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase()) ?
                                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Check className="h-3 w-3 mr-1" />Match</Badge> :
                                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />Mismatch</Badge>
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
                                                                    className={formData.account_number && bank && !formData.account_number.includes(bank.account_number) ? "border-yellow-500" : ""}
                                                                />
                                                                {formData.account_number && bank && (
                                                                    formData.account_number.includes(bank.account_number) ?
                                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Check className="h-3 w-3 mr-1" />Match</Badge> :
                                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />Mismatch</Badge>
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
                                                                    className={formData.currency && bank && normalizeCurrencyCode(formData.currency) !== normalizeCurrencyCode(bank.bank_currency) ? "border-yellow-500" : ""}
                                                                />
                                                                {formData.currency && bank && (
                                                                    normalizeCurrencyCode(formData.currency) === normalizeCurrencyCode(bank.bank_currency) ?
                                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Check className="h-3 w-3 mr-1" />Match</Badge> :
                                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />Mismatch</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label htmlFor="statementPeriod">Statement Period</Label>
                                                            <Input id="statementPeriod" name="statementPeriod" value={formData.statementPeriod} onChange={handleFormChange} />
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
                                                                    setFormData(prev => ({ ...prev, quickbooks_balance: value ? parseFloat(value) : null }));
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>

                                            {/* Second Accordion Item: Statement Data */}
                                            <AccordionItem value="data" className="border rounded-lg flex-1 flex flex-col overflow-hidden">
                                                <AccordionTrigger className="px-4 py-3 hover:no-underline font-semibold text-base">
                                                    Statement Data
                                                </AccordionTrigger>
                                                <AccordionContent className="p-0 flex-1 overflow-hidden">
                                                    {statementData.hasMultipleTypes && !isTemporaryStatement ? (
                                                        <Tabs value={activeStatementTab} onValueChange={handleStatementTabChange} className="h-full flex flex-col">
                                                            <TabsList className="grid w-full grid-cols-2 mx-2 mt-2">
                                                                <TabsTrigger value="monthly" disabled={!statementData.monthly} className="flex items-center gap-2"><Calendar className="h-4 w-4" />Monthly</TabsTrigger>
                                                                <TabsTrigger value="range" disabled={!statementData.range} className="flex items-center gap-2"><Calendar className="h-4 w-4" />Range</TabsTrigger>
                                                            </TabsList>
                                                            <TabsContent value="monthly" className="flex-1 overflow-auto p-2 mt-2">
                                                                {statementData.monthly ? <MonthlyBalancesTable monthlyBalances={monthlyBalances} onUpdateBalance={handleUpdateBalance} onVerifyBalance={verifyBalance} onRemoveBalance={handleRemoveBalance} onAddBalance={handleAddBalance} /> : <div className="text-center py-8 text-muted-foreground"><Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" /><p>No monthly statement available</p></div>}
                                                            </TabsContent>
                                                            <TabsContent value="range" className="flex-1 overflow-auto p-2 mt-2">
                                                                {statementData.range ? <MonthlyBalancesTable monthlyBalances={monthlyBalances} onUpdateBalance={handleUpdateBalance} onVerifyBalance={verifyBalance} onRemoveBalance={handleRemoveBalance} onAddBalance={handleAddBalance} isRangeView={true} /> : <div className="text-center py-8 text-muted-foreground"><Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" /><p>No range statement available</p></div>}
                                                            </TabsContent>
                                                        </Tabs>
                                                    ) : (
                                                        <div className="p-2 h-full overflow-auto">
                                                            <MonthlyBalancesTable
                                                                monthlyBalances={monthlyBalances}
                                                                onUpdateBalance={handleUpdateBalance}
                                                                onVerifyBalance={verifyBalance}
                                                                onRemoveBalance={handleRemoveBalance}
                                                                onAddBalance={handleAddBalance}
                                                                isRangeView={isRangeStatement(currentStatement)}
                                                            />
                                                        </div>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <div className="text-center">
                                    <AlertTriangle className="h-12 w-12 mb-4 opacity-50 mx-auto" />
                                    <p>No statement available for {activeStatementTab} view</p>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="validation" className="flex-1 overflow-auto p-4 space-y-4">
                        {error && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error.message}</AlertDescription>
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
                                                    {currentStatement?.validation_status?.is_validated ? 'All validations passed' :
                                                        (currentStatement?.validation_status?.mismatches?.length > 0 ?
                                                            `${currentStatement.validation_status.mismatches.length} issues found` : 'Not validated yet')}
                                                </span>
                                            </div>
                                            {currentStatement?.validation_status?.validation_date && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Last validated: {format(new Date(currentStatement.validation_status.validation_date), 'PPpp')}
                                                </p>
                                            )}
                                        </div>
                                        <Button onClick={validateStatement} disabled={isValidating} variant={currentStatement?.validation_status?.is_validated ? 'outline' : 'default'} className="gap-2">
                                            {isValidating ? <><Loader2 className="h-4 w-4 animate-spin" />Validating...</> : <><CheckCircle className="h-4 w-4" />{currentStatement?.validation_status?.is_validated ? 'Re-validate' : 'Validate Statement'}</>}
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
                                            <h5 className="text-sm font-medium text-muted-foreground mb-2">Issues to resolve</h5>
                                            <ul className="space-y-2">
                                                {currentStatement.validation_status.mismatches.map((issue, idx) => (
                                                    <li key={idx} className="flex items-start p-2 bg-red-50 rounded-md">
                                                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                                                        <p className="text-sm font-medium text-red-800">{issue}</p>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="py-3 bg-blue-50"><CardTitle className="text-base">Monthly Balances Summary</CardTitle></CardHeader>
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
                                            monthlyBalances.sort((a, b) => a.year - b.year || a.month - b.month).map((balance, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>{format(new Date(balance.year, balance.month - 1), 'MMMM yyyy')}</TableCell>
                                                    <TableCell>{formatCurrency(balance.closing_balance, formData.currency)}</TableCell>
                                                    <TableCell>
                                                        {balance.is_verified ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Check className="h-3 w-3 mr-1" />Verified</Badge>
                                                        ) : (
                                                            <Button variant="outline" size="sm" onClick={() => verifyBalance(index)}>Verify</Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No monthly balances.</TableCell></TableRow>
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
                                                currentStatement?.statement_extractions?.currency || bank?.bank_currency
                                            )}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-md">
                                        <p className="text-sm text-muted-foreground mb-1">QuickBooks</p>
                                        <p className="font-medium">
                                            {formatCurrency(currentStatement?.status?.quickbooks_balance, bank?.bank_currency)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>Close</Button>
                    <Button onClick={handleSave} disabled={isSaving || isDeleting || !currentStatement}>
                        {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Statement</>}
                    </Button>
                </DialogFooter>

                <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle></AlertDialogHeader>
                        <AlertDialogDescription>Are you sure you want to delete this statement? This action cannot be undone.</AlertDialogDescription>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={showUpdateConfirmation} onOpenChange={setShowUpdateConfirmation}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Updates</AlertDialogTitle>
                            <AlertDialogDescription>
                                You are about to update existing bank statement records. Please review the changes carefully before proceeding.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => pendingUpdates && processUpdates(pendingUpdates)}>
                                Confirm
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </DialogContent>
        </Dialog>
    );
}