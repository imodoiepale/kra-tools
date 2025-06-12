// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from '@/components/ui/badge'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useMemo, useState } from "react"
import { AlertTriangle, Building, Calendar, CheckCircle, FileCheck, RefreshCcw } from "lucide-react"

// --- Helper Functions ---
const normalizeCurrencyCode = (code) => {
    if (!code) return '';
    const upperCode = code.toUpperCase().trim();
    const currencyMap = { 'KSH': 'KES', 'US DOLLAR': 'USD' };
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
    extractedData: {
        bank_name: string | null
        company_name: string | null
        account_number: string | null
        currency: string | null
        statement_period: string | null
        monthly_balances: any[]
    }
    mismatches: string[]
    onProceed: () => void
    onCancel: () => void
    cycleMonth: number // 0-indexed
    cycleYear: number
}

// --- Main Component ---
export function BankValidationDialog({
    isOpen,
    onClose,
    bank,
    extractedData,
    onProceed,
    onCancel,
    cycleMonth, // is 0-indexed
    cycleYear
}: BankValidationDialogProps) {
    if (!bank) return null;

    const [editableBankName, setEditableBankName] = useState(extractedData?.bank_name || '');
    const currencyMatches = useMemo(() => normalizeCurrencyCode(extractedData?.currency) === normalizeCurrencyCode(bank?.bank_currency), [extractedData?.currency, bank?.bank_currency]);

    const validateStatementPeriod = (extractedPeriod, pCycleMonth, pCycleYear) => {
        if (!extractedPeriod) return { isValid: false };

        const datePattern = /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/;
        const dates = extractedPeriod.match(new RegExp(datePattern.source, 'g'));

        if (dates && dates.length >= 2) {
            const startDateMatch = dates[0].match(datePattern);
            const endDateMatch = dates[1].match(datePattern);

            if (startDateMatch && endDateMatch) {
                // Handle DD/MM/YYYY vs MM/DD/YYYY
                let startMonth = parseInt(startDateMatch[2], 10);
                if (startMonth > 12) startMonth = parseInt(startDateMatch[1], 10); // Swap if month is > 12
                const startYear = parseInt(startDateMatch[3], 10);

                let endMonth = parseInt(endDateMatch[2], 10);
                if (endMonth > 12) endMonth = parseInt(endDateMatch[1], 10);
                const endYear = parseInt(endDateMatch[3], 10);

                // Check if the cycle month is within the range
                const cycleDate = new Date(pCycleYear, pCycleMonth, 15); // Use mid-month to avoid timezone issues
                const startDate = new Date(startYear, startMonth - 1, 1);
                const endDate = new Date(endYear, endMonth - 1, 28);

                if (cycleDate >= startDate && cycleDate <= endDate) {
                    return { isValid: true };
                }
            }
        }
        return { isValid: false };
    };

    const periodValidation = useMemo(() => {
        return validateStatementPeriod(extractedData?.statement_period, cycleMonth, cycleYear);
    }, [extractedData?.statement_period, cycleMonth, cycleYear]);

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
                                            <TableCell><Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle className="h-4 w-4 mr-1" />Match</Badge></TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Bank Name</TableCell><TableCell>{bank.bank_name}</TableCell>
                                            <TableCell><Input value={editableBankName} onChange={(e) => setEditableBankName(e.target.value)} /></TableCell>
                                            <TableCell><Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle className="h-4 w-4 mr-1" />Match</Badge></TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Account Number</TableCell><TableCell>{bank.account_number}</TableCell><TableCell>{extractedData.account_number || 'N/A'}</TableCell>
                                            <TableCell><Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle className="h-4 w-4 mr-1" />Match</Badge></TableCell>
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
                                            <div><p className="text-xs text-muted-foreground">Cycle Month</p><p className="font-medium">{formatDate(cycleYear, cycleMonth)}</p></div>
                                            <div><p className="text-xs text-muted-foreground">Statement Period</p><p className="font-medium">{extractedData.statement_period || 'N/A'}</p></div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-blue-200 flex justify-between items-center">
                                            <p className="text-sm font-medium">Period Validation</p>
                                            {periodValidation.isValid ? <Badge className="bg-green-100 text-green-700">Match</Badge> : <Badge className="bg-red-100 text-red-700">Period Mismatch</Badge>}
                                        </div>
                                    </div>
                                    <Button variant="outline" className="w-full bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"><RefreshCcw className="h-4 w-4 mr-2" />Re-extract Data</Button>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="py-3 bg-blue-50"><CardTitle className="text-base flex items-center"><FileCheck className="h-4 w-4 mr-2" />Months Found</CardTitle></CardHeader>
                                <CardContent className="pt-4"><Badge className="bg-gray-100 text-gray-800">1. March 2024</Badge></CardContent>
                            </Card>
                        </div>
                    </div>
                </div>

                <AlertDialogFooter className="pt-4">
                    <div className="flex items-center text-amber-600 text-sm w-full"><AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" /><span>Please review the validation issues before proceeding.</span></div>
                    <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onProceed} className="bg-amber-600 hover:bg-amber-700">Proceed Anyway</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}