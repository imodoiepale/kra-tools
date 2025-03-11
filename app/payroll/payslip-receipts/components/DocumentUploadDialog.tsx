// @ts-nocheck
import { useState, useCallback, useMemo, useRef } from 'react'
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
    onUpload: (file: File, documentType?: DocumentType) => Promise<string>;
    onDelete: () => Promise<void>;
    existingDocument: string | null;
    label: string;
    isNilFiling?: boolean;
    allDocuments: {
        type: DocumentType;
        status: 'pending' | 'uploaded';
        path?: string;
    }[];
    companyName: string;
    onBatchDocumentUpload?: (documents: Array<{file: File, documentType: DocumentType}>) => Promise<any>;
}

// Batch size for processing multiple documents
const BATCH_SIZE = 5;

// Debounce function for performance optimization
const debounce = (fn: Function, ms = 300) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (...args: any[]) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), ms);
    };
};

// Document type labels
const DOCUMENT_LABELS: Record<string, string> = {
    paye_receipt: "PAYE RECEIPT",
    housing_levy_receipt: "HOUSING LEVY RECEIPT",
    nita_receipt: "NITA RECEIPT",
    shif_receipt: "SHIF RECEIPT",
    nssf_receipt: "NSSF RECEIPT",
    // all_csv: "All CSV Files"
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
    companyName,
    onBatchDocumentUpload
}: DocumentUploadDialogProps) {
    const [uploadDialog, setUploadDialog] = useState(false)
    const [confirmUploadDialog, setConfirmUploadDialog] = useState(false)
    const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [selectedDocType, setSelectedDocType] = useState<DocumentType | undefined>(documentType as DocumentType)
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

            // Log exactly what document type we're associating
            console.log(`Setting file for document type: ${docType} with label: ${label}`);

            // Create a new Map to avoid reference issues
            const newBulkFiles = new Map(bulkFiles);
            newBulkFiles.set(docType, { file: processedFile, label });
            setBulkFiles(newBulkFiles);

            // Log the updated map for debugging
            console.log('Updated bulk files map:',
                Array.from(newBulkFiles.entries()).map(([key, value]) => {
                    return { type: key, label: value.label, fileName: value.file.name };
                })
            );

            // Clear any MPESA message for this type
            const newMessages = new Map(mpesaMessages);
            newMessages.delete(docType);
            setMpesaMessages(newMessages);

            toast({
                title: "File Ready",
                description: `${label} file prepared for upload (${docType})`,
            });
        } catch (error) {
            console.error('Error handling bulk file select:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to process file",
                variant: "destructive"
            });
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast({
                title: 'Error',
                description: 'Please select a file to upload',
                variant: 'destructive'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            if (uploadType === 'file' && selectedFile) {
                // CRITICAL FIX: Always use the documentType from props to ensure consistency
                // This fixes the document type mismatch issue
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Uploading file with document type: ${documentType}`, selectedFile.name);
                }
                const result = await onUpload(selectedFile, documentType);
                
                if (result) {
                    toast({
                        title: 'Success',
                        description: 'Document uploaded successfully'
                    });
                    
                    // Force refresh of component state
                    setSelectedFile(null);
                    setMpesaMessage('');
                    setMpesaPreview('');
                    setUploadDialog(false);
                } else {
                    toast({
                        title: 'Error',
                        description: 'Failed to upload document',
                        variant: 'destructive'
                    });
                }
            } else if (uploadType === 'mpesa' && mpesaMessage) {
                // Process MPESA message to PDF
                setIsConverting(true);
                
                // Generate filename with document type
                const fileName = `MPESA-RECEIPT-${documentType}-${new Date().getTime()}.pdf`;
                
                const pdfData = await mpesaMessageToPdf({
                    message: mpesaMessage,
                    fileName: fileName,
                    receiptName: `${label} - ${companyName}`
                });
                
                if (!pdfData) {
                    throw new Error('Failed to generate PDF from MPESA message');
                }
                
                // Create file object
                const file = new File([pdfData], fileName, {
                    type: 'application/pdf',
                    lastModified: Date.now()
                });
                
                // CRITICAL FIX: Use the documentType from props for consistency
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Uploading MPESA PDF with document type: ${documentType}`, fileName);
                }
                const result = await onUpload(file, documentType);
                
                if (result) {
                    toast({
                        title: 'Success',
                        description: 'Document uploaded successfully'
                    });
                    
                    // Force refresh of component state
                    setSelectedFile(null);
                    setMpesaMessage('');
                    setMpesaPreview('');
                    setUploadDialog(false);
                } else {
                    toast({
                        title: 'Error',
                        description: 'Failed to upload document',
                        variant: 'destructive'
                    });
                }
                
                setIsConverting(false);
            }
        } catch (error) {
            console.error('Document upload error:', error);
            
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to upload document',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
            setIsConverting(false);
        }
    };

    const getDocumentsForUpload = () => {
        // Filter out only the documents that have files
        const documents: Array<{file: File, documentType: DocumentType}> = [];
        
        // Add files from bulkFiles
        for (const [docType, file] of bulkFiles.entries()) {
            if (file) {
                documents.push({
                    file,
                    documentType: docType as DocumentType
                });
            }
        }
        
        // Add files from MPESA messages (convert to PDF first)
        for (const [docType, message] of mpesaMessages.entries()) {
            if (message && message.trim()) {
                try {
                    // This will be handled separately in the bulk upload function
                    // as we need to convert the message to PDF asynchronously
                } catch (error) {
                    console.error(`Error preparing MPESA message for ${docType}:`, error);
                }
            }
        }
        
        return documents;
    };

    const handleBulkUpload = async () => {
        if (bulkFiles.size === 0 && mpesaMessages.size === 0) {
            toast({
                title: 'No files selected',
                description: 'Please select at least one file to upload',
                variant: 'destructive'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // Process files
            const documentsToUpload: Array<{file: File, documentType: DocumentType}> = [];

            // Add regular files
            for (const [docType, { file }] of bulkFiles.entries()) {
                // Ensure docType is valid
                if (!docType) {
                    console.error('Invalid document type detected in bulk files');
                    continue;
                }
                
                documentsToUpload.push({
                    file,
                    documentType: docType as DocumentType
                });
            }

            // Process MPESA messages to PDF files
            for (const [docType, { message, label }] of mpesaMessages.entries()) {
                try {
                    // Skip empty messages
                    if (!message.trim()) {
                        continue;
                    }
                    
                    // Ensure docType is valid
                    if (!docType) {
                        console.error('Invalid document type detected in MPESA messages');
                        continue;
                    }
                    
                    // Get the correct label for this document type
                    const docLabel = label || DOCUMENT_LABELS[docType] || docType;
                    
                    // Generate filename with document type
                    const fileName = `MPESA-RECEIPT-${docType}-${new Date().getTime()}.pdf`
                    
                    // Log for debugging
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`Generating PDF for document type: ${docType}, label: ${docLabel}`);
                    }
                    
                    const pdfData = await mpesaMessageToPdf({
                        message,
                        fileName,
                        receiptName: `${companyName} - ${docLabel}`
                    });
                    
                    if (pdfData) {
                        // Create a File object from the Uint8Array
                        const file = new File([pdfData], fileName, {
                            type: 'application/pdf',
                            lastModified: new Date().getTime()
                        });
                        
                        documentsToUpload.push({
                            file: file,
                            documentType: docType as DocumentType
                        });
                    }
                } catch (error) {
                    console.error(`Error converting MPESA message for ${docType}:`, error);
                    toast({
                        title: 'Error',
                        description: `Failed to convert MPESA message for ${label}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        variant: 'destructive'
                    });
                }
            }

            if (documentsToUpload.length === 0) {
                throw new Error('No valid documents to upload');
            }

            // Log the documents being uploaded for debugging
            if (process.env.NODE_ENV !== 'production') {
                console.log('Uploading documents:', documentsToUpload.map(d => `${d.documentType}: ${d.file.name}`));
            }

            // Call the batch upload function - IMPORTANT: Only pass the documents array
            // The parent component already has the recordId and will add it
            const result = await onBatchDocumentUpload(documentsToUpload);
            
            if (result && result.success) {
                toast({
                    title: 'Success',
                    description: `${documentsToUpload.length} document(s) uploaded successfully`
                });
                
                // Clear state and close dialog
                setBulkFiles(new Map());
                setMpesaMessages(new Map());
                setUploadDialog(false);
            } else {
                throw new Error(result?.error || 'Failed to upload documents');
            }
        } catch (error) {
            console.error('Bulk upload error:', error);
            toast({
                title: 'Upload Failed',
                description: error instanceof Error ? error.message : 'An unknown error occurred',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMpesaMessageChange = (message: string, docType?: DocumentType, label?: string) => {
        try {
            if (!message.trim()) {
                // If message is empty, clear it or remove it from the map
                if (docType) {
                    // Bulk upload mode - remove from map
                    const newMessages = new Map(mpesaMessages);
                    newMessages.delete(docType);
                    setMpesaMessages(newMessages);
                } else {
                    // Single upload mode - just clear the message
                    setMpesaMessage('');
                    setMpesaPreview('');
                }
                return;
            }

            if (docType && label) {
                // Bulk upload mode
                // Store the message with its document type
                const newMessages = new Map(mpesaMessages);
                newMessages.set(docType, { message, label });
                setMpesaMessages(newMessages);

                // Clear any file for this document type
                const newFiles = new Map(bulkFiles);
                newFiles.delete(docType);
                setBulkFiles(newFiles);

                toast({
                    title: "MPESA Message Ready",
                    description: `${label} message prepared for upload (${docType})`,
                });
            } else {
                // Single upload mode
                setMpesaMessage(message);
                // Optionally set a preview if needed
                // setMpesaPreview(formatMpesaMessage(message).formatted);
            }
        } catch (error) {
            console.error('Error handling MPESA message:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to process MPESA message",
                variant: "destructive"
            });
        }
    };

    const handleMpesaUpload = async () => {
        if (!mpesaMessage.trim()) {
            toast({
                title: "Validation Error",
                description: "Please enter an MPESA message",
                variant: "destructive"
            })
            return
        }

        setIsConverting(true)
        setIsSubmitting(true)
        try {
            // Step 1: Convert MPESA message to PDF using pdfme
            const fileName = `mpesa-receipt-${new Date().getTime()}.pdf`
            
            // Ensure we're using the correct document type and label
            const docType = selectedDocType || documentType;
            
            // Log for debugging
            if (process.env.NODE_ENV !== 'production') {
                console.log(`Generating PDF for document type: ${docType}, label: ${label}`);
            }
            
            const pdfData = await mpesaMessageToPdf({
                message: mpesaMessage,
                fileName,
                receiptName: `${companyName} - ${label}`
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
            await onUpload(file, docType)

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

        setIsSubmitting(true)
        setIsConverting(true)
        let successCount = 0
        let errorCount = 0
        const processingErrors: string[] = []
        const total = mpesaMessages.size

        try {
            for (const [docType, { message, label }] of mpesaMessages.entries()) {
                try {
                    if (!message.trim()) {
                        continue; // Skip empty messages
                    }
                    
                    // Ensure docType is valid
                    if (!docType) {
                        throw new Error('Invalid document type');
                    }
                    
                    // Get the correct label for this document type
                    const docLabel = label || DOCUMENT_LABELS[docType] || docType;
                    
                    // Generate a meaningful filename
                    const fileName = `MPESA-RECEIPT-${docType}-${new Date().getTime()}.pdf`
                    
                    // Log for debugging
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`Generating PDF for document type: ${docType}, label: ${docLabel}`);
                    }
                    
                    const pdfData = await mpesaMessageToPdf({
                        message,
                        fileName,
                        receiptName: `${companyName} - ${docLabel}`
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
            await onDelete()
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

    // Use refs for tracking progress to avoid unnecessary re-renders
    const progressRef = useRef(0);
    const processedCountRef = useRef(0);
    const totalItemsRef = useRef(0);

    // Create a debounced function for updating progress
    const updateProgressDebounced = useCallback(
        debounce((progress: number) => {
            setBulkUploadProgress(progress);
        }, 100),
        [setBulkUploadProgress]
    );

    // Memoize document filtering for performance
    const missingDocuments = useMemo(() => {
        if (!allDocuments) return [];
        
        // Filter for documents that are pending (not uploaded)
        const pendingDocs = allDocuments.filter(doc => doc.status === 'pending');
        
        // Add labels to the documents for display
        return pendingDocs.map(doc => ({
            ...doc,
            label: DOCUMENT_LABELS[doc.type] || 'Unknown Document'
        }));
    }, [allDocuments]);
    
    // Get the count of uploaded documents
    const uploadedDocumentCount = useMemo(() => {
        if (!allDocuments) return 0;
        return allDocuments.filter(doc => doc.status === 'uploaded').length;
    }, [allDocuments]);

    // Generate email content with document list
    const emailContent = useMemo(() => {
        // Get list of ready documents
        const readyDocs = allDocuments
            .filter(doc => doc.status === 'uploaded')
            .map(doc => DOCUMENT_LABELS[doc.type] || 'Unknown Document')
            .filter(Boolean); // Filter out any undefined values
        
        return `Payment Receipts for ${companyName}
The following documents are attached:

${readyDocs.length > 0 ? readyDocs.join('\n') : 'No documents are ready to send.'}`;
    }, [allDocuments, companyName]);

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
                <DialogContent className="max-w-4xl">
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
                                            
                                            {/* Document type header row */}
                                            <div className="grid grid-cols-12 gap-2 mb-2 pb-2 border-b">
                                                <div className="col-span-3 font-medium text-sm text-gray-700">Document Type</div>
                                                <div className="col-span-4 font-medium text-sm text-gray-700">File Upload</div>
                                                <div className="col-span-5 font-medium text-sm text-gray-700">MPESA Message</div>
                                            </div>
                                            
                                            <div className="divide-y">
                                                {allDocuments.map((doc) => (
                                                    <div key={doc.type} className="py-3 first:pt-0 last:pb-0">
                                                        {/* Document type and status */}
                                                        <div className="grid grid-cols-12 gap-2 items-center">
                                                            <div className="col-span-3">
                                                                <div className="flex items-center gap-1">
                                                                    {doc.status === 'uploaded' ? (
                                                                        <Badge className="bg-green-500">Uploaded</Badge>
                                                                    ) : (
                                                                        <Badge className="bg-yellow-500">Pending</Badge>
                                                                    )}
                                                                </div>
                                                                <h4 className="font-medium text-sm mt-1">{DOCUMENT_LABELS[doc.type] || doc.label}</h4>
                                                                {(bulkFiles.has(doc.type) || mpesaMessages.has(doc.type)) && (
                                                                    <p className="text-xs text-blue-500 mt-1">
                                                                        New {bulkFiles.has(doc.type) ? 'file' : 'message'} selected
                                                                    </p>
                                                                )}
                                                            </div>
                                                            
                                                            {/* File upload */}
                                                            <div className="col-span-4">
                                                                <Input
                                                                    type="file"
                                                                    className="flex-1"
                                                                    accept={doc.type.includes('pdf') ? '.pdf' : '.pdf,.zip,.jpg,.jpeg,.png'}
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            console.log(`File selected for ${doc.label} with type ${doc.type}:`, file.name);
                                                                            handleBulkFileSelect(file, doc.type, doc.label);
                                                                            // Clear any MPESA message for this type
                                                                            const newMessages = new Map(mpesaMessages);
                                                                            newMessages.delete(doc.type);
                                                                            setMpesaMessages(newMessages);
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                            
                                                            {/* MPESA message */}
                                                            <div className="col-span-5">
                                                                <div className="flex gap-2 items-center">
                                                                    <Textarea
                                                                        placeholder="Paste MPESA message..."
                                                                        className="flex-1 h-[38px] min-h-[38px]"
                                                                        value={mpesaMessages.get(doc.type)?.message || ''}
                                                                        onChange={(e) => {
                                                                            const message = e.target.value;
                                                                            const newMessages = new Map(mpesaMessages);
                                                                            
                                                                            if (message.trim()) {
                                                                                newMessages.set(doc.type, {
                                                                                    message,
                                                                                    label: doc.label
                                                                                });
                                                                            } else {
                                                                                newMessages.delete(doc.type);
                                                                            }
                                                                            
                                                                            setMpesaMessages(newMessages);
                                                                            
                                                                            // Clear any file for this type
                                                                            if (message.trim()) {
                                                                                const newFiles = new Map(bulkFiles);
                                                                                newFiles.delete(doc.type);
                                                                                setBulkFiles(newFiles);
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            {(mpesaMessages.size > 0 || bulkFiles.size > 0) && (
                                                <Button
                                                    onClick={handleBulkUpload}
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
                        <AlertDialogAction onClick={handleUpload}>
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