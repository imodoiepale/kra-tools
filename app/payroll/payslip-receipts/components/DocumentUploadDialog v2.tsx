// @ts-nocheck
import { useState, useEffect } from 'react'
import { Trash2, Upload, Loader2, Download, Eye, Image as ImageIcon, Save, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DocumentViewer } from './DocumentViewer'
import { DocumentType } from '../types'
import { useToast } from '@/hooks/use-toast'
import { mpesaMessageToPdf, formatMpesaMessage } from '../utils/pdfUtils'
import { supabase } from '@/lib/supabase'
import { performExtraction } from '@/lib/extractionUtils'

interface DocumentUploadDialogProps {
    documentType: DocumentType;
    recordId: string;
    onUpload: (file: File, docType?: DocumentType) => Promise<string | void>;
    onDelete: (docType?: DocumentType) => Promise<void>;
    existingDocument: string | null;
    label: string;
    isNilFiling: boolean;
    allDocuments?: {
        type: DocumentType;
        label: string;
        status: 'missing' | 'uploaded';
        path: string | null;
    }[];
    companyName: string;
}

// Preview & Extraction Dialog Component
const PreviewExtractionDialog = ({
    isOpen,
    onClose,
    documents,
    companyName,
    recordId
}: {
    isOpen: boolean;
    onClose: () => void;
    documents: Array<{
        file: File;
        type: DocumentType;
        label: string;
        extractions: {
            amount: string | null;
            payment_date: string | null;
            payment_mode: string | null;
            bank_name: string | null;
        };
    }>;
    companyName: string;
    recordId: string;
}) => {
    const { toast } = useToast()
    const [activeDoc, setActiveDoc] = useState(0)
    const [loading, setLoading] = useState(false)
    const [localDocs, setLocalDocs] = useState(documents)

    const handleExtract = async (file: File) => {
        setLoading(true)
        try {
            // Get file URL for extraction
            const fileUrl = URL.createObjectURL(file);

            const fields = [
                { name: 'amount', type: 'string', required: true },
                { name: 'payment_date', type: 'date', required: true },
                { name: 'payment_mode', type: 'string', required: true },
                { name: 'bank_name', type: 'string', required: true }
            ];

            const result = await performExtraction(
                fileUrl,
                fields,
                'payment_receipt',
                (message) => console.log('Extraction progress:', message)
            );

            if (result.success) {
                setLocalDocs(docs =>
                    docs.map((doc, i) =>
                        i === activeDoc ? {
                            ...doc,
                            extractions: {
                                amount: result.extractedData.amount,
                                payment_date: result.extractedData.payment_date,
                                payment_mode: result.extractedData.payment_mode,
                                bank_name: result.extractedData.bank_name
                            }
                        } : doc
                    )
                );

                toast({
                    title: "Success",
                    description: "Document data extracted successfully"
                });
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to extract document data",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const currentDoc = localDocs[activeDoc];
            const docType = `${currentDoc.type}_receipt`;

            // Update the database with extracted data
            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_receipts_extractions: {
                        [docType]: currentDoc.extractions
                    }
                })
                .eq('id', recordId);

            if (error) throw error;

            toast({
                title: "Success",
                description: "Extractions saved successfully"
            });

            // Move to next document if available
            if (activeDoc < localDocs.length - 1) {
                setActiveDoc(prevDoc => prevDoc + 1);
            } else {
                // If this was the last document, close the dialog
                onClose();
            }

        } catch (error) {
            console.error('Save error:', error);
            toast({
                title: "Error",
                description: "Failed to save extractions",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
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
                    {/* Column 1 - Document list */}
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
                                        {doc.extractions.amount && (
                                            <Badge variant="success" className="text-xs">
                                                Extracted
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </ScrollArea>
                    </div>

                    {/* Column 2 - Document preview */}
                    <div className="col-span-3 border rounded bg-white overflow-hidden">
                        <iframe
                            src={URL.createObjectURL(localDocs[activeDoc].file)}
                            className="w-full h-full"
                            title={localDocs[activeDoc].label}
                        />
                    </div>

                    {/* Column 3 - Extraction data */}
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
                                    className="w-full" // Make buttons full width
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
                                    className="w-full" // Make buttons full width
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 mr-1" />
                                            {activeDoc < localDocs.length - 1 ? 'Save & Next' : 'Save & Close'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3 flex-grow"> {/* Use flex-grow to take up remaining space */}
                            <div className="space-y-1">
                                <Label htmlFor="amount" className="text-xs">Amount</Label>
                                <Input
                                    id="amount"
                                    value={localDocs[activeDoc].extractions.amount || ''}
                                    onChange={(e) => {
                                        setLocalDocs(docs =>
                                            docs.map((doc, i) =>
                                                i === activeDoc
                                                    ? {
                                                        ...doc,
                                                        extractions: {
                                                            ...doc.extractions,
                                                            amount: e.target.value
                                                        }
                                                    }
                                                    : doc
                                            )
                                        )
                                    }}
                                    placeholder="Enter amount..."
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="payment_date" className="text-xs">Payment Date</Label>
                                <Input
                                    id="payment_date"
                                    value={localDocs[activeDoc].extractions.payment_date || ''}
                                    onChange={(e) => {
                                        setLocalDocs(docs =>
                                            docs.map((doc, i) =>
                                                i === activeDoc
                                                    ? {
                                                        ...doc,
                                                        extractions: {
                                                            ...doc.extractions,
                                                            payment_date: e.target.value
                                                        }
                                                    }
                                                    : doc
                                            )
                                        )
                                    }}
                                    placeholder="DD/MM/YYYY"
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="payment_mode" className="text-xs">Payment Mode</Label>
                                <Input
                                    id="payment_mode"
                                    value={localDocs[activeDoc].extractions.payment_mode || ''}
                                    onChange={(e) => {
                                        setLocalDocs(docs =>
                                            docs.map((doc, i) =>
                                                i === activeDoc
                                                    ? {
                                                        ...doc,
                                                        extractions: {
                                                            ...doc.extractions,
                                                            payment_mode: e.target.value
                                                        }
                                                    }
                                                    : doc
                                            )
                                        )
                                    }}
                                    placeholder="Enter payment mode..."
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="bank_name" className="text-xs">Bank Name</Label>
                                <Input
                                    id="bank_name"
                                    value={localDocs[activeDoc].extractions.bank_name || ''}
                                    onChange={(e) => {
                                        setLocalDocs(docs =>
                                            docs.map((doc, i) =>
                                                i === activeDoc
                                                    ? {
                                                        ...doc,
                                                        extractions: {
                                                            ...doc.extractions,
                                                            bank_name: e.target.value
                                                        }
                                                    }
                                                    : doc
                                            )
                                        )
                                    }}
                                    placeholder="Enter bank name..."
                                    className="text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export function DocumentUploadDialog({
    documentType,
    recordId,
    onUpload,
    onDelete,
    existingDocument,
    label,
    isNilFiling,
    allDocuments,
    companyName
}: DocumentUploadDialogProps) {
    const { toast } = useToast()
    const [uploadDialog, setUploadDialog] = useState(false)
    const [confirmUploadDialog, setConfirmUploadDialog] = useState(false)
    const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [selectedDocType, setSelectedDocType] = useState<DocumentType | undefined>()
    const [activeTab, setActiveTab] = useState("single")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isConverting, setIsConverting] = useState(false)
    const [viewerOpen, setViewerOpen] = useState(false)

    // States for document processing
    const [processedDocs, setProcessedDocs] = useState<Array<{
        file: File;
        type: DocumentType;
        label: string;
        extractions: {
            amount: string | null;
            payment_date: string | null;
            payment_mode: string | null;
            bank_name: string | null;
        };
    }>>([])

    // Preview & Extraction dialog state
    const [previewDialog, setPreviewDialog] = useState(false)

    const handleFileSelect = async (file: File, docType?: DocumentType) => {
        try {
            let processedFile = file;

            // Convert image to PDF if needed
            if (file.type.startsWith('image/')) {
                setIsConverting(true);
                processedFile = await convertImageToPdf(file);
                setIsConverting(false);
            }

            setSelectedFile(processedFile);
            setSelectedDocType(docType);

            // Initial extraction
            const extractedData = {
                amount: null,
                payment_date: null,
                payment_mode: null,
                bank_name: null
            };

            setProcessedDocs([{
                file: processedFile,
                type: docType || documentType,
                label: label,
                extractions: extractedData
            }]);

            setConfirmUploadDialog(true);
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to process file",
                variant: "destructive"
            });
        }
    };

    const handleBulkFileSelect = async (file: File, docType: DocumentType, label: string) => {
        try {
            let processedFile = file;

            if (file.type.startsWith('image/')) {
                setIsConverting(true);
                processedFile = await convertImageToPdf(file);
                setIsConverting(false);
            }

            const extractedData = {
                amount: null,
                payment_date: null,
                payment_mode: null,
                bank_name: null
            };

            setProcessedDocs(prev => [
                ...prev,
                {
                    file: processedFile,
                    type: docType,
                    label,
                    extractions: extractedData
                }
            ]);

        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to process file",
                variant: "destructive"
            });
        }
    };

    const handleSaveExtractions = async (
        recordId: string,
        docType: DocumentType,
        extractions: any
    ) => {
        try {
            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_slips_extractions: {
                        [docType]: extractions
                    }
                })
                .eq('id', recordId);

            if (error) throw error;

            toast({
                title: "Success",
                description: "Extractions saved successfully"
            });
        } catch (error) {
            console.error('Error saving extractions:', error);
            toast({
                title: "Error",
                description: "Failed to save extractions",
                variant: "destructive"
            });
            throw error;
        }
    };

    const handleConfirmUpload = async () => {
        if (!selectedFile) return;

        try {
            setIsSubmitting(true);

            // Upload file
            await onUpload(selectedFile, selectedDocType);

            // Open preview dialog for extractions
            setPreviewDialog(true);
            setSelectedFile(null);
            setSelectedDocType(undefined);
            setConfirmUploadDialog(false);
            setUploadDialog(false);

            toast({
                title: "Success",
                description: "Document uploaded successfully"
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to upload document",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkSubmit = async () => {
        if (processedDocs.length === 0) {
            toast({
                title: "No files selected",
                description: "Please select at least one file to upload",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);
        try {
            // Upload all files
            for (const doc of processedDocs) {
                await onUpload(doc.file, doc.type);
            }

            // Open preview dialog for extractions
            setUploadDialog(false);
            setPreviewDialog(true);

            toast({
                title: "Success",
                description: `Successfully uploaded ${processedDocs.length} documents`
            });
        } catch (error) {
            console.error('Bulk upload error:', error);
            toast({
                title: "Error",
                description: "Failed to complete the upload process",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        try {
            await onDelete(selectedDocType);
            setConfirmDeleteDialog(false);
            toast({
                title: "Success",
                description: "Document deleted successfully"
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete document",
                variant: "destructive"
            });
        }
    };

    const handleView = async (path: string) => {
        try {
            setViewerOpen(true);
        } catch (error) {
            console.error('Error viewing document:', error);
            toast({
                title: "Error",
                description: "Failed to view document",
                variant: "destructive"
            });
        }
    };

    if (isNilFiling) {
        return (
            <Button
                size="sm"
                className="bg-purple-700 hover:bg-purple-600 h-6 text-xs px-2"
                disabled
            >
                NIL
            </Button>
        );
    }

    return (
        <div className="flex gap-1">
            <Button
                size="sm"
                className={existingDocument
                    ? "bg-green-500 hover:bg-green-600 h-6 text-xs px-2"
                    : "bg-yellow-500 hover:bg-yellow-600 h-6 text-xs px-2"}
                onClick={() => existingDocument ? handleView(existingDocument) : setUploadDialog(true)}
            >
                {existingDocument ? 'View' : 'Missing'}
            </Button>

            {existingDocument && (
                <>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2"
                        onClick={() => handleView(existingDocument)}
                    >
                        <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                        size="sm"
                        variant="destructive"
                        className="h-6 text-xs px-2"
                        onClick={() => setConfirmDeleteDialog(true)}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </>
            )}

            {/* Original Upload Dialog */}
            {/* Original Upload Dialog */}
            <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader className="pb-2 border-b">
                        <div className="flex justify-between items-end">
                            <DialogTitle className="text-lg font-semibold text-blue-600">
                                {companyName}
                            </DialogTitle>
                        </div>
                    </DialogHeader>

                    <div className="mt-4">
                        <Tabs defaultValue="single" className="w-full" onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="single">Single Upload</TabsTrigger>
                                <TabsTrigger value="bulk">Document Management</TabsTrigger>
                            </TabsList>

                            <TabsContent value="single" className="space-y-4 mt-4">
                                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Upload {label}
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Select File</Label>
                                            <Input
                                                type="file"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) handleFileSelect(file)
                                                }}
                                                accept=".pdf,.jpg,.jpeg,.png"
                                            />
                                        </div>
                                        {existingDocument && (
                                            <div className="pt-4 border-t">
                                                <h4 className="text-sm font-medium text-gray-900 mb-2">Current Document</h4>
                                                <div className="flex items-center gap-2 bg-white p-2 rounded border">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="text-sm text-gray-600 flex-1">
                                                        {existingDocument.split('/').pop()}
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2 gap-1"
                                                        onClick={() => handleView(existingDocument)}
                                                    >
                                                        <Eye className="h-3 w-3" />
                                                        <span className="text-xs">View</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="bulk" className="space-y-4 mt-4">
                                {allDocuments && allDocuments.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <h4 className="text-sm font-semibold text-gray-900 mb-4">Document Management</h4>
                                            <div className="divide-y">
                                                {allDocuments.map((doc) => (
                                                    <div key={doc.type} className="py-3 first:pt-0 last:pb-0">
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="min-w-[150px]">
                                                                <h4 className="font-medium text-sm">{doc.label}</h4>
                                                                <p className="text-sm text-gray-500">
                                                                    <span className={doc.status === 'missing' ? 'text-yellow-500' : 'text-green-500'}>
                                                                        {doc.status === 'missing' ? 'Missing' : 'Uploaded'}
                                                                    </span>
                                                                </p>
                                                            </div>
                                                            <Input
                                                                type="file"
                                                                className="flex-1"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) handleBulkFileSelect(file, doc.type, doc.label);
                                                                }}
                                                                accept=".pdf,.jpg,.jpeg,.png"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {processedDocs.length > 0 && (
                                            <Button
                                                onClick={handleBulkSubmit}
                                                disabled={isSubmitting}
                                                className="w-full"
                                            >
                                                {isSubmitting ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Uploading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="mr-2 h-4 w-4" />
                                                        Upload Selected ({processedDocs.length})
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-gray-500">
                                        No documents to manage
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Preview & Extraction Dialog */}
            {previewDialog && (
                <PreviewExtractionDialog
                    isOpen={previewDialog}
                    onClose={() => setPreviewDialog(false)}
                    documents={processedDocs}
                    companyName={companyName}
                    onSaveExtractions={handleSaveExtractions}
                    recordId={recordId}
                />
            )}

            {existingDocument && (
                <DocumentViewer
                    url={existingDocument}
                    isOpen={viewerOpen}
                    onClose={() => setViewerOpen(false)}
                    title={label}
                    companyName={companyName}
                />
            )}

            <AlertDialog open={confirmDeleteDialog} onOpenChange={setConfirmDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this document? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}