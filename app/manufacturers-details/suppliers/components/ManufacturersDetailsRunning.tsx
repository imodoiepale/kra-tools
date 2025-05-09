// components/ManufacturersDetailsRunning.tsx
"use client";

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

interface ManufacturersDetailsRunningProps {
    onComplete: () => void
    shouldStop: boolean
}

export function ManufacturersDetailsRunning({ onComplete, shouldStop }: ManufacturersDetailsRunningProps) {
    const [progress, setProgress] = useState(0)
    const [totalCompanies, setTotalCompanies] = useState(0)
    const [logs, setLogs] = useState<any[]>([])

    useEffect(() => {
        const fetchProgress = async () => {
            const { count } = await supabase
                .from('ManufacturersDetails')
                .select('*', { count: 'exact' })

            setTotalCompanies(count || 0)

            const channel = supabase
                .channel('table-db-changes')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'ManufacturersDetails',
                    },
                    (payload) => {
                        setProgress(prev => prev + 1)
                        setLogs(prevLogs => {
                            const newLog = {
                                company_name: payload.new.company_name,
                                kra_pin: payload.new.kra_pin,
                                manufacturer_name: payload.new.manufacturer_name,
                                timestamp: new Date().toLocaleString(),
                            }
                            return [...prevLogs, newLog]
                        })
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }

        fetchProgress()
    }, [])

    useEffect(() => {
        if (progress === totalCompanies && totalCompanies > 0) {
            onComplete()
        }
    }, [progress, totalCompanies, onComplete])

    const percentComplete = totalCompanies > 0 ? (progress / totalCompanies) * 100 : 0

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Manufacturers Details Check in Progress</h3>
            <Progress value={percentComplete} className="w-full" />
            <p className="text-sm text-gray-500">
                {progress} out of {totalCompanies} companies checked ({percentComplete.toFixed(1)}%)
            </p>

            <div className="overflow-x-auto">
                <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
                    <Table>
                        <TableCaption>Manufacturers Details Check Logs</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky top-0 bg-white">#</TableHead>
                                <TableHead className="sticky top-0 bg-white">Company</TableHead>
                                <TableHead className="sticky top-0 bg-white">KRA PIN</TableHead>
                                <TableHead className="sticky top-0 bg-white">Manufacturer Name</TableHead>
                                <TableHead className="sticky top-0 bg-white">Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log, index) => (
                                <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{log.company_name}</TableCell>
                                    <TableCell>{log.kra_pin}</TableCell>
                                    <TableCell>{log.manufacturer_name}</TableCell>
                                    <TableCell>{log.timestamp}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}