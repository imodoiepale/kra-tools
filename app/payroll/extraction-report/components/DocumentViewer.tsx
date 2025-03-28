// @ts-nocheck
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, RotateCw, Save } from "lucide-react"
import { supabase } from '@/lib/supabase'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
    validateExtraction,
    PAYMENT_MODES,
    determinePaymentMode
} from '../../utils/documentUtils'
import { performExtraction } from "@/lib/extractionUtils"

const RETRY_DELAY = 3000
const MAX_RETRIES = 3

export interface Extraction {
    amount: string | null
    payment_date: string | null
    payment_mode: string | null
    bank_name: string | null
}

interface DocumentViewerProps {
    url: string
    isOpen: boolean
    onClose: () => void
    title: string
    companyName: string
    documentType: string
    recordId: string
    extractions?: Extraction
    onExtractionsUpdate?: (extractions: Extraction) => void
}

interface DocumentState {
    url: string
    loading: boolean
    error: Error | null
    retryCount: number
}

// Custom hook for managing document URL fetching and retries
const useDocumentUrl = (storageUrl: string, isOpen: boolean): DocumentState => {
    const [state, setState] = useState<DocumentState>({
        url: '',
        loading: false,
        error: null,
        retryCount: 0
    })

    const fetchUrl = useCallback(async () => {
        if (!storageUrl) return

        setState(prev => ({ ...prev, loading: true, error: null }))
        try {
            const { data: { publicUrl }, error } = await supabase.storage
                .from('Payroll-Cycle')
                .getPublicUrl(storageUrl)

            if (error) throw error

            setState(prev => ({
                ...prev,
                url: publicUrl,
                loading: false,
                error: null,
                retryCount: 0
            }))
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Failed to load document')
            setState(prev => {
                const newRetryCount = prev.retryCount + 1
                if (newRetryCount < MAX_RETRIES) {
                    setTimeout(() => fetchUrl(), RETRY_DELAY)
                }
                return {
                    ...prev,
                    url: '',
                    loading: false,
                    error: err,
                    retryCount: newRetryCount
                }
            })

            if (state.retryCount >= MAX_RETRIES) {
                toast.error('Error loading document after multiple attempts')
            }
        }
    }, [storageUrl])

    useEffect(() => {
        if (storageUrl && isOpen) {
            fetchUrl()
        }
        return () => {
            setState({
                url: '',
                loading: false,
                error: null,
                retryCount: 0
            })
        }
    }, [storageUrl, isOpen, fetchUrl])

    return state
}

export function DocumentViewer({
    url,
    isOpen,
    onClose,
    title,
    companyName,
    documentType,
    recordId,
    extractions: initialExtractions,
    onExtractionsUpdate
}: DocumentViewerProps) {
    const { url: documentUrl, loading: urlLoading, error: urlError } = useDocumentUrl(url, isOpen)
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const [localExtractions, setLocalExtractions] = useState<Extraction>(() => ({
        amount: initialExtractions?.amount || null,
        payment_date: initialExtractions?.payment_date || null,
        payment_mode: initialExtractions?.payment_mode || null,
        bank_name: initialExtractions?.bank_name || null
    }))
    const [isExtracting, setIsExtracting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [validation, setValidation] = useState<{ isValid: boolean; errors: string[] }>({
        isValid: false,
        errors: []
    })

    // Helper to format amount without decimals
    const formatDisplayAmount = (amount: string | null | undefined): string => {
        if (!amount) return '';
        
        // Convert to number and format with commas, no decimals
        const numAmount = parseFloat(amount.replace(/,/g, ''));
        if (isNaN(numAmount)) return amount;
        
        return Math.round(numAmount).toLocaleString('en-US');
    };

    // Fetch existing extractions
    useEffect(() => {
        const fetchExistingExtractions = async () => {
            if (!recordId || !documentType) return

            setIsFetching(true)
            try {
                const { data: record, error } = await supabase
                    .from('company_payroll_records')
                    .select('payment_receipts_extractions')
                    .eq('id', recordId)
                    .single()

                if (error) throw error

                const docType = documentType.endsWith('_receipt') ? documentType : `${documentType}_receipt`
                const existingData = record?.payment_receipts_extractions?.[docType]

                if (existingData) {
                    const extractionData = {
                        amount: existingData.amount || null,
                        payment_date: existingData.payment_date || null,
                        payment_mode: existingData.payment_mode || null,
                        bank_name: existingData.bank_name || null
                    }
                    setLocalExtractions(extractionData)
                    setValidation(validateExtraction(extractionData))
                    onExtractionsUpdate?.(extractionData)
                }
            } catch (error) {
                console.error('Error fetching extractions:', error)
                toast.error('Failed to fetch existing extractions')
            } finally {
                setIsFetching(false)
            }
        }

        if (isOpen) {
            fetchExistingExtractions()
        }
    }, [recordId, documentType, isOpen, onExtractionsUpdate])

    // Update iframe source
    useEffect(() => {
        if (documentUrl && iframeRef.current) {
            iframeRef.current.src = `${documentUrl}#view=FitH`
        }
    }, [documentUrl])

    // Handle parent updates
    useEffect(() => {
        if (initialExtractions) {
            setLocalExtractions(prev => ({
                ...prev,
                ...initialExtractions
            }))
            setValidation(validateExtraction(initialExtractions))
        }
    }, [initialExtractions])

    const handleExtract = async () => {
        if (!documentUrl) return

        setIsExtracting(true)
        try {
            if (localExtractions.amount || localExtractions.payment_date ||
                localExtractions.payment_mode || localExtractions.bank_name) {
                const shouldReExtract = window.confirm('Existing data found. Do you want to re-extract?')
                if (!shouldReExtract) return
            }

            const result = await performExtraction(
                documentUrl,
                [
                    { name: 'amount', type: 'string', required: true },
                    { name: 'payment_date', type: 'date', required: false },
                    { name: 'payment_mode', type: 'string', required: false },
                    { name: 'bank_name', type: 'string', required: false }
                ],
                'payment_receipt',
                (message) => console.log('Extraction progress:', message)
            )

            if (result.success && result.extractedData) {
                const enhancedData = {
                    ...result.extractedData,
                    payment_mode: determinePaymentMode(result.extractedData.raw_text || '') ||
                        result.extractedData.payment_mode
                }
                setLocalExtractions(prev => ({
                    ...prev,
                    ...enhancedData
                }))
                setValidation(validateExtraction(enhancedData))
                onExtractionsUpdate?.(enhancedData)
                toast.success('Document extracted successfully')
            } else {
                toast.error('Failed to extract document data')
            }
        } catch (error) {
            console.error('Extraction error:', error)
            toast.error('Error during extraction')
        } finally {
            setIsExtracting(false)
        }
    }

    const handleExtractionUpdate = (field: keyof Extraction, value: string) => {
        let formattedValue = value;
        
        // Format date to DD/MM/YYYY if it's a payment_date field
        if (field === 'payment_date' && value) {
            try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const year = date.getFullYear();
                    formattedValue = `${day}/${month}/${year}`;
                }
            } catch (error) {
                console.error('Error formatting date:', error);
            }
        }
        
        // Automatically update bank_name when payment_mode changes to/from Mpesa
        if (field === 'payment_mode') {
            const updatedExtractions = {
                ...localExtractions,
                [field]: formattedValue
            };
            
            // If payment mode is set to Mpesa, set bank_name to N/A
            if (formattedValue === PAYMENT_MODES.MPESA) {
                updatedExtractions.bank_name = 'N/A';
            } else if (localExtractions.bank_name === 'N/A' && localExtractions.payment_mode === PAYMENT_MODES.MPESA) {
                // If changing from Mpesa to something else, clear the N/A bank name
                updatedExtractions.bank_name = '';
            }
            
            setLocalExtractions(updatedExtractions);
            setValidation(validateExtraction(updatedExtractions));
            onExtractionsUpdate?.(updatedExtractions);
            return;
        }
        
        // For other fields, proceed as normal
        const updatedExtractions = {
            ...localExtractions,
            [field]: formattedValue
        };
        
        setLocalExtractions(updatedExtractions);
        setValidation(validateExtraction(updatedExtractions));
        onExtractionsUpdate?.(updatedExtractions);
    }

    const completeExtraction = async () => {
        if (!validation.isValid) {
            if (!window.confirm('There are validation issues. Continue anyway?')) {
                return;
            }
        }
        
        // Format date in DD/MM/YYYY format if needed
        let finalExtractions = { ...localExtractions };
        
        if (finalExtractions.payment_date && !/^\d{2}\/\d{2}\/\d{4}$/.test(finalExtractions.payment_date)) {
            try {
                const date = new Date(finalExtractions.payment_date);
                if (!isNaN(date.getTime())) {
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const year = date.getFullYear();
                    finalExtractions.payment_date = `${day}/${month}/${year}`;
                }
            } catch (error) {
                console.error('Error formatting date during save:', error);
            }
        }
        
        // Ensure bank_name is N/A for Mpesa
        if (finalExtractions.payment_mode === PAYMENT_MODES.MPESA) {
            finalExtractions.bank_name = 'N/A';
        }
        
        // Call the update callback
        onExtractionsUpdate?.(finalExtractions);
        
        // Show success message
        toast.success('Extraction data updated');
    };

    const saveExtractions = async () => {
        if (!validation.isValid) {
            if (!window.confirm(`There are validation issues with the extractions. Continue anyway?`)) {
                return
            }
        }

        setIsSaving(true)

        try {
            // Fetch current record
            const { data: record, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('payment_receipts_extractions')
                .eq('id', recordId)
                .single()

            if (fetchError) throw fetchError

            // Prepare the updated extractions
            const currentExtractions = record?.payment_receipts_extractions || {}
            const updatedExtractions = {
                ...currentExtractions,
                [documentType]: {
                    ...localExtractions,
                    // Ensure date format is consistent
                    payment_date: localExtractions.payment_date && !/^\d{2}\/\d{2}\/\d{4}$/.test(localExtractions.payment_date)
                        ? (() => {
                            try {
                                const date = new Date(localExtractions.payment_date);
                                if (!isNaN(date.getTime())) {
                                    const day = date.getDate().toString().padStart(2, '0');
                                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                                    const year = date.getFullYear();
                                    return `${day}/${month}/${year}`;
                                }
                                return localExtractions.payment_date;
                            } catch (error) {
                                console.error('Error formatting date during save:', error);
                                return localExtractions.payment_date;
                            }
                        })()
                        : localExtractions.payment_date,
                    // Ensure amount is properly formatted
                    amount: localExtractions.amount ? String(localExtractions.amount).replace(/,/g, '') : null,
                    // Ensure bank_name is properly saved
                    bank_name: localExtractions.payment_mode === PAYMENT_MODES.MPESA 
                        ? 'N/A' 
                        : (localExtractions.bank_name || '')
                }
            }

            console.log('Saving extractions:', updatedExtractions)

            // Update in Supabase
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_receipts_extractions: updatedExtractions
                })
                .eq('id', recordId)

            if (updateError) throw updateError

            // Call the update callback to update local state in the parent component
            if (onExtractionsUpdate) {
                const updatedData = {
                    ...localExtractions,
                    bank_name: localExtractions.payment_mode === PAYMENT_MODES.MPESA 
                        ? 'N/A' 
                        : (localExtractions.bank_name || '')
                }
                onExtractionsUpdate(updatedData)
            }

            toast.success('Extractions saved successfully')
            onClose()
        } catch (error) {
            console.error('Save error:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to save extractions')
        } finally {
            setIsSaving(false)
        }
    }

    // Helper to render extraction field
    const renderExtractionField = (field: keyof Extraction, label: string, placeholder: string, className = '') => {
        return (
            <div className="space-y-1">
                <Label htmlFor={field} className="text-xs">{label}</Label>
                <Input
                    id={field}
                    placeholder={placeholder}
                    className={cn(
                        className,
                        localExtractions[field] ? "border-green-500 focus:border-green-500" : "border-gray-200"
                    )}
                    value={localExtractions[field] || ''}
                    onChange={(e) => handleExtractionUpdate(field, e.target.value)}
                />
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl max-h-[90vh]">
                <DialogHeader>
                    <div className="flex justify-between items-center">
                        <DialogTitle className="text-lg font-semibold">
                            <span className="text-blue-600">{companyName}</span>
                            <span className="text-sm text-gray-500"> - {title}</span>
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-6 gap-6 h-[calc(90vh-100px)]">
                    <div className="col-span-4 border rounded bg-white overflow-hidden">
                        {documentUrl ? (
                            <iframe
                                ref={iframeRef}
                                className="w-full h-full border-0"
                                title={title}
                                loading="lazy"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        )}
                    </div>

                    <div className="col-span-2 flex flex-col gap-4">
                        <div className="border rounded-lg p-4 space-y-4 bg-white h-full">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold uppercase underline text-md">
                                    Document Details
                                </h4>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleExtract}
                                        disabled={isExtracting || !documentUrl || isFetching}
                                    >
                                        {isExtracting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Extracting...
                                            </>
                                        ) : (
                                            <>
                                                <RotateCw className="h-4 w-4 mr-2" />
                                                {localExtractions.amount ? 'Re-Extract' : 'Extract'}
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={completeExtraction}
                                        className="gap-1"
                                    >
                                        <Save className="h-4 w-4" />
                                        Update
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={saveExtractions}
                                        disabled={isSaving}
                                        className="gap-1"
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        {isSaving ? 'Saving...' : 'Save & Close'}
                                    </Button>
                                </div>
                            </div>

                            {isFetching ? (
                                <div className="flex items-center justify-center h-32">
                                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <div className="space-y-3 flex-grow">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="amount" className="text-xs">Amount</Label>
                                            <Input
                                                id="amount"
                                                placeholder="Enter amount"
                                                className={cn(
                                                    "h-8 text-sm",
                                                    localExtractions.amount ? "border-green-500 focus:border-green-500" : "border-gray-200"
                                                )}
                                                value={localExtractions.amount || ''}
                                                onChange={(e) => {
                                                    // Allow only numbers and commas
                                                    const value = e.target.value.replace(/[^0-9,]/g, '');
                                                    handleExtractionUpdate('amount', value);
                                                }}
                                            />
                                            {localExtractions.amount && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Formatted: {formatDisplayAmount(localExtractions.amount)}
                                                </p>
                                            )}
                                        </div>
                                        {renderExtractionField('payment_date', 'Payment Date (DD/MM/YYYY)', 'DD/MM/YYYY', 'h-8 text-sm')}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="payment_mode" className="text-xs">Payment Mode</Label>
                                            <select
                                                id="payment_mode"
                                                className={cn(
                                                    "w-full h-8 px-3 py-1 text-sm rounded-md border",
                                                    localExtractions.payment_mode ? "border-green-500 focus:border-green-500" : "border-gray-200"
                                                )}
                                                value={localExtractions.payment_mode || ''}
                                                onChange={(e) => handleExtractionUpdate('payment_mode', e.target.value)}
                                            >
                                                <option value="">Select Payment Mode</option>
                                                {Object.values(PAYMENT_MODES).map(mode => (
                                                    <option key={mode} value={mode}>{mode}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {localExtractions.payment_mode === PAYMENT_MODES.MPESA ? (
                                            <div className="space-y-1">
                                                <Label htmlFor="bank_name" className="text-xs">Bank Name</Label>
                                                <Input
                                                    id="bank_name"
                                                    placeholder="N/A for Mpesa"
                                                    className="h-8 text-sm bg-gray-100"
                                                    value="N/A"
                                                    disabled
                                                />
                                            </div>
                                        ) : renderExtractionField('bank_name', 'Bank Name', 'Enter bank name', 'h-8 text-sm')}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}