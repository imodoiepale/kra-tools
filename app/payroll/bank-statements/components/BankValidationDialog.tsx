// BankValidationDialog.tsx
// @ts-nocheck
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, CheckCircle, Calendar, DollarSign, Building, CreditCard, FileCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
}

interface BankValidationDialogProps {
    isOpen: boolean
    onClose: () => void
    bank: Bank
    extractedData: {
        bank_name: string | null
        company_name: string | null
        account_number: string | null
        currency: string | null
        statement_period: string | null
        opening_balance: number | null
        closing_balance: number | null
        monthly_balances: any[]
    }
    mismatches: string[]
    onProceed: () => void
    onCancel: () => void
    cycleMonth: number
    cycleYear: number
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
        'KES': 'KES',
        'K.SH': 'KES',
        'KSHS': 'KES',
        'K.SHS': 'KES',
        'SH': 'KES'
    };

    // Return mapped value or the original if not in the map
    return currencyMap[upperCode] || upperCode;
};

// Safe currency formatter
const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';

    try {
        return Number(amount).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    } catch (error) {
        console.warn("Error formatting currency:", error);
        return 'Error';
    }
};

// Safe date formatter
const formatDate = (year, month) => {
    if (year == null || month == null) return 'Unknown Date';

    try {
        return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    } catch (error) {
        console.warn("Error formatting date:", error);
        return 'Invalid Date';
    }
};

function isPeriodContained(statementPeriod, cycleMonth, cycleYear) {
    if (!statementPeriod) return false;

    // For simple month/year validation
    const monthYearRegex = new RegExp(`\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+${cycleYear}\\b`, 'i');
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

    if (monthYearRegex.test(statementPeriod)) {
        // Check if the month matches
        const normalizedPeriod = statementPeriod.toLowerCase();
        const cycleMonthName = monthNames[cycleMonth - 1];
        return normalizedPeriod.includes(cycleMonthName);
    }

    try {
        // If there's a date range format (e.g., "01/01/2024 - 30/01/2024")
        const dates = statementPeriod.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g);
        if (!dates || dates.length < 2) return false;

        // Try to parse dates - first attempt DD/MM/YYYY format
        const parseDate = (dateStr) => {
            const parts = dateStr.split(/[\/\-\.]/);
            if (parts.length !== 3) return null;

            // Try DD/MM/YYYY
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                return { day, month, year };
            }

            // Try MM/DD/YYYY
            const day2 = parseInt(parts[1], 10);
            const month2 = parseInt(parts[0], 10);

            if (day2 >= 1 && day2 <= 31 && month2 >= 1 && month2 <= 12) {
                return { day: day2, month: month2, year };
            }

            return null;
        };

        const startDate = parseDate(dates[0]);
        const endDate = parseDate(dates[1]);

        if (!startDate || !endDate) return false;

        // Check if the cycle month/year is within the date range
        // Compare years first
        if (startDate.year < cycleYear && endDate.year > cycleYear) return true;
        if (startDate.year > cycleYear || endDate.year < cycleYear) return false;

        // If start year equals cycle year, check if cycle month is >= start month
        if (startDate.year === cycleYear && cycleMonth < startDate.month) return false;

        // If end year equals cycle year, check if cycle month is <= end month
        if (endDate.year === cycleYear && cycleMonth > endDate.month) return false;

        return true;
    } catch (error) {
        console.error('Error validating statement period:', error);
        return false;
    }
}

// Function to check if a currency extracted equals the expected one
const isMatchingCurrency = (extracted: string | null, expected: string): boolean => {
    if (!extracted) return false;
    return normalizeCurrencyCode(extracted) === normalizeCurrencyCode(expected);
};

export function BankValidationDialog({
    isOpen,
    onClose,
    bank,
    extractedData,
    mismatches,
    onProceed,
    onCancel,
    cycleMonth,
    cycleYear
}: BankValidationDialogProps) {
    // Extract expected month/year from the period if available
    let expectedMonth = null;
    let expectedYear = null;

    if (bank.statement_period) {
        // Try to parse month/year from period
        const matches = bank.statement_period.match(/(\w+)\s+(\d{4})/i);
        if (matches && matches.length >= 3) {
            const monthName = matches[1];
            const year = parseInt(matches[2]);

            // Convert month name to number
            const monthIndex = new Date(`${monthName} 1, 2000`).getMonth();
            if (!isNaN(monthIndex) && !isNaN(year)) {
                expectedMonth = monthIndex + 1;
                expectedYear = year;
            }
        }
    }

    // Check if currencies match using the normalization function
    const currencyMatches = isMatchingCurrency(extractedData.currency, bank.bank_currency);

    // Check if period contains the expected month/year
    const periodMatches = isPeriodContained(
        extractedData.statement_period,
        expectedMonth || cycleMonth,
        expectedYear || cycleYear
    );

    const isPeriodValid = isPeriodContained(extractedData.statement_period, cycleMonth, cycleYear);

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-5xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center text-amber-600">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        Validation Issues Detected
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        The extracted bank information doesn't match the expected details.
                        Please review the differences below:
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="py-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="py-3 bg-blue-50">
                                <CardTitle className="text-base flex items-center">
                                    <Building className="h-4 w-4 mr-2" />
                                    Bank Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
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
                                            <TableCell className="font-medium">Company Name</TableCell>
                                            <TableCell>{bank.company_name}</TableCell>
                                            <TableCell>{extractedData.company_name || 'Not detected'}</TableCell>
                                            <TableCell>
                                                {extractedData.company_name &&
                                                    extractedData.company_name.toLowerCase().includes(bank.company_name.toLowerCase()) ? (
                                                    <div className="flex items-center text-green-500 font-medium">
                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                        Match
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center text-red-500 font-medium">
                                                        <AlertTriangle className="h-4 w-4 mr-1" />
                                                        Mismatch
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Bank Name</TableCell>
                                            <TableCell>{bank.bank_name}</TableCell>
                                            <TableCell>{extractedData.bank_name || 'Not detected'}</TableCell>
                                            <TableCell>
                                                {extractedData.bank_name &&
                                                    extractedData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase()) ? (
                                                    <div className="flex items-center text-green-500 font-medium">
                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                        Match
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center text-red-500 font-medium">
                                                        <AlertTriangle className="h-4 w-4 mr-1" />
                                                        Mismatch
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Account Number</TableCell>
                                            <TableCell>{bank.account_number}</TableCell>
                                            <TableCell>{extractedData.account_number || 'Not detected'}</TableCell>
                                            <TableCell>
                                                {extractedData.account_number &&
                                                    extractedData.account_number.includes(bank.account_number) ? (
                                                    <div className="flex items-center text-green-500 font-medium">
                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                        Match
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center text-red-500 font-medium">
                                                        <AlertTriangle className="h-4 w-4 mr-1" />
                                                        Mismatch
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Currency</TableCell>
                                            <TableCell>{bank.bank_currency}</TableCell>
                                            <TableCell>{extractedData.currency || 'Not detected'}</TableCell>
                                            <TableCell>
                                                <div className={`flex items-center ${currencyMatches ? "text-green-500" : "text-red-500"} font-medium`}>
                                                    {currencyMatches ? (
                                                        <>
                                                            <CheckCircle className="h-4 w-4 mr-1" />
                                                            Match
                                                        </>
                                                    ) : (
                                                        <>
                                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                                            Mismatch
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="py-3 bg-blue-50">
                                <CardTitle className="text-base flex items-center">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Statement Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="space-y-4">
                                    <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Cycle Month</p>
                                                <p className="font-medium">{formatDate(cycleYear, cycleMonth)}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-xs text-muted-foreground">Statement Period</p>
                                                <p className="font-medium">{extractedData.statement_period || 'Not detected'}</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-blue-200 flex justify-between items-center">
                                            <p className="text-sm font-medium">Period Validation</p>
                                            <Badge className={isPeriodValid ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-amber-100"}>
                                                {isPeriodValid ? "Period Valid" : "Period Mismatch"}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium flex items-center">
                                            <DollarSign className="h-4 w-4 mr-1" />
                                            Balance Information
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-2 bg-gray-50 rounded-md">
                                                <p className="text-xs text-muted-foreground">Opening Balance</p>
                                                <p className="font-medium">{extractedData.opening_balance != null ? formatCurrency(extractedData.opening_balance) : 'Not detected'}</p>
                                            </div>
                                            <div className="p-2 bg-gray-50 rounded-md">
                                                <p className="text-xs text-muted-foreground">Closing Balance</p>
                                                <p className="font-medium">{extractedData.closing_balance != null ? formatCurrency(extractedData.closing_balance) : 'Not detected'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {extractedData.monthly_balances && extractedData.monthly_balances.length > 0 && (
                        <Card>
                            <CardHeader className="py-3 bg-blue-50">
                                <CardTitle className="text-base flex items-center">
                                    <FileCheck className="h-4 w-4 mr-2" />
                                    Monthly Balances Found
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Period</TableHead>
                                            <TableHead>Opening</TableHead>
                                            <TableHead>Closing</TableHead>
                                            <TableHead>Closing Date</TableHead>
                                            <TableHead>Page</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {extractedData.monthly_balances.map((balance, index) => (
                                            <TableRow key={index} className={balance.month === cycleMonth && balance.year === cycleYear ? "bg-blue-50" : ""}>
                                                <TableCell className="font-medium">
                                                    {formatDate(balance.year, balance.month)}
                                                    {balance.month === cycleMonth && balance.year === cycleYear && (
                                                        <Badge className="ml-2 bg-blue-100 text-blue-700 hover:bg-blue-100">Current</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>{balance?.opening_balance != null ? formatCurrency(balance.opening_balance) : 'N/A'}</TableCell>
                                                <TableCell>{balance?.closing_balance != null ? formatCurrency(balance.closing_balance) : 'N/A'}</TableCell>
                                                <TableCell>{balance?.closing_date || 'N/A'}</TableCell>
                                                <TableCell>{balance?.statement_page || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* {mismatches.length > 0 && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                            <h4 className="font-medium text-red-700 flex items-center mb-2">
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Validation Issues
                            </h4>
                            <ul className="pl-6 space-y-1 list-disc text-red-600">
                                {mismatches.map((mismatch, index) => (
                                    <li key={index}>{mismatch}</li>
                                ))}
                            </ul>
                        </div>
                    )} */}
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>
                        Cancel Upload
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onProceed}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        Proceed Anyway
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}