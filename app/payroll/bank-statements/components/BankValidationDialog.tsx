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
        'KSH': 'KES',
        'K.SH': 'KES',
        'KSHS': 'KES',
        'K.SHS': 'KES',
        'SH': 'KES'
    };

    // Return mapped value or the original if not in the map
    return currencyMap[upperCode] || upperCode;
};

// Function to check if a currency extracted equals the expected one
const isMatchingCurrency = (extracted: string | null, expected: string): boolean => {
    if (!extracted) return false;
    return normalizeCurrencyCode(extracted) === normalizeCurrencyCode(expected);
};

// Function to verify if expected period falls within the extracted period
const isPeriodContained = (extractedPeriod: string | null, expectedMonth: number, expectedYear: number): boolean => {
    if (!extractedPeriod) return false;

    // Check if the period contains the expected month/year
    const monthName = new Date(expectedYear, expectedMonth - 1, 1).toLocaleString('en-US', { month: 'long' });
    const monthNameShort = new Date(expectedYear, expectedMonth - 1, 1).toLocaleString('en-US', { month: 'short' });
    const yearStr = expectedYear.toString();

    // Check if month and year appear in the period string
    if (extractedPeriod.includes(monthName) && extractedPeriod.includes(yearStr)) {
        return true;
    }

    if (extractedPeriod.includes(monthNameShort) && extractedPeriod.includes(yearStr)) {
        return true;
    }

    // Try to parse date ranges
    const dateMatches = extractedPeriod.match(/(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/g);
    if (dateMatches && dateMatches.length >= 2) {
        try {
            // Parse dates, trying multiple formats
            const formats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'MM-DD-YYYY', 'DD.MM.YYYY', 'MM.DD.YYYY'];
            let startDate = null;
            let endDate = null;

            for (const format of formats) {
                const parsedStart = dayjs(dateMatches[0], format);
                const parsedEnd = dayjs(dateMatches[1], format);

                if (parsedStart.isValid() && parsedEnd.isValid()) {
                    startDate = parsedStart;
                    endDate = parsedEnd;
                    break;
                }
            }

            if (startDate && endDate) {
                // Create date for expected month
                const expectedDate = dayjs(new Date(expectedYear, expectedMonth - 1, 15)); // Middle of month

                // Check if expected date is within the range
                return expectedDate.isAfter(startDate) && expectedDate.isBefore(endDate);
            }
        } catch (e) {
            console.error("Error parsing statement period dates:", e);
        }
    }

    return false;
};

export function BankValidationDialog({
    isOpen,
    onClose,
    bank,
    extractedData,
    mismatches,
    onProceed,
    onCancel
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
                                    {currencyMatches ? (
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
                                <TableCell className="font-medium">Period</TableCell>
                                <TableCell>{bank.statement_period || `${expectedMonth}/${expectedYear}`}</TableCell>
                                <TableCell>{extractedData.statement_period || 'Not detected'}</TableCell>
                                <TableCell>
                                    {periodMatches ? (
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