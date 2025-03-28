// @ts-nocheck
import { MonthYearSelector } from './MonthYearSelector'
import { CategoryFilters } from './CategoryFilters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TableControlsProps {
    selectedYear: number
    selectedMonth: number
    searchTerm: string
    selectedCategories: string[]
    visibleColumns: string[]
    onYearChange: (year: number) => void
    onMonthChange: (month: number) => void
    onSearchChange: (term: string) => void
    onCategoryChange: (categories: string[]) => void
    onColumnVisibilityChange: (columns: string[]) => void
    onExport: () => void
    onExtractAll: () => void
    currentTab: 'payslip-payment-receipts' | 'tax-payment-slips'
}

export function TableControls({
    selectedYear,
    selectedMonth,
    searchTerm,
    selectedCategories,
    visibleColumns,
    onYearChange,
    onMonthChange,
    onSearchChange,
    onCategoryChange,
    onColumnVisibilityChange,
    onExport,
    onExtractAll,
    currentTab
}: TableControlsProps) {
    return (
        <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
                <MonthYearSelector
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    onYearChange={onYearChange}
                    onMonthChange={onMonthChange}
                />
                <Input
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="max-w-sm"
                />
                <Button onClick={onExport}>Export</Button>
                <Button onClick={onExtractAll}>Extract All</Button>
            </div>
            <CategoryFilters
                selectedCategories={selectedCategories}
                onCategoryChange={onCategoryChange}
                currentTab={currentTab}
            />
        </div>
    )
}
