// @ts-nocheck
import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Upload, X, FileCheck, AlertCircle } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CompanyPayrollRecord, DocumentType } from '../../types';
import { useToast } from '@/hooks/use-toast';

interface BulkDocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[], mappedFiles: MappedFile[]) => Promise<void>;
  payrollRecords: CompanyPayrollRecord[];
}

interface MappedFile {
  file: File;
  recordId: string;
  documentType: DocumentType;
  companyName: string;
}

interface FileWithStatus extends MappedFile {
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export function BulkDocumentUpload({ isOpen, onClose, onUpload, payrollRecords }: BulkDocumentUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [mappedFiles, setMappedFiles] = useState<FileWithStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const newFiles = Array.from(event.target.files);
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
      mapFilesToRecords(newFiles);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const newFiles = Array.from(event.dataTransfer.files);
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
      mapFilesToRecords(newFiles);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const mapFilesToRecords = (newFiles: File[]) => {
    const mappedResults: FileWithStatus[] = [];

    newFiles.forEach(file => {
      const fileName = file.name;
      let matchedRecord: CompanyPayrollRecord | null = null;
      let documentType: DocumentType | null = null;

      // Extract information from filename
      // Format: MM-YYYY - COMPANY NAME - PIN - DOCUMENT TYPE - DOCUMENT SUBTYPE
      const fileNameParts = fileName.split(' - ');
      
      if (fileNameParts.length >= 3) {
        // Try to find the company by name in the filename
        const possibleCompanyName = fileNameParts[1].trim();
        
        // Find the record with matching company name
        matchedRecord = payrollRecords.find(record => 
          record.company?.company_name?.toLowerCase() === possibleCompanyName.toLowerCase()
        );

        // Determine document type based on filename
        const lowerFileName = fileName.toLowerCase();
        if (lowerFileName.includes('acknowledgement') || lowerFileName.includes('ack')) {
          documentType = 'paye_acknowledgment';
        } else if (lowerFileName.includes('paye') && lowerFileName.includes('payment')) {
          documentType = 'paye_slip';
        } else if (lowerFileName.includes('housing levy') || lowerFileName.includes('hslevy')) {
          documentType = 'housing_levy_slip';
        } else if (lowerFileName.includes('nita')) {
          documentType = 'nita_slip';
        } else if (lowerFileName.includes('shif')) {
          documentType = 'shif_slip';
        } else if (lowerFileName.includes('nssf')) {
          documentType = 'nssf_slip';
        }
      }

      if (matchedRecord && documentType) {
        mappedResults.push({
          file,
          recordId: matchedRecord.id,
          documentType,
          companyName: matchedRecord.company?.company_name || 'Unknown',
          status: 'pending'
        });
      } else {
        mappedResults.push({
          file,
          recordId: '',
          documentType: null,
          companyName: '',
          status: 'error',
          message: 'Could not match file to a company or determine document type'
        });
      }
    });

    setMappedFiles(prev => [...prev, ...mappedResults]);
  };

  const removeFile = (index: number) => {
    setMappedFiles(prev => prev.filter((_, i) => i !== index));
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    const validFiles = mappedFiles.filter(f => f.status === 'pending' && f.recordId && f.documentType);
    
    if (validFiles.length === 0) {
      toast({
        title: 'No valid files to upload',
        description: 'Please add files that can be matched to companies and document types.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await onUpload(
        validFiles.map(f => f.file),
        validFiles
      );

      toast({
        title: 'Upload Complete',
        description: `Successfully uploaded ${validFiles.length} files.`,
      });

      // Reset the component state
      setFiles([]);
      setMappedFiles([]);
      onClose();
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'An error occurred during upload',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Document Upload</DialogTitle>
          <DialogDescription>
            Upload multiple documents at once. Files will be automatically matched to companies based on their names.
          </DialogDescription>
        </DialogHeader>

        <div
          className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={triggerFileInput}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
          />
          <Upload className="h-12 w-12 mx-auto text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            Drag and drop files here, or click to select files
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supported formats: PDF, JPG, PNG
          </p>
        </div>

        {mappedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium">Files to upload ({mappedFiles.length})</h3>
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              {mappedFiles.map((mappedFile, index) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-2 border-b last:border-b-0 ${
                    mappedFile.status === 'error' ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mappedFile.file.name}</p>
                    {mappedFile.status === 'pending' && mappedFile.companyName && (
                      <p className="text-xs text-gray-500">
                        Will be uploaded as {mappedFile.documentType?.replace('_', ' ')} for {mappedFile.companyName}
                      </p>
                    )}
                    {mappedFile.status === 'error' && (
                      <p className="text-xs text-red-500">{mappedFile.message}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {mappedFile.status === 'pending' && (
                      <FileCheck className="h-4 w-4 text-green-500" />
                    )}
                    {mappedFile.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isUploading && (
          <div className="mt-4 space-y-2">
            <p className="text-sm">Uploading files...</p>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {mappedFiles.some(f => f.status === 'error') && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Some files could not be matched to companies or document types. Please check the file names.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={isUploading || mappedFiles.length === 0 || !mappedFiles.some(f => f.status === 'pending')}
          >
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
