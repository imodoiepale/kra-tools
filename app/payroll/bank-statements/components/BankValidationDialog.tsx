// BankValidationDialog.tsx
// @ts-nocheck
// BankValidationDialog.tsx
// @ts-nocheck
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, CheckCircle } from "lucide-react"

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
    cycleMonth: number  // Add these props
    cycleYear: number   // Add these props
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
        'KSH': 'KES',
        'KENYA SHILLING': 'KES',
        'KENYA SHILLINGS': 'KES',
        'KENYAN SHILLING': 'KES',
        'KENYAN SHILLINGS': 'KES',
        'KES': 'KES',
        'KSH': 'KES',
        'K.SH': 'KES',
        'KSHS': 'KES',
        'K.SHS': 'KES',
        'SH': 'KES'
    };

    // Return mapped value or the original if not in the map
    return currencyMap[upperCode] || upperCode;
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
    cycleMonth,  // Add these params
    cycleYear    // Add these params
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
        expectedMonth,
        expectedYear
    );

    const isPeriodValid = isPeriodContained(extractedData.statement_period, cycleMonth, cycleYear);

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-4xl">
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

                <div className="py-4">
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
                                    <span className={
                                        extractedData.currency &&
                                            normalizeCurrencyCode(extractedData.currency) === normalizeCurrencyCode(bank.bank_currency)
                                            ? "text-green-500 font-medium"
                                            : "text-red-500 font-medium"
                                    }>
                                        {extractedData.currency &&
                                            normalizeCurrencyCode(extractedData.currency) === normalizeCurrencyCode(bank.bank_currency)
                                            ? "Match"
                                            : "Mismatch"}
                                    </span>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Period</TableCell>
                                <TableCell>{`${cycleMonth}/${cycleYear}`}</TableCell>
                                <TableCell>{extractedData.statement_period || 'Not detected'}</TableCell>
                                <TableCell>
                                    <span className={isPeriodValid ? "text-green-500 font-medium" : "text-amber-500 font-medium"}>
                                        {isPeriodValid ? "Match" : "Possible Mismatch"}
                                    </span>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>

                    <div className="mt-4 space-y-2">
                        <h4 className="font-medium">Additional Extracted Information:</h4>
                        <p>Statement Period: {extractedData.statement_period || 'Not detected'}</p>
                        <p>Opening Balance: {extractedData.opening_balance !== null ? extractedData.opening_balance.toLocaleString() : 'Not detected'}</p>
                        <p>Closing Balance: {extractedData.closing_balance !== null ? extractedData.closing_balance.toLocaleString() : 'Not detected'}</p>

                        {extractedData.monthly_balances && extractedData.monthly_balances.length > 0 && (
                            <div className="mt-2">
                                <h4 className="font-medium">Monthly Balances Found:</h4>
                                <ul className="pl-5 list-disc">
                                    {extractedData.monthly_balances.map((balance, index) => (
                                        <li key={index}>
                                            {new Date(balance.year, balance.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}:
                                            {' Opening: '}{balance.opening_balance?.toLocaleString() || 'N/A'},
                                            {' Closing: '}{balance.closing_balance?.toLocaleString() || 'N/A'}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
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