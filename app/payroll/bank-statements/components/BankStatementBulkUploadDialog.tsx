//@ts-nocheck
// BankStatementBulkUploadDialog.tsx

import { useState, useRef, useEffect } from 'react'
import {
    Loader2, Upload, AlertTriangle, CheckCircle, UploadCloud,
    FileText, Building, Landmark, CreditCard, DollarSign,
    Calendar, X, ArrowRight, FileCheck, FilePlus, FileWarning,
    ChevronDown, ChevronRight, Save, Eye, CircleDashed, XCircle
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
import {
    isPdfPasswordProtected,
    applyPasswordToFiles,
    performBankStatementExtraction,
    processBulkExtraction
} from '@/lib/bankExtractionUtils'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from '@/components/ui/card'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { Progress } from '@/components/ui/progress'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { PasswordInputDialog } from './PasswordInputDialog'

// Import PDF.js functionality
import * as pdfjsLib from 'pdfjs-dist';
// Initialize PDF.js worker
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
    detectedInfo?: {
        password?: string;
        accountNumber?: string;
        bankName?: string;
    }
}

interface CompanyGroup {
    companyId: number
    companyName: string
    isExpanded: boolean
    isVouched: boolean
    statements: BulkUploadItem[]
}

interface BankStatementBulkUploadDialogProps {
    isOpen: boolean
    onClose: () => void
    banks: Bank[]
    cycleMonth: number
    cycleYear: number
    statementCycleId: string | null
    onUploadsComplete: () => void
}

export function BankStatementBulkUploadDialog({
    isOpen,
    onClose,
    banks = [], // Provide a default empty array to prevent undefined errors
    cycleMonth,
    cycleYear,
    statementCycleId,
    onUploadsComplete
}: BankStatementBulkUploadDialogProps) {
    const safeBanks = Array.isArray(banks) ? banks : [];
    const [activeTab, setActiveTab] = useState<string>('upload')
    const [uploadItems, setUploadItems] = useState<BulkUploadItem[]>([])
    const [uploading, setUploading] = useState<boolean>(false)
    const [processingIndex, setProcessingIndex] = useState<number>(-1)
    const [overallProgress, setOverallProgress] = useState<number>(0)
    const [totalMatched, setTotalMatched] = useState<number>(0)
    const [totalUnmatched, setTotalUnmatched] = useState<number>(0)
    const [companyGroups, setCompanyGroups] = useState<CompanyGroup[]>([])
    const [showValidation, setShowValidation] = useState<boolean>(false)
    const [currentValidationItem, setCurrentValidationItem] = useState<{ item: BulkUploadItem, index: number } | null>(null)
    const [validationResult, setValidationResult] = useState<any>(null)

    const [localCycleId, setLocalCycleId] = useState<string | null>(statementCycleId);

    const [currentManualMatchItem, setCurrentManualMatchItem] = useState<number | null>(null);
    const [showBankSelectorDialog, setShowBankSelectorDialog] = useState<boolean>(false);

    const [passwordProtectedFiles, setPasswordProtectedFiles] = useState([]);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
    const [vouchingNotes, setVouchingNotes] = useState<{ [key: number]: string }>({});
    const [vouchingChecked, setVouchingChecked] = useState<{ [key: number]: boolean }>({});
    const [closingBalanceInputs, setClosingBalanceInputs] = useState<{ [key: number]: string }>({});
    const [selectedBankIds, setSelectedBankIds] = useState<{ [key: number]: number }>({});
    const [softCopyStates, setSoftCopyStates] = useState<{ [key: number]: boolean }>({});
    const [hardCopyStates, setHardCopyStates] = useState<{ [key: number]: boolean }>({});

    // Use useEffect to sync with prop changes
    useEffect(() => {
        if (statementCycleId) {
            setLocalCycleId(statementCycleId);
        }
    }, [statementCycleId]);

    const fileInputRef = useRef<HTMLInputElement>(null)
    const { toast } = useToast()

    // Effect to organize items by company after processing
    useEffect(() => {
        if (activeTab === 'vouching') {
            organizeByCompany();
        }
    }, [activeTab, uploadItems]);

    const companiesMap = {};

    // Only try to reduce if banks is defined and not empty
    if (banks && Array.isArray(banks) && banks.length > 0) {
        banks.forEach(bank => {
            if (bank && bank.company_id) {
                if (!companiesMap[bank.company_id]) {
                    companiesMap[bank.company_id] = {
                        id: bank.company_id,
                        name: bank.company_name || 'Unknown Company',
                        banks: []
                    };
                }
                companiesMap[bank.company_id].banks.push(bank);
            }
        });
    }

    const companies = Object.values(companiesMap);

    const organizeByCompany = () => {
        // Only include matched/uploaded items
        const validItems = uploadItems.filter(item =>
            item.status === 'matched' || item.status === 'uploaded' || item.status === 'vouched'
        );

        // Group by company
        const groupedByCompany = validItems.reduce((groups, item) => {
            if (!item.matchedBank) return groups;

            const companyId = item.matchedBank.company_id;
            const companyName = item.matchedBank.company_name;

            const existingGroup = groups.find(g => g.companyId === companyId);

            if (existingGroup) {
                existingGroup.statements.push(item);
                existingGroup.isVouched = existingGroup.statements.every(s => s.isVouched);
            } else {
                groups.push({
                    companyId,
                    companyName,
                    isExpanded: false,
                    isVouched: item.isVouched || false,
                    statements: [item]
                });
            }

            return groups;
        }, [] as CompanyGroup[]);

        // Ensure only one company is expanded at a time - expand first non-vouched company
        const firstNonVouchedIndex = groupedByCompany.findIndex(g => !g.isVouched);

        if (firstNonVouchedIndex >= 0) {
            groupedByCompany.forEach((group, index) => {
                group.isExpanded = index === firstNonVouchedIndex;
            });
        } else if (groupedByCompany.length > 0) {
            // If all are vouched, expand the first one
            groupedByCompany[0].isExpanded = true;
        }

        setCompanyGroups(groupedByCompany);
    };

    const formatFileName = (file: File): { shortName: string, fullName: string, extension: string } => {
        if (!file) return { shortName: 'Unknown file', fullName: 'Unknown file', extension: '' };

        const name = file.name || '';
        const lastDotIndex = name.lastIndexOf('.');

        // Handle files with no extension
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

    function detectPasswordFromFilename(filename) {
        if (!filename) return null;

        const lowerFilename = filename.toLowerCase();

        // Expanded list of password indicators
        const passwordIndicators = [
            'pw', 'pwd', 'password', 'passcode', 'pass', 'p w', 'p-w', 'p_w', 'pw-', 'pw - ',
            'code', 'access', 'key', 'pin', 'secure'
        ];

        for (const indicator of passwordIndicators) {
            const regex = new RegExp(`${indicator}[-_:\\s]*([0-9a-zA-Z]{4,12})`, 'i');
            const match = filename.match(regex);
            if (match && match[1]) {
                return match[1]; // Return the first detected password-like pattern
            }
        }

        // Exclude common year patterns (like 2024)
        const accountMatch = filename.match(/\b(?!202[0-9])(\d{6,12})\b(?!.*\d{6,12})/);
        if (accountMatch && accountMatch[1]) {
            const acc = accountMatch[1];
            return acc.length >= 6 ? acc.slice(-6) : acc;
        }

        // Exclude numbers that look like years (2020-2029)
        const digitGroups = filename.match(/\b(?!202[0-9])\d{4,8}\b/g);
        if (digitGroups && digitGroups.length > 0) {
            return digitGroups[digitGroups.length - 1]; // Last number detected, avoiding years
        }

        return null;
    }

    function detectAccountNumberFromFilename(filename) {
        if (!filename) return null;

        const lowerFilename = filename.toLowerCase();

        // Look for patterns after account indicators
        const accountIndicators = ['acc', 'account', 'acct', 'a/c', '#', 'no'];

        for (const indicator of accountIndicators) {
            const indicatorIndex = lowerFilename.indexOf(indicator);

            if (indicatorIndex !== -1) {
                // Get text after the indicator
                const afterIndicator = filename.substring(indicatorIndex + indicator.length).trim();

                // Look for digit sequences (6-16 digits is typical for account numbers)
                const accountMatch = afterIndicator.match(/^[\s-_:\.]*(\d{6,16})/);

                if (accountMatch && accountMatch[1]) {
                    return accountMatch[1].replace(/[^0-9]/g, ''); // Remove non-digits
                }
            }
        }

        // Look for sequences of 6-16 digits that could be account numbers
        const digitMatches = filename.match(/\b\d{6,16}\b/g);
        if (digitMatches && digitMatches.length > 0) {
            return digitMatches[0].replace(/[^0-9]/g, '');
        }

        return null;
    }

    function getBankNameFromFilename(filename) {
        if (!filename) return null;

        const lowerFilename = filename.toLowerCase();

        // Common bank names to check for
        const commonBanks = [
            'barclays', 'hsbc', 'stanchart', 'standard chartered', 'equity',
            'kcb', 'cooperative', 'coop', 'family', 'absa', 'ncba', 'dtb',
            'diamond trust', 'citibank', 'citi', 'i&m', 'i and m', 'national',
            'stanbic', 'bank of africa', 'boa', 'prime', 'spire', 'gulf'
        ];

        for (const bank of commonBanks) {
            if (lowerFilename.includes(bank)) {
                return bank.charAt(0).toUpperCase() + bank.slice(1);
            }
        }

        return null;
    }

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

    const handleStartProcessing = async () => {
        if (uploadItems.length === 0) {
            toast({
                title: 'No files selected',
                description: 'Please select bank statement files to upload',
                variant: 'destructive'
            });
            return;
        }

        // Check if we have a cycle ID, create one if not
        if (!localCycleId) {
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

        // Process files with password handling
        await processFiles();
    };

    const processFiles = async () => {
        try {
            // Filter out files that are already processed
            const filesToProcess = uploadItems.filter(item =>
                item.status !== 'uploaded' && item.status !== 'vouched'
            );

            if (filesToProcess.length === 0) {
                toast({
                    title: 'No files to process',
                    description: 'All files have already been processed',
                    variant: 'default'
                });
                setUploading(false);
                return;
            }

            // Process password-protected files first
            const passwordItems = [];

            for (let i = 0; i < filesToProcess.length; i++) {
                const item = filesToProcess[i];
                const index = uploadItems.indexOf(item);

                // Update status to processing
                setUploadItems(prev => {
                    const updated = [...prev];
                    updated[index] = {
                        ...updated[index],
                        status: 'processing',
                        uploadProgress: 10
                    };
                    return updated;
                });

                // Check if PDF is password protected
                let isProtected = false;
                try {
                    isProtected = await isPdfPasswordProtected(item.file);
                } catch (error) {
                    console.error(`Error checking if file is password protected:`, error);
                    // Assume it might be protected if we can't check
                    isProtected = true;
                }

                if (isProtected) {
                    console.log(`File ${i} (${item.file.name}) is password protected`);

                    // Try with bank's password first
                    if (item.matchedBank?.acc_password) {
                        try {
                            const success = await applyPasswordToFiles(item.file, item.matchedBank.acc_password);
                            if (success) {
                                // Password applied successfully
                                setUploadItems(prev => {
                                    const updated = [...prev];
                                    updated[index] = {
                                        ...updated[index],
                                        password: item.matchedBank.acc_password,
                                        passwordApplied: true,
                                        uploadProgress: 20
                                    };
                                    return updated;
                                });
                                continue;
                            }
                        } catch (error) {
                            console.error(`Error applying bank password:`, error);
                        }
                    }

                    // Try with detected password
                    if (item.detectedInfo?.password) {
                        try {
                            const success = await applyPasswordToFiles(item.file, item.detectedInfo.password);
                            if (success) {
                                // Password applied successfully
                                setUploadItems(prev => {
                                    const updated = [...prev];
                                    updated[index] = {
                                        ...updated[index],
                                        password: item.detectedInfo.password,
                                        passwordApplied: true,
                                        uploadProgress: 20
                                    };
                                    return updated;
                                });
                                continue;
                            }
                        } catch (error) {
                            console.error(`Error applying detected password:`, error);
                        }
                    }

                    // If we reach here, we couldn't auto-apply a password
                    passwordItems.push({
                        index,
                        fileName: item.file.name,
                        file: item.file,
                        possiblePasswords: [
                            item.detectedInfo?.password,
                            item.matchedBank?.acc_password
                        ].filter(Boolean)
                    });
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
            await uploadProcessedFiles();

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

    // Extract and upload files
    const uploadProcessedFiles = async () => {
        setOverallProgress(40);
        let successCount = 0;
        let failureCount = 0;

        try {
            // Process each file individually
            for (let i = 0; i < uploadItems.length; i++) {
                const item = uploadItems[i];

                // Skip already uploaded or failed items
                if (item.status === 'uploaded' || item.status === 'failed') continue;

                setUploadItems(prev => {
                    const updated = [...prev];
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
                        setUploadItems(prev => {
                            const updated = [...prev];
                            updated[i].uploadProgress = 40;
                            return updated;
                        });

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

                            setUploadItems(prev => {
                                const updated = [...prev];
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

                    setUploadItems(prev => {
                        const updated = [...prev];
                        updated[i].uploadProgress = 70;
                        return updated;
                    });

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

                    setUploadItems(prev => {
                        const updated = [...prev];
                        updated[i].uploadProgress = 80;
                        return updated;
                    });

                    // Create statement document info
                    const statementDocumentInfo = {
                        statement_pdf: pdfPath,
                        statement_excel: null,
                        document_size: item.file.size,
                        password: item.passwordApplied ? item.password : null
                    };

                    // Create statement data
                    const statementData = {
                        bank_id: bank.id,
                        company_id: bank.company_id,
                        statement_cycle_id: localCycleId,
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

                    setUploadItems(prev => {
                        const updated = [...prev];
                        updated[i].uploadProgress = 90;
                        return updated;
                    });

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
                    setUploadItems(prev => {
                        const updated = [...prev];
                        updated[i] = {
                            ...updated[i],
                            status: 'uploaded',
                            uploadProgress: 100
                        };
                        return updated;
                    });

                    // Clean up URL
                    URL.revokeObjectURL(fileUrl);

                    successCount++;

                } catch (itemError) {
                    console.error(`Error processing item ${i}:`, itemError);

                    setUploadItems(prev => {
                        const updated = [...prev];
                        updated[i] = {
                            ...updated[i],
                            status: 'failed',
                            error: itemError.message || "Unknown error",
                            uploadProgress: 0
                        };
                        return updated;
                    });

                    failureCount++;
                }
            }

            // Processing complete
            setOverallProgress(100);
            setTotalMatched(successCount);
            setTotalUnmatched(failureCount);

            toast({
                title: 'Processing Complete',
                description: `Successfully uploaded ${successCount} statements${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
                variant: successCount > 0 ? 'default' : 'destructive'
            });

            // Notify parent about completion
            if (onUploadsComplete) {
                onUploadsComplete();
            }

            // Switch to vouching if there were successful uploads
            if (successCount > 0) {
                setActiveTab('vouching');
            } else {
                setActiveTab('upload');
            }

        } catch (error) {
            console.error('Error in uploadProcessedFiles:', error);
            toast({
                title: 'Error',
                description: `Failed to upload files: ${error.message}`,
                variant: 'destructive'
            });
        } finally {
            setUploading(false);
        }
    };

    // Handle password application
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
                    setUploadItems(prev => {
                        const updated = [...prev];
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
                await uploadProcessedFiles();
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
        setUploadItems(prev => {
            return prev.map((item, idx) => {
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
            uploadProcessedFiles();
        }
    };

    const removeItem = (index: number) => {
        setUploadItems(items => items.filter((_, i) => i !== index))
    }

    const toggleCompanyExpansion = (companyId: number) => {
        setCompanyGroups(groups => {
            return groups.map(group => ({
                ...group,
                isExpanded: group.companyId === companyId ? !group.isExpanded : false
            }));
        });
    };

    const markCompanyVouched = (companyId: number, isVouched: boolean) => {
        // Update all statements for this company
        setUploadItems(items => {
            return items.map(item => {
                if (item.matchedBank && item.matchedBank.company_id === companyId) {
                    return {
                        ...item,
                        isVouched,
                        status: isVouched ? 'vouched' : 'uploaded'
                    };
                }
                return item;
            });
        });

        // Update company group
        setCompanyGroups(groups => {
            return groups.map(group => {
                if (group.companyId === companyId) {
                    return {
                        ...group,
                        isVouched,
                        statements: group.statements.map(statement => ({
                            ...statement,
                            isVouched,
                            status: isVouched ? 'vouched' : 'uploaded'
                        }))
                    };
                }
                return group;
            });
        });

        // Move to next unvouched company
        if (isVouched) {
            const nextNonVouchedGroup = companyGroups.find(g =>
                !g.isVouched && g.companyId !== companyId
            );

            if (nextNonVouchedGroup) {
                toggleCompanyExpansion(nextNonVouchedGroup.companyId);
            }
        }
    };

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

    // Get status badge component
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="bg-gray-100 text-gray-800">Pending</Badge>
            case 'processing':
                return <Badge variant="outline" className="bg-blue-100 text-blue-800">Processing</Badge>
            case 'matched':
                return <Badge variant="outline" className="bg-green-100 text-green-800">Matched</Badge>
            case 'unmatched':
                return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Unmatched</Badge>
            case 'failed':
                return <Badge variant="outline" className="bg-red-100 text-red-800">Failed</Badge>
            case 'uploaded':
                return <Badge variant="outline" className="bg-green-100 text-green-800">Uploaded</Badge>
            case 'vouched':
                return <Badge variant="outline" className="bg-purple-100 text-purple-800">Vouched</Badge>
            default:
                return <Badge variant="outline">Unknown</Badge>
        }
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
                        <div className="bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50 -mx-6 -mt-6 p-6 rounded-t-lg border-b border-blue-200">
                            <div className="mb-2 flex justify-center">
                                <div className="h-14 w-14 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shadow-sm">
                                    <UploadCloud className="h-7 w-7 text-blue-600" />
                                </div>
                            </div>
                            <DialogTitle className="text-center text-xl text-blue-800">Bulk Upload Bank Statements</DialogTitle>
                            <p className="text-center text-blue-600 text-sm mt-1">
                                {format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')}
                            </p>
                        </div>
                    </DialogHeader>

                    <Tabs
                        defaultValue="upload"
                        value={activeTab}
                        onValueChange={setActiveTab}
                    >
                        <TabsList>
                            <TabsTrigger value="upload" disabled={uploading}>Upload Files</TabsTrigger>
                            <TabsTrigger value="processing">Processing</TabsTrigger>
                            <TabsTrigger value="review">Review & Match</TabsTrigger>
                            <TabsTrigger value="vouching">Vouching</TabsTrigger>
                        </TabsList>

                        <TabsContent value="upload" className="flex-1 flex flex-col space-y-4 py-4 px-1">
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

                                {/* Display company's banks when selected */}
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

                                <div className="flex items-center gap-4">
                                    <div
                                        className="group relative border-dashed border-2 border-gray-300 p-6 rounded-md hover:bg-gray-50 transition-colors flex-1"
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
                                        <p className="text-center text-gray-500">Drag and drop files here, or click to select files</p>
                                    </div>
                                    <Button
                                        onClick={handleStartProcessing}
                                        disabled={uploadItems.length === 0 || !selectedCompanyId}
                                    >
                                        <FilePlus className="h-4 w-4 mr-2" />
                                        Process Files ({uploadItems.length})
                                    </Button>
                                </div>

                                <div className="border rounded-md overflow-hidden" style={{ maxHeight: '400px' }}>
                                    <div className="overflow-y-auto" style={{ maxHeight: '350px' }}>
                                        <Table className="w-full">
                                            <TableHeader className="sticky top-0 bg-background z-10">
                                                <TableRow>
                                                    <TableHead>#</TableHead>
                                                    <TableHead>File Name</TableHead>
                                                    <TableHead>Size</TableHead>
                                                    <TableHead>Matched Bank</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {uploadItems.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                            No files selected. Select PDF bank statements to upload.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    uploadItems.map((item, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                                                            <TableCell className="font-medium">{item.fileName.fullName}</TableCell>
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
                                                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                                                            <TableCell>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="bg-red-50 hover:bg-red-100 text-red-600"
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
                                        Upload multiple bank statements at once. The system will attempt to automatically match each statement with the correct bank account based on the document content.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </TabsContent>

                        <TabsContent value="processing" className="flex-1 flex flex-col space-y-2 py-2 px-2">
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg flex items-center">
                                            <Loader2 className={`h-5 w-5 mr-2 ${uploading ? 'animate-spin' : ''}`} />
                                            Bulk Processing Status
                                        </CardTitle>
                                        <CardDescription>
                                            Processing {uploadItems.length} files {uploading ? '(in progress)' : '(completed)'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-6">
                                            {/* Overall Progress */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Overall Progress</span>
                                                    <span>{overallProgress}%</span>
                                                </div>
                                                <Progress value={overallProgress} className="h-2" />
                                            </div>

                                            {/* Stages Progress */}
                                            <div className="grid grid-cols-4 gap-4">
                                                <div className={`p-3 rounded-md border ${overallProgress >= 25
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {overallProgress >= 25 ? (
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                                        )}
                                                        <span className="text-sm font-medium">File Processing</span>
                                                    </div>
                                                </div>
                                                <div className={`p-3 rounded-md border ${overallProgress >= 50
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {overallProgress >= 50 ? (
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                                        )}
                                                        <span className="text-sm font-medium">Data Extraction</span>
                                                    </div>
                                                </div>
                                                <div className={`p-3 rounded-md border ${overallProgress >= 75
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {overallProgress >= 75 ? (
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                                        )}
                                                        <span className="text-sm font-medium">Statement Creation</span>
                                                    </div>
                                                </div>
                                                <div className={`p-3 rounded-md border ${overallProgress >= 95
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {overallProgress >= 95 ? (
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                                        )}
                                                        <span className="text-sm font-medium">Finalizing</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Processing Stats */}
                                            <div className="grid grid-cols-3 gap-4 mt-4">
                                                <div className="p-3 bg-green-50 rounded-md border border-green-200">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                        <span className="text-sm font-medium text-green-800">Matched: {totalMatched}</span>
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                                                    <div className="flex items-center gap-2">
                                                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                        <span className="text-sm font-medium text-yellow-800">Unmatched: {totalUnmatched}</span>
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-red-50 rounded-md border border-red-200">
                                                    <div className="flex items-center gap-2">
                                                        <XCircle className="h-4 w-4 text-red-500" />
                                                        <span className="text-sm font-medium text-red-800">
                                                            Failed: {uploadItems.filter(i => i.status === 'failed').length}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex justify-end pt-4">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        if (overallProgress >= 100) {
                                                            setActiveTab('vouching');
                                                        } else {
                                                            setActiveTab('review');
                                                        }
                                                    }}
                                                    disabled={uploading}
                                                    className="bg-blue-500 hover:bg-blue-600 text-white hover:text-white"
                                                >
                                                    {overallProgress >= 100 ? 'Continue to Vouching' : 'Review Results'}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Individual File Status Table */}
                                <div className="border rounded-md overflow-hidden" style={{ maxHeight: '400px' }}>
                                    <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
                                        <Table className="w-full">
                                            <TableHeader className="sticky top-0 bg-white z-10">
                                                <TableRow>
                                                    <TableHead>#</TableHead>
                                                    <TableHead>File Name</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Progress</TableHead>
                                                    <TableHead>Bank/Account</TableHead>
                                                    <TableHead>Password</TableHead>
                                                    <TableHead>Details</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {uploadItems.map((item, index) => (
                                                    <TableRow key={index} className={item.status === 'failed' ? 'bg-red-50' : ''}>
                                                        <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                                                        <TableCell className="font-medium text-sm truncate max-w-[200px]" title={item.file.name}>
                                                            {item.file.name}
                                                        </TableCell>
                                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                                        <TableCell>
                                                            <Progress value={item.uploadProgress || 0} className="h-2 w-32" />
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.matchedBank ? (
                                                                <div className="text-xs">
                                                                    <div className="font-medium">{item.matchedBank.bank_name}</div>
                                                                    <div className="text-muted-foreground">{item.matchedBank.account_number}</div>
                                                                </div>
                                                            ) : item.detectedInfo?.accountNumber ? (
                                                                <div className="text-xs">
                                                                    <div className="text-muted-foreground">Detected: {item.detectedInfo.accountNumber}</div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">Not detected</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.passwordApplied ? (
                                                                <div className="text-xs font-mono text-green-600">{item.password}</div>
                                                            ) : item.detectedInfo?.password ? (
                                                                <div className="text-xs font-mono">{item.detectedInfo.password}</div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">Not detected</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.status === 'failed' ? (
                                                                <div className="text-xs text-red-600">{item.error}</div>
                                                            ) : item.status === 'processing' ? (
                                                                <div className="text-xs text-blue-600">Processing...</div>
                                                            ) : (
                                                                <div className="text-xs text-muted-foreground">
                                                                    {item.extractedData ? 'Data extracted' : 'No data yet'}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="review" className="flex-1 flex flex-col overflow-hidden">
                            <div className="border rounded-md overflow-hidden flex-1">
                                <div className="max-h-[calc(90vh-420px)] overflow-y-auto">
                                    <Table className="min-w-full">
                                        <TableHeader className="sticky top-0 bg-white z-10 shadow">
                                            <TableRow>
                                                <TableHead className="w-[40px] text-xs font-semibold">#</TableHead>
                                                <TableHead className="text-xs font-semibold">Company</TableHead>
                                                <TableHead className="text-xs font-semibold">Bank Name</TableHead>
                                                <TableHead className="text-xs font-semibold">Account Number</TableHead>
                                                <TableHead className="text-xs font-semibold">Status</TableHead>
                                                <TableHead className="text-xs font-semibold">Extraction</TableHead>
                                                <TableHead className="text-xs font-semibold">Password</TableHead>
                                                <TableHead className="text-xs font-semibold">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {uploadItems.map((item, index) => (
                                                <TableRow key={index} className={item.status === 'unmatched' ? 'bg-yellow-50' : ''}>
                                                    <TableCell className="text-xs">{index + 1}</TableCell>
                                                    <TableCell className="text-xs">{item.matchedBank?.company_name || 'Unknown'}</TableCell>
                                                    <TableCell className="text-xs">{item.matchedBank?.bank_name || item.detectedInfo?.bankName || 'Unknown'}</TableCell>
                                                    <TableCell className="font-mono text-xs">{item.matchedBank?.account_number || item.detectedInfo?.accountNumber || 'Unknown'}</TableCell>
                                                    <TableCell className="text-xs">{getStatusBadge(item.status)}</TableCell>
                                                    <TableCell className="text-xs">
                                                        {item.extractedData ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700">
                                                                Extracted
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-gray-50">
                                                                None
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {item.passwordApplied ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700">
                                                                Applied
                                                            </Badge>
                                                        ) : item.detectedInfo?.password ? (
                                                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                                                                Detected
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-gray-50">
                                                                None
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {item.status === 'failed' && (
                                                            <div className="text-red-500">{item.error}</div>
                                                        )}
                                                        {item.status === 'unmatched' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="bg-green-800 text-white text-xs"
                                                                onClick={() => {
                                                                    setCurrentManualMatchItem(index);
                                                                    setShowBankSelectorDialog(true);
                                                                }}
                                                            >
                                                                Match Manually
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            <div className="mt-4 flex justify-between">
                                <Button variant="outline" onClick={onClose} disabled={uploading} className="text-xs px-3 py-1">
                                    Close
                                </Button>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setActiveTab('vouching')}
                                        disabled={uploadItems.filter(i => i.status === 'matched' || i.status === 'uploaded').length === 0}
                                        className="text-xs px-3 py-1"
                                    >
                                        Go to Vouching
                                    </Button>

                                    <Button
                                        variant="default"
                                        onClick={handleStartProcessing}
                                        disabled={uploadItems.length === 0 || uploading}
                                        className="text-xs px-3 py-1"
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <FileCheck className="h-3 w-3 mr-1" />
                                                Process Remaining Files
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="vouching" className="flex-1 flex flex-col overflow-hidden">
                            <div className="h-full overflow-y-auto p-1">
                                {companyGroups.length === 0 ? (
                                    <div className="flex items-center justify-center h-40 text-muted-foreground">
                                        No statements available for vouching
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {companyGroups.map((group) => (
                                            <Collapsible
                                                key={group.companyId}
                                                open={group.isExpanded}
                                                onOpenChange={() => toggleCompanyExpansion(group.companyId)}
                                                className="border rounded-md shadow-sm"
                                            >
                                                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-t-md">
                                                    <div className="flex items-center gap-2">
                                                        {group.isExpanded ?
                                                            <ChevronDown className="h-4 w-4 text-slate-500" /> :
                                                            <ChevronRight className="h-4 w-4 text-slate-500" />
                                                        }
                                                        <Building className="h-4 w-4 text-blue-600 mr-1" />
                                                        <span className="font-medium">{group.companyName}</span>
                                                        <Badge variant="outline" className="ml-2">
                                                            {group.statements.length} statement{group.statements.length !== 1 ? 's' : ''}
                                                        </Badge>
                                                    </div>
                                                    <div>
                                                        {group.isVouched ? (
                                                            <Badge className="bg-purple-100 text-purple-800">
                                                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                                Vouched
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                                                Pending Vouching
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </CollapsibleTrigger>

                                                <CollapsibleContent className="p-3 space-y-4">
                                                    {group.statements.map((statement, statementIdx) => (
                                                        <div key={statementIdx} className="border rounded-md overflow-hidden">
                                                            <div className="p-2 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <FileText className="h-4 w-4 text-blue-600" />
                                                                    <span className="font-medium">{statement.file.name}</span>
                                                                </div>
                                                                {getStatusBadge(statement.status)}
                                                            </div>

                                                            {/* Statement details for vouching */}
                                                            <div className="space-y-3 py-2 px-3 bg-slate-50 rounded-md border border-slate-200">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-slate-500">Statement Details</Label>
                                                                        <div className="text-sm">
                                                                            <p><span className="font-medium">Bank Name:</span> {statement.matchedBank?.bank_name || 'Not detected'}</p>
                                                                            <p><span className="font-medium">Account Number:</span> {statement.matchedBank?.account_number || 'Not detected'}</p>
                                                                            <p><span className="font-medium">Currency:</span> {statement.matchedBank?.bank_currency || 'Not detected'}</p>
                                                                            <p><span className="font-medium">Period:</span> {statement.extractedData?.statement_period || format(new Date(cycleYear, cycleMonth), 'MMMM yyyy')}</p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-slate-500">Balance Information</Label>
                                                                        <div className="text-sm">
                                                                            <p><span className="font-medium">Opening Balance:</span> {statement.extractedData?.opening_balance ?? 'Not extracted'}</p>
                                                                            <p><span className="font-medium">Closing Balance:</span> {statement.extractedData?.closing_balance ?? 'Not extracted'}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-1">
                                                                    <Label className="text-xs text-slate-500">Vouching Notes</Label>
                                                                    <Input
                                                                        placeholder="Add notes about this statement verification..."
                                                                        value={vouchingNotes[statement.file.name] || ''}
                                                                        onChange={(e) => {
                                                                            setVouchingNotes(prev => ({ ...prev, [statement.file.name]: e.target.value }));

                                                                            // Also update the uploadItems
                                                                            setUploadItems(items => {
                                                                                const updated = [...items];
                                                                                const index = items.findIndex(i => i === statement);
                                                                                if (index >= 0) {
                                                                                    updated[index].vouchNotes = e.target.value;
                                                                                }
                                                                                return updated;
                                                                            });
                                                                        }}
                                                                    />
                                                                </div>

                                                                <div className="flex justify-between items-center pt-2">
                                                                    <div className="flex items-center space-x-2">
                                                                        <Checkbox
                                                                            id={`vouched-${statementIdx}`}
                                                                            checked={vouchingChecked[statement.file.name] || false}
                                                                            onCheckedChange={(checked) => {
                                                                                setVouchingChecked(prev => ({ ...prev, [statement.file.name]: !!checked }));

                                                                                // Also update the uploadItems
                                                                                setUploadItems(items => {
                                                                                    const updated = [...items];
                                                                                    const index = items.findIndex(i => i === statement);
                                                                                    if (index >= 0) {
                                                                                        updated[index].isVouched = !!checked;
                                                                                        updated[index].status = checked ? 'vouched' : 'uploaded';
                                                                                    }
                                                                                    return updated;
                                                                                });
                                                                            }}
                                                                        />
                                                                        <Label htmlFor={`vouched-${statementIdx}`} className="text-sm font-medium">
                                                                            Verified and vouched
                                                                        </Label>
                                                                    </div>

                                                                    <div className="space-x-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                // Logic to view statement
                                                                                toast({
                                                                                    title: "View Statement",
                                                                                    description: `Viewing statement for ${statement.matchedBank?.company_name} / ${statement.matchedBank?.bank_name}`,
                                                                                });
                                                                            }}
                                                                        >
                                                                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                                                                            View
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    <div className="flex justify-end pt-2">
                                                        <Button
                                                            variant={group.isVouched ? "outline" : "default"}
                                                            onClick={() => markCompanyVouched(group.companyId, !group.isVouched)}
                                                            className={group.isVouched ? "" : "bg-purple-600 hover:bg-purple-700"}
                                                        >
                                                            {group.isVouched ? (
                                                                <>Unmark as Vouched</>
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                                    Mark All as Vouched
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex justify-between">
                                <Button
                                    variant="outline"
                                    onClick={() => setActiveTab('review')}
                                >
                                    Back to Review
                                </Button>

                                <Button
                                    variant="default"
                                    onClick={onClose}
                                >
                                    Complete Vouching
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
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
                    cycleId={localCycleId}
                />
            )}

            {/* Bank selector dialog for manual matching */}
            {showBankSelectorDialog && currentManualMatchItem !== null && (
                <Dialog open={showBankSelectorDialog} onOpenChange={setShowBankSelectorDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Select Bank for Statement</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-3">
                            <Label>Select a bank for this statement</Label>
                            <select
                                className="w-full p-2 border rounded-md"
                                value={selectedBankIds[currentManualMatchItem] || 0}
                                onChange={(e) => setSelectedBankIds(prev => ({
                                    ...prev,
                                    [currentManualMatchItem]: parseInt(e.target.value)
                                }))}
                            >
                                <option value={0}>-- Select Bank --</option>
                                {banks.map(bank => (
                                    <option key={bank.id} value={bank.id}>
                                        {bank.company_name} / {bank.bank_name} / {bank.account_number}
                                    </option>
                                ))}
                            </select>

                            <Input
                                type="number"
                                step="0.01"
                                placeholder="Closing Balance (optional)"
                                value={closingBalanceInputs[currentManualMatchItem] || ''}
                                onChange={(e) => setClosingBalanceInputs(prev => ({
                                    ...prev,
                                    [currentManualMatchItem]: e.target.value
                                }))}
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowBankSelectorDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="default"
                                onClick={() => {
                                    // Apply the manual match
                                    const bankId = selectedBankIds[currentManualMatchItem] || 0;
                                    if (bankId > 0) {
                                        const matchedBank = banks.find(b => b.id === bankId);
                                        if (matchedBank) {
                                            setUploadItems(items => {
                                                const updated = [...items];
                                                if (updated[currentManualMatchItem]) {
                                                    updated[currentManualMatchItem] = {
                                                        ...updated[currentManualMatchItem],
                                                        matchedBank,
                                                        status: 'matched',
                                                        closingBalance: closingBalanceInputs[currentManualMatchItem] ?
                                                            parseFloat(closingBalanceInputs[currentManualMatchItem]) : null
                                                    };
                                                }
                                                return updated;
                                            });
                                        }
                                    }
                                    setShowBankSelectorDialog(false);
                                }}
                                disabled={!selectedBankIds[currentManualMatchItem] || selectedBankIds[currentManualMatchItem] === 0}
                            >
                                Apply Match
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

// Format file size utility function
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}