// app/payroll/bank-statements/components/MonthlyBalancesTable.tsx
// @ts-nocheck
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Check, CheckCircle, X, Plus } from 'lucide-react'
import { format } from 'date-fns'

interface MonthlyBalance {
    month: number;
    year: number;
    closing_balance: number | null;
    opening_balance: number | null;
    statement_page: number;
    closing_date: string | null;
    is_verified: boolean;
    verified_by: string | null;
    verified_at: string | null;
    highlight_coordinates?: { x1: number; y1: number; x2: number; y2: number; page: number; } | null;
}

interface MonthlyBalancesTableProps {
    monthlyBalances: MonthlyBalance[];
    onUpdateBalance: (index: number, field: string, value: string) => void;
    onVerifyBalance: (index: number) => void;
    onRemoveBalance: (index: number) => void;
    onAddBalance: () => void;
    isRangeView?: boolean;
}

const formatNumberWithCommas = (value: string | number | null | undefined) => {
    if (value === '' || value === null || value === undefined) return '';
    const stringValue = String(value);
    const parts = stringValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
};

export function MonthlyBalancesTable({
    monthlyBalances,
    onUpdateBalance,
    onVerifyBalance,
    onRemoveBalance,
    onAddBalance,
    isRangeView = false
}: MonthlyBalancesTableProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                    {/* {isRangeView ? 'Period Breakdown' : 'Monthly Balances'} */}
                </span>
                <Button variant="outline" size="sm" onClick={onAddBalance}>
                    <Plus className="h-4 w-4 mr-1" />Add
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Closing Balance</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {monthlyBalances.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>No {isRangeView ? 'period' : 'monthly'} balances found</p>
                                <p className="text-sm mt-1">Click "Add" to add balance entries</p>
                            </TableCell>
                        </TableRow>
                    ) : (
                        monthlyBalances
                            .sort((a, b) => {
                                if (a.year !== b.year) return a.year - b.year;
                                return a.month - b.month;
                            })
                            .map((balance, index) => (
                                <TableRow key={`${balance.year}-${balance.month}`}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span>{format(new Date(balance.year, balance.month - 1), 'MMM yyyy')}</span>
                                            {isRangeView && (
                                                <Badge variant="outline" className="text-xs">
                                                    Range
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="text"
                                            value={formatNumberWithCommas(balance.closing_balance)}
                                            onChange={(e) => onUpdateBalance(index, 'closing_balance', e.target.value)}
                                            placeholder="0.00"
                                            className="w-full max-w-[200px]"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            {balance.is_verified ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                    <Check className="h-3 w-3 mr-1" />Verified
                                                </Badge>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onVerifyBalance(index)}
                                                >
                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                    Verify
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onRemoveBalance(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}