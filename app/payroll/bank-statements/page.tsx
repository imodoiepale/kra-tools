// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from '@/components/ui/card'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { Separator } from '@/components/ui/separator'
import { MonthYearSelector } from '../components/MonthYearSelector'
import {
    BarChart3,
    CheckCircle2,
    CircleDashed,
    FileText,
    Loader2,
    PieChart,
    XCircle,
    UploadCloud,
    LayoutGrid
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu"
import { BankReconciliationTable } from './BankReconciliationTable'
import { useStatementCycle } from '../hooks/useStatementCycle'
import { BankStatementFilters } from './components/BankStatementFilters'
import { BankStatementBulkUploadDialog } from './components/BulkUpload/page'

export default function BankReconciliationPage() {
    const [activeTab, setActiveTab] = useState<string>('statements')
    const [stats, setStats] = useState({
        totalBanks: 0,
        statementsUploaded: 0,
        reconciled: 0,
        mismatches: 0
    })
    const [selectedClientTypes, setSelectedClientTypes] = useState<string[]>(["acc"])
    const [selectedFilters, setSelectedFilters] = useState<FilterWithStatus[]>([])
    const [loading, setLoading] = useState<boolean>(true);
    const [companies, setCompanies] = useState<Company[]>([])

    const columns = [
        { id: "number", label: "Number" },
        { id: "company", label: "Company" },
        { id: "bank", label: "Bank" },
        { id: "accountNumber", label: "Account Number" },
        { id: "currency", label: "Currency" },
        { id: "statement", label: "Statement" },
        { id: "password", label: "Password" },
        { id: "closingBalance", label: "Closing Balance" },
        { id: "qbBalance", label: "QB Balance" },
        { id: "difference", label: "Difference" },
        { id: "status", label: "Status" },
        { id: "actions", label: "Actions" },
    ];

    const [columnVisibility, setColumnVisibility] = useState(
        Object.fromEntries(columns.map(col => [col.id, true])) // Initialize dynamically
    );

    const toggleColumnVisibility = (columnId) => {
        setColumnVisibility(prev => ({
            ...prev,
            [columnId]: !prev[columnId]
        }));
    };

    const [showBulkUpload, setShowBulkUpload] = useState<boolean>(false)
    const [banks, setBanks] = useState<Bank[]>([])

    const {
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        searchTerm,
        setSearchTerm,
        // loading,
        statementCycleId,
        fetchOrCreateStatementCycle,
        fetchBanks,
        fetchStatementStats
    } = useStatementCycle()

    const { toast } = useToast()

    // Initialize payroll cycle and fetch stats
    useEffect(() => {
        const initializeData = async () => {
            try {
                const cycleId = await fetchOrCreateStatementCycle();
                if (cycleId) {
                    const statsData = await fetchStatementStats(cycleId);
                    setStats(statsData);

                    const banksData = await fetchBanks();
                    setBanks(banksData);
                }
            } catch (error) {
                console.error('Error initializing data:', error);
            }
        }

        initializeData();
    }, []);

    // Update stats when month/year changes
    useEffect(() => {
        if (statementCycleId) {
            const updateData = async () => {
                try {
                    setLoading(true);
                    const statsData = await fetchStatementStats(statementCycleId);
                    setStats(statsData);
                } catch (error) {
                    console.error('Error updating stats:', error);
                } finally {
                    setLoading(false);
                }
            };

            updateData();
        }
    }, [selectedMonth, selectedYear, statementCycleId]);

    // Fetch companies data
    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const { data, error } = await supabase
                    .from('acc_portal_company_duplicate')
                    .select('*')
                    .order('company_name')

                if (error) throw error
                setCompanies(data || [])
            } catch (error) {
                console.error('Error fetching companies:', error)
            }
        }

        fetchCompanies()
    }, [])

    // Handle stats update from table component
    const handleStatsChange = async () => {
        if (statementCycleId) {
            const statsData = await fetchStatementStats(statementCycleId);
            setStats(statsData);
        }
    }

    const handleFilterChange = (newFilters: FilterWithStatus[]) => {
        setSelectedFilters(newFilters);
    };

    const handleClientTypeChange = (newTypes: string[]) => {
        setSelectedClientTypes(newTypes);
    }

    return (
        <div className="py-6 space-y-6 p-4">
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-xl font-bold tracking-tight">Bank Statements and Reconciliation</p>
                    <p className="text-muted-foreground text-md">
                        Manage and reconcile bank statements with QuickBooks data
                    </p>
                </div>
            </div>

            {/* {loading ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : ( */}
            <>
                <div className="grid grid-cols-4 gap-2">
                    <Card className="shadow-sm border-blue-100">
                        <div className="p-2 flex items-center gap-2.5">
                            <div className="p-1.5 bg-blue-100/70 text-blue-700 rounded-md shrink-0">
                                <FileText className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1">
                                <div className="text-xl font-bold leading-none">{stats.totalBanks}</div>
                                <p className="text-xs text-muted-foreground mt-0.5">Total Banks</p>
                            </div>
                            <div className="text-2xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                {stats.totalBanks} registered
                            </div>
                        </div>
                    </Card>

                    <Card className="shadow-sm border-green-100">
                        <div className="p-2 flex items-center gap-2.5">
                            <div className="p-1.5 bg-green-100/70 text-green-700 rounded-md shrink-0">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1">
                                <div className="text-xl font-bold leading-none">{stats.statementsUploaded}</div>
                                <p className="text-xs text-muted-foreground mt-0.5">Statements</p>
                            </div>
                            <div className="text-2xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                {stats.totalBanks > 0
                                    ? ((stats.statementsUploaded / stats.totalBanks) * 100).toFixed(0)
                                    : 0}% of banks
                            </div>
                        </div>
                    </Card>

                    <Card className="shadow-sm border-blue-100">
                        <div className="p-2 flex items-center gap-2.5">
                            <div className="p-1.5 bg-blue-100/70 text-blue-700 rounded-md shrink-0">
                                <PieChart className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1">
                                <div className="text-xl font-bold leading-none">{stats.reconciled}</div>
                                <p className="text-xs text-muted-foreground mt-0.5">Reconciled</p>
                            </div>
                            <div className="text-2xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                {stats.statementsUploaded > 0
                                    ? ((stats.reconciled / stats.statementsUploaded) * 100).toFixed(0)
                                    : 0}% matched
                            </div>
                        </div>
                    </Card>

                    <Card className="shadow-sm border-red-100">
                        <div className="p-2 flex items-center gap-2.5">
                            <div className="p-1.5 bg-red-100/70 text-red-700 rounded-md shrink-0">
                                <XCircle className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1">
                                <div className="text-xl font-bold leading-none">{stats.mismatches}</div>
                                <p className="text-xs text-muted-foreground mt-0.5">Mismatches</p>
                            </div>
                            <div className="text-2xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                {stats.statementsUploaded > 0
                                    ? ((stats.mismatches / stats.statementsUploaded) * 100).toFixed(0)
                                    : 0}% to reconcile
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-4">
                    <div className="flex flex-col space-y-4">
                        {/* <h2 className="text-2xl font-semibold tracking-tight">Bank Statements</h2> */}

                        {/* Table Controls - New organized layout with Input, Filters, and MonthYearSelector */}
                        <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md">
                            <div className="flex items-center gap-3">
                                <Input
                                    placeholder="Search companies..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-60"
                                />
                                <MonthYearSelector
                                    selectedMonth={selectedMonth}
                                    selectedYear={selectedYear}
                                    onMonthChange={(month) => setSelectedMonth(month)}
                                    onYearChange={setSelectedYear}
                                />
                                <BankStatementFilters
                                    selectedCategories={selectedFilters}
                                    onFilterChange={handleFilterChange}
                                    selectedClientTypes={selectedClientTypes}
                                    onClientTypeChange={handleClientTypeChange}
                                />

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <LayoutGrid className="h-4 w-4 mr-2" />
                                            Columns
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[200px]">
                                        {columns.map(({ id, label }) => (
                                            <DropdownMenuCheckboxItem
                                                key={id}
                                                checked={columnVisibility[id]}
                                                onCheckedChange={() => toggleColumnVisibility(id)}
                                            >
                                                {label}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <Button
                                onClick={() => setShowBulkUpload(true)}
                                size="sm"
                                className="h-8 flex items-center"
                            >
                                <UploadCloud className="h-4 w-4" />
                                Bulk Upload
                            </Button>
                        </div>

                        <BankReconciliationTable
                            activeFilters={selectedFilters}
                            selectedYear={selectedYear}
                            selectedMonth={selectedMonth}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            onStatsChange={handleStatsChange}
                            selectedCategories={selectedClientTypes}
                            columnVisibility={columnVisibility}
                            companies={companies}
                        />

                        {showBulkUpload && (
                            <BankStatementBulkUploadDialog
                                isOpen={showBulkUpload}
                                onClose={() => setShowBulkUpload(false)}
                                companies={companies}
                                cycleMonth={selectedMonth}
                                cycleYear={selectedYear}
                                statementCycleId={statementCycleId}
                                onStatementsUploaded={(statements) => {
                                    console.log('Uploaded statements:', statements);
                                    fetchStatementStats(statementCycleId).then((statsData) => {
                                        setStats(statsData);
                                    });
                                }}
                            />
                        )}
                    </div>
                </div>

            </>
            {/* // )} */}
        </div>
    )
}