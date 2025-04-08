// @ts-nocheck
import { useState, useEffect, useMemo, useRef } from 'react'
import { Loader2, Save, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DocumentType } from '../types'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { performExtraction } from '@/lib/extractionUtils'
import { DocumentViewer } from './DocumentViewer'
import {
    validateExtraction,
    PAYMENT_MODES,
    determinePaymentMode
} from '../../utils/documentUtils'

const MAX_RETRIES = 3;
const RETRY_DELAY = 4000; // 2 seconds

interface Extraction {
    amount: string | null
    payment_date: string | null
    payment_mode: string | null
    bank_name: string | null
}

interface Document {
    file: File
    type: DocumentType
    label: string
    extractions: Extraction
    url?: string
}

interface PreviewExtractionDialogProps {
    isOpen: boolean
    onClose: () => void
    documents: Document[]
    companyName: string
    recordId: string
}

export function PreviewExtractionDialog({
    isOpen,
    onClose,
    documents,
    companyName,
    recordId
}: PreviewExtractionDialogProps) {
    const { toast } = useToast()
    const [activeDoc, setActiveDoc] = useState(0)
    const [loading, setLoading] = useState(false)
    const [localDocs, setLocalDocs] = useState(documents)
    const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Update iframe source only when necessary
    useEffect(() => {
        if (iframeRef.current) {
            const doc = localDocs[activeDoc];
            const url = doc?.url || (doc?.file ? URL.createObjectURL(doc.file) : '');
            if (url) {
                iframeRef.current.src = url;
            }
        }
    }, [activeDoc, localDocs]);

    // Memoize the preview URL to prevent unnecessary re-renders
    const previewUrl = useMemo(() => {
        const doc = localDocs[activeDoc]
        return doc?.url || (doc?.file ? URL.createObjectURL(doc.file) : '')
    }, [activeDoc, localDocs])

    useEffect(() => {
        if (isOpen && localDocs.length > 0) {
            handleBulkExtract(localDocs);
        }
    }, [isOpen]);

    const extractionFields = [
        { name: 'amount', type: 'string', required: true },
        { name: 'payment_date', type: 'date', required: true },
        { name: 'payment_mode', type: 'string', required: true },
        { name: 'bank_name', type: 'string', required: true }
    ]

    const handleExtractionUpdate = (field: keyof Extraction, value: string) => {
        setLocalDocs(docs =>
            docs.map((doc, i) =>
                i === activeDoc
                    ? {
                        ...doc,
                        extractions: {
                            ...doc.extractions,
                            [field]: value
                        }
                    }
                    : doc
            )
        )
    }

    const handleBulkExtract = async (docs: Document[]) => {
        setLoading(true);
        let retryQueue: Document[] = [];

        try {
            const processDocuments = async (documents: Document[]) => {
                const extractionPromises = documents.map(async (doc) => {
                    try {
                        const fileUrl = URL.createObjectURL(doc.file);
                        console.log(`Starting extraction for ${doc.label}...`);
                        
                        const result = await performExtraction(
                            fileUrl,
                            extractionFields,
                            'payment_receipt',
                            (message) => console.log(`${doc.label}: ${message}`)
                        );
                        
                        URL.revokeObjectURL(fileUrl);

                        if (!result.success) {
                            return {
                                type: doc.type,
                                success: false,
                                error: result.message,
                                shouldRetry: true
                            };
                        }

                        // Enhance extracted data
                        const extractedContent = result.extractedData?.raw_text || '';
                        const detectedPaymentMode = determinePaymentMode(extractedContent);
                        const enhancedData = {
                            ...result.extractedData,
                            payment_mode: detectedPaymentMode || result.extractedData?.payment_mode
                        };

                        // Validate the extraction
                        const validation = validateExtraction(enhancedData);
                        
                        return {
                            type: doc.type,
                            success: validation.isValid,
                            data: enhancedData,
                            shouldRetry: !validation.isValid
                        };
                    } catch (error) {
                        console.error(`Error extracting ${doc.label}:`, error);
                        return {
                            type: doc.type,
                            success: false,
                            error: error instanceof Error ? error.message : 'Extraction failed',
                            shouldRetry: true
                        };
                    }
                });

                return await Promise.all(extractionPromises);
            };

            // First attempt
            let results = await processDocuments(docs);
            
            // Handle retries
            for (let attempt = 1; attempt < MAX_RETRIES; attempt++) {
                // Collect documents that need retry
                retryQueue = docs.filter((doc, index) => 
                    results[index].shouldRetry
                );

                if (retryQueue.length === 0) break;

                console.log(`Retry attempt ${attempt + 1} for ${retryQueue.length} documents...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                
                const retryResults = await processDocuments(retryQueue);
                
                // Update results with retry outcomes
                results = results.map(result => {
                    const retryResult = retryResults.find(r => r.type === result.type);
                    return retryResult?.success ? retryResult : result;
                });
            }

            // Update local docs with final results
            setLocalDocs(prevDocs => 
                prevDocs.map(doc => {
                    const result = results.find(r => r.type === doc.type);
                    if (result?.success && result.data) {
                        return {
                            ...doc,
                            extractions: {
                                ...doc.extractions,
                                ...result.data
                            }
                        };
                    }
                    return doc;
                })
            );

            // Show final status
            const successCount = results.filter(r => r !== null && r.success).length;
            if (successCount === docs.length) {
                toast({
                    title: "Success",
                    description: "All documents extracted successfully"
                });
            } else {
                toast({
                    title: "Partial Success",
                    description: `Successfully extracted ${successCount} out of ${docs.length} documents. Manual review may be needed.`,
                    variant: "warning"
                });
            }
        } catch (error) {
            console.error('Bulk extraction error:', error);
            toast({
                title: "Error",
                description: "Failed to process documents",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleManualExtract = () => {
        const currentDoc = localDocs[activeDoc];
        handleBulkExtract([currentDoc]);
    };

    const handleSave = async () => {
        setLoading(true)
        try {
            // Get existing extractions first
            const { data: existingRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('payment_receipts_extractions')
                .eq('id', recordId)
                .single()

            if (fetchError) {
                console.error('Fetch error:', fetchError)
                throw new Error('Error fetching existing record')
            }

            // Merge all extractions
            const updatedExtractions = {
                ...(existingRecord?.payment_receipts_extractions || {})
            };

            // Add each document's extractions
            localDocs.forEach(doc => {
                // Fix: Don't append _receipt if it already exists
                const docType = doc.type.endsWith('_receipt') ? doc.type : `${doc.type}_receipt`;
                updatedExtractions[docType] = {
                    ...doc.extractions,
                    payment_mode: doc.extractions.payment_mode === 'Pay Bill' ? 
                        PAYMENT_MODES.MPESA : doc.extractions.payment_mode
                };
            });

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_receipts_extractions: updatedExtractions
                })
                .eq('id', recordId)

            if (updateError) {
                console.error('Update error:', updateError)
                throw new Error('Error saving extractions')
            }

            toast({
                title: "Success",
                description: "All extractions saved successfully"
            })
            onClose()
        } catch (error) {
            console.error('Save error:', error)
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to save extractions",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    const renderExtractionField = (field: keyof Extraction, label: string, placeholder: string) => (
        <div className="space-y-1">
            <Label htmlFor={field} className="text-xs">{label}</Label>
            <Input
                id={field}
                value={localDocs[activeDoc].extractions[field] || ''}
                onChange={(e) => handleExtractionUpdate(field, e.target.value)}
                placeholder={placeholder}
                className="text-sm"
            />
        </div>
    )

    const handlePreview = (doc: Document) => {
        setPreviewDoc(doc)
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-7xl max-h-[90vh]">
                    <DialogHeader>
                        <div className="flex justify-between items-center">
                            <DialogTitle className="text-lg font-semibold text-blue-600">
                                {companyName}
                            </DialogTitle>
                            <span className="text-sm text-gray-500">
                                Document {activeDoc + 1} of {localDocs.length}
                            </span>
                        </div>
                    </DialogHeader>

                    <div className="grid grid-cols-7 gap-6 h-[calc(90vh-100px)]">
                        <div className="col-span-2 flex flex-col gap-4">
                            <ScrollArea className="h-full border rounded-lg p-2">
                                {localDocs.map((doc, index) => (
                                    <div
                                        key={doc.type}
                                        className={`p-3 rounded-lg cursor-pointer mb-2 ${activeDoc === index
                                            ? 'bg-blue-50 border border-blue-200'
                                            : 'hover:bg-gray-50'
                                            }`}
                                        onClick={() => setActiveDoc(index)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-medium text-sm">{doc.label}</h4>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {doc.extractions.amount
                                                        ? `Amount: ${doc.extractions.amount}`
                                                        : 'No extractions yet'}
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                {doc.extractions.amount && (
                                                    <Badge variant="success" className="text-xs">
                                                        Extracted
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>

                        <div className="col-span-3 border rounded bg-white overflow-hidden">
                            <iframe
                                ref={iframeRef}
                                className="w-full h-full"
                                title={localDocs[activeDoc].label}
                            />
                        </div>

                        <div className="col-span-2 border rounded-lg p-4 space-y-4 bg-white overflow-y-auto flex flex-col">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold uppercase underline text-md">
                                    {localDocs[activeDoc].label}
                                </h4>
                                <div className="flex flex-col gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleManualExtract}
                                        disabled={loading}
                                        className="w-full"
                                    >
                                        {loading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                <RotateCw className="h-4 w-4 mr-1" />
                                                Re-Extract
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={loading}
                                        className="w-full"
                                    >
                                        {loading ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-1" />
                                                {activeDoc < localDocs.length - 1 ? 'Save & Next' : 'Save & Close'}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3 flex-grow">
                                {renderExtractionField('amount', 'Amount', 'Enter amount...')}
                                {renderExtractionField('payment_date', 'Payment Date', 'DD/MM/YYYY')}
                                {renderExtractionField('payment_mode', 'Payment Mode', 'Enter payment mode...')}
                                {renderExtractionField('bank_name', 'Bank Name', 'Enter bank name...')}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </>
    )
}