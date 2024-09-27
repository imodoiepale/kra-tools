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
                .order('last_checked_at', { ascending: false })
                .limit(50)

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
                Status: {status}
            </p>
            <p className="text-sm text-gray-500">
                {Math.round(progress / 100 * totalCompanies)} out of {totalCompanies} companies checked ({progress.toFixed(1)}%)
            </p>

            <div className="overflow-x-auto">
                <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
                    <Table>
                        <TableCaption>PIN Checker Details Logs</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky top-0 bg-white">#</TableHead>
                                <TableHead className="sticky top-0 bg-white">Company</TableHead>
                                <TableHead className="sticky top-0 bg-white">Income Tax Company Status</TableHead>
                                <TableHead className="sticky top-0 bg-white">VAT Status</TableHead>
                                <TableHead className="sticky top-0 bg-white">PAYE Status</TableHead>
                                <TableHead className="sticky top-0 bg-white">Error</TableHead>
                                <TableHead className="sticky top-0 bg-white">Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log, index) => (
                                <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{log.company_name}</TableCell>
                                    <TableCell>{log.income_tax_company_status}</TableCell>
                                    <TableCell>{log.vat_status}</TableCell>
                                    <TableCell>{log.paye_status}</TableCell>
                                    <TableCell>{log.error_message}</TableCell>
                                    <TableCell>{new Date(log.last_checked_at).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}