// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from '@/components/ui/badge'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useMemo, useState } from "react"
import { AlertTriangle, Check , Building, Calendar, CheckCircle, FileCheck, Loader2, RefreshCcw, XCircle } from "lucide-react"
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns'

// --- Helper Functions ---
const normalizeCurrencyCode = (code) => {
    if (!code) return '';
    const upperCode = code.toUpperCase().trim();
    const currencyMap = {
        'EURO': 'EUR', 'EUROS': 'EUR', 'US DOLLAR': 'USD', 'US DOLLARS': 'USD', 'USDOLLAR': 'USD',
        'POUND': 'GBP', 'POUNDS': 'GBP', 'STERLING': 'GBP', 'KENYA SHILLING': 'KES',
        'KENYA SHILLINGS': 'KES', 'KENYAN SHILLING': 'KES', 'KSH': 'KES', 'K.SH': 'KES',
        'KSHS': 'KES', 'K.SHS': 'KES', 'SH': 'KES'
    };
    return currencyMap[upperCode] || upperCode;
};

const formatDate = (year, month) => {
    if (year == null || month == null) return 'Unknown Date';
    return new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });
};

// --- Component Interfaces ---
interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_name: string
}

interface BankValidationDialogProps {
    isOpen: boolean
    onClose: () => void
    bank: Bank
    extractedData: { // This data is already available in the dialog props
        bank_name: string | null
        company_name: string | null
        account_number: string | null
        currency: string | null
        statement_period: string | null
        monthly_balances: any[]
        total_pages?: number;
    }
    mismatches: string[]
    onProceed: (extractedData: any) => Promise<void> | void // <--- Changed signature to pass data
    onCancel: () => void
    cycleMonth: number // 0-indexed
    cycleYear: number
    statementId?: string
    onOpenExtractionDialog?: (statement: any) => void
}

// --- Main Component ---
export function BankValidationDialog({
    isOpen,
    onClose,
    bank,
    extractedData, // This prop holds the data we need to pass back
    mismatches,
    onProceed,
    onCancel,
    cycleMonth,
    cycleYear,
    statementId,
    onOpenExtractionDialog
}: BankValidationDialogProps) {
    if (!bank) return null;

    const [editableBankName, setEditableBankName] = useState(extractedData?.bank_name || '');
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    // Check matches
    const bankNameMatches = useMemo(() =>
        extractedData.bank_name && bank.bank_name && extractedData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase()),
        [extractedData.bank_name, bank.bank_name]
    );

    const accountNumberMatches = useMemo(() =>
        extractedData.account_number && bank.account_number && extractedData.account_number.includes(bank.account_number),
        [extractedData.account_number, bank.account_number]
    );

    const currencyMatches = useMemo(() =>
        normalizeCurrencyCode(extractedData?.currency) === normalizeCurrencyCode(bank?.bank_currency),
        [extractedData?.currency, bank?.bank_currency]
    );

    const totalPages = extractedData?.total_pages || 0;

    // Handle proceed action
    // const handleProceedAction = async () => {
    //     setIsProcessing(true);
    //     try {
    //         if (statementId) {
    //             const { data: updatedStatement, error } = await supabase
    //                 .from('acc_cycle_bank_statements')
    //                 .update({
    //                     validation_status: {
    //                         is_validated: true,
    //                         validation_date: new Date().toISOString(),
    //                         validated_by: 'current_user',
    //                         mismatches: []
    //                     },
    //                     status: {
    //                         status: 'validated'
    //                     }
    //                 })
    //                 .eq('id', statementId)
    //                 .select('*')
    //                 .single();

    //             if (error) throw error;

    //             // Auto-open extraction dialog after validation
    //             if (onOpenExtractionDialog && updatedStatement) {
    //                 onClose();
    //                 setTimeout(() => {
    //                     onOpenExtractionDialog(updatedStatement);
    //                 }, 300);
    //             } else {
    //                 // <--- Key change here: Pass extractedData back to onProceed --->
    //                 await onProceed(extractedData);
    //             }
    //         } else {
    //             // <--- Key change here: Pass extractedData back to onProceed --->
    //             await onProceed(extractedData);
    //         }
    //     } catch (error) {
    //         console.error('Error during validation proceed:', error);
    //         toast({
    //             title: 'Error',
    //             description: 'Failed to proceed with validation. Please try again.',
    //             variant: 'destructive'
    //         });
    //     } finally {
    //         setIsProcessing(false);
    //     }
    // };
    // In BankValidationDialog.tsx - Update the handleProceedAction function
    const handleProceedAction = async () => {
        setIsProcessing(true);
        try {
            if (statementId) {
                const { data: updatedStatement, error } = await supabase
                    .from('acc_cycle_bank_statements')
                    .update({
                        validation_status: {
                            is_validated: true,
                            validation_date: new Date().toISOString(),
                            validated_by: 'current_user',
                            mismatches: []
                        },
                        status: {
                            status: 'validated'
                        }
                    })
                    .eq('id', statementId)
                    .select('*')
                    .single();

                if (error) throw error;

                // Close this dialog first
                onClose();

                // Auto-open extraction dialog after a brief delay
                if (onOpenExtractionDialog && updatedStatement) {
                    setTimeout(() => {
                        onOpenExtractionDialog(updatedStatement);
                    }, 300);
                } else {
                    // Pass the updated statement and extracted data back
                    await onProceed({ ...extractedData, statement: updatedStatement });
                }
            } else {
                // Pass extractedData back to onProceed for new statements
                await onProceed(extractedData);
            }
        } catch (error) {
            console.error('Error during validation proceed:', error);
            toast({
                title: 'Error',
                description: 'Failed to proceed with validation. Please try again.',
                variant: 'destructive'
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const validateStatementPeriod = (extractedPeriod, pCycleMonth, pCycleYear) => {
        if (!extractedPeriod) return { 
            isValid: false, 
            message: 'No statement period extracted.',
            startDate: null,
            endDate: null,
            monthsInRange: []
        };
        
        try {
            // First try to extract dates from common formats
            const datePattern = /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/g;
            const matches = [...extractedPeriod.matchAll(datePattern)];
            
            if (matches.length >= 2) {
                // First date (start date)
                const [, startDay, startMonth, startYear] = matches[0];
                // Last date (end date)
                const [, endDay, endMonth, endYear] = matches[matches.length - 1];

                if (!startDay || !startMonth || !startYear || !endDay || !endMonth || !endYear) {
                    return { 
                        isValid: false, 
                        message: 'Could not parse statement period format.' ,
                        startDate: null,
                        endDate: null,
                        monthsInRange: []
                    };
                }

                // Create date objects (using first of month to avoid day-of-month issues)
                const extractedStartDate = new Date(Number(startYear), Number(startMonth) - 1, 1);
                const extractedEndDate = new Date(Number(endYear), Number(endMonth) - 1, 1);
                const cycleDate = new Date(Number(pCycleYear), Number(pCycleMonth), 1);

                // Validate date ranges
                if (isNaN(extractedStartDate.getTime()) || isNaN(extractedEndDate.getTime())) {
                    return {
                        isValid: false,
                        message: 'Invalid date range in statement period.',
                        startDate: null,
                        endDate: null,
                        monthsInRange: []
                    };
                }


                // Ensure the end date is after start date
                if (extractedEndDate < extractedStartDate) {
                    return {
                        isValid: false,
                        message: 'End date is before start date in statement period.',
                        startDate: extractedStartDate,
                        endDate: extractedEndDate,
                        monthsInRange: []
                    };
                }


                // Calculate the number of months between dates
                const monthDiff = (extractedEndDate.getFullYear() - extractedStartDate.getFullYear()) * 12 + 
                                (extractedEndDate.getMonth() - extractedStartDate.getMonth()) + 1;

                // Limit to a reasonable number of months (e.g., 36 months)
                if (monthDiff > 36) {
                    // If the range is too large, default to just the cycle month
                    return {
                        isValid: true, // Still consider valid but with adjusted months
                        message: 'Statement period is too long. Using cycle month only.',
                        startDate: cycleDate,
                        endDate: cycleDate,
                        monthsInRange: [{
                            month: cycleDate.getMonth() + 1,
                            year: cycleDate.getFullYear()
                        }]
                    };
                }


                // Generate all months in the extracted period
                const monthsInRange = [];
                let currentDate = new Date(extractedStartDate);
                
                while (currentDate <= extractedEndDate) {
                    monthsInRange.push({
                        month: currentDate.getMonth() + 1,
                        year: currentDate.getFullYear()
                    });
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }


                // Check if the cycle date falls within the extracted period
                const isInRange = cycleDate >= extractedStartDate && cycleDate <= extractedEndDate;

                return {
                    isValid: isInRange,
                    message: isInRange 
                        ? 'Period matches selected cycle.' 
                        : `Extracted period is ${format(extractedStartDate, 'MMM yyyy')} to ${format(extractedEndDate, 'MMM yyyy')}, not ${format(new Date(pCycleYear, pCycleMonth), 'MMM yyyy')}.`,
                    startDate: extractedStartDate,
                    endDate: extractedEndDate,
                    monthsInRange
                };
            }

            // If we couldn't parse dates, try to extract just the month and year
            const monthYearPattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/gi;
            const monthYearMatches = extractedPeriod.match(monthYearPattern);
            
            if (monthYearMatches && monthYearMatches.length >= 2) {
                const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                
                const startMatch = monthYearMatches[0].toLowerCase();
                const endMatch = monthYearMatches[monthYearMatches.length - 1].toLowerCase();
                
                const startMonthStr = startMatch.substring(0, 3);
                const startMonth = monthNames.indexOf(startMonthStr);
                const startYear = parseInt(startMatch.match(/\d{4}/)?.[0] || '0');
                
                const endMonthStr = endMatch.substring(0, 3);
                const endMonth = monthNames.indexOf(endMonthStr);
                const endYear = parseInt(endMatch.match(/\d{4}/)?.[0] || '0');
                
                if (startMonth >= 0 && endMonth >= 0 && startYear && endYear) {
                    const extractedStartDate = new Date(startYear, startMonth, 1);
                    const extractedEndDate = new Date(endYear, endMonth, 1);
                    
                    // Generate months in range
                    const monthsInRange = [];
                    let currentDate = new Date(extractedStartDate);
                    
                    while (currentDate <= extractedEndDate) {
                        monthsInRange.push({
                            month: currentDate.getMonth() + 1,
                            year: currentDate.getFullYear()
                        });
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    }
                    
                    const cycleDate = new Date(Number(pCycleYear), Number(pCycleMonth), 1);
                    const isInRange = cycleDate >= extractedStartDate && cycleDate <= extractedEndDate;
                    
                    return {
                        isValid: isInRange,
                        message: isInRange 
                            ? 'Period matches selected cycle.' 
                            : `Extracted period is ${format(extractedStartDate, 'MMM yyyy')} to ${format(extractedEndDate, 'MMM yyyy')}, not ${format(new Date(pCycleYear, pCycleMonth), 'MMM yyyy')}.`,
                        startDate: extractedStartDate,
                        endDate: extractedEndDate,
                        monthsInRange
                    };
                }
            }
        } catch (error) {
            console.error('Error parsing statement period:', error);
        }
        
        return { 
            isValid: false, 
            message: 'Could not parse statement period format.',
            startDate: null,
            endDate: null,
            monthsInRange: []
        };
    };

    const periodValidation = useMemo(() => {
        return validateStatementPeriod(extractedData?.statement_period, cycleMonth, cycleYear);
    }, [extractedData?.statement_period, cycleMonth, cycleYear]);

    // Use months from period validation if available, otherwise fall back to monthly_balances
    const statementMonths = useMemo(() => {
        if (periodValidation.monthsInRange?.length > 0) {
            return periodValidation.monthsInRange;
        }
        return extractedData?.monthly_balances || [];
    }, [periodValidation.monthsInRange, extractedData?.monthly_balances]);

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-6xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center text-amber-600">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        Validation Issues Detected
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        The extracted bank information doesn't match the expected details. Please review the differences below:
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="py-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="py-3 bg-blue-50"><CardTitle className="text-base flex items-center"><Building className="h-4 w-4 mr-2" />Bank Details</CardTitle></CardHeader>
                            <CardContent className="pt-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow><TableHead>Field</TableHead><TableHead>Expected Value</TableHead><TableHead>Extracted Value</TableHead><TableHead>Status</TableHead></TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="font-medium">Company Name</TableCell><TableCell>{bank.company_name}</TableCell><TableCell>{extractedData.company_name || 'N/A'}</TableCell>
                                            <TableCell>
                                                {bank.company_name === extractedData.company_name ? ( // Basic check for company name
                                                    <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle className="h-4 w-4 mr-1" />Match</Badge>
                                                ) : (
                                                    <Badge variant="destructive"><AlertTriangle className="h-4 w-4 mr-1" />Mismatch</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Bank Name</TableCell><TableCell>{bank.bank_name}</TableCell>
                                            <TableCell><Input value={editableBankName} onChange={(e) => setEditableBankName(e.target.value)} /></TableCell>
                                            <TableCell>
                                                {bankNameMatches ? (
                                                    <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle className="h-4 w-4 mr-1" />Match</Badge>
                                                ) : (
                                                    <Badge variant="destructive"><AlertTriangle className="h-4 w-4 mr-1" />Mismatch</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Account Number</TableCell><TableCell>{bank.account_number}</TableCell><TableCell>{extractedData.account_number || 'N/A'}</TableCell>
                                            <TableCell>
                                                {accountNumberMatches ? (
                                                    <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle className="h-4 w-4 mr-1" />Match</Badge>
                                                ) : (
                                                    <Badge variant="destructive"><AlertTriangle className="h-4 w-4 mr-1" />Mismatch</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Currency</TableCell><TableCell>{bank.bank_currency}</TableCell><TableCell>{extractedData.currency || 'N/A'}</TableCell>
                                            <TableCell>{currencyMatches ? <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle className="h-4 w-4 mr-1" />Match</Badge> : <Badge variant="destructive"><AlertTriangle className="h-4 w-4 mr-1" />Mismatch</Badge>}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="py-3 bg-blue-50"><CardTitle className="text-base flex items-center"><Calendar className="h-4 w-4 mr-2" />Statement Details</CardTitle></CardHeader>
                                <CardContent className="pt-4 space-y-3">
                                    <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><p className="text-xs text-muted-foreground">Selected Cycle Month</p><p className="font-medium">{formatDate(cycleYear, cycleMonth)}</p></div>
                                            <div><p className="text-xs text-muted-foreground">Statement Period Extracted</p><p className="font-medium">{extractedData.statement_period || 'N/A'}</p></div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-blue-200 flex justify-between items-center">
                                            <p className="text-sm font-medium">Period Validation</p>
                                            {periodValidation.isValid ? <Badge className="bg-green-100 text-green-700">Match</Badge> : <Badge className="bg-red-100 text-red-700">Period Mismatch</Badge>}
                                        </div>
                                    </div>
                                    {/* Re-extract button might be removed or lead to full re-upload flow */}
                                    <Button variant="outline" className="w-full bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" onClick={onCancel}><RefreshCcw className="h-4 w-4 mr-2" />Re-upload & Re-extract</Button>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="py-3 bg-blue-50">
                                    <CardTitle className="text-base flex items-center">
                                        <Calendar className="h-4 w-4 mr-2" />
                                        {statementMonths.length > 0 ? 'Statement Period' : 'No Period Extracted'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {statementMonths.length > 0 ? (
                                        <div>
                                            <div className="mb-2 text-sm text-muted-foreground">
                                                {statementMonths.length === 1 ? 
                                                    '1 month in statement:' : 
                                                    `${statementMonths.length} months in statement:`}
                                            </div>
                                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                                                {statementMonths.map((month, idx) => {
                                                    const monthDate = new Date(month.year, month.month - 1);
                                                    const isCurrentCycle = 
                                                        month.month - 1 === cycleMonth && 
                                                        month.year === cycleYear;
                                                    return (
                                                        <Badge 
                                                            key={`${month.year}-${month.month}`} 
                                                            variant={isCurrentCycle ? 'default' : 'outline'}
                                                            className={`${isCurrentCycle ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-50'} flex items-center`}
                                                        >
                                                            {format(monthDate, 'MMM yyyy')}
                                                            {isCurrentCycle && <Check className="h-3 w-3 ml-1" />}
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                            {extractedData.statement_period && (
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    Period: {extractedData.statement_period}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-2" />
                                            <p className="text-sm text-muted-foreground">
                                                No statement period could be determined from the document.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>

                <AlertDialogFooter className="pt-4 border-t border-gray-100 mt-4">
                    <div className="flex items-start text-amber-600 text-sm w-full">
                        <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">Review validation issues</p>
                            <p className="text-xs text-amber-700">
                                {mismatches.length > 0 
                                    ? `${mismatches.length} issue${mismatches.length > 1 ? 's' : ''} found. Please review before proceeding.`
                                    : 'No critical issues found. You may proceed.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            onClick={onCancel} 
                            disabled={isProcessing}
                            className="min-w-[100px]"
                        >
                            {isProcessing ? 'Processing...' : 'Re-upload'}
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleProceedAction}
                            disabled={isProcessing}
                            className="bg-amber-600 hover:bg-amber-700 min-w-[140px]"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4 mr-2" />
                                    Proceed Anyway
                                </>
                            )}
                        </Button>
                    </div>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}