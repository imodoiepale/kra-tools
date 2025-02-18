// @ts-nocheck
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RotateCw } from "lucide-react"
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useDocumentExtractions } from '../hooks/useDocumentExtractions'

interface Extraction {
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
    const [documentUrl, setDocumentUrl] = useState<string>('')
    
    const {
        extractions,
        loading,
        fetchingData,
        handleExtract,
        error
    } = useDocumentExtractions({
        recordId,
        documentType,
        initialExtractions
    })

    useEffect(() => {
        const fetchDocumentUrl = async () => {
            try {
                const { data: { publicUrl }, error } = await supabase.storage
                    .from('Payroll-Cycle')
                    .getPublicUrl(url)

                if (error) {
                    console.error('Error getting public URL:', error)
                    return
                }

                setDocumentUrl(publicUrl)
            } catch (error) {
                console.error('Error in fetchDocumentUrl:', error)
            }
        }

        if (url && isOpen) {
            fetchDocumentUrl()
        }
    }, [url, isOpen])

    // Notify parent component when extractions change
    useEffect(() => {
        if (extractions && onExtractionsUpdate) {
            onExtractionsUpdate(extractions)
        }
    }, [extractions, onExtractionsUpdate])

    const renderExtractionDetails = () => {
        if (fetchingData) {
            return (
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            )
        }

        if (!extractions) return null

        const details = [
            { label: 'Amount', value: extractions.amount },
            { label: 'Payment Date', value: extractions.payment_date },
            { label: 'Payment Mode', value: extractions.payment_mode },
            { label: 'Bank Name', value: extractions.bank_name }
        ]

        return (
            <div className="space-y-3 flex-grow">
                {details.map(({ label, value }) => (
                    <div key={label} className="space-y-1">
                        <p className="text-xs text-gray-500">{label}</p>
                        {value ? (
                            <Badge variant="secondary" className="font-normal">
                                {value}
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-gray-400">
                                Not extracted
                            </Badge>
                        )}
                    </div>
                ))}
                {error && (
                    <p className="text-sm text-red-500 mt-2">{error}</p>
                )}
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
                                src={`${documentUrl}#view=FitH`}
                                className="w-full h-full border-0"
                                title={title}
                                loading="lazy"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p>Loading document...</p>
                            </div>
                        )}
                    </div>

                    <div className="col-span-2 flex flex-col gap-4">
                        <div className="border rounded-lg p-4 space-y-4 bg-white h-full">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold uppercase underline text-md">
                                    Document Details
                                </h4>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => documentUrl && handleExtract(documentUrl)}
                                    disabled={loading || !documentUrl || fetchingData}
                                    className="w-32"
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
                            {renderExtractionDetails()}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
