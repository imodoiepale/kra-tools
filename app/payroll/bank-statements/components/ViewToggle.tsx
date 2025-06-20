// app/payroll/bank-statements/components/ViewToggle.tsx
// @ts-nocheck
import { Button } from '@/components/ui/button'
import { Table, List, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function ViewToggle() {
    const pathname = usePathname()
    const isDetailedView = pathname.includes('/detailed')

    return (
        <div className="flex items-center gap-2">
            <Link href="/payroll/bank-statements">
                <Button
                    variant={!isDetailedView ? "default" : "outline"}
                    size="sm"
                    className="flex items-center gap-2"
                >
                    <Table className="h-4 w-4" />
                    Summary View
                </Button>
            </Link>
            <ArrowRight className="h-4 w-4 text-gray-400" />
            <Link href="/payroll/bank-statements/detailed">
                <Button
                    variant={isDetailedView ? "default" : "outline"}
                    size="sm"
                    className="flex items-center gap-2"
                >
                    <List className="h-4 w-4" />
                    Detailed View
                </Button>
            </Link>
        </div>
    )
}