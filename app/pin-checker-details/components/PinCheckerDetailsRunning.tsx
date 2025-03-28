// components/PinCheckerDetailsRunning.tsx
// @ts-nocheck
import { useEffect, useState } from 'react'
import { Progress } from "@/components/ui/progress"
import { supabase } from '@/lib/supabase'
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface PinCheckerDetailsRunningProps {
    onComplete: () => void
    progress: number
    status: string
}

const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case 'registered':
            return 'text-green-800 font-semibold';
        case 'no obligation':
            return 'text-yellow-800';
        case 'cancelled':
            return 'text-red-800 font-semibold';
        default:
            return 'text-gray-800'; 
    }
}

const getColumnColor = (columnIndex: number) => {
    const colors = [
        'bg-blue-50',
        'bg-green-50',
        'bg-yellow-50',
        'bg-purple-50',
        'bg-pink-50',
        'bg-indigo-50',
        'bg-orange-50',
        'bg-teal-50',
        'bg-amber-50',
    ];
    return colors[columnIndex % colors.length];
}

export function PinCheckerDetailsRunning({ onComplete, progress, status }: PinCheckerDetailsRunningProps) {
    const [logs, setLogs] = useState([])
    const [totalCompanies, setTotalCompanies] = useState(0)

    useEffect(() => {
        const fetchTotalCompanies = async () => {
            const { count } = await supabase
                .from('PasswordChecker')
                .select('*', { count: 'exact' })

            setTotalCompanies(count || 0)
        }

        fetchTotalCompanies()

        const fetchLogs = async () => {
            const { data, error } = await supabase
                .from('PinCheckerDetails')
                .select('*')
                .order('last_checked_at', { ascending: true })
                .limit(500)

            if (data) {
                setLogs(data)
            }
        }

        fetchLogs()

        const channel = supabase
            .channel('table-db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'PinCheckerDetails',
                },
                (payload) => {
                    setLogs(prevLogs => [payload.new, ...prevLogs.slice(0, 49)])
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    useEffect(() => {
        if (status === "Completed") {
            onComplete()
        }
    }, [status, onComplete])

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">PIN Checker Details in Progress</h3>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-500">
                Status: <span className={getStatusColor(status)}>{status}</span>
            </p>
            <p className="text-sm text-gray-500">
                {Math.round(progress / 100 * totalCompanies)} out of {totalCompanies} companies checked ({progress.toFixed(1)}%)
            </p>

            <div className="overflow-x-auto mb-6">
                <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
                    <Table>
                        <TableCaption>PIN Checker Details Logs</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky top-0 bg-gray-100">#</TableHead>
                                <TableHead className="sticky top-0 bg-gray-100">Company</TableHead>
                                <TableHead className="sticky top-0 bg-gray-100">Income Tax Company Status</TableHead>
                                <TableHead className="sticky top-0 bg-gray-100">VAT Status</TableHead>
                                <TableHead className="sticky top-0 bg-gray-100">PAYE Status</TableHead>
                                <TableHead className="sticky top-0 bg-gray-100">MRI Status</TableHead>
                                <TableHead className="sticky top-0 bg-gray-100">Resident Individual status</TableHead>
                                <TableHead className="sticky top-0 bg-gray-100">Turnover Tax Status</TableHead>
                                <TableHead className="sticky top-0 bg-gray-100">Error</TableHead>
                                <TableHead className="sticky top-0 bg-gray-100">Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log, index) => (
                                <TableRow key={index}>
                                    <TableCell className={getColumnColor(0)}>{index + 1}</TableCell>
                                    <TableCell >{log.company_name}</TableCell>
                                    <TableCell className={` text-center ${getColumnColor(2)} ${getStatusColor(log.income_tax_company_status)}`}>
                                        {log.income_tax_company_status}
                                    </TableCell>
                                    <TableCell className={`${getColumnColor(3)} ${getStatusColor(log.vat_status)}`}>
                                        {log.vat_status}
                                    </TableCell>
                                    <TableCell className={`${getColumnColor(4)} ${getStatusColor(log.paye_status)}`}>
                                        {log.paye_status}
                                    </TableCell>
                                    <TableCell className={`${getColumnColor(5)} ${getStatusColor(log.rent_income_mri_status)}`}>
                                        {log.rent_income_mri_status}
                                    </TableCell>
                                    <TableCell className={`${getColumnColor(6)} ${getStatusColor(log.resident_individual_status)}`}>
                                        {log.turnover_tax_status}
                                    </TableCell>
                                    <TableCell className={`${getColumnColor(6)} ${getStatusColor(log.turnover_tax_status)}`}>
                                        {log.turnover_tax_status}
                                    </TableCell>
                                    <TableCell className={`${getColumnColor(7)} text-red-800`}>{log.error_message}</TableCell>
                                    <TableCell className={getColumnColor(8)}>{new Date(log.last_checked_at).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}