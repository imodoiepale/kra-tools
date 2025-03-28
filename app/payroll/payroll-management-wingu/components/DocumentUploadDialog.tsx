// @ts-nocheck
import { useState } from 'react'
import { Trash2, Upload, Loader2, Download, Building2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
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
import { DocumentType } from '../../../types'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { DocumentViewer } from '../../components/DocumentViewer'


interface DocumentUploadDialogProps {
    documentType: DocumentType;
    recordId: string;
    onUpload: (file: File, docType?: DocumentType) => Promise<string | void>;
    onDelete: (docType?: DocumentType) => Promise<void>;
    existingDocument: string | null;
    label: string;
    isNilFiling: boolean;
    companyName: string;
    allDocuments?: {
        type: DocumentType;
        label: string;
        status: 'missing' | 'uploaded';
        path: string | null;
    }[];
}

export function DocumentUploadDialog({
    documentType,
    onUpload,
    onDelete,
    existingDocument,
    label,
    isNilFiling,
    companyName,
    allDocuments
}: DocumentUploadDialogProps) {
    const [uploadDialog, setUploadDialog] = useState(false)
    const [confirmUploadDialog, setConfirmUploadDialog] = useState(false)
    const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [selectedDocType, setSelectedDocType] = useState<DocumentType | undefined>()
    const [activeTab, setActiveTab] = useState("single")
    const [bulkFiles, setBulkFiles] = useState<Map<DocumentType, { file: File; label: string }>>(new Map());
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isViewerOpen, setIsViewerOpen] = useState(false)
    const { toast } = useToast()

    const getFileExtension = (path: string): string => {
        return path.split('.').pop()?.toLowerCase() || '';
    }

    const getDocumentType = (path: string): string => {
        const ext = getFileExtension(path);
        switch (ext) {
            case 'pdf':
                return 'PDF';
            case 'csv':
                return 'CSV';
            case 'xls':
            case 'xlsx':
                return 'Excel';
            case 'zip':
                return 'ZIP';
            default:
                return 'Document';
        }
    }

    const handleFileSelect = (file: File, docType?: DocumentType) => {
        setSelectedFile(file)
        setSelectedDocType(docType)
        setConfirmUploadDialog(true)
    }

    const handleBulkFileSelect = (file: File, docType: DocumentType, label: string) => {
        // Create a new Map to avoid mutating state directly
        const newBulkFiles = new Map(bulkFiles);
        newBulkFiles.set(docType, { file, label });
        setBulkFiles(newBulkFiles);
    };

    const handleConfirmUpload = async () => {
        if (!selectedFile) return

        try {
            setIsSubmitting(true)
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
        } finally {
            setIsSubmitting(false)
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
        const uploadResults = new Map<DocumentType, string>();

        try {
            // Get current document paths
            const currentPaths = new Map(
                allDocuments?.map(doc => [doc.type, doc.path]) || []
            );

            // Upload files one by one while preserving existing paths
            for (const [docType, { file }] of bulkFiles.entries()) {
                try {
                    const result = await onUpload(file, docType);
                    if (result) {
                        uploadResults.set(docType, result as string);
                        successCount++;
                    }
                } catch (error) {
                    errorCount++;
                    errors.push(`${docType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    // Keep existing path if upload fails
                    if (currentPaths.has(docType)) {
                        uploadResults.set(docType, currentPaths.get(docType)!);
                    }
                }
            }

            // Update UI based on results
            if (successCount > 0) {
                toast({
                    title: "Upload Complete",
                    description: `Successfully uploaded ${successCount} document${successCount > 1 ? 's' : ''}${errorCount > 0 ? `. Failed to upload ${errorCount} document${errorCount > 1 ? 's' : ''}.` : ''}`
                });

                // Only remove successfully uploaded files from bulkFiles
                const updatedBulkFiles = new Map(bulkFiles);
                for (const [docType] of bulkFiles.entries()) {
                    if (uploadResults.has(docType)) {
                        updatedBulkFiles.delete(docType);
                    }
                }
                setBulkFiles(updatedBulkFiles);

                // Only close dialog if everything was successful
                if (errorCount === 0) {
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
                toast({
                    title: "Upload Errors",
                    description: "Some documents failed to upload. Check the console for details.",
                    variant: "destructive"
                });
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
        <>
            <div className="flex gap-1">
                <Button
                    size="sm"
                    className={existingDocument
                        ? "bg-green-500 hover:bg-green-600 h-6 text-xs px-2"
                        : "bg-yellow-500 hover:bg-yellow-600 h-6 text-xs px-2"}
                    onClick={() => existingDocument ? setIsViewerOpen(true) : setUploadDialog(true)}
                >
                    {existingDocument ? (
                        <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            <span>{getDocumentType(existingDocument)}</span>
                        </div>
                    ) : (
                        'Missing'
                    )}
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
            </div>

            {/* Document Viewer Dialog */}
            {existingDocument && (
                <DocumentViewer
                    url={existingDocument}
                    isOpen={isViewerOpen}
                    onClose={() => setIsViewerOpen(false)}
                    title={`${label} (${getDocumentType(existingDocument)})`}
                    companyName={companyName}
                />
            )}

            <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Building2 className="h-5 w-5 text-blue-500" />
                            <span className="text-lg font-semibold text-blue-700">{companyName}</span>
                        </div>
                        <DialogTitle>{existingDocument ? 'View/Replace' : 'Upload'} {label}</DialogTitle>
                        <DialogDescription>
                            {existingDocument
                                ? 'Current document is uploaded. You can view or replace it.'
                                : `Select a file to upload for ${label}`
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="single" className="w-full" onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="single">Single Upload</TabsTrigger>
                            <TabsTrigger value="bulk">Bulk Management</TabsTrigger>
                        </TabsList>

                        <TabsContent value="single" className="space-y-4">
                            <div className="space-y-2">
                                <Label>File</Label>
                                <Input
                                    type="file"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                            handleFileSelect(file, documentType)
                                        }
                                    }}
                                    accept={documentType.includes('csv') ? '.csv, .zip, .pdf' : '.xlsx, .xls, .zip, .pdf'}
                                />
                                {isSubmitting && (
                                    <div className="flex items-center gap-2 text-sm text-blue-500">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Uploading...</span>
                                    </div>
                                )}
                            </div>
                            {existingDocument && (
                                <div className="space-y-2">
                                    <Label>Current Document</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">
                                            {existingDocument.split('/').pop()}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDownload(existingDocument)}
                                        >
                                            <Download className="h-3 w-3 mr-1" />
                                            Download
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="bulk" className="space-y-4">
                            {allDocuments && allDocuments.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="bg-purple-50 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-4">
                                            <Upload className="h-4 w-4 text-blue-500" />
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
                                                                accept={doc.type.includes('csv') ? '.csv, .zip, .pdf' : '.xlsx, .xls, .zip, .pdf'}
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
                                    <div className="flex justify-end mt-6">
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
                                                    Upload Selected Documents ({bulkFiles.size})
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

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUploadDialog(false)}>
                            Close
                        </Button>
                    </DialogFooter>
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
        </>
    )
}