import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
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
import { useToast } from "@/hooks/use-toast";
import { processAllDocuments } from '@/lib/extractionUtils';

// Types
interface Company {
    id: string;
    company_name: string;
}

interface ExtractionResult {
    companyName: string;
    taxType: string;
    status: 'processing' | 'success' | 'error';
    error?: string;
}

interface CompanyPayrollRecord {
    id: string;
    company: Company;
    payment_receipts_extractions: {
        [key: string]: {
            amount: string | null;
            payment_date: string | null;
            payment_mode: string | null;
            bank_name: string | null;
        };
    };
}

interface ExtractAllDialogProps {
    isOpen: boolean;
    onClose: () => void;
    records: CompanyPayrollRecord[];
    setPayrollRecords: (records: CompanyPayrollRecord[]) => void;
}

const TAX_TYPES = [
    { id: 'paye', label: 'PAYE', color: 'bg-blue-600' },
    { id: 'housing_levy', label: 'Housing Levy', color: 'bg-green-600' },
    { id: 'nita', label: 'NITA', color: 'bg-purple-600' },
    { id: 'shif', label: 'SHIF', color: 'bg-orange-600' },
    { id: 'nssf', label: 'NSSF', color: 'bg-red-600' }
];

export function ExtractAllDialog({
    isOpen,
    onClose,
    records,
    setPayrollRecords
}: ExtractAllDialogProps) {
    const { toast } = useToast();
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState<ExtractionResult[]>([]);
    const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
    const [loadExisting, setLoadExisting] = useState(false);

    // Reset state when dialog opens/closes
    useEffect(() => {
        if (isOpen) {
            setSelectedRecords(new Set(records.map(r => r.id)));
        } else {
            setResults([]);
            setProcessing(false);
            setSelectedRecords(new Set());
            setLoadExisting(false);
        }
    }, [isOpen, records]);

    const handleSelectionChange = (recordId: string) => {
        setSelectedRecords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(recordId)) {
                newSet.delete(recordId);
            } else {
                newSet.add(recordId);
            }
            return newSet;
        });
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
        setResults([]);

        try {
            const recordsToProcess = records.filter(r => selectedRecords.has(r.id));

            // Update UI with processing status
            setResults(recordsToProcess.flatMap(record =>
                TAX_TYPES.map(tax => ({
                    companyName: record.company.company_name,
                    taxType: tax.id,
                    status: 'processing' as const
                }))
            ));

            // Process documents
            await processAllDocuments(recordsToProcess, (newResults) => {
                setResults(prev => {
                    const updated = [...prev];
                    newResults.forEach(result => {
                        const index = updated.findIndex(r =>
                            r.companyName === result.companyName &&
                            r.taxType === result.taxType
                        );
                        if (index !== -1) {
                            updated[index] = result;
                        }
                    });
                    return updated;
                });
            });

            const successCount = results.filter(r => r.status === 'success').length;
            const totalCount = results.length;

            toast({
                title: successCount === totalCount ? "Success" : "Partial Success",
                description: `Successfully processed ${successCount} out of ${totalCount} documents`,
                variant: successCount === totalCount ? "default" : "warning"
            });
        } catch (error) {
            console.error('Extraction error:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to process documents",
                variant: "destructive"
            });
        } finally {
            setProcessing(false);
        }
    };

    const getStatusIcon = (status: ExtractionResult['status']) => {
        switch (status) {
            case 'processing':
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
            case 'success':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-7xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Extract All Documents</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-8">
                                    <Checkbox
                                        checked={selectedRecords.size === records.length}
                                        onCheckedChange={(checked) => {
                                            setSelectedRecords(new Set(
                                                checked ? records.map(r => r.id) : []
                                            ));
                                        }}
                                        aria-label="Select all records"
                                    />
                                </TableHead>
                                <TableHead className="min-w-[200px]">Company</TableHead>
                                {TAX_TYPES.map(tax => (
                                    <TableHead
                                        key={tax.id}
                                        className={`text-center ${tax.color} text-white`}
                                    >
                                        {tax.label}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {records.map((record, index) => (
                                <TableRow
                                    key={record.id}
                                    className={index % 2 === 0 ? 'bg-gray-50' : ''}
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedRecords.has(record.id)}
                                            onCheckedChange={() => handleSelectionChange(record.id)}
                                            aria-label={`Select ${record.company.company_name}`}
                                        />
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
                                            <TableCell key={tax.id} className="text-center">
                                                <div className="flex justify-center items-center">
                                                    {result ? getStatusIcon(result.status) : '-'}
                                                </div>
                                                {result?.error && (
                                                    <span className="text-xs text-red-500 mt-1">
                                                        {result.error}
                                                    </span>
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-4 flex justify-between items-center">
                    <Checkbox
                        id="loadExisting"
                        checked={loadExisting}
                        onCheckedChange={(checked) => setLoadExisting(!!checked)}
                    >
                        <span className="ml-2">Process existing entries</span>
                    </Checkbox>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={processing}
                        >
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
                </div>
            </DialogContent>
        </Dialog>
    );
}