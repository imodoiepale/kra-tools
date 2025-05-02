// @ts-nocheck
import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, X, Check, FileText } from "lucide-react";
import { createClient } from '@supabase/supabase-js';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  companyId: string;
  onUploadComplete: () => void;
}

export function FileUploadModal({ isOpen, onClose, companyName, companyId, onUploadComplete }: FileUploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('vat3');
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({
    vat3: null,
    sec_b_with_vat: null,
    sec_b_without_vat: null,
    sec_f: null
  });

  const fileInputRefs = {
    vat3: useRef<HTMLInputElement>(null),
    sec_b_with_vat: useRef<HTMLInputElement>(null),
    sec_b_without_vat: useRef<HTMLInputElement>(null),
    sec_f: useRef<HTMLInputElement>(null)
  };

  const fileTypes = {
    vat3: 'VAT3 - Template',
    sec_b_with_vat: 'Sec B - Sales 16%',
    sec_b_without_vat: 'Sec B - Sales 0%',
    sec_f: 'Sec F - Purchase'
  };

  const handleFileChange = (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFiles(prev => ({
        ...prev,
        [type]: e.target.files?.[0] || null
      }));
    }
  };

  const clearFile = (type: string) => {
    setSelectedFiles(prev => ({
      ...prev,
      [type]: null
    }));
    if (fileInputRefs[type]?.current) {
      fileInputRefs[type].current.value = '';
    }
  };

  const handleUpload = async () => {
    // Check if any files are selected
    const hasFiles = Object.values(selectedFiles).some(file => file !== null);
    if (!hasFiles) {
      setError('Please select at least one file to upload');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('companyName', companyName);
      formData.append('companyId', companyId);
      
      // Append only the files that are selected
      Object.entries(selectedFiles).forEach(([type, file]) => {
        if (file) {
          formData.append(type, file);
        }
      });

      const response = await fetch('/api/upload-missing-files', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload files');
      }

      const result = await response.json();
      setSuccess('Files uploaded successfully');
      
      // Reset form
      Object.keys(selectedFiles).forEach(type => {
        clearFile(type);
      });
      
      // Notify parent component
      onUploadComplete();
      
      // Close modal after a delay
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error uploading files:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Missing Files</DialogTitle>
          <DialogDescription>
            Upload missing files for {companyName}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
            <Check className="h-4 w-4 mr-2 text-green-600" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="vat3">VAT3</TabsTrigger>
            <TabsTrigger value="sec_b_with_vat">Sec B 16%</TabsTrigger>
            <TabsTrigger value="sec_b_without_vat">Sec B 0%</TabsTrigger>
            <TabsTrigger value="sec_f">Sec F</TabsTrigger>
          </TabsList>

          {Object.entries(fileTypes).map(([type, label]) => (
            <TabsContent key={type} value={type} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${type}-file`}>{label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRefs[type]}
                    id={`${type}-file`}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,.zip"
                    onChange={(e) => handleFileChange(type, e)}
                    className="flex-1"
                  />
                  {selectedFiles[type] && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => clearFile(type)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {selectedFiles[type] && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 mr-1" />
                    {selectedFiles[type]?.name}
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading}>
            {isUploading ? (
              <>Uploading...</>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
