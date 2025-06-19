// @ts-nocheck
import { useState, useRef, useEffect } from 'react'
import {
    Loader2, Upload, AlertTriangle, CheckCircle, UploadCloud,
    FileText, Building, Landmark, CreditCard, DollarSign,
    Calendar, X, ArrowRight, FileCheck, FilePlus, FileWarning,
    ChevronDown, ChevronRight, Save, Eye, Lock
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
import BankExtractionDialog from './BankExtractionDialog';
import { StatementCycleConfirmationDialog } from './StatementCycleConfirmationDialog'
import {
    getPdfDocument,
    performBankStatementExtraction,
    processBulkExtraction,
    detectFileInfoFromFilename,
    detectPasswordFromFilename
} from '@/lib/bankExtractionUtils'
import { detectFileInfo } from '../utils/fileDetectionUtils'
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { ExtractionsService } from '@/lib/services/extractionService';

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
    detectedPassword?: string | null
    detectedAccountNumber?: string | null
    detectedBankName?: string | null
    passwordApplied?: boolean
    appliedPassword?: string | null
    needsPassword?: boolean
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
    statementCycleId: string
    onUploadsComplete: () => void
}

export function BankStatementBulkUploadDialog({
    isOpen,
    onClose,
    banks,
    cycleMonth,
    cycleYear,
    statementCycleId,
    onUploadsComplete
}: BankStatementBulkUploadDialogProps) {

    const safeBanks = Array.isArray(banks) ? banks : [];

    useEffect(() => {
        if (isOpen) {
            console.log('Bulk upload dialog opened with cycle ID:', statementCycleId);
        }
    }, [isOpen, statementCycleId]);

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
    const [extractionResults, setExtractionResults] = useState<any>(null)
    const [validationResults, setValidationResults] = useState<{ isValid: boolean, mismatches: string[] } | null>(null)
    const [showValidationDialog, setShowValidationDialog] = useState<boolean>(false)
    const [showExtractionDialog, setShowExtractionDialog] = useState<boolean>(false)
    const [currentProcessingItem, setCurrentProcessingItem] = useState<BulkUploadItem | null>(null)
    const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1)

    const [localCycleId, setLocalCycleId] = useState<string | null>(statementCycleId);
    const [currentManualMatchItem, setCurrentManualMatchItem] = useState<number | null>(null);
    const [showBankSelectorDialog, setShowBankSelectorDialog] = useState<boolean>(false);
    const [passwordProtectedFiles, setPasswordProtectedFiles] = useState([]);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [batchFiles, setBatchFiles] = useState([]);
    const [processingQueue, setProcessingQueue] = useState<number[]>([]);

    useEffect(() => {
        if (statementCycleId) {
            setLocalCycleId(statementCycleId);
        }
    }, [statementCycleId]);

    const fileInputRef = useRef<HTMLInputElement>(null)
    const { toast } = useToast()

    useEffect(() => {
        if (activeTab === 'vouching') {
            organizeByCompany();
        }
    }, [activeTab, uploadItems]);

    const organizeByCompany = () => {
        const validItems = uploadItems.filter(item =>
            item.status === 'matched' || item.status === 'uploaded' || item.status === 'vouched'
        );

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

        const firstNonVouchedIndex = groupedByCompany.findIndex(g => !g.isVouched);

        if (firstNonVouchedIndex >= 0) {
            groupedByCompany.forEach((group, index) => {
                group.isExpanded = index === firstNonVouchedIndex;
            });
        } else if (groupedByCompany.length > 0) {
            groupedByCompany[0].isExpanded = true;
        }

        setCompanyGroups(groupedByCompany);
    };

    const formatFileName = (file: File): { shortName: string, fullName: string, extension: string } => {
        if (!file) return { shortName: 'Unknown file', fullName: 'Unknown file', extension: '' };

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

    // Enhanced file processing with automatic password detection
    const processFileWithPasswordDetection = async (file: File, index: number): Promise<BulkUploadItem> => {
        const fileInfo = detectFileInfo(file.name);
        console.log(`Processing file ${index}: ${file.name}`, fileInfo);

        // Try to match with a bank
        let matchedBank = null;
        if (fileInfo.accountNumber) {
            matchedBank = safeBanks.find(bank =>
                bank.account_number.includes(fileInfo.accountNumber) ||
                fileInfo.accountNumber.includes(bank.account_number)
            );
        }

        // If no account number match, try bank name
        if (!matchedBank && fileInfo.bankName) {
            matchedBank = safeBanks.find(bank =>
                bank.bank_name.toLowerCase().includes(fileInfo.bankName.toLowerCase()) ||
                fileInfo.bankName.toLowerCase().includes(bank.bank_name.toLowerCase())
            );
        }

        // Check if password protected
        let needsPassword = false;
        let passwordApplied = false;
        let appliedPassword = null;

        if (file.type === 'application/pdf') {
            needsPassword = await isPdfPasswordProtected(file);

            if (needsPassword) {
                console.log(`File ${index} is password protected, attempting auto-unlock`);

                // Try bank password first
                if (matchedBank?.acc_password) {
                    console.log(`Trying bank password for ${matchedBank.bank_name}`);
                    const success = await applyPasswordToFiles(file, matchedBank.acc_password);
                    if (success) {
                        passwordApplied = true;
                        appliedPassword = matchedBank.acc_password;
                        needsPassword = false;
                        console.log(`Bank password worked for file ${index}`);
                    }
                }

                // Try detected password if bank password failed
                if (!passwordApplied && fileInfo.password) {
                    console.log(`Trying detected password: ${fileInfo.password}`);
                    const success = await applyPasswordToFiles(file, fileInfo.password);
                    if (success) {
                        passwordApplied = true;
                        appliedPassword = fileInfo.password;
                        needsPassword = false;
                        console.log(`Detected password worked for file ${index}`);
                    }
                }
            }
        }

        return {
            file,
            detectedPassword: fileInfo.password,
            detectedAccountNumber: fileInfo.accountNumber,
            detectedBankName: fileInfo.bankName,
            matchedBank,
            needsPassword,
            passwordApplied,
            appliedPassword,
            status: 'pending' as const,
            extractedData: null,
            closingBalance: null,
            error: null,
            matchConfidence: 0,
            uploadProgress: 0
        };
    };

    const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        setUploading(true);

        try {
            const newItems: BulkUploadItem[] = [];

            for (let i = 0; i < fileArray.length; i++) {
                const processedItem = await processFileWithPasswordDetection(fileArray[i], uploadItems.length + i);
                newItems.push(processedItem);
            }

            setUploadItems(prev => [...prev, ...newItems]);

            // Show auto-detection results
            const autoDetectedPasswords = newItems.filter(item => item.passwordApplied).length;
            const matchedBanks = newItems.filter(item => item.matchedBank).length;

            if (autoDetectedPasswords > 0 || matchedBanks > 0) {
                toast({
                    title: "Auto-Detection Results",
                    description: `${autoDetectedPasswords} passwords applied automatically, ${matchedBanks} banks matched`,
                });
            }
        } catch (error) {
            console.error('Error processing files:', error);
            toast({
                title: "Error",
                description: "Failed to process some files",
                variant: "destructive"
            });
        } finally {
            setUploading(false);
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

        if (isVouched) {
            const nextNonVouchedGroup = companyGroups.find(g =>
                !g.isVouched && g.companyId !== companyId
            );

            if (nextNonVouchedGroup) {
                toggleCompanyExpansion(nextNonVouchedGroup.companyId);
            }
        }
    };

    // Enhanced file extraction with password handling
    const handleFileExtraction = async (itemIndex: number) => {
        const item = uploadItems[itemIndex];
        if (!item || !item.file) return;

        setUploadItems(prev => {
            const updated = [...prev];
            updated[itemIndex] = {
                ...updated[itemIndex],
                status: 'processing',
                uploadProgress: 20
            };
            return updated;
        });

        try {
            const extractionOptions = {
                month: cycleMonth,
                year: cycleYear,
                password: item.passwordApplied ? item.appliedPassword : null,
                forceAiExtraction: true
            };

            const extractionResult = await ExtractionsService.getExtraction(item.file, extractionOptions);

            console.log('Extraction result:', extractionResult?.success ? 'Success' : 'Failed');

            setExtractionResults(extractionResult);

            if (extractionResult?.success) {
                const validationResult = validateExtractedData(extractionResult.extractedData, item.matchedBank);
                setValidationResults(validationResult);

                setUploadItems(prev => {
                    const updated = [...prev];
                    updated[itemIndex] = {
                        ...updated[itemIndex],
                        status: 'matched',
                        extractedData: extractionResult.extractedData,
                        uploadProgress: 80
                    };
                    return updated;
                });

                // Show validation dialog if there are issues
                if (!validationResult.isValid) {
                    setCurrentProcessingItem(item);
                    setCurrentItemIndex(itemIndex);
                    setShowValidationDialog(true);
                } else {
                    // Proceed with upload if validation passed
                    await handleFileUpload(itemIndex, extractionResult.extractedData);
                }
            } else {
                if (extractionResult.requiresPassword && !item.passwordApplied) {
                    // Add to password protected files
                    setPasswordProtectedFiles(prev => [...prev, {
                        index: itemIndex,
                        fileName: item.file.name,
                        fileObj: item
                    }]);
                    setShowPasswordDialog(true);
                } else {
                    setUploadItems(prev => {
                        const updated = [...prev];
                        updated[itemIndex] = {
                            ...updated[itemIndex],
                            status: 'failed',
                            error: extractionResult.error || 'Extraction failed',
                            uploadProgress: 0
                        };
                        return updated;
                    });
                }
            }
        } catch (error) {
            console.error('Extraction error:', error);
            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = {
                    ...updated[itemIndex],
                    status: 'failed',
                    error: error.message || 'Extraction failed',
                    uploadProgress: 0
                };
                return updated;
            });
        }
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

        let cycleId = localCycleId;
        if (!cycleId) {
            try {
                const monthStr = (cycleMonth + 1).toString().padStart(2, '0');
                const cycleMonthYear = `${cycleYear}-${monthStr}`;

                const { data: existingCycle, error: checkError } = await supabase
                    .from('statement_cycles')
                    .select('id')
                    .eq('month_year', cycleMonthYear)
                    .maybeSingle();

                if (!checkError && existingCycle) {
                    cycleId = existingCycle.id;
                    setLocalCycleId(existingCycle.id);
                } else {
                    const { data: newCycle, error: createError } = await supabase
                        .from('statement_cycles')
                        .insert({
                            month_year: cycleMonthYear,
                            status: 'active',
                            created_at: new Date().toISOString()
                        })
                        .select('id')
                        .single();

                    if (createError) {
                        console.error('Error creating cycle:', createError);
                        toast({
                            title: 'Error',
                            description: 'Failed to create statement cycle',
                            variant: 'destructive'
                        });
                        return;
                    }

                    cycleId = newCycle.id;
                    setLocalCycleId(newCycle.id);
                }
            } catch (error) {
                console.error('Error initializing cycle:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to initialize statement cycle',
                    variant: 'destructive'
                });
                return;
            }
        }

        setUploading(true);
        setActiveTab('processing');
        await processFiles(cycleId);
    };

    const processFiles = async (cycleId: string) => {
        try {
            setTotalMatched(0);
            setTotalUnmatched(0);

            const filesToProcess = uploadItems.filter(item =>
                item.status !== 'uploaded' && item.status !== 'vouched'
            );

            if (filesToProcess.length === 0) {
                toast({
                    title: 'No files to process',
                    description: 'All files have already been processed',
                    variant: 'default'
                });
                return;
            }

            setUploading(true);
            setOverallProgress(10);

            // Process files with enhanced password handling
            const processPromises = filesToProcess.map(async (item, index) => {
                try {
                    await handleFileExtraction(uploadItems.indexOf(item));
                } catch (error) {
                    console.error(`Error processing file ${index}:`, error);
                }
            });

            await Promise.all(processPromises);

            const successfulItems = uploadItems.filter(item => item.status === 'matched');
            setTotalMatched(successfulItems.length);
            setTotalUnmatched(filesToProcess.length - successfulItems.length);

            if (successfulItems.length > 0) {
                setActiveTab('vouching');
            } else {
                setActiveTab('review');
            }

        } catch (error) {
            console.error('Batch processing error:', error);
            toast({
                title: 'Error',
                description: `Failed to process files: ${error.message}`,
                variant: 'destructive'
            });
        } finally {
            setUploading(false);
            setOverallProgress(100);
            onUploadsComplete();
        }
    };

    // Enhanced validation function
    const validateExtractedData = (extracted: any, bank: Bank | null): any => {
        const mismatches: string[] = [];

        if (!bank) {
            mismatches.push('No bank matched for this statement');
            return { isValid: false, mismatches, extractedData: extracted };
        }

        // Validate bank name
        if (extracted.bank_name && !extracted.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())) {
            mismatches.push(`Bank name mismatch: Expected "${bank.bank_name}", found "${extracted.bank_name}"`);
        }

        // Validate account number
        if (extracted.account_number && !extracted.account_number.includes(bank.account_number)) {
            mismatches.push(`Account number mismatch: Expected "${bank.account_number}", found "${extracted.account_number}"`);
        }

        // Validate currency
        if (extracted.currency &&
            normalizeCurrencyCode(extracted.currency) !== normalizeCurrencyCode(bank.bank_currency)) {
            mismatches.push(`Currency mismatch: Expected "${bank.bank_currency}", found "${extracted.currency}"`);
        }

        return {
            isValid: mismatches.length === 0,
            mismatches,
            extractedData: extracted
        };
    };

    const normalizeCurrencyCode = (code: string) => {
        if (!code) return 'USD';
        const upperCode = code.toUpperCase().trim();
        const currencyMap: Record<string, string> = {
            'EURO': 'EUR', 'EUROS': 'EUR', 'US DOLLAR': 'USD', 'US DOLLARS': 'USD', 'USDOLLAR': 'USD',
            'POUND': 'GBP', 'POUNDS': 'GBP', 'STERLING': 'GBP', 'KENYA SHILLING': 'KES',
            'KENYA SHILLINGS': 'KES', 'KENYAN SHILLING': 'KES', 'KSH': 'KES', 'K.SH': 'KES',
            'KSHS': 'KES', 'K.SHS': 'KES', 'SH': 'KES'
        };
        return currencyMap[upperCode] || upperCode;
    };

    // File upload function
    const handleFileUpload = async (index: number, extractedData: any) => {
        const item = uploadItems[index];
        if (!item || !item.matchedBank) return;

        try {
            setUploadItems(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    status: 'processing',
                    uploadProgress: 90
                };
                return updated;
            });

            // Upload file to storage
            const fileName = `bank_statement_${item.matchedBank.company_id}_${item.matchedBank.id}_${cycleYear}_${cycleMonth}.pdf`;
            const filePath = `statement_documents/${cycleYear}/${cycleMonth}/${item.matchedBank.company_id}/${fileName}`;

            const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                .from('Statement-Cycle')
                .upload(filePath, item.file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (pdfUploadError) throw pdfUploadError;

            // Create statement record
            const statementData = {
                bank_id: item.matchedBank.id,
                company_id: item.matchedBank.company_id,
                statement_cycle_id: localCycleId,
                statement_month: cycleMonth,
                statement_year: cycleYear,
                has_soft_copy: item.hasSoftCopy || true,
                has_hard_copy: item.hasHardCopy || false,
                statement_document: {
                    statement_pdf: pdfUploadData.path,
                    statement_excel: null,
                    document_size: item.file.size,
                    password: item.passwordApplied ? item.appliedPassword : null
                },
                statement_extractions: extractedData,
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

            await supabase
                .from('acc_cycle_bank_statements')
                .insert([statementData]);

            setUploadItems(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    status: 'uploaded',
                    uploadProgress: 100
                };
                return updated;
            });

            toast({
                title: 'Success',
                description: `Statement uploaded for ${item.matchedBank.company_name}`
            });

        } catch (error) {
            console.error(`Error uploading file ${index}:`, error);
            setUploadItems(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    status: 'failed',
                    error: error.message || 'Failed to upload statement',
                    uploadProgress: 70
                };
                return updated;
            });
        }
    };

    // Validation handlers
    const handleProceedWithValidation = async () => {
        setShowValidationDialog(false);

        if (currentItemIndex >= 0 && extractionResults?.success) {
            await handleFileUpload(currentItemIndex, extractionResults.extractedData);

            if (extractionResults.extractedData) {
                setShowExtractionDialog(true);
            }
        } else {
            processNextQueueItem();
        }
    };

    const cancelCurrentUpload = () => {
        setShowValidationDialog(false);
        setShowExtractionDialog(false);

        if (currentItemIndex >= 0) {
            setUploadItems(prev => {
                const updated = [...prev];
                if (updated[currentItemIndex]) {
                    updated[currentItemIndex] = {
                        ...updated[currentItemIndex],
                        status: 'failed',
                        error: 'Canceled by user',
                        uploadProgress: 0
                    };
                }
                return updated;
            });
        }

        processNextQueueItem();
    };

    const processNextQueueItem = () => {
        const nextIndex = processingQueue.find(index =>
            uploadItems[index] && uploadItems[index].status === 'pending'
        );

        if (nextIndex !== undefined) {
            handleFileExtraction(nextIndex);
        } else {
            setUploading(false);
            setActiveTab('review');
        }
    };

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

    // State for vouching interface
    const [vouchingNotes, setVouchingNotes] = useState<{ [key: number]: string }>({});
    const [vouchingChecked, setVouchingChecked] = useState<{ [key: number]: boolean }>({});
    const [closingBalanceInputs, setClosingBalanceInputs] = useState<{ [key: number]: string }>({});
    const [selectedBankIds, setSelectedBankIds] = useState<{ [key: number]: number }>({});
    const [softCopyStates, setSoftCopyStates] = useState<{ [key: number]: boolean }>({});
    const [hardCopyStates, setHardCopyStates] = useState<{ [key: number]: boolean }>({});

    useEffect(() => {
        const newVouchingNotes: { [key: number]: string } = {};
        const newVouchingChecked: { [key: number]: boolean } = {};
        const newClosingBalances: { [key: number]: string } = {};
        const newSelectedBanks: { [key: number]: number } = {};
        const newSoftCopyStates: { [key: number]: boolean } = {};
        const newHardCopyStates: { [key: number]: boolean } = {};

        uploadItems.forEach((item, index) => {
            newVouchingNotes[index] = item.vouchNotes || '';
            newVouchingChecked[index] = item.isVouched || false;
            newClosingBalances[index] = item.closingBalance?.toString() || item.extractedData?.closing_balance?.toString() || '';
            newSelectedBanks[index] = item.matchedBank?.id || 0;
            newSoftCopyStates[index] = item.hasSoftCopy || true;
            newHardCopyStates[index] = item.hasHardCopy || false;
        });

        setVouchingNotes(newVouchingNotes);
        setVouchingChecked(newVouchingChecked);
        setClosingBalanceInputs(newClosingBalances);
        setSelectedBankIds(newSelectedBanks);
        setSoftCopyStates(newSoftCopyStates);
        setHardCopyStates(newHardCopyStates);
    }, [uploadItems]);

    const renderVouchingDetails = (item: BulkUploadItem, index: number) => {
        const extractedBalance = item.extractedData?.closing_balance;
        const manualBalance = item.closingBalance;
        const displayBalance = manualBalance !== undefined ? manualBalance : extractedBalance;

        return (
            <div className="space-y-3 py-2 px-3 bg-slate-50 rounded-md border border-slate-200">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Statement Details</Label>
                        <div className="text-sm">
                            <p><span className="font-medium">Bank Name:</span> {item.extractedData?.bank_name || 'Not detected'}</p>
                            <p><span className="font-medium">Account Number:</span> {item.extractedData?.account_number || 'Not detected'}</p>
                            <p><span className="font-medium">Currency:</span> {item.extractedData?.currency || 'Not detected'}</p>
                            <p><span className="font-medium">Period:</span> {item.extractedData?.statement_period || format(new Date(cycleYear, cycleMonth), 'MMMM yyyy')}</p>
                            {item.passwordApplied && (
                                <p><span className="font-medium">Password:</span> <span className="text-green-600">Applied automatically</span></p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Balance Information</Label>
                        <div className="text-sm">
                            <p><span className="font-medium">Opening Balance:</span> {formatCurrency(item.extractedData?.opening_balance, item.extractedData?.currency || 'USD')}</p>
                            <p><span className="font-medium">Closing Balance:</span> {formatCurrency(displayBalance, item.extractedData?.currency || 'USD')}</p>
                            {manualBalance !== undefined && manualBalance !== extractedBalance && (
                                <p className="text-amber-600 text-xs">* Manual override of original extracted value: {formatCurrency(extractedBalance, item.extractedData?.currency || 'USD')}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Vouching Notes</Label>
                    <Input
                        placeholder="Add notes about this statement verification..."
                        value={vouchingNotes[index] || ''}
                        onChange={(e) => {
                            setVouchingNotes(prev => ({ ...prev, [index]: e.target.value }));
                            setUploadItems(items => {
                                const updated = [...items];
                                updated[index].vouchNotes = e.target.value;
                                return updated;
                            });
                        }}
                    />
                </div>

                <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id={`vouched-${index}`}
                            checked={vouchingChecked[index] || false}
                            onCheckedChange={(checked) => {
                                setVouchingChecked(prev => ({ ...prev, [index]: !!checked }));
                                setUploadItems(items => {
                                    const updated = [...items];
                                    updated[index].isVouched = !!checked;
                                    updated[index].status = checked ? 'vouched' : 'uploaded';
                                    return updated;
                                });
                            }}
                        />
                        <Label htmlFor={`vouched-${index}`} className="text-sm font-medium">
                            Verified and vouched
                        </Label>
                    </div>

                    <div className="space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                toast({
                                    title: "Saved",
                                    description: "Statement details saved successfully",
                                });
                            }}
                        >
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                            Save
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                toast({
                                    title: "View Statement",
                                    description: `Viewing statement for ${item.matchedBank?.company_name}`,
                                });
                            }}
                        >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            View
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    function formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    function formatCurrency(amount: number | null, currencyCode: string): string {
        if (amount === null || isNaN(amount)) return '-'

        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currencyCode,
                minimumFractionDigits: 2
            }).format(amount)
        } catch (error) {
            return new Intl.NumberFormat('en-US', {
                style: 'decimal',
                minimumFractionDigits: 2
            }).format(amount)
        }
    }

    function handleDrop(event: React.DragEvent) {
        event.preventDefault();
        const files = event.dataTransfer.files;
        handleFileSelection({ target: { files } } as any);
    }

    function handleDragOver(event: React.DragEvent) {
        event.preventDefault();
    }

    const handleClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

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
                                {format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')} - Enhanced with Auto Password Detection
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
                                <div className="flex items-center gap-4">
                                    <div
                                        className="group relative border-dashed border-2 border-gray-300 p-6 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
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
                                        />
                                        <div className="text-center">
                                            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                                            <p className="text-center text-gray-500 mt-2">Drag and drop files here, or click to select files</p>
                                            <p className="text-xs text-gray-400 mt-1">Auto-detects passwords and matches banks</p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleStartProcessing}
                                        disabled={uploadItems.length === 0 || uploading}
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
                                                    <TableHead>Detection Status</TableHead>
                                                    <TableHead>Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {uploadItems.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                            No files selected. Select PDF bank statements to upload.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    uploadItems.map((item, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                                                            <TableCell className="font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    <span>{item.file.name}</span>
                                                                    {item.passwordApplied && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            <Lock className="h-3 w-3 mr-1" />
                                                                            Protected
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>{formatFileSize(item.file.size)}</TableCell>
                                                            <TableCell>
                                                                <div className="space-y-1">
                                                                    {item.detectedPassword && (
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            Password: {item.detectedPassword}
                                                                        </Badge>
                                                                    )}
                                                                    {item.detectedAccountNumber && (
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            Account: {item.detectedAccountNumber}
                                                                        </Badge>
                                                                    )}
                                                                    {item.matchedBank && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            Bank: {item.matchedBank.bank_name}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TableCell>
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
                                    <AlertTitle>Enhanced Batch Processing</AlertTitle>
                                    <AlertDescription>
                                        Upload multiple bank statements at once. The system will automatically detect passwords from filenames,
                                        apply bank-stored passwords, and match statements with the correct bank accounts.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </TabsContent>

                        <TabsContent value="processing" className="flex-1 flex flex-col space-y-2 py-2 px-2">
                            <div className="space-y-2">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle>Processing Progress</CardTitle>
                                        <CardDescription>
                                            Processing {uploadItems.length} files with auto password detection
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>Overall Progress</span>
                                                <span>{overallProgress}%</span>
                                            </div>
                                            <Progress value={overallProgress} className="h-2" />

                                            <div className="mt-6 flex justify-between">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                    <span>Matched: {totalMatched}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                    <span>Unmatched: {totalUnmatched}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <FileWarning className="h-4 w-4 text-red-500" />
                                                    <span>Failed: {uploadItems.filter(i => i.status === 'failed').length}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Lock className="h-4 w-4 text-blue-500" />
                                                    <span>Auto-unlocked: {uploadItems.filter(i => i.passwordApplied).length}</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-end">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setActiveTab('review')}
                                                    disabled={uploading}
                                                    className='bg-green-500 hover:bg-green-600 text-white hover:text-white'
                                                >
                                                    <ArrowRight className="h-4 w-4 mr-2" />
                                                    Review Results
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="border rounded-md overflow-hidden" style={{ maxHeight: '300px' }}>
                                    <div className="overflow-y-auto" style={{ maxHeight: '250px' }}>
                                        <Table className="w-full table-compact">
                                            <TableHeader className="sticky top-0 bg-background z-10">
                                                <TableRow>
                                                    <TableHead className="w-[40px]">#</TableHead>
                                                    <TableHead className="w-[40%]">File Name</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Progress</TableHead>
                                                    <TableHead>Details</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {uploadItems.map((item, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                                                        <TableCell className="font-medium truncate">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="truncate block w-full text-left">
                                                                        {item.file.name}
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>{item.file.name}</TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </TableCell>
                                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                                        <TableCell>
                                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                                    style={{ width: `${item.uploadProgress || 0}%` }}
                                                                ></div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            {item.passwordApplied && (
                                                                <Badge variant="outline" className="text-xs mr-1">
                                                                    <Lock className="h-3 w-3 mr-1" />
                                                                    Auto-unlocked
                                                                </Badge>
                                                            )}
                                                            {item.matchedBank && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {item.matchedBank.bank_name}
                                                                </Badge>
                                                            )}
                                                            {item.error && (
                                                                <span className="text-red-500 text-xs">{item.error}</span>
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
                                                <TableHead className="text-xs font-semibold">File</TableHead>
                                                <TableHead className="text-xs font-semibold">Company</TableHead>
                                                <TableHead className="text-xs font-semibold">Bank Name</TableHead>
                                                <TableHead className="text-xs font-semibold">Account Number</TableHead>
                                                <TableHead className="text-xs font-semibold">Detection</TableHead>
                                                <TableHead className="text-xs font-semibold">Status</TableHead>
                                                <TableHead className="text-xs font-semibold">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {uploadItems.map((item, index) => (
                                                <TableRow key={index} className={item.status === 'unmatched' ? 'bg-yellow-50' : ''}>
                                                    <TableCell className="text-xs">{index + 1}</TableCell>
                                                    <TableCell className="text-xs truncate max-w-[200px]">{item.file.name}</TableCell>
                                                    <TableCell className="text-xs">{item.matchedBank?.company_name || item.extractedData?.company_name || '-'}</TableCell>
                                                    <TableCell className="text-xs">{item.matchedBank?.bank_name || item.extractedData?.bank_name || '-'}</TableCell>
                                                    <TableCell className="font-mono text-xs">{item.matchedBank?.account_number || item.extractedData?.account_number || '-'}</TableCell>
                                                    <TableCell className="text-xs">
                                                        <div className="space-y-1">
                                                            {item.detectedPassword && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    Password: {item.detectedPassword}
                                                                </Badge>
                                                            )}
                                                            {item.passwordApplied && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                                    Auto-applied
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{getStatusBadge(item.status)}</TableCell>
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
                                                        <Badge variant="secondary" className="ml-1">
                                                            {group.statements.filter(s => s.passwordApplied).length} auto-unlocked
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
                                                                    {statement.passwordApplied && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            <Lock className="h-3 w-3 mr-1" />
                                                                            Auto-unlocked
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {getStatusBadge(statement.status)}
                                                            </div>

                                                            {renderVouchingDetails(statement, uploadItems.findIndex(i => i === statement))}
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
                                    onClick={() => {
                                        toast({
                                            title: 'Vouching Complete',
                                            description: 'All statements have been processed and vouched',
                                        });
                                        onUploadsComplete();
                                        onClose();
                                    }}
                                >
                                    Complete Vouching
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Bank Validation Dialog */}
            {showValidationDialog && currentProcessingItem && validationResults && (
                <BankValidationDialog
                    isOpen={showValidationDialog}
                    onClose={() => setShowValidationDialog(false)}
                    bank={currentProcessingItem.matchedBank}
                    extractedData={extractionResults?.extractedData}
                    mismatches={validationResults.mismatches}
                    onProceed={handleProceedWithValidation}
                    onCancel={cancelCurrentUpload}
                    cycleMonth={cycleMonth}
                    cycleYear={cycleYear}
                    fileUrl={currentProcessingItem.file ? URL.createObjectURL(currentProcessingItem.file) : null}
                />
            )}

            {/* Bank Extraction Dialog */}
            {showExtractionDialog && currentProcessingItem && extractionResults && (
                <BankExtractionDialog
                    isOpen={showExtractionDialog}
                    onClose={() => {
                        setShowExtractionDialog(false);
                        setCurrentProcessingItem(null);
                        setCurrentItemIndex(-1);
                    }}
                    bank={currentProcessingItem.matchedBank}
                    statement={{
                        bank_id: currentProcessingItem.matchedBank.id,
                        statement_month: cycleMonth,
                        statement_year: cycleYear,
                        statement_document: {
                            statement_pdf: currentProcessingItem.uploadedPdfPath || null,
                            statement_excel: null,
                            document_size: currentProcessingItem.file?.size || 0,
                            password: currentProcessingItem.passwordApplied ? currentProcessingItem.appliedPassword : null
                        },
                        statement_extractions: extractionResults.extractedData,
                        validation_status: {
                            is_validated: validationResults?.isValid || false,
                            validation_date: new Date().toISOString(),
                            validated_by: null,
                            mismatches: validationResults?.mismatches || []
                        },
                        has_soft_copy: currentProcessingItem.hasSoftCopy || true,
                        has_hard_copy: currentProcessingItem.hasHardCopy || false,
                        status: {
                            status: 'pending_validation',
                            assigned_to: null,
                            verification_date: null
                        }
                    }}
                    pdfPassword={currentProcessingItem.passwordApplied ? currentProcessingItem.appliedPassword : null}
                />
            )}

            {/* Password dialog for manual password entry */}
            {showPasswordDialog && passwordProtectedFiles.length > 0 && (
                <PasswordInputDialog
                    isOpen={showPasswordDialog}
                    onClose={() => setShowPasswordDialog(false)}
                    files={passwordProtectedFiles}
                    onPasswordSubmit={async (password, fileIndexes) => {
                        // Try password on selected files
                        let successCount = 0;

                        for (const fileIndex of fileIndexes) {
                            const item = uploadItems[fileIndex];
                            if (item && item.file) {
                                const success = await applyPasswordToFiles(item.file, password);
                                if (success) {
                                    setUploadItems(prev => {
                                        const updated = [...prev];
                                        updated[fileIndex] = {
                                            ...updated[fileIndex],
                                            passwordApplied: true,
                                            appliedPassword: password,
                                            needsPassword: false
                                        };
                                        return updated;
                                    });
                                    successCount++;
                                }
                            }
                        }

                        // Remove successfully unlocked files from password list
                        setPasswordProtectedFiles(prev =>
                            prev.filter(file => !fileIndexes.includes(file.index))
                        );

                        if (successCount > 0) {
                            toast({
                                title: "Password Applied",
                                description: `Successfully unlocked ${successCount} file(s)`,
                            });

                            // Continue processing unlocked files
                            for (const fileIndex of fileIndexes) {
                                if (uploadItems[fileIndex]?.passwordApplied) {
                                    await handleFileExtraction(fileIndex);
                                }
                            }
                        }

                        // Close dialog if no more password-protected files
                        if (passwordProtectedFiles.length <= fileIndexes.length) {
                            setShowPasswordDialog(false);
                        }

                        return successCount > 0;
                    }}
                    onSkip={(fileIndexes) => {
                        // Mark files as failed
                        setUploadItems(prev => {
                            return prev.map((item, idx) => {
                                if (fileIndexes.includes(idx)) {
                                    return {
                                        ...item,
                                        status: 'failed',
                                        error: 'Password required but not provided',
                                        uploadProgress: 0
                                    };
                                }
                                return item;
                            });
                        });

                        // Remove from password list
                        setPasswordProtectedFiles(prev =>
                            prev.filter(file => !fileIndexes.includes(file.index))
                        );

                        if (passwordProtectedFiles.length <= fileIndexes.length) {
                            setShowPasswordDialog(false);
                        }
                    }}
                />
            )}

            {/* Bank Selector Dialog for manual matching */}
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
                                {safeBanks.map(bank => (
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
                                    const bankId = selectedBankIds[currentManualMatchItem] || 0;
                                    if (bankId > 0) {
                                        const selectedBank = safeBanks.find(b => b.id === bankId);
                                        if (selectedBank) {
                                            setUploadItems(prev => {
                                                const updated = [...prev];
                                                updated[currentManualMatchItem] = {
                                                    ...updated[currentManualMatchItem],
                                                    matchedBank: selectedBank,
                                                    status: 'matched'
                                                };
                                                return updated;
                                            });

                                            toast({
                                                title: 'Bank Matched',
                                                description: `Statement matched with ${selectedBank.company_name} / ${selectedBank.bank_name}`,
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
    )
}