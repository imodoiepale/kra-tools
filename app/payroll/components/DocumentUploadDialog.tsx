// @ts-nocheck

import { useState } from 'react';
import { Trash2, Upload, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DocumentViewer } from './DocumentViewer';
import { DocumentPreview } from './DocumentPreview';
import { DocumentType } from '../types';
import { useDocumentManagement } from '../hooks/useDocumentManagement';
import { validateMpesaMessage, DocumentInfo } from '../utils/documentUtils';

interface DocumentUploadDialogProps {
    documentType: DocumentType;
    recordId: string;
    onUpload: (file: File, docType?: DocumentType) => Promise<string | void>;
    onDelete: (docType?: DocumentType) => Promise<void>;
    existingDocument: string | null;
    label: string;
    isNilFiling: boolean;
    allDocuments?: DocumentInfo[];
    companyName: string;
}

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
    const [uploadDialog, setUploadDialog] = useState(false);
    const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedDocType, setSelectedDocType] = useState<DocumentType | undefined>();
    const [activeTab, setActiveTab] = useState("single");
    const [bulkFiles, setBulkFiles] = useState<Map<DocumentType, { file: File; label: string }>>(new Map());
    const [mpesaMessages, setMpesaMessages] = useState<Map<DocumentType, { message: string; label: string }>>(new Map());
    const [mpesaMessage, setMpesaMessage] = useState('');
    const [mpesaValidationError, setMpesaValidationError] = useState('');
    const [viewerOpen, setViewerOpen] = useState(false);
    const [previewDialog, setPreviewDialog] = useState(false);
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
    }>>([]);

    const {
        isSubmitting,
        isConverting,
        bulkUploadProgress,
        setBulkUploadProgress,
        handleFileUpload,
        handleMpesaUpload,
        handleDelete: deleteDocument,
        handleDownload,
    } = useDocumentManagement({
        onUpload,
        onDelete,
        companyName
    });

    const handleFileSelect = async (file: File, docType?: DocumentType) => {
        try {
            const processedFile = await handleFileUpload(file, docType);
            setSelectedFile(processedFile);
            setSelectedDocType(docType);

            setProcessedDocs([{
                file: processedFile,
                type: docType || documentType,
                label: label,
                extractions: {
                    amount: null,
                    payment_date: null,
                    payment_mode: null,
                    bank_name: null
                }
            }]);

            setPreviewDialog(true);
            setUploadDialog(false);
        } catch (error) {
            console.error('Error selecting file:', error);
        }
    };

    const handleBulkFileSelect = async (file: File, docType: DocumentType, label: string) => {
        try {
            const processedFile = await handleFileUpload(file, docType);
            setBulkFiles(new Map(bulkFiles.set(docType, { file: processedFile, label })));

            const newMessages = new Map(mpesaMessages);
            newMessages.delete(docType);
            setMpesaMessages(newMessages);
        } catch (error) {
            console.error('Error selecting bulk file:', error);
        }
    };

    const handleBulkSubmit = async () => {
        if (bulkFiles.size === 0 && mpesaMessages.size === 0) return;

        setIsSubmitting(true);
        const totalItems = bulkFiles.size + mpesaMessages.size;
        const processedDocuments: typeof processedDocs = [];
        let successCount = 0;

        try {
            // Process MPESA messages
            for (const [docType, { message, label }] of mpesaMessages.entries()) {
                try {
                    const file = await handleMpesaUpload(message, docType, label);
                    successCount++;
                    setBulkUploadProgress((successCount / totalItems) * 100);

                    processedDocuments.push({
                        file,
                        type: docType,
                        label,
                        extractions: {
                            amount: null,
                            payment_date: null,
                            payment_mode: null,
                            bank_name: null
                        }
                    });
                } catch (error) {
                    console.error(`Error processing MPESA message for ${docType}:`, error);
                }
            }

            // Process files
            for (const [docType, { file, label }] of bulkFiles.entries()) {
                try {
                    const processedFile = await handleFileUpload(file, docType);
                    successCount++;
                    setBulkUploadProgress((successCount / totalItems) * 100);

                    processedDocuments.push({
                        file: processedFile,
                        type: docType,
                        label,
                        extractions: {
                            amount: null,
                            payment_date: null,
                            payment_mode: null,
                            bank_name: null
                        }
                    });
                } catch (error) {
                    console.error(`Error processing file for ${docType}:`, error);
                }
            }

            if (processedDocuments.length > 0) {
                setBulkFiles(new Map());
                setMpesaMessages(new Map());
                setProcessedDocs(processedDocuments);
                setPreviewDialog(true);
                setUploadDialog(false);
            }
        } catch (error) {
            console.error('Bulk processing error:', error);
        } finally {
            setIsSubmitting(false);
            setBulkUploadProgress(0);
        }
    };

    const handleMpesaMessageChange = (message: string, docType?: DocumentType) => {
        const error = validateMpesaMessage(message);
        setMpesaValidationError(error);

        if (docType) {
            if (message.trim()) {
                setMpesaMessages(new Map(mpesaMessages.set(docType, {
                    message,
                    label: allDocuments?.find(d => d.type === docType)?.label || ''
                })));
            } else {
                const newMessages = new Map(mpesaMessages);
                newMessages.delete(docType);
                setMpesaMessages(newMessages);
            }
        } else {
            setMpesaMessage(message);
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
                onClick={() => existingDocument ? setViewerOpen(true) : setUploadDialog(true)}
            >
                {existingDocument ? 'View' : 'Missing'}
            </Button>

            {existingDocument && (
                <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 text-xs px-2"
                    onClick={() => setConfirmDeleteDialog(true)}
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            )}

            <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader className="pb-2 border-b">
                        <DialogTitle className="text-lg font-semibold text-blue-600">
                            {companyName}
                        </DialogTitle>
                    </DialogHeader>

                    <Tabs defaultValue="single" className="w-full" onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="single">Single Upload</TabsTrigger>
                            <TabsTrigger value="bulk">Document Management</TabsTrigger>
                        </TabsList>

                        <TabsContent value="single" className="space-y-4 mt-4">
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-gray-900">Upload {label}</h4>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Select File</Label>
                                        <Input
                                            type="file"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleFileSelect(file);
                                            }}
                                            accept={documentType.includes('pdf') ? '.pdf' : '.pdf,.jpg,.jpeg,.png'}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Or Paste MPESA Message</Label>
                                        <Textarea
                                            value={mpesaMessage}
                                            onChange={(e) => handleMpesaMessageChange(e.target.value)}
                                            placeholder="Paste your MPESA message here..."
                                            className="min-h-[100px]"
                                        />
                                        {mpesaValidationError && (
                                            <div className="text-sm text-red-500">
                                                {mpesaValidationError}
                                            </div>
                                        )}
                                        <Button
                                            onClick={() => handleMpesaUpload(mpesaMessage)}
                                            disabled={!mpesaMessage.trim() || isConverting}
                                            className="w-full"
                                        >
                                            {isConverting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Converting...
                                                </>
                                            ) : (
                                                'Convert & Upload'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="bulk" className="space-y-4 mt-4">
                            {allDocuments && allDocuments.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-4">
                                            Document Management
                                        </h4>
                                        <div className="divide-y">
                                            {allDocuments.map((doc) => (
                                                <div key={doc.type} className="py-3 first:pt-0 last:pb-0">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="min-w-[150px]">
                                                            <h4 className="font-medium text-sm">{doc.label}</h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                <span className={doc.status === 'missing' ? 'text-yellow-500' : 'text-green-500'}>
                                                                    {doc.status === 'missing' ? 'Missing' : 'Uploaded'}
                                                                </span>
                                                                {(bulkFiles.has(doc.type) || mpesaMessages.has(doc.type)) && (
                                                                    <span className="ml-2 text-blue-500">
                                                                        (New {bulkFiles.has(doc.type) ? 'file' : 'message'} selected)
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-2 items-center flex-1">
                                                            <div className="flex gap-2 flex-1">
                                                                <Input
                                                                    type="file"
                                                                    className="flex-1"
                                                                    accept={doc.type.includes('pdf') ? '.pdf' : '.pdf,.jpg,.jpeg,.png'}
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            handleBulkFileSelect(file, doc.type, doc.label);
                                                                        }
                                                                    }}
                                                                />
                                                                <Textarea
                                                                    placeholder="Paste MPESA message..."
                                                                    className="flex-1 h-[38px] min-h-[38px]"
                                                                    value={mpesaMessages.get(doc.type)?.message || ''}
                                                                    onChange={(e) => handleMpesaMessageChange(e.target.value, doc.type)}
                                                                />
                                                            </div>
                                                            {doc.path && (
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 px-2 gap-1"
                                                                        onClick={() => handleDownload(doc.path!)}
                                                                    >
                                                                        <Download className="h-3 w-3" />
                                                                        <span className="text-xs">Download</span>
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        className="h-7 px-2"
                                                                        onClick={() => {
                                                                            setSelectedDocType(doc.type);
                                                                            setConfirmDeleteDialog(true);
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        {(mpesaMessages.size > 0 || bulkFiles.size > 0) && (
                                            <Button
                                                onClick={handleBulkSubmit}
                                                disabled={isSubmitting || isConverting}
                                                className="bg-blue-500 hover:bg-blue-600"
                                            >
                                                {isSubmitting || isConverting ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        {isConverting ? 'Converting...' : 'Uploading...'}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="mr-2 h-4 w-4" />
                                                        Process All ({mpesaMessages.size + bulkFiles.size} items)
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                    {(isSubmitting || isConverting) && bulkUploadProgress > 0 && (
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div
                                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                                style={{ width: `${bulkUploadProgress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted-foreground">
                                    No documents to manage
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmDeleteDialog} onOpenChange={setConfirmDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the document.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => deleteDocument(selectedDocType)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {existingDocument && (
                <DocumentViewer
                    url={existingDocument}
                    isOpen={viewerOpen}
                    onClose={() => setViewerOpen(false)}
                    title={label}
                    companyName={companyName}
                />
            )}

            <DocumentPreview
                isOpen={previewDialog}
                onClose={() => setPreviewDialog(false)}
                documents={processedDocs}
                companyName={companyName}
            />
        </div>
    );
}
