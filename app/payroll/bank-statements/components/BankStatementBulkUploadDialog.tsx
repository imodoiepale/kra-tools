// BankStatementBulkUploadDialog.tsx

import { useState, useRef, useEffect } from 'react'
import {
    Loader2, Upload, AlertTriangle, CheckCircle, UploadCloud,
    FileText, Building, Landmark, CreditCard, DollarSign,
    Calendar, X, ArrowRight, FileCheck, FilePlus, FileWarning,
    ChevronDown, ChevronRight, Save, Eye
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { BankValidationDialog } from './BankValidationDialog'
import { performBankStatementExtraction, processBulkExtraction } from '@/lib/bankExtractionUtils'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { PasswordInputDialog } from './PasswordInputDialog'

// Import the detectFileInfo function directly from utils
import {
    isPdfPasswordProtected,
    applyPasswordToFiles,
    detectAccountNumberFromFilename,
    getBankNameFromFilename
} from '@/lib/bankExtractionUtils'

// Initialize PDF.js worker
import * as pdfjsLib from 'pdfjs-dist';
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
    acc_password?: string
}

interface BulkUploadItem {
    file: File
    status: 'pending' | 'processing' | 'matched' | 'unmatched' | 'failed' | 'uploaded' | 'vouched'
    extractedData: any
    matchedBank?: Bank
    closingBalance?: number | null
    error?: string
    matchConfidence?: number
    uploadProgress?: number
    isVouched?: boolean
    vouchNotes?: string
    hasSoftCopy?: boolean
    hasHardCopy?: boolean
    password?: string
    passwordApplied?: boolean
}

interface BankStatementBulkUploadDialogProps {
    isOpen: boolean
    onClose: () => void
    banks: Bank[]
    cycleMonth: number
    cycleYear: number
    onUploadsComplete: () => void
    statementCycleId: string
}

export function BankStatementBulkUploadDialog({
    isOpen,
    onClose,
    banks,
    cycleMonth,
    cycleYear,
    onUploadsComplete,
    statementCycleId
}: BankStatementBulkUploadDialogProps) {
    const [activeTab, setActiveTab] = useState<string>('upload')
    const [uploadItems, setUploadItems] = useState<BulkUploadItem[]>([])
    const [uploading, setUploading] = useState<boolean>(false)
    const [overallProgress, setOverallProgress] = useState<number>(0)
    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
    const [showPasswordDialog, setShowPasswordDialog] = useState<boolean>(false)
    const [passwordProtectedFiles, setPasswordProtectedFiles] = useState<any[]>([])

    const fileInputRef = useRef<HTMLInputElement>(null)
    const { toast } = useToast()

    // Group banks by company
    const companiesMap = banks.reduce((acc, bank) => {
        if (!acc[bank.company_id]) {
            acc[bank.company_id] = {
                id: bank.company_id,
                name: bank.company_name,
                banks: []
            };
        }
        acc[bank.company_id].banks.push(bank);
        return acc;
    }, {});

    const companies = Object.values(companiesMap);


    // Function to detect password and account number from filename
    const detectFileInfoFromFilename = (filename: string) => {
        // Use the utility function
        const fileInfo = detectFileInfo(filename);
        setDetectedPassword(fileInfo.password);
        setDetectedAccountNumber(fileInfo.accountNumber);
    }

    // Function to detect password from filename
    const detectPasswordFromFilename = (filename: string): string | null => {
        // Simple pattern matching for common password formats in filenames
        // Examples: "statement_password123.pdf", "statement-pass_123.pdf"
        const passwordPatterns = [
            /pass[_\-]?(\w+)/i,             // Matches "pass_123", "pass-123", "password123"
            /pwd[_\-]?(\w+)/i,              // Matches "pwd_123", "pwd-123"
            /\b(?:p|pw)[\s_\-]?(\w{4,})\b/i // Matches "p 1234", "pw_1234" with min 4 chars
        ];

        for (const pattern of passwordPatterns) {
            const match = filename.match(pattern);
            if (match && match[1]) {
                const detectedPwd = match[1];
                console.log("Detected possible password in filename:", detectedPwd);
                return detectedPwd;
            }
        }

        return null;
    };

    

    // Format function for filenames
    const formatFileName = (file: File) => {
        const name = file.name || '';
        const lastDotIndex = name.lastIndexOf('.');

        if (lastDotIndex === -1) {
            return {
                shortName: name.length > 30 ? name.substring(0, 27) + '...' : name,
                fullName: name,
                extension: ''
            };
        }

        const baseName = name.substring(0, lastDotIndex);
        const extension = name.substring(lastDotIndex + 1);

        return {
            shortName: baseName.length > 30 ? baseName.substring(0, 27) + '...' : baseName,
            fullName: name,
            extension: extension
        };
    };

    // Handle file selection
    const handleFileSelection = (event) => {
        if (!selectedCompanyId) {
            toast({
                title: "Select a Company",
                description: "Please select a company before uploading files",
                variant: "warning"
            });
            return;
        }

        const files = event.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        const newItems = fileArray.map(file => {
            // Detect file information
            const fileName = file.name;
            const detectedPassword = detectPasswordFromFilename(fileName);
            const detectedAccountNumber = detectAccountNumberFromFilename(fileName);
            const detectedBankName = getBankNameFromFilename(fileName);

            // Find matching bank for this company
            const companyBanks = banks.filter(bank => bank.company_id === selectedCompanyId);

            // Try to match by account number first
            let matchedBank = null;
            if (detectedAccountNumber) {
                matchedBank = companyBanks.find(bank =>
                    bank.account_number.includes(detectedAccountNumber) ||
                    detectedAccountNumber.includes(bank.account_number)
                );
            }

            // If no match by account number, try by bank name
            if (!matchedBank && detectedBankName) {
                matchedBank = companyBanks.find(bank =>
                    bank.bank_name.toLowerCase().includes(detectedBankName.toLowerCase()) ||
                    detectedBankName.toLowerCase().includes(bank.bank_name.toLowerCase())
                );
            }

            return {
                file,
                status: 'pending',
                extractedData: null,
                matchedBank: matchedBank,
                closingBalance: null,
                error: null,
                matchConfidence: matchedBank ? 80 : 0,
                uploadProgress: 0,
                detectedInfo: {
                    password: detectedPassword,
                    accountNumber: detectedAccountNumber,
                    bankName: detectedBankName
                },
                fileName: formatFileName(file),
                originalName: file.name,
                hasSoftCopy: true,
                hasHardCopy: false
            };
        });

        setUploadItems([...uploadItems, ...newItems]);
    };

    // Simplified process files function, similar to single upload approach
    const processFiles = async () => {
        if (uploadItems.length === 0) {
            toast({
                title: 'No files selected',
                description: 'Please select bank statement files to upload',
                variant: 'destructive'
            });
            return;
        }

        if (!statementCycleId) {
            toast({
                title: 'Error',
                description: 'No statement cycle ID available',
                variant: 'destructive'
            });
            return;
        }

        setUploading(true);
        setActiveTab('processing');
        setOverallProgress(10);

        // For each file, first check if it's password protected
        const passwordItems = [];

        try {
            for (let i = 0; i < uploadItems.length; i++) {
                const item = uploadItems[i];

                // Update status to processing
                setUploadItems(items => {
                    const updated = [...items];
                    updated[i] = {
                        ...updated[i],
                        status: 'processing',
                        uploadProgress: 10
                    };
                    return updated;
                });

                // Check if PDF is password protected
                try {
                    const isProtected = await isPdfPasswordProtected(item.file);

                    if (isProtected) {
                        console.log(`File ${i} (${item.file.name}) is password protected`);

                        // Try with bank's password first
                        if (item.matchedBank?.acc_password) {
                            const success = await applyPasswordToFiles(item.file, item.matchedBank.acc_password);
                            if (success) {
                                // Password applied successfully
                                setUploadItems(items => {
                                    const updated = [...items];
                                    updated[i] = {
                                        ...updated[i],
                                        password: item.matchedBank.acc_password,
                                        passwordApplied: true
                                    };
                                    return updated;
                                });
                                continue;
                            }
                        }

                        // Try with detected password
                        if (item.detectedInfo?.password) {
                            const success = await applyPasswordToFiles(item.file, item.detectedInfo.password);
                            if (success) {
                                // Password applied successfully
                                setUploadItems(items => {
                                    const updated = [...items];
                                    updated[i] = {
                                        ...updated[i],
                                        password: item.detectedInfo.password,
                                        passwordApplied: true
                                    };
                                    return updated;
                                });
                                continue;
                            }
                        }

                        // If we reach here, we couldn't auto-apply a password
                        passwordItems.push({
                            index: i,
                            fileName: item.file.name,
                            file: item.file,
                            possiblePasswords: [
                                item.detectedInfo?.password,
                                item.matchedBank?.acc_password
                            ].filter(Boolean)
                        });
                    }
                } catch (error) {
                    console.error(`Error checking if PDF is password protected:`, error);
                    // Continue with the next file
                }
            }

            // If we have password-protected files that need manual input
            if (passwordItems.length > 0) {
                setPasswordProtectedFiles(passwordItems);
                setShowPasswordDialog(true);
                setOverallProgress(30);
                return; // Halt processing until passwords are provided
            }

            // Continue with extraction and upload
            await extractAndUploadFiles();

        } catch (error) {
            console.error('Error processing files:', error);
            toast({
                title: 'Error',
                description: `Failed to process files: ${error.message}`,
                variant: 'destructive'
            });
            setUploading(false);
        }
    };

    // Function to extract and upload files
    const extractAndUploadFiles = async () => {
        setOverallProgress(40);

        try {
            // Process each file individually
            for (let i = 0; i < uploadItems.length; i++) {
                const item = uploadItems[i];

                // Skip already uploaded or failed items
                if (item.status === 'uploaded' || item.status === 'failed') continue;

                // Process this file
                setUploadItems(items => {
                    const updated = [...items];
                    updated[i] = {
                        ...updated[i],
                        status: 'processing',
                        uploadProgress: 30
                    };
                    return updated;
                });

                try {
                    // Create URL for extraction
                    const fileUrl = URL.createObjectURL(item.file);

                    // Extract data if possible
                    let extractedData = null;
                    try {
                        const extractionResult = await performBankStatementExtraction(
                            fileUrl,
                            {
                                month: cycleMonth,
                                year: cycleYear,
                                password: item.passwordApplied ? item.password : null
                            }
                        );

                        if (extractionResult.success) {
                            extractedData = extractionResult.extractedData;

                            setUploadItems(items => {
                                const updated = [...items];
                                updated[i] = {
                                    ...updated[i],
                                    extractedData,
                                    status: 'matched',
                                    uploadProgress: 60
                                };
                                return updated;
                            });
                        }
                    } catch (extractError) {
                        console.error(`Extraction error for file ${i}:`, extractError);
                        // Continue with upload even if extraction fails
                    }

                    // Upload file to storage
                    const bank = item.matchedBank;
                    if (!bank) {
                        throw new Error("No bank matched for this file");
                    }

                    // Upload file to storage
                    let pdfPath = null;
                    const pdfFileName = `bank_statement_${bank.company_id}_${bank.id}_${cycleYear}_${cycleMonth}.pdf`;
                    const pdfFilePath = `statement_documents/${cycleYear}/${cycleMonth}/${bank.company_name}/${pdfFileName}`;

                    const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                        .from('Statement-Cycle')
                        .upload(pdfFilePath, item.file, {
                            cacheControl: '0',
                            upsert: true
                        });

                    if (pdfUploadError) throw pdfUploadError;
                    pdfPath = pdfUploadData.path;

                    // Create statement document info
                    const statementDocumentInfo = {
                        statement_pdf: pdfPath,
                        statement_excel: null,
                        document_size: item.file.size,
                        password: item.passwordApplied ? item.password : null
                    };

                    // Create statement record
                    const statementData = {
                        bank_id: bank.id,
                        company_id: bank.company_id,
                        statement_cycle_id: statementCycleId,
                        statement_month: cycleMonth,
                        statement_year: cycleYear,
                        has_soft_copy: item.hasSoftCopy,
                        has_hard_copy: item.hasHardCopy,
                        statement_document: statementDocumentInfo,
                        statement_extractions: extractedData || {
                            bank_name: null,
                            account_number: null,
                            currency: null,
                            statement_period: null,
                            opening_balance: null,
                            closing_balance: null,
                            monthly_balances: []
                        },
                        validation_status: {
                            is_validated: false,
                            validation_date: null,
                            validated_by: null,
                            mismatches: []
                        },
                        status: {
                            status: 'pending_validation',
                            assigned_to: null,
                            verification_date: null
                        }
                    };

                    // Check if statement already exists
                    const { data: existingStatement } = await supabase
                        .from('acc_cycle_bank_statements')
                        .select('id')
                        .eq('bank_id', bank.id)
                        .eq('statement_month', cycleMonth)
                        .eq('statement_year', cycleYear)
                        .maybeSingle();

                    if (existingStatement) {
                        // Update existing statement
                        await supabase
                            .from('acc_cycle_bank_statements')
                            .update(statementData)
                            .eq('id', existingStatement.id);
                    } else {
                        // Insert new statement
                        await supabase
                            .from('acc_cycle_bank_statements')
                            .insert([statementData]);
                    }

                    // Update UI
                    setUploadItems(items => {
                        const updated = [...items];
                        updated[i] = {
                            ...updated[i],
                            status: 'uploaded',
                            uploadProgress: 100
                        };
                        return updated;
                    });

                    // Clean up URL
                    URL.revokeObjectURL(fileUrl);

                } catch (itemError) {
                    console.error(`Error processing item ${i}:`, itemError);

                    setUploadItems(items => {
                        const updated = [...items];
                        updated[i] = {
                            ...updated[i],
                            status: 'failed',
                            error: itemError.message || "Unknown error",
                            uploadProgress: 0
                        };
                        return updated;
                    });
                }
            }

            // Processing complete
            setOverallProgress(100);

            // Count successes and failures
            const successCount = uploadItems.filter(item => item.status === 'uploaded').length;
            const failureCount = uploadItems.filter(item => item.status === 'failed').length;

            toast({
                title: 'Processing Complete',
                description: `Successfully uploaded ${successCount} statements${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
                variant: successCount > 0 ? 'default' : 'destructive'
            });

            // Notify parent about completion
            if (onUploadsComplete) {
                onUploadsComplete();
            }

        } catch (error) {
            console.error('Error in extractAndUploadFiles:', error);
            toast({
                title: 'Error',
                description: `Failed to upload files: ${error.message}`,
                variant: 'destructive'
            });
        } finally {
            setUploading(false);
        }
    };

    // Handle manual password application
    const handlePasswordSubmit = async (password, fileIndexes) => {
        if (!password || !fileIndexes || fileIndexes.length === 0) return false;

        let success = false;

        for (const index of fileIndexes) {
            const item = uploadItems[index];
            if (!item) continue;

            try {
                // Try to apply the password
                const passwordWorks = await applyPasswordToFiles(item.file, password);

                if (passwordWorks) {
                    // Update item with password
                    setUploadItems(items => {
                        const updated = [...items];
                        updated[index] = {
                            ...updated[index],
                            password,
                            passwordApplied: true
                        };
                        return updated;
                    });

                    success = true;
                }
            } catch (error) {
                console.error(`Error applying password to file ${index}:`, error);
            }
        }

        if (success) {
            // Remove processed files from passwordProtectedFiles
            setPasswordProtectedFiles(prev =>
                prev.filter(f => !fileIndexes.includes(f.index))
            );

            // If no more password-protected files, close dialog and continue processing
            if (passwordProtectedFiles.length <= fileIndexes.length) {
                setShowPasswordDialog(false);
                await extractAndUploadFiles();
            }

            return true;
        }

        return false;
    };

    // Skip password-protected files
    const skipPasswordFiles = (fileIndexes) => {
        // Remove these files from passwordProtectedFiles
        setPasswordProtectedFiles(prev =>
            prev.filter(f => !fileIndexes.includes(f.index))
        );

        // Mark files as failed
        setUploadItems(items => {
            return items.map((item, idx) => {
                if (fileIndexes.includes(idx)) {
                    return {
                        ...item,
                        status: 'failed',
                        error: 'Skipped password-protected file',
                        uploadProgress: 0
                    };
                }
                return item;
            });
        });

        // If no more password-protected files, close dialog and continue with remaining files
        if (passwordProtectedFiles.length <= fileIndexes.length) {
            setShowPasswordDialog(false);
            extractAndUploadFiles();
        }
    };

    // Handle drop for drag and drop functionality
    function handleDrop(event) {
        event.preventDefault();
        const files = event.dataTransfer.files;
        handleFileSelection({ target: { files } });
    }

    function handleDragOver(event) {
        event.preventDefault();
    }

    const handleClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // Format file size for display
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => {
                if (!open && !uploading) {
                    onClose();
                    setUploadItems([]);
                }
            }}>
                <DialogContent className="max-w-7xl max-h-[100vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <UploadCloud className="h-5 w-5" />
                            Bulk Upload Bank Statements
                            <Badge className="ml-2">
                                {format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')}
                            </Badge>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Company Selection */}
                        <div className="space-y-2">
                            <Label>Select Company</Label>
                            <select
                                className="w-full p-2 border rounded-md"
                                value={selectedCompanyId || ''}
                                onChange={(e) => setSelectedCompanyId(e.target.value ? parseInt(e.target.value) : null)}
                            >
                                <option value="">-- Select a Company --</option>
                                {companies.map((company: any) => (
                                    <option key={company.id} value={company.id}>
                                        {company.name} ({company.banks.length} banks)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Display company's banks */}
                        {selectedCompanyId && (
                            <div className="border rounded-md p-4 bg-gray-50">
                                <h3 className="font-medium mb-2">Available Banks</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {banks
                                        .filter(bank => bank.company_id === selectedCompanyId)
                                        .map(bank => (
                                            <div key={bank.id} className="bg-white p-3 rounded border">
                                                <p className="font-medium">{bank.bank_name}</p>
                                                <p className="text-sm font-mono">{bank.account_number}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Password: {bank.acc_password ?
                                                        <span className="text-green-600">{bank.acc_password}</span> :
                                                        <span className="text-red-500">Not set</span>}
                                                </p>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* File Upload Area */}
                        <div className="flex flex-col items-center gap-4 mt-4">
                            <div
                                className="group relative border-dashed border-2 border-gray-300 p-6 rounded-md w-full hover:bg-gray-50 transition-colors cursor-pointer"
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onClick={handleClick}
                            >
                                <Input
                                    id="pdf-file"
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf"
                                    multiple
                                    onChange={handleFileSelection}
                                    className="cursor-pointer opacity-0 absolute inset-0"
                                    disabled={!selectedCompanyId}
                                />
                                <div className="text-center">
                                    <UploadCloud className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                                    <p className="text-lg font-medium mb-1">Drag and drop files here, or click to browse</p>
                                    <p className="text-sm text-gray-500">
                                        Upload PDF bank statements for {selectedCompanyId ?
                                            companies.find((c: any) => c.id === selectedCompanyId)?.name :
                                            'selected company'}
                                    </p>
                                </div>
                            </div>

                            <Button
                                onClick={processFiles}
                                disabled={uploadItems.length === 0 || uploading}
                                className="mt-2"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <FilePlus className="h-4 w-4 mr-2" />
                                        Process {uploadItems.length} Files
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Uploaded Files List */}
                        {uploadItems.length > 0 && (
                            <div className="border rounded-md overflow-auto max-h-[400px]">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10">
                                        <TableRow>
                                            <TableHead className="w-[40px]">#</TableHead>
                                            <TableHead>File Name</TableHead>
                                            <TableHead>Size</TableHead>
                                            <TableHead>Matched Bank</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Progress</TableHead>
                                            <TableHead className="w-[80px]">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {uploadItems.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell className="font-medium">
                                                    {item.fileName.shortName}
                                                </TableCell>
                                                <TableCell>{formatFileSize(item.file.size)}</TableCell>
                                                <TableCell>
                                                    {item.matchedBank ? (
                                                        <div>
                                                            <p className="font-medium">{item.matchedBank.bank_name}</p>
                                                            <p className="text-xs font-mono">{item.matchedBank.account_number}</p>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                                                            No match
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {item.status === 'pending' && <Badge variant="outline">Pending</Badge>}
                                                    {item.status === 'processing' && <Badge className="bg-blue-50 text-blue-800">Processing</Badge>}
                                                    {item.status === 'matched' && <Badge className="bg-green-50 text-green-800">Matched</Badge>}
                                                    {item.status === 'uploaded' && <Badge className="bg-green-50 text-green-800">Uploaded</Badge>}
                                                    {item.status === 'failed' && <Badge variant="destructive">Failed</Badge>}
                                                </TableCell>
                                                <TableCell>
                                                    <Progress value={item.uploadProgress || 0} className="h-2 w-full" />
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            // Remove this item
                                                            setUploadItems(items => items.filter((_, i) => i !== index));
                                                        }}
                                                        disabled={uploading}
                                                        className="h-7 w-7 p-0"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* Processing Status */}
                        {uploading && (
                            <div className="space-y-2 mt-4">
                                <div className="flex justify-between text-sm">
                                    <span>Overall Progress</span>
                                    <span>{overallProgress}%</span>
                                </div>
                                <Progress value={overallProgress} className="h-2" />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={uploading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            onClick={processFiles}
                            disabled={uploadItems.length === 0 || uploading}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload Statements
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Password Dialog */}
            {showPasswordDialog && (
                <PasswordInputDialog
                    isOpen={showPasswordDialog}
                    onClose={() => setShowPasswordDialog(false)}
                    files={passwordProtectedFiles}
                    onPasswordSubmit={(password, indexes) => handlePasswordSubmit(password, indexes)}
                    onSkip={skipPasswordFiles}
                    cycleId={statementCycleId}
                />
            )}
        </>
    );
}
