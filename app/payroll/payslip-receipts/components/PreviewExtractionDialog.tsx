// @ts-nocheck
import { useState } from 'react'
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

    const handleExtract = async (file: File) => {
        setLoading(true)
        try {
            const fileUrl = URL.createObjectURL(file)

            const result = await performExtraction(
                fileUrl,
                extractionFields,
                'payment_receipt',
                (message) => console.log('Extraction progress:', message)
            )

            if (!result.success) {
                throw new Error(result.message)
            }

            setLocalDocs(docs =>
                docs.map((doc, i) =>
                    i === activeDoc ? {
                        ...doc,
                        extractions: result.extractedData
                    } : doc
                )
            )

            toast({
                title: "Success",
                description: "Document data extracted successfully"
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to extract document data",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            const currentDoc = localDocs[activeDoc]
            const docType = `${currentDoc.type}_receipt`

            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_receipts_extractions: {
                        [docType]: currentDoc.extractions
                    }
                })
                .eq('id', recordId)

            if (error) throw error

            toast({
                title: "Success",
                description: "Extractions saved successfully"
            })

            if (activeDoc < localDocs.length - 1) {
                setActiveDoc(prev => prev + 1)
            } else {
                onClose()
            }
        } catch (error) {
            console.error('Save error:', error)
            toast({
                title: "Error",
                description: "Failed to save extractions",
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
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-xs"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handlePreview(doc)
                                                    }}
                                                >
                                                    Preview
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>

                        <div className="col-span-3 border rounded bg-white overflow-hidden">
                            <iframe
                                src={URL.createObjectURL(localDocs[activeDoc].file)}
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
                                        onClick={() => handleExtract(localDocs[activeDoc].file)}
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

            {previewDoc && (
                <DocumentViewer
                    url={previewDoc.url || URL.createObjectURL(previewDoc.file)}
                    isOpen={!!previewDoc}
                    onClose={() => setPreviewDoc(null)}
                    title={previewDoc.label}
                    companyName={companyName}
                    documentType={`${previewDoc.type}_receipt`}
                    recordId={recordId}
                    extractions={previewDoc.extractions}
                    onExtractionsUpdate={(newExtractions) => {
                        setLocalDocs(docs =>
                            docs.map(doc =>
                                doc.type === previewDoc.type
                                    ? { ...doc, extractions: newExtractions }
                                    : doc
                            )
                        )
                    }}
                />
            )}
        </>
    )
}