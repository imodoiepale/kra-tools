// BankValidationDialog.tsx
// @ts-nocheck
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, CheckCircle, Calendar, DollarSign, Building, CreditCard, FileCheck, RefreshCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { performBankStatementExtraction } from "@/lib/bankExtractionUtils"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Input } from "@/components/ui/input"

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
    fileUrl: string;
}

// Helper function to normalize currency codes
const normalizeCurrencyCode = (code) => {
    if (!code) return 'USD'; // Default fallback

    // Convert to uppercase and trim
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
        'KSHS': 'KES',
        'K.SH': 'KES',
        'K.SHS': 'KES',
        'KSH.': 'KES',
        'KSHS.': 'KES',
        'KENYA SHILLING': 'KES',
        'KENYA SHILLINGS': 'KES',
        'KENYAN SHILLING': 'KES',
        'KENYAN SHILLINGS': 'KES',
        'SH': 'KES',
        'KS': 'KES',
        'KS.': 'KES'
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
        return new Date(year, month ).toLocaleString('default', { month: 'long', year: 'numeric' });
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
        const cycleMonthName = monthNames[cycleMonth ];
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
const isMatchingCurrency = (extracted: string | null, expected: string | null): boolean => {
    if (!extracted || !expected) return false;
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
    if (!bank) {
        console.error('Bank object is undefined in BankValidationDialog');
        return null;
    }

    const [editableBankName, setEditableBankName] = useState(extractedData?.bank_name || '');

    // Extract expected month/year from the period if available
    let expectedMonth = null;
    let expectedYear = null;

    if (extractedData?.statement_period) {
        // Try to parse month/year from period
        const matches = extractedData.statement_period.match(/(\w+)\s+(\d{4})/i);
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

    const hasCriticalMismatches = () => {
        const criticalFields = ['account_number', 'company_name', 'statement_period'];
        return mismatches.some(mismatch =>
            criticalFields.some(field => mismatch.toLowerCase().includes(field))
        );
    };
    // Check if currencies match using the normalization function
    const currencyMatches = isMatchingCurrency(extractedData?.currency, bank?.bank_currency);

    // Check if period contains the expected month/year
    const periodMatches = isPeriodContained(
        extractedData?.statement_period,
        expectedMonth || cycleMonth,
        expectedYear || cycleYear
    );

    const isPeriodValid = isPeriodContained(extractedData?.statement_period, cycleMonth, cycleYear);

    const [processing, setProcessing] = useState(false);

    const handleReExtraction = async () => {
        try {
            setProcessing(true);

            const extractionResult = await performBankStatementExtraction(
                fileUrl,
                { month: cycleMonth, year: cycleYear }
            );

            if (extractionResult.success) {
                // Update the extracted data in state
                setExtractedData(extractionResult.extractedData);

                // Re-validate with the new data
                const newValidation = validateExtractedData(extractionResult.extractedData, bank);
                setMismatches(newValidation.mismatches);

                toast({
                    title: "Data Re-extracted",
                    description: "Statement data has been re-analyzed"
                });
            }
        } catch (error) {
            console.error('Re-extraction error:', error);
            toast({
                title: "Extraction Failed",
                description: "Could not re-extract data from document",
                variant: "destructive"
            });
        } finally {
            setProcessing(false);
        }
    };

    const fuzzyBankNameMatch = (expected: string, extracted: string): {
        matches: boolean,
        similarity: number,
        correctedName: string
    } => {
        // Normalization function
        const normalize = (name: string) =>
            name.toLowerCase()
                .replace(/\s*(bank|ltd|limited|plc)\s*/gi, '')
                .replace(/[^\w\s]/g, '')
                .trim();

        const normalizedExpected = normalize(expected);
        const normalizedExtracted = normalize(extracted || '');

        // Levenshtein distance calculation
        const levenshteinDistance = (s1: string, s2: string) => {
            const m = s1.length;
            const n = s2.length;
            const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

            for (let i = 0; i <= m; i++) dp[i][0] = i;
            for (let j = 0; j <= n; j++) dp[0][j] = j;

            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    if (s1[i - 1] === s2[j - 1]) {
                        dp[i][j] = dp[i - 1][j - 1];
                    } else {
                        dp[i][j] = Math.min(
                            dp[i - 1][j] + 1,     // deletion
                            dp[i][j - 1] + 1,     // insertion
                            dp[i - 1][j - 1] + 1  // substitution
                        );
                    }
                }
            }

            return dp[m][n];
        };

        // Calculate similarity
        const maxLength = Math.max(normalizedExpected.length, normalizedExtracted.length);
        const distance = levenshteinDistance(normalizedExpected, normalizedExtracted);
        const similarity = 1 - (distance / maxLength);

        return {
            matches: similarity >= 0.7, // 70% similarity threshold
            similarity,
            correctedName: expected // Always use the expected name
        };
    };

    const validateStatementPeriod = (extractedPeriod, cycleMonth, cycleYear) => {
        if (!extractedPeriod) return { isValid: false, details: 'No statement period detected' };

        // Handle multiple date formats (DD/MM/YYYY, MM/DD/YYYY, etc.)
        const datePatterns = [
            /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})\s*-\s*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/, // DD/MM/YYYY - DD/MM/YYYY
            /(\d{4})-(\d{1,2})-(\d{1,2})\s*-\s*(\d{4})-(\d{1,2})-(\d{1,2})/ // YYYY-MM-DD - YYYY-MM-DD
        ];

        for (const pattern of datePatterns) {
            const match = extractedPeriod.match(pattern);
            if (match) {
                // Try both DD/MM/YYYY and MM/DD/YYYY formats
                let startDay, startMonth, startYear, endDay, endMonth, endYear;

                // First, assume DD/MM/YYYY
                startDay = parseInt(match[1], 10);
                startMonth = parseInt(match[2], 10);
                startYear = parseInt(match[3], 10);
                endDay = parseInt(match[4], 10);
                endMonth = parseInt(match[5], 10);
                endYear = parseInt(match[6], 10);

                // Validate the parsed dates (check if month is between 1-12)
                if (startMonth > 12 || endMonth > 12) {
                    // Try MM/DD/YYYY instead
                    startMonth = parseInt(match[1], 10);
                    startDay = parseInt(match[2], 10);
                    // startYear stays the same
                    endMonth = parseInt(match[4], 10);
                    endDay = parseInt(match[5], 10);
                    // endYear stays the same
                }

                // Check if cycle month/year falls within the range
                if (startYear <= cycleYear && endYear >= cycleYear) {
                    if (startYear < cycleYear || (startYear === cycleYear && startMonth <= cycleMonth)) {
                        if (endYear > cycleYear || (endYear === cycleYear && endMonth >= cycleMonth)) {
                            return { isValid: true, details: 'Period contains cycle month' };
                        }
                    }
                }
            }
        }

        // Fall back to text-based matching
        const cycleMonthName = new Date(cycleYear, cycleMonth - 1).toLocaleString('en-US', { month: 'long' }).toLowerCase();
        const normalizedPeriod = extractedPeriod.toLowerCase();

        if (normalizedPeriod.includes(cycleMonthName) && normalizedPeriod.includes(cycleYear.toString())) {
            return { isValid: true, details: 'Month and year found in period text' };
        }

        return { isValid: false, details: 'Cycle month/year not found in period' };
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-7xl">
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
                    <div className="grid grid-cols-5 gap-4">
                        <Card className="col-span-3">
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
                                            <TableCell>{bank?.company_name}</TableCell>
                                            <TableCell>{extractedData?.company_name || 'Not detected'}</TableCell>
                                            <TableCell>
                                                {extractedData?.company_name &&
                                                    extractedData.company_name.toLowerCase().includes(bank?.company_name?.toLowerCase()) ? (
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
                                            <TableCell>{bank?.bank_name}</TableCell>
                                            <TableCell>
                                                <Input
                                                    value={editableBankName || extractedData?.bank_name || ''}
                                                    onChange={(e) => setEditableBankName(e.target.value)}
                                                    className="w-full"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {(() => {
                                                    // If no extracted bank name, show mismatch
                                                    if (!extractedData?.bank_name) {
                                                        return (
                                                            <div className="flex items-center text-red-500 font-medium">
                                                                <AlertTriangle className="h-4 w-4 mr-1" />
                                                                Not Detected
                                                            </div>
                                                        );
                                                    }

                                                    // Perform fuzzy matching
                                                    const matchResult = fuzzyBankNameMatch(bank?.bank_name, extractedData?.bank_name);

                                                    if (matchResult.matches) {
                                                        return (
                                                            <div className="flex items-center text-green-500 font-medium">
                                                                <CheckCircle className="h-4 w-4 mr-1" />
                                                                Match
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="flex items-center text-yellow-600 font-medium">
                                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                                            Partial Match ({(matchResult.similarity * 100).toFixed(0)}%)
                                                        </div>
                                                    );
                                                })()}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Account Number</TableCell>
                                            <TableCell>{bank?.account_number}</TableCell>
                                            <TableCell>{extractedData?.account_number || 'Not detected'}</TableCell>
                                            <TableCell>
                                                {extractedData?.account_number &&
                                                    extractedData.account_number.includes(bank?.account_number) ? (
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
                                            <TableCell>{bank?.bank_currency}</TableCell>
                                            <TableCell>{extractedData?.currency || 'Not detected'}</TableCell>
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

                        <Card className="col-span-2">
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
                                                <p className="font-medium">{extractedData?.statement_period || 'Not detected'}</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-blue-200 flex justify-between items-center">
                                            <p className="text-sm font-medium">Period Validation</p>
                                            {(() => {
                                                const periodValidation = validateStatementPeriod(
                                                    extractedData?.statement_period,
                                                    cycleMonth,
                                                    cycleYear
                                                );

                                                return (
                                                    <Badge
                                                        className={
                                                            periodValidation.isValid
                                                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                                                : "bg-red-100 text-red-700 hover:bg-red-100"
                                                        }
                                                    >
                                                        {periodValidation.isValid ? "Valid" : "Period Mismatch"}
                                                    </Badge>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={handleReExtraction}
                                        className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                    >
                                        <RefreshCcw className="h-4 w-4 mr-2" />
                                        Re-extract Data
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    
                    {extractedData?.monthly_balances && extractedData.monthly_balances.length > 0 && (
                        <Card>
                            <CardHeader className="py-3 bg-blue-50">
                                <CardTitle className="text-base flex items-center">
                                    <FileCheck className="h-4 w-4 mr-2" />
                                    Months Found
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="flex flex-wrap gap-2">
                                    {(() => {
                                        // Generate badges for all months in statement period
                                        const badges = [];
                                        let includedExpectedMonth = false;

                                        if (extractedData?.statement_period) {
                                            // Parse statement period (e.g., "01/01/2024 - 30/07/2024")
                                            const dates = extractedData.statement_period.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g);

                                            if (dates && dates.length >= 2) {
                                                // Parse start and end dates
                                                const parseDate = (dateStr) => {
                                                    const parts = dateStr.split(/[\/\-\.]/);
                                                    if (parts.length !== 3) return null;

                                                    // Try DD/MM/YYYY format first
                                                    const day = parseInt(parts[0], 10);
                                                    const month = parseInt(parts[1], 10);
                                                    const year = parseInt(parts[2], 10);

                                                    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                                                        return { day, month: month - 1, year }; // Month is 0-indexed for Date
                                                    }

                                                    // Try MM/DD/YYYY format
                                                    const day2 = parseInt(parts[1], 10);
                                                    const month2 = parseInt(parts[0], 10);

                                                    if (day2 >= 1 && day2 <= 31 && month2 >= 1 && month2 <= 12) {
                                                        return { day: day2, month: month2 - 1, year }; // Month is 0-indexed for Date
                                                    }

                                                    return null;
                                                };

                                                const startDate = parseDate(dates[0]);
                                                const endDate = parseDate(dates[1]);

                                                if (startDate && endDate) {
                                                    // Create JavaScript Date objects
                                                    const start = new Date(startDate.year, startDate.month, 1);
                                                    const end = new Date(endDate.year, endDate.month, 1);

                                                    // Check if expected month is within the date range
                                                    const expectedDate = new Date(cycleYear, cycleMonth, 1);
                                                    includedExpectedMonth = expectedDate >= start && expectedDate <= end;

                                                    // Generate badges for each month in the range
                                                    let current = new Date(start);
                                                    let index = 1;

                                                    while (current <= end) {
                                                        const year = current.getFullYear();
                                                        const month = current.getMonth();

                                                        // Check if this month is in the monthly_balances array
                                                        const isInMonthlyBalances = extractedData.monthly_balances?.some(
                                                            balance => balance.month === month && balance.year === year
                                                        );

                                                        badges.push(
                                                            <Badge
                                                                key={`${year}-${month}`}
                                                                className={
                                                                    isInMonthlyBalances
                                                                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                                }
                                                            >
                                                                {index}. {formatDate(year, month)}
                                                            </Badge>
                                                        );

                                                        // Move to next month
                                                        current.setMonth(current.getMonth() + 1);
                                                        index++;
                                                    }
                                                }
                                            }
                                        }

                                        // Add the expected month badge if it wasn't included in the range
                                        if (!includedExpectedMonth) {
                                            badges.push(
                                                <Badge
                                                    key="expected-month"
                                                    className="bg-red-100 text-red-700 hover:bg-red-200"
                                                >
                                                    {badges.length + 1}. {formatDate(cycleYear, cycleMonth)} (Expected - Missing)
                                                </Badge>
                                            );
                                        }

                                        return badges;
                                    })()}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>
                        Cancel Upload
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onProceed}
                        className="bg-amber-600 hover:bg-amber-700"
                        disabled={hasCriticalMismatches()}
                    >
                        {hasCriticalMismatches() ?
                            "Critical mismatches detected" :
                            "Proceed Anyway"}
                    </AlertDialogAction>
                    {hasCriticalMismatches() && (
                        <Alert className="mb-4 bg-red-50 border-red-200">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertTitle>Cannot Proceed</AlertTitle>
                            <AlertDescription>
                                Critical mismatches in account number, company name, or statement period were detected.
                                These must be resolved before proceeding.
                            </AlertDescription>
                        </Alert>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}