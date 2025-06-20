// app/payroll/bank-statements/page.tsx
// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    CheckCircle2,
    FileText,
    Loader2,
    PieChart,
    Trash2,
    XCircle,
    UploadCloud,
    Table,
    List,
    Filter
} from 'lucide-react'
import { BankReconciliationTable } from './components/BankReconciliationTable'
import { DetailedBankStatementsView } from './components/DetailedBankStatementsView'
import { useStatementCycle } from '../hooks/useStatementCycle'
import { BankStatementFilters } from './components/BankStatementFilters'
import { BankStatementBulkUploadDialog } from './components/BankStatementBulkUploadDialog'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { deleteAllBankStatements } from './utils/actions'

const CLIENT_TYPES = [
    { key: 'acc', label: 'Accounting' },
    { key: 'audit', label: 'Audit' },
    { key: 'sheria', label: 'Legal' },
    { key: 'imm', label: 'Immigration' }
]

export default function BankReconciliationPage() {
    const [activeView, setActiveView] = useState<'summary' | 'detailed'>('summary')
    const [stats, setStats] = useState({
        total_banks: 0,
        statements_uploaded: 0,
        reconciled: 0,
        mismatches: 0
    });

    // Filters
    const [selectedClientTypes, setSelectedClientTypes] = useState([]);
    const [selectedStatementStatuses, setSelectedStatementStatuses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Date range for detailed view
    const [dateRange, setDateRange] = useState({
        fromMonth: new Date().getMonth(),
        fromYear: new Date().getFullYear(),
        toMonth: new Date().getMonth(),
        toYear: new Date().getFullYear()
    });

    // Core state
    const [banks, setBanks] = useState([]);
    const [statementCycleId, setStatementCycleId] = useState(null);
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [showDeleteAll, setShowDeleteAll] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // FIX: Add state for upload dialog context
    const [selectedBankForUpload, setSelectedBankForUpload] = useState(null);
    const [uploadDialogMonth, setUploadDialogMonth] = useState(null);
    const [uploadDialogYear, setUploadDialogYear] = useState(null);

    const {
        loading,
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        fetchInitialData,
    } = useStatementCycle(refreshKey);

    const refreshAllData = useCallback(async () => {
        const data = await fetchInitialData(selectedYear, selectedMonth);
        if (data) {
            setStats(data.stats || { total_banks: 0, statements_uploaded: 0, reconciled: 0, mismatches: 0 });
            setBanks(data.banks);
            setStatementCycleId(data.cycleId);
        }
    }, [fetchInitialData, selectedYear, selectedMonth]);

    useEffect(() => {
        refreshAllData();
    }, [selectedMonth, selectedYear, refreshAllData]);

    // FIX: Proper month handling with 0-based indexing
    const handleBulkUploadOpen = () => {
        setSelectedBankForUpload(null);
        setUploadDialogMonth(selectedMonth);
        setUploadDialogYear(selectedYear);
        setShowBulkUpload(true);
    };

    // FIX: Upload click handler with proper month/year passing
    const handleUploadClick = (bank: any, month?: number, year?: number) => {
        const adjustedMonth = typeof month === 'number' ? month : selectedMonth;
        const adjustedYear = typeof year === 'number' ? year : selectedYear;

        setSelectedBankForUpload(bank);
        setUploadDialogMonth(adjustedMonth);
        setUploadDialogYear(adjustedYear);
        setShowBulkUpload(true);
    };

    // FIX: Month options with proper 0-based indexing
    const generateMonthOptions = () => {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months.map((month, index) => ({
            value: index,  // 0-based index for internal use
            label: month,  // Display name
            monthNumber: index + 1  // 1-based for display/API if needed
        }));
    };

    const generateYearOptions = () => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let i = currentYear; i >= currentYear - 10; i--) {
            years.push({ value: i, label: i.toString() });
        }
        return years;
    };

    // FIX: Handle upload completion
    const handleUploadsComplete = () => {
        setShowBulkUpload(false);
        setSelectedBankForUpload(null);
        setUploadDialogMonth(null);
        setUploadDialogYear(null);
        refreshAllData();
    };

    return (
        <div className="py-6 space-y-6 p-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-xl font-bold tracking-tight">Bank Statements and Reconciliation</p>
                    <p className="text-muted-foreground text-md">
                        Manage and reconcile bank statements with QuickBooks data
                    </p>
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
                    <Button
                        variant={activeView === 'summary' ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setActiveView('summary')}
                        className="flex items-center gap-2"
                    >
                        <Table className="h-4 w-4" />
                        Summary View
                    </Button>
                    <Button
                        variant={activeView === 'detailed' ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setActiveView('detailed')}
                        className="flex items-center gap-2"
                    >
                        <List className="h-4 w-4" />
                        Detailed View
                    </Button>
                </div>
            </div>

            {loading && !statementCycleId ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-4 gap-2">
                        <Card className="shadow-sm border-blue-100">
                            <div className="p-2 flex items-center gap-2.5">
                                <div className="p-1.5 bg-blue-100/70 text-blue-700 rounded-md shrink-0">
                                    <FileText className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xl font-bold leading-none">{stats.total_banks}</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">Total Banks</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="shadow-sm border-green-100">
                            <div className="p-2 flex items-center gap-2.5">
                                <div className="p-1.5 bg-green-100/70 text-green-700 rounded-md shrink-0">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xl font-bold leading-none">{stats.statements_uploaded}</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">Statements</p>
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
                            </div>
                        </Card>
                    </div>

                    {/* Filters and Controls */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md">
                            <div className="flex items-center gap-3 flex-wrap">
                                <Input
                                    placeholder="Search companies or banks..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-60"
                                />

                                {/* Date Range Selectors - FIX: Conditional rendering based on view */}
                                {activeView === 'detailed' ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">From:</span>
                                        <Select
                                            value={dateRange.fromMonth.toString()}
                                            onValueChange={(value) => setDateRange(prev => ({ ...prev, fromMonth: parseInt(value) }))}
                                        >
                                            <SelectTrigger className="w-32">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {generateMonthOptions().map(month => (
                                                    <SelectItem key={month.value} value={month.value.toString()}>
                                                        {month.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={dateRange.fromYear.toString()}
                                            onValueChange={(value) => setDateRange(prev => ({ ...prev, fromYear: parseInt(value) }))}
                                        >
                                            <SelectTrigger className="w-24">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {generateYearOptions().map(year => (
                                                    <SelectItem key={year.value} value={year.value.toString()}>
                                                        {year.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <span className="text-sm font-medium">To:</span>
                                        <Select
                                            value={dateRange.toMonth.toString()}
                                            onValueChange={(value) => setDateRange(prev => ({ ...prev, toMonth: parseInt(value) }))}
                                        >
                                            <SelectTrigger className="w-32">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {generateMonthOptions().map(month => (
                                                    <SelectItem key={month.value} value={month.value.toString()}>
                                                        {month.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={dateRange.toYear.toString()}
                                            onValueChange={(value) => setDateRange(prev => ({ ...prev, toYear: parseInt(value) }))}
                                        >
                                            <SelectTrigger className="w-24">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {generateYearOptions().map(year => (
                                                    <SelectItem key={year.value} value={year.value.toString()}>
                                                        {year.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : (
                                    // FIX: Summary view month/year selectors
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Period:</span>
                                        <Select
                                            value={selectedMonth.toString()}
                                            onValueChange={(value) => setSelectedMonth(parseInt(value))}
                                        >
                                            <SelectTrigger className="w-32">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {generateMonthOptions().map(month => (
                                                    <SelectItem key={month.value} value={month.value.toString()}>
                                                        {month.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={selectedYear.toString()}
                                            onValueChange={(value) => setSelectedYear(parseInt(value))}
                                        >
                                            <SelectTrigger className="w-24">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {generateYearOptions().map(year => (
                                                    <SelectItem key={year.value} value={year.value.toString()}>
                                                        {year.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Statement Filters */}
                                <BankStatementFilters
                                    selectedStatementStatuses={selectedStatementStatuses}
                                    onStatementStatusChange={setSelectedStatementStatuses}
                                    selectedClientTypes={selectedClientTypes}
                                    onClientTypeChange={setSelectedClientTypes}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={handleBulkUploadOpen}
                                    size="sm"
                                    className="h-8 flex items-center gap-2"
                                    variant="outline"
                                >
                                    <UploadCloud className="h-4 w-4" />
                                    Bulk Upload
                                </Button>

                                {/* FIX: Optional delete all button - uncomment if needed */}
                                {/* <Button
                                    onClick={() => setShowDeleteAll(true)}
                                    size="sm"
                                    className="h-8 flex items-center gap-2"
                                    variant="destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete All
                                </Button> */}
                            </div>
                        </div>

                        {/* Main Content - FIX: Pass proper props including upload handlers */}
                        {activeView === 'summary' ? (
                            <BankReconciliationTable
                                selectedYear={selectedYear}
                                selectedMonth={selectedMonth}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                onStatsChange={refreshAllData}
                                selectedClientTypes={selectedClientTypes}
                                selectedStatementStatuses={selectedStatementStatuses}
                                // FIX: Pass upload handler to summary view
                                onUploadClick={handleUploadClick}
                            />
                        ) : (
                            <DetailedBankStatementsView
                                searchTerm={searchTerm}
                                dateRange={dateRange}
                                selectedClientTypes={selectedClientTypes}
                                onRefresh={refreshAllData}
                                // FIX: Pass additional props for detailed view
                                banks={banks}
                                refreshData={refreshAllData}
                                selectedMonth={selectedMonth}
                                selectedYear={selectedYear}
                                cycleMonth={selectedMonth}
                                cycleYear={selectedYear}
                                statementCycleId={statementCycleId}
                                onUploadClick={handleUploadClick}
                            />
                        )}

                        {/* Dialogs - FIX: Proper props with correct month/year */}
                        {showBulkUpload && (
                            <BankStatementBulkUploadDialog
                                isOpen={showBulkUpload}
                                onClose={() => setShowBulkUpload(false)}
                                banks={banks}
                                // FIX: Use the upload dialog specific month/year or fallback to selected
                                cycleMonth={uploadDialogMonth !== null ? uploadDialogMonth : selectedMonth}
                                cycleYear={uploadDialogYear !== null ? uploadDialogYear : selectedYear}
                                statementCycleId={statementCycleId}
                                onUploadsComplete={handleUploadsComplete}
                                // FIX: Pass selected bank if uploading for specific bank
                                selectedBank={selectedBankForUpload}
                            />
                        )}

                        <DeleteConfirmationDialog
                            isOpen={showDeleteAll}
                            onClose={() => setShowDeleteAll(false)}
                            onConfirm={async () => {
                                const result = await deleteAllBankStatements();
                                if (result.success) {
                                    setRefreshKey(prev => prev + 1);
                                    await refreshAllData();
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