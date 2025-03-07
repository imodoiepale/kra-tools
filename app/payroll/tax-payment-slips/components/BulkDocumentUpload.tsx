// @ts-nocheck
import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Upload, X, FileCheck, AlertCircle, CloudUpload, RefreshCw, Check, Eye, EyeOff } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BulkDocumentUpload = ({ isOpen, onClose, onUpload, payrollRecords }) => {
  const [files, setFiles] = useState([]);
  const [mappedFiles, setMappedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("upload");
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);

  // Group mapped files by company for table display
  const groupedByCompany = mappedFiles.reduce((acc, file, idx) => {
    const key = file.companyName || 'Unmatched';
    if (!acc[key]) {
      acc[key] = {
        index: Object.keys(acc).length + 1,
        files: []
      };
    }
    acc[key].files.push({ ...file, globalIndex: idx });
    return acc;
  }, {});

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      const newFiles = Array.from(event.target.files);
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
      mapFilesToRecords(newFiles);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const newFiles = Array.from(event.dataTransfer.files);
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
      mapFilesToRecords(newFiles);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const mapFilesToRecords = (newFiles) => {
    const mappedResults = [];

    newFiles.forEach(file => {
      const fileName = file.name;
      let matchedRecord = null;
      let documentType = null;

      // Extract information from filename
      // Format: MM-YYYY - COMPANY NAME - PIN - DOCUMENT TYPE
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

  const removeFile = (index) => {
    setMappedFiles(prev => prev.filter((_, i) => i !== index));
    setFiles(prev => prev.filter((_, i) => i !== index));

    if (previewFile && previewFile.index === index) {
      setPreviewFile(null);
    }
  };

  const handleUpload = async () => {
    const validFiles = mappedFiles.filter(f => f.status === 'pending' && f.recordId && f.documentType);

    if (validFiles.length === 0) {
      // Toast would be triggered here
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 300);

    try {
      await onUpload(
        validFiles.map(f => f.file),
        validFiles
      );

      // Success toast would be triggered here

      // Clear interval if it's still running
      clearInterval(interval);

      // Simulate complete upload
      setUploadProgress(100);
    } catch (error) {
      // Error toast would be triggered here
      clearInterval(interval);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Get document type display name
  const getDocumentTypeName = (type) => {
    if (!type) return 'Unknown';
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const previewDocument = (file, index) => {
    if (file && ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setPreviewFile({
        file,
        url: URL.createObjectURL(file),
        index
      });
    }
  };

  const closePreview = () => {
    if (previewFile && previewFile.url) {
      URL.revokeObjectURL(previewFile.url);
    }
    setPreviewFile(null);
  };

  const handleCompanyChange = (index, value) => {
    setMappedFiles(prev => prev.map((file, i) =>
      i === index ? { ...file, companyName: value, status: 'pending' } : file
    ));
  };

  const handleDocumentTypeChange = (index, value) => {
    setMappedFiles(prev => prev.map((file, i) =>
      i === index ? { ...file, documentType: value, status: 'pending' } : file
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-7xl h-[90vh] overflow-hidden p-0">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 border-b">
          <div className="flex items-center mb-1">
            <CloudUpload className="h-5 w-5 text-blue-600 mr-2" />
            <DialogTitle className="text-lg font-semibold text-blue-700">Statutory Documents Upload</DialogTitle>
          </div>
          <DialogDescription className="text-blue-600 text-xs">
            Upload multiple compliance documents at once for your companies
          </DialogDescription>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 h-full" style={{ height: 'calc(90vh - 80px)' }}>
          <div className="col-span-1 lg:col-span-3 overflow-hidden flex flex-col">

            <div className="px-3 pb-3 overflow-y-auto flex-1" style={{ minHeight: 0 }}>

              <div
                className="border-2 border-dashed rounded-md p-3 text-center cursor-pointer hover:bg-gray-50 transition-colors mb-3"
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
                  accept=".pdf,.jpg,.png"
                />
                <Upload className="h-8 w-8 mx-auto text-blue-500" />
                <p className="mt-1 text-sm font-medium text-gray-700">
                  Drag and drop documents here
                </p>
                <p className="text-xs text-gray-500">
                  Supported formats: PDF, JPG, PNG
                </p>
              </div>

              {mappedFiles.length > 0 && (
                <Card className="mb-3 flex-1 flex flex-col">
                  <div className="p-2 bg-blue-50 border-b text-xs font-medium flex justify-between items-center">
                    <span>Files to upload ({mappedFiles.length})</span>
                    <Badge variant={mappedFiles.some(f => f.status === 'error') ? "destructive" : "outline"}>
                      {mappedFiles.filter(f => f.status === 'pending').length} valid
                    </Badge>
                  </div>

                  <Table className="text-xs">
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead className="w-[25%]">Company</TableHead>
                        <TableHead className="w-[25%]">Document</TableHead>
                        <TableHead className="w-[15%]">Type</TableHead>
                        <TableHead className="w-[10%]">Status</TableHead>
                        <TableHead className="w-[15%] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    {/* <div className="overflow-y-auto flex-1" style={{ minHeight: 0 }}> */}
                      <TableBody className="overflow-y-auto flex-1" style={{ minHeight: 0 }}>
                        {Object.entries(groupedByCompany).map(([company, { index, files }]) => (
                          files.map((file, fileIndex) => (
                            <TableRow
                              key={`${company}-${fileIndex}`}
                              className={`text-xs ${file.status === 'error' ? 'bg-red-50' : ''} ${previewFile && previewFile.index === file.globalIndex ? 'bg-blue-50' : ''}`}
                            >
                              {fileIndex === 0 ? (
                                <TableCell
                                  rowSpan={files.length}
                                  className="text-center font-medium"
                                >
                                  {index}
                                </TableCell>
                              ) : null}
                              {fileIndex === 0 ? (
                                <TableCell
                                  rowSpan={files.length}
                                  className="font-medium truncate max-w-[120px]"
                                >
                                  {company !== 'Unmatched' ? company : (
                                    <Select
                                      value={file.companyName}
                                      onValueChange={(value) => handleCompanyChange(file.globalIndex, value)}
                                    >
                                      <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Select Company" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {payrollRecords.map((record) => (
                                          <SelectItem key={record.id} value={record.company.company_name}>
                                            {record.company.company_name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </TableCell>
                              ) : null}
                              <TableCell className="truncate max-w-[120px]">
                                {file.file.name}
                                {file.status === 'error' && (
                                  <div className="text-xs text-red-500">
                                    {file.message}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {file.documentType ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-800 whitespace-nowrap">
                                    {getDocumentTypeName(file.documentType)}
                                  </Badge>
                                ) : (
                                  <Select
                                    value={file.documentType}
                                    onValueChange={(value) => handleDocumentTypeChange(file.globalIndex, value)}
                                  >
                                    <SelectTrigger className="w-[180px]">
                                      <SelectValue placeholder="Select Document Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="paye_acknowledgment">PAYE Acknowledgment</SelectItem>
                                      <SelectItem value="paye_slip">PAYE Slip</SelectItem>
                                      <SelectItem value="housing_levy_slip">Housing Levy Slip</SelectItem>
                                      <SelectItem value="nita_slip">NITA Slip</SelectItem>
                                      <SelectItem value="shif_slip">SHIF Slip</SelectItem>
                                      <SelectItem value="nssf_slip">NSSF Slip</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                              <TableCell>
                                {file.status === 'pending' ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-300">
                                    Ready
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    Error
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end space-x-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => previewDocument(file.file, file.globalIndex)}
                                    className="h-6 w-6"
                                    title="Preview document"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeFile(file.globalIndex)}
                                    className="h-6 w-6"
                                    title="Remove document"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ))}
                      </TableBody>
                    {/* </div> */}
                  </Table>
                </Card>
              )}

              {isUploading && (
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-medium">Uploading documents...</p>
                    <p className="text-xs">{uploadProgress}%</p>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {mappedFiles.some(f => f.status === 'error') && (
                <Alert variant="destructive" className="mb-3 py-2 text-xs">
                  <AlertCircle className="h-3 w-3" />
                  <AlertDescription>
                    Some files could not be matched. Please check the file names.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2 mt-auto">
                <Button variant="outline" onClick={onClose} disabled={isUploading} size="sm">
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || mappedFiles.length === 0 || !mappedFiles.some(f => f.status === 'pending')}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  {isUploading ? (
                    <div className="flex items-center">
                      <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                      Uploading...
                    </div>
                  ) : 'Upload Documents'}
                </Button>
              </div>

            </div>

          </div>

          {/* Document Preview Panel */}
          <div className="col-span-1 lg:col-span-2 border-l bg-gray-50">
            {previewFile ? (
              <div className="h-full flex flex-col">
                <div className="p-2 border-b bg-gray-100 flex justify-between items-center">
                  <h3 className="text-sm font-medium truncate max-w-[200px]">{previewFile.file.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closePreview}
                    className="h-6 w-6"
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden p-2">
                  <iframe
                    src={previewFile.url}
                    className="w-full h-full border rounded"
                    title="Document Preview"
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-6 text-gray-400">
                <div>
                  <Eye className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a document to preview</p>
                  <p className="text-xs mt-1">PDF and image files can be previewed</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkDocumentUpload;