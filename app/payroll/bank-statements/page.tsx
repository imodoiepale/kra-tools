// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { MonthYearSelector } from '../components/MonthYearSelector'
import {
    CheckCircle2,
    FileText,
    Loader2,
    PieChart,
    Trash2,
    XCircle,
    UploadCloud
} from 'lucide-react'
import { BankReconciliationTable } from './BankReconciliationTable'
import { useStatementCycle } from '../hooks/useStatementCycle'
import { BankStatementFilters } from './components/BankStatementFilters'
import { BankStatementBulkUploadDialog } from './components/BankStatementBulkUploadDialog'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { deleteAllBankStatements } from './actions'

export default function BankReconciliationPage() {
    const [stats, setStats] = useState({
        total_banks: 0,
        statements_uploaded: 0,
        reconciled: 0,
        mismatches: 0
    });
    const [selectedClientTypes, setSelectedClientTypes] = useState([]);
    const [selectedStatementStatuses, setSelectedStatementStatuses] = useState([]);
    const [banks, setBanks] = useState([]);
    const [statementCycleId, setStatementCycleId] = useState(null);
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [showDeleteAll, setShowDeleteAll] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0); // Add refresh key to force refresh

    // FIX: Use the fully-featured hook. It now provides initialized state.
    const {
        loading,
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        searchTerm,
        setSearchTerm,
        fetchInitialData,
    } = useStatementCycle(refreshKey); // Pass refreshKey to force refresh

    const refreshAllData = useCallback(async () => {
        // FIX: The hook now handles the core data fetching.
        const data = await fetchInitialData(selectedYear, selectedMonth);
        if (data) {
            setStats(data.stats || { total_banks: 0, statements_uploaded: 0, reconciled: 0, mismatches: 0 });
            setBanks(data.banks);
            setStatementCycleId(data.cycleId);
        }
    }, [fetchInitialData, selectedYear, selectedMonth]);

    // This useEffect runs once on mount and whenever the date changes.
    useEffect(() => {
        refreshAllData();
    }, [selectedMonth, selectedYear, refreshAllData]);

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

            {loading && !statementCycleId ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-4 gap-2">
                        <Card className="shadow-sm border-blue-100">
                            <div className="p-2 flex items-center gap-2.5">
                                <div className="p-1.5 bg-blue-100/70 text-blue-700 rounded-md shrink-0"><FileText className="h-3.5 w-3.5" /></div>
                                <div className="flex-1"><div className="text-xl font-bold leading-none">{stats.total_banks}</div><p className="text-xs text-muted-foreground mt-0.5">Total Banks</p></div>
                            </div>
                        </Card>
                        <Card className="shadow-sm border-green-100">
                            <div className="p-2 flex items-center gap-2.5">
                                <div className="p-1.5 bg-green-100/70 text-green-700 rounded-md shrink-0"><CheckCircle2 className="h-3.5 w-3.5" /></div>
                                <div className="flex-1"><div className="text-xl font-bold leading-none">{stats.statements_uploaded}</div><p className="text-xs text-muted-foreground mt-0.5">Statements</p></div>
                            </div>
                        </Card>
                        <Card className="shadow-sm border-blue-100">
                            <div className="p-2 flex items-center gap-2.5">
                                <div className="p-1.5 bg-blue-100/70 text-blue-700 rounded-md shrink-0"><PieChart className="h-3.5 w-3.5" /></div>
                                <div className="flex-1"><div className="text-xl font-bold leading-none">{stats.reconciled}</div><p className="text-xs text-muted-foreground mt-0.5">Reconciled</p></div>
                            </div>
                        </Card>
                        <Card className="shadow-sm border-red-100">
                            <div className="p-2 flex items-center gap-2.5">
                                <div className="p-1.5 bg-red-100/70 text-red-700 rounded-md shrink-0"><XCircle className="h-3.5 w-3.5" /></div>
                                <div className="flex-1"><div className="text-xl font-bold leading-none">{stats.mismatches}</div><p className="text-xs text-muted-foreground mt-0.5">Mismatches</p></div>
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md">
                            <div className="flex items-center gap-3">
                                <Input
                                    placeholder="Search companies or banks..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-60"
                                />
                                <MonthYearSelector
                                    selectedMonth={selectedMonth}
                                    selectedYear={selectedYear}
                                    onMonthChange={setSelectedMonth}
                                    onYearChange={setSelectedYear}
                                />
                                <BankStatementFilters
                                    selectedStatementStatuses={selectedStatementStatuses}
                                    onStatementStatusChange={setSelectedStatementStatuses}
                                    selectedClientTypes={selectedClientTypes}
                                    onClientTypeChange={setSelectedClientTypes}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Button 
                                    onClick={() => setShowBulkUpload(true)} 
                                    size="sm" 
                                    className="h-8 flex items-center gap-2"
                                    variant="outline"
                                >
                                    <UploadCloud className="h-4 w-4" /> Bulk Upload
                                </Button>
                                {/* <Button 
                                    onClick={() => setShowDeleteAll(true)} 
                                    size="sm" 
                                    className="h-8 flex items-center gap-2"
                                    variant="destructive"
                                >
                                    <Trash2 className="h-4 w-4" /> Delete All
                                </Button> */}
                            </div>
                        </div>

                        {/* The table now receives initialized props */}
                        <BankReconciliationTable
                            selectedYear={selectedYear}
                            selectedMonth={selectedMonth}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            onStatsChange={refreshAllData}
                            selectedClientTypes={selectedClientTypes}
                            selectedStatementStatuses={selectedStatementStatuses}
                        />

                        {showBulkUpload && (
                            <BankStatementBulkUploadDialog
                                isOpen={showBulkUpload}
                                onClose={() => setShowBulkUpload(false)}
                                banks={banks}
                                cycleMonth={selectedMonth}
                                cycleYear={selectedYear}
                                statementCycleId={statementCycleId}
                                onUploadsComplete={refreshAllData}
                            />
                        )}
                        <DeleteConfirmationDialog
                            isOpen={showDeleteAll}
                            onClose={() => setShowDeleteAll(false)}
                            onConfirm={async () => {
                                const result = await deleteAllBankStatements();
                                if (result.success) {
                                    // Force a complete refresh of the page data
                                    setRefreshKey(prev => prev + 1);
                                    // Also refresh the statement cycle data
                                    await fetchInitialData();
                                }
                                return result;
                            }}
                            title="Delete All Bank Statements"
                            description="Are you sure you want to delete ALL bank statements? This action cannot be undone and will remove all data from the database and storage."
                            confirmText="Delete All Statements"
                        />
                    </div>
                </>
            )}
        </div>
    )
}