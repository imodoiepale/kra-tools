// @ts-nocheck
import { useState, useEffect, useMemo, useRef } from 'react'
import { Loader2, Save, RotateCw, ChevronDown } from 'lucide-react'
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
    file?: File | null
    type: string
    label: string
    extractions: Extraction
    url?: string
    companyName?: string
}

interface ExtractAllPreviewExtractionDialog {
    isOpen: boolean
    onClose: () => void
    documents: Array<{
        recordId: string
        companyName: string
        documents: Document[]
    }>
    onSave: (recordId: string, extractions: any) => void
}


export function ExtractAllPreviewExtractionDialog({
    isOpen,
    onClose,
    documents,
    onSave
}: ExtractAllPreviewExtractionDialog) {
    const { toast } = useToast()
    const [activeDoc, setActiveDoc] = useState(0)
    const [loading, setLoading] = useState(false)
    const [localDocs, setLocalDocs] = useState<Array<{
        recordId: string,
        companyName: string,
        documents: Document[]
    }>>(documents);

    // Update local docs when documents prop changes
    useEffect(() => {
        setLocalDocs(documents);
    }, [documents]);

    const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const [expandedCompany, setExpandedCompany] = useState<string | null>(null)
    const [savedCompanies, setSavedCompanies] = useState<Set<string>>(new Set())

    const [documentCache, setDocumentCache] = useState(new Map());


    // Update iframe source only when necessary
    useEffect(() => {
        if (iframeRef.current && expandedCompany) {
            const company = localDocs.find(c => c.companyName === expandedCompany);
            if (company && company.documents[activeDoc]) {
                const doc = company.documents[activeDoc];
                const cachedUrl = documentCache.get(`${expandedCompany}-${doc.type}`);

                if (cachedUrl) {
                    iframeRef.current.src = cachedUrl;
                } else {
                    const url = doc.url;
                    if (url) {
                        // Cache the URL
                        setDocumentCache(prev => new Map(prev).set(`${expandedCompany}-${doc.type}`, url));
                        iframeRef.current.src = url;
                    }
                }
            }
        }
    }, [activeDoc, expandedCompany, localDocs, documentCache]);

    // Memoize the preview URL to prevent unnecessary re-renders
    const previewUrl = useMemo(() => {
        const company = localDocs.find(c => c.companyName === expandedCompany);
        if (!company || !company.documents[activeDoc]) return '';
        const doc = company.documents[activeDoc];
        return doc?.url || (doc?.file ? URL.createObjectURL(doc.file) : '');
    }, [activeDoc, localDocs, expandedCompany]);

    // useEffect(() => {
    //     if (isOpen && localDocs.length > 0) {
    //         handleBulkExtract(localDocs);
    //     }
    // }, [isOpen]);

    const extractionFields = [
        { name: 'amount', type: 'string', required: true },
        { name: 'payment_date', type: 'date', required: true },
        { name: 'payment_mode', type: 'string', required: true },
        { name: 'bank_name', type: 'string', required: true }
    ]

    const handleExtractionUpdate = (companyName: string, field: keyof Extraction, value: string) => {
        setLocalDocs(docs =>
            docs.map(doc =>
                doc.companyName === companyName ? {
                    ...doc,
                    documents: doc.documents.map((d, i) =>
                        i === activeDoc
                            ? {
                                ...d,
                                extractions: {
                                    ...d.extractions,
                                    [field]: value
                                }
                            }
                            : d
                    )
                } : doc
            )
        );
    }

    const handleBulkExtract = async (docs: Document[]) => {
        setLoading(true);
        let retryQueue: Document[] = [];

        try {
            const processDocuments = async (documents: Document[]) => {
                const extractionPromises = documents.map(async (doc) => {
                    try {
                        if (!doc.url) {
                            throw new Error('No URL available for document');
                        }

                        console.log(`Starting extraction for ${doc.label}...`);
                        
                        const result = await performExtraction(
                            doc.url,
                            extractionFields,
                            'payment_receipt',
                            (message) => console.log(`${doc.label}: ${message}`)
                        );

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
                    const result = results.find(r => r.type === doc.documents[activeDoc].type);
                    if (result?.success && result.data) {
                        return {
                            ...doc,
                            documents: doc.documents.map((d, i) =>
                                i === activeDoc
                                    ? {
                                        ...d,
                                        extractions: {
                                            ...d.extractions,
                                            ...result.data
                                        }
                                    }
                                    : d
                            )
                        };
                    }
                    return doc;
                })
            );

            // Show final status
            const successCount = results.filter(r => r.success).length;
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
        const currentDoc = localDocs[0].documents[activeDoc];
        handleBulkExtract([currentDoc]);
    };

    const documentsByCompany = useMemo(() => {
        return localDocs.map(({ recordId, companyName, documents }) => ({
            recordId,
            companyName,
            documents: documents.map(doc => ({
                ...doc,
                companyName: companyName // Ensure each document has companyName
            }))
        }));
    }, [localDocs]);

    useEffect(() => {
        if (isOpen && documentsByCompany.length > 0) {
            setExpandedCompany(documentsByCompany[0].companyName);
        }
    }, [isOpen, documentsByCompany]);

    const handleSave = async (companyName: string, companyDocs: Document[]) => {
        setLoading(true);
        try {
            const company = localDocs.find(c => c.companyName === companyName);
            if (!company) throw new Error('Company not found');

            // Get existing extractions
            const { data: existingRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('payment_receipts_extractions')
                .eq('id', company.recordId)
                .single();

            if (fetchError) throw fetchError;

            // Merge extractions
            const updatedExtractions = {
                ...(existingRecord?.payment_receipts_extractions || {})
            };

            // Add each document's extractions
            companyDocs.forEach(doc => {
                const docType = doc.type.endsWith('_receipt') ? doc.type : `${doc.type}_receipt`;
                updatedExtractions[docType] = {
                    ...doc.extractions,
                    payment_mode: doc.extractions.payment_mode === 'Pay Bill' ?
                        PAYMENT_MODES.MPESA : doc.extractions.payment_mode
                };
            });

            // Update database
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_receipts_extractions: updatedExtractions
                })
                .eq('id', company.recordId);

            if (updateError) throw updateError;

            // Mark company as saved
            setSavedCompanies(prev => new Set([...prev, companyName]));
            setExpandedCompany(null);

            // Notify parent component
            onSave(company.recordId, updatedExtractions);

            toast({
                title: "Success",
                description: `Extractions saved for ${companyName}`
            });
        } catch (error) {
            console.error('Save error:', error);
            toast({
                title: "Error",
                description: `Failed to save extractions for ${companyName}`,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const renderExtractionField = (companyName: string, field: keyof Extraction, label: string, placeholder: string) => {
        const company = localDocs.find(c => c.companyName === companyName);
        if (!company || !company.documents[activeDoc]) return null;

        return (
            <div className="space-y-1">
                <Label htmlFor={`${companyName}-${field}`} className="text-xs">{label}</Label>
                <Input
                    id={`${companyName}-${field}`}
                    value={company.documents[activeDoc].extractions[field] || ''}
                    onChange={(e) => handleExtractionUpdate(companyName, field, e.target.value)}
                    placeholder={placeholder}
                    className="text-sm"
                />
            </div>
        );
    };

    const handlePreview = (doc: Document) => {
        setPreviewDoc(doc)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">Document Extractions</DialogTitle>
                </DialogHeader>

                <ScrollArea className="h-[calc(90vh-100px)]">
                    {documentsByCompany.map(({ companyName, documents }) => (
                        <div
                            key={companyName}
                            className={`mb-4 rounded-lg border ${savedCompanies.has(companyName) ? 'bg-gray-50' : 'bg-white'
                                }`}
                        >
                            <div
                                className="p-4 flex justify-between items-center cursor-pointer"
                                onClick={() => setExpandedCompany(
                                    expandedCompany === companyName ? null : companyName
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold">{companyName}</h3>
                                    {savedCompanies.has(companyName) && (
                                        <Badge variant="success">Saved</Badge>
                                    )}
                                </div>
                                <ChevronDown className={`h-4 w-4 transition-transform ${expandedCompany === companyName ? 'rotate-180' : ''
                                    }`} />
                            </div>

                            {expandedCompany === companyName && (
                                <div className="p-4 border-t">
                                    <div className="grid grid-cols-7 gap-6">
                                        <div className="col-span-2 flex flex-col gap-4">
                                            <ScrollArea className="h-full border rounded-lg p-2">
                                                {documents.map((doc, index) => (
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
                                                title={documents[activeDoc]?.label}
                                            />
                                        </div>

                                        <div className="col-span-2 border rounded-lg p-4 space-y-4 bg-white overflow-y-auto">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-bold uppercase underline text-md">
                                                    {documents[activeDoc]?.label}
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
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {renderExtractionField(companyName, 'amount', 'Amount', 'Enter amount...')}
                                                {renderExtractionField(companyName, 'payment_date', 'Payment Date', 'DD/MM/YYYY')}
                                                {renderExtractionField(companyName, 'payment_mode', 'Payment Mode', 'Enter payment mode...')}
                                                {renderExtractionField(companyName, 'bank_name', 'Bank Name', 'Enter bank name...')}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end mt-4">
                                        <Button
                                            onClick={() => handleSave(companyName, documents)}
                                            disabled={loading || savedCompanies.has(companyName)}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                    Saving...
                                                </>
                                            ) : (
                                                'Save Extractions'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </ScrollArea>

                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button
                        onClick={onClose}
                        disabled={!Array.from(savedCompanies).length}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        Complete All
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}