import { useState } from 'react'
import { performExtraction } from '../utils/extractionUtils'

interface ExtractedData {
    amount: string | number;
    payment_mode: string;
    payment_date: string;
}

export const useDocumentExtraction = () => {
    const [isExtracting, setIsExtracting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const extractDocumentData = async (fileUrl: string): Promise<ExtractedData | null> => {
        setIsExtracting(true)
        setError(null)

        try {
            const fields = [
                { name: 'amount', type: 'number', required: true },
                { name: 'payment_mode', type: 'string', required: true },
                { name: 'payment_date', type: 'date', required: true }
            ]

            const result = await performExtraction(
                fileUrl,
                fields,
                'payment_document',
                (message) => console.log('Extraction progress:', message)
            )

            if (!result.success) {
                throw new Error(result.message)
            }

            // Determine payment mode based on document content
            const paymentMode = determinePaymentMode(result.extractedData)

            return {
                amount: result.extractedData.amount,
                payment_mode: paymentMode,
                payment_date: result.extractedData.payment_date
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to extract document data')
            return null
        } finally {
            setIsExtracting(false)
        }
    }

    const determinePaymentMode = (data: any): string => {
        const content = JSON.stringify(data).toLowerCase()
        
        // Check for MPESA indicators
        if (
            content.includes('mpesa') ||
            content.includes('m-pesa') ||
            content.includes('safaricom') ||
            content.includes('transaction') ||
            content.includes('mobile money')
        ) {
            return 'mpesa'
        }
        
        // Check for bank indicators
        if (
            content.includes('bank') ||
            content.includes('transfer') ||
            content.includes('deposit') ||
            content.includes('cheque') ||
            content.includes('check') ||
            content.includes('swift') ||
            content.includes('rtgs')
        ) {
            return 'bank'
        }

        return 'unknown'
    }

    return {
        extractDocumentData,
        isExtracting,
        error
    }
}
