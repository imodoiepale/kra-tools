// BankReconciliationTable.tsx
'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Loader2, Download, UploadCloud, Edit, ChevronDown, Eye, CheckCircle, XCircle, AlertTriangle, MoreHorizontal } from 'lucide-react'
import { BankStatementUploadDialog } from './components/BankStatementUploadDialog'
import { BankExtractionDialog } from './components/BankExtractionDialog'
import { QuickbooksBalanceDialog } from './components/QuickbooksBalanceDialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"

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
        monthly_balances: Array<{
            month: number
            year: number
            closing_balance: number
            opening_balance: number
            statement_page: number
            highlight_coordinates: {
                x1: number
                y1: number
                x2: number
                y2: number
                page: number
            }
            is_verified: boolean
            verified_by: string | null
            verified_at: string | null
        }>
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

interface BankReconciliationTableProps {
    selectedYear: number
    selectedMonth: number
    searchTerm: string
    setSearchTerm: (term: string) => void
    onStatsChange: () => void
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

export default function BankReconciliationTable({
    selectedYear,
    selectedMonth,
    searchTerm,
    setSearchTerm,
    onStatsChange
}: BankReconciliationTableProps) {
    const [loading, setLoading] = useState<boolean>(true)
    const [banks, setBanks] = useState<Bank[]>([])
    const [bankStatements, setBankStatements] = useState<BankStatement[]>([])
    const [uploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false)
    const [selectedBank, setSelectedBank] = useState<Bank | null>(null)
    const [extractionDialogOpen, setExtractionDialogOpen] = useState<boolean>(false)
    const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null)
    const [quickbooksDialogOpen, setQuickbooksDialogOpen] = useState<boolean>(false)
    const [payrollCycleId, setPayrollCycleId] = useState<string | null>(null)

    const { toast } = useToast()

    // Fetch payroll cycle ID for current month/year
    useEffect(() => {
        const fetchPayrollCycle = async () => {
            const monthStr = selectedMonth.toString().padStart(2, '0')
            const cycleMonthYear = `${selectedYear}-${monthStr}`

            const { data, error } = await supabase
                .from('payroll_cycles')
                .select('id')
                .eq('month_year', cycleMonthYear)
                .single()

            if (error && error.code !== 'PGRST116') {
                // PGRST116 is "No rows returned" error, which is expected if no cycle exists
                console.error('Error fetching payroll cycle:', error)
            }

            setPayrollCycleId(data?.id || null)
            console.log('Fetched payrollCycleId:', data?.id) // Debugging line
        }

        fetchPayrollCycle()
    }, [selectedMonth, selectedYear])

    // Fetch banks and statements
    useEffect(() => {
        const fetchBanksAndStatements = async () => {
            setLoading(true)
            try {
                // Fetch banks
                const { data: banksData, error: banksError } = await supabase
                    .from('acc_portal_banks')
                    .select('id, bank_name, account_number, bank_currency, company_id, company_name')
                    .ilike('company_name', `%${searchTerm}%`)
                    .order('company_name', { ascending: true })

                if (banksError) throw banksError
                console.log('Fetched banks:', banksData) // Debugging line

                // Only fetch statements if we have a payroll cycle ID
                let statementsData: BankStatement[] = []

                if (payrollCycleId) {
                    // Fetch bank statements for the selected month/year
                    const { data: fetchedStatementsData, error: statementsError } = await supabase
                        .from('acc_cycle_bank_statements')
                        .select('*')
                        .eq('payroll_cycle_id', payrollCycleId)

                    if (statementsError) throw statementsError
                    statementsData = fetchedStatementsData || []
                    console.log('Fetched bank statements:', fetchedStatementsData) // Debugging line
                }

                setBanks(banksData || [])
                setBankStatements(statementsData)
            } catch (error) {
                console.error('Error fetching data:', error)
                toast({
                    title: 'Error',
                    description: 'Failed to fetch banks and statements',
                    variant: 'destructive'
                })
            } finally {
                setLoading(false)
            }
        }

        fetchBanksAndStatements()
    }, [payrollCycleId, searchTerm, toast])

    // Group banks by company for row spanning
    const banksByCompany = useMemo(() => {
        const groupedBanks = new Map<string, Bank[]>()

        banks.forEach(bank => {
            const existingBanks = groupedBanks.get(bank.company_name) || []
            groupedBanks.set(bank.company_name, [...existingBanks, bank])
        })

        return Array.from(groupedBanks.entries()).map(([companyName, banksList]) => ({
            companyName,
            banks: banksList
        }))
    }, [banks])

    // Filter and merge banks with statements
    const banksWithStatements = useMemo(() => {
        return banks.map(bank => {
            const bankStatement = bankStatements.find(statement => statement.bank_id === bank.id)
            return {
                ...bank,
                statement: bankStatement || null
            }
        })
    }, [banks, bankStatements])

    const handleUploadStatement = async (bankId: number) => {
        const bank = banks.find(b => b.id === bankId)
        if (bank) {
            setSelectedBank(bank)
            setUploadDialogOpen(true)
        }
    }

    const handleViewStatement = (bankId: number) => {
        const bank = banks.find(b => b.id === bankId)
        const statement = bankStatements.find(s => s.bank_id === bankId)

        if (bank && statement) {
            setSelectedBank(bank)
            setSelectedStatement(statement)
            setExtractionDialogOpen(true)
        }
    }

    const handleQuickbooksBalance = (bankId: number) => {
        const bank = banks.find(b => b.id === bankId)
        const statement = bankStatements.find(s => s.bank_id === bankId)

        if (bank && statement) {
            setSelectedBank(bank)
            setSelectedStatement(statement)
            setQuickbooksDialogOpen(true)
        } else {
            toast({
                title: "Error",
                description: "No statement found for this bank",
                variant: "destructive",
            })
        }
    }

    const handleStatementUploaded = (newStatement: BankStatement) => {
        setBankStatements(prev => {
            const exists = prev.some(s => s.id === newStatement.id)
            if (exists) {
                return prev.map(s => s.id === newStatement.id ? newStatement : s)
            } else {
                return [...prev, newStatement]
            }
        })
        setUploadDialogOpen(false)
        onStatsChange()
        toast({
            title: 'Success',
            description: 'Bank statement uploaded successfully'
        })
    }

    const handleQuickbooksBalanceUpdated = (statementId: string, balance: number) => {
        setBankStatements(prev =>
            prev.map(s => s.id === statementId
                ? { ...s, quickbooks_balance: balance }
                : s
            )
        )
        setQuickbooksDialogOpen(false)
        onStatsChange()
        toast({
            title: 'Success',
            description: 'QuickBooks balance updated successfully'
        })
    }

    const getValidationStatusIcon = (statement: BankStatement | null) => {
        if (!statement) return null
        if (!statement.statement_document.statement_pdf) return null

        if (statement.validation_status.is_validated) {
            return <CheckCircle className="h-4 w-4 text-green-500" />
        } else if (statement.validation_status.mismatches.length > 0) {
            return <AlertTriangle className="h-4 w-4 text-amber-500" />
        }
        return null
    }

    const formatCurrency = (amount: number | null, currency: string) => {
        if (amount === null) return '-';

        try {
            // Normalize the currency code
            const normalizedCurrency = normalizeCurrencyCode(currency);

            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: normalizedCurrency,
                minimumFractionDigits: 2
            }).format(amount);
        } catch (error) {
            // Fallback if there's still an error with the currency code
            console.warn(`Invalid currency code: ${currency}. Falling back to plain number format.`);
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end items-center">
                <div className="flex items-center gap-4">
                    <Input
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                    />
                </div>
            </div>

            <div className="rounded-md border h-[calc(100vh-220px)] overflow-auto">
                <Table aria-label="Bank Reconciliation" className="border border-gray-200">
                    <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-blue-600 hover:bg-blue-600 [&>th]:border-r [&>th]:border-blue-500 last:[&>th]:border-r-0">
                            <TableHead className="text-white font-semibold w-[40px] text-center">No.</TableHead>
                            <TableHead className="text-white font-semibold w-[200px]">Company</TableHead>
                            <TableHead className="text-white font-semibold w-[180px]">Bank</TableHead>
                            <TableHead className="text-white font-semibold w-[150px]">Account Number</TableHead>
                            <TableHead className="text-white font-semibold w-[100px]">Currency</TableHead>
                            <TableHead className="text-white font-semibold w-[150px]">Bank Statement</TableHead>
                            <TableHead className="text-white font-semibold w-[150px]">Closing Balance</TableHead>
                            <TableHead className="text-white font-semibold w-[150px]">QuickBooks Balance</TableHead>
                            <TableHead className="text-white font-semibold w-[150px]">Difference</TableHead>
                            <TableHead className="text-white font-semibold w-[100px]">Status</TableHead>
                            <TableHead className="text-white font-semibold w-[120px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : banksByCompany.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-8">
                                    No banks found
                                </TableCell>
                            </TableRow>
                        ) : (
                            banksByCompany.map((company, companyIndex) => (
                                company.banks.map((bank, bankIndex) => {
                                    const statement = bankStatements.find(s => s.bank_id === bank.id);
                                    const closingBalance = statement?.statement_extractions?.closing_balance;
                                    const qbBalance = statement?.quickbooks_balance;
                                    const difference = closingBalance !== null && qbBalance !== null
                                        ? closingBalance - qbBalance
                                        : null;

                                    return (
                                        <TableRow
                                            key={bank.id}
                                            className={`${bankIndex % 2 === 0 ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'} [&>td]:border-r [&>td]:border-gray-200 last:[&>td]:border-r-0`}
                                        >
                                            {bankIndex === 0 && (
                                                <>
                                                    <TableCell
                                                        className="font-medium text-center border-r border-gray-200"
                                                        rowSpan={company.banks.length}
                                                    >
                                                        {companyIndex + 1}
                                                    </TableCell>
                                                    <TableCell
                                                        className="font-medium border-r border-gray-200"
                                                        rowSpan={company.banks.length}
                                                    >
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger className=" ">
                                                                    {(company.companyName || 'Unknown Company').split(" ").slice(0, 3).join(" ")}
                                                                </TooltipTrigger>
                                                                <TooltipContent>{company.companyName || 'Unknown Company'}</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </TableCell>
                                                </>
                                            )}
                                            <TableCell className="border-r border-gray-200">{bank.bank_name}</TableCell>
                                            <TableCell className="border-r border-gray-200 font-mono text-sm">
                                                {bank.account_number}
                                            </TableCell>
                                            <TableCell className="border-r border-gray-200">
                                                {normalizeCurrencyCode(bank.bank_currency)}
                                            </TableCell>
                                            <TableCell className="border-r border-gray-200">
                                                {statement?.statement_document.statement_pdf ? (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="flex gap-1 items-center"
                                                                    onClick={() => handleViewStatement(bank.id)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                    View
                                                                    {getValidationStatusIcon(statement)}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {statement.validation_status.is_validated
                                                                    ? 'Validated'
                                                                    : statement.validation_status.mismatches.length > 0
                                                                        ? 'Validation issues found'
                                                                        : 'Not validated'}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex gap-1 items-center"
                                                        onClick={() => handleUploadStatement(bank.id)}
                                                    >
                                                        <UploadCloud className="h-4 w-4" />
                                                        Upload
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell className="border-r border-gray-200 text-right">
                                                {closingBalance !== null
                                                    ? formatCurrency(closingBalance, bank.bank_currency)
                                                    : '-'}
                                            </TableCell>
                                            <TableCell className="border-r border-gray-200">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex-1 text-right">
                                                        {qbBalance !== null
                                                            ? formatCurrency(qbBalance, bank.bank_currency)
                                                            : '-'}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => handleQuickbooksBalance(bank.id)}
                                                    >
                                                        <Edit className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell
                                                className={`border-r border-gray-200 text-right ${difference !== null
                                                    ? Math.abs(difference) > 0.01
                                                        ? 'text-red-500 font-bold'
                                                        : 'text-green-500 font-bold'
                                                    : ''
                                                    }`}
                                            >
                                                {difference !== null
                                                    ? formatCurrency(difference, bank.bank_currency)
                                                    : '-'}
                                            </TableCell>
                                            <TableCell className="border-r border-gray-200">
                                                {statement?.status.status || 'Pending'}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        <DropdownMenuItem
                                                            onClick={() => handleViewStatement(bank.id)}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                            View Statement
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => handleUploadStatement(bank.id)}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <UploadCloud className="h-4 w-4" />
                                                            {statement?.statement_document.statement_pdf ? 'Replace' : 'Upload'} Statement
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleQuickbooksBalance(bank.id)}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                            Update QB Balance
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {selectedBank && (
                <BankStatementUploadDialog
                    isOpen={uploadDialogOpen}
                    onClose={() => setUploadDialogOpen(false)}
                    bank={selectedBank}
                    cycleMonth={selectedMonth}
                    cycleYear={selectedYear}
                    onStatementUploaded={handleStatementUploaded}
                    existingStatement={bankStatements.find(s => s.bank_id === selectedBank.id) || null}
                    payrollCycleId={payrollCycleId}
                />
            )}

            {selectedBank && selectedStatement && (
                <BankExtractionDialog
                    isOpen={extractionDialogOpen}
                    onClose={() => setExtractionDialogOpen(false)}
                    bank={selectedBank}
                    statement={selectedStatement}
                    onStatementUpdated={(updatedStatement) => {
                        setBankStatements(prev =>
                            prev.map(s => s.id === updatedStatement.id ? updatedStatement : s)
                        )
                    }}
                />
            )}

            {selectedBank && (
                <QuickbooksBalanceDialog
                    isOpen={quickbooksDialogOpen}
                    onClose={() => {
                        setQuickbooksDialogOpen(false)
                        setSelectedBank(null)
                        setSelectedStatement(null)
                    }}
                    bank={selectedBank!}
                    statement={selectedStatement!}
                    cycleMonth={selectedMonth}
                    cycleYear={selectedYear}
                    onBalanceUpdated={handleQuickbooksBalanceUpdated}
                />
            )}
        </div>
    );
}