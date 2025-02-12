// components/payroll/MonthSelector.tsx
import { format, parse, eachMonthOfInterval, subMonths } from 'date-fns'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

interface MonthSelectorProps {
    value: string
    onChange: (value: string) => void
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
    const months = eachMonthOfInterval({
        start: subMonths(new Date(), 11),
        end: new Date(),
    })

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-[180px]">
                <SelectValue>
                    {format(parse(value, 'yyyy-MM', new Date()), 'MMMM yyyy')}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {months.map((date) => {
                    const value = format(date, 'yyyy-MM')
                    return (
                        <SelectItem key={value} value={value}>
                            {format(date, 'MMMM yyyy')}
                        </SelectItem>
                    )
                })}
            </SelectContent>
        </Select>
    )
}