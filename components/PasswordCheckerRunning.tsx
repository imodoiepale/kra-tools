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

interface PasswordCheckerRunningProps {
    onComplete: () => void
}

export function PasswordCheckerRunning({ onComplete }: PasswordCheckerRunningProps) {
    const [progress, setProgress] = useState(0)
    const [totalCompanies, setTotalCompanies] = useState(0)
    const [logs, setLogs] = useState<any[]>([]) // State for logging

    useEffect(() => {
        const fetchProgress = async () => {
            const { count } = await supabase
                .from('PasswordChecker')
                .select('*', { count: 'exact' })

            setTotalCompanies(count || 0)

            const channel = supabase
                .channel('table-db-changes')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'PasswordChecker',
                    },
                    (payload) => {
                        if (payload.new.status !== 'Pending') {
                            setProgress(prev => prev + 1)
                            // Add log entry
                            setLogs(prevLogs => {
                                const newLog = {
                                    company_name: payload.new.company_name,
                                    kra_pin: payload.new.kra_pin,
                                    kra_password: payload.new.kra_password,                                    status: payload.new.status,
                                    timestamp: new Date().toLocaleString(),
                                }
                                console.log('New log entry:', newLog)
                                return [...prevLogs, newLog]
                            })
                        }
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
            <h3 className="text-lg font-medium">Password Check in Progress</h3>
            <Progress value={percentComplete} className="w-full" />
            <p className="text-sm text-gray-500">
                {progress} out of {totalCompanies} companies checked ({percentComplete.toFixed(1)}%)
            </p>

            <div className="overflow-x-auto">
                <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
                    <Table>
                        <TableCaption>Password Check Logs</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky top-0 bg-white">#</TableHead>
                                <TableHead className="sticky top-0 bg-white">Company</TableHead>
                                <TableHead className="sticky top-0 bg-white">KRA PIN</TableHead>
                                <TableHead className="sticky top-0 bg-white">Password</TableHead>
                                <TableHead className="sticky top-0 bg-white">Status</TableHead>
                                <TableHead className="sticky top-0 bg-white">Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log, index) => (
                                <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{log.company_name}</TableCell>
                                    <TableCell>{log.kra_pin}</TableCell>
                                    <TableCell>{log.kra_password}</TableCell>
                                    <TableCell>{log.status}</TableCell>
                                    <TableCell>{log.timestamp}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <style jsx>{`
                .overflow-x-auto {
                    overflow-x: auto
                }
                .overflow-y-auto {
                    overflow-y: auto
                }
                .max-h-[calc(100vh-300px)] {
                    max-height: calc(100vh - 300px)
                }
                .sticky {
                    position: sticky
                    top: 0
                    z-index: 10
                }
            `}</style>
        </div>
    )
}
