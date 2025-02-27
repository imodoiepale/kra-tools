// QuickbooksBalanceDialog.tsx
import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
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
        format(new Date(cycleYear, cycleMonth - 1), 'MMMM yyyy')

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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl">Update QuickBooks Balance</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="bank-name" className="text-right">Bank</Label>
                            <span className="font-medium text-primary">{bank.bank_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="account-number" className="text-right">Account Number</Label>
                            <span className="font-medium">{bank.account_number}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="currency" className="text-right">Currency</Label>
                            <span className="font-medium">{currencyCode}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="period" className="text-right">Statement Period</Label>
                            <span className="font-medium">{statementPeriod}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="qb-balance">QuickBooks Balance ({currencyCode})</Label>
                        <Input
                            id="qb-balance"
                            type="text"
                            value={balance}
                            onChange={(e) => setBalance(e.target.value)}
                            placeholder="Enter QuickBooks balance"
                            disabled={isLoading}
                        />
                    </div>

                    {statement?.statement_extractions?.closing_balance !== null && (
                        <div className="space-y-2">
                            <Label>Bank Statement Closing Balance</Label>
                            <div className="p-2 bg-muted rounded-md font-medium">
                                {formatCurrency(statement.statement_extractions.closing_balance)}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving
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