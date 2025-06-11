// @ts-nocheck
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface MonthYearSelectorProps {
    selectedYear: number | null | undefined;
    selectedMonth: number | null | undefined;
    onYearChange: (year: number) => void;
    onMonthChange: (month: number) => void;
}

const years = Array.from(
    { length: new Date().getFullYear() - 2014 },
    (_, i) => 2015 + i
).reverse(); // Show most recent years first

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export function MonthYearSelector({
    selectedYear,
    selectedMonth,
    onYearChange,
    onMonthChange
}: MonthYearSelectorProps) {
    // Check if the props are ready. If not, you could render a loading state,
    // but providing a fallback value to `.toString()` is cleaner and sufficient here.
    const monthValue = selectedMonth !== null && selectedMonth !== undefined ? selectedMonth.toString() : "";
    const yearValue = selectedYear !== null && selectedYear !== undefined ? selectedYear.toString() : "";

    return (
        <div className="flex gap-2">
            <Select
                value={monthValue}
                onValueChange={(value) => onMonthChange(parseInt(value, 10))}
                disabled={monthValue === ""} // Optionally disable if no value
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                    {months.map((month, index) => (
                        <SelectItem key={month} value={index.toString()}>
                            {month}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select
                value={yearValue}
                onValueChange={(value) => onYearChange(parseInt(value, 10))}
                disabled={yearValue === ""} // Optionally disable if no value
            >
                <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                    {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                            {year}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}