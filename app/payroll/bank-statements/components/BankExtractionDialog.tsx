// @ts-nocheck
"use client"
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Save, AlertTriangle, CheckCircle, Check, Trash, Plus, X, Eye, FileCheck, Calculator, Building } from 'lucide-react';

// --- Helper Functions ---
const normalizeCurrencyCode = (code) => {
    if (!code) return 'USD';
    const upperCode = code.toUpperCase().trim();
    const currencyMap = {
        'EURO': 'EUR', 'EUROS': 'EUR', 'US DOLLAR': 'USD', 'US DOLLARS': 'USD', 'USDOLLAR': 'USD',
        'POUND': 'GBP', 'POUNDS': 'GBP', 'STERLING': 'GBP', 'KENYA SHILLING': 'KES',
        'KENYA SHILLINGS': 'KES', 'KENYAN SHILLING': 'KES', 'KSH': 'KES', 'K.SH': 'KES',
        'KSHS': 'KES', 'K.SHS': 'KES', 'SH': 'KES'
    };
    return currencyMap[upperCode] || upperCode;
};

const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatNumberWithCommas = (value) => {
    if (value === '' || value === null || value === undefined) return '';
    const stringValue = String(value);
    const parts = stringValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
};


// --- Main Component ---

export function BankExtractionDialog({
    isOpen,
    onClose,
    bank,
    statement,
    onStatementUpdated
}: any) {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('overview');
    const [pdfUrl, setPdfUrl] = useState(null);

    const [formData, setFormData] = useState({
        bank_name: '',
        account_number: '',
        currency: '',
        statementPeriod: '',
    });
    const [monthlyBalances, setMonthlyBalances] = useState([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    useEffect(() => {
        if (isOpen && statement) {
            setIsLoading(true);
            setFormData({
                bank_name: statement.statement_extractions?.bank_name || '',
                account_number: statement.statement_extractions?.account_number || '',
                currency: statement.statement_extractions?.currency || '',
                statementPeriod: statement.statement_extractions?.statement_period || '',
            });
            setMonthlyBalances(statement.statement_extractions?.monthly_balances || []);
            loadPdfDocument();
        } else {
            setPdfUrl(null);
        }
    }, [isOpen, statement]);

    const loadPdfDocument = useCallback(async () => {
        if (!statement?.statement_document?.statement_pdf) {
            setIsLoading(false);
            return;
        }
        try {
            const { data, error } = await supabase.storage
                .from('Statement-Cycle')
                .createSignedUrl(statement.statement_document.statement_pdf, 3600);
            if (error) throw error;
            setPdfUrl(data.signedUrl);
        } catch (error) {
            console.error('Error loading PDF:', error);
            toast({ title: 'Error', description: 'Failed to load PDF document', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [statement, toast]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateBalance = (index, field, value) => {
        const newBalances = [...monthlyBalances];
        const rawValue = String(value).replace(/,/g, '');
        newBalances[index] = { ...newBalances[index], [field]: field === 'closing_balance' ? parseFloat(rawValue) || 0 : value, is_verified: false };
        setMonthlyBalances(newBalances);
    };

    const handleAddBalance = () => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const exists = monthlyBalances.some(b => b.month === currentMonth && b.year === currentYear);
        if (exists) {
            toast({ description: `Balance for ${format(new Date(currentYear, currentMonth), 'MMMM yyyy')} already exists.` });
            return;
        }
        setMonthlyBalances(prev => [...prev, { month: currentMonth, year: currentYear, closing_balance: 0, opening_balance: 0, is_verified: false }]);
    };

    const handleRemoveBalance = (index) => {
        setMonthlyBalances(prev => prev.filter((_, i) => i !== index));
    };

    const handleVerifyBalance = (index) => {
        const newBalances = [...monthlyBalances];
        newBalances[index] = { ...newBalances[index], is_verified: true, verified_by: 'current_user', verified_at: new Date().toISOString() };
        setMonthlyBalances(newBalances);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedExtractions = { ...statement.statement_extractions, ...formData, monthly_balances: monthlyBalances };
            const { data, error } = await supabase
                .from('acc_cycle_bank_statements')
                .update({ statement_extractions: updatedExtractions })
                .eq('id', statement.id)
                .select()
                .single();

            if (error) throw error;
            toast({ title: 'Success', description: 'Statement data saved successfully' });
            onStatementUpdated(data);
            onClose();
        } catch (error) {
            toast({ title: 'Save Error', description: 'Failed to save statement data', variant: 'destructive' });
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
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete bank statement', variant: 'destructive' });
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirmation(false);
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
                                <div className="text-sm text-muted-foreground">
                                    Document Size: {statement?.statement_document?.document_size ? formatFileSize(statement.statement_document.document_size) : 'N/A'}
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setShowDeleteConfirmation(true)}
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
                                    <CardHeader className="py-2"><CardTitle className="text-base">Account Details</CardTitle></CardHeader>
                                    <CardContent className="space-y-3 pt-4">
                                        {/* FIX: Restored the detailed input with badge logic */}
                                        <div className="space-y-1">
                                            <Label htmlFor="bank_name">Bank Name</Label>
                                            <div className="flex items-center gap-2">
                                                <Input id="bank_name" name="bank_name" value={formData.bank_name} onChange={handleFormChange} className={formData.bank_name && !formData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase()) ? "border-yellow-500" : ""} />
                                                {formData.bank_name && (
                                                    formData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase()) ? (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Check className="h-3 w-3 mr-1" />Match</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />Mismatch</Badge>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="account_number">Account Number</Label>
                                            <div className="flex items-center gap-2">
                                                <Input id="account_number" name="account_number" value={formData.account_number} onChange={handleFormChange} className={formData.account_number && !formData.account_number.includes(bank.account_number) ? "border-yellow-500" : ""} />
                                                {formData.account_number && (
                                                    formData.account_number.includes(bank.account_number) ? (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Check className="h-3 w-3 mr-1" />Match</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />Mismatch</Badge>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="currency">Currency</Label>
                                            <div className="flex items-center gap-2">
                                                <Input id="currency" name="currency" value={formData.currency} onChange={handleFormChange} className={formData.currency && normalizeCurrencyCode(formData.currency) !== normalizeCurrencyCode(bank.bank_currency) ? "border-yellow-500" : ""} />
                                                {formData.currency && (
                                                    normalizeCurrencyCode(formData.currency) === normalizeCurrencyCode(bank.bank_currency) ? (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Check className="h-3 w-3 mr-1" />Match</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />Mismatch</Badge>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="statementPeriod">Statement Period</Label>
                                            <Input id="statementPeriod" name="statementPeriod" value={formData.statementPeriod} onChange={handleFormChange} />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="flex-1 flex flex-col overflow-hidden">
                                    <CardHeader className="py-2 flex flex-row items-center justify-between"><CardTitle className="text-base">Monthly Balances</CardTitle><Button variant="outline" size="sm" onClick={handleAddBalance}><Plus className="h-4 w-4 mr-1" />Add</Button></CardHeader>
                                    <CardContent className="p-0 flex-1 overflow-auto">
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Closing Balance</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {monthlyBalances.length > 0 ? (
                                                    monthlyBalances.sort((a, b) => new Date(a.year, a.month) - new Date(b.year, b.month)).map((balance, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell className="font-medium">{format(new Date(balance.year, balance.month), 'MMM yyyy')}</TableCell>
                                                            <TableCell><Input type="text" value={formatNumberWithCommas(balance.closing_balance)} onChange={(e) => handleUpdateBalance(index, 'closing_balance', e.target.value)} /></TableCell>
                                                            <TableCell className="flex gap-1">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleVerifyBalance(index)} disabled={balance.is_verified}><CheckCircle className={balance.is_verified ? "h-4 w-4 text-green-500" : "h-4 w-4"} /></Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveBalance(index)}><X className="h-4 w-4" /></Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No monthly balances.</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="validation" className="flex-1 overflow-auto p-4">
                        {/* Validation content can be added here */}
                    </TabsContent>
                </Tabs>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>Close</Button>
                    <Button onClick={handleSave} disabled={isSaving || isDeleting}>
                        {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save</>}
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