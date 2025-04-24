// @ts-nocheck
import { useEffect, useState } from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UploadCloud, HelpCircle, FileText, Landmark, X, FilePlus, Loader2, FileSearch } from 'lucide-react';
import FileStatusBadge from './SharedComponents/FileStatusBadge';
import { formatFileSize, formatFileName, detectFileInfoFromFilename, fuzzyMatchBank } from './utils/extractionUtils';
import { BulkUploadItem } from './types';

interface UploadTabProps {
    value: string;
    uploadItems: BulkUploadItem[];
    setUploadItems: React.Dispatch<React.SetStateAction<BulkUploadItem[]>>;
    companies: any[];
    availableBanks: any[];
    selectedCompanyId: number | null;
    setSelectedCompanyId: React.Dispatch<React.SetStateAction<number | null>>;
    randomMode: boolean;
    setRandomMode: React.Dispatch<React.SetStateAction<boolean>>;
    handleStartProcessing: () => void;
    uploading: boolean;
    loadingCompanies: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
    isDragging: boolean;
    setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
    toast: any;
}

export default function UploadTab({
    value,
    uploadItems,
    setUploadItems,
    companies,
    availableBanks,
    selectedCompanyId,
    setSelectedCompanyId,
    randomMode,
    setRandomMode,
    handleStartProcessing,
    uploading,
    loadingCompanies,
    fileInputRef,
    isDragging,
    setIsDragging,
    toast
}: UploadTabProps) {
    // Drag and drop handlers
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (!randomMode && !selectedCompanyId) {
            toast({
                title: "Selection Required",
                description: "Please select a company or enable random mode",
                variant: "warning"
            });
            return;
        }

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelection({ target: { files: e.dataTransfer.files } });
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleClick = () => {
        if (fileInputRef.current && (!randomMode || selectedCompanyId)) {
            fileInputRef.current.click();
        } else if (!randomMode && !selectedCompanyId) {
            toast({
                title: "Select a Company",
                description: "Please select a company before uploading files",
                variant: "warning"
            });
        }
    };

    const handleFileSelection = async (event: any) => {
        if (!randomMode && !selectedCompanyId) {
            toast({
                title: "Selection Required",
                description: "Please select a company or enable random mode",
                variant: "warning"
            });
            return;
        }

        const files = event?.target?.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        const processedItems = await Promise.all(fileArray.map(async (file: File) => {
            if (!file) return null;

            // Detect file information
            const fileName = file.name || '';
            const fileInfo = detectFileInfoFromFilename(fileName) || {
                password: null,
                accountNumber: null,
                bankName: null
            };

            // Find matching bank for this company
            let matchedBank = null;
            let matchConfidence = 0;

            // Try to match by account number first (highest confidence)
            if (fileInfo.accountNumber) {
                if (randomMode) {
                    matchedBank = fuzzyMatchBank(fileName, availableBanks);
                    if (matchedBank) matchConfidence = 50;
                } else {
                    const companyBanks = availableBanks.filter(bank => bank?.company_id === selectedCompanyId);
                    matchedBank = companyBanks.find(bank =>
                        bank?.account_number?.includes(fileInfo.accountNumber) ||
                        fileInfo.accountNumber.includes(bank?.account_number || '')
                    );
                    if (matchedBank) matchConfidence = 90;
                }
            }

            // If no match by account number, try by bank name (medium confidence)
            if (!matchedBank && fileInfo.bankName) {
                if (randomMode) {
                    matchedBank = fuzzyMatchBank(fileName, availableBanks);
                    if (matchedBank) matchConfidence = 50;
                } else {
                    const companyBanks = availableBanks.filter(bank => bank?.company_id === selectedCompanyId);
                    matchedBank = companyBanks.find(bank =>
                        bank?.bank_name?.toLowerCase().includes(fileInfo.bankName.toLowerCase()) ||
                        fileInfo.bankName.toLowerCase().includes(bank?.bank_name?.toLowerCase() || '')
                    );
                    if (matchedBank) matchConfidence = 70;
                }
            }

            return {
                file,
                status: matchedBank ? 'matched' : 'unmatched',
                extractedData: null,
                matchedBank: matchedBank,
                closingBalance: null,
                error: null,
                matchConfidence,
                uploadProgress: 0,
                passwordApplied: false,
                password: null,
                detectedInfo: {
                    password: fileInfo.password,
                    accountNumber: fileInfo.accountNumber,
                    bankName: fileInfo.bankName
                },
                fileName: formatFileName(file),
                originalName: file.name || 'Unknown file',
                hasSoftCopy: true,
                hasHardCopy: false
            };
        }));

        const validItems = processedItems.filter(Boolean);
        setUploadItems(prevItems => [...prevItems, ...validItems]);
    };

    const removeItem = (index: number) => {
        setUploadItems(items => items.filter((_, i) => i !== index));
    };

    return (
        <TabsContent value={value} className="flex-1 flex flex-col overflow-auto p-2">
            <div className="space-y-4">
                {/* Company Selection */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-sm font-medium">Select Company</Label>
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="random-mode"
                                checked={randomMode}
                                onCheckedChange={setRandomMode}
                            />
                            <Label htmlFor="random-mode" className="text-xs">Random Mode</Label>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="cursor-help ml-1">
                                        <HelpCircle className="h-3.5 w-3.5 text-gray-500" />
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>Random mode auto-detects company and bank from filenames using fuzzy matching</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                    {loadingCompanies ? (
                        <div className="flex items-center justify-center py-2">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading companies...
                        </div>
                    ) : (
                        <Select
                            value={selectedCompanyId?.toString() || "placeholder"}
                            onValueChange={(value) => setSelectedCompanyId(value === "placeholder" ? null : parseInt(value))}
                            disabled={loadingCompanies || randomMode}
                        >
                            <SelectTrigger className={`w-full ${randomMode ? 'opacity-50' : ''}`}>
                                <SelectValue placeholder={randomMode ? "Auto-detect from filenames" : "Select a company"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="placeholder">-- Select a Company --</SelectItem>
                                {companies.map((company: any) => (
                                    <SelectItem key={company.id} value={company.id.toString()}>
                                        {company.company_name} {company.bankCount > 0 ? `(${company.bankCount} banks)` : "(No banks)"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Display company's banks when selected */}
                {(selectedCompanyId || randomMode) && (
                    <div className="border rounded-md p-4 bg-gray-50 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium">
                                {randomMode ? "Auto-detect Mode Active" : "Available Banks"}
                            </h3>
                            {!randomMode && selectedCompanyId && (
                                <Badge variant="outline" className="ml-2 bg-blue-50">
                                    {availableBanks.filter(bank => bank?.company_id === selectedCompanyId).length} Banks
                                </Badge>
                            )}
                        </div>

                        {randomMode ? (
                            <div className="bg-white border rounded-md p-4">
                                <div className="flex items-start space-x-3">
                                    <div className="bg-blue-50 p-2 rounded-full">
                                        <FileSearch className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-sm mb-1">Auto-detect Mode</h4>
                                        <p className="text-sm text-gray-600">
                                            In this mode, you can upload statements from any company. The system will
                                            automatically try to match each file with the appropriate bank account using:
                                        </p>
                                        <ul className="text-sm text-gray-600 mt-2 list-disc pl-5 space-y-1">
                                            <li>Bank name detection from filename</li>
                                            <li>Account number extraction</li>
                                            <li>Company name matching</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : selectedCompanyId && availableBanks.filter(bank => bank?.company_id === selectedCompanyId).length === 0 ? (
                            <div className="text-center text-gray-500 py-6 bg-white border rounded-md">
                                <Landmark className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                <p>No banks configured for this company</p>
                            </div>
                        ) : selectedCompanyId ? (
                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-gray-100">
                                        <TableRow>
                                            <TableHead className="font-medium">#</TableHead>
                                            <TableHead>Bank Name</TableHead>
                                            <TableHead>Account Number</TableHead>
                                            <TableHead>Currency</TableHead>
                                            <TableHead>Password</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {availableBanks
                                            .filter(bank => bank?.company_id === selectedCompanyId)
                                            .map((bank, index) => (
                                                <TableRow key={bank.id}>
                                                    <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                                                    <TableCell className="font-medium">{bank.bank_name}</TableCell>
                                                    <TableCell className="font-mono text-sm">{bank.account_number}</TableCell>
                                                    <TableCell>{bank.bank_currency || 'KES'}</TableCell>
                                                    <TableCell>
                                                        {bank.acc_password ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700">
                                                                {bank.acc_password}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-red-50 text-red-700">
                                                                Not Set
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 py-6 bg-white border rounded-md">
                                <Landmark className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                <p>Select a company to view available banks</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Enhanced drag and drop area */}
                <div className="flex items-center gap-2">
                    <div
                        className={`
                          group relative flex-1 border-2 border-dashed rounded-md cursor-pointer 
                          transition-all duration-200 text-center
                          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
                          ${!randomMode && !selectedCompanyId ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onClick={handleClick}
                    >
                        <div className="p-4 flex flex-col items-center justify-center space-y-1">
                            <UploadCloud className={`h-6 w-6 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                            <p className="text-sm text-gray-500">
                                {isDragging ? 'Drop files here...' : 'Drag or click to upload PDFs'}
                            </p>
                            <p className="text-xs text-gray-400">PDFs only</p>
                        </div>
                        <Input
                            id="pdf-file"
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            multiple
                            onChange={handleFileSelection}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={!randomMode && !selectedCompanyId}
                        />
                    </div>

                    <Button
                        onClick={handleStartProcessing}
                        disabled={uploadItems.length === 0 || (!randomMode && !selectedCompanyId) || uploading}
                        className="h-[80px] px-4 text-sm"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <FilePlus className="h-4 w-4 mr-2" />
                                Process ({uploadItems.length})
                            </>
                        )}
                    </Button>
                </div>

                {/* Files table */}
                <div className="border rounded-md overflow-hidden">
                    <div className="max-h-[350px] overflow-y-auto">
                        <Table className="w-full">
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead>File Name</TableHead>
                                    <TableHead className="w-[100px]">Size</TableHead>
                                    <TableHead>Matched Bank</TableHead>
                                    <TableHead>Acc Number</TableHead>
                                    <TableHead className="w-[120px]">Status</TableHead>
                                    <TableHead className="w-[80px]">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {uploadItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No files selected. Select PDF bank statements to upload.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    uploadItems.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                                            <TableCell className="font-medium">{item.fileName?.fullName || item.file.name}</TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatFileSize(item.file.size)}
                                            </TableCell>
                                            <TableCell>
                                                {item.matchedBank ? (
                                                    <div>
                                                        <p className="font-medium">{item.matchedBank.bank_name}</p>
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                                                        No match
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {item.matchedBank ? (
                                                    <div>
                                                        <p className="font-medium">{item.matchedBank.account_number}</p>
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                                                        No match
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell><FileStatusBadge status={item.status} /></TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => removeItem(index)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertTitle>Batch Processing</AlertTitle>
                    <AlertDescription>
                        Upload multiple bank statements at once. The system will attempt to automatically match each statement with the correct bank account.
                    </AlertDescription>
                </Alert>
            </div>
        </TabsContent>
    );
}