// @ts-nocheck
"use client"

import { useState, useEffect, useCallback } from 'react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Alert, AlertDescription, AlertTitle } from "@/components/ui/alert-dialog";
import { Loader2, Save, AlertTriangle, CheckCircle, Check, Trash, Plus, X, XCircle } from 'lucide-react';

// --- Interface Definitions ---

interface ValidationStatus {
    is_validated: boolean;
    validation_date: string | null;
    validated_by: string | null;
    mismatches: string[];
}

interface MonthlyBalance {
    month: number;
    year: number;
    closing_balance: number;
    opening_balance: number;
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
}

// --- Main Component ---
export default function BankExtractionDialog({
    isOpen,
    onClose,
    bank,
    statement,
    onStatementUpdated
}: BankExtractionDialogProps) {
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

    // --- Effects ---
    useEffect(() => {
        if (isOpen) {
            setError(null);
        }
    }, [isOpen]);

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

    useEffect(() => {
        if (isOpen && statement) {
            setIsLoading(true);
            setFormData({
                bank_name: statement.statement_extractions?.bank_name || '',
                account_number: statement.statement_extractions?.account_number || '',
                currency: statement.statement_extractions?.currency || '',
                statementPeriod: statement.statement_extractions?.statement_period || '',
                quickbooks_balance: statement.quickbooks_balance ?? null,
            });
            setMonthlyBalances(statement.statement_extractions?.monthly_balances || []);
            loadPdfDocument();
        } else {
            setPdfUrl(null);
        }
    }, [isOpen, statement, loadPdfDocument]);

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
            // Fallback for invalid currency codes
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

            const updatedStatement = { ...statement, validation_status: { is_validated: mismatches.length === 0, validation_date: new Date().toISOString(), validated_by: 'current_user_id', mismatches } };

            const { error } = await supabase.from('acc_cycle_bank_statements').update({ validation_status: updatedStatement.validation_status }).eq('id', statement.id);
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

    const verifyBalance = async (balanceIndex: number): Promise<void> => {
        if (!monthlyBalances[balanceIndex]) return;

        setError(null);
        const updatedBalances = [...monthlyBalances];

        try {
            updatedBalances[balanceIndex] = { ...updatedBalances[balanceIndex], is_verified: true, verified_by: 'current_user_id', verified_at: new Date().toISOString() };
            const updatedExtractions = { ...statement.statement_extractions, monthly_balances: updatedBalances };

            const { error, data } = await supabase.from('acc_cycle_bank_statements').update({ statement_extractions: updatedExtractions }).eq('id', statement.id).select().single();
            if (error) throw error;

            setMonthlyBalances(updatedBalances); // Update local state for immediate UI feedback
            onStatementUpdated(data);

            toast({ title: 'Balance Verified', description: 'The monthly balance has been verified successfully.' });
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to verify balance');
            setError(error);
            toast({ title: 'Verification Failed', description: error.message, variant: 'destructive' });
        }
    };

    // --- Event Handlers ---
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateBalance = (index: number, field: string, value: string) => {
        const newBalances = [...monthlyBalances];
        const rawValue = String(value).replace(/,/g, '');
        newBalances[index] = { ...newBalances[index], [field]: field === 'closing_balance' ? parseFloat(rawValue) || 0 : value, is_verified: false };
        setMonthlyBalances(newBalances);
    };

    const handleAddBalance = () => {
        const newDate = new Date();
        const newMonth = newDate.getMonth();
        const newYear = newDate.getFullYear();
        if (monthlyBalances.some(b => b.month === newMonth && b.year === newYear)) {
            toast({ description: `Balance for ${format(new Date(newYear, newMonth), 'MMMM yyyy')} already exists.` });
            return;
        }
        setMonthlyBalances(prev => [...prev, { month: newMonth, year: newYear, closing_balance: 0, opening_balance: 0, is_verified: false, statement_page: 0, closing_date: null, verified_by: null, verified_at: null }]);
    };

    const handleRemoveBalance = (index: number) => {
        setMonthlyBalances(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedExtractions = { ...statement.statement_extractions, bank_name: formData.bank_name, account_number: formData.account_number, currency: formData.currency, statementPeriod: formData.statementPeriod, monthly_balances: monthlyBalances };
            const updateData = { statement_extractions: updatedExtractions, quickbooks_balance: formData.quickbooks_balance !== null ? parseFloat(String(formData.quickbooks_balance)) : null };

            const { data, error } = await supabase.from('acc_cycle_bank_statements').update(updateData).eq('id', statement.id).select('*').single();
            if (error) throw error;

            toast({ title: 'Success', description: 'Statement data saved successfully' });
            onStatementUpdated(data);
            onClose();
        } catch (error: any) {
            toast({ title: 'Save Error', description: error.message || 'Failed to save statement data', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            if (statement.statement_document.statement_pdf) {
                await supabase.storage.from('Statement-Cycle').remove([statement.statement_document.statement_pdf]);
            }
            await supabase.from('acc_cycle_bank_statements').delete().eq('id', statement.id);
            toast({ title: 'Success', description: 'Bank statement deleted successfully' });
            onStatementUpdated(null);
            onClose();
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to delete bank statement', variant: 'destructive' });
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirmation(false);
        }
    };

    if (!isOpen) return null;

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
                                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirmation(true)} disabled={isDeleting} className="gap-1">
                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />} Delete Statement
                                </Button>
                            </div>
                        </div>
                        <div className="text-base">
                            Bank Statement - {bank?.bank_name || 'N/A'} {bank?.account_number || ''} | {statement?.statement_year && statement?.statement_month !== undefined ? format(new Date(statement.statement_year, statement.statement_month), 'MMMM yyyy') : 'N/A'}
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="validation">Validation</TabsTrigger></TabsList>

                    <TabsContent value="overview" className="flex-1 flex flex-col overflow-hidden pt-4">
                        <div className="grid grid-cols-5 gap-4 h-full overflow-hidden">
                            <div className="col-span-3 flex flex-col h-full overflow-auto border rounded-md bg-muted p-2">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                ) : pdfUrl ? (
                                    <iframe src={pdfUrl} className="w-full h-full" title="Bank Statement PDF" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">No PDF document available.</div>
                                )}
                            </div>
                            <div className="col-span-2 flex flex-col h-full gap-4 overflow-hidden">
                                <Card className="shrink-0">
                                    <CardHeader className="py-2"><CardTitle className="text-base">Account & QB Details</CardTitle></CardHeader>
                                    <CardContent className="space-y-3 pt-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="bank_name">Bank Name</Label>
                                            <div className="flex items-center gap-2">
                                                <Input id="bank_name" name="bank_name" value={formData.bank_name} onChange={handleFormChange} className={formData.bank_name && !formData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase()) ? "border-yellow-500" : ""} />
                                                {formData.bank_name && (formData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase()) ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Check className="h-3 w-3 mr-1" />Match</Badge> : <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />Mismatch</Badge>)}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="account_number">Account Number</Label>
                                            <div className="flex items-center gap-2">
                                                <Input id="account_number" name="account_number" value={formData.account_number} onChange={handleFormChange} className={formData.account_number && !formData.account_number.includes(bank.account_number) ? "border-yellow-500" : ""} />
                                                {formData.account_number && (formData.account_number.includes(bank.account_number) ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Check className="h-3 w-3 mr-1" />Match</Badge> : <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />Mismatch</Badge>)}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="currency">Currency</Label>
                                            <div className="flex items-center gap-2">
                                                <Input id="currency" name="currency" value={formData.currency} onChange={handleFormChange} className={formData.currency && normalizeCurrencyCode(formData.currency) !== normalizeCurrencyCode(bank.bank_currency) ? "border-yellow-500" : ""} />
                                                {formData.currency && (normalizeCurrencyCode(formData.currency) === normalizeCurrencyCode(bank.bank_currency) ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Check className="h-3 w-3 mr-1" />Match</Badge> : <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />Mismatch</Badge>)}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="statementPeriod">Statement Period</Label>
                                            <Input id="statementPeriod" name="statementPeriod" value={formData.statementPeriod} onChange={handleFormChange} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="quickbooks_balance">QuickBooks Balance</Label>
                                            <Input id="quickbooks_balance" name="quickbooks_balance" placeholder="Enter QB balance..." value={formData.quickbooks_balance !== null ? formatNumberWithCommas(formData.quickbooks_balance) : ''} onChange={(e) => { const value = e.target.value.replace(/[^0-9.]/g, ''); setFormData(prev => ({ ...prev, quickbooks_balance: value ? parseFloat(value) : null })); }} />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="flex-1 flex flex-col overflow-hidden">
                                    <CardHeader className="py-2 flex flex-row items-center justify-between"><CardTitle className="text-base">Monthly Balances</CardTitle><Button variant="outline" size="sm" onClick={handleAddBalance}><Plus className="h-4 w-4 mr-1" />Add</Button></CardHeader>
                                    <CardContent className="p-0 flex-1 overflow-auto">
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Closing Balance</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {monthlyBalances.length > 0 ? (monthlyBalances.sort((a, b) => new Date(a.year, a.month) - new Date(b.year, b.month)).map((balance, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-medium">{format(new Date(balance.year, balance.month), 'MMM yyyy')}</TableCell>
                                                        <TableCell><Input type="text" value={formatNumberWithCommas(balance.closing_balance)} onChange={(e) => handleUpdateBalance(index, 'closing_balance', e.target.value)} /></TableCell>
                                                        <TableCell className="flex gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => verifyBalance(index)} disabled={balance.is_verified}><CheckCircle className={balance.is_verified ? "h-4 w-4 text-green-500" : "h-4 w-4"} /></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveBalance(index)}><X className="h-4 w-4" /></Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))) : <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No monthly balances.</TableCell></TableRow>}
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
                                <AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle>
                                <AlertDescription><p className="mb-2">{error.message}</p><Button variant="outline" size="sm" onClick={() => setError(null)} className="mt-2">Dismiss</Button></AlertDescription>
                            </Alert>
                        )}
                        <Card className="border-l-4 border-blue-500">
                            <CardContent className="p-4">
                                <div className="flex flex-col space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-medium text-sm text-muted-foreground">Validation Status</h4>
                                            <div className="mt-1 flex items-center">
                                                {statement.validation_status?.is_validated ? <CheckCircle className="h-5 w-5 text-green-500 mr-2" /> : <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />}
                                                <span className="text-lg font-medium">{statement.validation_status?.is_validated ? 'All validations passed' : (statement.validation_status?.mismatches?.length > 0 ? `${statement.validation_status.mismatches.length} issues found` : 'Not validated yet')}</span>
                                            </div>
                                            {statement.validation_status?.validation_date && (<p className="text-xs text-muted-foreground mt-1">Last validated: {format(new Date(statement.validation_status.validation_date), 'PPpp')}{statement.validation_status.validated_by && (<span> by {statement.validation_status.validated_by}</span>)}</p>)}
                                        </div>
                                        <Button onClick={validateStatement} disabled={isValidating} variant={statement.validation_status?.is_validated ? 'outline' : 'default'} className="gap-2">
                                            {isValidating ? <><Loader2 className="h-4 w-4 animate-spin" />Validating...</> : <><CheckCircle className="h-4 w-4" />{statement.validation_status?.is_validated ? 'Re-validate' : 'Validate Statement'}</>}
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div className="space-y-1"><p className="text-muted-foreground">Document Type</p><p className="font-medium">{statement.statement_document?.document_type || 'Bank Statement'}</p></div>
                                        <div className="space-y-1"><p className="text-muted-foreground">Document Size</p><p className="font-medium">{formatFileSize(statement.statement_document?.document_size || 0)}</p></div>
                                        <div className="space-y-1"><p className="text-muted-foreground">Pages</p><p className="font-medium">{totalPages || 'N/A'}</p></div>
                                    </div>
                                    {statement.validation_status?.mismatches?.length > 0 && (
                                        <div className="mt-2 pt-4 border-t">
                                            <div className="flex items-center justify-between mb-2"><h5 className="text-sm font-medium text-muted-foreground">Issues to resolve</h5><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{statement.validation_status.mismatches.length} issue{statement.validation_status.mismatches.length !== 1 ? 's' : ''}</span></div>
                                            <ul className="space-y-2">
                                                {statement.validation_status.mismatches.map((issue, idx) => (
                                                    <li key={idx} className="flex items-start p-2 bg-red-50 rounded-md">
                                                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                                                        <div><p className="text-sm font-medium text-red-800">{issue}</p></div>
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
                                    <TableHeader className="bg-gray-50"><TableRow><TableHead>Period</TableHead><TableHead>Closing Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {statement.statement_extractions?.monthly_balances?.length > 0 ? (statement.statement_extractions.monthly_balances.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month).map((balance, index) => (
                                            <TableRow key={index} className={balance.month === statement.statement_month && balance.year === statement.statement_year ? "bg-blue-50" : ""}>
                                                <TableCell>{format(new Date(balance.year, balance.month, 1), 'MMMM yyyy')}{balance.month === statement.statement_month && balance.year === statement.statement_year && (<Badge variant="outline" className="ml-2 bg-blue-50 text-blue-500 border-blue-200">Current</Badge>)}</TableCell>
                                                <TableCell>{formatCurrency(balance.closing_balance, statement.statement_extractions?.currency || bank.bank_currency)}</TableCell>
                                                <TableCell>{balance.is_verified ? (<Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Check className="h-3 w-3 mr-1" />Verified</Badge>) : (<Button variant="outline" size="sm" className="h-7 text-xs bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100" onClick={(e) => { e.stopPropagation(); verifyBalance(index); }}>Verify</Button>)}</TableCell>
                                            </TableRow>
                                        ))) : (<TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No monthly balances added yet</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="py-3 bg-blue-50"><CardTitle className="text-base">QuickBooks Reconciliation</CardTitle></CardHeader>
                            <CardContent className="py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-gray-50 rounded-md"><p className="text-sm text-muted-foreground mb-1">Bank Statement</p><p className="font-medium">{formatCurrency(statement.statement_extractions.closing_balance, statement.statement_extractions.currency || bank.bank_currency)}</p></div>
                                    <div className="p-3 bg-gray-50 rounded-md"><p className="text-sm text-muted-foreground mb-1">QuickBooks</p><p className="font-medium">{formatCurrency(statement.quickbooks_balance, bank.bank_currency)}</p></div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                </Tabs>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>Close</Button>
                    <Button onClick={handleSave} disabled={isSaving || isDeleting}>
                        {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save All Changes</>}
                    </Button>
                </DialogFooter>
                <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the statement. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    );
}