// app/payroll/bank-statements/components/DetailedBankStatementsView.tsx
// @ts-nocheck
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Building,
    Calendar,
    FileText,
    Eye,
    Upload,
    Loader2,
    Search,
    ChevronRight,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Plus,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Download,
    Package,
    FileDown
} from 'lucide-react'
import { format } from 'date-fns'
import { BankStatementUploadDialog } from './BankStatementUploadDialog'
import BankExtractionDialog from './BankExtractionDialog'
import { analyzeStatementsForExport, createZipExport, downloadIndividualFiles } from '../utils/exportUtils'

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

interface Bank {
    id: number;
    bank_name: string;
    account_number: string;
    bank_currency: string;
    company_id: number;
    acc_password?: string;
}

interface BankStatement {
    id: string;
    bank_id: number;
    statement_month: number;
    statement_year: number;
    statement_type: 'monthly' | 'range';
    statement_document: {
        statement_pdf: string | null;
        statement_excel: string | null;
        document_size?: number;
        password?: string | null;
    };
    statement_extractions: {
        closing_balance: number | null;
        opening_balance: number | null;
        statement_period: string | null;
        monthly_balances: any[];
    };
    validation_status: {
        is_validated: boolean;
        mismatches: string[];
    };
    status: {
        status: string;
        quickbooks_balance?: number | null;
    };
    created_at: string;
    is_vouched?: boolean;
}

// Enhanced interface for combined view
interface CombinedMonthData {
    month: number;
    year: number;
    monthNumber: number; // 1-12 for display
    monthName: string;
    key: string;
    monthlyStatement: BankStatement | null;
    rangeStatement: BankStatement | null;
    hasMonthly: boolean;
    hasRange: boolean;
    monthlyClosingBalance: number | null;
    rangeClosingBalance: number | null;
    monthlyQBBalance: number | null;
    rangeQBBalance: number | null;
    monthlyDifference: number | null;
    rangeDifference: number | null;
    status: 'complete' | 'partial' | 'missing' | 'mismatch';
}

interface ExportFilters {
    companyStartDate: string;
    companyEndDate: string;
    takeoverDateByBCL: string;
    recordsFromDate: string;
    bankStartDate: string;
    bankEndDate: string;
}

type SortField = 'month' | 'monthlyBalance' | 'rangeBalance' | 'monthlyDiff' | 'rangeDiff' | 'status';
type SortDirection = 'asc' | 'desc' | null;

interface DetailedBankStatementsViewProps {
    searchTerm: string;
    dateRange: {
        fromMonth: number;
        fromYear: number;
        toMonth: number;
        toYear: number;
    };
    selectedClientTypes: any[];
    onRefresh: () => void;
}

export function DetailedBankStatementsView({
    searchTerm = '',
    dateRange,
    selectedClientTypes = [],
    onRefresh
}: DetailedBankStatementsViewProps) {
    const { toast } = useToast()
    const [companies, setCompanies] = useState<Company[]>([])
    const [banks, setBanks] = useState<Bank[]>([])
    const [statements, setStatements] = useState<BankStatement[]>([])
    const [loading, setLoading] = useState(true)

    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
    const [selectedBank, setSelectedBank] = useState<Bank | null>(null)
    const [activeStatementTab, setActiveStatementTab] = useState<'monthly' | 'range' | 'combined'>('monthly')

    // Sorting state for combined view
    const [sortField, setSortField] = useState<SortField>('month')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

    // Filter states
    const [filterStatus, setFilterStatus] = useState<string>('all')

    // Dialog states
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
    const [extractionDialogOpen, setExtractionDialogOpen] = useState(false)
    const [activeStatement, setActiveStatement] = useState<BankStatement | null>(null)

    // Export states
    const [selectedStatements, setSelectedStatements] = useState<Set<string>>(new Set());
    const [exportFilters, setExportFilters] = useState<ExportFilters>({
        companyStartDate: '',
        companyEndDate: '',
        takeoverDateByBCL: '',
        recordsFromDate: '',
        bankStartDate: '',
        bankEndDate: ''
    });
    const [exportOptions, setExportOptions] = useState({
        autoZip: true,
        includePassword: true,
        renameFiles: true
    });

    // Load companies on mount
    useEffect(() => {
        loadCompanies()
    }, [])

    // Load banks when company changes
    useEffect(() => {
        if (selectedCompany) {
            setBanks([]);
            setSelectedBank(null);
            loadBanks(selectedCompany.id);
        } else {
            setBanks([])
            setSelectedBank(null)
        }
    }, [selectedCompany])

    // Load statements when bank or date range changes
    useEffect(() => {
        if (selectedBank) {
            loadStatements(selectedBank.id, dateRange)
        } else {
            setStatements([])
        }
    }, [selectedBank, dateRange])

    // Auto-refresh handlers
    useEffect(() => {
        const handleBankStatementsUpdated = () => {
            if (selectedBank) {
                loadStatements(selectedBank.id, dateRange);
            }
        };

        window.addEventListener('bankStatementsUpdated', handleBankStatementsUpdated);
        return () => {
            window.removeEventListener('bankStatementsUpdated', handleBankStatementsUpdated);
        };
    }, [selectedBank, dateRange]);

    useEffect(() => {
        const handleFocus = () => {
            if (document.visibilityState === 'visible' && selectedBank) {
                loadStatements(selectedBank.id, dateRange);
            }
        };

        document.addEventListener('visibilitychange', handleFocus);
        return () => document.removeEventListener('visibilitychange', handleFocus);
    }, [selectedBank, dateRange]);

    const forceRefresh = useCallback(() => {
        setStatements([]);
        if (selectedBank) {
            loadStatements(selectedBank.id, dateRange);
        }
        if (selectedCompany) {
            loadBanks(selectedCompany.id);
        }
    }, [selectedBank, selectedCompany, dateRange]);

    const loadCompanies = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .order('company_name')

            if (error) {
                console.error('Supabase error loading companies:', error)
                throw error
            }

            setCompanies(data || [])
        } catch (error) {
            console.error('Error loading companies:', error)
            toast({
                title: 'Error',
                description: 'Failed to load companies. Please check your connection.',
                variant: 'destructive'
            })
            setCompanies([])
        } finally {
            setLoading(false)
        }
    }

    const loadBanks = async (companyId: number) => {
        try {
            const { data, error } = await supabase
                .from('acc_portal_banks')
                .select('*')
                .eq('company_id', companyId)
                .order('bank_name')

            if (error) {
                console.error('Supabase error loading banks:', error)
                throw error
            }

            if (data && data.length > 0) {
                setBanks(data);
                setSelectedBank(data[0]);
            } else {
                setBanks([]);
                setSelectedBank(null);
            }
        } catch (error) {
            console.error('Error loading banks:', error)
            toast({
                title: 'Error',
                description: 'Failed to load banks. Please check your connection.',
                variant: 'destructive'
            })
            setBanks([]);
            setSelectedBank(null);
        }
    }

    const loadStatements = async (bankId: number, dateRange: any) => {
        try {
            const { data, error } = await supabase
                .from('acc_cycle_bank_statements')
                .select(`
                    *,
                    statement_document,
                    statement_extractions,
                    validation_status,
                    status
                `)
                .eq('bank_id', bankId)
                .gte('statement_year', dateRange.fromYear)
                .lte('statement_year', dateRange.toYear)
                .order('statement_year')
                .order('statement_month')

            if (error) {
                console.error('Supabase error loading statements:', error)
                throw error
            }

            let filteredData = data || []
            if (dateRange.fromYear === dateRange.toYear) {
                filteredData = filteredData.filter(s =>
                    s.statement_month >= dateRange.fromMonth &&
                    s.statement_month <= dateRange.toMonth
                )
            }

            setStatements(filteredData)
        } catch (error) {
            console.error('Error loading statements:', error)
            toast({
                title: 'Error',
                description: 'Failed to load statements. Please check your connection.',
                variant: 'destructive'
            })
            setStatements([])
        }
    }

    // Filter companies with null safety
    const filteredCompanies = useMemo(() => {
        if (!Array.isArray(companies)) return [];

        let filtered = companies;

        if (selectedClientTypes && selectedClientTypes.length > 0) {
            const currentDate = new Date();
            filtered = filtered.filter(company => {
                if (!company || typeof company.company_name !== 'string') return false;

                return selectedClientTypes.some(filter => {
                    if (!filter || !filter.key) return false;

                    const typeKey = filter.key;
                    const fromDateStr = company[`${typeKey}_client_effective_from`];
                    const toDateStr = company[`${typeKey}_client_effective_to`];

                    if (!fromDateStr || !toDateStr) return false;

                    const isCurrentlyActive = new Date(fromDateStr) <= currentDate && currentDate <= new Date(toDateStr);

                    switch (filter.status) {
                        case 'active': return isCurrentlyActive;
                        case 'inactive': return !isCurrentlyActive;
                        case 'all': return true;
                        default: return false;
                    }
                });
            });
        }

        if (searchTerm) {
            filtered = filtered.filter(company =>
                company &&
                typeof company.company_name === 'string' &&
                company.company_name.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        return filtered;
    }, [companies, selectedClientTypes, searchTerm])

    // Generate date range for the selected period
    const generateDateRange = () => {
        if (!dateRange || typeof dateRange.fromMonth !== 'number' || typeof dateRange.fromYear !== 'number') {
            return [];
        }

        const months = [];
        let currentDate = new Date(dateRange.fromYear, dateRange.fromMonth);
        const endDate = new Date(dateRange.toYear, dateRange.toMonth);

        let iterations = 0;
        const maxIterations = 120;

        while (currentDate <= endDate && iterations < maxIterations) {
            const month = currentDate.getMonth();
            const year = currentDate.getFullYear();
            months.push({
                month,
                year,
                monthNumber: month + 1,
                monthName: format(new Date(year, month), 'MMM'),
                key: `${year}-${month}`
            });
            currentDate.setMonth(currentDate.getMonth() + 1);
            iterations++;
        }

        return months;
    }

    // Get statements by type for a specific month/year
    const getStatementsByType = (month: number, year: number, type: 'monthly' | 'range') => {
        if (!Array.isArray(statements)) return [];

        return statements.filter(stmt =>
            stmt &&
            stmt.statement_month === month &&
            stmt.statement_year === year &&
            stmt.statement_type === type
        );
    }

    // Check if statement type exists for month/year
    const hasStatementType = (month: number, year: number, type: 'monthly' | 'range') => {
        return getStatementsByType(month, year, type).length > 0;
    }

    // Generate combined data for the combined view
    const generateCombinedData = (): CombinedMonthData[] => {
        const dateRangeData = generateDateRange();

        return dateRangeData.map(({ month, year, monthNumber, monthName, key }) => {
            const monthlyStatements = getStatementsByType(month, year, 'monthly');
            const rangeStatements = getStatementsByType(month, year, 'range');

            const monthlyStatement = monthlyStatements[0] || null;
            const rangeStatement = rangeStatements[0] || null;

            const monthlyClosingBalance = monthlyStatement?.statement_extractions?.closing_balance || null;
            const rangeClosingBalance = rangeStatement?.statement_extractions?.closing_balance || null;
            const monthlyQBBalance = monthlyStatement?.status?.quickbooks_balance || null;
            const rangeQBBalance = rangeStatement?.status?.quickbooks_balance || null;

            const monthlyDifference = (monthlyClosingBalance !== null && monthlyQBBalance !== null)
                ? monthlyClosingBalance - monthlyQBBalance : null;
            const rangeDifference = (rangeClosingBalance !== null && rangeQBBalance !== null)
                ? rangeClosingBalance - rangeQBBalance : null;

            let status: CombinedMonthData['status'] = 'missing';
            if (monthlyStatement && rangeStatement) {
                const hasDiscrepancy = (monthlyDifference !== null && Math.abs(monthlyDifference) > 0.01) ||
                    (rangeDifference !== null && Math.abs(rangeDifference) > 0.01);
                status = hasDiscrepancy ? 'mismatch' : 'complete';
            } else if (monthlyStatement || rangeStatement) {
                status = 'partial';
            }

            return {
                month,
                year,
                monthNumber,
                monthName,
                key,
                monthlyStatement,
                rangeStatement,
                hasMonthly: !!monthlyStatement,
                hasRange: !!rangeStatement,
                monthlyClosingBalance,
                rangeClosingBalance,
                monthlyQBBalance,
                rangeQBBalance,
                monthlyDifference,
                rangeDifference,
                status
            };
        });
    };

    // Sort combined data
    const sortedCombinedData = useMemo(() => {
        const data = generateCombinedData();

        if (!sortField || !sortDirection) return data;

        return [...data].sort((a, b) => {
            let aValue, bValue;

            switch (sortField) {
                case 'month':
                    aValue = a.year * 12 + a.month;
                    bValue = b.year * 12 + b.month;
                    break;
                case 'monthlyBalance':
                    aValue = a.monthlyClosingBalance || -Infinity;
                    bValue = b.monthlyClosingBalance || -Infinity;
                    break;
                case 'rangeBalance':
                    aValue = a.rangeClosingBalance || -Infinity;
                    bValue = b.rangeClosingBalance || -Infinity;
                    break;
                case 'monthlyDiff':
                    aValue = Math.abs(a.monthlyDifference || 0);
                    bValue = Math.abs(b.monthlyDifference || 0);
                    break;
                case 'rangeDiff':
                    aValue = Math.abs(a.rangeDifference || 0);
                    bValue = Math.abs(b.rangeDifference || 0);
                    break;
                case 'status':
                    const statusOrder = { 'mismatch': 3, 'missing': 2, 'partial': 1, 'complete': 0 };
                    aValue = statusOrder[a.status];
                    bValue = statusOrder[b.status];
                    break;
                default:
                    return 0;
            }

            if (sortDirection === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });
    }, [statements, dateRange, sortField, sortDirection]);

    // Handle sorting
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc');
            if (sortDirection === 'desc') {
                setSortField('month');
            }
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Sort icon component
    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
        if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4 text-blue-600" />;
        if (sortDirection === 'desc') return <ArrowDown className="h-4 w-4 text-blue-600" />;
        return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    };

    // Status badge components
    const StatusBadge = ({ statement }: { statement: BankStatement | null }) => {
        if (!statement) {
            return <Badge variant="outline" className="bg-red-100 text-red-800">Missing</Badge>;
        }

        const isValidated = statement.validation_status?.is_validated;
        const hasMismatches = statement.validation_status?.mismatches?.length > 0;

        if (isValidated && !hasMismatches) {
            return <Badge variant="outline" className="bg-green-100 text-green-800">Uploaded</Badge>;
        }

        if (hasMismatches) {
            return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Issues</Badge>;
        }

        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Uploaded</Badge>;
    };

    // Combined status badge
    const CombinedStatusBadge = ({ data }: { data: CombinedMonthData }) => {
        switch (data.status) {
            case 'complete':
                return <Badge variant="outline" className="bg-green-100 text-green-800">Complete</Badge>;
            case 'partial':
                return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Partial</Badge>;
            case 'missing':
                return <Badge variant="outline" className="bg-red-100 text-red-800">Missing</Badge>;
            case 'mismatch':
                return <Badge variant="outline" className="bg-orange-100 text-orange-800">Mismatch</Badge>;
            default:
                return <Badge variant="outline">Unknown</Badge>;
        }
    };

    const getStatementStatusIcon = (statement: BankStatement) => {
        if (!statement?.statement_document?.statement_pdf) {
            return <XCircle className="h-4 w-4 text-gray-400" />
        }

        if (statement.validation_status?.is_validated && statement.validation_status.mismatches.length === 0) {
            return <CheckCircle className="h-4 w-4 text-green-500" />
        }

        if (statement.validation_status?.mismatches?.length > 0) {
            return <AlertTriangle className="h-4 w-4 text-amber-500" />
        }

        return <FileText className="h-4 w-4 text-blue-500" />
    }

    const formatCurrency = (amount: number | null, currency: string = 'USD') => {
        if (amount === null || amount === undefined) return '-'
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency || 'USD',
                minimumFractionDigits: 2
            }).format(amount)
        } catch {
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount)
        }
    }

    
    const handleBulkExport = async () => {
        if (!selectedCompany || !selectedBank) {
            toast({
                title: 'Error',
                description: 'Company and bank must be selected for export.',
                variant: 'destructive',
            });
            return;
        }

        const selectedStatementsData = statements.filter(s =>
            selectedStatements.has(s.id)
        );

        try {
            const analysis = analyzeStatementsForExport(selectedStatementsData);
            await createZipExport(selectedStatementsData, selectedCompany, selectedBank, exportOptions);

            let description = `Successfully exported ${analysis.uniqueFiles} unique files`;
            if (analysis.duplicateRangeGroups.length > 0) {
                description += ` (deduplicated ${selectedStatementsData.length - analysis.uniqueFiles} shared range statements)`;
            }

            toast({
                title: 'Export Successful',
                description,
            });
        } catch (error) {
            console.error('Export failed:', error);
            toast({
                title: 'Export Failed',
                description: 'Failed to export statements. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleIndividualExport = async () => {
        if (!selectedCompany || !selectedBank) {
            toast({
                title: 'Error',
                description: 'Company and bank must be selected for export.',
                variant: 'destructive',
            });
            return;
        }

        const selectedStatementsData = statements.filter(s =>
            selectedStatements.has(s.id)
        );

        try {
            const analysis = analyzeStatementsForExport(selectedStatementsData);
            await downloadIndividualFiles(selectedStatementsData, selectedCompany, selectedBank, {
                includePassword: exportOptions.includePassword,
                renameFiles: exportOptions.renameFiles,
            });

            let description = `Started downloading ${analysis.uniqueFiles} unique files`;
            if (analysis.duplicateRangeGroups.length > 0) {
                description += ` (deduplicated ${selectedStatementsData.length - analysis.uniqueFiles} shared range statements)`;
            }

            toast({
                title: 'Export Started',
                description,
            });
        } catch (error) {
            console.error('Export failed:', error);
            toast({
                title: 'Export Failed',
                description: 'Failed to export statements. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleOpenUpload = (month: number, year: number) => {
        setUploadDialogOpen(true)
    }

    const handleOpenExtraction = (statement: BankStatement) => {
        setActiveStatement(statement)
        setExtractionDialogOpen(true)
    }

    const refreshStatements = () => {
        if (selectedBank) {
            loadStatements(selectedBank.id, dateRange)
        }
        onRefresh()
    }

    // Filter data based on status filter
    const filteredCombinedData = useMemo(() => {
        if (filterStatus === 'all') return sortedCombinedData;

        return sortedCombinedData.filter(data => {
            switch (filterStatus) {
                case 'missing':
                    return data.status === 'missing';
                case 'partial':
                    return data.status === 'partial';
                case 'complete':
                    return data.status === 'complete';
                case 'mismatch':
                    return data.status === 'mismatch';
                default:
                    return true;
            }
        });
    }, [sortedCombinedData, filterStatus]);

    return (
        <div className="h-[calc(100vh-200px)] flex bg-gray-50 rounded-lg border overflow-hidden">
            {/* Companies Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h1 className="text-lg font-bold text-gray-900">Companies</h1>
                    <p className="text-sm text-gray-600">Select a company to view statements</p>
                </div>

                {/* Companies List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-1 p-2">
                            {filteredCompanies.map((company) => (
                                <button
                                    key={company.id}
                                    onClick={() => setSelectedCompany(company)}
                                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between group ${selectedCompany?.id === company.id
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'hover:bg-gray-50 text-gray-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Building className="h-4 w-4 flex-shrink-0" />
                                        <span className="text-sm font-medium truncate">
                                            {company.company_name}
                                        </span>
                                    </div>
                                    <ChevronRight className={`h-4 w-4 transition-transform ${selectedCompany?.id === company.id ? 'rotate-90' : ''
                                        }`} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {selectedCompany ? (
                    <>
                        {/* Header */}
                        <div className="bg-white border-b border-gray-200 p-4">
                            <div className="flex flex-col gap-4">
                                {/* Title and Company Info */}
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="text-xl font-semibold text-gray-900">
                                        {selectedCompany.company_name}
                                    </div>
                                    {selectedBank && (
                                        <>
                                            <div className="flex items-center gap-2 font-medium text-primary">
                                                <FileText className="h-4 w-4 text-primary" />
                                                <span>{selectedBank.bank_name} Statements</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500">Account:</span>
                                                <span className="font-mono">{selectedBank.account_number}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500">Currency:</span>
                                                <span>{selectedBank.bank_currency || 'USD'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500">Password:</span>
                                                <span className={`font-semibold ${selectedBank.acc_password ? 'text-green-600' : 'text-red-600'}`}>
                                                    {selectedBank.acc_password || 'Missing'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500">Statements:</span>
                                                <span>{statements.length}</span>
                                            </div>
                                        </>
                                    )}

                                    <div className="text-gray-500 text-sm">
                                        {format(new Date(dateRange.fromYear, dateRange.fromMonth), 'MMM yyyy')} – {format(new Date(dateRange.toYear, dateRange.toMonth), 'MMM yyyy')}
                                    </div>
                                </div>

                                {/* Bank Details */}
                                {selectedBank && (
                                    <div className="flex flex-wrap items-center gap-6 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">

                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 text-sm">Company Start:</span>
                                                <span className="text-sm font-medium">{exportFilters.companyStartDate || 'Not set'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 text-sm">Company End:</span>
                                                <span className="text-sm font-medium">{exportFilters.companyEndDate || 'Not set'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 text-sm">Takeover by BCL:</span>
                                                <span className="text-sm font-medium">{exportFilters.takeoverDateByBCL || 'Not set'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 text-sm">Records From:</span>
                                                <span className="text-sm font-medium">{exportFilters.recordsFromDate || 'Not set'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 text-sm">Bank Start:</span>
                                                <span className="text-sm font-medium">{exportFilters.bankStartDate || 'Not set'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 text-sm">Bank End:</span>
                                                <span className="text-sm font-medium">{exportFilters.bankEndDate || 'Not set'}</span>
                                            </div>
                                        </div>

                                    </div>
                                )}

                                {/* Export Controls */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={selectedStatements.size === statements.length && statements.length > 0}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedStatements(new Set(statements.map(s => s.id)));
                                                } else {
                                                    setSelectedStatements(new Set());
                                                }
                                            }}
                                        />
                                        <span className="text-sm text-gray-600">
                                            {selectedStatements.size} of {statements.length} selected
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedStatements(new Set(statements.map(s => s.id)))}
                                            disabled={statements.length === 0}
                                        >
                                            Select All
                                        </Button>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="default"
                                                    disabled={selectedStatements.size === 0}
                                                    className="flex items-center gap-2"
                                                >
                                                    <Download className="h-4 w-4" />
                                                    Export ({selectedStatements.size})
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-64">
                                                <div className="p-3 space-y-3">
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id="autoZip"
                                                            checked={exportOptions.autoZip}
                                                            onCheckedChange={(checked) =>
                                                                setExportOptions(prev => ({ ...prev, autoZip: checked as boolean }))
                                                            }
                                                        />
                                                        <Label htmlFor="autoZip" className="text-sm">Auto ZIP files</Label>
                                                    </div>

                                                    {/* <div className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id="renameFiles"
                                                            checked={exportOptions.renameFiles}
                                                            onCheckedChange={(checked) =>
                                                                setExportOptions(prev => ({ ...prev, renameFiles: checked as boolean }))
                                                            }
                                                        />
                                                        <Label htmlFor="renameFiles" className="text-sm">Rename files</Label>
                                                    </div> */}

                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id="includePassword"
                                                            checked={exportOptions.includePassword}
                                                            onCheckedChange={(checked) =>
                                                                setExportOptions(prev => ({ ...prev, includePassword: checked as boolean }))
                                                            }
                                                        />
                                                        <Label htmlFor="includePassword" className="text-sm">Include passwords in filename</Label>
                                                    </div>

                                                    <DropdownMenuSeparator />

                                                    <Button
                                                        className="w-full"
                                                        size="sm"
                                                        onClick={() => handleBulkExport()}
                                                    >
                                                        <Package className="h-4 w-4 mr-2" />
                                                        Download ZIP
                                                    </Button>

                                                    <Button
                                                        variant="outline"
                                                        className="w-full"
                                                        size="sm"
                                                        onClick={() => handleIndividualExport()}
                                                    >
                                                        <FileDown className="h-4 w-4 mr-2" />
                                                        Download Individual
                                                    </Button>
                                                </div>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Banks Tabs */}
                        {banks.length > 0 && (
                            <div className="bg-white border-b border-gray-200 px-4">
                                <div className="flex space-x-1 overflow-x-auto">
                                    {banks.map((bank) => (
                                        <button
                                            key={bank.id}
                                            onClick={() => setSelectedBank(bank)}
                                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${selectedBank?.id === bank.id
                                                ? 'border-blue-500 text-blue-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                }`}
                                        >
                                            {bank.bank_name} - {bank.account_number}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Content Area */}
                        <div className="flex-1 overflow-hidden p-4">
                            {selectedBank ? (
                                <div className="h-full flex flex-col space-y-4">
                                    {/* Statement Type Tabs */}
                                    <div className="flex-1 overflow-hidden">
                                        <Tabs value={activeStatementTab} onValueChange={setActiveStatementTab} className="h-full flex flex-col">
                                            <div className="flex-shrink-0">
                                                <TabsList className="grid w-full grid-cols-3">
                                                    <TabsTrigger value="monthly">Monthly Statements</TabsTrigger>
                                                    <TabsTrigger value="range">Range Statements</TabsTrigger>
                                                    <TabsTrigger value="combined">Combined View</TabsTrigger>
                                                </TabsList>
                                            </div>

                                            {/* Monthly Tab */}
                                            <TabsContent value="monthly" className="flex-1 overflow-hidden mt-2">
                                                <Card className="h-full flex flex-col">
                                                    <CardHeader className="flex-shrink-0">
                                                        <CardTitle className="flex items-center justify-between">
                                                            <span>Monthly Statements</span>
                                                            <Badge variant="secondary">
                                                                Monthly: {statements.filter(s => s.statement_type === 'monthly').length}
                                                            </Badge>
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="flex-1 overflow-hidden p-0">
                                                        <div className="overflow-auto h-full">
                                                            <Table>
                                                                <TableHeader className="sticky top-0 bg-background z-10">
                                                                    <TableRow>
                                                                        <TableHead className="w-8">
                                                                            <Checkbox
                                                                                checked={
                                                                                    statements.filter(s => s.statement_type === 'monthly').length > 0 &&
                                                                                    statements.filter(s => s.statement_type === 'monthly').every(s => selectedStatements.has(s.id))
                                                                                }
                                                                                onCheckedChange={(checked) => {
                                                                                    const monthlyStatements = statements.filter(s => s.statement_type === 'monthly');
                                                                                    if (checked) {
                                                                                        setSelectedStatements(prev => new Set([...prev, ...monthlyStatements.map(s => s.id)]));
                                                                                    } else {
                                                                                        setSelectedStatements(prev => {
                                                                                            const newSet = new Set(prev);
                                                                                            monthlyStatements.forEach(s => newSet.delete(s.id));
                                                                                            return newSet;
                                                                                        });
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </TableHead>
                                                                        <TableHead className="min-w-[120px]">Month</TableHead>
                                                                        <TableHead className="min-w-[150px]">Statement Period</TableHead>
                                                                        <TableHead className="min-w-[120px]">Opening Balance</TableHead>
                                                                        <TableHead className="min-w-[120px]">Closing Balance</TableHead>
                                                                        <TableHead className="min-w-[120px]">QB Balance</TableHead>
                                                                        <TableHead className="min-w-[100px]">Difference</TableHead>
                                                                        <TableHead className="min-w-[100px]">Status</TableHead>
                                                                        <TableHead className="min-w-[100px]">Actions</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {generateDateRange().map(({ month, year, monthNumber, monthName, key }) => {
                                                                        const monthlyStatements = getStatementsByType(month, year, 'monthly');
                                                                        const statement = monthlyStatements[0];

                                                                        return (
                                                                            <TableRow key={key}>
                                                                                <TableCell>
                                                                                    {statement && (
                                                                                        <Checkbox
                                                                                            checked={selectedStatements.has(statement.id)}
                                                                                            onCheckedChange={(checked) => {
                                                                                                if (checked) {
                                                                                                    setSelectedStatements(prev => new Set([...prev, statement.id]));
                                                                                                } else {
                                                                                                    setSelectedStatements(prev => {
                                                                                                        const newSet = new Set(prev);
                                                                                                        newSet.delete(statement.id);
                                                                                                        return newSet;
                                                                                                    });
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell className="font-medium">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-xs text-gray-500 w-6 font-mono">{monthNumber.toString().padStart(2, '0')}.</span>
                                                                                        <span>{monthName} {year}</span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="max-w-[200px] truncate">
                                                                                    {statement?.statement_extractions?.statement_period || '-'}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {formatCurrency(
                                                                                        statement?.statement_extractions?.opening_balance,
                                                                                        selectedBank?.bank_currency || 'USD'
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {formatCurrency(
                                                                                        statement?.statement_extractions?.closing_balance,
                                                                                        selectedBank?.bank_currency || 'USD'
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {formatCurrency(
                                                                                        statement?.status?.quickbooks_balance,
                                                                                        selectedBank?.bank_currency || 'USD'
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {(() => {
                                                                                        if (!statement) return '-';
                                                                                        const closing = statement.statement_extractions?.closing_balance;
                                                                                        const qb = statement.status?.quickbooks_balance;
                                                                                        if (closing == null || qb == null) return '-';
                                                                                        const diff = closing - qb;
                                                                                        return (
                                                                                            <span className={Math.abs(diff) > 0.01 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                                                                                                {formatCurrency(diff, selectedBank?.bank_currency || 'USD')}
                                                                                            </span>
                                                                                        );
                                                                                    })()}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <StatusBadge statement={statement} />
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <div className="flex items-center gap-1">
                                                                                        {statement ? (
                                                                                            <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                onClick={() => handleOpenExtraction(statement)}
                                                                                            >
                                                                                                <Eye className="h-4 w-4" />
                                                                                            </Button>
                                                                                        ) : (
                                                                                            <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                onClick={() => handleOpenUpload(month, year)}
                                                                                            >
                                                                                                <Plus className="h-4 w-4" />
                                                                                            </Button>
                                                                                        )}
                                                                                    </div>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        );
                                                                    })}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </TabsContent>

                                            {/* Range Tab */}
                                            <TabsContent value="range" className="flex-1 overflow-hidden mt-2">
                                                <Card className="h-full flex flex-col">
                                                    <CardHeader className="flex-shrink-0">
                                                        <CardTitle className="flex items-center justify-between">
                                                            <span>Range Statements</span>
                                                            <Badge variant="secondary">
                                                                Range: {statements.filter(s => s.statement_type === 'range').length}
                                                            </Badge>
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="flex-1 overflow-hidden p-0">
                                                        <div className="overflow-auto h-full">
                                                            <Table>
                                                                <TableHeader className="sticky top-0 bg-background z-10">
                                                                    <TableRow>
                                                                        <TableHead className="w-8">
                                                                            <Checkbox
                                                                                checked={
                                                                                    statements.filter(s => s.statement_type === 'range').length > 0 &&
                                                                                    statements.filter(s => s.statement_type === 'range').every(s => selectedStatements.has(s.id))
                                                                                }
                                                                                onCheckedChange={(checked) => {
                                                                                    const rangeStatements = statements.filter(s => s.statement_type === 'range');
                                                                                    if (checked) {
                                                                                        setSelectedStatements(prev => new Set([...prev, ...rangeStatements.map(s => s.id)]));
                                                                                    } else {
                                                                                        setSelectedStatements(prev => {
                                                                                            const newSet = new Set(prev);
                                                                                            rangeStatements.forEach(s => newSet.delete(s.id));
                                                                                            return newSet;
                                                                                        });
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </TableHead>
                                                                        <TableHead className="min-w-[120px]">Month</TableHead>
                                                                        <TableHead className="min-w-[150px]">Statement Period</TableHead>
                                                                        <TableHead className="min-w-[100px]">Status</TableHead>
                                                                        <TableHead className="min-w-[120px]">Closing Balance</TableHead>
                                                                        <TableHead className="min-w-[120px]">QB Balance</TableHead>
                                                                        <TableHead className="min-w-[100px]">Actions</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {generateDateRange().map(({ month, year, monthNumber, monthName, key }) => {
                                                                        const rangeStatements = getStatementsByType(month, year, 'range');
                                                                        const statement = rangeStatements[0];

                                                                        return (
                                                                            <TableRow key={key}>
                                                                                <TableCell>
                                                                                    {statement && (
                                                                                        <Checkbox
                                                                                            checked={selectedStatements.has(statement.id)}
                                                                                            onCheckedChange={(checked) => {
                                                                                                if (checked) {
                                                                                                    setSelectedStatements(prev => new Set([...prev, statement.id]));
                                                                                                } else {
                                                                                                    setSelectedStatements(prev => {
                                                                                                        const newSet = new Set(prev);
                                                                                                        newSet.delete(statement.id);
                                                                                                        return newSet;
                                                                                                    });
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell className="font-medium">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-xs text-gray-500 w-6 font-mono">{monthNumber.toString().padStart(2, '0')}.</span>
                                                                                        <span>{monthName} {year}</span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="max-w-[200px] truncate">
                                                                                    {statement?.statement_extractions?.statement_period || '-'}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {statement ? (
                                                                                        <div className="flex items-center gap-2">
                                                                                            {getStatementStatusIcon(statement)}
                                                                                            <span className="text-xs">
                                                                                                {statement.status?.status || 'Unknown'}
                                                                                            </span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <span className="text-gray-400 text-xs">No statement</span>
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {formatCurrency(
                                                                                        statement?.statement_extractions?.closing_balance,
                                                                                        selectedBank?.bank_currency || 'USD'
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {formatCurrency(
                                                                                        statement?.status?.quickbooks_balance,
                                                                                        selectedBank?.bank_currency || 'USD'
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <div className="flex items-center gap-1">
                                                                                        {statement ? (
                                                                                            <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                onClick={() => handleOpenExtraction(statement)}
                                                                                                className="h-7"
                                                                                            >
                                                                                                <Eye className="h-3 w-3 mr-1" />
                                                                                                View
                                                                                            </Button>
                                                                                        ) : (
                                                                                            <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                onClick={() => handleOpenUpload(month, year)}
                                                                                                className="h-7"
                                                                                            >
                                                                                                <Upload className="h-3 w-3 mr-1" />
                                                                                                Upload
                                                                                            </Button>
                                                                                        )}

                                                                                        {statement && !hasStatementType(month, year, 'monthly') && (
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="sm"
                                                                                                onClick={() => handleOpenUpload(month, year)}
                                                                                                className="h-7 w-7 p-0"
                                                                                                title="Add Monthly Statement"
                                                                                            >
                                                                                                <Plus className="h-3 w-3" />
                                                                                            </Button>
                                                                                        )}
                                                                                    </div>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        );
                                                                    })}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </TabsContent>

                                            {/* Combined Tab */}
                                            <TabsContent value="combined" className="flex-1 overflow-hidden mt-2">
                                                <Card className="h-full flex flex-col">
                                                    <CardHeader className="flex-shrink-0">
                                                        <div className="flex items-center justify-between">
                                                            <CardTitle className="flex items-center gap-2">
                                                                <span>Combined Monthly & Range View</span>
                                                            </CardTitle>
                                                            <div className="flex items-center gap-2">
                                                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                                                    <SelectTrigger className="w-40">
                                                                        <SelectValue placeholder="Filter by status" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="all">All Status</SelectItem>
                                                                        <SelectItem value="complete">Complete</SelectItem>
                                                                        <SelectItem value="partial">Partial</SelectItem>
                                                                        <SelectItem value="missing">Missing</SelectItem>
                                                                        <SelectItem value="mismatch">Mismatch</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <Badge variant="secondary">
                                                                    Total: {filteredCombinedData.length} months
                                                                </Badge>
                                                                <Badge variant="outline" className="bg-red-100 text-red-800">
                                                                    Missing: {filteredCombinedData.filter(d => d.status === 'missing').length}
                                                                </Badge>
                                                                <Badge variant="outline" className="bg-orange-100 text-orange-800">
                                                                    Mismatches: {filteredCombinedData.filter(d => d.status === 'mismatch').length}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="flex-1 overflow-hidden p-0">
                                                        <div className="overflow-auto h-full">
                                                            <Table>
                                                                <TableHeader className="sticky top-0 bg-background z-10">
                                                                    <TableRow>
                                                                        <TableHead className="w-8">
                                                                            <Checkbox
                                                                                checked={
                                                                                    filteredCombinedData.length > 0 &&
                                                                                    filteredCombinedData.every(data =>
                                                                                        (data.monthlyStatement && selectedStatements.has(data.monthlyStatement.id)) ||
                                                                                        (data.rangeStatement && selectedStatements.has(data.rangeStatement.id)) ||
                                                                                        (!data.monthlyStatement && !data.rangeStatement)
                                                                                    )
                                                                                }
                                                                                onCheckedChange={(checked) => {
                                                                                    if (checked) {
                                                                                        const allStatementIds = filteredCombinedData.flatMap(data => {
                                                                                            const ids = [];
                                                                                            if (data.monthlyStatement) ids.push(data.monthlyStatement.id);
                                                                                            if (data.rangeStatement) ids.push(data.rangeStatement.id);
                                                                                            return ids;
                                                                                        });
                                                                                        setSelectedStatements(prev => new Set([...prev, ...allStatementIds]));
                                                                                    } else {
                                                                                        const allStatementIds = filteredCombinedData.flatMap(data => {
                                                                                            const ids = [];
                                                                                            if (data.monthlyStatement) ids.push(data.monthlyStatement.id);
                                                                                            if (data.rangeStatement) ids.push(data.rangeStatement.id);
                                                                                            return ids;
                                                                                        });
                                                                                        setSelectedStatements(prev => {
                                                                                            const newSet = new Set(prev);
                                                                                            allStatementIds.forEach(id => newSet.delete(id));
                                                                                            return newSet;
                                                                                        });
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </TableHead>
                                                                        <TableHead className="min-w-[120px]">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => handleSort('month')}
                                                                                className="h-auto p-0 font-semibold hover:bg-transparent flex items-center gap-1"
                                                                            >
                                                                                Month <SortIcon field="month" />
                                                                            </Button>
                                                                        </TableHead>
                                                                        <TableHead className="min-w-[80px] text-center">Monthly</TableHead>
                                                                        <TableHead className="min-w-[120px]">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => handleSort('monthlyBalance')}
                                                                                className="h-auto p-0 font-semibold hover:bg-transparent flex items-center gap-1"
                                                                            >
                                                                                Monthly CB <SortIcon field="monthlyBalance" />
                                                                            </Button>
                                                                        </TableHead>
                                                                        <TableHead className="min-w-[100px]">Monthly QB</TableHead>
                                                                        <TableHead className="min-w-[100px]">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => handleSort('monthlyDiff')}
                                                                                className="h-auto p-0 font-semibold hover:bg-transparent flex items-center gap-1"
                                                                            >
                                                                                Monthly Diff <SortIcon field="monthlyDiff" />
                                                                            </Button>
                                                                        </TableHead>
                                                                        <TableHead className="min-w-[80px] text-center">Range</TableHead>
                                                                        <TableHead className="min-w-[120px]">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => handleSort('rangeBalance')}
                                                                                className="h-auto p-0 font-semibold hover:bg-transparent flex items-center gap-1"
                                                                            >
                                                                                Range CB <SortIcon field="rangeBalance" />
                                                                            </Button>
                                                                        </TableHead>
                                                                        <TableHead className="min-w-[100px]">Range QB</TableHead>
                                                                        <TableHead className="min-w-[100px]">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => handleSort('rangeDiff')}
                                                                                className="h-auto p-0 font-semibold hover:bg-transparent flex items-center gap-1"
                                                                            >
                                                                                Range Diff <SortIcon field="rangeDiff" />
                                                                            </Button>
                                                                        </TableHead>
                                                                        <TableHead className="min-w-[100px]">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => handleSort('status')}
                                                                                className="h-auto p-0 font-semibold hover:bg-transparent flex items-center gap-1"
                                                                            >
                                                                                Status <SortIcon field="status" />
                                                                            </Button>
                                                                        </TableHead>
                                                                        <TableHead className="min-w-[120px]">Actions</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {filteredCombinedData.map((data) => (
                                                                        <TableRow key={data.key} className={
                                                                            data.status === 'missing' ? 'bg-red-50' :
                                                                                data.status === 'mismatch' ? 'bg-orange-50' :
                                                                                    data.status === 'partial' ? 'bg-yellow-50' :
                                                                                        'bg-green-50'
                                                                        }>
                                                                            <TableCell>
                                                                                <div className="flex items-center gap-1">
                                                                                    {data.monthlyStatement && (
                                                                                        <Checkbox
                                                                                            checked={selectedStatements.has(data.monthlyStatement.id)}
                                                                                            onCheckedChange={(checked) => {
                                                                                                if (checked) {
                                                                                                    setSelectedStatements(prev => new Set([...prev, data.monthlyStatement!.id]));
                                                                                                } else {
                                                                                                    setSelectedStatements(prev => {
                                                                                                        const newSet = new Set(prev);
                                                                                                        newSet.delete(data.monthlyStatement!.id);
                                                                                                        return newSet;
                                                                                                    });
                                                                                                }
                                                                                            }}
                                                                                            className="mr-1"
                                                                                            title="Monthly Statement"
                                                                                        />
                                                                                    )}
                                                                                    {data.rangeStatement && (
                                                                                        <Checkbox
                                                                                            checked={selectedStatements.has(data.rangeStatement.id)}
                                                                                            onCheckedChange={(checked) => {
                                                                                                if (checked) {
                                                                                                    setSelectedStatements(prev => new Set([...prev, data.rangeStatement!.id]));
                                                                                                } else {
                                                                                                    setSelectedStatements(prev => {
                                                                                                        const newSet = new Set(prev);
                                                                                                        newSet.delete(data.rangeStatement!.id);
                                                                                                        return newSet;
                                                                                                    });
                                                                                                }
                                                                                            }}
                                                                                            title="Range Statement"
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="font-medium">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-xs text-gray-500 w-6 font-mono">{data.monthNumber.toString().padStart(2, '0')}.</span>
                                                                                    <span>{data.monthName} {data.year}</span>
                                                                                </div>
                                                                            </TableCell>

                                                                            {/* Monthly Status */}
                                                                            <TableCell className="text-center">
                                                                                {data.hasMonthly ? (
                                                                                    <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                                                                ) : (
                                                                                    <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                                                                )}
                                                                            </TableCell>

                                                                            {/* Monthly Closing Balance */}
                                                                            <TableCell className={data.monthlyClosingBalance === null ? 'text-gray-400' : ''}>
                                                                                {formatCurrency(data.monthlyClosingBalance, selectedBank?.bank_currency || 'USD')}
                                                                            </TableCell>

                                                                            {/* Monthly QB Balance */}
                                                                            <TableCell className={data.monthlyQBBalance === null ? 'text-gray-400' : ''}>
                                                                                {formatCurrency(data.monthlyQBBalance, selectedBank?.bank_currency || 'USD')}
                                                                            </TableCell>

                                                                            {/* Monthly Difference */}
                                                                            <TableCell>
                                                                                {data.monthlyDifference !== null ? (
                                                                                    <span className={Math.abs(data.monthlyDifference) > 0.01 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                                                                                        {formatCurrency(data.monthlyDifference, selectedBank?.bank_currency || 'USD')}
                                                                                    </span>
                                                                                ) : '-'}
                                                                            </TableCell>

                                                                            {/* Range Status */}
                                                                            <TableCell className="text-center">
                                                                                {data.hasRange ? (
                                                                                    <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                                                                ) : (
                                                                                    <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                                                                )}
                                                                            </TableCell>

                                                                            {/* Range Closing Balance */}
                                                                            <TableCell className={data.rangeClosingBalance === null ? 'text-gray-400' : ''}>
                                                                                {formatCurrency(data.rangeClosingBalance, selectedBank?.bank_currency || 'USD')}
                                                                            </TableCell>

                                                                            {/* Range QB Balance */}
                                                                            <TableCell className={data.rangeQBBalance === null ? 'text-gray-400' : ''}>
                                                                                {formatCurrency(data.rangeQBBalance, selectedBank?.bank_currency || 'USD')}
                                                                            </TableCell>

                                                                            {/* Range Difference */}
                                                                            <TableCell>
                                                                                {data.rangeDifference !== null ? (
                                                                                    <span className={Math.abs(data.rangeDifference) > 0.01 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                                                                                        {formatCurrency(data.rangeDifference, selectedBank?.bank_currency || 'USD')}
                                                                                    </span>
                                                                                ) : '-'}
                                                                            </TableCell>

                                                                            {/* Overall Status */}
                                                                            <TableCell>
                                                                                <CombinedStatusBadge data={data} />
                                                                            </TableCell>

                                                                            {/* Actions */}
                                                                            <TableCell>
                                                                                <div className="flex items-center gap-1">
                                                                                    {data.monthlyStatement && (
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() => handleOpenExtraction(data.monthlyStatement!)}
                                                                                            title="View Monthly Statement"
                                                                                            className="h-7 px-2"
                                                                                        >
                                                                                            <Eye className="h-3 w-3" />
                                                                                            <span className="text-xs ml-1">M</span>
                                                                                        </Button>
                                                                                    )}
                                                                                    {data.rangeStatement && (
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() => handleOpenExtraction(data.rangeStatement!)}
                                                                                            title="View Range Statement"
                                                                                            className="h-7 px-2"
                                                                                        >
                                                                                            <Eye className="h-3 w-3" />
                                                                                            <span className="text-xs ml-1">R</span>
                                                                                        </Button>
                                                                                    )}
                                                                                    {(!data.monthlyStatement || !data.rangeStatement) && (
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() => handleOpenUpload(data.month, data.year)}
                                                                                            title="Upload Statement"
                                                                                            className="h-7 px-2"
                                                                                        >
                                                                                            <Plus className="h-3 w-3" />
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-64">
                                    <div className="text-center">
                                        <Building className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Banks Found</h3>
                                        <p className="text-gray-600">This company doesn't have any banks configured.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <Building className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                            <h3 className="text-xl font-medium text-gray-900 mb-2">Select a Company</h3>
                            <p className="text-gray-600">Choose a company from the sidebar to view their bank statements.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Upload Dialog */}
            {uploadDialogOpen && selectedBank && (
                <BankStatementUploadDialog
                    isOpen={uploadDialogOpen}
                    onClose={() => {
                        setUploadDialogOpen(false)
                        refreshStatements()
                    }}
                    onStatementUploaded={(statement) => {
                        setActiveStatement(statement)
                        setUploadDialogOpen(false)
                        setExtractionDialogOpen(true)
                        refreshStatements()
                    }}
                    bank={selectedBank}
                    cycleMonth={new Date().getMonth()}
                    cycleYear={new Date().getFullYear()}
                    existingStatement={null}
                    statementCycleId={null}
                    onOpenExtractionDialog={(statement) => {
                        setActiveStatement(statement)
                        setExtractionDialogOpen(true)
                    }}
                />
            )}

            {/* Extraction Dialog */}
            {extractionDialogOpen && selectedBank && activeStatement && (
                <BankExtractionDialog
                    isOpen={extractionDialogOpen}
                    onClose={() => {
                        setExtractionDialogOpen(false)
                        setActiveStatement(null)
                        refreshStatements()
                    }}
                    onStatementUpdated={() => {
                        setExtractionDialogOpen(false)
                        setActiveStatement(null)
                        refreshStatements()
                    }}
                    onStatementDeleted={() => {
                        setExtractionDialogOpen(false)
                        setActiveStatement(null)
                        refreshStatements()
                    }}
                    bank={selectedBank}
                    statement={activeStatement}
                />
            )}
        </div>
    )
}