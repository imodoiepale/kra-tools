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
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ManufacturersDetailsRunningProps {
    onComplete: () => void
    shouldStop: boolean
    initialResults?: Array<{
        kra_pin: string
        success: boolean
        data: any
    }>
    initialSummary?: {
        successful: number
        failed: number
    }
}

interface KraResult {
    kra_pin: string
    success: boolean
    data: {
        code?: number
        message?: string
        hint?: string
        isError?: string
        errorDto?: {
            msg: string
            errorCode: string
        }
        timsManBasicRDtlDTO?: {
            manufacturerBrNo: string
            manufacturerName: string
        }
    }[] | {
        code: number
        message: string
        hint: string
    }
}

export function ManufacturersDetailsRunning({ 
    onComplete, 
    shouldStop,
    initialResults,
    initialSummary
}: ManufacturersDetailsRunningProps) {
    const [progress, setProgress] = useState(0)
    const [totalCompanies, setTotalCompanies] = useState(0)
    const [logs, setLogs] = useState<KraResult[]>(initialResults || [])
    const [sortConfig, setSortConfig] = useState<{
        key: string;
        direction: 'ascending' | 'descending';
    }>({ key: '', direction: 'ascending' })
    const [summary, setSummary] = useState({
        successful: initialSummary?.successful || 0,
        failed: initialSummary?.failed || 0,
        totalProcessed: 0,
        lastUpdateTime: new Date().toLocaleString()
    })

    const getStatusMessage = (log: KraResult) => {
        if (Array.isArray(log.data)) {
            if (log.data[0]?.timsManBasicRDtlDTO) {
                return `Retrieved details for ${log.data[0].timsManBasicRDtlDTO.manufacturerName}`
            }
            if (log.data[0]?.errorDto) {
                return log.data[0].errorDto.msg
            }
            if (log.data[0]?.isError === "true") {
                return log.data[0].errorDto?.msg || "Invalid PIN"
            }
        } else if (log.data?.code === 404) {
            return log.data.message
        }
        return "Processing"
    }

    const getStatus = (log: KraResult) => {
        if (Array.isArray(log.data)) {
            return log.data[0]?.timsManBasicRDtlDTO !== undefined
        }
        return false
    }

    useEffect(() => {
        const fetchProgress = async () => {
            // Get initial count of suppliers to process
            const { data: supplierData } = await supabase
                .from('acc_portal_kra_suppliers')
                .select('pin_no')

            setTotalCompanies(supplierData?.length || 0)
            setProgress(initialResults?.length || 0)

            // Listen for webhook results
            const channel = supabase
                .channel('webhook-results')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'webhook_results',
                        filter: 'type=eq.suppliers'
                    },
                    (payload) => {
                        if (payload.new) {
                            setProgress(prev => prev + 1)
                            setLogs(prevLogs => {
                                const newLog = {
                                    kra_pin: payload.new.kra_pin,
                                    success: payload.new.success,
                                    data: payload.new.data,
                                }
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
        
        // Update summary whenever progress changes
        setSummary(prev => ({
            ...prev,
            totalProcessed: progress,
            successful: logs.filter(log => {
                if (Array.isArray(log.data)) {
                    return log.data[0]?.timsManBasicRDtlDTO !== undefined
                }
                return false
            }).length,
            failed: logs.filter(log => !log.success).length,
            lastUpdateTime: new Date().toLocaleString(),
        }))
    }, [progress, totalCompanies, onComplete, logs])

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'ascending' 
                ? 'descending' 
                : 'ascending'
        }))
    }

    const sortedLogs = [...logs].sort((a, b) => {
        if (sortConfig.key === '') return 0

        let aValue: any
        let bValue: any

        switch (sortConfig.key) {
            case 'index':
                return 0 // Keep original order for index
            case 'kra_pin':
                aValue = a.kra_pin
                bValue = b.kra_pin
                break
            case 'status':
                aValue = getStatus(a)
                bValue = getStatus(b)
                break
            case 'message':
                aValue = getStatusMessage(a)
                bValue = getStatusMessage(b)
                break
            case 'timestamp':
                aValue = new Date().toLocaleString()
                bValue = new Date().toLocaleString()
                break
            default:
                return 0
        }

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1
        return 0
    })

    const percentComplete = totalCompanies > 0 ? (progress / totalCompanies) * 100 : 0

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Suppliers Details Check in Progress</h3>
            <Progress value={percentComplete} className="w-full" />
            <p className="text-sm text-gray-500">
                {progress} out of {totalCompanies} suppliers checked ({percentComplete.toFixed(1)}%)
            </p>

            {/* Summary Table */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
                <h4 className="text-md font-medium mb-3">Process Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <p className="text-sm text-gray-500">Successful Checks</p>
                        <p className="text-lg font-semibold text-green-600">{summary.successful}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-gray-500">Failed Checks</p>
                        <p className="text-lg font-semibold text-red-600">{summary.failed}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-gray-500">Total Processed</p>
                        <p className="text-lg font-semibold">{summary.totalProcessed}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-gray-500">Last Update</p>
                        <p className="text-sm">{summary.lastUpdateTime}</p>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
                    <Table>
                        <TableCaption>Suppliers Details Check Results</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky top-0 bg-white">
                                    <Button variant="ghost" onClick={() => handleSort('index')} className="h-8 p-0">
                                        #
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                <TableHead className="sticky top-0 bg-white">
                                    <Button variant="ghost" onClick={() => handleSort('kra_pin')} className="h-8 p-0">
                                        KRA PIN
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                <TableHead className="sticky top-0 bg-white">
                                    <Button variant="ghost" onClick={() => handleSort('status')} className="h-8 p-0">
                                        Status
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                <TableHead className="sticky top-0 bg-white">
                                    <Button variant="ghost" onClick={() => handleSort('message')} className="h-8 p-0">
                                        Message
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                <TableHead className="sticky top-0 bg-white">
                                    <Button variant="ghost" onClick={() => handleSort('timestamp')} className="h-8 p-0">
                                        Timestamp
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedLogs.map((log, index) => (
                                <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{log.kra_pin}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                            getStatus(log) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {getStatus(log) ? 'Success' : 'Failed'}
                                        </span>
                                    </TableCell>
                                    <TableCell>{getStatusMessage(log)}</TableCell>
                                    <TableCell>{new Date().toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}