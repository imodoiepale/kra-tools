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
        const updatedExtractions = {
            ...localExtractions,
            [field]: value
        }

        if (field === 'payment_mode' && value === 'Pay Bill') {
            updatedExtractions.payment_mode = PAYMENT_MODES.MPESA
        }

        setLocalExtractions(updatedExtractions)
        setValidation(validateExtraction(updatedExtractions))
        onExtractionsUpdate?.(updatedExtractions)
    }

    const handleSave = async () => {
        if (!localExtractions.amount) {
            toast.error('Amount is required')
            return
        }

        try {
            setIsSaving(true)

            if (!documentType || !recordId) {
                throw new Error('Missing required parameters')
            }

            const { data: existingRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('payment_receipts_extractions')
                .eq('id', recordId)
                .single()

            if (fetchError) throw fetchError

            const docType = documentType.endsWith('_receipt') ? documentType : `${documentType}_receipt`

            const existingExtractions = existingRecord?.payment_receipts_extractions?.[docType]
            if (JSON.stringify(existingExtractions) === JSON.stringify(localExtractions)) {
                toast.info('No changes detected')
                return
            }

            const updatedExtractions = {
                ...(existingRecord?.payment_receipts_extractions || {}),
                [docType]: {
                    ...localExtractions,
                    payment_mode: localExtractions.payment_mode === 'Pay Bill' ?
                        PAYMENT_MODES.MPESA : localExtractions.payment_mode
                }
            }

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_receipts_extractions: updatedExtractions
                })
                .eq('id', recordId)

            if (updateError) throw updateError

            toast.success('Extractions saved successfully')
            onClose()
        } catch (error) {
            console.error('Save error:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to save extractions')
        } finally {
            setIsSaving(false)
        }
    }

    const renderExtractionField = (field: keyof Extraction, label: string, placeholder: string) => {
        const value = localExtractions[field]
        const hasValue = value !== null && value !== ''
        const isValid = !validation.errors.some(error => error.toLowerCase().includes(field))

        return (
            <div className="space-y-1">
                <Label htmlFor={field} className="text-xs">
                    {label}
                    {field === 'bank_name' && localExtractions.payment_mode === PAYMENT_MODES.MPESA && (
                        <span className="text-gray-400 ml-1">(N/A for Mpesa)</span>
                    )}
                </Label>
                <Input
                    id={field}
                    value={value || ''}
                    onChange={(e) => handleExtractionUpdate(field, e.target.value)}
                    placeholder={placeholder}
                    className={cn(
                        "text-sm",
                        hasValue && isValid ? "border-green-500 focus:border-green-500" :
                            hasValue ? "border-red-500 focus:border-red-500" :
                                "border-gray-200"
                    )}
                    disabled={field === 'bank_name' && localExtractions.payment_mode === PAYMENT_MODES.MPESA}
                    aria-label={label}
                />
            </div>
        )
    }

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
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={isSaving || isFetching}
                                    >
                                        {isSaving ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-1" />
                                                Save
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {isFetching ? (
                                <div className="flex items-center justify-center h-32">
                                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <div className="space-y-3 flex-grow">
                                    {renderExtractionField('amount', 'Amount', 'Enter amount...')}
                                    {renderExtractionField('payment_date', 'Payment Date', 'DD/MM/YYYY')}
                                    {renderExtractionField('payment_mode', 'Payment Mode', 'Enter payment mode...')}
                                    {renderExtractionField('bank_name', 'Bank Name', 'Enter bank name...')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}