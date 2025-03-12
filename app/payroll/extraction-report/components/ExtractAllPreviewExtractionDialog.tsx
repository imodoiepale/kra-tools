// @ts-nocheck
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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
const RETRY_DELAY = 4000; // 4 seconds

// Improved date formatting function
const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return null;

    // Check if already in DD/MM/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        // Ensure leading zeros
        const parts = dateString.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        return `${day}/${month}/${parts[2]}`;
    }

    // Try to parse various date formats
    let date;

    // Try ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(dateString)) {
        date = new Date(dateString);
    }
    // Try MM/DD/YYYY format
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const parts = dateString.split('/');
        date = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
    }
    // Try other common formats
    else {
        date = new Date(dateString);
    }

    // Check if date parsing worked
    if (isNaN(date.getTime())) {
        console.warn("Could not parse date:", dateString);
        return dateString;
    }

    // Format as DD/MM/YYYY with padding
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
};

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
    const { toast } = useToast();
    const [activeDoc, setActiveDoc] = useState(0);
    const [loading, setLoading] = useState(false);
    const [documentLoaded, setDocumentLoaded] = useState(false);
    const [documentLoadError, setDocumentLoadError] = useState(false);

    // Using useRef for localDocs to prevent unnecessary re-renders
    const localDocsRef = useRef(documents);
    // Use separate state for UI updates
    const [localDocsVersion, setLocalDocsVersion] = useState(0);

    // Update ref when documents prop changes
    useEffect(() => {
        localDocsRef.current = JSON.parse(JSON.stringify(documents));
        setLocalDocsVersion(prev => prev + 1);
    }, [documents]);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
    const [savedCompanies, setSavedCompanies] = useState<Set<string>>(new Set());
    const [documentCache, setDocumentCache] = useState(new Map());
    const [activeCompanyDocs, setActiveCompanyDocs] = useState<Document[]>([]);

    // Stabilize the companies data with useMemo
    const documentsByCompany = useMemo(() => {
        return localDocsRef.current.map(({ recordId, companyName, documents }) => ({
            recordId,
            companyName,
            documents: documents.map(doc => ({
                ...doc,
                companyName
            }))
        }));
    }, [localDocsVersion]);

    // Set initial expanded company
    useEffect(() => {
        if (isOpen && documentsByCompany.length > 0 && !expandedCompany) {
            setExpandedCompany(documentsByCompany[0].companyName);
        }
    }, [isOpen, documentsByCompany, expandedCompany]);

    // Update active company documents when expanded company changes
    useEffect(() => {
        if (expandedCompany) {
            const company = documentsByCompany.find(c => c.companyName === expandedCompany);
            if (company) {
                setActiveCompanyDocs(company.documents);
                preloadDocuments(company.documents);
            }
        }
    }, [expandedCompany, documentsByCompany]);

    // Reset document loaded state when active doc changes
    useEffect(() => {
        setDocumentLoaded(false);
        setDocumentLoadError(false);
    }, [activeDoc, expandedCompany]);

    // Preload document URLs
    const preloadDocuments = useCallback(async (documents) => {
        for (const doc of documents) {
            if (doc.url && !documentCache.has(doc.url)) {
                setDocumentCache(prev => new Map(prev).set(doc.url, doc.url));
            }
        }
    }, [documentCache]);

    // Update iframe source when active document changes
    useEffect(() => {
        if (iframeRef.current && expandedCompany && activeCompanyDocs.length > 0) {
            const doc = activeCompanyDocs[activeDoc];
            if (doc && doc.url) {
                const cachedUrl = documentCache.get(doc.url) || doc.url;
                iframeRef.current.src = cachedUrl;
            }
        }
    }, [activeDoc, expandedCompany, activeCompanyDocs, documentCache]);

    const extractionFields = [
        { name: 'amount', type: 'string', required: true },
        { name: 'payment_date', type: 'date', required: true },
        { name: 'payment_mode', type: 'string', required: true },
        { name: 'bank_name', type: 'string', required: true }
    ];

    // Update a specific field without causing the component to collapse
    const handleExtractionUpdate = useCallback((companyName, field, value) => {
        // Format date field if necessary
        const formattedValue = field === 'payment_date' && value
            ? formatDateToDDMMYYYY(value)
            : value;

        // Update the ref directly
        localDocsRef.current = localDocsRef.current.map(doc => {
            if (doc.companyName === companyName) {
                return {
                    ...doc,
                    documents: doc.documents.map((d, i) =>
                        i === activeDoc
                            ? {
                                ...d,
                                extractions: {
                                    ...d.extractions,
                                    [field]: formattedValue
                                }
                            }
                            : d
                    )
                };
            }
            return doc;
        });

        // Also update the active company docs for immediate UI feedback
        setActiveCompanyDocs(activeCompanyDocs.map((d, i) =>
            i === activeDoc
                ? {
                    ...d,
                    extractions: {
                        ...d.extractions,
                        [field]: formattedValue
                    }
                }
                : d
        ));

        // Trigger a version update to refresh memoized values
        setLocalDocsVersion(prev => prev + 1);
    }, [activeDoc, activeCompanyDocs]);

    const handleBulkExtract = useCallback(async (docs) => {
        setLoading(true);
        let retryQueue = [];

        try {
            const processDocuments = async (documents) => {
                return await Promise.all(documents.map(async (doc) => {
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

                        // Format date to DD/MM/YYYY
                        const formattedDate = formatDateToDDMMYYYY(result.extractedData?.payment_date);

                        const enhancedData = {
                            ...result.extractedData,
                            payment_mode: detectedPaymentMode || result.extractedData?.payment_mode,
                            payment_date: formattedDate
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
                }));
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

            // Find the active company
            const companyName = expandedCompany;
            if (!companyName) return;

            // Update only the active documents
            const updatedDocs = [...activeCompanyDocs];

            docs.forEach((doc, index) => {
                const docIndex = updatedDocs.findIndex(d => d.type === doc.type);
                if (docIndex !== -1) {
                    const result = results.find(r => r.type === doc.type);
                    if (result?.success && result.data) {
                        updatedDocs[docIndex] = {
                            ...updatedDocs[docIndex],
                            extractions: {
                                ...updatedDocs[docIndex].extractions,
                                ...result.data
                            }
                        };
                    }
                }
            });

            // Update the active company docs
            setActiveCompanyDocs(updatedDocs);

            // Also update the main data reference
            localDocsRef.current = localDocsRef.current.map(company => {
                if (company.companyName === companyName) {
                    return {
                        ...company,
                        documents: updatedDocs
                    };
                }
                return company;
            });

            setLocalDocsVersion(prev => prev + 1);

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
    }, [expandedCompany, activeCompanyDocs, toast]);

    const handleManualExtract = useCallback(() => {
        if (!activeCompanyDocs[activeDoc]) return;
        handleBulkExtract([activeCompanyDocs[activeDoc]]);
    }, [activeCompanyDocs, activeDoc, handleBulkExtract]);

    const handleSave = useCallback(async (companyName) => {
        setLoading(true);
        try {
            // Find the company data in the ref
            const company = localDocsRef.current.find(c => c.companyName === companyName);
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
            company.documents.forEach(doc => {
                const docType = doc.type.endsWith('_receipt') ? doc.type : `${doc.type}_receipt`;

                // Ensure date is properly formatted
                let paymentDate = doc.extractions.payment_date;
                if (paymentDate) {
                    paymentDate = formatDateToDDMMYYYY(paymentDate);
                }

                updatedExtractions[docType] = {
                    ...doc.extractions,
                    payment_date: paymentDate,
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
    }, [onSave, toast]);

    const renderExtractionField = useCallback((companyName, field, label, placeholder) => {
        if (!activeCompanyDocs[activeDoc]) return null;

        // Get field value from active company docs
        const value = activeCompanyDocs[activeDoc].extractions[field] || '';

        return (
            <div className="space-y-1">
                <Label htmlFor={`${companyName}-${field}`} className="text-xs">{label}</Label>
                <Input
                    id={`${companyName}-${field}`}
                    value={value}
                    onChange={(e) => handleExtractionUpdate(companyName, field, e.target.value)}
                    placeholder={placeholder}
                    className="text-sm h-8"
                />
                {field === 'payment_date' && value && (
                    <p className="text-xs text-gray-500 mt-1">
                        Format: DD/MM/YYYY
                    </p>
                )}
            </div>
        );
    }, [activeCompanyDocs, activeDoc, handleExtractionUpdate]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">Document Extractions</DialogTitle>
                </DialogHeader>

                <ScrollArea className="h-[calc(90vh-100px)]">
                    {documentsByCompany.map(({ companyName, documents, recordId }) => (
                        <div
                            key={companyName}
                            className={`mb-4 rounded-lg border ${savedCompanies.has(companyName) ? 'bg-gray-50' : 'bg-white'}`}
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
                                <ChevronDown className={`h-4 w-4 transition-transform ${expandedCompany === companyName ? 'rotate-180' : ''}`} />
                            </div>

                            {expandedCompany === companyName && (
                                <div className="p-4 border-t">
                                    <div className="grid grid-cols-7 gap-6">
                                        <div className="col-span-2 flex flex-col gap-4">
                                            <ScrollArea className="h-full border rounded-lg p-2">
                                                {activeCompanyDocs.map((doc, index) => (
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

                                        <div className="col-span-3 border rounded bg-white overflow-hidden relative">
                                            {!documentLoaded && !documentLoadError && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
                                                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                </div>
                                            )}
                                            {documentLoadError && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
                                                    <div className="text-center p-4">
                                                        <p className="text-red-500 font-medium">Failed to load document</p>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="mt-2"
                                                            onClick={() => {
                                                                setDocumentLoadError(false);
                                                                setDocumentLoaded(false);
                                                                // Force reload iframe
                                                                if (iframeRef.current) {
                                                                    const currentSrc = iframeRef.current.src;
                                                                    iframeRef.current.src = "";
                                                                    setTimeout(() => {
                                                                        if (iframeRef.current) iframeRef.current.src = currentSrc;
                                                                    }, 100);
                                                                }
                                                            }}
                                                        >
                                                            Try Again
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                            <iframe
                                                ref={iframeRef}
                                                className="w-full h-full"
                                                title={activeCompanyDocs[activeDoc]?.label}
                                                onLoad={() => setDocumentLoaded(true)}
                                                onError={() => {
                                                    setDocumentLoadError(true);
                                                    setDocumentLoaded(false);
                                                }}
                                            />
                                        </div>

                                        <div className="col-span-2 border rounded-lg p-4 space-y-4 bg-white overflow-y-auto">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-bold uppercase underline text-md">
                                                    {activeCompanyDocs[activeDoc]?.label}
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
                                            onClick={() => handleSave(companyName)}
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