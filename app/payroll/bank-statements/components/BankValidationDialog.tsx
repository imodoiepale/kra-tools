//@ts-nocheck
// BankValidationDialog.tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle } from "lucide-react"
import { format } from 'date-fns'

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
}

interface ExtractedData {
    bank_name: string | null
    company_name: string | null
    account_number: string | null
    currency: string | null
    statement_period: string | null
    opening_balance: number | null
    closing_balance: number | null
    monthly_balances: Array<{
        month: number
        year: number
        opening_balance: number
        closing_balance: number
        statement_page: number
    }>
}

interface BankValidationDialogProps {
    isOpen: boolean
    onClose: () => void
    bank: Bank
    extractedData: ExtractedData
    mismatches: string[]
    onProceed: () => void
    onCancel: () => void
    selectedMonths?: number[]
    cycleYear?: number
}

export function BankValidationDialog({
    isOpen,
    onClose,
    bank,
    extractedData,
    mismatches,
    onProceed,
    onCancel,
    selectedMonths = [],
    cycleYear
}: BankValidationDialogProps) {
    const formatMonthYear = (month: number, year: number) => {
        try {
            const date = new Date(year, month - 1);
            return format(date, 'MMMM yyyy');
        } catch (error) {
            return 'Invalid Date';
        }
    };

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
                                    <span className={
                                        extractedData.company_name &&
                                            extractedData.company_name.includes(bank.company_name)
                                            ? "text-green-500 font-medium"
                                            : "text-red-500 font-medium"
                                    }>
                                        {extractedData.company_name &&
                                            extractedData.company_name.includes(bank.company_name)
                                            ? "Match"
                                            : "Mismatch"}
                                    </span>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Bank Name</TableCell>
                                <TableCell>{bank.bank_name}</TableCell>
                                <TableCell>{extractedData.bank_name || 'Not detected'}</TableCell>
                                <TableCell>
                                    <span className={
                                        extractedData.bank_name &&
                                            extractedData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())
                                            ? "text-green-500 font-medium"
                                            : "text-red-500 font-medium"
                                    }>
                                        {extractedData.bank_name &&
                                            extractedData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())
                                            ? "Match"
                                            : "Mismatch"}
                                    </span>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Account Number</TableCell>
                                <TableCell>{bank.account_number}</TableCell>
                                <TableCell>{extractedData.account_number || 'Not detected'}</TableCell>
                                <TableCell>
                                    <span className={
                                        extractedData.account_number &&
                                            extractedData.account_number.includes(bank.account_number)
                                            ? "text-green-500 font-medium"
                                            : "text-red-500 font-medium"
                                    }>
                                        {extractedData.account_number &&
                                            extractedData.account_number.includes(bank.account_number)
                                            ? "Match"
                                            : "Mismatch"}
                                    </span>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Currency</TableCell>
                                <TableCell>{bank.bank_currency}</TableCell>
                                <TableCell>{extractedData.currency || 'Not detected'}</TableCell>
                                <TableCell>
                                    <span className={
                                        extractedData.currency &&
                                            extractedData.currency === bank.bank_currency
                                            ? "text-green-500 font-medium"
                                            : "text-red-500 font-medium"
                                    }>
                                        {extractedData.currency &&
                                            extractedData.currency === bank.bank_currency
                                            ? "Match"
                                            : "Mismatch"}
                                    </span>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Period</TableCell>
                                <TableCell>{extractedData.statement_period}</TableCell>
                                <TableCell>{extractedData.statement_period || 'Not detected'}</TableCell>
                                <TableCell>
                                    <span className={
                                        extractedData.statement_period &&
                                            extractedData.statement_period === extractedData.statement_period
                                            ? "text-green-500 font-medium"
                                            : "text-red-500 font-medium"
                                    }>
                                        {extractedData.statement_period &&
                                            extractedData.statement_period === extractedData.statement_period
                                            ? "Match"
                                            : "Mismatch"}
                                    </span>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>

                    <div className="mt-4 space-y-2">
                        <h4 className="font-medium">Additional Extracted Information:</h4>
                        <p>Statement Period: {extractedData.statement_period || 'Not detected'}</p>
                        <p>Opening Balance: {extractedData.opening_balance != null ? extractedData.opening_balance.toLocaleString() : 'Not detected'}</p>
                        <p>Closing Balance: {extractedData.closing_balance != null ? extractedData.closing_balance.toLocaleString() : 'Not detected'}</p>
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
    )
}