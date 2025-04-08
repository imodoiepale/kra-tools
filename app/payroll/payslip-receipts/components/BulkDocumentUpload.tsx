// @ts-nocheck
import { useState, useCallback, useRef } from 'react'
import { Upload, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { CompanyPayrollRecord, DocumentType } from '../../types'
import { supabase } from '@/lib/supabase';

interface DocumentTypeOption {
    value: DocumentType;
    label: string;
}

interface BulkDocumentUploadProps {
    open: boolean;
    onClose: () => void;
    records: CompanyPayrollRecord[];
    onDocumentUpload: (recordId: string, file: File, documentType: DocumentType) => Promise<string | void>;
    setPayrollRecords: React.Dispatch<React.SetStateAction<CompanyPayrollRecord[]>>;
    documentTypes: DocumentTypeOption[];
}

interface FileWithCompany {
    file: File;
    companyId: string | null;
    companyName: string;
    documentType: DocumentType;
}

export function BulkDocumentUpload({
    open,
    onClose,
    records,
    onDocumentUpload,
    setPayrollRecords,
    documentTypes
}: BulkDocumentUploadProps) {
    const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
    const [files, setFiles] = useState<FileWithCompany[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadResults, setUploadResults] = useState<{
        success: number;
        failed: number;
        total: number;
    }>({ success: 0, failed: 0, total: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || !selectedDocumentType) return;
        
        const newFiles: FileWithCompany[] = [];
        
        // Process each file
        Array.from(event.target.files).forEach(file => {
            // Try to match filename with a company
            const fileName = file.name.toLowerCase();
            
            // Find matching company by name in the filename
            const matchingRecord = records.find(record => {
                const companyName = record.company?.company_name?.toLowerCase() || '';
                return companyName && fileName.includes(companyName);
            });
            
            if (matchingRecord) {
                newFiles.push({
                    file,
                    companyId: matchingRecord.id,
                    companyName: matchingRecord.company?.company_name || 'Unknown',
                    documentType: selectedDocumentType
                });
            } else {
                // If no match found, add to unmatched files
                newFiles.push({
                    file,
                    companyId: null,
                    companyName: 'Unmatched',
                    documentType: selectedDocumentType
                });
            }
        });
        
        setFiles(prev => [...prev, ...newFiles]);
        
        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (files.length === 0) {
            toast({
                title: 'No files selected',
                description: 'Please select files to upload',
                variant: 'default'
            });
            return;
        }

        const filesToUpload = files.filter(file => file.companyId !== null);
        
        if (filesToUpload.length === 0) {
            toast({
                title: 'No matched files',
                description: 'None of the selected files could be matched to a company',
                variant: 'destructive'
            });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadResults({ success: 0, failed: 0, total: filesToUpload.length });
        
        // Show initial progress toast
        toast({
            title: "Processing Documents",
            description: `Starting to process ${filesToUpload.length} document${filesToUpload.length > 1 ? 's' : ''}...`,
        });

        let successCount = 0;
        let errorCount = 0;
        
        try {
            // Group files by company for more efficient processing
            const filesByCompany = filesToUpload.reduce((acc, fileInfo) => {
                if (!acc[fileInfo.companyId]) {
                    acc[fileInfo.companyId] = [];
                }
                acc[fileInfo.companyId].push(fileInfo);
                return acc;
            }, {} as Record<string, FileWithCompany[]>);
            
            // Create upload tasks for each file
            const uploadTasks = [];
            
            // Process each company's files
            for (const [companyId, companyFiles] of Object.entries(filesByCompany)) {
                // First, fetch the current record to get existing document paths
                const { data: currentRecord, error: fetchError } = await supabase
                    .from('company_payroll_records')
                    .select('payment_receipts_documents')
                    .eq('id', companyId)
                    .single();
                
                if (fetchError) {
                    console.error(`Error fetching record for company ${companyId}:`, fetchError);
                    // Continue with other companies even if one fails
                    continue;
                }
                
                // Get current document paths or initialize empty object
                const currentDocuments = currentRecord?.payment_receipts_documents || {};
                
                // Create upload tasks for each file for this company
                for (const fileInfo of companyFiles) {
                    uploadTasks.push(async () => {
                        try {
                            // Upload the file and get the path
                            const filePath = await onDocumentUpload(
                                fileInfo.companyId,
                                fileInfo.file,
                                fileInfo.documentType
                            );
                            
                            if (filePath) {
                                return { 
                                    success: true, 
                                    companyId: fileInfo.companyId,
                                    documentType: fileInfo.documentType,
                                    filePath
                                };
                            }
                            return { 
                                success: false, 
                                companyId: fileInfo.companyId,
                                documentType: fileInfo.documentType
                            };
                        } catch (error) {
                            console.error(`Error uploading file for company ${fileInfo.companyName}:`, error);
                            return { 
                                success: false, 
                                companyId: fileInfo.companyId,
                                documentType: fileInfo.documentType
                            };
                        }
                    });
                }
            }
            
            // Execute all upload tasks with progress tracking
            const results = [];
            for (let i = 0; i < uploadTasks.length; i++) {
                try {
                    const result = await uploadTasks[i]();
                    results.push(result);
                    
                    // Update progress
                    const progress = Math.round(((i + 1) / uploadTasks.length) * 100);
                    setUploadProgress(progress);
                    
                    if (result && result.success) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                    
                    // Update progress toast periodically
                    if ((i + 1) % 5 === 0 || i === uploadTasks.length - 1) {
                        toast({
                            title: "Processing",
                            description: `Processed ${i + 1} of ${uploadTasks.length} documents...`,
                        });
                    }
                } catch (error) {
                    console.error("Task execution error:", error);
                    errorCount++;
                }
            }
            
            // After all uploads are complete, update the UI state
            if (results.length > 0) {
                // Group successful results by company ID
                const successfulUploads = results.filter(r => r && r.success);
                
                if (successfulUploads.length > 0) {
                    // Get the latest records to ensure we have the most up-to-date data
                    const updatedRecords = [...records];
                    
                    // Update our local state with the uploaded documents
                    for (const record of updatedRecords) {
                        const companyUploads = successfulUploads.filter(r => r?.companyId === record.id);
                        
                        if (companyUploads.length > 0) {
                            // Get current document paths or initialize empty object
                            const currentDocuments = record.payment_receipts_documents || {};
                            
                            // Add each new document path
                            for (const upload of companyUploads) {
                                currentDocuments[upload.documentType] = upload.filePath;
                            }
                            
                            // Update the record with new document paths
                            record.payment_receipts_documents = currentDocuments;
                        }
                    }
                    
                    // Update the state with all changes
                    setPayrollRecords(updatedRecords);
                }
            }
            
            // Final status
            setUploadResults({
                success: successCount,
                failed: errorCount,
                total: filesToUpload.length
            });
            
            if (successCount > 0) {
                toast({
                    title: "Upload Complete",
                    description: `Successfully uploaded ${successCount} document${successCount > 1 ? 's' : ''}${errorCount > 0 ? `. Failed to upload ${errorCount} document${errorCount > 1 ? 's' : ''}.` : ''}`
                });
                
                // Clear files if all successful
                if (errorCount === 0) {
                    setFiles([]);
                } else {
                    // Keep only failed files
                    const successfulFileIds = new Set();
                    results.forEach(result => {
                        if (result && result.success) {
                            const fileIndex = filesToUpload.findIndex(
                                f => f.companyId === result.companyId && f.documentType === result.documentType
                            );
                            if (fileIndex !== -1) {
                                successfulFileIds.add(filesToUpload[fileIndex].file.name);
                            }
                        }
                    });
                    
                    setFiles(prev => prev.filter(file => !successfulFileIds.has(file.file.name)));
                }
            } else {
                toast({
                    title: "Upload Failed",
                    description: "Failed to upload any documents. Please try again.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error('Error during bulk upload:', error);
            toast({
                title: 'Upload failed',
                description: 'An error occurred during the upload process',
                variant: 'destructive'
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = useCallback(() => {
        if (isUploading) {
            toast({
                title: 'Upload in progress',
                description: 'Please wait for the upload to complete',
                variant: 'default'
            });
            return;
        }
        
        setFiles([]);
        setSelectedDocumentType(null);
        setUploadProgress(0);
        setUploadResults({ success: 0, failed: 0, total: 0 });
        onClose();
    }, [isUploading, onClose, toast]);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Bulk Document Upload</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 my-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="document-type">Document Type</Label>
                            <Select
                                value={selectedDocumentType || ''}
                                onValueChange={(value) => setSelectedDocumentType(value as DocumentType)}
                                disabled={isUploading}
                            >
                                <SelectTrigger id="document-type">
                                    <SelectValue placeholder="Select document type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {documentTypes.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="flex items-end">
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!selectedDocumentType || isUploading}
                                className="w-full"
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                Select Files
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                disabled={!selectedDocumentType || isUploading}
                            />
                        </div>
                    </div>
                    
                    {files.length > 0 && (
                        <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                            <h3 className="font-medium mb-2">Selected Files ({files.length})</h3>
                            <ul className="space-y-2">
                                {files.map((file, index) => (
                                    <li key={index} className="flex items-center justify-between border-b pb-2">
                                        <div className="flex-1 truncate">
                                            <span className="font-medium">{file.file.name}</span>
                                            <div className="text-sm text-gray-500 flex items-center">
                                                {file.companyId !== null ? (
                                                    <>
                                                        <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                                                        Matched: {file.companyName}
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
                                                        Not matched to any company
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeFile(index)}
                                            disabled={isUploading}
                                            className="h-8 w-8 p-0"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {isUploading && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Uploading...</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} className="h-2" />
                            <div className="text-sm text-gray-500">
                                Uploaded {uploadResults.success} of {uploadResults.total} files
                                {uploadResults.failed > 0 && (
                                    <span className="text-red-500 ml-2">
                                        ({uploadResults.failed} failed)
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isUploading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={files.length === 0 || isUploading || !files.some(f => f.companyId !== null)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload {files.filter(f => f.companyId !== null).length} Files
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
