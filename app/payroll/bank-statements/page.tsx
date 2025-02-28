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
    XCircle
} from 'lucide-react'
import { BankReconciliationTable } from './BankReconciliationTable'
import { usePayrollCycle } from '../hooks/usePayrollCycle'
import { BankStatementFilters } from './components/BankStatementFilters'

export default function BankReconciliationPage() {
    const [activeTab, setActiveTab] = useState<string>('statements')
    const [stats, setStats] = useState({
        totalBanks: 0,
        statementsUploaded: 0,
        reconciled: 0,
        mismatches: 0
    })
    const [selectedClientTypes, setSelectedClientTypes] = useState<string[]>(["acc"])
    const [selectedFilters, setSelectedFilters] = useState<string[]>([])

    const {
        selectedYear,
        selectedMonth,
        setSelectedYear,
        setSelectedMonth,
        searchTerm,
        setSearchTerm,
        loading,
        fetchOrCreatePayrollCycle
    } = usePayrollCycle()

    const { toast } = useToast()

    // Initialize payroll cycle and fetch stats
    useEffect(() => {
        const initializeCycle = async () => {
            try {
                await fetchOrCreatePayrollCycle()
                await fetchStats()
            } catch (error) {
                console.error('Error initializing:', error)
            }
        }

        initializeCycle()
    }, [fetchOrCreatePayrollCycle])

    // Fetch stats whenever month/year changes
    useEffect(() => {
        fetchStats()
    }, [selectedMonth, selectedYear])

    // Fetch reconciliation statistics
    const fetchStats = async () => {
        try {
            // Total banks query
            const { data: banksData, error: banksError } = await supabase
                .from('acc_portal_banks')
                .select('id', { count: 'exact' })

            if (banksError) throw banksError

            // Format month for query
            const monthStr = (selectedMonth).toString().padStart(2, '0')
            const cycleMonthYear = `${selectedYear}-${monthStr}`

            // Get cycle ID first
            const { data: cycleData, error: cycleError } = await supabase
                .from('payroll_cycles')
                .select('id')
                .eq('month_year', cycleMonthYear)
                .single()

            if (cycleError && cycleError.code !== 'PGRST116') {
                // PGRST116 is "No rows returned" error, which is expected if no cycle exists
                throw cycleError
            }

            let statementsUploaded = 0
            let reconciled = 0
            let mismatches = 0

            // Only proceed if we have a cycle
            if (cycleData?.id) {
                // Statements query
                const { data: statementsData, error: statementsError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .select(`
                        id, 
                        statement_document, 
                        statement_extractions,
                        quickbooks_balance
                    `)
                    .eq('payroll_cycle_id', cycleData.id)

                if (statementsError) throw statementsError

                // Calculate stats
                statementsUploaded = statementsData?.filter(s =>
                    s.statement_document?.statement_pdf !== null
                ).length || 0

                reconciled = statementsData?.filter(s =>
                    s.statement_extractions?.closing_balance !== null &&
                    s.quickbooks_balance !== null &&
                    Math.abs(s.statement_extractions.closing_balance - s.quickbooks_balance) < 0.01
                ).length || 0

                mismatches = statementsData?.filter(s =>
                    s.statement_extractions?.closing_balance !== null &&
                    s.quickbooks_balance !== null &&
                    Math.abs(s.statement_extractions.closing_balance - s.quickbooks_balance) >= 0.01
                ).length || 0
            }

            setStats({
                totalBanks: banksData?.length || 0,
                statementsUploaded,
                reconciled,
                mismatches
            })

        } catch (error) {
            console.error('Error fetching stats:', error)
            toast({
                title: 'Error',
                description: 'Failed to load reconciliation statistics',
                variant: 'destructive'
            })
        }
    }

    // Get the proper payroll cycle ID
    const getCurrentCycleId = async (): Promise<string | null> => {
        try {
            const monthStr = (selectedMonth).toString().padStart(2, '0')
            const cycleMonthYear = `${selectedYear}-${monthStr}`

            const { data, error } = await supabase
                .from('payroll_cycles')
                .select('id')
                .eq('month_year', cycleMonthYear)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    // No cycle found
                    return null
                }
                throw error
            }

            return data?.id || null
        } catch (error) {
            console.error('Error getting cycle ID:', error)
            return null
        }
    }

    // Handle stats update from table component
    const handleStatsChange = async () => {
        await fetchStats()
    }

    const handleFilterChange = (newFilters: string[]) => {
        setSelectedFilters(newFilters)
    }

    const handleClientTypeChange = (newTypes: string[]) => {
        setSelectedClientTypes(newTypes)
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

            {loading ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
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
                                {/* <div className="text-sm font-medium">Table Controls</div> */}
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
                                        onMonthChange={(month) => setSelectedMonth(month - 1)}
                                        onYearChange={setSelectedYear}
                                    />
                                    <BankStatementFilters
                                        selectedCategories={selectedFilters}
                                        onFilterChange={handleFilterChange}
                                        selectedClientTypes={selectedClientTypes}
                                        onClientTypeChange={handleClientTypeChange}
                                    />
                                </div>
                            </div>

                            <BankReconciliationTable
                                activeFilters={selectedFilters}
                                selectedYear={selectedYear}
                                selectedMonth={selectedMonth}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                onStatsChange={handleStatsChange}
                                selectedCategories={selectedClientTypes}
                            />
                        </div>
                    </div>

                </>
            )}
        </div>
    )
}