// QuickbooksBalanceDialog.tsx
// @ts-nocheck
import { useState } from 'react'
import { Loader2, Save, Upload, AlertTriangle, Coins, UploadCloud, FileText, Sheet, Building, Landmark, CreditCard, DollarSign, Calendar, Calculator, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
}

interface BankStatement {
    id: string
    bank_id: number
    statement_month: number
    statement_year: number
    quickbooks_balance: number | null
    statement_document: {
        statement_pdf: string | null
        statement_excel: string | null
    }
    statement_extractions: {
        bank_name: string | null
        account_number: string | null
        currency: string | null
        statement_period: string | null
        opening_balance: number | null
        closing_balance: number | null
        monthly_balances: Array<any>
    }
    validation_status: {
        is_validated: boolean
        validation_date: string | null
        validated_by: string | null
        mismatches: Array<string>
    }
    has_soft_copy: boolean
    has_hard_copy: boolean
    status: {
        status: string
        assigned_to: string | null
        verification_date: string | null
    }
}

interface QuickbooksBalanceDialogProps {
    isOpen: boolean
    onClose: () => void
    bank: Bank
    statement: BankStatement | null
    cycleMonth: number
    cycleYear: number
    onBalanceUpdated: (statementId: string, balance: number) => void
}

// Helper function to normalize currency codes
const normalizeCurrencyCode = (code: string | null): string => {
    if (!code) return 'USD'; // Default fallback

    // Convert to uppercase
    const upperCode = code.toUpperCase().trim();

    // Map of common incorrect currency codes to valid ISO codes
    const currencyMap: Record<string, string> = {
        'EURO': 'EUR',
        'EUROS': 'EUR',
        'US DOLLAR': 'USD',
        'US DOLLARS': 'USD',
        'USDOLLAR': 'USD',
        'POUND': 'GBP',
        'POUNDS': 'GBP',
        'STERLING': 'GBP',
        'KENYA SHILLING': 'KES',
        'KENYA SHILLINGS': 'KES',
        'KENYAN SHILLING': 'KES',
        'KENYAN SHILLINGS': 'KES',
        'KSH': 'KES',
        'K.SH': 'KES',
        'KSHS': 'KES',
        'K.SHS': 'KES',
        'SH': 'KES'
    };

    // Return mapped value or the original if not in the map
    return currencyMap[upperCode] || upperCode;
};

export function QuickbooksBalanceDialog({
    isOpen,
    onClose,
    bank,
    statement,
    cycleMonth,
    cycleYear,
    onBalanceUpdated
}: QuickbooksBalanceDialogProps) {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [balance, setBalance] = useState<string>(
        statement?.quickbooks_balance?.toString() || ''
    )

    // Early return if statement is null
    if (!statement) {
        return null;
    }

    // Get current QuickBooks balance from statement or from the input
    const currentQbBalance = parseFloat(balance) || statement?.quickbooks_balance || null;

    const handleSave = async () => {
        try {
            setIsLoading(true)
            if (!balance) {
                toast({
                    title: "Error",
                    description: "Please enter a balance",
                    variant: "destructive",
                })
                return
            }

            const { error } = await supabase
                .from('acc_cycle_bank_statements')
                .update({
                    quickbooks_balance: parseFloat(balance)
                })
                .eq('id', statement.id)

            if (error) throw error

            onBalanceUpdated(statement.id, parseFloat(balance))
            toast({
                title: "Success",
                description: "Quickbooks balance updated successfully",
            })
            onClose()
        } catch (error) {
            console.error('Error updating quickbooks balance:', error)
            toast({
                title: "Error",
                description: "Failed to update quickbooks balance",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const statementPeriod = statement?.statement_extractions?.statement_period ||
        format(new Date(cycleYear, cycleMonth ), 'MMMM yyyy')

    const currencyCode = normalizeCurrencyCode(
        statement?.statement_extractions?.currency || bank.bank_currency
    )

    // Safely format currency
    const formatCurrency = (amount: number | null) => {
        if (amount === null || amount === undefined) return '-';

        try {
            // Normalize the currency code
            const normalizedCurrency = normalizeCurrencyCode(currencyCode);

            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: normalizedCurrency,
                minimumFractionDigits: 2
            }).format(amount);
        } catch (error) {
            // Fallback if there's still an error with the currency code
            console.warn(`Invalid currency code: ${currencyCode}. Falling back to plain number format.`);
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => {
            if (!isLoading) onClose()
        }}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <div className="bg-gradient-to-r from-emerald-50 via-emerald-100 to-emerald-50 -mx-6 -mt-6 p-6 rounded-t-lg border-b border-emerald-200">
                        <div className="mb-2 flex justify-center">
                            <div className="h-14 w-14 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shadow-sm">
                                <DollarSign className="h-7 w-7 text-emerald-600" />
                            </div>
                        </div>
                        <DialogTitle className="text-center text-xl text-emerald-800">Update QuickBooks Balance</DialogTitle>
                        <p className="text-center text-emerald-600 text-sm mt-1">
                            {bank.company_name}
                        </p>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-4 mt-2">
                    <div className="bg-gradient-to-r from-emerald-50/80 to-emerald-50/40 rounded-md p-4 border border-emerald-100 shadow-sm">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            <div className="col-span-2">
                                <h3 className="text-sm font-medium text-emerald-800 border-b border-emerald-100 pb-1 mb-2">Account Information</h3>
                                <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4 text-emerald-600" />
                                    <span className="font-medium">{bank.company_name}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-emerald-800 border-b border-emerald-100 pb-1 mb-2">Bank Details</h3>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Landmark className="h-4 w-4 text-emerald-600" />
                                        <span className="font-medium">{bank.bank_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4 text-emerald-600" />
                                        <span className="font-mono text-xs">{bank.account_number}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-emerald-800 border-b border-emerald-100 pb-1 mb-2">Statement Period</h3>
                                <div className="flex gap-2">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-emerald-600" />
                                        <span className="font-medium">
                                            {statementPeriod || format(new Date(cycleYear, cycleMonth ), 'MMMM yyyy')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-emerald-100/50 px-2 py-0.5 rounded text-xs text-emerald-700 border border-emerald-200">
                                        <Coins className="h-3 w-3" />
                                        {currencyCode}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="qb-balance" className="flex items-center gap-1.5 text-emerald-900">
                            <Calculator className="h-4 w-4 text-emerald-600" />
                            QuickBooks Balance ({currencyCode})
                        </Label>
                        <div className="relative">
                            <Input
                                id="qb-balance"
                                type="text"
                                value={balance}
                                onChange={(e) => setBalance(e.target.value)}
                                placeholder="Enter QuickBooks balance"
                                disabled={isLoading}
                                className="pl-8 py-5 text-lg focus:border-emerald-400 focus:ring-emerald-300"
                            />
                            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-600">
                                <DollarSign className="h-4 w-4" />
                            </div>
                        </div>
                    </div>

                    {statement?.statement_extractions?.closing_balance !== null && (
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5 text-blue-800">
                                <FileText className="h-4 w-4 text-blue-600" />
                                Bank Statement Closing Balance
                            </Label>
                            <div className="bg-blue-50/70 p-3 rounded-md border border-blue-200 font-medium flex justify-between items-center">
                                <span className="text-blue-700">Current Statement Balance:</span>
                                <span className="text-lg">{formatCurrency(statement.statement_extractions.closing_balance)}</span>
                            </div>

                            {currentQbBalance !== null && statement.statement_extractions.closing_balance !== null && (
                                <div className={`mt-3 p-3 rounded-md border flex justify-between items-center
                ${Math.abs(statement.statement_extractions.closing_balance - currentQbBalance) > 0.01 ?
                                        'bg-red-50/70 border-red-200 text-red-700' :
                                        'bg-green-50/70 border-green-200 text-green-700'}`}>
                                    <span className="flex items-center gap-1 font-medium">
                                        {Math.abs(statement.statement_extractions.closing_balance - currentQbBalance) > 0.01 ? (
                                            <>
                                                <AlertTriangle className="h-4 w-4" />
                                                Difference:
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4" />
                                                Reconciled:
                                            </>
                                        )}
                                    </span>
                                    <span className="text-lg font-medium">
                                        {formatCurrency(statement.statement_extractions.closing_balance - currentQbBalance)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="bg-gradient-to-r from-slate-50 to-emerald-50 -mx-6 -mb-6 p-4 border-t flex items-center justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                        className="border-gray-300 hover:bg-slate-100"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 px-6"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Balance
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}