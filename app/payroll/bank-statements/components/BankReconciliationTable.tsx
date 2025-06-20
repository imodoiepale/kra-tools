// app/payroll/bank-statements/BankReconciliationTable.tsx (Updated)
// @ts-nocheck
'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { format } from 'date-fns'

import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Loader2, UploadCloud, Edit, Eye, CheckCircle, AlertTriangle, MoreHorizontal, Trash, X, Lock, Plus, Calendar, XCircle } from 'lucide-react'
import { BankStatementUploadDialog } from './BankStatementUploadDialog'
import BankExtractionDialog from './BankExtractionDialog'
import { QuickbooksBalanceDialog } from './QuickbooksBalanceDialog'
import { PasswordUpdateDialog } from './PasswordUpdateDialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Bank, BankStatement, Company, BankReconciliationTableProps, FilterWithStatus } from './types'
import { normalizeCurrencyCode } from '../utils/bankExtractionUtils'
import { useStatementCycle } from '../../hooks/useStatementCycle'
import { Badge } from '@/components/ui/badge'

function EnhancedDeleteConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    statement,
    bank
}: {
    isOpen: boolean
    onClose: () => void
    onConfirm: (deleteType: 'period' | 'all' | 'file') => void
    statement: BankStatement | null
    bank: Bank | null
}) {
    const [deleteType, setDeleteType] = useState<'period' | 'all' | 'file'>('period')

    if (!statement || !bank) return null

    const isMultiMonth = statement.statement_extractions?.statement_period &&
        statement.statement_extractions.statement_period.includes('-')

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <Trash className="h-5 w-5 text-red-500" />
                        Delete Bank Statement
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                        <p>Choose what you want to delete for <strong>{bank.company_name}</strong> - <strong>{bank.bank_name}</strong>:</p>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="deleteType"
                                    value="period"
                                    checked={deleteType === 'period'}
                                    onChange={(e) => setDeleteType(e.target.value as 'period')}
                                    className="text-blue-600"
                                />
                                <span className="text-sm">
                                    Delete only this period ({format(new Date(statement.statement_year, statement.statement_month), 'MMM yyyy')})
                                    <br />
                                    <span className="text-xs text-gray-500">Files will be preserved for other periods</span>
                                </span>
                            </label>

                            {isMultiMonth && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="deleteType"
                                        value="all"
                                        checked={deleteType === 'all'}
                                        onChange={(e) => setDeleteType(e.target.value as 'all')}
                                        className="text-amber-600"
                                    />
                                    <span className="text-sm">
                                        Delete all periods in this statement
                                        <br />
                                        <span className="text-xs text-gray-500">This covers multiple months</span>
                                    </span>
                                </label>
                            )}

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="deleteType"
                                    value="file"
                                    checked={deleteType === 'file'}
                                    onChange={(e) => setDeleteType(e.target.value as 'file')}
                                    className="text-red-600"
                                />
                                <span className="text-sm">
                                    Delete everything including files
                                    <br />
                                    <span className="text-xs text-red-500">⚠️ This cannot be undone</span>
                                </span>
                            </label>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => onConfirm(deleteType)}
                        className={`${deleteType === 'file'
                            ? 'bg-red-600 hover:bg-red-700'
                            : deleteType === 'all'
                                ? 'bg-amber-600 hover:bg-amber-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {deleteType === 'file' ? 'Delete Everything' :
                            deleteType === 'all' ? 'Delete All Periods' :
                                'Delete Period Only'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export function BankReconciliationTable({
    selectedYear,
    selectedMonth,
    searchTerm,
    onStatsChange,
    selectedClientTypes = [],
    selectedStatementStatuses = []
}: BankReconciliationTableProps) {
    const { loading, getOrCreateStatementCycle, fetchCoreData, deleteStatement, checkBankStatementTypes } = useStatementCycle();
    const { toast } = useToast();

    const [companies, setCompanies] = useState<Company[]>([]);
    const [allBanks, setAllBanks] = useState<Bank[]>([]);
    const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
    const [statementCycleId, setStatementCycleId] = useState<string | null>(null);
    const [banksWithMultipleTypes, setBanksWithMultipleTypes] = useState<any[]>([]);

    const [activeBank, setActiveBank] = useState<Bank | null>(null);
    const [activeStatement, setActiveStatement] = useState<BankStatement | null>(null);

    const [uploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false);
    const [extractionDialogOpen, setExtractionDialogOpen] = useState<boolean>(false);
    const [quickbooksDialogOpen, setQuickbooksDialogOpen] = useState<boolean>(false);
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState<boolean>(false);
    const [passwordDialogOpen, setPasswordDialogOpen] = useState<boolean>(false);

    const refreshData = useCallback(async () => {
        console.log('Refreshing data for year:', selectedYear, 'month:', selectedMonth);

        const cycleId = await getOrCreateStatementCycle(selectedYear, selectedMonth);
        if (cycleId) {
            console.log('Got cycle ID:', cycleId);
            setStatementCycleId(cycleId);
            const { companies, banks, statements, banksWithMultipleTypes } = await fetchCoreData(cycleId);

            console.log('Fetched data:', {
                companies: companies.length,
                banks: banks.length,
                statements: statements.length,
                banksWithMultipleTypes: banksWithMultipleTypes.length,
                selectedMonth,
                selectedYear,
                cycleId
            });

            setCompanies(companies);
            setAllBanks(banks);
            setBankStatements(statements);
            setBanksWithMultipleTypes(banksWithMultipleTypes);
            onStatsChange();
        }
    }, [selectedYear, selectedMonth, getOrCreateStatementCycle, fetchCoreData, onStatsChange]);

    useEffect(() => {
        refreshData();
    }, [selectedYear, selectedMonth, refreshData]);

    const filteredCompanies = useMemo(() => {
        if (!selectedClientTypes || selectedClientTypes.length === 0) {
            return companies;
        }
        const currentDate = new Date();
        const isClientCurrentlyActive = (company: Company, typeKey: string): boolean => {
            const fromDateStr = company[`${typeKey}_client_effective_from`];
            const toDateStr = company[`${typeKey}_client_effective_to`];
            if (!fromDateStr || !toDateStr) return false;
            return new Date(fromDateStr) <= currentDate && currentDate <= new Date(toDateStr);
        };
        const hasClientType = (company: Company, typeKey: string): boolean => !!company[`${typeKey}_client_effective_from`];

        return companies.filter(company => {
            return selectedClientTypes.some(filter => {
                const { key: typeKey, status } = filter;
                if (!hasClientType(company, typeKey)) return false;
                const isCurrentlyActive = isClientCurrentlyActive(company, typeKey);
                switch (status) {
                    case 'active': return isCurrentlyActive;
                    case 'inactive': return !isCurrentlyActive;
                    case 'all': return true;
                    default: return false;
                }
            });
        });
    }, [companies, selectedClientTypes]);

    useEffect(() => {
    const handleBankStatementsUpdated = (event) => {
        console.log('🔄 Bank reconciliation table refreshing due to update', event.detail);
        refreshData();
    };

    window.addEventListener('bankStatementsUpdated', handleBankStatementsUpdated);
    
    return () => {
        window.removeEventListener('bankStatementsUpdated', handleBankStatementsUpdated);
    };
    
}, [refreshData]);
    const organizedData = useMemo(() => {
        const companiesWithBanks = filteredCompanies.map(company => ({
            ...company,
            banks: allBanks.filter(bank => bank.company_id === company.id)
        }));
        return companiesWithBanks.sort((a, b) => {
            if (a.banks.length === 0 && b.banks.length > 0) return 1;
            if (a.banks.length > 0 && b.banks.length === 0) return -1;
            return a.company_name.localeCompare(b.company_name);
        });
    }, [filteredCompanies, allBanks]);

    const searchFilteredData = useMemo(() => {
        if (!searchTerm) return organizedData;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return organizedData.filter(company => {
            const companyNameMatch = company.company_name?.toLowerCase().includes(lowerSearchTerm);
            const bankMatch = company.banks?.some(bank =>
                bank.bank_name?.toLowerCase().includes(lowerSearchTerm) ||
                bank.account_number?.includes(searchTerm)
            );
            return companyNameMatch || bankMatch;
        }).map(company => ({
            ...company,
            banks: company.banks.filter(bank =>
                company.company_name?.toLowerCase().includes(lowerSearchTerm) ||
                bank.bank_name?.toLowerCase().includes(lowerSearchTerm) ||
                bank.account_number?.includes(searchTerm)
            )
        }));
    }, [organizedData, searchTerm]);

    const getStatementFilterCondition = (statement: BankStatement, filterKey: string) => {
        switch (filterKey) {
            case 'validated': return !!statement.validation_status?.is_validated && (statement.validation_status?.mismatches?.length || 0) === 0;
            case 'pending_validation': return !statement.validation_status?.is_validated && (statement.validation_status?.mismatches?.length || 0) === 0;
            case 'has_issues': return (statement.validation_status?.mismatches?.length || 0) > 0;
            case 'reconciled':
                const closingBal = statement.statement_extractions?.closing_balance ?? null;
                const qbBal = statement.status?.quickbooks_balance ?? null;
                return closingBal !== null && qbBal !== null && Math.abs(closingBal - qbBal) <= 0.01;
            case 'pending_reconciliation':
                const closingBalance = statement.statement_extractions?.closing_balance ?? null;
                const quickbooksBalance = statement.status?.quickbooks_balance ?? null;
                if (closingBalance === null && quickbooksBalance === null) return false;
                return closingBalance !== null && quickbooksBalance !== null && Math.abs(closingBalance - quickbooksBalance) > 0.01;
            case 'all': return true;
            default: return false;
        }
    };

    const statusFilteredStatements = useMemo(() => {
        if (!selectedStatementStatuses || selectedStatementStatuses.length === 0) {
            return bankStatements;
        }

        const activeFilterKeys = new Set(selectedStatementStatuses.map(f => f.key));

        if (activeFilterKeys.has('all')) {
            return bankStatements;
        }

        return bankStatements.filter(statement =>
            Array.from(activeFilterKeys).some(filterKey => getStatementFilterCondition(statement, filterKey))
        );
    }, [bankStatements, selectedStatementStatuses]);

    const handleOpenDialog = (dialogType: string, bank: Bank, statementType?: 'monthly' | 'range') => {
        let currentStatementForPeriod = null;

        if (statementType) {
            // Find specific statement type
            currentStatementForPeriod = bankStatements.find(
                s => s.bank_id === bank.id &&
                    s.statement_month === selectedMonth &&
                    s.statement_year === selectedYear &&
                    s.statement_type === statementType
            );
        } else {
            // Find any statement for the period
            currentStatementForPeriod = bankStatements.find(
                s => s.bank_id === bank.id && s.statement_month === selectedMonth && s.statement_year === selectedYear
            );
        }

        setActiveBank(bank);
        setActiveStatement(currentStatementForPeriod || null);

        switch (dialogType) {
            case 'upload':
                setUploadDialogOpen(true);
                break;
            case 'view':
            case 'extract':
                if (currentStatementForPeriod) {
                    setExtractionDialogOpen(true);
                } else {
                    toast({
                        title: "No Statement",
                        description: "No statement found for this period to extract."
                    });
                }
                break;
            case 'qb':
                if (currentStatementForPeriod) {
                    setQuickbooksDialogOpen(true);
                } else {
                    toast({
                        title: "No Statement",
                        description: "No statement found for this period to update QB balance."
                    });
                }
                break;
            case 'delete':
                if (currentStatementForPeriod) {
                    setDeleteConfirmationOpen(true);
                } else {
                    toast({
                        title: "No Statement",
                        description: "No statement found for this period to delete."
                    });
                }
                break;
            case 'password':
                setPasswordDialogOpen(true);
                break;
        }
    };

    const handleDialogClose = useCallback(() => {
        setUploadDialogOpen(false);
        setExtractionDialogOpen(false);
        setQuickbooksDialogOpen(false);
        setDeleteConfirmationOpen(false);
        setPasswordDialogOpen(false);
        setActiveBank(null);
        setActiveStatement(null);
        refreshData();
    }, [refreshData]);

    const confirmDelete = async (deleteType: 'period' | 'all' | 'file') => {
        if (!activeStatement || !activeBank) return

        try {
            let success = false

            switch (deleteType) {
                case 'period':
                    success = await deleteStatement(activeStatement, { preserveFiles: true, periodOnly: true })
                    break
                case 'all':
                    success = await deleteStatement(activeStatement, { preserveFiles: true, allPeriods: true })
                    break
                case 'file':
                    success = await deleteStatement(activeStatement, { preserveFiles: false, allPeriods: true })
                    break
            }

            if (success) {
                toast({
                    title: "Success",
                    description: `Statement ${deleteType === 'file' ? 'and files' : 'entries'} deleted successfully`,
                })
                refreshData()
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete statement",
                variant: "destructive"
            })
        }

        setDeleteConfirmationOpen(false)
        setActiveStatement(null)
        setActiveBank(null)
    }

    const formatCurrency = (amount: number | null | undefined, currency: string) => {
        if (amount === null || amount === undefined) return '-';
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: normalizeCurrencyCode(currency), minimumFractionDigits: 2 }).format(amount);
        } catch (e) {
            return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
        }
    };

    const getValidationStatusIcon = (statement: BankStatement | null) => {
        if (!statement?.statement_document?.statement_pdf) return null;
        if (statement.validation_status?.is_validated && (statement.validation_status?.mismatches?.length || 0) === 0) {
            return <CheckCircle className="h-4 w-4 text-green-500" />;
        }
        if ((statement.validation_status?.mismatches?.length || 0) > 0) {
            return <AlertTriangle className="h-4 w-4 text-amber-500" />;
        }
        return null;
    };

    const finalFilteredData = useMemo(() => {
        let companiesWithBanks = searchFilteredData;

        return companiesWithBanks.map(company => ({
            ...company,
            banks: company.banks.filter(bank => {
                const statement = statusFilteredStatements.find(s =>
                    s.bank_id === bank.id &&
                    s.statement_month === selectedMonth &&
                    s.statement_year === selectedYear
                );

                if (!selectedStatementStatuses || selectedStatementStatuses.length === 0 || selectedStatementStatuses.some(f => f.key === 'all')) {
                    return true;
                }

                if (!statement) {
                    return selectedStatementStatuses.some(f => f.key === 'no_statement');
                }

                return selectedStatementStatuses.some(filter => getStatementFilterCondition(statement, filter.key));
            })
        })).filter(company => company.banks.length > 0);
    }, [searchFilteredData, statusFilteredStatements, selectedMonth, selectedYear, selectedStatementStatuses]);

    const getBankStatementTypes = (bankId: number) => {
        const statements = bankStatements.filter(s =>
            s.bank_id === bankId &&
            s.statement_month === selectedMonth &&
            s.statement_year === selectedYear
        );

        const hasMonthly = statements.some(s => s.statement_type === 'monthly');
        const hasRange = statements.some(s => s.statement_type === 'range');

        return { hasMonthly, hasRange, statements };
    };

    return (
        <div className="space-y-4">
            <div className="rounded-md border h-[calc(100vh-380px)] overflow-auto mb-4">
                <Table aria-label="Bank Reconciliation" className="border border-gray-200 text-sm">
                    <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-blue-600 hover:bg-blue-600 [&>th]:border-r [&>th]:border-blue-500 last:[&>th]:border-r-0">
                            <TableHead className="text-white font-semibold w-[30px] text-center p-1">No.</TableHead>
                            <TableHead className="text-white font-semibold w-[150px] p-1">Company</TableHead>
                            <TableHead className="text-white font-semibold w-[130px] p-1">Bank</TableHead>
                            <TableHead className="text-white font-semibold w-[100px] p-1">Acc Number</TableHead>
                            <TableHead className="text-white font-semibold w-[60px] p-1">Curr</TableHead>
                            <TableHead className="text-white font-semibold w-[80px] p-1">Password</TableHead>
                            <TableHead className="text-white font-semibold w-[60px] p-1">Monthly</TableHead>
                            <TableHead className="text-white font-semibold w-[60px] p-1">Range</TableHead>
                            <TableHead className="text-white font-semibold w-[100px] p-1">Statement</TableHead>
                            <TableHead className="text-white font-semibold w-[100px] p-1">Closing Bal</TableHead>
                            <TableHead className="text-white font-semibold w-[100px] p-1">QB Balance</TableHead>
                            <TableHead className="text-white font-semibold w-[100px] p-1">Diff</TableHead>
                            <TableHead className="text-white font-semibold w-[80px] p-1">Status</TableHead>
                            <TableHead className="text-white font-semibold w-[60px] p-1">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={12} className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : finalFilteredData.length === 0 ? (
                            <TableRow><TableCell colSpan={12} className="text-center py-4">No banks found for the selected filters.</TableCell></TableRow>
                        ) : (
                            finalFilteredData.map((company, companyIndex) => (
                                company.banks.length === 0 ? (
                                    <TableRow key={`company-${company.id}`} className="bg-gray-50 hover:bg-gray-100">
                                        <TableCell className="font-medium text-center border-r border-gray-200 p-1">{companyIndex + 1}</TableCell>
                                        <TableCell className="font-medium border-r border-gray-200 p-1">
                                            <TooltipProvider><Tooltip><TooltipTrigger>{(company.company_name || 'Unknown Company').split(" ").slice(0, 2).join(" ")}</TooltipTrigger><TooltipContent>{company.company_name || 'Unknown Company'}</TooltipContent></Tooltip></TooltipProvider>
                                        </TableCell>
                                        <TableCell colSpan={10} className="text-center text-red-500 font-bold p-1">No banks configured</TableCell>
                                    </TableRow>
                                ) : (
                                    company.banks.map((bank, bankIndex) => {
                                        const { hasMonthly, hasRange, statements } = getBankStatementTypes(bank.id);
                                        const statement = statements[0]; // Use first statement for display

                                        const closingBalance = statement?.statement_extractions?.closing_balance
                                        const qbBalance = statement?.status?.quickbooks_balance
                                        const difference = (closingBalance != null && qbBalance != null) ? closingBalance - qbBalance : null

                                        return (
                                            <TableRow key={bank.id} className={`${bankIndex % 2 === 0 ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'} [&>td]:border-r [&>td]:border-gray-200 last:[&>td]:border-r-0`}>
                                                {bankIndex === 0 && (
                                                    <>
                                                        <TableCell className="font-medium text-center border-r border-gray-200 p-1" rowSpan={company.banks.length}>{companyIndex + 1}</TableCell>
                                                        <TableCell className="font-medium border-r border-gray-200 p-1" rowSpan={company.banks.length}>
                                                            <TooltipProvider><Tooltip><TooltipTrigger>{(company.company_name || 'Unknown Company').split(" ").slice(0, 2).join(" ")}</TooltipTrigger><TooltipContent>{company.company_name || 'Unknown Company'}</TooltipContent></Tooltip></TooltipProvider>
                                                        </TableCell>
                                                    </>
                                                )}
                                                <TableCell className="border-r border-gray-200 p-1 truncate">
                                                    <TooltipProvider><Tooltip><TooltipTrigger className="truncate">{bank.bank_name}</TooltipTrigger><TooltipContent>{bank.bank_name}</TooltipContent></Tooltip></TooltipProvider>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 font-mono text-xs p-1 truncate">{bank.account_number}</TableCell>
                                                <TableCell className="border-r border-gray-200 p-1">{normalizeCurrencyCode(bank.bank_currency)}</TableCell>
                                                <TableCell className="border-r border-gray-200 p-1">
                                                    <div className="flex items-center gap-1">
                                                        {bank.acc_password ? (
                                                            <span className="text-green-700 font-bold text-xs">
                                                                {bank.acc_password}
                                                            </span>
                                                        ) : (
                                                            <span className="text-red-700 font-bold text-xs">
                                                                Missing
                                                            </span>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-4 w-4 p-0"
                                                            onClick={() => handleOpenDialog('password', bank)}
                                                            aria-label="Edit password"
                                                        >
                                                            <Edit className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 p-1 text-center">
                                                    {hasMonthly ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-400 mx-auto" />
                                                    )}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 p-1 text-center">
                                                    {hasRange ? (
                                                        <CheckCircle className="h-4 w-4 text-purple-500 mx-auto" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-400 mx-auto" />
                                                    )}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 p-1">
                                                    <div className="flex items-center gap-1">
                                                        {statement ? (
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className={`relative flex gap-1.5 items-center px-2 py-1 ${statement.statement_document?.statement_pdf ? 'border-green-300 bg-green-50/50 hover:bg-green-100/60' : 'border-blue-300 bg-blue-50/50 hover:bg-blue-100/60'}`}
                                                                    onClick={() => handleOpenDialog('view', bank)}
                                                                >
                                                                    <Eye className="h-3 w-3" />
                                                                    <span className="text-xs">View</span>
                                                                    {getValidationStatusIcon(statement) && (
                                                                        <span className="ml-0.5">{getValidationStatusIcon(statement)}</span>
                                                                    )}
                                                                </Button>

                                                                {/* Statement Type Indicators */}
                                                                <div className="flex flex-col gap-0.5">
                                                                    {hasMonthly && (
                                                                        <Badge variant="outline" className="h-4 text-xs px-1 py-0 bg-blue-50 text-blue-700 border-blue-300">
                                                                            M
                                                                        </Badge>
                                                                    )}
                                                                    {hasRange && (
                                                                        <Badge variant="outline" className="h-4 text-xs px-1 py-0 bg-purple-50 text-purple-700 border-purple-300">
                                                                            R
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="relative flex gap-1.5 items-center px-3 py-1.5 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100/60"
                                                                onClick={() => handleOpenDialog('upload', bank)}
                                                            >
                                                                <UploadCloud className="h-3.5 w-3.5" />
                                                                <span>Upload</span>
                                                            </Button>
                                                        )}

                                                        {/* Add Statement Type Button */}
                                                        {(hasMonthly || hasRange) && !(hasMonthly && hasRange) && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 border border-dashed border-gray-300 hover:border-blue-400"
                                                                onClick={() => handleOpenDialog('upload', bank)}
                                                                title={`Add ${hasMonthly ? 'Range' : 'Monthly'} Statement`}
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right p-1">{formatCurrency(closingBalance, bank.bank_currency)}</TableCell>
                                                <TableCell className="border-r border-gray-200 p-1">
                                                    <div className="flex items-center gap-1">
                                                        <span className="flex-1 text-right">
                                                            {qbBalance !== null && qbBalance !== undefined
                                                                ? formatCurrency(qbBalance, bank.bank_currency)
                                                                : '-'}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 p-0"
                                                            onClick={() => handleOpenDialog('qb', bank)}
                                                            aria-label="Edit QuickBooks balance"
                                                        >
                                                            <Edit className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className={`border-r border-gray-200 text-right p-1 ${difference !== null ? (Math.abs(difference) > 0.01 ? 'text-red-500 font-bold' : 'text-green-500 font-bold') : ''}`}>{formatCurrency(difference, bank.bank_currency)}</TableCell>
                                                <TableCell className="border-r border-gray-200 p-1 truncate">
                                                    <TooltipProvider><Tooltip><TooltipTrigger className="truncate">{statement?.status?.status || 'No Statement'}</TooltipTrigger><TooltipContent>{statement?.status?.status || 'No Statement'}</TooltipContent></Tooltip></TooltipProvider>
                                                </TableCell>
                                                <TableCell className="p-1">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-5 w-5 p-0"><MoreHorizontal className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-52">
                                                            <DropdownMenuItem onClick={() => handleOpenDialog('view', bank)} disabled={!statement} className="flex items-center gap-2 text-xs py-1.5">
                                                                <Eye className="h-3.5 w-3.5" />View Statement
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleOpenDialog('upload', bank)} className="flex items-center gap-2 text-xs py-1.5">
                                                                <UploadCloud className="h-3.5 w-3.5" />{statement ? 'Replace/Add' : 'Upload'}
                                                            </DropdownMenuItem>

                                                            {/* Statement Type Specific Actions */}
                                                            {hasMonthly && (
                                                                <DropdownMenuItem onClick={() => handleOpenDialog('view', bank, 'monthly')} className="flex items-center gap-2 text-xs py-1.5">
                                                                    <Calendar className="h-3.5 w-3.5" />View Monthly
                                                                </DropdownMenuItem>
                                                            )}
                                                            {hasRange && (
                                                                <DropdownMenuItem onClick={() => handleOpenDialog('view', bank, 'range')} className="flex items-center gap-2 text-xs py-1.5">
                                                                    <Calendar className="h-3.5 w-3.5" />View Range
                                                                </DropdownMenuItem>
                                                            )}

                                                            <DropdownMenuItem onClick={() => handleOpenDialog('qb', bank)} disabled={!statement} className="flex items-center gap-2 text-xs py-1.5">
                                                                <Edit className="h-3.5 w-3.5" />Update QB
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleOpenDialog('password', bank)} className="flex items-center gap-2 text-xs py-1.5">
                                                                <Lock className="h-3.5 w-3.5" />Update Password
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleOpenDialog('delete', bank)} disabled={!statement} className="flex items-center gap-2 text-xs py-1.5 text-red-600">
                                                                <Trash className="h-3.5 w-3.5" />Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {uploadDialogOpen && activeBank && (
                <BankStatementUploadDialog
                    isOpen={uploadDialogOpen}
                    onClose={() => setUploadDialogOpen(false)}
                    onStatementUploaded={(statement) => {
                        console.log('Statement uploaded:', statement);
                        setActiveStatement(statement);
                        setUploadDialogOpen(false);
                        setExtractionDialogOpen(true);
                        refreshData();
                    }}
                    bank={activeBank}
                    cycleMonth={selectedMonth}
                    cycleYear={selectedYear}
                    existingStatement={activeStatement}
                    statementCycleId={statementCycleId}
                    onOpenExtractionDialog={(statement) => {
                        console.log('Auto-opening extraction dialog for:', statement);
                        setActiveStatement(statement);
                        setExtractionDialogOpen(true);
                    }}
                />
            )}

            {extractionDialogOpen && activeBank && activeStatement && (
                <BankExtractionDialog
                    isOpen={extractionDialogOpen}
                    onClose={() => {
                        console.log('Closing extraction dialog');
                        setExtractionDialogOpen(false);
                        setActiveStatement(null);
                        setActiveBank(null);
                        setTimeout(() => {
                            refreshData();
                        }, 100);
                    }}
                    onStatementUpdated={(updatedStatement) => {
                        console.log('Statement updated in extraction dialog:', updatedStatement);
                        setExtractionDialogOpen(false);
                        setActiveStatement(null);
                        setActiveBank(null);
                        setTimeout(() => {
                            refreshData();
                        }, 100);
                    }}
                    onStatementDeleted={(statementId) => {
                        console.log('Statement deleted:', statementId);
                        setExtractionDialogOpen(false);
                        setActiveStatement(null);
                        setActiveBank(null);
                        setTimeout(() => {
                            refreshData();
                        }, 100);
                    }}
                    bank={activeBank}
                    statement={activeStatement}
                />
            )}

            {quickbooksDialogOpen && activeBank && activeStatement && (
                <QuickbooksBalanceDialog
                    isOpen={quickbooksDialogOpen}
                    onClose={handleDialogClose}
                    onBalanceUpdated={handleDialogClose}
                    bank={activeBank}
                    statement={activeStatement}
                />
            )}

            {passwordDialogOpen && activeBank && (
                <PasswordUpdateDialog
                    isOpen={passwordDialogOpen}
                    onClose={() => setPasswordDialogOpen(false)}
                    bank={activeBank}
                    onPasswordUpdated={(updatedBank) => {
                        // Update the bank in local state
                        setAllBanks(prev => prev.map(b => b.id === updatedBank.id ? updatedBank : b));
                        setPasswordDialogOpen(false);
                        setActiveBank(null);
                    }}
                />
            )}

            <EnhancedDeleteConfirmationDialog
                isOpen={deleteConfirmationOpen}
                onClose={() => {
                    setDeleteConfirmationOpen(false)
                    setActiveStatement(null)
                    setActiveBank(null)
                }}
                onConfirm={confirmDelete}
                statement={activeStatement}
                bank={activeBank}
            />
        </div>
    );
}