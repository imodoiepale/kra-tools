// @ts-nocheck
import { useState } from 'react'
import { Trash2, Upload, Loader2, Download } from 'lucide-react'
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
import { DocumentType } from '../types'
import { useToast } from '@/hooks/use-toast'

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

export function DocumentUploadDialog({
    documentType,
    onUpload,
    onDelete,
    existingDocument,
    label,
    isNilFiling,
    allDocuments,
    companyName
}: DocumentUploadDialogProps) {
    const [uploadDialog, setUploadDialog] = useState(false)
    const [confirmUploadDialog, setConfirmUploadDialog] = useState(false)
    const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [selectedDocType, setSelectedDocType] = useState<DocumentType | undefined>()
    const [activeTab, setActiveTab] = useState("single")
    const [bulkFiles, setBulkFiles] = useState<Map<DocumentType, { file: File; label: string }>>(new Map());
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { toast } = useToast()

    const handleFileSelect = (file: File, docType?: DocumentType) => {
        setSelectedFile(file)
        setSelectedDocType(docType)
        setConfirmUploadDialog(true)
    }

    const handleBulkFileSelect = (file: File, docType: DocumentType, label: string) => {
        setBulkFiles(new Map(bulkFiles.set(docType, { file, label })));
    };

    const handleConfirmUpload = async () => {
        if (!selectedFile) return

        try {
            await onUpload(selectedFile, selectedDocType)
            setSelectedFile(null)
            setSelectedDocType(undefined)
            setConfirmUploadDialog(false)
            setUploadDialog(false)
            toast({
                title: "Success",
                description: "Document uploaded successfully"
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to upload document",
                variant: "destructive"
            })
        }
    }

    const handleBulkSubmit = async () => {
        if (bulkFiles.size === 0) {
            toast({
                title: "No files selected",
                description: "Please select at least one file to upload",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        try {
            for (const [docType, { file }] of bulkFiles.entries()) {
                try {
                    await onUpload(file, docType);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    errors.push(`${docType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            if (successCount > 0) {
                toast({
                    title: "Upload Complete",
                    description: `Successfully uploaded ${successCount} document${successCount > 1 ? 's' : ''}${errorCount > 0 ? `. Failed to upload ${errorCount} document${errorCount > 1 ? 's' : ''}.` : ''}`
                });

                if (errorCount === 0) {
                    setBulkFiles(new Map());
                    setUploadDialog(false);
                }
            } else {
                toast({
                    title: "Upload Failed",
                    description: "Failed to upload any documents. Please try again.",
                    variant: "destructive"
                });
            }

            if (errors.length > 0) {
                console.error('Bulk upload errors:', errors);
            }
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
            await onDelete(selectedDocType)
            setConfirmDeleteDialog(false)
            toast({
                title: "Success",
                description: "Document deleted successfully"
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete document",
                variant: "destructive"
            })
        }
    }

    const handleDownload = async (path: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('Payroll-Cycle')
                .download(path);

            if (error) throw error;

            // Create a download link
            const url = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = path.split('/').pop() || 'document';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast({
                title: "Success",
                description: "Document downloaded successfully"
            });
        } catch (error) {
            console.error('Download error:', error);
            toast({
                title: "Error",
                description: "Failed to download document",
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
        )
    }

    return (
        <div className="flex gap-1">
            <Button
                size="sm"
                className={existingDocument
                    ? "bg-green-500 hover:bg-green-600 h-6 text-xs px-2"
                    : "bg-yellow-500 hover:bg-yellow-600 h-6 text-xs px-2"}
                onClick={() => setUploadDialog(true)}
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
                                                accept={documentType.includes('pdf') ? '.pdf' : '.pdf, .zip'}
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
                                                        onClick={() => handleDownload(existingDocument!)}
                                                    >
                                                        <Download className="h-3 w-3" />
                                                        <span className="text-xs">Download</span>
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
                                            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-4">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
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
                                                                    {bulkFiles.has(doc.type) && (
                                                                        <span className="ml-2 text-blue-500">
                                                                            (New file selected)
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-2 items-center flex-1">
                                                                <Input
                                                                    type="file"
                                                                    className="flex-1"
                                                                    accept={doc.type.includes('pdf') ? '.pdf' : '.pdf,.zip'}
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) handleBulkFileSelect(file, doc.type, doc.label);
                                                                    }}
                                                                />
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
                                            <Button
                                                onClick={handleBulkSubmit}
                                                disabled={bulkFiles.size === 0 || isSubmitting}
                                                className="bg-blue-500 hover:bg-blue-600"
                                            >
                                                {isSubmitting ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Uploading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="mr-2 h-4 w-4" />
                                                        Upload Selected ({bulkFiles.size})
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-muted-foreground">
                                        No documents to manage
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmUploadDialog} onOpenChange={setConfirmUploadDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Upload</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to {existingDocument ? 'replace the existing document with' : 'upload'} {selectedFile?.name} for {label}?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedFile(null)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmUpload}>
                            Upload
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={confirmDeleteDialog} onOpenChange={setConfirmDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this document? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            Cancel
                        </AlertDialogCancel>
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
    )
}