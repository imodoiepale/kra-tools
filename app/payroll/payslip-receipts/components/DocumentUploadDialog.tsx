// @ts-nocheck
import { useState } from 'react'
import { Trash2, Upload, Loader2, Download, Eye, Image as ImageIcon } from 'lucide-react'
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
import { DocumentViewer } from './DocumentViewer'
import { DocumentType } from '../types'
import { useToast } from '@/hooks/use-toast'
import { mpesaMessageToPdf, formatMpesaMessage } from '../utils/pdfUtils'
import { supabase } from '@/lib/supabase'
import { PreviewExtractionDialog } from './PreviewExtractionDialog'

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
    recordId, // Make sure this prop is here
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
    const [mpesaMessages, setMpesaMessages] = useState<Map<DocumentType, { message: string; label: string }>>(new Map())
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isConverting, setIsConverting] = useState(false)
    const [uploadType, setUploadType] = useState<'file' | 'mpesa'>('file')
    const [mpesaMessage, setMpesaMessage] = useState('')
    const [mpesaPreview, setMpesaPreview] = useState('')
    const [mpesaValidationError, setMpesaValidationError] = useState('')
    const [bulkUploadProgress, setBulkUploadProgress] = useState(0)
    const [viewerOpen, setViewerOpen] = useState(false)

    const [previewDialog, setPreviewDialog] = useState(false)
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

    const { toast } = useToast()


    const [extractions, setExtractions] = useState<{
        amount: string | null;
        payment_date: string | null;
        payment_mode: string | null;
        bank_name: string | null;
    }>({
        amount: null,
        payment_date: null,
        payment_mode: null,
        bank_name: null
    });


    const convertImageToPdf = async (imageFile: File): Promise<File> => {
        try {
            // Validate input file
            if (!imageFile) {
                throw new Error('No image file provided');
            }
            
            if (!imageFile.type.startsWith('image/')) {
                throw new Error('File is not an image');
            }
            
            // Create a new canvas element
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }

            // Create an image element
            const img = new Image();
            const imageUrl = URL.createObjectURL(imageFile);

            // Wait for image to load with timeout
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Image loading timed out'));
                }, 30000); // 30 second timeout
                
                img.onload = () => {
                    clearTimeout(timeout);
                    resolve(null);
                };
                
                img.onerror = () => {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(imageUrl);
                    reject(new Error('Failed to load image'));
                };
                
                img.src = imageUrl;
            });

            // Check image dimensions
            if (img.width === 0 || img.height === 0) {
                URL.revokeObjectURL(imageUrl);
                throw new Error('Image has invalid dimensions');
            }

            // Set canvas dimensions to match image (with reasonable limits)
            const MAX_DIMENSION = 4000; // Prevent memory issues with very large images
            let width = img.width;
            let height = img.height;
            
            // Scale down if image is too large
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                const aspectRatio = width / height;
                if (width > height) {
                    width = MAX_DIMENSION;
                    height = Math.round(width / aspectRatio);
                } else {
                    height = MAX_DIMENSION;
                    width = Math.round(height * aspectRatio);
                }
            }
            
            canvas.width = width;
            canvas.height = height;

            // Draw image on canvas
            ctx.drawImage(img, 0, 0, width, height);

            try {
                // Convert canvas to PDF using jsPDF
                const { jsPDF } = await import('jspdf');
                
                // Determine orientation based on dimensions
                const orientation = width > height ? 'l' : 'p';
                
                // Create PDF with appropriate dimensions
                const pdf = new jsPDF({
                    orientation: orientation,
                    unit: 'px',
                    format: [width, height]
                });

                // Add the image to PDF with compression
                const imgData = canvas.toDataURL('image/jpeg', 0.8); // 80% quality for better file size
                pdf.addImage(imgData, 'JPEG', 0, 0, width, height);

                // Generate PDF blob
                const pdfBlob = pdf.output('blob');

                // Create a new File from the blob with a meaningful name
                const originalName = imageFile.name.split('.')[0] || 'image';
                const timestamp = new Date().getTime();
                const pdfFile = new File([pdfBlob], `${originalName}_${timestamp}.pdf`, {
                    type: 'application/pdf',
                    lastModified: Date.now()
                });

                // Cleanup
                URL.revokeObjectURL(imageUrl);

                return pdfFile;
            } catch (pdfError) {
                console.error('Error generating PDF:', pdfError);
                URL.revokeObjectURL(imageUrl);
                throw new Error('Failed to generate PDF from image');
            }
        } catch (error) {
            console.error('Error converting image to PDF:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to convert image to PDF');
        }
    };

    const handleFileSelect = async (file: File, docType?: DocumentType) => {
        try {
            if (!file) {
                toast({
                    title: "Error",
                    description: "No file selected",
                    variant: "destructive"
                });
                return;
            }

            // Validate file size (10MB limit)
            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
            if (file.size > MAX_FILE_SIZE) {
                toast({
                    title: "Error",
                    description: "File size exceeds 10MB limit",
                    variant: "destructive"
                });
                return;
            }

            // Validate file type (PDF or images only)
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                toast({
                    title: "Error",
                    description: "Only PDF and image files are allowed",
                    variant: "destructive"
                });
                return;
            }

            let processedFile = file;

            if (file.type.startsWith('image/')) {
                setIsConverting(true);
                try {
                    processedFile = await convertImageToPdf(file);
                } catch (error) {
                    console.error('Image conversion error:', error);
                    toast({
                        title: "Error",
                        description: "Failed to convert image to PDF",
                        variant: "destructive"
                    });
                    setIsConverting(false);
                    return;
                }
                setIsConverting(false);
            }

            setSelectedFile(processedFile);
            setSelectedDocType(docType);

            // Initialize extraction data
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
            console.error('File selection error:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to process file",
                variant: "destructive"
            });
        }
    };

    const handleBulkFileSelect = async (file: File, docType: DocumentType, label: string) => {
        try {
            if (!file) {
                toast({
                    title: "Error",
                    description: "No file selected",
                    variant: "destructive"
                });
                return;
            }

            // Validate file size (10MB limit)
            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
            if (file.size > MAX_FILE_SIZE) {
                toast({
                    title: "Error",
                    description: "File size exceeds 10MB limit",
                    variant: "destructive"
                });
                return;
            }

            // Validate file type (PDF or images only)
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                toast({
                    title: "Error",
                    description: "Only PDF and image files are allowed",
                    variant: "destructive"
                });
                return;
            }

            let processedFile = file;

            // Check if file is an image
            if (file.type.startsWith('image/')) {
                setIsConverting(true);
                try {
                    processedFile = await convertImageToPdf(file);
                } catch (error) {
                    console.error('Image conversion error:', error);
                    toast({
                        title: "Error",
                        description: "Failed to convert image to PDF",
                        variant: "destructive"
                    });
                    setIsConverting(false);
                    return;
                }
                setIsConverting(false);
            }

            // Update the bulk files map with the new file
            setBulkFiles(new Map(bulkFiles.set(docType, { file: processedFile, label })));

            // Clear any MPESA message for this type
            const newMessages = new Map(mpesaMessages);
            newMessages.delete(docType);
            setMpesaMessages(newMessages);
            
            toast({
                title: "File Ready",
                description: `${label} file prepared for upload`,
            });
        } catch (error) {
            console.error('Bulk file selection error:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to process file",
                variant: "destructive"
            });
        }
    };

    const handleConfirmUpload = async () => {
        if (!selectedFile) {
            toast({
                title: "Error",
                description: "No file selected",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);
        try {
            // Show upload in progress toast
            toast({
                title: "Uploading",
                description: "Document upload in progress..."
            });
            
            // Attempt to upload the file
            await onUpload(selectedFile, selectedDocType);
            
            // Clear the state after successful upload
            setConfirmUploadDialog(false);
            setUploadDialog(false);
            setSelectedFile(null);
            setSelectedDocType(undefined);
            
            toast({
                title: "Success",
                description: "Document uploaded successfully",
            });
        } catch (error) {
            console.error("Upload error:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to upload document",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkSubmit = async () => {
        if (bulkFiles.size === 0 && mpesaMessages.size === 0) {
            toast({
                title: "No items to process",
                description: "Please select files or enter MPESA messages to upload",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        const totalItems = bulkFiles.size + mpesaMessages.size;
        const processedDocuments: Array<{
            file: File;
            type: DocumentType;
            label: string;
            extractions: {
                amount: string | null;
                payment_date: string | null;
                payment_mode: string | null;
                bank_name: string | null;
            };
        }> = [];

        // Show initial progress toast
        toast({
            title: "Processing Documents",
            description: `Starting to process ${totalItems} document${totalItems > 1 ? 's' : ''}...`,
        });

        try {
            // Process MPESA messages first
            if (mpesaMessages.size > 0) {
                setIsConverting(true);
                for (const [docType, { message, label }] of mpesaMessages.entries()) {
                    try {
                        // Validate MPESA message
                        if (!message.trim()) {
                            errorCount++;
                            errors.push(`${docType}: MPESA message is empty`);
                            continue;
                        }

                        const fileName = `MPESA-RECEIPT-${docType}-${new Date().getTime()}.pdf`;
                        const pdfData = await mpesaMessageToPdf({
                            message,
                            fileName,
                            receiptName: `${label} - ${companyName}`
                        });

                        if (!pdfData) {
                            throw new Error('Failed to generate PDF');
                        }

                        const file = new File([pdfData], fileName, {
                            type: 'application/pdf',
                            lastModified: new Date().getTime()
                        });

                        // Update progress toast
                        toast({
                            title: "Processing",
                            description: `Uploading ${label} document (${successCount + 1}/${totalItems})...`,
                        });

                        await onUpload(file, docType);
                        successCount++;
                        setBulkUploadProgress((successCount / totalItems) * 100);

                        // Add to processed documents
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
                        errorCount++;
                        errors.push(`${docType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
                setIsConverting(false);
            }

            // Process files next
            if (bulkFiles.size > 0) {
                for (const [docType, { file, label }] of bulkFiles.entries()) {
                    try {
                        let processedFile = file;

                        // Convert image to PDF if needed
                        if (file.type.startsWith('image/')) {
                            setIsConverting(true);
                            try {
                                processedFile = await convertImageToPdf(file);
                            } catch (error) {
                                console.error(`Error converting image for ${docType}:`, error);
                                toast({
                                    title: "Error",
                                    description: "Failed to convert image to PDF",
                                    variant: "destructive"
                                });
                                setIsConverting(false);
                                errorCount++;
                                errors.push(`${docType}: Failed to convert image to PDF`);
                                continue;
                            }
                            setIsConverting(false);
                        }

                        // Update progress toast
                        toast({
                            title: "Processing",
                            description: `Uploading ${label} document (${successCount + 1}/${totalItems})...`,
                        });

                        await onUpload(processedFile, docType);
                        successCount++;
                        setBulkUploadProgress((successCount / totalItems) * 100);

                        // Add to processed documents
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
                        errorCount++;
                        errors.push(`${docType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            }

            if (successCount > 0) {
                toast({
                    title: "Upload Complete",
                    description: `Successfully processed ${successCount} item${successCount > 1 ? 's' : ''}${errorCount > 0 ? `. Failed to process ${errorCount} item${errorCount > 1 ? 's' : ''}.` : ''}`
                });

                if (errorCount === 0) {
                    setBulkFiles(new Map());
                    setMpesaMessages(new Map());
                    setUploadDialog(false);

                    // Show preview dialog with all processed documents
                    if (processedDocuments.length > 0) {
                        setProcessedDocs(processedDocuments);
                        setPreviewDialog(true);
                    }
                } else {
                    // If there were errors, show them
                    console.error('Upload errors:', errors);
                    toast({
                        title: "Warning",
                        description: `Some documents failed to upload. Check console for details.`,
                        variant: "destructive"
                    });
                }
            } else {
                toast({
                    title: "Upload Failed",
                    description: "Failed to process any items. Please try again.",
                    variant: "destructive"
                });
            }

            if (errors.length > 0) {
                console.error('Processing errors:', errors);
            }
        } catch (error) {
            console.error('Bulk processing error:', error);
            toast({
                title: "Error",
                description: "Failed to complete the process",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
            setIsConverting(false);
            setBulkUploadProgress(0);
        }
    };

    const validateMpesaMessage = (message: string) => {
        if (!message.trim()) {
            return 'Please enter an MPESA message'
        }
        return ''
    }

    const handleMpesaMessageChange = (message: string, docType?: DocumentType) => {
        const error = validateMpesaMessage(message)
        setMpesaValidationError(error)

        if (docType) {
            if (message.trim()) {
                setMpesaMessages(new Map(mpesaMessages.set(docType, {
                    message,
                    label: allDocuments?.find(d => d.type === docType)?.label || ''
                })))
            } else {
                const newMessages = new Map(mpesaMessages)
                newMessages.delete(docType)
                setMpesaMessages(newMessages)
            }
        } else {
            setMpesaMessage(message)
        }

        // Generate preview
        if (message.trim()) {
            try {
                const { formatted } = formatMpesaMessage(message)
                setMpesaPreview(formatted)
            } catch (error) {
                console.error('Error formatting MPESA message:', error)
                setMpesaPreview(message) // Fallback to original message if formatting fails
            }
        } else {
            setMpesaPreview('')
        }
    }

    const handleMpesaUpload = async () => {
        const error = validateMpesaMessage(mpesaMessage)
        if (error) {
            toast({
                title: "Validation Error",
                description: error,
                variant: "destructive"
            })
            return
        }

        setIsConverting(true)
        setIsSubmitting(true)
        try {
            // Step 1: Convert MPESA message to PDF using pdfme
            const fileName = `mpesa-receipt-${new Date().getTime()}.pdf`
            const pdfData = await mpesaMessageToPdf({
                message: mpesaMessage,
                fileName,
                receiptName: `${label} - ${companyName}`
            })

            if (!pdfData) {
                throw new Error('Failed to generate PDF from MPESA message')
            }

            // Step 2: Create a File object from the PDF data
            const file = new File([pdfData], fileName, {
                type: 'application/pdf',
                lastModified: new Date().getTime()
            })

            // Step 3: Upload the PDF file
            await onUpload(file, selectedDocType)

            // Step 4: Clear form and show success message
            setMpesaMessage('')
            setMpesaPreview('')
            setUploadDialog(false)
            toast({
                title: "Success",
                description: "MPESA receipt uploaded successfully"
            })
        } catch (error) {
            console.error('MPESA PDF generation error:', error)
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to process MPESA message",
                variant: "destructive"
            })
        } finally {
            setIsConverting(false)
            setIsSubmitting(false)
        }
    }

    const handleBulkMpesaUpload = async () => {
        if (mpesaMessages.size === 0) {
            toast({
                title: "No messages",
                description: "Please enter at least one MPESA message",
                variant: "destructive"
            })
            return
        }

        // Validate all messages first
        const errors: string[] = []
        for (const [docType, { message }] of mpesaMessages.entries()) {
            const error = validateMpesaMessage(message)
            if (error) {
                errors.push(`${docType}: ${error}`)
            }
        }

        if (errors.length > 0) {
            toast({
                title: "Validation Errors",
                description: "Please fix the following errors:\n" + errors.join('\n'),
                variant: "destructive"
            })
            return
        }

        setIsSubmitting(true)
        setIsConverting(true)
        let successCount = 0
        let errorCount = 0
        const processingErrors: string[] = []
        const total = mpesaMessages.size

        try {
            for (const [docType, { message, label }] of mpesaMessages.entries()) {
                try {
                    const fileName = `MPESA-RECEIPT-${docType}-${new Date().getTime()}.pdf`
                    const pdfData = await mpesaMessageToPdf({
                        message,
                        fileName,
                        receiptName: `${label} - ${companyName}`
                    })

                    if (!pdfData) {
                        throw new Error('Failed to generate PDF')
                    }

                    const file = new File([pdfData], fileName, {
                        type: 'application/pdf',
                        lastModified: new Date().getTime()
                    })

                    await onUpload(file, docType)
                    successCount++
                    setBulkUploadProgress((successCount / total) * 100)
                } catch (error) {
                    errorCount++
                    processingErrors.push(`${docType}: ${error instanceof Error ? error.message : 'Unknown error'}`)
                }
            }

            if (successCount > 0) {
                toast({
                    title: "Upload Complete",
                    description: `Successfully processed ${successCount} message${successCount > 1 ? 's' : ''}${errorCount > 0 ? `. Failed to process ${errorCount} message${errorCount > 1 ? 's' : ''}.` : ''}`
                })

                if (errorCount === 0) {
                    setMpesaMessages(new Map())
                    setMpesaPreview('')
                    setUploadDialog(false)
                }
            } else {
                toast({
                    title: "Upload Failed",
                    description: "Failed to process any messages. Please try again.",
                    variant: "destructive"
                })
            }

            if (processingErrors.length > 0) {
                console.error('Bulk MPESA processing errors:', processingErrors)
            }
        } catch (error) {
            console.error('Bulk MPESA processing error:', error)
            toast({
                title: "Error",
                description: "Failed to complete the process",
                variant: "destructive"
            })
        } finally {
            setIsConverting(false)
            setIsSubmitting(false)
            setBulkUploadProgress(0)
        }
    }

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
            if (!path) {
                toast({
                    title: "Error",
                    description: "No document available to download",
                    variant: "destructive"
                });
                return;
            }
            
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

    const handleView = async (path: string) => {
        try {
            if (!path) {
                toast({
                    title: "Error",
                    description: "No document available to view",
                    variant: "destructive"
                });
                return;
            }
            
            setViewerOpen(true)
        } catch (error) {
            console.error('Error viewing document:', error)
            toast({
                title: "Error",
                description: "Failed to view document",
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
        <div className="flex gap-1">
            <Button
                size="sm"
                className={existingDocument
                    ? "bg-green-500 hover:bg-green-600 h-6 text-xs px-2"
                    : "bg-red-500 hover:bg-red-600 h-6 text-xs px-2"}
                onClick={() => existingDocument ? handleView(existingDocument) : setUploadDialog(true)}
                // disabled={!existingDocument}
            >
                {existingDocument ? 'View' : 'Missing'}
            </Button>

            {existingDocument && (
                <>
                    {/* <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2"
                        onClick={() => handleView(existingDocument)}
                    >
                        <Eye className="h-3 w-3" />
                    </Button> */}
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
                                        <div className="flex gap-2">
                                            <Button
                                                variant={uploadType === 'file' ? 'default' : 'outline'}
                                                onClick={() => setUploadType('file')}
                                                size="sm"
                                            >
                                                Bank Upload
                                            </Button>
                                            <Button
                                                variant={uploadType === 'mpesa' ? 'default' : 'outline'}
                                                onClick={() => setUploadType('mpesa')}
                                                size="sm"
                                            >
                                                MPESA Message
                                            </Button>
                                        </div>

                                        {uploadType === 'file' ? (
                                            <div className="space-y-2">
                                                <Label>Select File</Label>
                                                <Input
                                                    type="file"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) handleFileSelect(file)
                                                    }}
                                                    accept={documentType.includes('pdf') ? '.pdf' : '.pdf, .zip, .jpg, .jpeg, .png'}
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <Label>Paste MPESA Message</Label>
                                                <Textarea
                                                    value={mpesaMessage}
                                                    onChange={(e) => handleMpesaMessageChange(e.target.value)}
                                                    placeholder="Paste your MPESA message here..."
                                                    className="min-h-[100px]"
                                                />
                                                {mpesaValidationError && (
                                                    <div className="text-sm text-red-500 mt-1">
                                                        {mpesaValidationError}
                                                    </div>
                                                )}
                                                {/* <div className="space-y-2">
                                                    <Label>MPESA Message Preview</Label>
                                                    {mpesaPreview ? (
                                                        <div className="p-4 bg-gray-50 rounded-md font-mono text-sm whitespace-pre-wrap">
                                                            {mpesaPreview}
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 bg-gray-50 rounded-md text-gray-400 text-sm">
                                                            Enter an MPESA message to see preview
                                                        </div>
                                                    )}
                                                </div> */}
                                                <Button
                                                    onClick={handleMpesaUpload}
                                                    disabled={!mpesaMessage.trim() || isConverting}
                                                    className="w-full"
                                                >
                                                    {isConverting ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Converting & Uploading...
                                                        </>
                                                    ) : (
                                                        'Convert & Upload'
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                        {existingDocument && (
                                            <div className="pt-4 border-t">
                                                <h4 className="text-sm font-medium text-gray-900 mb-2">Current Document</h4>
                                                <div className="flex items-center gap-2 bg-white p-2 rounded border">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0112.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
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
                                                                        accept={doc.type.includes('pdf') ? '.pdf' : '.pdf,.zip,.jpg,.jpeg,.png'}
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) {
                                                                                handleBulkFileSelect(file, doc.type, doc.label);
                                                                                // Clear any MPESA message for this type
                                                                                const newMessages = new Map(mpesaMessages);
                                                                                newMessages.delete(doc.type);
                                                                                setMpesaMessages(newMessages);
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
                                        <div className="flex justify-end gap-2">
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
                                            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
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
                    </div>
                </DialogContent>
            </Dialog>

            {existingDocument && (
                <DocumentViewer
                    url={existingDocument}
                    isOpen={viewerOpen}
                    onClose={() => setViewerOpen(false)}
                    title={label}
                    companyName={companyName}
                    documentType={label.toLowerCase().replace(/\s+/g, '_')}
                    recordId={recordId}
                />
            )}

            {previewDialog && (
                <PreviewExtractionDialog
                    isOpen={previewDialog}
                    onClose={() => setPreviewDialog(false)}
                    documents={processedDocs}
                    companyName={companyName}
                    recordId={recordId}
                />
            )}

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