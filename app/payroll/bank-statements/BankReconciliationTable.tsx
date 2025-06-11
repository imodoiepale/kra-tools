// @ts-nocheck
'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
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
import { Loader2, Download, UploadCloud, Edit, Eye, CheckCircle, AlertTriangle, MoreHorizontal, Trash } from 'lucide-react'
import { BankStatementUploadDialog } from './components/BankStatementUploadDialog'
import { BankExtractionDialog } from './components/BankExtractionDialog'
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

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
}

interface BankStatement {
    id: string
    bank_id: number
    statement_month: number
    statement_year: number
    quickbooks_balance: number | null
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
        monthly_balances: Array<{
            month: number
            year: number
            closing_balance: number
            opening_balance: number
            statement_page: number
            highlight_coordinates: {
                x1: number
                y1: number
                x2: number
                y2: number
                page: number
            }
            is_verified: boolean
            verified_by: string | null
            verified_at: string | null
        }>
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
    setSearchTerm,
    onStatsChange,
    selectedClientTypes = [],
    selectedStatementStatuses = []
}: BankReconciliationTableProps) {
    const [loading, setLoading] = useState<boolean>(true)
    const [companies, setCompanies] = useState<Company[]>([])
    const [allBanks, setAllBanks] = useState<Bank[]>([])
    const [bankStatements, setBankStatements] = useState<BankStatement[]>([])
    const [uploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false)
    const [selectedBank, setSelectedBank] = useState<Bank | null>(null)
    const [extractionDialogOpen, setExtractionDialogOpen] = useState<boolean>(false)
    const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null)
    const [quickbooksDialogOpen, setQuickbooksDialogOpen] = useState<boolean>(false)
    const [statementCycleId, setStatementCycleId] = useState<string | null>(null)
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
    const [statementToDelete, setStatementToDelete] = useState<{ id: string, bankId: number } | null>(null);
    const { toast } = useToast()

    const fetchCompaniesAndBanks = async () => {
        setLoading(true);
        try {
            const { data: companiesData, error: companiesError } = await supabase.from('acc_portal_company_duplicate').select('*');
            if (companiesError) throw companiesError;
            const { data: banksData, error: banksError } = await supabase.from('acc_portal_banks').select('*');
            if (banksError) throw banksError;
            setCompanies(companiesData || []);
            setAllBanks(banksData || []);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch companies and banks', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const filteredCompanies = useMemo(() => {
        if (!selectedClientTypes || selectedClientTypes.length === 0) {
            return companies;
        }
        const currentDate = new Date();
        const isClientCurrentlyActive = (company: Company, typeKey: string): boolean => {
            const fromField = `${typeKey}_client_effective_from`;
            const toField = `${typeKey}_client_effective_to`;
            const fromDateStr = company[fromField];
            const toDateStr = company[toField];
            if (!fromDateStr || !toDateStr) return false;
            return new Date(fromDateStr) <= currentDate && currentDate <= new Date(toDateStr);
        };
        const hasClientType = (company: Company, typeKey: string): boolean => {
            const fromField = `${typeKey}_client_effective_from`;
            return !!company[fromField];
        };
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
        });
    }, [organizedData, searchTerm]);

    const getStatementFilterCondition = (statement: BankStatement, filterKey: string) => {
        switch (filterKey) {
            case 'validated':
                return !!statement.validation_status?.is_validated;
            case 'pending_validation':
                return !statement.validation_status?.is_validated;
            case 'has_issues':
                return (statement.validation_status?.mismatches?.length || 0) > 0;
            case 'reconciled':
                const closingBal = statement.statement_extractions?.closing_balance ?? null;
                const qbBal = statement.quickbooks_balance ?? null;
                return closingBal !== null && qbBal !== null && Math.abs(closingBal - qbBal) <= 0.01;
            case 'pending_reconciliation':
                const closingBalance = statement.statement_extractions?.closing_balance ?? null;
                const quickbooksBalance = statement.quickbooks_balance ?? null;
                if (closingBalance === null || quickbooksBalance === null) return true;
                return Math.abs(closingBalance - quickbooksBalance) > 0.01;
            default:
                return false;
        }
    };

    const filteredStatements = useMemo(() => {
        if (!selectedStatementStatuses || selectedStatementStatuses.length === 0) {
            return bankStatements;
        }
        return bankStatements.filter(statement => {
            return selectedStatementStatuses.some(filter => getStatementFilterCondition(statement, filter.key));
        });
    }, [bankStatements, selectedStatementStatuses]);

    useEffect(() => {
        const initializeData = async () => {
            setLoading(true);
            try {
                const monthStr = (selectedMonth + 1).toString().padStart(2, '0');
                const cycleMonthYear = `${selectedYear}-${monthStr}`;
                const { data: existingCycle, error: cycleError } = await supabase
                    .from('statement_cycles').select('id').eq('month_year', cycleMonthYear).single();

                let cycleId;
                if (cycleError && cycleError.code === 'PGRST116') {
                    const { data: newCycle, error: createError } = await supabase
                        .from('statement_cycles').insert({ month_year: cycleMonthYear, status: 'active' }).select('id').single();
                    if (createError) throw createError;
                    cycleId = newCycle.id;
                } else if (cycleError) {
                    throw cycleError;
                } else {
                    cycleId = existingCycle.id;
                }
                setStatementCycleId(cycleId);
                await fetchCompaniesAndBanks();
                if (cycleId) {
                    const { data: statementsData, error: statementsError } = await supabase
                        .from('acc_cycle_bank_statements').select('*').eq('statement_cycle_id', cycleId);
                    if (statementsError) throw statementsError;
                    setBankStatements(statementsData || []);
                }
            } catch (error) {
                toast({ title: 'Error', description: error.message || 'Failed to initialize data', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };
        initializeData();
    }, [selectedMonth, selectedYear, toast]);

    const handleUploadStatement = (bankId: number) => {
        const bank = allBanks.find(b => b.id === bankId);
        if (bank) {
            setSelectedBank(bank);
            setUploadDialogOpen(true);
        }
    };

    const handleViewStatement = (bankId: number) => {
        // Reset all states first
        setSelectedBank(null)
        setSelectedStatement(null)
        setUploadDialogOpen(false)
        setQuickbooksDialogOpen(false)
        setExtractionDialogOpen(false)

        // After a brief delay, set the new states
        setTimeout(() => {
            const bank = allBanks.find(b => b.id === bankId)
            const statement = filteredStatements.find(s => s.bank_id === bankId)

            if (bank && statement) {
                setSelectedBank(bank)
                setSelectedStatement(statement)
                setExtractionDialogOpen(true)
            }
        }, 100) // Small delay to ensure state reset
    }

    const handleQuickbooksBalance = (bankId: number) => {
        const bank = allBanks.find(b => b.id === bankId)
        const statement = filteredStatements.find(s => s.bank_id === bankId)

        if (bank && statement) {
            setSelectedBank(bank)
            setSelectedStatement(statement)
            setQuickbooksDialogOpen(true)
        } else {
            toast({
                title: "Error",
                description: "No statement found for this bank",
                variant: "destructive",
            })
        }
    }

    const handleStatementUploaded = (newStatement: BankStatement) => {
        setBankStatements(prev => {
            const exists = prev.some(s => s.id === newStatement.id)
            if (exists) {
                return prev.map(s => s.id === newStatement.id ? newStatement : s)
            } else {
                return [...prev, newStatement]
            }
        })
        setUploadDialogOpen(false)
        onStatsChange()
        toast({
            title: 'Success',
            description: 'Bank statement uploaded successfully'
        })
    }

    const handleStatementUpdated = (updatedStatement) => {
        if (updatedStatement) {
            setBankStatements(prev =>
                prev.map(s => s.id === updatedStatement.id ? updatedStatement : s)
            );
        } else {
            // If statement was deleted or is null
            setExtractionDialogOpen(false);
            fetchStatements(); // Fetch fresh statements
        }
    }
    const handleQuickbooksBalanceUpdated = (statementId: string, balance: number) => {
        setBankStatements(prev =>
            prev.map(s => s.id === statementId
                ? { ...s, quickbooks_balance: balance }
                : s
            )
        )
        setQuickbooksDialogOpen(false)
        onStatsChange()
        toast({
            title: 'Success',
            description: 'QuickBooks balance updated successfully'
        })
    }

    const getValidationStatusIcon = (statement: BankStatement | null) => {
        if (!statement) return null
        if (!statement.statement_document.statement_pdf) return null

        if (statement.validation_status.is_validated) {
            return <CheckCircle className="h-4 w-4 text-green-500" />
        } else if (statement.validation_status.mismatches.length > 0) {
            return <AlertTriangle className="h-4 w-4 text-amber-500" />
        }
        return null
    }

    const formatCurrency = (amount: number | null, currency: string) => {
        if (amount === null) return '-';

        try {
            // Normalize the currency code
            const normalizedCurrency = normalizeCurrencyCode(currency);

            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: normalizedCurrency,
                minimumFractionDigits: 2
            }).format(amount);
        } catch (error) {
            // Fallback if there's still an error with the currency code
            console.warn(`Invalid currency code: ${currency}. Falling back to plain number format.`);
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        }
    };

    const handleDeleteStatement = async (bankId: number) => {
        const statement = filteredStatements.find(s => s.bank_id === bankId);
        if (!statement) return;

        // Show confirmation dialog instead of using window.confirm
        setStatementToDelete({ id: statement.id, bankId });
        setShowDeleteConfirmation(true);
    };

    const confirmDeleteStatement = async () => {
        if (!statementToDelete) return;

        try {
            const statement = filteredStatements.find(s => s.bank_id === statementToDelete.bankId);
            if (!statement) return;

            // Delete files from storage if they exist
            if (statement.statement_document?.statement_pdf) {
                await supabase.storage
                    .from('Statement-Cycle')
                    .remove([statement.statement_document.statement_pdf]);
            }

            if (statement.statement_document?.statement_excel) {
                await supabase.storage
                    .from('Statement-Cycle')
                    .remove([statement.statement_document.statement_excel]);
            }

            // Delete the statement record
            const { error } = await supabase
                .from('acc_cycle_bank_statements')
                .delete()
                .eq('id', statement.id);

            if (error) throw error;

            // Update the UI state
            setBankStatements(prev => prev.filter(s => s.id !== statement.id));

            // Reset selected statement and bank to prevent null reference errors
            setSelectedStatement(null);
            setSelectedBank(null);

            // Close any open dialogs
            setExtractionDialogOpen(false);
            setUploadDialogOpen(false);
            setQuickbooksDialogOpen(false);

            onStatsChange();

            toast({
                title: 'Success',
                description: 'Bank statement deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting statement:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete bank statement',
                variant: 'destructive'
            });
        } finally {
            // Close the confirmation dialog
            setShowDeleteConfirmation(false);
            setStatementToDelete(null);
        }
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
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-4">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : searchFilteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-4">
                                    No banks found
                                </TableCell>
                            </TableRow>
                        ) : (
                            searchFilteredData.map((company, companyIndex) => {
                                // For companies with no banks
                                if (company.banks.length === 0) {
                                    return (
                                        <TableRow key={`company-${company.id}`} className="bg-gray-50 hover:bg-gray-100">
                                            <TableCell className="font-medium text-center border-r border-gray-200 p-1">
                                                {companyIndex + 1}
                                            </TableCell>
                                            <TableCell className="font-medium border-r border-gray-200 p-1">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            {(company.company_name || 'Unknown Company').split(" ").slice(0, 2).join(" ")}
                                                        </TooltipTrigger>
                                                        <TooltipContent>{company.company_name || 'Unknown Company'}</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                            <TableCell colSpan={3} className="text-center text-red-500 font-bold p-1">
                                                No banks configured
                                            </TableCell>
                                            <TableCell colSpan={3} className="text-center text-red-500 font-bold p-1">
                                                No banks configured
                                            </TableCell>
                                            <TableCell colSpan={3} className="text-center text-red-500 font-bold p-1">
                                                No banks configured
                                            </TableCell>
                                        </TableRow>
                                    );
                                }

                                // For companies with banks
                                return company.banks.map((bank, bankIndex) => {
                                    const statement = filteredStatements.find(s => s.bank_id === bank.id);
                                    const closingBalance = statement?.statement_extractions?.closing_balance;
                                    const qbBalance = statement?.quickbooks_balance;
                                    const difference = closingBalance !== null && qbBalance !== null
                                        ? closingBalance - qbBalance
                                        : null;

                                    return (
                                        <TableRow
                                            key={bank.id}
                                            className={`${bankIndex % 2 === 0 ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'} [&>td]:border-r [&>td]:border-gray-200 last:[&>td]:border-r-0`}
                                        >
                                            {bankIndex === 0 && (
                                                <>
                                                    <TableCell
                                                        className="font-medium text-center border-r border-gray-200 p-1"
                                                        rowSpan={company.banks.length}
                                                    >
                                                        {companyIndex + 1}
                                                    </TableCell>
                                                    <TableCell
                                                        className="font-medium border-r border-gray-200 p-1"
                                                        rowSpan={company.banks.length}
                                                    >
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    {(company.company_name || 'Unknown Company').split(" ").slice(0, 2).join(" ")}
                                                                </TooltipTrigger>
                                                                <TooltipContent>{company.company_name || 'Unknown Company'}</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </TableCell>
                                                </>
                                            )}
                                            <TableCell className="border-r border-gray-200 p-1 truncate">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger className="truncate">{bank.bank_name}</TooltipTrigger>
                                                        <TooltipContent>{bank.bank_name}</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                            <TableCell className="border-r border-gray-200 font-mono text-xs p-1 truncate">
                                                {bank.account_number}
                                            </TableCell>
                                            <TableCell className="border-r border-gray-200 p-1">
                                                {normalizeCurrencyCode(bank.bank_currency)}
                                            </TableCell>
                                            <TableCell className="border-r border-gray-200 p-1">
                                                {statement?.statement_document.statement_pdf ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="relative flex gap-1.5 items-center px-3 py-1.5 border-blue-300 bg-blue-50/50 hover:bg-blue-100/60 hover:border-blue-400 text-blue-700 transition-all duration-200 group overflow-hidden"
                                                        onClick={() => handleViewStatement(bank.id)}
                                                    >
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/30 to-transparent group-hover:via-blue-200/50 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>
                                                        <Eye className="h-3.5 w-3.5" />
                                                        <span className="text-xs font-medium">View</span>
                                                        {getValidationStatusIcon(statement) && (
                                                            <span className="ml-0.5">
                                                                {getValidationStatusIcon(statement)}
                                                            </span>
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="relative flex gap-1.5 items-center px-3 py-1.5 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100/60 hover:border-blue-400 text-blue-700 transition-all duration-200 group overflow-hidden"
                                                        onClick={() => handleUploadStatement(bank.id)}
                                                    >
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/30 to-transparent group-hover:via-blue-200/50 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>
                                                        <UploadCloud className="h-3.5 w-3.5" />
                                                        <span className="text-xs font-medium">Upload</span>
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell className="border-r border-gray-200 text-right p-1">
                                                {closingBalance !== null
                                                    ? formatCurrency(closingBalance, bank.bank_currency)
                                                    : '-'}
                                            </TableCell>
                                            <TableCell className="border-r border-gray-200 p-1">
                                                <div className="flex items-center gap-1">
                                                    <span className="flex-1 text-right">
                                                        {qbBalance !== null
                                                            ? formatCurrency(qbBalance, bank.bank_currency)
                                                            : '-'}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 p-0"
                                                        onClick={() => handleQuickbooksBalance(bank.id)}
                                                    >
                                                        <Edit className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell
                                                className={`border-r border-gray-200 text-right p-1 ${difference !== null
                                                    ? Math.abs(difference) > 0.01
                                                        ? 'text-red-500 font-bold'
                                                        : 'text-green-500 font-bold'
                                                    : ''
                                                    }`}
                                            >
                                                {difference !== null
                                                    ? formatCurrency(difference, bank.bank_currency)
                                                    : '-'}
                                            </TableCell>
                                            <TableCell className="border-r border-gray-200 p-1 truncate">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger className="truncate">{statement?.status.status || 'Pending'}</TooltipTrigger>
                                                        <TooltipContent>{statement?.status.status || 'Pending'}</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                            <TableCell className="p-1">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                                                            <MoreHorizontal className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-44">
                                                        <DropdownMenuItem
                                                            onClick={() => handleViewStatement(bank.id)}
                                                            className="flex items-center gap-2 text-xs py-1.5"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                            View Statement
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => handleUploadStatement(bank.id)}
                                                            className="flex items-center gap-2 text-xs py-1.5"
                                                        >
                                                            <UploadCloud className="h-3.5 w-3.5" />
                                                            {statement?.statement_document.statement_pdf ? 'Replace' : 'Upload'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleQuickbooksBalance(bank.id)}
                                                            className="flex items-center gap-2 text-xs py-1.5"
                                                        >
                                                            <Edit className="h-3.5 w-3.5" />
                                                            Update QB
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleDeleteStatement(bank.id)}
                                                            className="flex items-center gap-2 text-xs py-1.5 text-red-600"
                                                        >
                                                            <Trash className="h-3.5 w-3.5" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {selectedBank && (
                <BankStatementUploadDialog
                    isOpen={uploadDialogOpen}
                    onClose={() => setUploadDialogOpen(false)}
                    bank={selectedBank}
                    cycleMonth={selectedMonth}
                    cycleYear={selectedYear}
                    onStatementUploaded={handleStatementUploaded}
                    existingStatement={bankStatements.find(s => s.bank_id === selectedBank.id) || null}
                    statementCycleId={statementCycleId}
                />
            )}

            {selectedBank && selectedStatement && (
                <BankExtractionDialog
                    isOpen={extractionDialogOpen}
                    onClose={() => setExtractionDialogOpen(false)}
                    bank={selectedBank}
                    statement={selectedStatement}
                    onStatementUpdated={(updatedStatement) => {
                        if (updatedStatement) {
                            setBankStatements(prev =>
                                prev.map(s => s.id === updatedStatement.id ? updatedStatement : s)
                            );
                        } else {
                            // If statement was deleted or is null
                            setExtractionDialogOpen(false);
                        }
                    }}
                />
            )}

            {selectedBank && selectedStatement && (
                <QuickbooksBalanceDialog
                    isOpen={quickbooksDialogOpen}
                    onClose={() => {
                        setQuickbooksDialogOpen(false)
                        setSelectedBank(null)
                        setSelectedStatement(null)
                    }}
                    bank={selectedBank}
                    statement={selectedStatement}
                    cycleMonth={selectedMonth}
                    cycleYear={selectedYear}
                    onBalanceUpdated={handleQuickbooksBalanceUpdated}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the bank statement
                            and remove all associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setStatementToDelete(null)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteStatement}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Delete Statement
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}