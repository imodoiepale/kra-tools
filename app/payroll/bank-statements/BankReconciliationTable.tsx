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
import { Loader2, UploadCloud, Edit, Eye, CheckCircle, AlertTriangle, MoreHorizontal, Trash } from 'lucide-react'
import { BankStatementUploadDialog } from './components/BankStatementUploadDialog'
import BankExtractionDialog  from './components/BankExtractionDialog'
import { QuickbooksBalanceDialog } from './components/QuickbooksBalanceDialog'
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
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FilterWithStatus } from './BankStatementFilters';
import { useStatementCycle } from '../hooks/useStatementCycle'

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
}

// FIX: Corrected the BankStatement interface
interface BankStatement {
    id: string
    bank_id: number
    statement_month: number
    statement_year: number
    // quickbooks_balance: number | null // REMOVED: This was in the wrong place
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
        monthly_balances: Array<any>
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
        quickbooks_balance?: number | null; // ADDED: QB balance is part of the status object
    }
}

interface Company {
    id: number;
    company_name: string;
    acc_client_effective_from: string | null;
    acc_client_effective_to: string | null;
    audit_client_effective_from: string | null;
    audit_client_effective_to: string | null;
    sheria_client_effective_from: string | null;
    sheria_client_effective_to: string | null;
    imm_client_effective_from: string | null;
    imm_client_effective_to: string | null;
}

interface BankReconciliationTableProps {
    selectedYear: number;
    selectedMonth: number;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onStatsChange: () => void;
    selectedClientTypes: FilterWithStatus[];
    selectedStatementStatuses: FilterWithStatus[];
}

const normalizeCurrencyCode = (code: string | null): string => {
    if (!code) return 'USD';
    const upperCode = code.toUpperCase().trim();
    const currencyMap: Record<string, string> = {
        'EURO': 'EUR', 'EUROS': 'EUR', 'US DOLLAR': 'USD', 'US DOLLARS': 'USD',
        'USDOLLAR': 'USD', 'POUND': 'GBP', 'POUNDS': 'GBP', 'STERLING': 'GBP',
        'KENYA SHILLING': 'KES', 'KENYA SHILLINGS': 'KES', 'KENYAN SHILLING': 'KES',
        'KENYAN SHILLINGS': 'KES', 'KSH': 'KES', 'K.SH': 'KES', 'KSHS': 'KES',
        'K.SHS': 'KES', 'SH': 'KES'
    };
    return currencyMap[upperCode] || upperCode;
};

export function BankReconciliationTable({
    selectedYear,
    selectedMonth,
    searchTerm,
    onStatsChange,
    selectedClientTypes = [],
    selectedStatementStatuses = []
}: BankReconciliationTableProps) {
    const { loading, getOrCreateStatementCycle, fetchCoreData, deleteStatement } = useStatementCycle();
    const { toast } = useToast();

    const [companies, setCompanies] = useState<Company[]>([]);
    const [allBanks, setAllBanks] = useState<Bank[]>([]);
    const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
    const [statementCycleId, setStatementCycleId] = useState<string | null>(null);

    const [activeBank, setActiveBank] = useState<Bank | null>(null);
    const [activeStatement, setActiveStatement] = useState<BankStatement | null>(null);

    const [uploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false);
    const [extractionDialogOpen, setExtractionDialogOpen] = useState<boolean>(false);
    const [quickbooksDialogOpen, setQuickbooksDialogOpen] = useState<boolean>(false);
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState<boolean>(false);

    const refreshData = useCallback(async () => {
        const cycleId = await getOrCreateStatementCycle(selectedYear, selectedMonth);
        if (cycleId) {
            setStatementCycleId(cycleId);
            const { companies, banks, statements } = await fetchCoreData(cycleId);
            setCompanies(companies);
            setAllBanks(banks);
            setBankStatements(statements);
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

    const organizedData = useMemo(() => {
        const companiesWithBanks = filteredCompanies.map(company => ({
            ...company,
            banks: allBanks.filter(bank => bank.company_name === company.company_name)
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
            case 'validated': return !!statement.validation_status?.is_validated;
            case 'pending_validation': return !statement.validation_status?.is_validated;
            case 'has_issues': return (statement.validation_status?.mismatches?.length || 0) > 0;
            case 'reconciled':
                const closingBal = statement.statement_extractions?.closing_balance ?? null;
                // FIX: Access qbBalance from the correct nested location
                const qbBal = statement.status?.quickbooks_balance ?? null;
                return closingBal !== null && qbBal !== null && Math.abs(closingBal - qbBal) <= 0.01;
            case 'pending_reconciliation':
                const closingBalance = statement.statement_extractions?.closing_balance ?? null;
                // FIX: Access quickbooksBalance from the correct nested location
                const quickbooksBalance = statement.status?.quickbooks_balance ?? null;
                if (closingBalance === null || quickbooksBalance === null) return true;
                return Math.abs(closingBalance - quickbooksBalance) > 0.01;
            default: return false;
        }
    };

    const statusFilteredStatements = useMemo(() => {
        if (!selectedStatementStatuses || selectedStatementStatuses.length === 0) {
            return bankStatements;
        }
        return bankStatements.filter(statement =>
            selectedStatementStatuses.some(filter => getStatementFilterCondition(statement, filter.key))
        );
    }, [bankStatements, selectedStatementStatuses]);

    const handleOpenDialog = (type: 'upload' | 'view' | 'qb' | 'delete', bank: Bank) => {
        const statement = bankStatements.find(s => s.bank_id === bank.id) || null;
        setActiveBank(bank);
        setActiveStatement(statement);

        switch (type) {
            case 'upload': setUploadDialogOpen(true); break;
            case 'view': if (statement) setExtractionDialogOpen(true); break;
            case 'qb': if (statement) setQuickbooksDialogOpen(true); else toast({ title: "No Statement", description: "Upload a statement first to add a QuickBooks balance." }); break;
            case 'delete': if (statement) setDeleteConfirmationOpen(true); break;
        }
    };

    const handleDialogClose = () => {
        setUploadDialogOpen(false);
        setQuickbooksDialogOpen(false);
        setExtractionDialogOpen(false);
        refreshData();
    };

    const confirmDelete = async () => {
        if (!activeStatement) return;
        const success = await deleteStatement(activeStatement);
        if (success) {
            refreshData();
        }
        setDeleteConfirmationOpen(false);
    };

    const formatCurrency = (amount: number | null, currency: string) => {
        if (amount === null || amount === undefined) return '-';
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: normalizeCurrencyCode(currency), minimumFractionDigits: 2 }).format(amount);
        } catch (e) {
            return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
        }
    };

    const getValidationStatusIcon = (statement: BankStatement | null) => {
        if (!statement?.statement_document?.statement_pdf) return null;
        if (statement.validation_status?.is_validated) return <CheckCircle className="h-4 w-4 text-green-500" />;
        if (statement.validation_status?.mismatches?.length > 0) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
        return null;
    };

    return (
        <div className="space-y-4">
            <div className="rounded-md border h-[calc(100vh-280px)] overflow-auto mb-4">
                <Table aria-label="Bank Reconciliation" className="border border-gray-200 text-sm">
                    <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-blue-600 hover:bg-blue-600 [&>th]:border-r [&>th]:border-blue-500 last:[&>th]:border-r-0">
                            <TableHead className="text-white font-semibold w-[30px] text-center p-1">No.</TableHead>
                            <TableHead className="text-white font-semibold w-[150px] p-1">Company</TableHead>
                            <TableHead className="text-white font-semibold w-[130px] p-1">Bank</TableHead>
                            <TableHead className="text-white font-semibold w-[100px] p-1">Acc Number</TableHead>
                            <TableHead className="text-white font-semibold w-[60px] p-1">Curr</TableHead>
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
                            <TableRow><TableCell colSpan={11} className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : searchFilteredData.length === 0 ? (
                            <TableRow><TableCell colSpan={11} className="text-center py-4">No banks found for the selected filters.</TableCell></TableRow>
                        ) : (
                            searchFilteredData.map((company, companyIndex) => (
                                company.banks.length === 0 ? (
                                    <TableRow key={`company-${company.id}`} className="bg-gray-50 hover:bg-gray-100">
                                        <TableCell className="font-medium text-center border-r border-gray-200 p-1">{companyIndex + 1}</TableCell>
                                        <TableCell className="font-medium border-r border-gray-200 p-1">
                                            <TooltipProvider><Tooltip><TooltipTrigger>{(company.company_name || 'Unknown Company').split(" ").slice(0, 2).join(" ")}</TooltipTrigger><TooltipContent>{company.company_name || 'Unknown Company'}</TooltipContent></Tooltip></TooltipProvider>
                                        </TableCell>
                                        <TableCell colSpan={9} className="text-center text-red-500 font-bold p-1">No banks configured</TableCell>
                                    </TableRow>
                                ) : (
                                    company.banks.map((bank, bankIndex) => {
                                        const statement = statusFilteredStatements.find(s => s.bank_id === bank.id);
                                        const closingBalance = statement?.statement_extractions?.closing_balance;
                                        // FIX: Get the qbBalance from the correct nested location
                                        const qbBalance = statement?.status?.quickbooks_balance;
                                        const difference = (closingBalance != null && qbBalance != null) ? closingBalance - qbBalance : null;
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
                                                <TableCell className="border-r border-gray-200 p-1 truncate"><TooltipProvider><Tooltip><TooltipTrigger className="truncate">{bank.bank_name}</TooltipTrigger><TooltipContent>{bank.bank_name}</TooltipContent></Tooltip></TooltipProvider></TableCell>
                                                <TableCell className="border-r border-gray-200 font-mono text-xs p-1 truncate">{bank.account_number}</TableCell>
                                                <TableCell className="border-r border-gray-200 p-1">{normalizeCurrencyCode(bank.bank_currency)}</TableCell>
                                                <TableCell className="border-r border-gray-200 p-1">
                                                    {statement ? (
                                                        <Button variant="outline" size="sm" className="relative flex gap-1.5 items-center px-3 py-1.5 border-blue-300 bg-blue-50/50 hover:bg-blue-100/60" onClick={() => handleOpenDialog('view', bank)}>
                                                            <Eye className="h-3.5 w-3.5" /><span>View</span>{getValidationStatusIcon(statement) && <span className="ml-0.5">{getValidationStatusIcon(statement)}</span>}
                                                        </Button>
                                                    ) : (
                                                        <Button variant="outline" size="sm" className="relative flex gap-1.5 items-center px-3 py-1.5 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100/60" onClick={() => handleOpenDialog('upload', bank)}>
                                                            <UploadCloud className="h-3.5 w-3.5" /><span>Upload</span>
                                                        </Button>
                                                    )}
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
                                                <TableCell className="border-r border-gray-200 p-1 truncate"><TooltipProvider><Tooltip><TooltipTrigger className="truncate">{statement?.status?.status || 'Pending'}</TooltipTrigger><TooltipContent>{statement?.status?.status || 'Pending'}</TooltipContent></Tooltip></TooltipProvider></TableCell>
                                                <TableCell className="p-1">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-5 w-5 p-0"><MoreHorizontal className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-44">
                                                            <DropdownMenuItem onClick={() => handleOpenDialog('view', bank)} disabled={!statement} className="flex items-center gap-2 text-xs py-1.5"><Eye className="h-3.5 w-3.5" />View Statement</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleOpenDialog('upload', bank)} className="flex items-center gap-2 text-xs py-1.5"><UploadCloud className="h-3.5 w-3.5" />{statement ? 'Replace' : 'Upload'}</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleOpenDialog('qb', bank)} disabled={!statement} className="flex items-center gap-2 text-xs py-1.5"><Edit className="h-3.5 w-3.5" />Update QB</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleOpenDialog('delete', bank)} disabled={!statement} className="flex items-center gap-2 text-xs py-1.5 text-red-600"><Trash className="h-3.5 w-3.5" />Delete</DropdownMenuItem>
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
                <BankStatementUploadDialog isOpen={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} onStatementUploaded={handleDialogClose} bank={activeBank} cycleMonth={selectedMonth} cycleYear={selectedYear} existingStatement={activeStatement} statementCycleId={statementCycleId} />
            )}
            {extractionDialogOpen && activeBank && activeStatement && (
                <BankExtractionDialog isOpen={extractionDialogOpen} onClose={() => setExtractionDialogOpen(false)} onStatementUpdated={handleDialogClose} bank={activeBank} statement={activeStatement} />
            )}
            {quickbooksDialogOpen && activeBank && activeStatement && (
                <QuickbooksBalanceDialog isOpen={quickbooksDialogOpen} onClose={() => setQuickbooksDialogOpen(false)} onBalanceUpdated={handleDialogClose} bank={activeBank} statement={activeStatement} />
            )}
            <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the statement and its associated files. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete Statement</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}