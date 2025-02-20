// @ts-nocheck 
import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MonthYearSelector } from '../../components/MonthYearSelector';
import { useToast } from "@/hooks/use-toast";
import { performExtraction } from '@/lib/extractionUtils';
import { supabase } from '@/lib/supabase';

import { ExtractAllPreviewExtractionDialog } from './ExtractAllPreviewExtractionDialog';



const TAX_TYPES = [
    { id: 'paye', label: 'PAYE', color: 'bg-blue-600', receiptType: 'paye_receipt' },
    { id: 'housing_levy', label: 'Housing Levy', color: 'bg-green-600', receiptType: 'housing_levy_receipt' },
    { id: 'nita', label: 'NITA', color: 'bg-purple-600', receiptType: 'nita_receipt' },
    { id: 'shif', label: 'SHIF', color: 'bg-orange-600', receiptType: 'shif_receipt' },
    { id: 'nssf', label: 'NSSF', color: 'bg-red-600', receiptType: 'nssf_receipt' }
];

const EXTRACTION_FIELDS = [
    { name: 'amount', type: 'string', required: true },
    { name: 'payment_date', type: 'date', required: true },
    { name: 'payment_mode', type: 'string', required: true },
    { name: 'bank_name', type: 'string', required: false }
];


export function ExtractAllDialog({
    isOpen,
    onClose,
    records,
    setPayrollRecords
}) {
    const { toast } = useToast();
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState<ExtractionResult[]>([]); 
    const [selectedRecords, setSelectedRecords] = useState(new Set());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [sortedRecords, setSortedRecords] = useState([]);

    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [processedDocs, setProcessedDocs] = useState([]);
    const [currentCompanyIndex, setCurrentCompanyIndex] = useState(0)

    useEffect(() => {
        if (isOpen) {
            const sorted = [...records]
                .sort((a, b) => a.company.company_name.localeCompare(b.company.company_name))
                .map((record, index) => ({ ...record, index: index + 1 }));
            setSortedRecords(sorted);
            setSelectedRecords(new Set(sorted.map(r => r.id)));

            // Initialize results with existing extractions
            const initialResults = sorted.flatMap(record =>
                TAX_TYPES.map(tax => ({
                    companyName: record.company.company_name,
                    taxType: tax.id,
                    amount: record.payment_receipts_extractions?.[tax.receiptType]?.amount || null,
                    paymentMode: record.payment_receipts_extractions?.[tax.receiptType]?.payment_mode || null,
                    paymentDate: record.payment_receipts_extractions?.[tax.receiptType]?.payment_date || null,
                    bankName: record.payment_receipts_extractions?.[tax.receiptType]?.bank_name || null,
                    documentPath: record.payment_receipts_documents?.[tax.receiptType] || null,
                    status: record.payment_receipts_extractions?.[tax.receiptType] ? 'success' : null
                }))
            );
            setResults(initialResults);
        }
    }, [isOpen, records]);

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
        setSelectedRecords(new Set(checked ? sortedRecords.map(r => r.id) : []));
    };

    const extractCompanyDocuments = async (record) => {
        try {
            // Gather all documents for this company
            const companyDocs = [];

            // Step 1: Get URLs for all available documents
            for (const tax of TAX_TYPES) {
                const docPath = record.payment_receipts_documents[tax.receiptType];
                if (docPath) {
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
                }
            }

            if (companyDocs.length === 0) {
                console.log('No documents found for', record.company.company_name);
                return null;
            }

            // Step 2: Process each document
            const processedDocs = await Promise.all(companyDocs.map(async (doc) => {
                try {
                    const result = await performExtraction(
                        doc.url,
                        EXTRACTION_FIELDS,
                        'payment_receipt'
                    );

                    return {
                        file: null,
                        type: doc.type,
                        label: doc.label,
                        url: doc.url,
                        extractions: result.success ? result.extractedData : {
                            amount: null,
                            payment_date: null,
                            payment_mode: null,
                            bank_name: null
                        }
                    };
                } catch (error) {
                    console.error(`Failed to process ${doc.label}:`, error);
                    return {
                        file: null,
                        type: doc.type,
                        label: doc.label,
                        url: doc.url,
                        extractions: {
                            amount: null,
                            payment_date: null,
                            payment_mode: null,
                            bank_name: null
                        }
                    };
                }
            }));

            return processedDocs;

        } catch (error) {
            console.error(`Extraction failed for ${record.company.company_name}:`, error);
            return null;
        }
    };

    const handleExtractAll = async () => {
        if (selectedRecords.size === 0) {
            toast({
                title: "No Records Selected",
                description: "Please select at least one record to process",
                variant: "destructive"
            });
            return;
        }

        setProcessing(true);
        const allProcessedDocs = [];

        try {
            const recordsToProcess = sortedRecords.filter(r => selectedRecords.has(r.id));

            for (const record of recordsToProcess) {
                // Update progress
                setResults(prev => [
                    ...prev,
                    {
                        companyName: record.company.company_name,
                        status: 'processing'
                    }
                ]);

                const extractedDocs = await extractCompanyDocuments(record);

                if (extractedDocs && extractedDocs.length > 0) {
                    allProcessedDocs.push({
                        recordId: record.id,
                        companyName: record.company.company_name,
                        documents: extractedDocs
                    });

                    // Update progress
                    setResults(prev =>
                        prev.map(r =>
                            r.companyName === record.company.company_name
                                ? { ...r, status: 'success' }
                                : r
                        )
                    );
                } else {
                    // Update progress for failed extraction
                    setResults(prev =>
                        prev.map(r =>
                            r.companyName === record.company.company_name
                                ? { ...r, status: 'error' }
                                : r
                        )
                    );
                }
            }

            if (allProcessedDocs.length > 0) {
                setProcessedDocs(allProcessedDocs);
                setCurrentCompanyIndex(0);
                setPreviewDialogOpen(true);
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
        }
    };


    const handleExtractionsSave = async (recordId: string, extractions: any) => {
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
            const docPath = record.payment_receipts_documents[tax.receiptType];
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
                companyName: record.company.company_name,
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
    const getStatusIcon = (status) => {
        switch (status) {
            case 'processing':
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
            case 'success':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            default:
                return null;
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
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

                    <div className="flex-1 overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 z-10">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead
                                        rowSpan={2}
                                        className="border-r border-b border-gray-200 bg-blue-600 text-white font-semibold min-w-[80px]"
                                    >
                                        <Checkbox
                                            checked={selectedRecords.size === sortedRecords.length}
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
                                            colSpan={4}
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
                                            <TableHead className="border-r bg-gray-100 text-gray-900 font-medium whitespace-nowrap min-w-[120px]">Bank Name</TableHead>
                                            <TableHead className="border-r bg-gray-100 text-gray-900 font-medium whitespace-nowrap min-w-[80px]">Preview</TableHead>
                                        </>
                                    ))}
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {sortedRecords.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell className="font-medium">
                                            <Checkbox
                                                checked={selectedRecords.has(record.id)}
                                                onCheckedChange={() => handleSelectionChange(record.id)}
                                                className="mr-2"
                                            />
                                            {record.index}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {record.company.company_name}
                                        </TableCell>
                                        {TAX_TYPES.map(tax => {
                                            const result = results.find(r =>
                                                r.companyName === record.company.company_name &&
                                                r.taxType === tax.id
                                            );
                                            return (
                                                <>
                                                    <TableCell className="text-right">
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
                    </div>
                </DialogContent>
            </Dialog>


            {previewDialogOpen && processedDocs.length > 0 && (
                <ExtractAllPreviewExtractionDialog
                    isOpen={previewDialogOpen}
                    onClose={() => setPreviewDialogOpen(false)}
                    documents={processedDocs} 
                    companyName={processedDocs[currentCompanyIndex].companyName}
                    recordId={processedDocs[currentCompanyIndex].recordId}
                    onSave={handleExtractionsSave}
                />
            )}
        </>
    );
}