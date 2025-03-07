// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast'

const BulkDocumentUpload = ({ open, onClose, onUpload, payrollRecords }) => {
  const [files, setFiles] = useState([]);
  const [mappedFiles, setMappedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("upload");
  const [previewFile, setPreviewFile] = useState(null);
  const [previousFiles, setPreviousFiles] = useState([]); // Store previous files in case of accidental close
  const [previousMappedFiles, setPreviousMappedFiles] = useState([]); // Store previous mapped files
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  // Reset state when dialog is opened or closed
  useEffect(() => {
    if (open) {
      // If dialog is opening, keep the state as is
    } else {
      // If dialog is closing, store current state for potential recovery
      if (files.length > 0 || mappedFiles.length > 0) {
        setPreviousFiles(files);
        setPreviousMappedFiles(mappedFiles);
      }
    }
  }, [open, files, mappedFiles]);

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

      console.log('Processing file:', fileName); // Log the current file being processed

      // Extract information from filename
      const fileNameParts = fileName.split(' - ');
      
      // Handle filenames with different formats
      if (fileNameParts.length >= 2) {
        // Try to extract company name and PIN
        let possibleCompanyName = '';
        let possiblePin = '';
        
        // Check if filename has PIN format (e.g., P052249266P)
        const pinRegex = /[A-Z]\d{9}[A-Z]/;
        
        // Extract company name and PIN from different parts of the filename
        fileNameParts.forEach(part => {
          const pinMatch = part.match(pinRegex);
          if (pinMatch) {
            possiblePin = pinMatch[0];
          } else if (!possibleCompanyName || possibleCompanyName === fileNameParts[0].trim()) {
            // Only replace the default company name (which might be a date) if we find something better
            if (part.trim().length > 3 && !part.trim().match(/^\d{2}-\d{4}$/)) {
              possibleCompanyName = part.trim();
            }
          }
        });
        
        // If we still don't have a good company name, use the second part if available
        if ((!possibleCompanyName || possibleCompanyName.match(/^\d{2}-\d{4}$/)) && fileNameParts.length > 1) {
          possibleCompanyName = fileNameParts[1].trim();
        }

        console.log('Possible company name:', possibleCompanyName);
        console.log('Possible PIN:', possiblePin);

        // First, try to find the company by PIN if available
        if (possiblePin) {
          // Check both the main PIN field and the KRA PIN field
          matchedRecord = payrollRecords.find(record => {
            const companyPin = record.company?.pin;
            const kraPin = record.company?.kra_pin;
            
            // Case-insensitive comparison for both PIN fields
            return (companyPin && companyPin.toUpperCase() === possiblePin.toUpperCase()) || 
                  (kraPin && kraPin.toUpperCase() === possiblePin.toUpperCase());
          });
          
          console.log('PIN match:', matchedRecord?.company?.company_name || 'Not found');
        }

        // If no match by PIN, try to find the company by full name
        if (!matchedRecord) {
          matchedRecord = payrollRecords.find(record =>
            record.company?.company_name?.toLowerCase() === possibleCompanyName.toLowerCase()
          );

          console.log('Full name match:', matchedRecord?.company?.company_name || 'Not found');
        }

        // If still no match, try fuzzy matching with improved logic
        if (!matchedRecord) {
          // Get all company names from payroll records
          const companyNames = payrollRecords
            .filter(record => record.company?.company_name)
            .map(record => ({
              record,
              name: record.company.company_name.toLowerCase()
            }));

          // Split the possible company name into words
          const companyNameParts = possibleCompanyName.toLowerCase().split(' ');
          
          // Try multi-word matching first (more specific)
          for (let wordCount = Math.min(companyNameParts.length, 3); wordCount >= 2; wordCount--) {
            // Try different combinations of consecutive words
            for (let startIdx = 0; startIdx <= companyNameParts.length - wordCount; startIdx++) {
              const searchPhrase = companyNameParts.slice(startIdx, startIdx + wordCount).join(' ');
              
              // Skip very short phrases (less than 4 characters)
              if (searchPhrase.length < 4) continue;
              
              // Find companies that contain this phrase
              const matchingCompanies = companyNames.filter(company => 
                company.name.includes(searchPhrase)
              );
              
              if (matchingCompanies.length === 1) {
                // Exact single match found
                matchedRecord = matchingCompanies[0].record;
                console.log(`Multi-word match (${wordCount} words):`, matchedRecord?.company?.company_name);
                break;
              }
            }
            
            if (matchedRecord) break;
          }
          
          // If still no match, try single word matching (less specific)
          if (!matchedRecord) {
            // Find significant words (longer than 3 characters)
            const significantWords = companyNameParts.filter(word => word.length > 3);
            
            for (const word of significantWords) {
              // Find companies that contain this word
              const matchingCompanies = companyNames.filter(company => 
                company.name.includes(word)
              );
              
              if (matchingCompanies.length === 1) {
                // Single match found
                matchedRecord = matchingCompanies[0].record;
                console.log(`Single word match (${word}):`, matchedRecord?.company?.company_name);
                break;
              }
            }
          }
        }

        console.log('Final matched record:', matchedRecord?.company?.company_name || 'Not found'); // Log matched record

        // Determine document type based on filename
        const lowerFileName = fileName.toLowerCase();
        if (lowerFileName.includes('acknowledgement') || lowerFileName.includes('ack')) {
          documentType = 'paye_acknowledgment';
        } else if ((lowerFileName.includes('paye') || lowerFileName.includes('p.a.y.e')) && 
                  (lowerFileName.includes('payment') || lowerFileName.includes('slip') || lowerFileName.includes('return'))) {
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

        console.log('Document type:', documentType); // Log determined document type

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
            documentType: documentType || null,
            companyName: '',
            status: 'error',
            message: matchedRecord ? 'Could not determine document type' : 'Could not match file to a company'
          });
        }
      } else {
        // Handle files that don't match the expected format
        // Try to extract company name from single-part filenames (e.g., "COPPER SYNTEC LTD_PAYSLIPS.pdf")
        const fileName = file.name;
        const possibleCompanyName = fileName.split('_')[0].trim();
        
        console.log('Single part filename, possible company name:', possibleCompanyName);
        
        // Try to match by company name
        if (possibleCompanyName) {
          // Try exact match first
          matchedRecord = payrollRecords.find(record =>
            record.company?.company_name?.toLowerCase() === possibleCompanyName.toLowerCase()
          );
          
          // If no exact match, try contains match
          if (!matchedRecord) {
            const matchingRecords = payrollRecords.filter(record =>
              record.company?.company_name?.toLowerCase().includes(possibleCompanyName.toLowerCase())
            );
            
            if (matchingRecords.length === 1) {
              matchedRecord = matchingRecords[0];
            }
          }
          
          console.log('Single part filename match:', matchedRecord);
        }
        
        // Try to determine document type
        const lowerFileName = fileName.toLowerCase();
        if (lowerFileName.includes('payslip') || lowerFileName.includes('pay slip')) {
          documentType = 'paye_slip'; // Default to PAYE slip for payslips
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
            message: 'Filename format not recognized. Expected format: "Type - Company - Date.pdf"'
          });
        }
      }
    });

    setMappedFiles(prev => [...prev, ...mappedResults]);
  };

  const removeFile = (index) => {
    // Create new arrays instead of modifying existing ones to ensure state updates trigger re-renders
    const newMappedFiles = [...mappedFiles];
    newMappedFiles.splice(index, 1);
    setMappedFiles(newMappedFiles);
    
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);

    if (previewFile && previewFile.index === index) {
      setPreviewFile(null);
    }
  };

  const handleUpload = async () => {
    // Get all files with valid recordId and documentType, regardless of previous status
    const validFiles = mappedFiles.filter(f => f.recordId && f.documentType);

    console.log('Mapped files before upload:', mappedFiles); // Log mapped files state
    console.log('Valid files for upload:', validFiles); // Log valid files

    if (validFiles.length === 0) {
      console.error('No valid files to upload.'); // Log error
      toast({
        title: 'Error',
        description: 'No valid files to upload. Please check file mappings.',
        variant: 'destructive'
      });
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

      console.log('Upload successful!'); // Log success
      toast({
        title: 'Success',
        description: `Successfully uploaded ${validFiles.length} documents`,
        variant: 'default'
      });

      // Clear interval if it's still running
      clearInterval(interval);

      // Clear the files state after successful upload
      setFiles([]);
      setMappedFiles([]);
      
      // Simulate complete upload
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload failed:', error); // Log error
      toast({
        title: 'Error',
        description: 'Failed to upload documents. Please try again.',
        variant: 'destructive'
      });
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

  const handleCancel = () => {
    // Store current files before clearing
    if (files.length > 0 || mappedFiles.length > 0) {
      setPreviousFiles(files);
      setPreviousMappedFiles(mappedFiles);
    }
    
    // Clear current state
    setFiles([]);
    setMappedFiles([]);
    setPreviewFile(null);
    setUploadProgress(0);
    
    // Close the dialog
    onClose();
  };

  const handleReopen = () => {
    // Restore previous files if available
    if (previousFiles.length > 0 || previousMappedFiles.length > 0) {
      setFiles(previousFiles);
      setMappedFiles(previousMappedFiles);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (open) {
        // Dialog is opening
        handleReopen();
      } else {
        // Dialog is closing without explicit cancel
        onClose();
      }
    }}>
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
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                        {mappedFiles.filter(f => f.status === 'pending').length} valid
                      </Badge>
                      {mappedFiles.some(f => f.status === 'error') && (
                        <Badge variant="destructive">
                          {mappedFiles.filter(f => f.status === 'error').length} invalid
                        </Badge>
                      )}
                    </div>
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
                    <TableBody>
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
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select Company" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {payrollRecords
                                        .sort((a, b) => {
                                          if (a.company && b.company) {
                                            return a.company.company_name.localeCompare(b.company.company_name);
                                          }
                                          return 0;
                                        })
                                        .map((record) => (
                                          <SelectItem
                                            key={record.id}
                                            value={record.company?.company_name || ''}
                                            className="text-xs"
                                          >
                                            {record.company?.company_name || 'Unknown Company'}
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
                <Button variant="outline" onClick={handleCancel} disabled={isUploading} size="sm">
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
        
        {/* Bottom buttons fixed at the bottom of the dialog */}
        <div className="border-t p-3 bg-gray-50 flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || mappedFiles.length === 0 || !mappedFiles.some(f => f.status === 'pending')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isUploading ? (
              <div className="flex items-center">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </div>
            ) : 'Upload Documents'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkDocumentUpload;