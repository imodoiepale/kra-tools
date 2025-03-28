// @ts-nocheck
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { Loader2, AlertCircle, CheckCircle, Eye, RotateCw, ChevronDown, ChevronUp } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { MonthYearSelector } from '../../components/MonthYearSelector'
import { CompanyPayrollRecord } from '../../types'
import { processAllDocuments, ExtractionResult, TAX_TYPES } from '@/lib/extractionUtils'
import { supabase } from '@/lib/supabase'

import { ExtractAllPreviewExtractionDialog } from './extraction-report/components/ExtractAllPreviewExtractionDialog'

const EXTRACTION_FIELDS = [
    { name: 'amount', type: 'string', required: true },
    { name: 'payment_date', type: 'date', required: true },
    { name: 'payment_mode', type: 'string', required: true },
    { name: 'bank_name', type: 'string', required: false }
];

const EXTRACTION_MODES = {
    ALL: 'all',
    MISSING: 'missing',
    FAILED: 'failed'
};

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
    const [progress, setProgress] = useState(0)
    const [results, setResults] = useState<ExtractionResult[]>([])
    const [selectedRecords, setSelectedRecords] = useState(new Set())
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [sortedRecords, setSortedRecords] = useState([])
    const [filteredRecords, setFilteredRecords] = useState([])
    const [expandedCompanies, setExpandedCompanies] = useState(new Set())
    const [extractionMode, setExtractionMode] = useState(EXTRACTION_MODES.ALL)
    
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
    const [processedDocs, setProcessedDocs] = useState([])
    const [currentCompanyIndex, setCurrentCompanyIndex] = useState(0)
    const [extractionCache, setExtractionCache] = useState(new Map())

    // Stats calculation for summary display
    const stats = useMemo(() => {
        if (!filteredRecords.length) return { total: 0, missing: 0, partial: 0, complete: 0 };

        let missingCount = 0;
        let partialCount = 0;
        let completeCount = 0;
        let totalDocs = 0;

        filteredRecords.forEach(record => {
            TAX_TYPES.forEach(tax => {
                const hasDoc = !!record.payment_receipts_documents?.[tax.receiptType];
                if (hasDoc) {
                    totalDocs++;

                    const extractions = record.payment_receipts_extractions?.[tax.receiptType];
                    if (!extractions) {
                        missingCount++;
                    } else if (!validateExtractionData(extractions)) {
                        partialCount++;
                    } else {
                        completeCount++;
                    }
                }
            });
        });

        return { total: totalDocs, missing: missingCount, partial: partialCount, complete: completeCount };
    }, [filteredRecords]);

    // Filter records based on selected year and month
    useEffect(() => {
        if (isOpen) {
            const sorted = [...records]
                .sort((a, b) => {
                    const nameA = a.company?.company_name || '';
                    const nameB = b.company?.company_name || '';
                    return nameA.localeCompare(nameB);
                })
                .map((record, index) => ({ ...record, index: index + 1 }));

            setSortedRecords(sorted);

            // Filter by selected year and month
            const periodStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
            const filtered = sorted.filter(record => {
                const recordPeriod = record.period || '';
                return recordPeriod.startsWith(periodStr);
            });

            setFilteredRecords(filtered);
            setSelectedRecords(new Set(filtered.map(r => r.id)));

            // Initialize results with existing extractions
            const initialResults = filtered.flatMap(record =>
                TAX_TYPES.map(tax => ({
                    recordId: record.id,
                    companyName: record.company?.company_name || 'Unknown',
                    taxType: tax.id,
                    amount: record.payment_receipts_extractions?.[tax.receiptType]?.amount || null,
                    paymentMode: record.payment_receipts_extractions?.[tax.receiptType]?.payment_mode || null,
                    paymentDate: record.payment_receipts_extractions?.[tax.receiptType]?.payment_date || null,
                    bankName: record.payment_receipts_extractions?.[tax.receiptType]?.bank_name || null,
                    documentPath: record.payment_receipts_documents?.[tax.receiptType] || null,
                    status: record.payment_receipts_extractions?.[tax.receiptType] 
                        ? (validateExtractionData(record.payment_receipts_extractions[tax.receiptType]) ? 'success' : 'partial')
                        : (record.payment_receipts_documents?.[tax.receiptType] ? 'pending' : null)
                }))
            );
            setResults(initialResults);
        }
    }, [isOpen, records, selectedYear, selectedMonth]);

    const handleExtractAll = async () => {
        if (selectedRecords.size === 0) {
            toast({
                title: "No Records Selected",
                description: "Please select at least one record to process",
                variant: "destructive"
            });
            return;
        }

        // Check cache first
        const cacheKey = `${selectedYear}-${selectedMonth}-${Array.from(selectedRecords).join('-')}-${extractionMode}`;
        const cachedResults = extractionCache.get(cacheKey);

        if (cachedResults) {
            setProcessedDocs(cachedResults);
            setCurrentCompanyIndex(0);
            setPreviewDialogOpen(true);
            return;
        }

        setProcessing(true);
        setProgress(0);
        const allProcessedDocs = [];
        const recordsToProcess = filteredRecords.filter(r => selectedRecords.has(r.id));
        let processedCount = 0;

        try {
            // Update all selected records to 'waiting' status
            setResults(prev =>
                prev.map(result =>
                    selectedRecords.has(result.recordId)
                        ? { ...result, status: 'waiting' }
                        : result
                )
            );

            for (const record of recordsToProcess) {
                // Update current record to 'processing' status
                setResults(prev =>
                    prev.map(result =>
                        result.recordId === record.id
                            ? { ...result, status: 'processing' }
                            : result
                    )
                );

                // Gather documents for this company based on extraction mode
                const companyDocs = [];
                for (const tax of TAX_TYPES) {
                    const docPath = record.payment_receipts_documents?.[tax.receiptType];
                    const extractionData = record.payment_receipts_extractions?.[tax.receiptType];

                    // Skip based on extraction mode
                    if (!docPath) continue;
                    if (extractionMode === EXTRACTION_MODES.MISSING && extractionData) continue;
                    if (extractionMode === EXTRACTION_MODES.FAILED && validateExtractionData(extractionData)) continue;

                    // Get document URL
                    try {
                        const { data: { publicUrl } } = await supabase.storage
                            .from('Payroll-Cycle')
                            .getPublicUrl(docPath);

                        if (publicUrl) {
                            companyDocs.push({
                                type: tax.receiptType,
                                url: publicUrl,
                                label: tax.label
                            });
                        }
                    } catch (error) {
                        console.error(`Error getting URL for ${record.company?.company_name} ${tax.label}:`, error);
                    }
                }

                if (companyDocs.length === 0) {
                    setResults(prev =>
                        prev.map(r =>
                            r.recordId === record.id
                                ? { ...r, status: 'skipped', message: 'No eligible documents found' }
                                : r
                        )
                    );

                    processedCount++;
                    setProgress(Math.round((processedCount / recordsToProcess.length) * 100));
                    continue;
                }

                try {
                    // Use performBatchExtraction for all documents of this company
                    const batchResult = await performBatchExtraction(
                        companyDocs,
                        EXTRACTION_FIELDS,
                        'payment_receipt',
                        (message) => console.log(`${record.company?.company_name}: ${message}`)
                    );

                    if (batchResult.success) {
                        const processedDocs = companyDocs.map(doc => ({
                            file: null,
                            type: doc.type,
                            label: doc.label,
                            url: doc.url,
                            extractions: batchResult.extractedData[doc.type]?.extractedData || {
                                amount: null,
                                payment_date: null,
                                payment_mode: null,
                                bank_name: null
                            }
                        }));

                        allProcessedDocs.push({
                            recordId: record.id,
                            companyName: record.company?.company_name || 'Unknown',
                            documents: processedDocs
                        });

                        // Update UI for all tax types of this company
                        setResults(prev =>
                            prev.map(r => {
                                if (r.recordId === record.id) {
                                    const docType = `${r.taxType}_receipt`;
                                    const processedDoc = processedDocs.find(doc => doc.type === docType);

                                    if (processedDoc) {
                                        return {
                                            ...r,
                                            status: 'success',
                                            amount: processedDoc.extractions.amount,
                                            paymentDate: processedDoc.extractions.payment_date,
                                            paymentMode: processedDoc.extractions.payment_mode,
                                            bankName: processedDoc.extractions.bank_name
                                        };
                                    }
                                }
                                return r;
                            })
                        );
                    } else {
                        throw new Error(batchResult.message);
                    }

                } catch (error) {
                    console.error(`Error processing ${record.company?.company_name}:`, error);
                    setResults(prev =>
                        prev.map(r =>
                            r.recordId === record.id
                                ? { ...r, status: 'error', message: error.message }
                                : r
                        )
                    );
                }

                processedCount++;
                setProgress(Math.round((processedCount / recordsToProcess.length) * 100));
            }

            if (allProcessedDocs.length > 0) {
                // Cache the results
                setExtractionCache(prev => new Map(prev).set(cacheKey, allProcessedDocs));
                setProcessedDocs(allProcessedDocs);
                setCurrentCompanyIndex(0);
                setPreviewDialogOpen(true);

                // Show completion toast
                toast({
                    title: "Extraction Complete",
                    description: `Processed ${allProcessedDocs.length} companies. Open the extraction dialog to review and save.`
                });
            } else {
                toast({
                    title: "No Documents Processed",
                    description: "No documents were successfully processed",
                    variant: "warning"
                });
            }

        } catch (error) {
            console.error('Extraction error:', error);
            toast({
                title: "Error",
                description: "Failed to complete extractions",
                variant: "destructive"
            });
        } finally {
            setProcessing(false);
            setProgress(0);
        }
    };

    const validateExtractionData = (data) => {
        if (!data) return false;
        return !!data.amount && !!data.payment_date && !!data.payment_mode;
    };

    const handleSelectionChange = (recordId) => {
        setSelectedRecords(prev => {
            const next = new Set(prev);
            if (next.has(recordId)) {
                next.delete(recordId);
            } else {
                next.add(recordId);
            }
            return next;
        });
    };

    const handleSelectAll = (checked) => {
        setSelectedRecords(new Set(checked ? filteredRecords.map(r => r.id) : []));
    };

    const toggleCompanyExpand = (companyId) => {
        setExpandedCompanies(prev => {
            const next = new Set(prev);
            if (next.has(companyId)) {
                next.delete(companyId);
            } else {
                next.add(companyId);
            }
            return next;
        });
    };

    const handleDocumentUpload = async (recordId: string, file: File, documentType: string) => {
        // Implement the logic to upload the document
        // This function can be similar to the one in PayslipPaymentReceipts
        // Use Supabase or any other service to upload the document
    }

    const handleExtractionsSave = async (recordId, extractions) => {
        try {
            // Fetch current record to get existing extractions
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('payment_receipts_extractions')
                .eq('id', recordId)
                .single();

            if (fetchError) throw fetchError;

            // Merge new extractions with existing ones
            const updatedExtractions = {
                ...(currentRecord?.payment_receipts_extractions || {}),
                ...extractions
            };

            // Update database
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_receipts_extractions: updatedExtractions
                })
                .eq('id', recordId);

            if (updateError) throw updateError;

            // Move to next company
            setCurrentCompanyIndex(prev => {
                const next = prev + 1;
                if (next >= processedDocs.length) {
                    setPreviewDialogOpen(false);
                    onClose();
                    toast({
                        title: "Success",
                        description: "All extractions have been saved"
                    });
                }
                return next;
            });

            setPayrollRecords(prevRecords =>
                prevRecords.map(record =>
                    record.id === recordId
                        ? {
                            ...record,
                            payment_receipts_extractions: {
                                ...record.payment_receipts_extractions,
                                ...extractions
                            }
                        }
                        : record
                )
            );

        } catch (error) {
            console.error('Save error:', error);
            toast({
                title: "Error",
                description: "Failed to save extractions",
                variant: "destructive"
            });
        }
    };

    const handlePreview = async (record, tax) => {
        try {
            const docPath = record.payment_receipts_documents?.[tax.receiptType];
            if (!docPath) {
                toast({
                    title: "Error",
                    description: "No document available to preview",
                    variant: "destructive"
                });
                return;
            }

            const { data: { publicUrl } } = await supabase.storage
                .from('Payroll-Cycle')
                .getPublicUrl(docPath);

            setProcessedDocs([{
                recordId: record.id,
                companyName: record.company?.company_name || 'Unknown',
                documents: [{
                    file: null,
                    type: tax.receiptType,
                    label: tax.label,
                    url: publicUrl,
                    extractions: {
                        amount: record.payment_receipts_extractions?.[tax.receiptType]?.amount || null,
                        payment_date: record.payment_receipts_extractions?.[tax.receiptType]?.payment_date || null,
                        payment_mode: record.payment_receipts_extractions?.[tax.receiptType]?.payment_mode || null,
                        bank_name: record.payment_receipts_extractions?.[tax.receiptType]?.bank_name || null
                    }
                }]
            }]);
            setCurrentCompanyIndex(0);
            setPreviewDialogOpen(true);

        } catch (error) {
            console.error('Preview error:', error);
            toast({
                title: "Error",
                description: "Failed to load document preview",
                variant: "destructive"
            });
        }
    };

    const handleReopenExtraction = () => {
        const cacheKey = `${selectedYear}-${selectedMonth}-${Array.from(selectedRecords).join('-')}-${extractionMode}`;
        const cachedResults = extractionCache.get(cacheKey);

        if (cachedResults) {
            setProcessedDocs(cachedResults);
            setCurrentCompanyIndex(0);
            setPreviewDialogOpen(true);
        } else {
            toast({
                title: "No Cached Data",
                description: "Previous extraction data not found. Please extract again.",
                variant: "warning"
            });
        }
    };

    const getStatusIcon = (status: ExtractionResult['status']) => {
        switch (status) {
            case 'processing':
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            case 'success':
                return <CheckCircle className="h-4 w-4 text-green-500" />
            case 'error':
                return <AlertCircle className="h-4 w-4 text-red-500" />
            case 'waiting':
                return <AlertCircle className="h-4 w-4 text-yellow-500" />
            case 'skipped':
                return <AlertCircle className="h-4 w-4 text-gray-500" />
            case 'partial':
                return <AlertCircle className="h-4 w-4 text-orange-500" />
            default:
                return null
        }
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-7xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <div className="flex justify-between items-center">
                            <DialogTitle>Extract All Documents</DialogTitle>
                            <MonthYearSelector
                                selectedYear={selectedYear}
                                selectedMonth={selectedMonth}
                                onYearChange={setSelectedYear}
                                onMonthChange={setSelectedMonth}
                            />
                        </div>
                    </DialogHeader>

                    <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                            <RadioGroup 
                                value={extractionMode} 
                                onValueChange={(value) => setExtractionMode(value)}
                                className="flex flex-row gap-6"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value={EXTRACTION_MODES.ALL} id="all" />
                                    <Label htmlFor="all">All Documents</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value={EXTRACTION_MODES.MISSING} id="missing" />
                                    <Label htmlFor="missing">Missing Extractions Only</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value={EXTRACTION_MODES.FAILED} id="failed" />
                                    <Label htmlFor="failed">Failed/Incomplete Only</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="flex-1">
                            <div className="flex gap-2 items-center justify-end">
                                <div className="flex gap-1">
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                                        {stats.missing} Missing
                                    </Badge>
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                                        {stats.partial} Partial
                                    </Badge>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                        {stats.complete} Complete
                                    </Badge>
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                        {stats.total} Total
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    {processing && (
                        <div className="mb-4">
                            <p className="text-sm mb-1">Processing documents... {progress}%</p>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}

                    <div className="flex-1 overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 z-10">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead
                                        rowSpan={2}
                                        className="border-r border-b border-gray-200 bg-blue-600 text-white font-semibold min-w-[80px]"
                                    >
                                        <Checkbox
                                            checked={selectedRecords.size === filteredRecords.length && filteredRecords.length > 0}
                                            onCheckedChange={handleSelectAll}
                                            className="mr-2"
                                        />
                                        #
                                    </TableHead>
                                    <TableHead
                                        rowSpan={2}
                                        className="border-r border-b border-gray-200 bg-blue-600 text-white font-semibold min-w-[200px]"
                                    >
                                        Company
                                    </TableHead>
                                    {TAX_TYPES.map(tax => (
                                        <TableHead
                                            key={tax.id}
                                            colSpan={5}
                                            className={`text-center text-white font-semibold ${tax.color} border-r border-b`}
                                        >
                                            {tax.label}
                                        </TableHead>
                                    ))}
                                </TableRow>
                                <TableRow className="hover:bg-transparent">
                                    {TAX_TYPES.map(() => (
                                        <>
                                            <TableHead className="border-r bg-gray-100 text-gray-900 font-medium whitespace-nowrap min-w-[120px]">Amount</TableHead>
                                            <TableHead className="border-r bg-gray-100 text-gray-900 font-medium whitespace-nowrap min-w-[120px]">Payment Mode</TableHead>
                                            <TableHead className="border-r bg-gray-100 text-gray-900 font-medium whitespace-nowrap min-w-[120px]">Payment Date</TableHead>
                                            <TableHead className="border-r bg-gray-100 text-gray-900 font-medium whitespace-nowrap min-w-[80px]">Bank Name</TableHead>
                                            <TableHead className="border-r bg-gray-100 text-gray-900 font-medium whitespace-nowrap min-w-[80px]">Preview</TableHead>
                                        </>
                                    ))}
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {filteredRecords.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell className="font-medium">
                                            <Checkbox
                                                checked={selectedRecords.has(record.id)}
                                                onCheckedChange={() => handleSelectionChange(record.id)}
                                                className="mr-2"
                                            />
                                            {record.index}
                                        </TableCell>
                                        <TableCell className="font-medium flex items-center">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 p-0 mr-2"
                                                onClick={() => toggleCompanyExpand(record.id)}
                                            >
                                                {expandedCompanies.has(record.id) ? 
                                                    <ChevronUp className="h-4 w-4" /> : 
                                                    <ChevronDown className="h-4 w-4" />
                                                }
                                            </Button>
                                            {record.company?.company_name || 'Unknown'}
                                        </TableCell>
                                        {TAX_TYPES.map(tax => {
                                            const result = results.find(r =>
                                                r.recordId === record.id &&
                                                r.taxType === tax.id
                                            );
                                            return (
                                                <>
                                                    <TableCell className="text-right font-mono">
                                                        {result?.amount || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {result?.paymentMode || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {result?.paymentDate || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {result?.bankName || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {result?.documentPath && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handlePreview(record, tax)}
                                                                className="h-6 w-6 p-0"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {result?.status && getStatusIcon(result.status)}
                                                        {result?.message && (
                                                            <span className="text-xs text-red-500 block mt-1">{result.message}</span>
                                                        )}
                                                    </TableCell>
                                                </>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        {selectedRecords.size > 0 && (
                            <>
                                {extractionCache.has(`${selectedYear}-${selectedMonth}-${Array.from(selectedRecords).join('-')}-${extractionMode}`) ? (
                                    <Button
                                        onClick={handleReopenExtraction}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <RotateCw className="mr-2 h-4 w-4" />
                                        Resume Previous Extraction ({selectedRecords.size})
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleExtractAll}
                                        disabled={processing || selectedRecords.size === 0}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        {processing ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            `Extract Selected (${selectedRecords.size})`
                                        )}
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {previewDialogOpen && processedDocs.length > 0 && (
                <ExtractAllPreviewExtractionDialog
                    isOpen={previewDialogOpen}
                    onClose={() => setPreviewDialogOpen(false)}
                    documents={processedDocs[currentCompanyIndex].documents} 
                    companyName={processedDocs[currentCompanyIndex].companyName}
                    recordId={processedDocs[currentCompanyIndex].recordId}
                    onSave={handleExtractionsSave}
                />
            )}
        </>
    )
}
