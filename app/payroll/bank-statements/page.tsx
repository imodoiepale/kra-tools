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
import BankReconciliationTable from './BankReconciliationTable'
import { usePayrollCycle } from '../hooks/usePayrollCycle'

export default function BankReconciliationPage() {
    const [activeTab, setActiveTab] = useState<string>('statements')
    const [stats, setStats] = useState({
        totalBanks: 0,
        statementsUploaded: 0,
        reconciled: 0,
        mismatches: 0
    })

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
            const monthStr = (selectedMonth + 1).toString().padStart(2, '0')
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
                    .from('acc_cycle_bank_statements ')
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
            const monthStr = (selectedMonth + 1).toString().padStart(2, '0')
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

    return (
        <div className="py-6 space-y-6 p-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bank Reconciliation</h1>
                    <p className="text-muted-foreground">
                        Manage and reconcile bank statements with QuickBooks data
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <MonthYearSelector
                        selectedMonth={selectedMonth} // Adjust for 0-indexed month in the hook
                        selectedYear={selectedYear}
                        onMonthChange={(month) => setSelectedMonth(month - 1)} // Adjust back to 0-indexed
                        onYearChange={setSelectedYear}
                    />

                    <div className="px-3 py-1 bg-primary/10 text-primary rounded-md font-medium">
                        {loading ? 'Loading...' : 'Active Cycle'}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Total Banks</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-bold">{stats.totalBanks}</div>
                                    <div className="p-2 bg-blue-100 text-blue-700 rounded-md">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <p className="text-xs text-muted-foreground">
                                    Total banks registered in the system
                                </p>
                            </CardFooter>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Statements Uploaded</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-bold">{stats.statementsUploaded}</div>
                                    <div className="p-2 bg-green-100 text-green-700 rounded-md">
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <p className="text-xs text-muted-foreground">
                                    {stats.totalBanks > 0
                                        ? ((stats.statementsUploaded / stats.totalBanks) * 100).toFixed(0)
                                        : 0}% of total banks
                                </p>
                            </CardFooter>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Reconciled</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-bold">{stats.reconciled}</div>
                                    <div className="p-2 bg-blue-100 text-blue-700 rounded-md">
                                        <PieChart className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <p className="text-xs text-muted-foreground">
                                    {stats.statementsUploaded > 0
                                        ? ((stats.reconciled / stats.statementsUploaded) * 100).toFixed(0)
                                        : 0}% of statements match QuickBooks
                                </p>
                            </CardFooter>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Mismatches</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-bold">{stats.mismatches}</div>
                                    <div className="p-2 bg-red-100 text-red-700 rounded-md">
                                        <XCircle className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <p className="text-xs text-muted-foreground">
                                    {stats.statementsUploaded > 0
                                        ? ((stats.mismatches / stats.statementsUploaded) * 100).toFixed(0)
                                        : 0}% of statements need reconciliation
                                </p>
                            </CardFooter>
                        </Card>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="statements">Bank Statements</TabsTrigger>
                            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
                            <TabsTrigger value="reports">Reports</TabsTrigger>
                        </TabsList>

                        <TabsContent value="statements" className="space-y-4 py-4">
                            <BankReconciliationTable
                                selectedYear={selectedYear}
                                selectedMonth={selectedMonth + 1} // Adjust for 0-indexed month
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                onStatsChange={handleStatsChange}
                            />
                        </TabsContent>

                        <TabsContent value="reconciliation" className="space-y-4 py-4">
                            <div className="rounded-lg border bg-card p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <BarChart3 className="h-5 w-5 text-primary" />
                                    <h3 className="text-lg font-semibold">Reconciliation Dashboard</h3>
                                </div>

                                <div className="flex items-center justify-center h-40">
                                    <CircleDashed className="h-8 w-8 text-muted-foreground" />
                                    <span className="ml-2 text-muted-foreground">
                                        Reconciliation dashboard coming soon
                                    </span>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="reports" className="space-y-4 py-4">
                            <div className="rounded-lg border bg-card p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <h3 className="text-lg font-semibold">Reports</h3>
                                </div>

                                <div className="flex items-center justify-center h-40">
                                    <CircleDashed className="h-8 w-8 text-muted-foreground" />
                                    <span className="ml-2 text-muted-foreground">
                                        Reports dashboard coming soon
                                    </span>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    )
}