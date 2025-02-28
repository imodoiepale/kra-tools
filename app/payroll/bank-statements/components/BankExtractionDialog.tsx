// BankExtractionDialog.tsx
// @ts-nocheck
import { useState, useEffect, useRef } from 'react'
import {
    Loader2, Save, ChevronLeft, ChevronRight,
    AlertTriangle, CheckCircle, Check, Trash,
    Plus, X, ChevronsUpDown, CalendarIcon, Eye
} from 'lucide-react'
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card'

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
    } | null
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

const normalizeCurrencyCode = (code) => {
    if (!code) return 'USD'; // Default fallback

    // Convert to uppercase
    const upperCode = code.toUpperCase().trim();

    // Map of common incorrect currency codes to valid ISO codes
    const currencyMap = {
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
        'KES': 'KES',
        'K.SH': 'KES',
        'KSHS': 'KES',
        'K.SHS': 'KES',
        'SH': 'KES'
    };

    // Return mapped value or the original if not in the map
    return currencyMap[upperCode] || upperCode;
};

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
    const [saving, setSaving] = useState<boolean>(false)
    const [deleting, setDeleting] = useState<boolean>(false)
    const [selectedMonth, setSelectedMonth] = useState<number>(statement.statement_month)
    const [selectedYear, setSelectedYear] = useState<number>(statement.statement_year)

    // Detected periods in PDF
    const [detectedPeriods, setDetectedPeriods] = useState<{ month: number, year: number, page: number }[]>([])
    const [currentPeriodIndex, setCurrentPeriodIndex] = useState<number>(0)

    // Selection state
    const [selection, setSelection] = useState<{
        value: number,
        position: { x: number, y: number },
        page: number
    } | null>(null)

    // Editable extraction fields
    const [bankName, setBankName] = useState<string>(statement.statement_extractions.bank_name || '')
    const [accountNumber, setAccountNumber] = useState<string>(statement.statement_extractions.account_number || '')
    const [currency, setCurrency] = useState<string>(statement.statement_extractions.currency || '')
    const [monthlyBalances, setMonthlyBalances] = useState<MonthlyBalance[]>(
        statement.statement_extractions.monthly_balances || []
    )

    const iframeRef = useRef<HTMLIFrameElement>(null)
    const selectionRef = useRef<HTMLDivElement>(null)

    const handleClose = () => {
        if (!isLoading && !saving && !deleting) {
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
                try {
                    // For now we use a fixed number; in a real impl you would get this from the PDF
                    setTotalPages(10)

                    // Simulate period detection - in a real impl you'd scan the PDF
                    detectPeriodsInDocument();
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

    // Detect periods in document (placeholder implementation)
    const detectPeriodsInDocument = () => {
        // This is where you'd implement actual period detection
        // For now we'll just create a sample list based on existing data

        const periods = [];

        // Add periods from existing monthly balances
        if (monthlyBalances.length > 0) {
            // Convert existing balances to detected periods
            const existingPeriods = monthlyBalances.map(balance => ({
                month: balance.month,
                year: balance.year,
                page: balance.statement_page || 1
            }));

            // Add to periods, avoiding duplicates
            existingPeriods.forEach(period => {
                if (!periods.some(p => p.month === period.month && p.year === period.year)) {
                    periods.push(period);
                }
            });
        }

        // If no periods were found, add the current statement month/year
        if (periods.length === 0) {
            periods.push({
                month: selectedMonth,
                year: selectedYear,
                page: 1
            });
        }

        // Sort by year and month
        periods.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });

        setDetectedPeriods(periods);

        // Set current period index to the one matching statement month/year
        const statementPeriodIndex = periods.findIndex(
            p => p.month === selectedMonth && p.year === selectedYear
        );

        setCurrentPeriodIndex(statementPeriodIndex >= 0 ? statementPeriodIndex : 0);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return
        setCurrentPage(newPage)

        // Update iframe src with page parameter
        if (iframeRef.current && pdfUrl) {
            // Add page parameter to URL or use PDF viewer API
            iframeRef.current.src = `${pdfUrl}#page=${newPage}`
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
                // Set opening/closing balance based on monthly balances for the selected month/year
                opening_balance: getMonthlyOpeningBalance(),
                closing_balance: getMonthlyClosingBalance(),
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
                .from('acc_cycle_bank_statements')
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

    const handleDeleteStatement = async () => {
        // Confirm deletion
        if (!window.confirm("Are you sure you want to delete this statement? This action cannot be undone.")) {
            return;
        }

        try {
            setDeleting(true);

            // Delete files from storage if they exist
            if (statement.statement_document.statement_pdf) {
                await supabase.storage
                    .from('Payroll-Cycle')
                    .remove([statement.statement_document.statement_pdf]);
            }

            if (statement.statement_document.statement_excel) {
                await supabase.storage
                    .from('Payroll-Cycle')
                    .remove([statement.statement_document.statement_excel]);
            }

            // Delete the statement record
            const { error } = await supabase
                .from('acc_cycle_bank_statements')
                .delete()
                .eq('id', statement.id);

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'Bank statement deleted successfully'
            });

            // Close dialog and update parent
            onClose();
            onStatementUpdated(null);

        } catch (error) {
            console.error('Error deleting statement:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete bank statement',
                variant: 'destructive'
            });
        } finally {
            setDeleting(false);
        }
    };

    const formatCurrency = (amount, currencyCode) => {
        if (amount === null || amount === undefined) return '-';

        try {
            // Normalize the currency code
            const normalizedCurrency = normalizeCurrencyCode(currencyCode || bank.bank_currency);

            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: normalizedCurrency,
                minimumFractionDigits: 2
            }).format(amount);
        } catch (error) {
            // Fallback if there's an error with the currency code
            console.warn(`Invalid currency code: ${currencyCode}. Falling back to plain number format.`);
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        }
    };

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

    const handleAddMonthlyBalance = () => {
        // Create a new balance entry for the current selected month/year
        const newBalance = {
            month: selectedMonth,
            year: selectedYear,
            closing_balance: 0,
            opening_balance: 0,
            statement_page: currentPage,
            highlight_coordinates: null,
            is_verified: false,
            verified_by: null,
            verified_at: null
        };

        // Check if this month/year already exists
        const existingIndex = monthlyBalances.findIndex(
            b => b.month === selectedMonth && b.year === selectedYear
        );

        if (existingIndex >= 0) {
            toast({
                description: `Balance for ${format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy')} already exists.`,
                variant: 'default'
            });
            return;
        }

        // Add the new balance
        setMonthlyBalances(prev => [...prev, newBalance]);

        toast({
            description: `Added ${format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy')} to monthly balances.`,
            variant: 'default'
        });
    };

    const handleUpdateBalance = (index: number, field: string, value: any) => {
        setMonthlyBalances(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                [field]: value,
                is_verified: false // Reset verification when edited
            };
            return updated;
        });
    };

    const handleRemoveBalance = (index: number) => {
        setMonthlyBalances(prev => {
            const updated = [...prev];
            updated.splice(index, 1);
            return updated;
        });

        toast({
            description: 'Monthly balance removed.',
            variant: 'default'
        });
    };

    // Navigate to a specific period
    const navigateToPeriod = (periodIndex: number) => {
        if (periodIndex < 0 || periodIndex >= detectedPeriods.length) return;

        const period = detectedPeriods[periodIndex];
        setSelectedMonth(period.month);
        setSelectedYear(period.year);
        setCurrentPeriodIndex(periodIndex);

        // Navigate to the page
        handlePageChange(period.page);

        toast({
            description: `Navigated to ${format(new Date(period.year, period.month - 1, 1), 'MMMM yyyy')}`,
            variant: 'default'
        });
    };

    // Navigate to next period
    const navigateToNextPeriod = () => {
        if (currentPeriodIndex < detectedPeriods.length - 1) {
            navigateToPeriod(currentPeriodIndex + 1);
        }
    };

    // Navigate to previous period
    const navigateToPreviousPeriod = () => {
        if (currentPeriodIndex > 0) {
            navigateToPeriod(currentPeriodIndex - 1);
        }
    };

    // Handle text selection in PDF (simulated)
    const handleSelection = (value: number) => {
        // In a real implementation, this would be triggered by selecting text in the PDF
        // For now, we'll just create a manual selection
        setSelection({
            value,
            position: { x: 300, y: 300 }, // Arbitrary position
            page: currentPage
        });
    };

    // Apply selected value as closing balance for current period
    const applySelectionAsClosingBalance = () => {
        if (!selection) return;

        // Find the index of the balance for the current month/year
        const balanceIndex = monthlyBalances.findIndex(
            b => b.month === selectedMonth && b.year === selectedYear
        );

        if (balanceIndex >= 0) {
            // Update existing balance
            handleUpdateBalance(balanceIndex, 'closing_balance', selection.value);
            handleUpdateBalance(balanceIndex, 'statement_page', currentPage);
        } else {
            // Add new balance
            setMonthlyBalances(prev => [
                ...prev,
                {
                    month: selectedMonth,
                    year: selectedYear,
                    closing_balance: selection.value,
                    opening_balance: 0, // Default to 0
                    statement_page: currentPage,
                    highlight_coordinates: null,
                    is_verified: false,
                    verified_by: null,
                    verified_at: null
                }
            ]);
        }

        // Clear selection and show toast
        setSelection(null);
        toast({
            description: `Set closing balance for ${format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy')}`,
            variant: 'default'
        });

        // Navigate to next period if available
        setTimeout(() => {
            navigateToNextPeriod();
        }, 500);
    };

    // Get the monthly opening balance for the selected month/year
    const getMonthlyOpeningBalance = () => {
        const balance = monthlyBalances.find(
            b => b.month === selectedMonth && b.year === selectedYear
        );
        return balance?.opening_balance ?? null;
    };

    // Get the monthly closing balance for the selected month/year
    const getMonthlyClosingBalance = () => {
        const balance = monthlyBalances.find(
            b => b.month === selectedMonth && b.year === selectedYear
        );
        return balance?.closing_balance ?? null;
    };

    // Check if period is verified
    const isPeriodVerified = (month: number, year: number) => {
        const balance = monthlyBalances.find(
            b => b.month === month && b.year === year
        );
        return balance?.is_verified ?? false;
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose} className="max-w-7xl">
            <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl flex justify-between items-center">
                        <span>Bank Statement - {bank.bank_name} {bank.account_number}</span>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteStatement}
                            disabled={deleting}
                            className="gap-1"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                            Delete Statement
                        </Button>
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="overview">Statement Overview</TabsTrigger>
                        <TabsTrigger value="validation">Validation</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex flex-col h-full space-y-2">
                            {/* Period navigation */}
                            <div className="flex items-center justify-between bg-muted p-2 rounded-md">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={navigateToPreviousPeriod}
                                    disabled={currentPeriodIndex <= 0}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Previous Period
                                </Button>

                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-medium">Current Period</span>
                                    <div className="flex gap-1 items-center">
                                        <Select
                                            value={`${selectedMonth}-${selectedYear}`}
                                            onValueChange={(value) => {
                                                const [month, year] = value.split('-').map(Number);
                                                const periodIndex = detectedPeriods.findIndex(
                                                    p => p.month === month && p.year === year
                                                );
                                                if (periodIndex >= 0) {
                                                    navigateToPeriod(periodIndex);
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="w-[200px]">
                                                <SelectValue placeholder="Select period" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {detectedPeriods.map((period, index) => (
                                                    <SelectItem key={index} value={`${period.month}-${period.year}`}>
                                                        {format(new Date(period.year, period.month - 1, 1), 'MMMM yyyy')}
                                                        {isPeriodVerified(period.month, period.year) && ' ✓'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <Badge variant={isPeriodVerified(selectedMonth, selectedYear) ? "default" : "outline"}>
                                            {isPeriodVerified(selectedMonth, selectedYear) ? "Verified" : "Unverified"}
                                        </Badge>
                                    </div>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={navigateToNextPeriod}
                                    disabled={currentPeriodIndex >= detectedPeriods.length - 1}
                                >
                                    Next Period
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>

                            {/* Main content area */}
                            <div className="grid grid-cols-5 gap-4 flex-1">
                                {/* PDF Viewer - 3 columns */}
                                <div className="col-span-3 flex flex-col h-full">
                                    <div className="border rounded bg-muted relative flex-1 overflow-hidden">
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
                                                {/* Selection tooltip would appear here in a real implementation */}
                                                {selection && (
                                                    <div
                                                        ref={selectionRef}
                                                        className="absolute bg-white border rounded-md shadow-md p-2 z-50"
                                                        style={{
                                                            left: `${selection.position.x}px`,
                                                            top: `${selection.position.y - 40}px`
                                                        }}
                                                    >
                                                        <p className="text-sm mb-1">Use {formatCurrency(selection.value, currency || bank.bank_currency)} as closing balance?</p>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                onClick={applySelectionAsClosingBalance}
                                                            >
                                                                Apply
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setSelection(null)}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-center h-full">
                                                <p className="text-muted-foreground">No PDF document available</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* PDF navigation */}
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

                                    {/* Mock text selection buttons (in a real implementation this would use PDF text selection) */}
                                    <div className="mt-2 p-2 border rounded-md bg-muted/30">
                                        <p className="text-sm text-muted-foreground mb-2">
                                            Demo: Select amount from document (in a real implementation, you would select text directly in the PDF)
                                        </p>
                                        <div className="flex gap-2 flex-wrap">
                                            <Button size="sm" variant="outline" onClick={() => handleSelection(15000)}>
                                                Select $15,000.00
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleSelection(25842.75)}>
                                                Select $25,842.75
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleSelection(32150.50)}>
                                                Select $32,150.50
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Right panel - Account details and monthly balances */}
                                <div className="col-span-2 flex flex-col h-full gap-4">
                                    {/* Account details card */}
                                    <Card className="overflow-hidden">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">Account Details</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
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
                                        </CardContent>
                                    </Card>

                                    {/* Current period balance card */}
                                    <Card className="overflow-hidden">
                                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                            <CardTitle className="text-base">
                                                {format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy')} Balance
                                            </CardTitle>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => {
                                                                const index = monthlyBalances.findIndex(
                                                                    b => b.month === selectedMonth && b.year === selectedYear
                                                                );
                                                                if (index >= 0) {
                                                                    handleVerifyMonthlyBalance(index);
                                                                }
                                                            }}
                                                            disabled={!monthlyBalances.some(b => b.month === selectedMonth && b.year === selectedYear)}
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Mark as verified</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {monthlyBalances.some(b => b.month === selectedMonth && b.year === selectedYear) ? (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <Label htmlFor="opening-balance">Opening Balance</Label>
                                                        <Input
                                                            id="opening-balance"
                                                            type="number"
                                                            step="0.01"
                                                            value={getMonthlyOpeningBalance() || ''}
                                                            onChange={(e) => {
                                                                const index = monthlyBalances.findIndex(
                                                                    b => b.month === selectedMonth && b.year === selectedYear
                                                                );
                                                                if (index >= 0) {
                                                                    handleUpdateBalance(index, 'opening_balance', parseFloat(e.target.value) || 0);
                                                                }
                                                            }}
                                                            placeholder="Enter opening balance"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor="closing-balance">Closing Balance</Label>
                                                        <Input
                                                            id="closing-balance"
                                                            type="number"
                                                            step="0.01"
                                                            value={getMonthlyClosingBalance() || ''}
                                                            onChange={(e) => {
                                                                const index = monthlyBalances.findIndex(
                                                                    b => b.month === selectedMonth && b.year === selectedYear
                                                                );
                                                                if (index >= 0) {
                                                                    handleUpdateBalance(index, 'closing_balance', parseFloat(e.target.value) || 0);
                                                                }
                                                            }}
                                                            placeholder="Enter closing balance"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-4 text-center">
                                                    <p className="text-muted-foreground mb-2">No balance data for this period</p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleAddMonthlyBalance}
                                                    >
                                                        <Plus className="h-4 w-4 mr-1" />
                                                        Add Balance Data
                                                    </Button>
                                                </div>
                                            )}

                                            {statement.quickbooks_balance !== null && getMonthlyClosingBalance() !== null && (
                                                <div className="p-3 bg-muted rounded-md mt-2">
                                                    <h4 className="font-medium mb-2">Balance Reconciliation</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Bank Statement</p>
                                                            <p className="font-medium">
                                                                {formatCurrency(getMonthlyClosingBalance(), bank.bank_currency)}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">QuickBooks</p>
                                                            <p className="font-medium">
                                                                {formatCurrency(statement.quickbooks_balance, bank.bank_currency)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 pt-2 border-t">
                                                        <p className="text-sm text-muted-foreground">Difference</p>
                                                        <p className={`font-bold ${Math.abs(getMonthlyClosingBalance() - statement.quickbooks_balance) > 0.01
                                                            ? "text-red-500"
                                                            : "text-green-500"
                                                            }`}>
                                                            {formatCurrency(getMonthlyClosingBalance() - statement.quickbooks_balance, bank.bank_currency)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Monthly balances section */}
                                    <Card className="flex-1 overflow-hidden">
                                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                            <CardTitle className="text-base">All Monthly Balances</CardTitle>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleAddMonthlyBalance}
                                            >
                                                <Plus className="h-4 w-4 mr-1" />
                                                Add Month
                                            </Button>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            {monthlyBalances.length === 0 ? (
                                                <div className="flex items-center justify-center h-32 text-center px-4">
                                                    <p className="text-muted-foreground">
                                                        No monthly balances added yet. Select text in the document to add balances
                                                        or click "Add Month" to add manually.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="max-h-[250px] overflow-auto">
                                                    <Table>
                                                        <TableHeader className="sticky top-0 bg-white z-10">
                                                            <TableRow>
                                                                <TableHead>Period</TableHead>
                                                                <TableHead>Closing Balance</TableHead>
                                                                <TableHead>Status</TableHead>
                                                                <TableHead className="w-[100px]">Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {monthlyBalances.sort((a, b) => {
                                                                if (a.year !== b.year) return a.year - b.year;
                                                                return a.month - b.month;
                                                            }).map((balance, index) => {
                                                                const isCurrentPeriod = balance.month === selectedMonth && balance.year === selectedYear;

                                                                return (
                                                                    <TableRow
                                                                        key={`${balance.month}-${balance.year}`}
                                                                        className={isCurrentPeriod ? "bg-blue-50" : ""}
                                                                    >
                                                                        <TableCell className="font-medium">
                                                                            {format(new Date(balance.year, balance.month - 1, 1), 'MMM yyyy')}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {formatCurrency(balance.closing_balance, currency || bank.bank_currency)}
                                                                        </TableCell>
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
                                                                            <div className="flex gap-1">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8"
                                                                                    onClick={() => {
                                                                                        // Find period index and navigate to it
                                                                                        const periodIndex = detectedPeriods.findIndex(
                                                                                            p => p.month === balance.month && p.year === balance.year
                                                                                        );
                                                                                        if (periodIndex >= 0) {
                                                                                            navigateToPeriod(periodIndex);
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <Eye className="h-4 w-4" />
                                                                                </Button>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8 text-red-500"
                                                                                    onClick={() => handleRemoveBalance(index)}
                                                                                >
                                                                                    <X className="h-4 w-4" />
                                                                                </Button>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
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

                            <div className="p-4 border rounded-md">
                                <h3 className="text-lg font-semibold mb-2">Monthly Balances Summary</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Period</TableHead>
                                            <TableHead>Opening Balance</TableHead>
                                            <TableHead>Closing Balance</TableHead>
                                            <TableHead>Verification</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlyBalances.length > 0 ? (
                                            monthlyBalances.sort((a, b) => {
                                                if (a.year !== b.year) return a.year - b.year;
                                                return a.month - b.month;
                                            }).map((balance, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>
                                                        {format(new Date(balance.year, balance.month - 1, 1), 'MMMM yyyy')}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatCurrency(balance.opening_balance, currency || bank.bank_currency)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatCurrency(balance.closing_balance, currency || bank.bank_currency)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {balance.is_verified ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                                <Check className="h-3 w-3 mr-1" />
                                                                Verified {balance.verified_at && `on ${format(new Date(balance.verified_at), 'dd/MM/yyyy')}`}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                                Not Verified
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                                    No monthly balances added yet
                                                </TableCell>
                                            </TableRow>
                                        )}
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
                        disabled={saving || deleting}
                        className="mr-auto"
                    >
                        Close
                    </Button>

                    <Button
                        variant="default"
                        onClick={handleSave}
                        disabled={saving || deleting}
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
    );
}