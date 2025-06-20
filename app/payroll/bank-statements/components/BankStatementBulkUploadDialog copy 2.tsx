// @ts-nocheck
import { useState, useRef, useEffect } from 'react'
import {
    Loader2, Upload, AlertTriangle, CheckCircle, UploadCloud,
    FileText, Building, Landmark, CreditCard, DollarSign,
    Calendar, X, ArrowRight, FileCheck, FilePlus, FileWarning,
    ChevronDown, ChevronRight, Save, Eye, Lock, Edit
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
import {
    getPdfDocument,
    processBulkExtraction,
    detectFileInfo,
    getOrCreateStatementCycle,
    parseStatementPeriod,
    generateMonthRange
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
    statementType?: 'monthly' | 'range'
    userPeriodInput?: string
    extractionAttempts?: number
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

    const [activeTab, setActiveTab] = useState<string>('upload')
    const [uploadItems, setUploadItems] = useState<BulkUploadItem[]>([])
    const [uploading, setUploading] = useState<boolean>(false)
    const [overallProgress, setOverallProgress] = useState<number>(0)
    const [totalMatched, setTotalMatched] = useState<number>(0)
    const [totalUnmatched, setTotalUnmatched] = useState<number>(0)
    const [companyGroups, setCompanyGroups] = useState<CompanyGroup[]>([])

    // Validation/Extraction dialogs
    const [showValidationDialog, setShowValidationDialog] = useState<boolean>(false)
    const [showExtractionDialog, setShowExtractionDialog] = useState<boolean>(false)
    const [currentProcessingItem, setCurrentProcessingItem] = useState<BulkUploadItem | null>(null)
    const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1)
    const [validationResult, setValidationResult] = useState<any>(null)
    const [extractionResults, setExtractionResults] = useState<any>(null)

    // Manual matching and period input
    const [currentManualMatchItem, setCurrentManualMatchItem] = useState<number | null>(null);
    const [showBankSelectorDialog, setShowBankSelectorDialog] = useState<boolean>(false);
    const [showPeriodInputDialog, setShowPeriodInputDialog] = useState<boolean>(false);
    const [selectedItemForPeriod, setSelectedItemForPeriod] = useState<number | null>(null);
    const [manualPeriodInput, setManualPeriodInput] = useState<string>('');

    // Password handling
    const [passwordProtectedFiles, setPasswordProtectedFiles] = useState<any[]>([]);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null)
    const { toast } = useToast()

    // Utility functions
    const isPdfPasswordProtected = async (file: File): Promise<boolean> => {
        try {
            const result = await getPdfDocument(file);
            return result.requiresPassword || false;
        } catch (error) {
            return false;
        }
    };

    const applyPasswordToFiles = async (file: File, password: string): Promise<boolean> => {
        try {
            const result = await getPdfDocument(file, password);
            return result.success;
        } catch (error) {
            return false;
        }
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

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatCurrency = (amount: number | null, currencyCode: string): string => {
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

    const safeDetectFileInfo = (filename: string) => {
        try {
            if (!filename) return { password: null, accountNumber: null, bankName: null };

            if (typeof detectFileInfo === 'function') {
                const result = detectFileInfo(filename);
                return result || { password: null, accountNumber: null, bankName: null };
            }

            return {
                password: null,
                accountNumber: null,
                bankName: null
            };
        } catch (error) {
            console.error('Error in file info detection:', error);
            return { password: null, accountNumber: null, bankName: null };
        }
    };

    const processFileWithPasswordDetection = async (file: File, index: number): Promise<BulkUploadItem> => {
        const fileInfo = safeDetectFileInfo(file.name);

        let matchedBank = null;
        let matchConfidence = 0;

        if (fileInfo?.accountNumber && safeBanks?.length > 0) {
            matchedBank = safeBanks.find(bank => {
                if (!bank?.account_number || !fileInfo.accountNumber) return false;
                return bank.account_number.includes(fileInfo.accountNumber) ||
                    fileInfo.accountNumber.includes(bank.account_number);
            });
            if (matchedBank) matchConfidence = 0.9;
        }

        if (!matchedBank && fileInfo?.bankName && safeBanks?.length > 0) {
            matchedBank = safeBanks.find(bank => {
                if (!bank?.bank_name || !fileInfo.bankName) return false;
                const bankNameLower = bank.bank_name.toLowerCase();
                const fileNameLower = fileInfo.bankName.toLowerCase();
                return bankNameLower.includes(fileNameLower) ||
                    fileNameLower.includes(bankNameLower);
            });
            if (matchedBank) matchConfidence = 0.7;
        }

        let needsPassword = false;
        let passwordApplied = false;
        let appliedPassword = null;

        if (file.type === 'application/pdf') {
            try {
                needsPassword = await isPdfPasswordProtected(file);

                if (needsPassword) {
                    const passwordsToTry = [
                        matchedBank?.acc_password,
                        fileInfo?.password
                    ].filter(Boolean);

                    for (const password of passwordsToTry) {
                        try {
                            if (await applyPasswordToFiles(file, password)) {
                                passwordApplied = true;
                                appliedPassword = password;
                                needsPassword = false;
                                break;
                            }
                        } catch (error) {
                            console.error(`Error applying password "${password}":`, error);
                            continue;
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking PDF password protection:', error);
                needsPassword = false;
            }
        }

        let preliminaryType: 'monthly' | 'range' = 'monthly';
        const fileName = file.name?.toLowerCase() || '';

        if (fileName.includes('quarter') || fileName.includes('q1') || fileName.includes('q2') ||
            fileName.includes('q3') || fileName.includes('q4') || fileName.includes('range') ||
            fileName.includes('multi') || fileName.includes('annual')) {
            preliminaryType = 'range';
        }

        return {
            file,
            detectedPassword: fileInfo?.password || null,
            detectedAccountNumber: fileInfo?.accountNumber || null,
            detectedBankName: fileInfo?.bankName || null,
            matchedBank,
            needsPassword,
            passwordApplied,
            appliedPassword,
            status: 'pending',
            extractedData: null,
            closingBalance: null,
            error: null,
            uploadProgress: 0,
            hasSoftCopy: true,
            hasHardCopy: false,
            statementType: preliminaryType,
            userPeriodInput: '',
            extractionAttempts: 0
        };
    };

    const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        setUploading(true);

        try {
            const processingPromises = fileArray.map((file, i) =>
                processFileWithPasswordDetection(file, uploadItems.length + i)
            );

            const newItems = await Promise.all(processingPromises);
            setUploadItems(prev => [...prev, ...newItems]);

            const autoUnlocked = newItems.filter(item => item.passwordApplied).length;
            const matched = newItems.filter(item => item.matchedBank).length;

            toast({
                title: "Files Processed",
                description: `${newItems.length} files processed. ${autoUnlocked} auto-unlocked, ${matched} auto-matched`,
            });

        } catch (error) {
            console.error('Error processing files:', error);
            toast({
                title: "Processing Error",
                description: "Some files failed to process",
                variant: "destructive"
            });
        } finally {
            setUploading(false);
        }
    };

    // Fixed bulk extraction with proper PDF document handling
    const handleBulkExtraction = async () => {
        const filesToProcess = uploadItems.filter(item =>
            item.status === 'pending' && item.matchedBank
        );

        if (filesToProcess.length === 0) {
            toast({
                title: 'No files to process',
                description: 'No matched files available for extraction',
                variant: 'destructive'
            });
            return;
        }

        setUploading(true);
        setActiveTab('processing');

        try {
            const results = [];
            let processed = 0;

            // Process files individually to avoid the getPage error
            for (const item of filesToProcess) {
                const itemIndex = uploadItems.indexOf(item);
                
                setUploadItems(prev => {
                    const updated = [...prev];
                    updated[itemIndex] = {
                        ...updated[itemIndex],
                        status: 'processing',
                        uploadProgress: 30
                    };
                    return updated;
                });

                try {
                    // Use individual extraction instead of bulk to avoid PDF document issues
                    const extractionOptions = {
                        month: cycleMonth,
                        year: cycleYear,
                        password: item.passwordApplied ? item.appliedPassword : null
                    };

                    const extractionResult = await ExtractionsService.getExtraction(item.file, extractionOptions);
                    
                    if (extractionResult.success && extractionResult.extractedData) {
                        const detectedType = determineStatementType(extractionResult.extractedData);
                        
                        results.push({
                            index: itemIndex,
                            success: true,
                            extractedData: extractionResult.extractedData,
                            statementType: detectedType,
                            originalItem: item
                        });

                        setUploadItems(prev => {
                            const updated = [...prev];
                            updated[itemIndex] = {
                                ...updated[itemIndex],
                                status: 'matched',
                                extractedData: extractionResult.extractedData,
                                statementType: detectedType,
                                uploadProgress: 100
                            };
                            return updated;
                        });
                    } else {
                        // Try with manual period input if extraction failed
                        results.push({
                            index: itemIndex,
                            success: false,
                            error: 'Extraction failed - manual period input may be needed',
                            originalItem: item
                        });

                        setUploadItems(prev => {
                            const updated = [...prev];
                            updated[itemIndex] = {
                                ...updated[itemIndex],
                                status: 'unmatched',
                                error: 'Extraction failed - try manual period input',
                                uploadProgress: 0,
                                extractionAttempts: (updated[itemIndex].extractionAttempts || 0) + 1
                            };
                            return updated;
                        });
                    }
                } catch (error) {
                    console.error(`Error processing file ${itemIndex}:`, error);
                    results.push({
                        index: itemIndex,
                        success: false,
                        error: error.message || 'Unknown error',
                        originalItem: item
                    });

                    setUploadItems(prev => {
                        const updated = [...prev];
                        updated[itemIndex] = {
                            ...updated[itemIndex],
                            status: 'failed',
                            error: error.message || 'Unknown error',
                            uploadProgress: 0
                        };
                        return updated;
                    });
                }

                processed++;
                setOverallProgress(Math.round((processed / filesToProcess.length) * 100));
            }

            const matched = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            setTotalMatched(matched);
            setTotalUnmatched(failed);

            toast({
                title: 'Bulk Extraction Complete',
                description: `${matched} successful, ${failed} failed`,
            });

            if (matched > 0) {
                setActiveTab('vouching');
            } else {
                setActiveTab('review');
            }

        } catch (error) {
            console.error('Bulk extraction error:', error);
            toast({
                title: 'Extraction Error',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setUploading(false);
            setOverallProgress(100);
        }
    };

    // Enhanced statement type determination
    const determineStatementType = (extractedData: any): 'monthly' | 'range' => {
        if (!extractedData) return 'monthly';

        const monthlyBalances = extractedData.monthly_balances || [];
        const statementPeriod = extractedData.statement_period;

        if (monthlyBalances.length > 1) {
            return 'range';
        }

        if (statementPeriod) {
            const periodResult = parseStatementPeriod(statementPeriod);
            if (periodResult) {
                const monthRange = generateMonthRange(
                    periodResult.startMonth,
                    periodResult.startYear,
                    periodResult.endMonth,
                    periodResult.endYear
                );
                if (monthRange.length > 1) {
                    return 'range';
                }
            }
        }

        return 'monthly';
    };

    // Handle manual period input
    const handleManualPeriodInput = async (itemIndex: number, periodInput: string) => {
        const item = uploadItems[itemIndex];
        if (!item) return;

        try {
            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = {
                    ...updated[itemIndex],
                    status: 'processing',
                    uploadProgress: 30,
                    userPeriodInput: periodInput
                };
                return updated;
            });

            // Parse the manual period input
            const periodResult = parseStatementPeriod(periodInput);
            if (!periodResult) {
                throw new Error('Invalid period format. Use DD/MM/YYYY - DD/MM/YYYY');
            }

            // Create mock extracted data with the manual period
            const mockExtractedData = {
                bank_name: item.matchedBank?.bank_name || 'Unknown Bank',
                company_name: item.matchedBank?.company_name || 'Unknown Company',
                account_number: item.matchedBank?.account_number || 'Unknown Account',
                currency: item.matchedBank?.bank_currency || 'USD',
                statement_period: periodInput,
                monthly_balances: generateMonthRange(
                    periodResult.startMonth,
                    periodResult.startYear,
                    periodResult.endMonth,
                    periodResult.endYear
                ).map(({ month, year }) => ({
                    month,
                    year,
                    opening_balance: null,
                    closing_balance: null,
                    statement_page: 1
                }))
            };

            const detectedType = determineStatementType(mockExtractedData);

            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = {
                    ...updated[itemIndex],
                    status: 'matched',
                    extractedData: mockExtractedData,
                    statementType: detectedType,
                    uploadProgress: 100
                };
                return updated;
            });

            toast({
                title: 'Manual Period Set',
                description: `Period ${periodInput} applied to statement`,
            });

        } catch (error) {
            console.error('Error setting manual period:', error);
            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = {
                    ...updated[itemIndex],
                    status: 'failed',
                    error: error.message,
                    uploadProgress: 0
                };
                return updated;
            });

            toast({
                title: 'Period Input Error',
                description: error.message,
                variant: 'destructive'
            });
        }
    };

    // Enhanced upload handling with range statement support
    const handleBulkUpload = async () => {
        const itemsToUpload = uploadItems.filter(item =>
            item.status === 'matched' && item.matchedBank && item.extractedData
        );

        if (itemsToUpload.length === 0) {
            toast({
                title: 'No items to upload',
                description: 'No validated statements ready for upload',
                variant: 'destructive'
            });
            return;
        }

        setUploading(true);

        try {
            let uploadedCount = 0;
            const BATCH_SIZE = 3; // Smaller batches for better error handling

            for (let i = 0; i < itemsToUpload.length; i += BATCH_SIZE) {
                const batch = itemsToUpload.slice(i, i + BATCH_SIZE);

                const uploadPromises = batch.map(async (item, batchIndex) => {
                    const itemIndex = uploadItems.indexOf(item);
                    
                    try {
                        // Create statement cycles for the period
                        const statementType = item.statementType || 'monthly';
                        const extractedData = item.extractedData;

                        // Handle range statements by creating multiple statement records
                        if (statementType === 'range' && extractedData.monthly_balances?.length > 1) {
                            return await handleRangeStatementUpload(item, itemIndex);
                        } else {
                            return await handleSingleStatementUpload(item, itemIndex);
                        }

                    } catch (error) {
                        console.error(`Error uploading item ${itemIndex}:`, error);
                        setUploadItems(prev => {
                            const updated = [...prev];
                            updated[itemIndex] = {
                                ...updated[itemIndex],
                                status: 'failed',
                                error: error.message,
                                uploadProgress: 0
                            };
                            return updated;
                        });
                        return false;
                    }
                });

                const batchResults = await Promise.all(uploadPromises);
                uploadedCount += batchResults.filter(Boolean).length;

                setOverallProgress(Math.round((uploadedCount / itemsToUpload.length) * 100));
            }

            toast({
                title: 'Bulk Upload Complete',
                description: `${uploadedCount} statements uploaded successfully`,
            });

            organizeByCompany();
            setActiveTab('vouching');

        } catch (error) {
            console.error('Bulk upload error:', error);
            toast({
                title: 'Upload Error',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setUploading(false);
            onUploadsComplete();
        }
    };

    // Handle range statement upload (creates multiple DB records)
    const handleRangeStatementUpload = async (item: BulkUploadItem, itemIndex: number) => {
        const fileName = `range_${item.matchedBank.company_id}_${item.matchedBank.id}_${cycleYear}_${Date.now()}.pdf`;
        const filePath = `statement_documents/${cycleYear}/${cycleMonth + 1}/${item.matchedBank.company_id}/${fileName}`;

        // Upload file once
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('Statement-Cycle')
            .upload(filePath, item.file, { upsert: true });

        if (uploadError) throw uploadError;

        // Create statement records for each month in the range
        const monthlyBalances = item.extractedData.monthly_balances || [];
        const insertPromises = monthlyBalances.map(async (monthData) => {
            const cycleId = await getOrCreateStatementCycle(monthData.year, monthData.month - 1, 'range');

            // Check for existing statement (upsert logic)
            const { data: existingStatement } = await supabase
                .from('acc_cycle_bank_statements')
                .select('id, statement_extractions')
                .eq('bank_id', item.matchedBank.id)
                .eq('statement_month', monthData.month - 1)
                .eq('statement_year', monthData.year)
                .maybeSingle();

            const statementData = {
                bank_id: item.matchedBank.id,
                company_id: item.matchedBank.company_id,
                statement_cycle_id: cycleId,
                statement_month: monthData.month - 1,
                statement_year: monthData.year,
                statement_type: 'range',
                has_soft_copy: true,
                has_hard_copy: false,
                statement_document: {
                    statement_pdf: uploadData.path,
                    document_size: item.file.size,
                    password: item.passwordApplied ? item.appliedPassword : null
                },
                statement_extractions: {
                    ...item.extractedData,
                    monthly_balances: [monthData] // Only this month's data
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

            if (existingStatement) {
                // Merge monthly balances for conflicting range statements
                const existingBalances = existingStatement.statement_extractions?.monthly_balances || [];
                const mergedBalances = [...existingBalances];
                
                const existingIndex = mergedBalances.findIndex(
                    b => b.month === monthData.month && b.year === monthData.year
                );
                
                if (existingIndex >= 0) {
                    mergedBalances[existingIndex] = monthData; // Replace with new data
                } else {
                    mergedBalances.push(monthData); // Add new month
                }

                await supabase
                    .from('acc_cycle_bank_statements')
                    .update({
                        statement_extractions: {
                            ...statementData.statement_extractions,
                            monthly_balances: mergedBalances
                        },
                        statement_document: statementData.statement_document
                    })
                    .eq('id', existingStatement.id);
            } else {
                await supabase
                    .from('acc_cycle_bank_statements')
                    .insert([statementData]);
            }
        });

        await Promise.all(insertPromises);

        setUploadItems(prev => {
            const updated = [...prev];
            updated[itemIndex] = {
                ...updated[itemIndex],
                status: 'uploaded',
                uploadProgress: 100
            };
            return updated;
        });

        return true;
    };

    // Handle single statement upload
    const handleSingleStatementUpload = async (item: BulkUploadItem, itemIndex: number) => {
        const fileName = `single_${item.matchedBank.company_id}_${item.matchedBank.id}_${cycleYear}_${cycleMonth}_${Date.now()}.pdf`;
        const filePath = `statement_documents/${cycleYear}/${cycleMonth + 1}/${item.matchedBank.company_id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('Statement-Cycle')
            .upload(filePath, item.file, { upsert: true });

        if (uploadError) throw uploadError;

        const cycleId = await getOrCreateStatementCycle(cycleYear, cycleMonth, 'monthly');

        const statementData = {
            bank_id: item.matchedBank.id,
            company_id: item.matchedBank.company_id,
            statement_cycle_id: cycleId,
            statement_month: cycleMonth,
            statement_year: cycleYear,
            statement_type: 'monthly',
            has_soft_copy: true,
            has_hard_copy: false,
            statement_document: {
                statement_pdf: uploadData.path,
                document_size: item.file.size,
                password: item.passwordApplied ? item.appliedPassword : null
            },
            statement_extractions: item.extractedData,
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

        const { error: insertError } = await supabase
            .from('acc_cycle_bank_statements')
            .insert([statementData]);

        if (insertError) throw insertError;

        setUploadItems(prev => {
            const updated = [...prev];
            updated[itemIndex] = {
                ...updated[itemIndex],
                status: 'uploaded',
                uploadProgress: 100
            };
            return updated;
        });

        return true;
    };

    // Company organization for vouching
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
            groupedByCompany[firstNonVouchedIndex].isExpanded = true;
        }

        setCompanyGroups(groupedByCompany);
    };

    // Event handlers
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
    };

    // Show extraction dialog for individual statements
    const showStatementExtraction = (item: BulkUploadItem) => {
        setCurrentProcessingItem(item);
        setExtractionResults({
            success: true,
            extractedData: item.extractedData
        });
        setShowExtractionDialog(true);
    };

    // Auto-organize by company when moving to vouching tab
    useEffect(() => {
        if (activeTab === 'vouching') {
            organizeByCompany();
        }
    }, [activeTab, uploadItems]);

    return (
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
                            {format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')} - Enhanced Processing
                        </p>
                    </div>
                </DialogHeader>

                <Tabs defaultValue="upload" value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="upload" disabled={uploading}>Upload Files</TabsTrigger>
                        <TabsTrigger value="processing">Processing</TabsTrigger>
                        <TabsTrigger value="review">Review & Match</TabsTrigger>
                        <TabsTrigger value="vouching">Vouching</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="flex-1 flex flex-col space-y-4 py-4 px-1">
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div
                                    className="group relative border-dashed border-2 border-gray-300 p-6 rounded-md hover:bg-gray-50 transition-colors cursor-pointer flex-1"
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const files = e.dataTransfer.files;
                                        handleFileSelection({ target: { files } } as any);
                                    }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf"
                                        multiple
                                        onChange={handleFileSelection}
                                        className="opacity-0 absolute inset-0"
                                    />
                                    <div className="text-center">
                                        <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                                        <p className="text-gray-500 mt-2">Drag and drop PDFs here, or click to select</p>
                                        <p className="text-xs text-gray-400 mt-1">Auto-detection and enhanced processing enabled</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Button
                                        onClick={handleBulkExtraction}
                                        disabled={uploadItems.length === 0 || uploading}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <FileCheck className="h-4 w-4 mr-2" />
                                        Extract All ({uploadItems.filter(i => i.matchedBank).length})
                                    </Button>
                                    <Button
                                        onClick={handleBulkUpload}
                                        disabled={uploadItems.filter(i => i.status === 'matched').length === 0 || uploading}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Upload All ({uploadItems.filter(i => i.status === 'matched').length})
                                    </Button>
                                </div>
                            </div>

                            {/* File list table */}
                            <div className="border rounded-md overflow-hidden max-h-[400px]">
                                <div className="overflow-y-auto max-h-[350px]">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background z-10">
                                            <TableRow>
                                                <TableHead>#</TableHead>
                                                <TableHead>File Name</TableHead>
                                                <TableHead>Size</TableHead>
                                                <TableHead>Detection Status</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {uploadItems.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                        No files selected. Drop PDF files here for instant processing.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                uploadItems.map((item, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <span className="truncate max-w-[200px]">{item.file.name}</span>
                                                                {item.passwordApplied && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        <Lock className="h-3 w-3 mr-1" />
                                                                        Unlocked
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-sm">{formatFileSize(item.file.size)}</TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1">
                                                                {item.matchedBank && (
                                                                    <Badge variant="outline" className="text-xs bg-green-50">
                                                                        {item.matchedBank.company_name}
                                                                    </Badge>
                                                                )}
                                                                {item.detectedAccountNumber && (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        {item.detectedAccountNumber}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="text-xs">
                                                                {item.statementType || 'Auto-detect'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="bg-red-50 hover:bg-red-100 text-red-600 h-6 w-6"
                                                                onClick={() => removeItem(index)}
                                                            >
                                                                <X className="h-3 w-3" />
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
                                <AlertTitle>Enhanced Bulk Processing</AlertTitle>
                                <AlertDescription>
                                    Individual file processing, auto-password detection, smart bank matching, and enhanced range statement support.
                                    Manual period input available for failed extractions.
                                </AlertDescription>
                            </Alert>
                        </div>
                    </TabsContent>

                    <TabsContent value="processing" className="flex-1 flex flex-col space-y-2 py-2 px-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center justify-between">
                                    Processing Progress
                                    <Badge variant="outline">
                                        {uploading ? 'Processing...' : 'Complete'}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>
                                    Enhanced processing {uploadItems.length} files with individual extraction
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span>Overall Progress</span>
                                        <span>{overallProgress}%</span>
                                    </div>
                                    <Progress value={overallProgress} className="h-3" />

                                    <div className="grid grid-cols-4 gap-4 text-center">
                                        <div className="p-3 bg-green-50 rounded-lg">
                                            <div className="text-2xl font-bold text-green-600">
                                                {uploadItems.filter(i => i.status === 'matched' || i.status === 'uploaded').length}
                                            </div>
                                            <div className="text-xs text-green-600">Successful</div>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-lg">
                                            <div className="text-2xl font-bold text-blue-600">
                                                {uploadItems.filter(i => i.passwordApplied).length}
                                            </div>
                                            <div className="text-xs text-blue-600">Auto-unlocked</div>
                                        </div>
                                        <div className="p-3 bg-yellow-50 rounded-lg">
                                            <div className="text-2xl font-bold text-yellow-600">
                                                {uploadItems.filter(i => i.status === 'unmatched').length}
                                            </div>
                                            <div className="text-xs text-yellow-600">Needs Manual Input</div>
                                        </div>
                                        <div className="p-3 bg-red-50 rounded-lg">
                                            <div className="text-2xl font-bold text-red-600">
                                                {uploadItems.filter(i => i.status === 'failed').length}
                                            </div>
                                            <div className="text-xs text-red-600">Failed</div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between">
                                        <Button
                                            variant="outline"
                                            onClick={() => setActiveTab('review')}
                                            disabled={uploading}
                                        >
                                            Review Results
                                        </Button>
                                        <Button
                                            onClick={() => setActiveTab('vouching')}
                                            disabled={uploadItems.filter(i => i.status === 'matched' || i.status === 'uploaded').length === 0}
                                            className="bg-purple-600 hover:bg-purple-700"
                                        >
                                            <ArrowRight className="h-4 w-4 mr-2" />
                                            Start Vouching
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Processing status table */}
                        <div className="border rounded-md overflow-hidden flex-1">
                            <div className="overflow-y-auto max-h-[300px]">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead className="w-[40px]">#</TableHead>
                                            <TableHead>File</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Progress</TableHead>
                                            <TableHead>Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {uploadItems.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                                                <TableCell className="font-medium truncate max-w-[200px]">
                                                    {item.file.name}
                                                </TableCell>
                                                <TableCell>{getStatusBadge(item.status)}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">
                                                        {item.statementType || 'Unknown'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                            style={{ width: `${item.uploadProgress || 0}%` }}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.passwordApplied && (
                                                            <Badge variant="outline" className="text-xs">
                                                                <Lock className="h-3 w-3 mr-1" />
                                                                Unlocked
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
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="review" className="flex-1 flex flex-col overflow-hidden">
                        <div className="border rounded-md overflow-hidden flex-1">
                            <div className="max-h-[calc(90vh-420px)] overflow-y-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10 shadow">
                                        <TableRow>
                                            <TableHead className="text-xs">#</TableHead>
                                            <TableHead className="text-xs">File</TableHead>
                                            <TableHead className="text-xs">Company</TableHead>
                                            <TableHead className="text-xs">Bank</TableHead>
                                            <TableHead className="text-xs">Type</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {uploadItems.map((item, index) => (
                                            <TableRow key={index} className={item.status === 'unmatched' ? 'bg-yellow-50' : ''}>
                                                <TableCell className="text-xs">{index + 1}</TableCell>
                                                <TableCell className="text-xs truncate max-w-[150px]">
                                                    {item.file.name}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {item.matchedBank?.company_name || '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {item.matchedBank?.bank_name || '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <Badge variant="outline" className="text-xs">
                                                        {item.statementType || 'Auto'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs">{getStatusBadge(item.status)}</TableCell>
                                                <TableCell className="text-xs">
                                                    <div className="flex gap-1 flex-wrap">
                                                        {item.status === 'failed' && (
                                                            <div className="text-red-500 text-xs">{item.error}</div>
                                                        )}
                                                        {item.status === 'unmatched' && (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="bg-green-50 text-green-700 text-xs h-6"
                                                                    onClick={() => {
                                                                        setCurrentManualMatchItem(index);
                                                                        setShowBankSelectorDialog(true);
                                                                    }}
                                                                >
                                                                    Match Bank
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="bg-blue-50 text-blue-700 text-xs h-6"
                                                                    onClick={() => {
                                                                        setSelectedItemForPeriod(index);
                                                                        setManualPeriodInput('');
                                                                        setShowPeriodInputDialog(true);
                                                                    }}
                                                                >
                                                                    Set Period
                                                                </Button>
                                                            </>
                                                        )}
                                                        {item.status === 'matched' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="bg-blue-50 text-blue-700 text-xs h-6"
                                                                onClick={() => showStatementExtraction(item)}
                                                            >
                                                                <Eye className="h-3 w-3 mr-1" />
                                                                View
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-between">
                            <Button variant="outline" onClick={onClose} disabled={uploading}>
                                Close
                            </Button>
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleBulkExtraction}
                                    disabled={uploadItems.filter(i => i.matchedBank && i.status === 'pending').length === 0 || uploading}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <FileCheck className="h-4 w-4 mr-2" />
                                    Re-extract Failed
                                </Button>
                                <Button
                                    onClick={handleBulkUpload}
                                    disabled={uploadItems.filter(i => i.status === 'matched').length === 0 || uploading}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4 mr-2" />
                                            Upload All Matched
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
                                    <div className="text-center">
                                        <FileWarning className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>No statements ready for vouching</p>
                                        <p className="text-sm mt-1">Complete extraction and upload first</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Vouching Table Format */}
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50">
                                                    <TableHead className="w-[50px]">
                                                        <Checkbox
                                                            checked={companyGroups.every(g => g.isVouched)}
                                                            onCheckedChange={(checked) => {
                                                                companyGroups.forEach(group => {
                                                                    markCompanyVouched(group.companyId, !!checked);
                                                                });
                                                            }}
                                                        />
                                                    </TableHead>
                                                    <TableHead>Company</TableHead>
                                                    <TableHead>Bank</TableHead>
                                                    <TableHead>File Name</TableHead>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Period</TableHead>
                                                    <TableHead>Currency</TableHead>
                                                    <TableHead>Closing Balance</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {companyGroups.flatMap(group =>
                                                    group.statements.map((statement, idx) => (
                                                        <TableRow key={`${group.companyId}-${idx}`} className={statement.isVouched ? 'bg-purple-50' : ''}>
                                                            <TableCell>
                                                                <Checkbox
                                                                    checked={statement.isVouched || false}
                                                                    onCheckedChange={(checked) => {
                                                                        const itemIndex = uploadItems.indexOf(statement);
                                                                        setUploadItems(items => {
                                                                            const updated = [...items];
                                                                            updated[itemIndex] = {
                                                                                ...updated[itemIndex],
                                                                                isVouched: !!checked,
                                                                                status: checked ? 'vouched' : 'uploaded'
                                                                            };
                                                                            return updated;
                                                                        });
                                                                    }}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    <Building className="h-4 w-4 text-blue-600" />
                                                                    {group.companyName}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>{statement.extractedData?.bank_name || statement.matchedBank?.bank_name}</TableCell>
                                                            <TableCell className="max-w-[200px] truncate">
                                                                <div className="flex items-center gap-2">
                                                                    <FileText className="h-4 w-4 text-blue-600" />
                                                                    {statement.file.name}
                                                                    {statement.passwordApplied && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            <Lock className="h-3 w-3 mr-1" />
                                                                            Auto-unlocked
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="text-xs">
                                                                    {statement.statementType || 'monthly'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-sm">
                                                                {statement.extractedData?.statement_period || statement.userPeriodInput || 'Current month'}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {statement.extractedData?.currency || statement.matchedBank?.bank_currency || 'USD'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-sm font-medium">
                                                                {formatCurrency(
                                                                    statement.extractedData?.closing_balance,
                                                                    statement.extractedData?.currency || statement.matchedBank?.bank_currency || 'USD'
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {statement.isVouched ? (
                                                                    <Badge className="bg-purple-100 text-purple-800">
                                                                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                                        Vouched
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                                                        Pending
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => showStatementExtraction(statement)}
                                                                        className="h-8 px-2"
                                                                    >
                                                                        <Eye className="h-3.5 w-3.5 mr-1" />
                                                                        View
                                                                    </Button>
                                                                    {statement.userPeriodInput && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                setSelectedItemForPeriod(uploadItems.indexOf(statement));
                                                                                setManualPeriodInput(statement.userPeriodInput);
                                                                                setShowPeriodInputDialog(true);
                                                                            }}
                                                                            className="h-8 px-2"
                                                                        >
                                                                            <Edit className="h-3.5 w-3.5 mr-1" />
                                                                            Edit Period
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Company Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {companyGroups.map((group) => (
                                            <Card key={group.companyId} className={`${group.isVouched ? 'border-purple-200 bg-purple-50' : 'border-amber-200 bg-amber-50'}`}>
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm flex items-center justify-between">
                                                        <span className="flex items-center gap-2">
                                                            <Building className="h-4 w-4 text-blue-600" />
                                                            {group.companyName}
                                                        </span>
                                                        {group.isVouched ? (
                                                            <Badge className="bg-purple-100 text-purple-800">
                                                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                                Vouched
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                                                Pending
                                                            </Badge>
                                                        )}
                                                    </CardTitle>
                                                    <CardDescription className="text-xs">
                                                        {group.statements.length} statements • {group.statements.filter(s => s.statementType === 'range').length} range statements
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent className="pt-0">
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-xs">
                                                            <span>Auto-unlocked:</span>
                                                            <span>{group.statements.filter(s => s.passwordApplied).length}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span>Vouched:</span>
                                                            <span>{group.statements.filter(s => s.isVouched).length}/{group.statements.length}</span>
                                                        </div>
                                                        <Button
                                                            variant={group.isVouched ? "outline" : "default"}
                                                            size="sm"
                                                            onClick={() => markCompanyVouched(group.companyId, !group.isVouched)}
                                                            className={`w-full ${group.isVouched ? "" : "bg-purple-600 hover:bg-purple-700"}`}
                                                        >
                                                            {group.isVouched ? (
                                                                <>
                                                                    <X className="h-4 w-4 mr-2" />
                                                                    Unmark
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                                    Vouch All
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
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

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const vouchedCount = companyGroups.filter(g => g.isVouched).length;
                                        const totalStatements = companyGroups.reduce((sum, g) => sum + g.statements.length, 0);
                                        const vouchedStatements = companyGroups.reduce((sum, g) => sum + g.statements.filter(s => s.isVouched).length, 0);

                                        toast({
                                            title: 'Vouching Summary',
                                            description: `${vouchedCount}/${companyGroups.length} companies vouched • ${vouchedStatements}/${totalStatements} statements vouched`,
                                        });
                                    }}
                                >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Summary
                                </Button>

                                <Button
                                    variant="default"
                                    onClick={() => {
                                        const vouchedCount = companyGroups.filter(g => g.isVouched).length;
                                        toast({
                                            title: 'Vouching Complete',
                                            description: `${vouchedCount} companies vouched successfully`,
                                        });
                                        onUploadsComplete();
                                        onClose();
                                    }}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Complete Vouching
                                </Button>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>

            {/* Manual Bank Selector Dialog */}
            {showBankSelectorDialog && currentManualMatchItem !== null && (
                <Dialog open={showBankSelectorDialog} onOpenChange={setShowBankSelectorDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Manual Bank Matching</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-3">
                            <Label>Select the correct bank for this statement:</Label>
                            <select
                                className="w-full p-2 border rounded-md"
                                onChange={(e) => {
                                    const bankId = parseInt(e.target.value);
                                    if (bankId > 0) {
                                        const selectedBank = safeBanks.find(b => b.id === bankId);
                                        if (selectedBank) {
                                            setUploadItems(prev => {
                                                const updated = [...prev];
                                                updated[currentManualMatchItem] = {
                                                    ...updated[currentManualMatchItem],
                                                    matchedBank: selectedBank,
                                                    status: 'pending'
                                                };
                                                return updated;
                                            });

                                            toast({
                                                title: 'Bank Matched',
                                                description: `Statement matched with ${selectedBank.company_name}`,
                                            });
                                            setShowBankSelectorDialog(false);
                                        }
                                    }
                                }}
                            >
                                <option value={0}>-- Select Bank --</option>
                                {safeBanks.map(bank => (
                                    <option key={bank.id} value={bank.id}>
                                        {bank.company_name} - {bank.bank_name} ({bank.account_number})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowBankSelectorDialog(false)}
                            >
                                Cancel
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Manual Period Input Dialog */}
            {showPeriodInputDialog && selectedItemForPeriod !== null && (
                <Dialog open={showPeriodInputDialog} onOpenChange={setShowPeriodInputDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Manual Period Input</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-3">
                            <div>
                                <Label>Statement Period (DD/MM/YYYY - DD/MM/YYYY):</Label>
                                <Input
                                    value={manualPeriodInput}
                                    onChange={(e) => setManualPeriodInput(e.target.value)}
                                    placeholder="01/01/2024 - 31/01/2024"
                                    className="mt-2"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Examples: "01/01/2024 - 31/01/2024" for monthly, "01/01/2024 - 31/03/2024" for quarterly
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowPeriodInputDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={async () => {
                                    if (manualPeriodInput.trim()) {
                                        await handleManualPeriodInput(selectedItemForPeriod, manualPeriodInput.trim());
                                        setShowPeriodInputDialog(false);
                                    }
                                }}
                                disabled={!manualPeriodInput.trim()}
                            >
                                Apply Period
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Extraction Dialog */}
            {showExtractionDialog && currentProcessingItem && extractionResults && (
                <BankExtractionDialog
                    isOpen={showExtractionDialog}
                    onClose={() => setShowExtractionDialog(false)}
                    extractionResults={extractionResults}
                    statementFile={{
                        name: currentProcessingItem.file.name,
                        size: currentProcessingItem.file.size,
                        type: currentProcessingItem.file.type
                    }}
                    cycleMonth={cycleMonth}
                    cycleYear={cycleYear}
                    onExtractionComplete={(results) => {
                        console.log('Extraction completed in bulk dialog:', results);
                        setShowExtractionDialog(false);
                    }}
                />
            )}
        </Dialog>
    )
}