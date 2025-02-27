// BankExtractionDialog.tsx
import { useState, useEffect, useRef } from 'react'
import { Loader2, Save, RotateCw, Check, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { performBankStatementExtraction } from '@/lib/bankExtractionUtils'

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
}

interface MonthlyBalance {
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
        monthly_balances: MonthlyBalance[]
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

interface BankExtractionDialogProps {
    isOpen: boolean
    onClose: () => void
    bank: Bank
    statement: BankStatement
    onStatementUpdated: (statement: BankStatement) => void
}

export function BankExtractionDialog({
    isOpen,
    onClose,
    bank,
    statement,
    onStatementUpdated
}: BankExtractionDialogProps) {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)

    // Early return if no statement is provided
    if (!statement || !bank) {
        return null;
    }

    const [activeTab, setActiveTab] = useState<string>('overview')
    const [pdfUrl, setPdfUrl] = useState<string>('')
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [totalPages, setTotalPages] = useState<number>(1)
    const [loading, setLoading] = useState<boolean>(true)
    const [extracting, setExtracting] = useState<boolean>(false)
    const [saving, setSaving] = useState<boolean>(false)
    const [selectedMonth, setSelectedMonth] = useState<number>(statement.statement_month)
    const [selectedYear, setSelectedYear] = useState<number>(statement.statement_year)

    // Editable extraction fields
    const [bankName, setBankName] = useState<string>(statement.statement_extractions.bank_name || '')
    const [accountNumber, setAccountNumber] = useState<string>(statement.statement_extractions.account_number || '')
    const [currency, setCurrency] = useState<string>(statement.statement_extractions.currency || '')
    const [openingBalance, setOpeningBalance] = useState<string>(
        statement.statement_extractions.opening_balance !== null
            ? statement.statement_extractions.opening_balance.toString()
            : ''
    )
    const [closingBalance, setClosingBalance] = useState<string>(
        statement.statement_extractions.closing_balance !== null
            ? statement.statement_extractions.closing_balance.toString()
            : ''
    )
    const [monthlyBalances, setMonthlyBalances] = useState<MonthlyBalance[]>(
        statement.statement_extractions.monthly_balances || []
    )

    const iframeRef = useRef<HTMLIFrameElement>(null)

    const handleClose = () => {
        if (!isLoading) {
            onClose()
        }
    }

    // Load PDF document
    useEffect(() => {
        const loadPdf = async () => {
            if (!statement.statement_document.statement_pdf) {
                setLoading(false)
                return
            }

            try {
                setLoading(true)

                // Get public URL for the PDF
                const { data, error } = await supabase.storage
                    .from('Payroll-Cycle')
                    .createSignedUrl(statement.statement_document.statement_pdf, 3600)

                if (error) throw error

                setPdfUrl(data.signedUrl)
            } catch (error) {
                console.error('Error loading PDF:', error)
                toast({
                    title: 'Error',
                    description: 'Failed to load PDF document',
                    variant: 'destructive'
                })
            } finally {
                setLoading(false)
            }
        }

        if (isOpen) {
            loadPdf()
        }
    }, [isOpen, statement.statement_document.statement_pdf, toast])

    // Handle PDF loading in iframe
    useEffect(() => {
        const handlePdfLoaded = () => {
            if (iframeRef.current) {
                // Try to access PDF document info through iframe
                try {
                    // This requires iframe to have same origin policy
                    // Alternative: use a PDF.js viewer with messaging
                    setTotalPages(1) // Placeholder, actual implementation depends on PDF viewer
                } catch (error) {
                    console.error('Cannot access PDF document info in iframe:', error)
                }
            }
        }

        const iframe = iframeRef.current
        if (iframe) {
            iframe.addEventListener('load', handlePdfLoaded)
            return () => {
                iframe.removeEventListener('load', handlePdfLoaded)
            }
        }
    }, [pdfUrl])

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return
        setCurrentPage(newPage)

        // Update iframe src with page parameter
        if (iframeRef.current && pdfUrl) {
            // Add page parameter to URL or use PDF viewer API
            // This implementation depends on the PDF viewer being used
            iframeRef.current.src = `${pdfUrl}#page=${newPage}`
        }
    }

    const handleExtract = async () => {
        if (!pdfUrl) {
            toast({
                title: 'Error',
                description: 'No PDF document available for extraction',
                variant: 'destructive'
            })
            return
        }

        try {
            setExtracting(true)

            // Perform extraction
            const extractionResult = await performBankStatementExtraction(
                pdfUrl,
                {
                    month: selectedMonth,
                    year: selectedYear
                }
            )

            // Update state with extracted data
            setBankName(extractionResult.extractedData.bank_name || '')
            setAccountNumber(extractionResult.extractedData.account_number || '')
            setCurrency(extractionResult.extractedData.currency || '')
            setOpeningBalance(extractionResult.extractedData.opening_balance !== null
                ? extractionResult.extractedData.opening_balance.toString()
                : '')
            setClosingBalance(extractionResult.extractedData.closing_balance !== null
                ? extractionResult.extractedData.closing_balance.toString()
                : '')

            // Merge new monthly balances with existing ones
            if (extractionResult.extractedData.monthly_balances?.length > 0) {
                setMonthlyBalances(prev => {
                    const newBalances = [...prev]

                    // Update or add new monthly balances
                    extractionResult.extractedData.monthly_balances.forEach(newBalance => {
                        const existingIndex = newBalances.findIndex(
                            b => b.month === newBalance.month && b.year === newBalance.year
                        )

                        if (existingIndex >= 0) {
                            newBalances[existingIndex] = {
                                ...newBalances[existingIndex],
                                ...newBalance,
                                is_verified: false,
                                verified_by: null,
                                verified_at: null
                            }
                        } else {
                            newBalances.push({
                                ...newBalance,
                                is_verified: false,
                                verified_by: null,
                                verified_at: null
                            })
                        }
                    })

                    return newBalances
                })
            }

            toast({
                title: 'Success',
                description: 'Data extracted successfully',
            })
        } catch (error) {
            console.error('Extraction error:', error)
            toast({
                title: 'Extraction Error',
                description: 'Failed to extract data from the document',
                variant: 'destructive'
            })
        } finally {
            setExtracting(false)
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)

            // Prepare updated extraction data
            const updatedExtractions = {
                bank_name: bankName || null,
                account_number: accountNumber || null,
                currency: currency || null,
                statement_period: statement.statement_extractions.statement_period,
                opening_balance: openingBalance ? parseFloat(openingBalance) : null,
                closing_balance: closingBalance ? parseFloat(closingBalance) : null,
                monthly_balances: monthlyBalances
            }

            // Validate bank details match expected values
            const hasMismatches = []
            if (bankName && !bankName.toLowerCase().includes(bank.bank_name.toLowerCase())) {
                hasMismatches.push(`Bank name mismatch: Expected "${bank.bank_name}", found "${bankName}"`)
            }
            if (accountNumber && !accountNumber.includes(bank.account_number)) {
                hasMismatches.push(`Account number mismatch: Expected "${bank.account_number}", found "${accountNumber}"`)
            }
            if (currency && currency !== bank.bank_currency) {
                hasMismatches.push(`Currency mismatch: Expected "${bank.bank_currency}", found "${currency}"`)
            }

            // Update validation status
            const validationStatus = {
                is_validated: hasMismatches.length === 0,
                validation_date: new Date().toISOString(),
                validated_by: null, // TODO: Add user info when authentication is implemented
                mismatches: hasMismatches
            }

            // Update statement status
            const statusUpdate = {
                status: hasMismatches.length === 0 ? 'validated' : 'validation_issues',
                verification_date: new Date().toISOString(),
                assigned_to: statement.status.assigned_to
            }

            // Update database
            const { data, error } = await supabase
                .from('acc_cycle_bank_statements ')
                .update({
                    statement_extractions: updatedExtractions,
                    validation_status: validationStatus,
                    status: statusUpdate
                })
                .eq('id', statement.id)
                .select('*')
                .single()

            if (error) throw error

            // Notify parent component
            onStatementUpdated(data)

            toast({
                title: 'Success',
                description: 'Statement data saved successfully'
            })
        } catch (error) {
            console.error('Save error:', error)
            toast({
                title: 'Save Error',
                description: 'Failed to save statement data',
                variant: 'destructive'
            })
        } finally {
            setSaving(false)
        }
    }

    const handleVerifyMonthlyBalance = (index: number) => {
        setMonthlyBalances(prev => {
            const updated = [...prev]
            updated[index] = {
                ...updated[index],
                is_verified: true,
                verified_by: "Current User", // TODO: Replace with actual user info
                verified_at: new Date().toISOString()
            }
            return updated
        })
    }

    const renderHighlight = () => {
        // Find the monthly balance for the current page
        const highlightForPage = monthlyBalances.find(
            balance => balance.highlight_coordinates?.page === currentPage
        )

        if (!highlightForPage || !highlightForPage.highlight_coordinates) {
            return null
        }

        const { x1, y1, x2, y2 } = highlightForPage.highlight_coordinates

        // Return a div positioned absolutely over the PDF content
        return (
            <div
                className="absolute border-2 border-yellow-500 bg-yellow-200 bg-opacity-30 pointer-events-none"
                style={{
                    left: `${x1}px`,
                    top: `${y1}px`,
                    width: `${x2 - x1}px`,
                    height: `${y2 - y1}px`
                }}
            />
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose} className="max-w-7xl">
            <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        Bank Statement - {bank.bank_name} {bank.account_number}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="monthly">Monthly Balances</TabsTrigger>
                        <TabsTrigger value="validation">Validation</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="flex-1 flex flex-col overflow-hidden">
                        <div className="grid grid-cols-5 gap-4 h-full">
                            {/* PDF Viewer - 3 columns */}
                            <div className="col-span-3 h-full flex flex-col">
                                <div className="border rounded bg-muted relative h-full overflow-hidden">
                                    {loading ? (
                                        <div className="flex items-center justify-center h-full">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        </div>
                                    ) : pdfUrl ? (
                                        <>
                                            <iframe
                                                ref={iframeRef}
                                                src={pdfUrl}
                                                className="w-full h-full border-0"
                                                title="Bank Statement PDF"
                                            />
                                            {renderHighlight()}
                                        </>
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <p className="text-muted-foreground">No PDF document available</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between mt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage <= 1 || loading}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>

                                    <span className="text-sm">
                                        Page {currentPage} of {totalPages}
                                    </span>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage >= totalPages || loading}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>

                            {/* Extraction Form - 2 columns */}
                            <div className="col-span-2 border rounded p-4 space-y-4 overflow-y-auto">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">Extracted Information</h3>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleExtract}
                                        disabled={!pdfUrl || extracting}
                                    >
                                        {extracting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                Extracting...
                                            </>
                                        ) : (
                                            <>
                                                <RotateCw className="h-4 w-4 mr-1" />
                                                Re-Extract Data
                                            </>
                                        )}
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="statement-month">Statement Month</Label>
                                        <Select
                                            value={selectedMonth.toString()}
                                            onValueChange={(value) => setSelectedMonth(parseInt(value))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select month" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                                    <SelectItem key={month} value={month.toString()}>
                                                        {format(new Date(2023, month - 1, 1), 'MMMM')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="statement-year">Statement Year</Label>
                                        <Select
                                            value={selectedYear.toString()}
                                            onValueChange={(value) => setSelectedYear(parseInt(value))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                                                    <SelectItem key={year} value={year.toString()}>
                                                        {year}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="bank-name">Bank Name</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="bank-name"
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                            placeholder="Enter bank name"
                                            className={
                                                bankName && !bankName.toLowerCase().includes(bank.bank_name.toLowerCase())
                                                    ? "border-yellow-500 focus-visible:ring-yellow-500"
                                                    : ""
                                            }
                                        />
                                        {bankName && (
                                            bankName.toLowerCase().includes(bank.bank_name.toLowerCase()) ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                    <Check className="h-3 w-3 mr-1" />
                                                    Match
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                                    Mismatch
                                                </Badge>
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="account-number">Account Number</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="account-number"
                                            value={accountNumber}
                                            onChange={(e) => setAccountNumber(e.target.value)}
                                            placeholder="Enter account number"
                                            className={
                                                accountNumber && !accountNumber.includes(bank.account_number)
                                                    ? "border-yellow-500 focus-visible:ring-yellow-500"
                                                    : ""
                                            }
                                        />
                                        {accountNumber && (
                                            accountNumber.includes(bank.account_number) ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                    <Check className="h-3 w-3 mr-1" />
                                                    Match
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                                    Mismatch
                                                </Badge>
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="currency">Currency</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="currency"
                                            value={currency}
                                            onChange={(e) => setCurrency(e.target.value)}
                                            placeholder="Enter currency"
                                            className={
                                                currency && currency !== bank.bank_currency
                                                    ? "border-yellow-500 focus-visible:ring-yellow-500"
                                                    : ""
                                            }
                                        />
                                        {currency && (
                                            currency === bank.bank_currency ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                    <Check className="h-3 w-3 mr-1" />
                                                    Match
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                                    Mismatch
                                                </Badge>
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="opening-balance">Opening Balance</Label>
                                        <Input
                                            id="opening-balance"
                                            value={openingBalance}
                                            onChange={(e) => setOpeningBalance(e.target.value)}
                                            placeholder="Enter opening balance"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor="closing-balance">Closing Balance</Label>
                                        <Input
                                            id="closing-balance"
                                            value={closingBalance}
                                            onChange={(e) => setClosingBalance(e.target.value)}
                                            placeholder="Enter closing balance"
                                        />
                                    </div>
                                </div>

                                {statement.quickbooks_balance !== null && closingBalance && (
                                    <div className="p-4 bg-muted rounded-md">
                                        <h4 className="font-medium mb-2">Balance Reconciliation</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Bank Statement</p>
                                                <p className="font-medium">
                                                    {new Intl.NumberFormat('en-US', {
                                                        style: 'currency',
                                                        currency: bank.bank_currency,
                                                        minimumFractionDigits: 2
                                                    }).format(parseFloat(closingBalance))}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">QuickBooks</p>
                                                <p className="font-medium">
                                                    {new Intl.NumberFormat('en-US', {
                                                        style: 'currency',
                                                        currency: bank.bank_currency,
                                                        minimumFractionDigits: 2
                                                    }).format(statement.quickbooks_balance)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-2 pt-2 border-t">
                                            <p className="text-sm text-muted-foreground">Difference</p>
                                            <p className={`font-bold ${Math.abs(parseFloat(closingBalance) - statement.quickbooks_balance) > 0.01
                                                ? "text-red-500"
                                                : "text-green-500"
                                                }`}>
                                                {new Intl.NumberFormat('en-US', {
                                                    style: 'currency',
                                                    currency: bank.bank_currency,
                                                    minimumFractionDigits: 2
                                                }).format(parseFloat(closingBalance) - statement.quickbooks_balance)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="monthly" className="flex-1 overflow-auto">
                        <div className="p-4 bg-muted rounded-md mb-4">
                            <h3 className="text-lg font-semibold mb-2">Monthly Balances</h3>
                            <p className="text-sm text-muted-foreground">
                                This statement includes data for the following months. Click "Verify" to confirm each monthly balance.
                            </p>
                        </div>

                        {monthlyBalances.length === 0 ? (
                            <div className="flex items-center justify-center h-40 border rounded-md">
                                <div className="text-center">
                                    <p className="text-muted-foreground mb-2">No monthly balances extracted</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleExtract}
                                        disabled={!pdfUrl || extracting}
                                    >
                                        {extracting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                Extracting...
                                            </>
                                        ) : (
                                            <>
                                                <RotateCw className="h-4 w-4 mr-1" />
                                                Extract Monthly Data
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Month</TableHead>
                                            <TableHead>Year</TableHead>
                                            <TableHead>Opening Balance</TableHead>
                                            <TableHead>Closing Balance</TableHead>
                                            <TableHead>Page</TableHead>
                                            <TableHead>Verification</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlyBalances.map((balance, index) => (
                                            <TableRow key={`${balance.month}-${balance.year}`}>
                                                <TableCell>{format(new Date(balance.year, balance.month - 1, 1), 'MMMM')}</TableCell>
                                                <TableCell>{balance.year}</TableCell>
                                                <TableCell>
                                                    {new Intl.NumberFormat('en-US', {
                                                        style: 'currency',
                                                        currency: bank.bank_currency,
                                                        minimumFractionDigits: 2
                                                    }).format(balance.opening_balance)}
                                                </TableCell>
                                                <TableCell>
                                                    {new Intl.NumberFormat('en-US', {
                                                        style: 'currency',
                                                        currency: bank.bank_currency,
                                                        minimumFractionDigits: 2
                                                    }).format(balance.closing_balance)}
                                                </TableCell>
                                                <TableCell>{balance.statement_page}</TableCell>
                                                <TableCell>
                                                    {balance.is_verified ? (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                            <Check className="h-3 w-3 mr-1" />
                                                            Verified
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                            Pending
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handlePageChange(balance.statement_page)}
                                                        >
                                                            View
                                                        </Button>
                                                        <Button
                                                            variant={balance.is_verified ? "outline" : "default"}
                                                            size="sm"
                                                            onClick={() => handleVerifyMonthlyBalance(index)}
                                                            disabled={balance.is_verified}
                                                        >
                                                            {balance.is_verified ? 'Verified' : 'Verify'}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="validation" className="flex-1 overflow-auto">
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-md">
                                <h3 className="text-lg font-semibold mb-2">Validation Status</h3>
                                <div className="flex items-center gap-2">
                                    {statement.validation_status.is_validated ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                            <Check className="h-3 w-3 mr-1" />
                                            Validated
                                        </Badge>
                                    ) : statement.validation_status.mismatches.length > 0 ? (
                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            Validation Issues
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                                            Not Validated
                                        </Badge>
                                    )}

                                    {statement.validation_status.validation_date && (
                                        <span className="text-sm text-muted-foreground">
                                            Last checked: {format(new Date(statement.validation_status.validation_date), 'PPpp')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {statement.validation_status.mismatches.length > 0 && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Validation Issues Found</AlertTitle>
                                    <AlertDescription>
                                        <ul className="list-disc pl-5 mt-2 space-y-1">
                                            {statement.validation_status.mismatches.map((mismatch, index) => (
                                                <li key={index}>{mismatch}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[200px]">Field</TableHead>
                                            <TableHead>Expected Value</TableHead>
                                            <TableHead>Extracted Value</TableHead>
                                            <TableHead className="w-[100px]">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="font-medium">Bank Name</TableCell>
                                            <TableCell>{bank.bank_name}</TableCell>
                                            <TableCell>{bankName || 'Not detected'}</TableCell>
                                            <TableCell>
                                                <span className={
                                                    bankName &&
                                                        bankName.toLowerCase().includes(bank.bank_name.toLowerCase())
                                                        ? "text-green-500 font-medium"
                                                        : "text-red-500 font-medium"
                                                }>
                                                    {bankName &&
                                                        bankName.toLowerCase().includes(bank.bank_name.toLowerCase())
                                                        ? "Match"
                                                        : "Mismatch"}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Account Number</TableCell>
                                            <TableCell>{bank.account_number}</TableCell>
                                            <TableCell>{accountNumber || 'Not detected'}</TableCell>
                                            <TableCell>
                                                <span className={
                                                    accountNumber &&
                                                        accountNumber.includes(bank.account_number)
                                                        ? "text-green-500 font-medium"
                                                        : "text-red-500 font-medium"
                                                }>
                                                    {accountNumber &&
                                                        accountNumber.includes(bank.account_number)
                                                        ? "Match"
                                                        : "Mismatch"}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Currency</TableCell>
                                            <TableCell>{bank.bank_currency}</TableCell>
                                            <TableCell>{currency || 'Not detected'}</TableCell>
                                            <TableCell>
                                                <span className={
                                                    currency &&
                                                        currency === bank.bank_currency
                                                        ? "text-green-500 font-medium"
                                                        : "text-red-500 font-medium"
                                                }>
                                                    {currency &&
                                                        currency === bank.bank_currency
                                                        ? "Match"
                                                        : "Mismatch"}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={saving}
                        className="mr-auto"
                    >
                        Close
                    </Button>

                    <Button
                        variant="default"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}