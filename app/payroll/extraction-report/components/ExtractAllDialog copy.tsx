// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { CompanyPayrollRecord } from '../../types'
import { processAllDocuments, ExtractionResult, TAX_TYPES, formatAmount } from '@/lib/extractionUtils'

interface ExtractAllDialogProps {
    isOpen: boolean
    onClose: () => void
    records: CompanyPayrollRecord[]
    setPayrollRecords: (records: CompanyPayrollRecord[]) => void
}

export function ExtractAllDialog({
    isOpen,
    onClose,
    records,
    setPayrollRecords
}: ExtractAllDialogProps) {
    const { toast } = useToast()
    const [processing, setProcessing] = useState(false)
    const [results, setResults] = useState<ExtractionResult[]>([])
    const [selectedRecords, setSelectedRecords] = useState<CompanyPayrollRecord[]>([])
    const [loadExisting, setLoadExisting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            loadExistingRecords();
        }
    }, [isOpen]);

    const loadExistingRecords = async () => {
        // Fetch existing records from the database or API
        const existingRecords = await fetchRecords();
        setPayrollRecords(existingRecords);
        setSelectedRecords(existingRecords); // Select all by default
    };

    const handleSelectionChange = (record: CompanyPayrollRecord) => {
        setSelectedRecords(prev => 
            prev.includes(record) ? prev.filter(r => r !== record) : [...prev, record]
        );
    };

    const handleExtractAll = async () => {
        try {
            setProcessing(true)
            setResults([])

            const toExtract = loadExisting ? selectedRecords : records;
            await processAllDocuments(toExtract, (newResults) => {
                setResults(newResults)
            })

            toast({
                title: "Success",
                description: "All documents have been processed"
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to process documents",
                variant: "destructive"
            })
        } finally {
            setProcessing(false)
        }
    }

    const getStatusIcon = (status: ExtractionResult['status']) => {
        switch (status) {
            case 'processing':
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            case 'success':
                return <CheckCircle className="h-4 w-4 text-green-500" />
            case 'error':
                return <AlertCircle className="h-4 w-4 text-red-500" />
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-7xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Extract All Documents</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 z-10">
                            <TableRow className="hover:bg-transparent">
                                <TableHead
                                    rowSpan={2}
                                    className="border-r border-b border-gray-200 bg-blue-600 text-white font-semibold min-w-[200px] whitespace-nowrap"
                                >
                                    Company
                                </TableHead>
                                {TAX_TYPES.map(tax => (
                                    <TableHead
                                        key={tax.id}
                                        colSpan={4}
                                        className={`text-center text-white font-semibold ${tax.color} border-r border-b`}
                                    >
                                        {tax.label}
                                    </TableHead>
                                ))}
                                <TableHead
                                    rowSpan={2}
                                    className="border-r border-b border-gray-200 bg-blue-600 text-white font-semibold"
                                >
                                    Actions
                                </TableHead>
                            </TableRow>
                            <TableRow className="hover:bg-transparent">
                                {TAX_TYPES.map((tax) => (
                                    <React.Fragment key={tax.id}>
                                        <TableHead className="border-r bg-gray-100 text-gray-900 font-medium whitespace-nowrap min-w-[120px]">Amount</TableHead>
                                        <TableHead className="border-r bg-gray-100 text-gray-900 font-medium whitespace-nowrap min-w-[120px]">Payment Mode</TableHead>
                                        <TableHead className="border-r bg-gray-100 text-gray-900 font-medium whitespace-nowrap min-w-[120px]">Payment Date</TableHead>
                                        <TableHead className="border-r bg-gray-100 text-gray-900 font-medium whitespace-nowrap min-w-[80px]">Status</TableHead>
                                    </React.Fragment>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records.map((record, index) => {
                                return (
                                    <TableRow
                                        key={record.id}
                                        className={`
                                            ${index % 2 === 0 ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'}
                                            [&>td]:border-r [&>td]:border-gray-200 last:[&>td]:border-r-0
                                        `}
                                    >
                                        <TableCell className="font-medium truncate max-w-[200px]" title={record.company.company_name}>
                                            <Checkbox
                                                checked={selectedRecords.includes(record)}
                                                onChange={() => handleSelectionChange(record)}
                                            />
                                            {record.company.company_name}
                                        </TableCell>
                                        {TAX_TYPES.map(tax => {
                                            const slipType = `${tax.id}_slip` as keyof typeof record.payment_slips_extractions
                                            const extractedData = record.payment_slips_extractions?.[slipType]
                                            const result = results.find(r => r.companyName === record.company.company_name && r.taxType === tax.id)

                                            return (
                                                <>
                                                    <TableCell className="text-right font-mono">
                                                        {extractedData?.amount || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {extractedData?.payment_mode || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center whitespace-nowrap">
                                                        {extractedData?.payment_date || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center">
                                                            {result ? getStatusIcon(result.status) : '-'}
                                                        </div>
                                                        {result?.error && (
                                                            <span className="text-xs text-red-500 mt-1">{result.error}</span>
                                                        )}
                                                    </TableCell>
                                                </>
                                            )
                                        })}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <Checkbox
                        checked={loadExisting}
                        onChange={() => setLoadExisting(!loadExisting)}
                    >Load Existing Entries</Checkbox>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button
                        onClick={handleExtractAll}
                        disabled={processing}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {processing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : 'Extract All'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}