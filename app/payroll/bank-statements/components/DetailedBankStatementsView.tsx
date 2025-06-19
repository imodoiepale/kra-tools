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
    Plus
} from 'lucide-react'
import { format } from 'date-fns'
import { BankStatementUploadDialog } from './BankStatementUploadDialog'
import BankExtractionDialog from './BankExtractionDialog'

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
        document_size?: number;
    };
    statement_extractions: {
        closing_balance: number | null;
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
}

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
    searchTerm,
    dateRange,
    selectedClientTypes,
    onRefresh
}: DetailedBankStatementsViewProps) {
    const { toast } = useToast()
    const [companies, setCompanies] = useState<Company[]>([])
    const [banks, setBanks] = useState<Bank[]>([])
    const [statements, setStatements] = useState<BankStatement[]>([])
    const [loading, setLoading] = useState(true)

    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
    const [selectedBank, setSelectedBank] = useState<Bank | null>(null)
    const [activeStatementTab, setActiveStatementTab] = useState<'monthly' | 'range'>('monthly')

    // Dialog states
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
    const [extractionDialogOpen, setExtractionDialogOpen] = useState(false)
    const [activeStatement, setActiveStatement] = useState<BankStatement | null>(null)

    // Load companies on mount
    useEffect(() => {
        loadCompanies()
    }, [])

    // Load banks when company changes
    useEffect(() => {
        if (selectedCompany) {
            loadBanks(selectedCompany.id)
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

    const loadCompanies = async () => {
        try {
            const { data, error } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .order('company_name')

            if (error) throw error
            setCompanies(data || [])
        } catch (error) {
            console.error('Error loading companies:', error)
            toast({
                title: 'Error',
                description: 'Failed to load companies',
                variant: 'destructive'
            })
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

            if (error) throw error
            setBanks(data || [])

            if (data && data.length > 0) {
                setSelectedBank(data[0])
            }
        } catch (error) {
            console.error('Error loading banks:', error)
            toast({
                title: 'Error',
                description: 'Failed to load banks',
                variant: 'destructive'
            })
        }
    }

    const loadStatements = async (bankId: number, dateRange: any) => {
        try {
            const { data, error } = await supabase
                .from('acc_cycle_bank_statements')
                .select('*')
                .eq('bank_id', bankId)
                .gte('statement_year', dateRange.fromYear)
                .lte('statement_year', dateRange.toYear)
                .order('statement_year')
                .order('statement_month')

            if (error) throw error

            // Filter by month range if same year, otherwise get all months
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
                description: 'Failed to load statements',
                variant: 'destructive'
            })
        }
    }

    // Filter companies based on client types and search
    const filteredCompanies = useMemo(() => {
        let filtered = companies;

        // Filter by client types
        if (selectedClientTypes && selectedClientTypes.length > 0) {
            const currentDate = new Date();
            filtered = filtered.filter(company => {
                return selectedClientTypes.some(filter => {
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

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(company =>
                company.company_name.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        return filtered;
    }, [companies, selectedClientTypes, searchTerm])

    const getStatementStatusIcon = (statement: BankStatement) => {
        if (!statement.statement_document?.statement_pdf) {
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

    const formatCurrency = (amount: number | null, currency: string) => {
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

    const generateDateRange = () => {
        const months = [];
        let currentDate = new Date(dateRange.fromYear, dateRange.fromMonth);
        const endDate = new Date(dateRange.toYear, dateRange.toMonth);

        while (currentDate <= endDate) {
            months.push({
                month: currentDate.getMonth(),
                year: currentDate.getFullYear(),
                key: `${currentDate.getFullYear()}-${currentDate.getMonth()}`
            });
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        return months;
    }

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

    // Get statements by type for the current view
    const getStatementsByType = (month: number, year: number, type: 'monthly' | 'range') => {
        return statements.filter(s =>
            s.statement_month === month &&
            s.statement_year === year &&
            s.statement_type === type
        );
    }

    const hasStatementType = (month: number, year: number, type: 'monthly' | 'range') => {
        return getStatementsByType(month, year, type).length > 0;
    }

    return (
        <div className="h-[calc(100vh-200px)] flex bg-gray-50 rounded-lg border">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h1 className="text-lg font-bold text-gray-900">Companies</h1>
                    <p className="text-sm text-gray-600">Select a company to view statements</p>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-gray-200">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search companies..."
                            value={searchTerm}
                            onChange={() => { }} // Controlled by parent
                            className="pl-10"
                            disabled
                        />
                    </div>
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
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">
                                        {selectedCompany.company_name}
                                    </h2>
                                    <p className="text-gray-600">
                                        {format(new Date(dateRange.fromYear, dateRange.fromMonth), 'MMM yyyy')} - {format(new Date(dateRange.toYear, dateRange.toMonth), 'MMM yyyy')}
                                    </p>
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
                        <div className="flex-1 overflow-y-auto p-4">
                            {selectedBank ? (
                                <div className="space-y-4">
                                    {/* Bank Info Card */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <FileText className="h-5 w-5" />
                                                {selectedBank.bank_name} Statements
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <p className="text-gray-600">Account Number</p>
                                                    <p className="font-mono">{selectedBank.account_number}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600">Currency</p>
                                                    <p className="font-medium">{selectedBank.bank_currency}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600">Password Status</p>
                                                    <Badge variant={selectedBank.acc_password ? "default" : "destructive"}>
                                                        {selectedBank.acc_password ? "Available" : "Missing"}
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600">Total Statements</p>
                                                    <p className="font-medium">{statements.length}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Statement Type Tabs */}
                                    <Tabs value={activeStatementTab} onValueChange={setActiveStatementTab}>
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="monthly">Monthly Statements</TabsTrigger>
                                            <TabsTrigger value="range">Range Statements</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="monthly">
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle className="flex items-center justify-between">
                                                        <span>Monthly Statements</span>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline">
                                                                Monthly: {statements.filter(s => s.statement_type === 'monthly').length}
                                                            </Badge>
                                                        </div>
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Period</TableHead>
                                                                <TableHead>Status</TableHead>
                                                                <TableHead>Closing Balance</TableHead>
                                                                <TableHead>QB Balance</TableHead>
                                                                <TableHead>Difference</TableHead>
                                                                <TableHead>Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {generateDateRange().map(({ month, year, key }) => {
                                                                const monthlyStatements = getStatementsByType(month, year, 'monthly');
                                                                const statement = monthlyStatements[0];

                                                                return (
                                                                    <TableRow key={key}>
                                                                        <TableCell className="font-medium">
                                                                            {format(new Date(year, month), 'MMMM yyyy')}
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
                                                                                selectedBank.bank_currency
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {formatCurrency(
                                                                                statement?.status?.quickbooks_balance,
                                                                                selectedBank.bank_currency
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
                                                                                        {formatCurrency(diff, selectedBank.bank_currency)}
                                                                                    </span>
                                                                                );
                                                                            })()}
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

                                                                                {/* Add range statement if monthly exists but range doesn't */}
                                                                                {statement && !hasStatementType(month, year, 'range') && (
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        onClick={() => handleOpenUpload(month, year)}
                                                                                        className="h-7 w-7 p-0"
                                                                                        title="Add Range Statement"
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
                                                </CardContent>
                                            </Card>
                                        </TabsContent>

                                        <TabsContent value="range">
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle className="flex items-center justify-between">
                                                        <span>Range Statements</span>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary">
                                                                Range: {statements.filter(s => s.statement_type === 'range').length}
                                                            </Badge>
                                                        </div>
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Period</TableHead>
                                                                <TableHead>Statement Period</TableHead>
                                                                <TableHead>Status</TableHead>
                                                                <TableHead>Closing Balance</TableHead>
                                                                <TableHead>QB Balance</TableHead>
                                                                <TableHead>Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {generateDateRange().map(({ month, year, key }) => {
                                                                const rangeStatements = getStatementsByType(month, year, 'range');
                                                                const statement = rangeStatements[0];

                                                                return (
                                                                    <TableRow key={key}>
                                                                        <TableCell className="font-medium">
                                                                            {format(new Date(year, month), 'MMMM yyyy')}
                                                                        </TableCell>
                                                                        <TableCell>
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
                                                                                selectedBank.bank_currency
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {formatCurrency(
                                                                                statement?.status?.quickbooks_balance,
                                                                                selectedBank.bank_currency
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

                                                                                {/* Add monthly statement if range exists but monthly doesn't */}
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
                                                </CardContent>
                                            </Card>
                                        </TabsContent>
                                    </Tabs>
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