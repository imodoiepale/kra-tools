// @ts-nocheck
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface MonthYearSelectorProps {
    selectedYear: number;
    selectedMonth: number;
    onYearChange: (year: number) => void;
    onMonthChange: (month: number) => void;
}

const years = Array.from(
    { length: new Date().getFullYear() - 2014 },
    (_, i) => 2015 + i
);

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
    return (
        <div className="flex gap-2">
            <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => onMonthChange(parseInt(value))}
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
                value={selectedYear.toString()}
                onValueChange={(value) => onYearChange(parseInt(value))}
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