// @ts-nocheck
"use client"

import { useState, useEffect } from 'react'; // FIX: Added useEffect to the import
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Coins, AlertTriangle, CheckCircle, DollarSign, Calendar, Calculator, FileText, Building, Landmark, CreditCard } from 'lucide-react';

// Interfaces...
interface Bank {
    id: number;
    bank_name: string;
    account_number: string;
    bank_currency: string;
    company_id: number;
    company_name: string;
}

interface BankStatement {
    id: string;
    status: {
        quickbooks_balance?: number;
    };
    statement_extractions: {
        closing_balance?: number;
        currency?: string;
    };
    // other properties
}

interface QuickbooksBalanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    bank: Bank;
    statement: BankStatement | null;
    onBalanceUpdated: () => void;
}


const normalizeCurrencyCode = (code: string | null): string => {
    if (!code) return 'USD';
    const upperCode = code.toUpperCase().trim();
    const currencyMap: Record<string, string> = {
        'EURO': 'EUR', 'EUROS': 'EUR', 'US DOLLAR': 'USD', 'US DOLLARS': 'USD',
        'USDOLLAR': 'USD', 'POUND': 'GBP', 'POUNDS': 'GBP', 'STERLING': 'GBP',
        'KENYA SHILLING': 'KES', 'KENYA SHILLINGS': 'KES', 'KENYAN SHILLING': 'KES',
        'KENYAN SHILLINGS': 'KES', 'KSH': 'KES', 'K.SH': 'KES', 'KSHS': 'KES',
        'K.SHS': 'KES', 'SH': 'KES'
    };
    return currencyMap[upperCode] || upperCode;
};

export function QuickbooksBalanceDialog({
    isOpen,
    onClose,
    bank,
    statement,
    onBalanceUpdated
}: QuickbooksBalanceDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [balance, setBalance] = useState<string>('');

    useEffect(() => {
        if (statement) {
            setBalance(statement.status?.quickbooks_balance?.toString() || '');
        }
    }, [statement]);

    if (!statement) return null;

    const handleSave = async () => {
        setIsLoading(true);
        if (balance === '' || isNaN(parseFloat(balance))) {
            toast({ title: "Invalid Input", description: "Please enter a valid number.", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        try {
            const newStatus = { ...statement.status, quickbooks_balance: parseFloat(balance) };
            const { error } = await supabase
                .from('acc_cycle_bank_statements')
                .update({ status: newStatus })
                .eq('id', statement.id);

            if (error) throw error;

            toast({ title: "Success", description: "QuickBooks balance updated." });
            onBalanceUpdated();
            onClose();
        } catch (error) {
            console.error('Error updating QuickBooks balance:', error);
            toast({ title: "Error", description: "Failed to update QuickBooks balance.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const currentQbBalance = parseFloat(balance);
    const statementClosingBalance = statement.statement_extractions?.closing_balance;
    const currencyCode = normalizeCurrencyCode(statement.statement_extractions?.currency || bank.bank_currency);

    const formatCurrency = (amount: number | null) => {
        if (amount === null || amount === undefined || isNaN(amount)) return '-';
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2 }).format(amount);
        } catch (error) {
            return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <div className="bg-gradient-to-r from-emerald-50 via-emerald-100 to-emerald-50 -mx-6 -mt-6 p-6 rounded-t-lg border-b border-emerald-200">
                        <div className="mb-2 flex justify-center"><div className="h-14 w-14 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shadow-sm"><DollarSign className="h-7 w-7 text-emerald-600" /></div></div>
                        <DialogTitle className="text-center text-xl text-emerald-800">Update QuickBooks Balance</DialogTitle>
                        <p className="text-center text-emerald-600 text-sm mt-1">{bank.company_name}</p>
                    </div>
                </DialogHeader>
                <div className="space-y-4 py-4 mt-2">
                    <div className="space-y-2">
                        <Label htmlFor="qb-balance" className="flex items-center gap-1.5 text-emerald-900"><Calculator className="h-4 w-4 text-emerald-600" />QuickBooks Balance ({currencyCode})</Label>
                        <div className="relative">
                            <Input id="qb-balance" type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Enter QuickBooks balance" disabled={isLoading} className="pl-8 py-5 text-lg" />
                            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-600"><DollarSign className="h-4 w-4" /></div>
                        </div>
                    </div>
                    {statementClosingBalance != null && (
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5 text-blue-800"><FileText className="h-4 w-4 text-blue-600" />Bank Statement Closing Balance</Label>
                            <div className="bg-blue-50/70 p-3 rounded-md border border-blue-200 font-medium flex justify-between items-center">
                                <span className="text-blue-700">Statement Balance:</span>
                                <span className="text-lg">{formatCurrency(statementClosingBalance)}</span>
                            </div>
                            {!isNaN(currentQbBalance) && (
                                <div className={`mt-3 p-3 rounded-md border flex justify-between items-center ${Math.abs(statementClosingBalance - currentQbBalance) > 0.01 ? 'bg-red-50/70 border-red-200 text-red-700' : 'bg-green-50/70 border-green-200 text-green-700'}`}>
                                    <span className="flex items-center gap-1 font-medium">
                                        {Math.abs(statementClosingBalance - currentQbBalance) > 0.01 ? <><AlertTriangle className="h-4 w-4" />Difference:</> : <><CheckCircle className="h-4 w-4" />Reconciled:</>}
                                    </span>
                                    <span className="text-lg font-medium">{formatCurrency(statementClosingBalance - currentQbBalance)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter className="bg-gradient-to-r from-slate-50 to-emerald-50 -mx-6 -mb-6 p-4 border-t flex items-center justify-between">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button type="button" onClick={handleSave} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 px-6">
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Balance</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}