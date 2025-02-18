import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { performExtraction } from '@/lib/extractionUtils'

interface Extraction {
    amount: string | null
    payment_date: string | null
    payment_mode: string | null
    bank_name: string | null
}

interface UseDocumentExtractionsProps {
    recordId: string
    documentType: string
    initialExtractions?: Extraction
}

interface UseDocumentExtractionsReturn {
    extractions: Extraction | null
    loading: boolean
    fetchingData: boolean
    handleExtract: (documentUrl: string) => Promise<void>
    error: string | null
}

export function useDocumentExtractions({
    recordId,
    documentType,
    initialExtractions
}: UseDocumentExtractionsProps): UseDocumentExtractionsReturn {
    const { toast } = useToast()
    const [extractions, setExtractions] = useState<Extraction | null>(initialExtractions || null)
    const [loading, setLoading] = useState(false)
    const [fetchingData, setFetchingData] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const extractionFields = [
        { name: 'amount', type: 'string', required: true },
        { name: 'payment_date', type: 'date', required: true },
        { name: 'payment_mode', type: 'string', required: true },
        { name: 'bank_name', type: 'string', required: true }
    ]

    useEffect(() => {
        const fetchExistingExtractions = async () => {
            setFetchingData(true)
            setError(null)
            try {
                const { data, error } = await supabase
                    .from('company_payroll_records')
                    .select('payment_receipts_extractions')
                    .eq('id', recordId)
                    .single()

                if (error) throw error

                if (data?.payment_receipts_extractions) {
                    const existingExtractions = data.payment_receipts_extractions[documentType]
                    
                    if (existingExtractions) {
                        const normalizedExtractions = {
                            amount: existingExtractions.amount || null,
                            payment_date: existingExtractions.payment_date || null,
                            payment_mode: existingExtractions.payment_mode || null,
                            bank_name: existingExtractions.bank_name || null
                        }
                        setExtractions(normalizedExtractions)
                    } else {
                        setExtractions(initialExtractions || null)
                    }
                } else {
                    setExtractions(initialExtractions || null)
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch document data'
                setError(errorMessage)
                toast({
                    title: "Error",
                    description: errorMessage,
                    variant: "destructive"
                })
            } finally {
                setFetchingData(false)
            }
        }

        if (recordId && documentType) {
            fetchExistingExtractions()
        }
    }, [recordId, documentType, initialExtractions, toast])

    const handleExtract = async (documentUrl: string) => {
        setLoading(true)
        setError(null)
        try {
            const result = await performExtraction(
                documentUrl,
                extractionFields,
                'payment_receipt',
                (message) => console.log('Extraction progress:', message)
            )

            if (!result.success) {
                throw new Error(result.message)
            }

            const newExtractions = result.extractedData

            // Get current extractions
            const { data: currentData } = await supabase
                .from('company_payroll_records')
                .select('payment_receipts_extractions')
                .eq('id', recordId)
                .single()

            // Prepare the update
            const currentExtractions = currentData?.payment_receipts_extractions || {}
            const updatedExtractions = {
                ...currentExtractions,
                [documentType]: newExtractions
            }

            // Update database
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_receipts_extractions: updatedExtractions
                })
                .eq('id', recordId)

            if (updateError) throw updateError

            setExtractions(newExtractions)
            toast({
                title: "Success",
                description: "Document data extracted successfully"
            })
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to extract document data'
            setError(errorMessage)
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    return {
        extractions,
        loading,
        fetchingData,
        handleExtract,
        error
    }
}
