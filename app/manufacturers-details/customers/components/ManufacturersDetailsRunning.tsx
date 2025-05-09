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
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2 } from "lucide-react"

interface ManufacturersDetailsRunningProps {
    onComplete: () => void
    shouldStop: boolean
}

interface LogEntry {
    kra_pin: string
    status: 'success' | 'error'
    message: string
    errorCode?: string
    timestamp: string
}

export function ManufacturersDetailsRunning({ onComplete, shouldStop }: ManufacturersDetailsRunningProps) {
    const [progress, setProgress] = useState(0)
    const [totalPins, setTotalPins] = useState(0)
    const [logs, setLogs] = useState<LogEntry[]>([])

    useEffect(() => {
        const channel = supabase
            .channel('kra-verification-logs')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'kra_verification_logs',
                },
                (payload: any) => {
                    const data = payload.new;
                    
                    // Parse the response data
                    let status: 'success' | 'error' = 'error';
                    let message = '';
                    let errorCode = '';

                    if (data.response && typeof data.response === 'object') {
                        if (data.response.data && Array.isArray(data.response.data)) {
                            const responseData = data.response.data[0];
                            if (responseData.errorDto) {
                                status = 'error';
                                message = responseData.errorDto.msg || 'Unknown error';
                                errorCode = responseData.errorDto.errorCode;
                            } else if (responseData.isError === "true") {
                                status = 'error';
                                message = 'Verification failed';
                            } else {
                                status = 'success';
                                message = 'Verification successful';
                            }
                        }
                    }

                    setLogs(prevLogs => {
                        const newLog: LogEntry = {
                            kra_pin: data.kra_pin,
                            status,
                            message,
                            errorCode,
                            timestamp: new Date().toLocaleString()
                        };
                        return [...prevLogs, newLog];
                    });

                    setProgress(prev => prev + 1);
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    useEffect(() => {
        if (progress === totalPins && totalPins > 0) {
            onComplete()
        }
    }, [progress, totalPins, onComplete])

    const percentComplete = totalPins > 0 ? (progress / totalPins) * 100 : 0

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">KRA PIN Verification Progress</h3>
            <Progress value={percentComplete} className="w-full" />
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                    {progress} out of {totalPins} PINs verified ({percentComplete.toFixed(1)}%)
                </p>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <Badge variant="success" className="bg-green-100 text-green-800">
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            {logs.filter(log => log.status === 'success').length} Successful
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="bg-red-100 text-red-800">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {logs.filter(log => log.status === 'error').length} Failed
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
                    <Table>
                        <TableCaption>KRA PIN Verification Logs</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky top-0 bg-white">#</TableHead>
                                <TableHead className="sticky top-0 bg-white">KRA PIN</TableHead>
                                <TableHead className="sticky top-0 bg-white">Status</TableHead>
                                <TableHead className="sticky top-0 bg-white">Message</TableHead>
                                <TableHead className="sticky top-0 bg-white">Error Code</TableHead>
                                <TableHead className="sticky top-0 bg-white">Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log, index) => (
                                <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-mono">{log.kra_pin}</TableCell>
                                    <TableCell>
                                        <Badge 
                                            variant={log.status === 'success' ? 'success' : 'destructive'}
                                            className={log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                                        >
                                            {log.status === 'success' ? 
                                                <CheckCircle2 className="w-4 h-4 mr-1" /> : 
                                                <AlertCircle className="w-4 h-4 mr-1" />
                                            }
                                            {log.status.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{log.message}</TableCell>
                                    <TableCell>{log.errorCode || '-'}</TableCell>
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