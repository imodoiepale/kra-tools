// app/payroll/bank-statements/components/BankStatementBulkUploadDialog.tsx
// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from 'react'
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
    isFallbackMatch?: boolean
    matchConfidence?: number
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

// Database connection management
const withRetry = async (operation: () => Promise<any>, maxRetries: number = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            console.log(`Database operation attempt ${attempt} failed:`, error);

            if (attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
};

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
    const [showExtractionDialog, setShowExtractionDialog] = useState<boolean>(false)
    const [currentProcessingItem, setCurrentProcessingItem] = useState<BulkUploadItem | null>(null)
    const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1)

    // FIX: Add state to hold a temporary statement object for the dialog
    const [currentStatementForDialog, setCurrentStatementForDialog] = useState<any>(null);

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

    const formatCurrency = (amount: number | null | undefined, currencyCode: string): string => {
        if (amount === null || amount === undefined || isNaN(amount)) return '-'
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

    function extractActualPeriod(extractedData: any) {
        if (extractedData?.statement_period) {
            const periodResult = parseStatementPeriod(extractedData.statement_period);
            if (periodResult) {
                return {
                    month: periodResult.endMonth - 1, // 0-based
                    year: periodResult.endYear
                };
            }
        }

        // Fallback to monthly_balances
        if (extractedData?.monthly_balances?.length > 0) {
            const lastBalance = extractedData.monthly_balances[extractedData.monthly_balances.length - 1];
            return {
                month: lastBalance.month - 1, // Convert to 0-based
                year: lastBalance.year
            };
        }

        // Final fallback to dialog values
        return {
            month: cycleMonth,
            year: cycleYear
        };

    }
    // Enhanced handleBalanceUpdate function
    const handleBalanceUpdate = (itemToUpdate: BulkUploadItem, field: string, value: number | null) => {
        setUploadItems(prevItems => {
            const itemIndex = prevItems.findIndex(item => item.file.name === itemToUpdate.file.name);
            if (itemIndex === -1) return prevItems;

            const updatedItems = [...prevItems];
            const updatedItem = { ...updatedItems[itemIndex] };

            if (!updatedItem.extractedData) {
                updatedItem.extractedData = {};
            }

            // Update the main field
            updatedItem.extractedData[field] = value;

            // FIX: Handle both closing_balance and quickbooks_balance
            if (field === 'closing_balance' && Array.isArray(updatedItem.extractedData.monthly_balances)) {
                const actualPeriod = extractActualPeriod(updatedItem.extractedData);
                const balanceIndex = updatedItem.extractedData.monthly_balances.findIndex(
                    balance => balance.month === (actualPeriod.month + 1) && balance.year === actualPeriod.year
                );

                if (balanceIndex !== -1) {
                    updatedItem.extractedData.monthly_balances[balanceIndex] = {
                        ...updatedItem.extractedData.monthly_balances[balanceIndex],
                        closing_balance: value
                    };
                }
            }

            // FIX: Add QuickBooks balance handling
            if (field === 'quickbooks_balance') {
                updatedItem.extractedData.quickbooks_balance = value;
            }

            updatedItems[itemIndex] = updatedItem;
            return updatedItems;
        });

        // Trigger immediate UI refresh
        window.dispatchEvent(new CustomEvent('balanceUpdated', {
            detail: { fileName: itemToUpdate.file.name, field, value }
        }));
    };


    // NEW: Placeholder for editing period, can be expanded later
    const handleEditPeriod = (item: BulkUploadItem) => {
        const itemIndex = uploadItems.findIndex(i => i.file.name === item.file.name);
        if (itemIndex > -1) {
            setSelectedItemForPeriod(itemIndex);
            setManualPeriodInput(item.extractedData?.statement_period || '');
            setShowPeriodInputDialog(true);
        }
    };

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

    const enhanceFallbackBankWithExtractionData = (item: BulkUploadItem, extractedData: any) => {
        if (!item.isFallbackMatch || !extractedData) return item;

        // Enhance the fallback bank with extracted data
        const enhancedBank = {
            ...item.matchedBank,
            bank_name: extractedData.bank_name || item.matchedBank.bank_name,
            account_number: extractedData.account_number || item.matchedBank.account_number,
            bank_currency: extractedData.currency || item.matchedBank.bank_currency,
            company_name: extractedData.company_name || item.matchedBank.company_name
        };

        console.log(`🔄 Enhanced fallback bank with extracted data:`, enhancedBank);

        return {
            ...item,
            matchedBank: enhancedBank
        };
    };

    const processFileWithPasswordDetection = async (file: File, index: number): Promise<BulkUploadItem> => {
        const fileInfo = safeDetectFileInfo(file.name);

        let matchedBank = null;
        let matchConfidence = 0;

        // Try to match with existing banks first
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

        // Password handling
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

        // Statement type detection
        let preliminaryType: 'monthly' | 'range' = 'monthly';
        const fileName = file.name?.toLowerCase() || '';

        if (fileName.includes('quarter') || fileName.includes('q1') || fileName.includes('q2') ||
            fileName.includes('q3') || fileName.includes('q4') || fileName.includes('range') ||
            fileName.includes('multi') || fileName.includes('annual')) {
            preliminaryType = 'range';
        }

        // FIX: Create a fallback "extracted bank" when no match is found
        let effectiveBank = matchedBank;

        if (!matchedBank) {
            // Create a mock bank from file info for processing
            effectiveBank = {
                id: -1, // Temporary ID to indicate it's not a real bank match
                bank_name: fileInfo?.bankName || 'Unknown Bank',
                account_number: fileInfo?.accountNumber || 'Unknown Account',
                bank_currency: 'USD', // Default currency
                company_id: -1, // Will be determined from extraction
                company_name: 'Unknown Company', // Will be determined from extraction
                acc_password: fileInfo?.password || null
            };

            console.log(`📋 No bank matched for ${file.name}, created fallback bank:`, effectiveBank);
        }

        return {
            file,
            detectedPassword: fileInfo?.password || null,
            detectedAccountNumber: fileInfo?.accountNumber || null,
            detectedBankName: fileInfo?.bankName || null,
            matchedBank: effectiveBank, // Always provide a bank (real or fallback)
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
            extractionAttempts: 0,
            // FIX: Add flag to indicate this is a fallback match
            isFallbackMatch: !matchedBank,
            matchConfidence: matchConfidence
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

    // FIX: This function now correctly updates the status after a successful DB operation
    const handleVouchStatement = async (statementItem: BulkUploadItem, isVouched: boolean) => {
        const itemIndex = uploadItems.findIndex(i => i.file.name === statementItem.file.name);
        if (itemIndex < 0) return;

        // Optimistically update the UI
        const updatedStatus = isVouched ? 'vouched' : 'uploaded';
        setUploadItems(prev => {
            const updated = [...prev];
            updated[itemIndex] = { ...updated[itemIndex], isVouched, status: updatedStatus };
            return updated;
        });

        // If vouching, save to DB. If un-vouching, the parent component handles it.
        if (isVouched) {
            try {
                await saveStatementToDatabase(uploadItems[itemIndex]);
                toast({
                    title: 'Statement Vouched',
                    description: 'Statement has been successfully saved and vouched.',
                });
            } catch (error) {
                // Revert UI on failure
                setUploadItems(prev => {
                    const updated = [...prev];
                    updated[itemIndex] = { ...updated[itemIndex], isVouched: false, status: 'uploaded' };
                    return updated;
                });
                toast({
                    title: 'Vouching Error',
                    description: `Failed to save statement: ${error.message}`,
                    variant: 'destructive',
                });
            }
        }
    };

    // Add this helper function to filter monthly balances properly
    const filterMonthlyBalancesForPeriod = (monthlyBalances: any[], statementPeriod: string) => {
        if (!statementPeriod || !monthlyBalances?.length) {
            return monthlyBalances || [];
        }

        try {
            const periodDates = parseStatementPeriod(statementPeriod);
            if (!periodDates) {
                return monthlyBalances;
            }

            // Filter to only include months within the actual statement period
            return monthlyBalances.filter(monthData => {
                const monthDate = new Date(monthData.year, monthData.month - 1);
                const startDate = new Date(periodDates.startYear, periodDates.startMonth - 1);
                const endDate = new Date(periodDates.endYear, periodDates.endMonth - 1);

                const isWithinPeriod = monthDate >= startDate && monthDate <= endDate;

                if (!isWithinPeriod) {
                    console.log(`Filtering out month ${monthData.month}/${monthData.year} - outside statement period`);
                }

                return isWithinPeriod;
            });
        } catch (error) {
            console.error('Error filtering monthly balances:', error);
            return monthlyBalances;
        }
    };

    // Enhanced batch processing with better error recovery
    const processBatchWithRetry = async (batch: any[], batchIndex: number, totalBatches: number) => {
        const maxRetries = 2;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                const results = await Promise.all(batch.map(async (item, itemIndex) => {
                    const globalIndex = uploadItems.indexOf(item);

                    try {
                        const statementType = item.statementType || 'monthly';
                        const extractedData = item.extractedData;

                        // Add retry logic for database conflicts
                        if (statementType === 'range' && extractedData.monthly_balances?.length > 1) {
                            return await handleRangeStatementUpload(item, globalIndex);
                        } else {
                            return await handleSingleStatementUpload(item, globalIndex);
                        }
                    } catch (error) {
                        // If it's a duplicate key error, treat as success
                        if (error.message?.includes('23505') || error.message?.includes('duplicate key')) {
                            console.log(`Duplicate key handled gracefully for item ${globalIndex}`);
                            setUploadItems(prev => {
                                const updated = [...prev];
                                updated[globalIndex] = {
                                    ...updated[globalIndex],
                                    status: 'uploaded',
                                    uploadProgress: 100,
                                    error: undefined
                                };
                                return updated;
                            });
                            return true;
                        }
                        throw error;
                    }
                }));

                return results;
            } catch (batchError) {
                attempt++;
                console.log(`Batch ${batchIndex + 1} attempt ${attempt} failed:`, batchError);

                if (attempt >= maxRetries) {
                    console.error(`Batch ${batchIndex + 1} failed after ${maxRetries} attempts`);
                    return batch.map(() => false);
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    };

    // Real-time progress broadcaster
    const broadcastProgress = (current: number, total: number, message: string = '') => {
        const percent = Math.round((current / total) * 100);
        setOverallProgress(percent);

        if (message) {
            console.log(`Progress: ${percent}% - ${message}`);
        }
    };

    // Enhanced debugging and verification
    const logBulkUploadSummary = (items: BulkUploadItem[]) => {
        const summary = {
            total: items.length,
            uploaded: items.filter(i => i.status === 'uploaded').length,
            failed: items.filter(i => i.status === 'failed').length,
            vouched: items.filter(i => i.status === 'vouched').length,
            rangeStatements: items.filter(i => i.statementType === 'range').length,
            monthlyStatements: items.filter(i => i.statementType === 'monthly').length,
            autoUnlocked: items.filter(i => i.passwordApplied).length,
            highConfidence: items.filter(i => i.extractedData?.extraction_confidence === 'HIGH').length,
            duplicatesHandled: items.filter(i => i.error?.includes('duplicate') || i.error?.includes('23505')).length
        };

        console.log('📊 Bulk Upload Summary:', summary);
        return summary;
    };

    // Enhanced bulk extraction with intelligent processing and proper progress display
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
        setOverallProgress(0);

        try {
            // Prepare batch files for enhanced extraction
            const batchFiles = filesToProcess.map((item, index) => ({
                file: item.file,
                index: uploadItems.indexOf(item),
                fileUrl: URL.createObjectURL(item.file),
                password: item.passwordApplied ? item.appliedPassword : null,
                originalItem: item,
                params: {
                    month: cycleMonth,
                    year: cycleYear
                }
            }));

            console.log(`Starting enhanced bulk extraction for ${batchFiles.length} files`);

            // Use the enhanced bulk extraction with proper progress callback
            const results = await processBulkExtraction(
                batchFiles,
                { month: cycleMonth, year: cycleYear },
                (progressValue, message) => {
                    console.log('Progress update:', progressValue, message);
                    if (typeof progressValue === 'number') {
                        setOverallProgress(Math.round(progressValue * 100));
                    } else if (typeof progressValue === 'string') {
                        // Handle string progress messages
                        console.log('Progress message:', progressValue);
                    }
                }
            );

            console.log('Bulk extraction results:', results);

            // Process results with enhanced validation
            let matched = 0;
            let failed = 0;
            let monthlyCount = 0;
            let rangeCount = 0;

            results.forEach(result => {
                const itemIndex = result.index;
                console.log(`Processing result for index ${itemIndex}:`, result);

                if (result.success && result.extractedData) {
                    // Enhanced statement type detection
                    const detectedType = determineEnhancedStatementType(result.extractedData);

                    setUploadItems(prev => {
                        const updated = [...prev];
                        if (updated[itemIndex]) {
                            // FIX: Enhance fallback banks with extracted data
                            const enhancedItem = enhanceFallbackBankWithExtractionData(
                                updated[itemIndex],
                                result.extractedData
                            );

                            updated[itemIndex] = {
                                ...enhancedItem,
                                status: 'matched',
                                extractedData: result.extractedData,
                                statementType: detectedType,
                                uploadProgress: 100
                            };
                        }
                        return updated;
                    });
                    matched++;
                } else {
                    // Handle failed extractions
                    setUploadItems(prev => {
                        const updated = [...prev];
                        if (updated[itemIndex]) {
                            updated[itemIndex] = {
                                ...updated[itemIndex],
                                status: 'unmatched',
                                error: result.error || 'Enhanced extraction failed',
                                uploadProgress: 0,
                                extractionAttempts: (updated[itemIndex].extractionAttempts || 0) + 1
                            };
                        }
                        return updated;
                    });
                    failed++;
                }
            });

            setTotalMatched(matched);
            setTotalUnmatched(failed);

            // Cleanup URLs
            batchFiles.forEach(file => {
                try {
                    URL.revokeObjectURL(file.fileUrl);
                } catch (e) {
                    console.warn('Failed to revoke URL:', e);
                }
            });

            toast({
                title: 'Enhanced Bulk Extraction Complete',
                description: `${matched} successful (${monthlyCount} monthly, ${rangeCount} range), ${failed} need review`,
            });

            if (matched > 0 || failed > 0) {
                setActiveTab('review'); // Always go to review to handle failed extractions
            }

        } catch (error) {
            console.error('Enhanced bulk extraction error:', error);
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

    // NEW: A fully functional StatementRowComponent
    const StatementRowComponent = ({ statement, onVouchToggle, onViewStatement, onEditPeriod, onBalanceUpdate }) => {
        const [editingBalance, setEditingBalance] = useState<string | null>(null);
        const [tempBalance, setTempBalance] = useState('');

        const formatNumberWithCommas = (value) => {
            if (value === null || value === undefined || isNaN(value)) return '';
            return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        };

        const handleBalanceEdit = (field: string) => {
            setEditingBalance(field);
            const currentValue = statement.extractedData?.[field];
            setTempBalance(formatNumberWithCommas(currentValue));
        };

        const handleBalanceSave = (field: string) => {
            const numericValue = parseFloat(tempBalance.replace(/,/g, ''));
            onBalanceUpdate(field, isNaN(numericValue) ? null : numericValue);
            setEditingBalance(null);
            setTempBalance('');
        };

        const closingBalance = statement.extractedData?.closing_balance;
        const qbBalance = statement.extractedData?.quickbooks_balance || statement.extractedData?.qb_balance || statement.status?.quickbooks_balance;
        const difference = (closingBalance !== null && qbBalance !== null) ? closingBalance - qbBalance : null;

        return (
            <TableRow className={statement.isVouched ? 'bg-green-50' : ''}>
                <TableCell>
                    <Checkbox
                        checked={statement.isVouched || false}
                        onCheckedChange={onVouchToggle}
                    />
                </TableCell>
                <TableCell className="max-w-[150px] truncate">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        {statement.file.name}
                    </div>
                </TableCell>
                <TableCell className="text-xs">
                    {statement.extractedData?.statement_period || 'Unknown'}
                </TableCell>
                <TableCell>
                    <Badge variant="outline" className="capitalize">
                        {statement.statementType || 'monthly'}
                    </Badge>
                </TableCell>
                <TableCell>
                    {statement.extractedData?.extraction_confidence && (
                        <Badge variant="outline" className={
                            statement.extractedData.extraction_confidence === 'HIGH'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-yellow-50 text-yellow-700'
                        }>
                            {statement.extractedData.extraction_confidence}
                        </Badge>
                    )}
                </TableCell>
                <TableCell>
                    {editingBalance === 'closing_balance' ? (
                        <div className="flex items-center gap-1">
                            <Input
                                value={tempBalance}
                                onChange={(e) => setTempBalance(e.target.value)}
                                className="w-28 h-7 text-xs"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleBalanceSave('closing_balance');
                                    if (e.key === 'Escape') setEditingBalance(null);
                                }}
                                autoFocus
                            />
                            <Button size="icon" className="h-7 w-7" onClick={() => handleBalanceSave('closing_balance')}>
                                <Save className="h-3 w-3" />
                            </Button>
                        </div>
                    ) : (
                        <div
                            className="cursor-pointer hover:bg-gray-100 p-1 rounded flex items-center justify-between"
                            onClick={() => handleBalanceEdit('closing_balance')}
                        >
                            <span>{formatCurrency(closingBalance, statement.extractedData?.currency || 'USD')}</span>
                            <Edit className="h-3 w-3 ml-2 text-gray-400" />
                        </div>
                    )}
                </TableCell>
                <TableCell>
                    {editingBalance === 'quickbooks_balance' ? (
                        <div className="flex items-center gap-1">
                            <Input
                                value={tempBalance}
                                onChange={(e) => setTempBalance(e.target.value)}
                                className="w-28 h-7 text-xs"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleBalanceSave('quickbooks_balance');
                                    if (e.key === 'Escape') setEditingBalance(null);
                                }}
                                autoFocus
                            />
                            <Button size="icon" className="h-7 w-7" onClick={() => handleBalanceSave('quickbooks_balance')}>
                                <Save className="h-3 w-3" />
                            </Button>
                        </div>
                    ) : (
                        <div
                            className="cursor-pointer hover:bg-gray-100 p-1 rounded flex items-center justify-between"
                            onClick={() => handleBalanceEdit('quickbooks_balance')}
                        >
                            <span>{formatCurrency(qbBalance, statement.extractedData?.currency || 'USD')}</span>
                            <Edit className="h-3 w-3 ml-2 text-gray-400" />
                        </div>
                    )}
                </TableCell>
                <TableCell className={difference !== 0 ? 'text-red-600 font-semibold' : ''}>
                    {formatCurrency(difference, statement.extractedData?.currency || 'USD')}
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
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onViewStatement}>
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEditPeriod}>
                            <Calendar className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
        );
    };

    // Enhanced statement type determination with intelligent scenario handling
    const determineEnhancedStatementType = (extractedData: any): 'monthly' | 'range' => {
        if (!extractedData) {
            console.log('No extracted data, defaulting to monthly');
            return 'monthly';
        }

        const monthlyBalances = extractedData.monthly_balances || [];
        const statementPeriod = extractedData.statement_period;
        const adjustedPeriod = extractedData.statement_period_adjusted;
        const embeddingsConfirmed = extractedData.embeddings_confirmed;
        const extractionConfidence = extractedData.extraction_confidence;

        console.log('Enhanced statement type determination:', {
            monthlyBalancesCount: monthlyBalances.length,
            statementPeriod,
            adjustedPeriod,
            embeddingsConfirmed,
            extractionConfidence
        });

        // Primary indicator: Multiple monthly balances
        if (monthlyBalances.length > 1) {
            console.log('Detected RANGE statement: Multiple monthly balances found');
            return 'range';
        }

        // Secondary indicator: Parse statement period for date range analysis
        const periodToAnalyze = adjustedPeriod || statementPeriod;
        if (periodToAnalyze) {
            try {
                const periodResult = parseStatementPeriod(periodToAnalyze);
                if (periodResult) {
                    const monthRange = generateMonthRange(
                        periodResult.startMonth,
                        periodResult.startYear,
                        periodResult.endMonth,
                        periodResult.endYear
                    );
                    if (monthRange.length > 1) {
                        console.log('Detected RANGE statement: Period spans multiple months');
                        return 'range';
                    }
                }
            } catch (error) {
                console.warn('Error parsing statement period:', error);
            }
        }

        // Check for incomplete months scenario
        if (extractedData.data_quality_issues?.includes('INCOMPLETE_MONTH')) {
            console.log('Detected MONTHLY statement: Marked as incomplete month');
            return 'monthly';
        }

        console.log('Detected MONTHLY statement: Single month or same-month period');
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
                statement_period_adjusted: null,
                period_adjustment_reason: 'Manual period input by user',
                last_transaction_date: null,
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
                    closing_date: null,
                    balance_scenario: 'MANUAL_INPUT',
                    is_complete: false,
                    statement_page: 1,
                    notes: 'Manual period input - requires manual validation'
                })),
                extraction_confidence: 'LOW',
                data_quality_issues: ['Manual period input'],
                total_pages_analyzed: 0,
                embeddings_confirmed: false,
                processing_metadata: {
                    extraction_date: new Date().toISOString(),
                    extraction_version: '2.0-manual',
                    scenarios_analyzed: false,
                    all_pages_processed: false,
                    manual_input: true
                }
            };

            const detectedType = determineEnhancedStatementType(mockExtractedData);

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


    const handleVouchAllCompanies = async () => {
        setUploading(true);
        let successCount = 0;
        let errorCount = 0;

        try {
            console.log('🔄 Starting vouch all companies process');
            const allStatementsToVouch = companyGroups.flatMap(group =>
                group.statements.filter(s => !s.isVouched)
            );
            console.log(`📊 Vouching ${allStatementsToVouch.length} statements across ${companyGroups.length} companies`);

            for (const statement of allStatementsToVouch) {
                try {
                    await saveStatementToDatabase(statement);

                    // Update UI state for this specific item
                    const itemIndex = uploadItems.findIndex(i => i.file.name === statement.file.name);
                    if (itemIndex > -1) {
                        setUploadItems(prev => {
                            const updated = [...prev];
                            updated[itemIndex] = { ...updated[itemIndex], isVouched: true, status: 'vouched' };
                            return updated;
                        });
                    }
                    successCount++;
                } catch (error) {
                    console.error(`Failed to vouch statement ${statement.file.name}:`, error);
                    errorCount++;
                }
            }

            // Update all company groups at the end
            setCompanyGroups(prev => prev.map(group => ({
                ...group,
                isVouched: true,
            })));

            toast({
                title: 'Vouching Complete',
                description: `Successfully vouched ${successCount} statements. ${errorCount} failed.`,
            });

            if (errorCount === 0) {
                window.dispatchEvent(new CustomEvent('bankStatementsUpdated'));
            }

        } catch (error) {
            console.error('Error vouching all companies:', error);
            toast({
                title: 'Vouching Error',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setUploading(false);
        }
    };

    const handleVouchCompany = async (companyId: number) => {
        const group = companyGroups.find(g => g.companyId === companyId);
        if (!group) return;

        setUploading(true);
        let successCount = 0;
        let errorCount = 0;

        try {
            console.log(`🔄 Vouching company: ${group.companyName}`);

            for (const statement of group.statements) {
                if (!statement.isVouched) {
                    try {
                        await saveStatementToDatabase(statement);

                        const itemIndex = uploadItems.findIndex(i => i.file.name === statement.file.name);
                        if (itemIndex > -1) {
                            setUploadItems(prev => {
                                const updated = [...prev];
                                updated[itemIndex] = { ...updated[itemIndex], isVouched: true, status: 'vouched' };
                                return updated;
                            });
                        }
                        successCount++;
                    } catch (error) {
                        console.error(`Error vouching statement ${statement.file.name}:`, error);
                        errorCount++;
                    }
                }
            }

            if (errorCount === 0) {
                setCompanyGroups(prev => prev.map(g =>
                    g.companyId === companyId ? { ...g, isVouched: true } : g
                ));
            }

            toast({
                title: `Company Vouched`,
                description: `${group.companyName}: ${successCount} statements saved and vouched. ${errorCount} failed.`,
            });
        } catch (error) {
            console.error(`Error vouching company ${companyId}:`, error);
            toast({
                title: 'Vouching Error',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setUploading(false);
        }
    };

    const saveStatementToDatabase = async (statement: BulkUploadItem) => {
        if (!statement.matchedBank || !statement.extractedData) {
            throw new Error('Invalid statement data for saving.');
        }

        console.log(`💾 Saving statement to database: ${statement.file.name}`, statement.extractedData);

        // STEP 1: Extract actual period (same as your current code)
        let actualMonth = cycleMonth;
        let actualYear = cycleYear;

        if (statement.extractedData?.statement_period) {
            const periodResult = parseStatementPeriod(statement.extractedData.statement_period);
            if (periodResult) {
                actualMonth = periodResult.endMonth - 1;
                actualYear = periodResult.endYear;
                console.log(`📅 Using extracted period: ${actualMonth + 1}/${actualYear}`);
            }
        }

        // STEP 2: Get cycle ID
        const cycleId = await getOrCreateStatementCycle(actualYear, actualMonth, statement.statementType || 'monthly');

        // STEP 3: Check for existing statement
        const { data: existingStatement, error: existingError } = await supabase
            .from('acc_cycle_bank_statements')
            .select('id, status, statement_extractions')
            .eq('bank_id', statement.matchedBank.id)
            .eq('statement_cycle_id', cycleId)
            .eq('statement_type', statement.statementType || 'monthly')
            .maybeSingle();

        if (existingError && existingError.code !== 'PGRST116') {
            throw existingError;
        }

        // STEP 4: Prepare comprehensive statement data (FIXED to match single upload)
        const statementData = {
            bank_id: statement.matchedBank.id,
            company_id: statement.matchedBank.company_id,
            statement_cycle_id: cycleId,
            statement_month: actualMonth,
            statement_year: actualYear,
            statement_type: statement.statementType || 'monthly',
            has_soft_copy: true,
            has_hard_copy: false,

            // FIX: Complete document structure
            statement_document: {
                statement_pdf: statement.extractedData.pdf_path || null,
                statement_excel: null,
                document_size: statement.file.size,
                document_type: 'pdf',
                password: statement.appliedPassword || null,
                extraction_metadata: statement.extractedData?.processing_metadata || {},
                user_period_input: statement.userPeriodInput || null,
                upload_timestamp: new Date().toISOString()
            },

            // FIX: Complete extractions structure with proper balance handling
            statement_extractions: {
                // Core financial data
                bank_name: statement.matchedBank.bank_name,
                account_number: statement.matchedBank.account_number,
                currency: statement.matchedBank.bank_currency,

                // Balances - properly formatted
                opening_balance: statement.extractedData.opening_balance ?
                    parseFloat(statement.extractedData.opening_balance) : null,
                closing_balance: statement.extractedData.closing_balance ?
                    parseFloat(statement.extractedData.closing_balance) : null,

                // Period information
                statement_period: statement.extractedData.statement_period || null,
                statement_period_adjusted: statement.extractedData.statement_period_adjusted || null,
                period_adjustment_reason: statement.extractedData.period_adjustment_reason || null,
                last_transaction_date: statement.extractedData.last_transaction_date || null,

                // Monthly balances - properly formatted
                monthly_balances: (statement.extractedData.monthly_balances || []).map(balance => ({
                    month: parseInt(balance.month),
                    year: parseInt(balance.year),
                    opening_balance: balance.opening_balance ? parseFloat(balance.opening_balance) : null,
                    closing_balance: balance.closing_balance ? parseFloat(balance.closing_balance) : null,
                    closing_date: balance.closing_date || null,
                    balance_scenario: balance.balance_scenario || 'NORMAL',
                    is_complete: balance.is_complete !== false,
                    statement_page: balance.statement_page || 1,
                    notes: balance.notes || null,
                    verified_by: null,
                    verified_at: null
                })),

                // Quality and confidence indicators
                extraction_confidence: statement.extractedData.extraction_confidence || 'MEDIUM',
                data_quality_issues: statement.extractedData.data_quality_issues || [],
                embeddings_confirmed: statement.extractedData.embeddings_confirmed || false,
                total_pages: statement.extractedData.total_pages || 1,
                total_pages_analyzed: statement.extractedData.total_pages_analyzed || 0,

                // Processing metadata
                processing_metadata: {
                    extraction_date: new Date().toISOString(),
                    extraction_version: '2.0-bulk',
                    scenarios_analyzed: statement.extractedData.processing_metadata?.scenarios_analyzed || false,
                    all_pages_processed: (statement.extractedData.total_pages_analyzed || 0) > 0,
                    manual_input: !!statement.userPeriodInput,
                    bulk_upload: true,
                    password_protected: !!statement.passwordApplied
                },

                // Vouching data
                verified_balances: true,
                vouched_at: new Date().toISOString(),
                vouched_by: 'bulk_upload_user' // Replace with actual user
            },

            // FIX: Proper validation status
            validation_status: {
                is_validated: true,
                validation_date: new Date().toISOString(),
                validated_by: 'bulk_upload_user', // Replace with actual user
                mismatches: [], // Should calculate mismatches if QB balance exists
                extraction_confidence: statement.extractedData.extraction_confidence || 'MEDIUM',
                requires_review: (statement.extractedData.data_quality_issues?.length || 0) > 0
            },

            // FIX: Proper status structure (THIS IS CRITICAL)
            status: {
                status: 'vouched',
                assigned_to: null,
                verification_date: new Date().toISOString(),
                uploaded_by: 'bulk_upload_user', // Replace with actual user
                upload_method: 'bulk_upload',
                // CRITICAL: Include QuickBooks balance in status like single upload
                quickbooks_balance: statement.extractedData.quickbooks_balance || null
            },

            // FIX: Add missing QuickBooks balance field at root level
            quickbooks_balance: statement.extractedData.quickbooks_balance || null
        };

        console.log(`💾 Prepared complete statement data:`, {
            ...statementData,
            statement_document: { ...statementData.statement_document, statement_pdf: '[FILE_PATH]' },
            statement_extractions: {
                ...statementData.statement_extractions,
                monthly_balances: `[${statementData.statement_extractions.monthly_balances?.length || 0} balances]`
            }
        });

        // STEP 5: Database operation with proper conflict handling
        try {
            if (existingStatement) {
                console.log(`🔄 Updating existing statement with ID: ${existingStatement.id}`);

                // Merge with existing data intelligently
                const mergedExtractions = {
                    ...existingStatement.statement_extractions,
                    ...statementData.statement_extractions,
                    // Preserve any existing validated data that might be more accurate
                    verified_balances: true, // Always true when vouching
                    vouched_at: new Date().toISOString()
                };

                const mergedStatus = {
                    ...existingStatement.status,
                    ...statementData.status,
                    status: 'vouched' // Always vouched when saving from bulk upload
                };

                const { data: updateResult, error: updateError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .update({
                        ...statementData,
                        statement_extractions: mergedExtractions,
                        status: mergedStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingStatement.id)
                    .select();

                if (updateError) {
                    console.error("Supabase update error:", updateError);
                    throw updateError;
                }

                console.log(`✅ Statement updated successfully:`, updateResult);
            } else {
                console.log(`➕ Inserting new statement`);

                const { data: insertResult, error: insertError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .insert([{
                        ...statementData,
                        created_at: new Date().toISOString()
                    }])
                    .select();

                if (insertError) {
                    console.error("Supabase insert error:", insertError);
                    throw insertError;
                }

                console.log(`✅ Statement inserted successfully:`, insertResult);
            }
        } catch (error) {
            console.error("Database operation failed:", error);
            throw new Error(`Failed to save statement: ${error.message}`);
        }

        console.log(`✅ Statement saved successfully: ${statement.file.name}`);
    };


    const handleBulkUpload = async () => {
        const itemsToUpload = uploadItems.filter(item =>
            item.status === 'matched' && item.matchedBank && item.extractedData
        );

        console.log(`🚀 Starting bulk upload process:`, {
            totalItems: itemsToUpload.length,
            itemDetails: itemsToUpload.map((item, idx) => ({
                index: idx,
                fileName: item.file.name,
                statementType: item.statementType,
                companyId: item.matchedBank?.company_id,
                bankId: item.matchedBank?.id,
                hasExtractedData: !!item.extractedData,
                extractionConfidence: item.extractedData?.extraction_confidence
            }))
        });

        if (itemsToUpload.length === 0) {
            console.warn(`⚠️ No items to upload`);
            toast({
                title: 'No items to upload',
                description: 'No validated statements ready for upload',
                variant: 'destructive'
            });
            return;
        }

        setUploading(true);
        setOverallProgress(0);

        try {
            console.log(`🔄 Processing ${itemsToUpload.length} statements in parallel`);

            // Process all uploads in parallel with detailed logging
            const uploadPromises = itemsToUpload.map(async (item, index) => {
                const itemIndex = uploadItems.indexOf(item);
                const statementType = item.statementType || 'monthly';

                console.log(`📝 Processing item ${index + 1}/${itemsToUpload.length}:`, {
                    globalIndex: itemIndex,
                    fileName: item.file.name,
                    statementType,
                    extractedData: {
                        monthlyBalances: item.extractedData?.monthly_balances?.length || 0,
                        statementPeriod: item.extractedData?.statement_period,
                        confidence: item.extractedData?.extraction_confidence
                    }
                });

                try {
                    let result;
                    if (statementType === 'range' && item.extractedData.monthly_balances?.length > 1) {
                        console.log(`📅 Processing as RANGE statement (${item.extractedData.monthly_balances.length} months)`);
                        result = await handleRangeStatementUpload(item, itemIndex);
                    } else {
                        console.log(`📄 Processing as MONTHLY statement`);
                        result = await handleSingleStatementUpload(item, itemIndex);
                    }

                    console.log(`✅ Upload completed for item ${index + 1}:`, {
                        success: result,
                        fileName: item.file.name,
                        statementType
                    });

                    return result;

                } catch (error) {
                    console.error(`💥 Upload failed for item ${index + 1}:`, {
                        fileName: item.file.name,
                        error: error.message,
                        stack: error.stack
                    });

                    // Handle duplicate key gracefully
                    if (error.message?.includes('23505') || error.message?.includes('duplicate key')) {
                        console.log(`🔄 Duplicate key handled gracefully for item ${index + 1}`);
                        setUploadItems(prev => {
                            const updated = [...prev];
                            updated[itemIndex] = {
                                ...updated[itemIndex],
                                status: 'uploaded',
                                uploadProgress: 100,
                                error: undefined
                            };
                            return updated;
                        });
                        return true;
                    }

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


            const toggleCompanyExpansion = (companyId: number, forceOpen?: boolean) => {
                setCompanyGroups(prev => prev.map(group => ({
                    ...group,
                    isExpanded: group.companyId === companyId
                        ? (forceOpen ?? !group.isExpanded)
                        : false // Close others
                })));
            };

            // Execute all uploads in parallel
            console.log(`⏱️ Executing ${uploadPromises.length} uploads in parallel...`);
            const results = await Promise.all(uploadPromises);
            const uploadedCount = results.filter(Boolean).length;
            const failedCount = results.length - uploadedCount;

            console.log(`📊 Bulk upload results:`, {
                total: results.length,
                successful: uploadedCount,
                failed: failedCount,
                successRate: `${Math.round((uploadedCount / results.length) * 100)}%`
            });

            // Set final progress
            setOverallProgress(100);

            // Enhanced logging summary
            const finalSummary = {
                uploadedItems: uploadItems.filter(i => i.status === 'uploaded'),
                failedItems: uploadItems.filter(i => i.status === 'failed'),
                vouchedItems: uploadItems.filter(i => i.status === 'vouched'),
                timestamp: new Date().toISOString()
            };

            console.log(`📋 Final upload summary:`, finalSummary);

            toast({
                title: 'Bulk Upload Complete',
                description: `${uploadedCount} statements uploaded successfully, ${failedCount} failed`,
            });
            setTimeout(() => {

                window.dispatchEvent(new CustomEvent('bankStatementsUpdated', {
                    detail: {
                        timestamp: Date.now(),
                        uploadedCount,
                        failedCount,
                        source: 'bulkUpload'
                    }
                }));
            }, 500);


            // Start sequential extraction
            if (uploadedCount > 0) {
                console.log(`🔄 Starting sequential extraction process for ${uploadedCount} uploaded statements`);
                await startSequentialExtractionProcess();
            }

        } catch (error) {
            console.error(`💥 Bulk upload process failed:`, {
                error: error.message,
                stack: error.stack,
                itemsToUpload: itemsToUpload.length
            });

            toast({
                title: 'Upload Error',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setUploading(false);
            setOverallProgress(100);
            console.log(`🏁 Bulk upload process completed`);
        }
    };

    // Sequential extraction process - opens each statement for review and saving
    const startSequentialExtractionProcess = async () => {
        const uploadedItems = uploadItems.filter(item => item.status === 'uploaded');

        if (uploadedItems.length === 0) {
            organizeByCompany();
            setActiveTab('vouching');
            return;
        }

        toast({
            title: 'Starting Sequential Review',
            description: `${uploadedItems.length} statements uploaded. Starting individual review process...`,
        });

        // Set up sequential processing
        setCurrentItemIndex(0);
        setActiveTab('processing');

        // Start with the first uploaded item
        await openExtractionForItem(uploadedItems[0], 0, uploadedItems);
    };

    // Open extraction dialog for a specific item in the sequence
    const openExtractionForItem = async (item: BulkUploadItem, currentIndex: number, allItems: BulkUploadItem[]) => {
        try {
            setCurrentProcessingItem(item);
            setCurrentItemIndex(currentIndex);

            // Create a temporary statement object for the extraction dialog
            const bankForDialog = item.matchedBank || {
                id: -1,
                bank_name: item.detectedBankName || item.extractedData?.bank_name || 'Unknown Bank',
                account_number: item.detectedAccountNumber || item.extractedData?.account_number || 'Unknown Account',
                bank_currency: item.extractedData?.currency || 'USD',
                company_id: -1,
                company_name: item.extractedData?.company_name || 'Unknown Company',
                acc_password: item.detectedPassword || ''
            };

            // Create mock statement object for the extraction dialog
            const mockStatement = {
                id: `uploaded-${item.file.name}-${currentIndex}`,
                bank_id: bankForDialog.id,
                statement_month: cycleMonth,
                statement_year: cycleYear,
                statement_type: item.statementType || 'monthly',
                quickbooks_balance: null,
                statement_document: {
                    statement_pdf: URL.createObjectURL(item.file),
                    document_size: item.file.size,
                    password: item.appliedPassword,
                },
                statement_extractions: item.extractedData || {
                    bank_name: bankForDialog.bank_name,
                    account_number: bankForDialog.account_number,
                    currency: bankForDialog.bank_currency,
                    statement_period: '',
                    opening_balance: null,
                    closing_balance: null,
                    monthly_balances: [],
                },
                has_soft_copy: true,
                has_hard_copy: false,
                validation_status: {
                    is_validated: false,
                    validation_date: null,
                    validated_by: null,
                    mismatches: [],
                },
                status: {
                    status: 'uploaded',
                    assigned_to: null,
                    verification_date: null,
                },
                // Add metadata for sequential processing
                _sequentialIndex: currentIndex,
                _totalItems: allItems.length,
                _nextItem: currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null
            };

            setCurrentStatementForDialog(mockStatement);
            setShowExtractionDialog(true);

            toast({
                title: `Reviewing Statement ${currentIndex + 1} of ${allItems.length}`,
                description: `${item.file.name} - Please review and save to continue`,
            });

        } catch (error) {
            console.error('Error opening extraction for sequential processing:', error);
            toast({
                title: 'Error Opening Statement',
                description: `Failed to open statement: ${error.message}`,
                variant: 'destructive'
            });

            // Move to next item on error
            await proceedToNextItem(currentIndex, allItems);
        }
    };


    // Proceed to the next item in the sequence
    const proceedToNextItem = async (currentIndex: number, allItems: BulkUploadItem[]) => {
        const nextIndex = currentIndex + 1;

        if (nextIndex < allItems.length) {
            // Open next item
            setTimeout(() => {
                openExtractionForItem(allItems[nextIndex], nextIndex, allItems);
            }, 500); // Small delay for better UX
        } else {
            // All items processed, move to vouching
            toast({
                title: 'Sequential Review Complete',
                description: 'All statements reviewed. Moving to vouching phase...',
            });

            setTimeout(() => {
                organizeByCompany();
                setActiveTab('vouching');
                startSequentialVouchingProcess();
            }, 1000);
        }
    };

    // Start sequential vouching process
    const startSequentialVouchingProcess = async () => {
        organizeByCompany();

        // Wait for company organization to complete
        setTimeout(() => {
            const unvouchedGroups = companyGroups.filter(group => !group.isVouched);

            if (unvouchedGroups.length > 0) {
                toast({
                    title: 'Starting Vouching Process',
                    description: `${unvouchedGroups.length} companies need vouching. Opening first company...`,
                });

                // Auto-expand first unvouched company
                setCompanyGroups(groups => {
                    return groups.map((group, index) => ({
                        ...group,
                        isExpanded: index === 0 && !group.isVouched
                    }));
                });
            } else {
                toast({
                    title: 'All Companies Vouched',
                    description: 'All statements have been vouched successfully!',
                });
            }
        }, 500);
    };

    // Enhanced handleRangeStatementUpload with proper conflict resolution
    const handleRangeStatementUpload = async (item: BulkUploadItem, itemIndex: number) => {
        setUploadItems(prev => {
            const updated = [...prev];
            updated[itemIndex] = { ...updated[itemIndex], uploadProgress: 10 };
            return updated;
        });

        const fileName = `range_${item.matchedBank.company_id}_${item.matchedBank.id}_${cycleYear}_${Date.now()}.pdf`;
        const filePath = `statement_documents/${cycleYear}/${cycleMonth + 1}/${item.matchedBank.company_id}/${fileName}`;

        try {
            // Upload file once
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('Statement-Cycle')
                .upload(filePath, item.file, { upsert: true });

            if (uploadError) throw uploadError;

            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = { ...updated[itemIndex], uploadProgress: 30 };
                return updated;
            });

            // Filter monthly_balances to only include months within the statement period
            const statementPeriod = item.extractedData.statement_period || item.extractedData.statement_period_adjusted;
            const periodDates = parseStatementPeriod(statementPeriod);

            let filteredMonthlyBalances = item.extractedData.monthly_balances || [];

            if (periodDates) {
                // Only include months that fall within the statement period
                filteredMonthlyBalances = filteredMonthlyBalances.filter(monthData => {
                    const monthDate = new Date(monthData.year, monthData.month - 1);
                    const startDate = new Date(periodDates.startYear, periodDates.startMonth - 1);
                    const endDate = new Date(periodDates.endYear, periodDates.endMonth - 1);

                    return monthDate >= startDate && monthDate <= endDate;
                });
            }

            console.log(`Creating statements for ${filteredMonthlyBalances.length} months within period:`,
                filteredMonthlyBalances.map(m => `${m.month}/${m.year}`));

            let successCount = 0;
            const totalMonths = filteredMonthlyBalances.length;

            // Create statement records for each month in the filtered range
            for (let i = 0; i < filteredMonthlyBalances.length; i++) {
                const monthData = filteredMonthlyBalances[i];

                try {
                    const cycleId = await getOrCreateStatementCycle(monthData.year, monthData.month - 1, 'range');

                    // Enhanced conflict resolution - check for EXACT combination that causes the constraint violation
                    const { data: existingStatement } = await supabase
                        .from('acc_cycle_bank_statements')
                        .select('id')
                        .eq('bank_id', item.matchedBank.id)
                        .eq('statement_cycle_id', cycleId)
                        .eq('statement_type', 'range')
                        .maybeSingle();

                    // Also check if there's a monthly statement for this period that would conflict
                    const { data: existingMonthlyStatement } = await supabase
                        .from('acc_cycle_bank_statements')
                        .select('id')
                        .eq('bank_id', item.matchedBank.id)
                        .eq('statement_cycle_id', cycleId)
                        .eq('statement_type', 'monthly')
                        .maybeSingle();

                    // If there's a monthly statement, we need to decide: update it or skip
                    if (existingMonthlyStatement && !existingStatement) {
                        console.log(`Converting existing monthly statement to range for ${monthData.month}/${monthData.year}`);
                        // Update the existing monthly statement to be a range statement
                        const { error: updateError } = await supabase
                            .from('acc_cycle_bank_statements')
                            .update({
                                statement_type: 'range',
                                statement_document: {
                                    statement_pdf: uploadData.path,
                                    document_size: item.file.size,
                                    password: item.passwordApplied ? item.appliedPassword : null,
                                    extraction_metadata: item.extractedData.processing_metadata
                                },
                                statement_extractions: {
                                    ...item.extractedData,
                                    // Only include this specific month's balance
                                    monthly_balances: [monthData],
                                    period_specific: true
                                }
                            })
                            .eq('id', existingMonthlyStatement.id);

                        if (updateError) {
                            if (updateError.code === '23505') {
                                console.log(`Duplicate constraint hit for ${monthData.month}/${monthData.year}, skipping`);
                            } else {
                                throw updateError;
                            }
                        } else {
                            console.log(`Converted monthly to range statement for ${monthData.month}/${monthData.year}`);
                        }
                        successCount++;
                        continue; // Skip the insert below
                    }

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
                            password: item.passwordApplied ? item.appliedPassword : null,
                            extraction_metadata: item.extractedData.processing_metadata
                        },
                        statement_extractions: {
                            ...item.extractedData,
                            // Only include this specific month's balance
                            monthly_balances: [monthData],
                            period_specific: true
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
                        // Update existing statement
                        const { error: updateError } = await supabase
                            .from('acc_cycle_bank_statements')
                            .update(statementData)
                            .eq('id', existingStatement.id);

                        if (updateError) throw updateError;
                        console.log(`Updated existing statement for ${monthData.month}/${monthData.year}`);
                    } else {
                        // Insert new statement
                        const { error: insertError } = await supabase
                            .from('acc_cycle_bank_statements')
                            .insert([statementData]);

                        if (insertError) {
                            // Handle duplicate key error gracefully
                            if (insertError.code === '23505') {
                                console.log(`Statement already exists for ${monthData.month}/${monthData.year}, skipping`);
                            } else {
                                throw insertError;
                            }
                        } else {
                            console.log(`Created new statement for ${monthData.month}/${monthData.year}`);
                        }
                    }

                    successCount++;

                    // Update progress
                    const monthProgress = 30 + (60 * (i + 1) / totalMonths);
                    setUploadItems(prev => {
                        const updated = [...prev];
                        updated[itemIndex] = { ...updated[itemIndex], uploadProgress: Math.round(monthProgress) };
                        return updated;
                    });

                } catch (monthError) {
                    console.error(`Error creating statement for ${monthData.month}/${monthData.year}:`, monthError);
                    // Continue with other months even if one fails
                }
            }

            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = {
                    ...updated[itemIndex],
                    status: successCount > 0 ? 'uploaded' : 'failed',
                    uploadProgress: 100,
                    error: successCount === 0 ? 'Failed to create statement records' : undefined
                };
                return updated;
            });

            return successCount > 0;

        } catch (error) {
            console.error(`Error in range statement upload:`, error);
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
    };

    const handleSingleStatementUpload = async (item: BulkUploadItem, itemIndex: number) => {
        console.log(`🔄 Starting single statement upload for item ${itemIndex}:`, {
            fileName: item.file.name,
            bankId: item.matchedBank?.id,
            companyId: item.matchedBank?.company_id,
            extractedPeriod: item.extractedData?.statement_period,
            statementType: item.statementType,
            currentDialogPeriod: `${cycleYear}/${cycleMonth + 1}`
        });

        // Initialize progress tracking
        setUploadItems(prev => {
            const updated = [...prev];
            updated[itemIndex] = { ...updated[itemIndex], uploadProgress: 5, status: 'processing' };
            return updated;
        });

        try {
            // STEP 1: Extract actual period from statement data
            let actualMonth = cycleMonth;
            let actualYear = cycleYear;
            let actualStatementType = item.statementType || 'monthly';

            // Primary: Use extracted statement period
            if (item.extractedData?.statement_period) {
                const periodResult = parseStatementPeriod(item.extractedData.statement_period);
                if (periodResult) {
                    actualMonth = periodResult.endMonth - 1; // Convert to 0-based month
                    actualYear = periodResult.endYear;
                    console.log(`📅 Using extracted period: ${actualMonth + 1}/${actualYear} from "${item.extractedData.statement_period}"`);
                }
            }
            // Secondary: Use monthly_balances data
            else if (item.extractedData?.monthly_balances?.length > 0) {
                const lastBalance = item.extractedData.monthly_balances[item.extractedData.monthly_balances.length - 1];
                actualMonth = lastBalance.month - 1; // Convert to 0-based month
                actualYear = lastBalance.year;
                console.log(`📅 Using balance period: ${actualMonth + 1}/${actualYear} from monthly_balances`);
            }
            // Tertiary: Use user manual input if available
            else if (item.userPeriodInput) {
                const periodResult = parseStatementPeriod(item.userPeriodInput);
                if (periodResult) {
                    actualMonth = periodResult.endMonth - 1;
                    actualYear = periodResult.endYear;
                    console.log(`📅 Using user input period: ${actualMonth + 1}/${actualYear} from "${item.userPeriodInput}"`);
                }
            }

            // Validate the determined period
            if (actualMonth < 0 || actualMonth > 11 || actualYear < 2000 || actualYear > 2100) {
                throw new Error(`Invalid statement period determined: ${actualMonth + 1}/${actualYear}`);
            }

            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = { ...updated[itemIndex], uploadProgress: 15 };
                return updated;
            });

            // STEP 2: Prepare file upload with correct naming and path
            const fileName = `${actualStatementType}_${item.matchedBank.company_id}_${item.matchedBank.id}_${actualYear}_${String(actualMonth + 1).padStart(2, '0')}_${Date.now()}.pdf`;
            const filePath = `statement_documents/${actualYear}/${String(actualMonth + 1).padStart(2, '0')}/${item.matchedBank.company_id}/${fileName}`;

            console.log(`📁 Uploading file to storage:`, {
                fileName,
                filePath,
                fileSize: item.file.size
            });

            // Upload file to Supabase storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('Statement-Cycle')
                .upload(filePath, item.file, { upsert: true });

            if (uploadError) {
                console.error(`❌ File upload failed:`, uploadError);
                throw new Error(`File upload failed: ${uploadError.message}`);
            }

            console.log(`✅ File uploaded successfully:`, uploadData);

            // Store the path back into the item for database reference
            if (item.extractedData) {
                item.extractedData.pdf_path = uploadData.path;
            }

            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = { ...updated[itemIndex], uploadProgress: 35 };
                return updated;
            });

            // STEP 3: Get or create statement cycle with correct period and type
            console.log(`🔄 Getting/creating statement cycle for ${actualYear}/${actualMonth + 1} (type: ${actualStatementType})`);
            const cycleId = await getOrCreateStatementCycle(actualYear, actualMonth, actualStatementType);
            console.log(`✅ Statement cycle ID: ${cycleId}`);

            if (!cycleId) {
                throw new Error(`Failed to create or retrieve statement cycle for ${actualYear}/${actualMonth + 1}`);
            }

            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = { ...updated[itemIndex], uploadProgress: 50 };
                return updated;
            });

            // STEP 4: Check for existing statement with proper conflict resolution
            console.log(`🔍 Checking for existing statement...`);
            const { data: existingStatement, error: existingError } = await supabase
                .from('acc_cycle_bank_statements')
                .select('id, statement_type, statement_extractions')
                .eq('bank_id', item.matchedBank.id)
                .eq('statement_cycle_id', cycleId)
                .eq('statement_type', actualStatementType)
                .maybeSingle();

            if (existingError) {
                console.error(`❌ Error checking existing statement:`, existingError);
                throw new Error(`Database query failed: ${existingError.message}`);
            }

            console.log(`📋 Existing statement check result:`, existingStatement);

            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = { ...updated[itemIndex], uploadProgress: 65 };
                return updated;
            });

            // STEP 5: Prepare comprehensive statement data
            const statementData = {
                bank_id: item.matchedBank.id,
                company_id: item.matchedBank.company_id,
                statement_cycle_id: cycleId,
                statement_month: actualMonth,
                statement_year: actualYear,
                statement_type: actualStatementType,
                has_soft_copy: true,
                has_hard_copy: false,
                statement_document: {
                    statement_pdf: uploadData.path,
                    document_size: item.file.size,
                    password: item.passwordApplied ? item.appliedPassword : null,
                    extraction_metadata: item.extractedData?.processing_metadata || {},
                    user_period_input: item.userPeriodInput || null,
                    upload_timestamp: new Date().toISOString()
                },
                statement_extractions: {
                    ...item.extractedData,
                    // Ensure monthly_balances is properly formatted
                    monthly_balances: item.extractedData?.monthly_balances?.map(balance => ({
                        ...balance,
                        month: parseInt(balance.month),
                        year: parseInt(balance.year),
                        opening_balance: balance.opening_balance ? parseFloat(balance.opening_balance) : null,
                        closing_balance: balance.closing_balance ? parseFloat(balance.closing_balance) : null
                    })) || [],
                    enhanced_processing: true,
                    all_pages_analyzed: (item.extractedData?.total_pages_analyzed || 0) > 0,
                    upload_source: 'bulk_upload',
                    processing_timestamp: new Date().toISOString()
                },
                validation_status: {
                    is_validated: false,
                    validation_date: null,
                    validated_by: null,
                    mismatches: [],
                    extraction_confidence: item.extractedData?.extraction_confidence || 'MEDIUM',
                    requires_review: item.extractedData?.data_quality_issues?.length > 0
                },
                status: {
                    status: 'pending_validation',
                    assigned_to: null,
                    verification_date: null,
                    uploaded_by: 'bulk_upload_user', // Replace with actual user context
                    upload_method: 'bulk_upload'
                }
            };

            console.log(`💾 Prepared statement data for database:`, {
                ...statementData,
                statement_document: {
                    ...statementData.statement_document,
                    statement_pdf: '[FILE_PATH]'
                },
                statement_extractions: {
                    ...statementData.statement_extractions,
                    monthly_balances: `[${statementData.statement_extractions.monthly_balances?.length || 0} balances]`
                }
            });

            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = { ...updated[itemIndex], uploadProgress: 80 };
                return updated;
            });

            // STEP 6: Database operation with proper error handling
            let dbResult;
            if (existingStatement) {
                console.log(`🔄 Updating existing statement with ID: ${existingStatement.id}`);

                // Merge existing and new data intelligently
                const mergedExtractions = {
                    ...existingStatement.statement_extractions,
                    ...statementData.statement_extractions,
                    // Preserve any existing validated data
                    verified_balances: existingStatement.statement_extractions?.verified_balances || false,
                    vouched_at: existingStatement.statement_extractions?.vouched_at || null
                };

                const { data: updateResult, error: updateError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .update({
                        ...statementData,
                        statement_extractions: mergedExtractions,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingStatement.id)
                    .select();

                if (updateError) {
                    console.error(`❌ Update failed:`, updateError);
                    throw new Error(`Database update failed: ${updateError.message}`);
                }

                dbResult = updateResult;
                console.log(`✅ Statement updated successfully:`, updateResult);
            } else {
                console.log(`➕ Inserting new statement for ${actualMonth + 1}/${actualYear}`);

                const { data: insertResult, error: insertError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .insert([{
                        ...statementData,
                        created_at: new Date().toISOString()
                    }])
                    .select();

                if (insertError) {
                    console.error(`❌ Insert failed:`, insertError);
                    // Handle specific database constraint errors
                    if (insertError.code === '23505') {
                        throw new Error(`Statement already exists for this bank and period`);
                    }
                    throw new Error(`Database insert failed: ${insertError.message}`);
                }

                dbResult = insertResult;
                console.log(`✅ Statement inserted successfully:`, insertResult);
            }

            // STEP 7: Validate database operation result
            if (!dbResult || dbResult.length === 0) {
                throw new Error('Database operation completed but returned no data');
            }

            // STEP 8: Update UI state to reflect successful upload
            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = {
                    ...updated[itemIndex],
                    status: 'uploaded',
                    uploadProgress: 100,
                    error: undefined,
                    databaseId: dbResult[0]?.id,
                    actualPeriod: `${actualMonth + 1}/${actualYear}`,
                    uploadedAt: new Date().toISOString()
                };
                return updated;
            });

            console.log(`🎉 Upload completed successfully for ${item.file.name}:`, {
                fileName: item.file.name,
                databaseId: dbResult[0]?.id,
                actualPeriod: `${actualMonth + 1}/${actualYear}`,
                statementType: actualStatementType
            });

            return true;

        } catch (error) {
            console.error(`💥 Upload failed for item ${itemIndex}:`, {
                fileName: item.file.name,
                error: error.message,
                stack: error.stack
            });

            // Handle specific error types gracefully
            const errorMessage = error.message?.includes('duplicate key')
                ? 'Statement already exists for this period'
                : error.message || 'Unknown upload error';

            // Update UI to show failure state
            setUploadItems(prev => {
                const updated = [...prev];
                updated[itemIndex] = {
                    ...updated[itemIndex],
                    status: 'failed',
                    error: errorMessage,
                    uploadProgress: 0,
                    failedAt: new Date().toISOString()
                };
                return updated;
            });

            // Re-throw error for upstream handling
            throw new Error(`Upload failed for ${item.file.name}: ${errorMessage}`);
        }
    };

    // Company organization for vouching with enhanced metadata
    const organizeByCompany = () => {
        const validItems = uploadItems.filter(item =>
            item.status === 'matched' || item.status === 'uploaded' || item.status === 'vouched'
        );

        const groupedByCompany = validItems.reduce((groups, item) => {
            if (!item.matchedBank) return groups;

            const companyId = item.matchedBank.company_id;
            const companyName = item.matchedBank.company_name;

            let group = groups.find(g => g.companyId === companyId);

            if (!group) {
                group = {
                    companyId,
                    companyName,
                    isExpanded: false,
                    isVouched: false, // Will be calculated later
                    statements: []
                };
                groups.push(group);
            }

            // Avoid adding duplicates
            if (!group.statements.some(s => s.file.name === item.file.name)) {
                group.statements.push(item);
            }

            return groups;
        }, [] as CompanyGroup[]);

        // Now, calculate the `isVouched` status for each group and sort them
        groupedByCompany.forEach(group => {
            group.isVouched = group.statements.length > 0 && group.statements.every(s => s.isVouched);
        });

        // Sort groups: unvouched first, then alphabetically
        groupedByCompany.sort((a, b) => {
            if (a.isVouched && !b.isVouched) return 1;
            if (!a.isVouched && b.isVouched) return -1;
            return a.companyName.localeCompare(b.companyName);
        });

        const firstNonVouchedIndex = groupedByCompany.findIndex(g => !g.isVouched);
        if (firstNonVouchedIndex >= 0) {
            groupedByCompany[firstNonVouchedIndex].isExpanded = true;
        }

        setCompanyGroups(groupedByCompany);
    };

    const handleDialogClose = useCallback(() => {
        console.log(`🔄 Dialog closing - triggering comprehensive refresh`);

        // Clear all temporary state
        setUploadItems([]);
        setCompanyGroups([]);
        setCurrentStatementForDialog(null);
        setShowExtractionDialog(false);

        // Notify parent components
        onUploadsComplete();
        onClose();

        // Force immediate refresh of all related components
        setTimeout(() => {
            console.log(`🔄 Triggering delayed refresh for all views`);
            // onRefresh?.(); // If available   

            // Trigger a custom refresh event
            window.dispatchEvent(new CustomEvent('bankStatementsUpdated', {
                detail: { timestamp: Date.now() }
            }));
        }, 100);
    }, [onUploadsComplete, onClose]);

    // Event handlers
    const removeItem = (index: number) => {
        setUploadItems(items => items.filter((_, i) => i !== index))
    }

    const toggleCompanyExpansion = (companyId: number, forceOpen?: boolean) => {
        setCompanyGroups(prev => prev.map(group => ({
            ...group,
            isExpanded: group.companyId === companyId
                ? (forceOpen ?? !group.isExpanded)
                : false // Close others
        })));
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

    // FIX: Rewritten function to correctly prepare and show the extraction dialog
    const showStatementExtraction = (item: BulkUploadItem) => {
        if (!item) {
            toast({ title: 'Error', description: 'No item to view.', variant: 'destructive' });
            return;
        }

        try {
            setCurrentProcessingItem(item);

            // For unmatched/failed items, we need a placeholder bank object for the dialog
            const bankForDialog = item.matchedBank || {
                id: -1,
                bank_name: item.detectedBankName || item.extractedData?.bank_name || 'Unknown Bank',
                account_number: item.detectedAccountNumber || item.extractedData?.account_number || 'Unknown Account',
                bank_currency: item.extractedData?.currency || 'USD',
                company_id: -1,
                company_name: item.extractedData?.company_name || 'Unknown Company',
                acc_password: item.detectedPassword || ''
            };

            // Construct a mock statement object that BankExtractionDialog expects
            const mockStatement = {
                id: `temp-${item.file.name}`,
                bank_id: bankForDialog.id,
                statement_month: cycleMonth,
                statement_year: cycleYear,
                statement_type: item.statementType || 'monthly',
                quickbooks_balance: null,
                statement_document: {
                    statement_pdf: URL.createObjectURL(item.file), // Use a temporary blob URL
                    document_size: item.file.size,
                    password: item.appliedPassword,
                },
                statement_extractions: item.extractedData || {
                    bank_name: bankForDialog.bank_name,
                    account_number: bankForDialog.account_number,
                    currency: bankForDialog.bank_currency,
                    statement_period: '',
                    opening_balance: null,
                    closing_balance: null,
                    monthly_balances: [],
                },
                has_soft_copy: true,
                has_hard_copy: false,
                validation_status: {
                    is_validated: false,
                    validation_date: null,
                    validated_by: null,
                    mismatches: [],
                },
                status: {
                    status: item.status,
                    assigned_to: null,
                    verification_date: null,
                },
            };

            setCurrentStatementForDialog(mockStatement);
            setShowExtractionDialog(true);

        } catch (error) {
            console.error('Error in showStatementExtraction:', error);
            toast({
                title: 'Error Opening Statement',
                description: `Failed to open statement: ${error.message}`,
                variant: 'destructive'
            });
        }
    };

    // Auto-organize by company when moving to vouching tab or when items change
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
                        <DialogTitle className="text-center text-xl text-blue-800">Enhanced Bulk Upload Bank Statements</DialogTitle>
                        <p className="text-center text-blue-600 text-sm mt-1">
                            {format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')} - Intelligent Processing with All Pages Analysis
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
                                        <p className="text-xs text-gray-400 mt-1">Enhanced with all-pages processing, embeddings, and intelligent scenarios</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Button
                                        onClick={handleBulkExtraction}
                                        disabled={uploadItems.length === 0 || uploading}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <FileCheck className="h-4 w-4 mr-2" />
                                        Enhanced Extract ({uploadItems.filter(i => i.matchedBank).length})
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

                            {/* Enhanced file list table */}
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
                                                <TableHead>Confidence</TableHead>
                                                <TableHead>Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {uploadItems.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                        No files selected. Drop PDF files here for enhanced intelligent processing.
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
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`text-xs ${item.isFallbackMatch ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}
                                                                    >
                                                                        {item.isFallbackMatch ? '📋 Extracted' : '✅ Matched'} {item.matchedBank.company_name}
                                                                    </Badge>
                                                                )}
                                                                {item.detectedAccountNumber && (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        {item.detectedAccountNumber}
                                                                    </Badge>
                                                                )}
                                                                {item.matchConfidence > 0 && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {Math.round(item.matchConfidence * 100)}% confidence
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
                                                            {item.extractedData?.extraction_confidence && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`text-xs ${item.extractedData.extraction_confidence === 'HIGH' ? 'bg-green-50 text-green-700' :
                                                                        item.extractedData.extraction_confidence === 'MEDIUM' ? 'bg-yellow-50 text-yellow-700' :
                                                                            'bg-red-50 text-red-700'
                                                                        }`}
                                                                >
                                                                    {item.extractedData.extraction_confidence}
                                                                </Badge>
                                                            )}
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
                                <AlertTitle>Enhanced Intelligent Processing</AlertTitle>
                                <AlertDescription>
                                    All-pages analysis, document embeddings, intelligent scenario handling, smart bank matching,
                                    and enhanced range statement support with conflict resolution.
                                    Manual period input available for failed extractions.
                                </AlertDescription>
                            </Alert>
                        </div>
                    </TabsContent>

                    <TabsContent value="processing" className="flex-1 flex flex-col space-y-2 py-2 px-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center justify-between">
                                    Enhanced Processing Progress
                                    <Badge variant="outline">
                                        {uploading ? `Processing... (${overallProgress}%)` : 'Complete'}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>
                                    Intelligent processing {uploadItems.length} files with conflict resolution
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span>Overall Progress</span>
                                        <span>{overallProgress}%</span>
                                    </div>
                                    <Progress value={overallProgress} className="h-3" />

                                    {/* Real-time progress breakdown */}
                                    <div className="grid grid-cols-6 gap-2 text-center">
                                        <div className="p-2 bg-green-50 rounded-lg">
                                            <div className="text-lg font-bold text-green-600">
                                                {uploadItems.filter(i => i.status === 'uploaded').length}
                                            </div>
                                            <div className="text-xs text-green-600">Uploaded</div>
                                        </div>
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <div className="text-lg font-bold text-blue-600">
                                                {uploadItems.filter(i => i.status === 'processing').length}
                                            </div>
                                            <div className="text-xs text-blue-600">Processing</div>
                                        </div>
                                        <div className="p-2 bg-yellow-50 rounded-lg">
                                            <div className="text-lg font-bold text-yellow-600">
                                                {uploadItems.filter(i => i.status === 'matched').length}
                                            </div>
                                            <div className="text-xs text-yellow-600">Ready</div>
                                        </div>
                                        <div className="p-2 bg-red-50 rounded-lg">
                                            <div className="text-lg font-bold text-red-600">
                                                {uploadItems.filter(i => i.status === 'failed').length}
                                            </div>
                                            <div className="text-xs text-red-600">Failed</div>
                                        </div>
                                        <div className="p-2 bg-purple-50 rounded-lg">
                                            <div className="text-lg font-bold text-purple-600">
                                                {uploadItems.filter(i => i.passwordApplied).length}
                                            </div>
                                            <div className="text-xs text-purple-600">Unlocked</div>
                                        </div>
                                        <div className="p-2 bg-gray-50 rounded-lg">
                                            <div className="text-lg font-bold text-gray-600">
                                                {uploadItems.filter(i => i.status === 'pending').length}
                                            </div>
                                            <div className="text-xs text-gray-600">Pending</div>
                                        </div>
                                    </div>

                                    {/* Individual item progress */}
                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                        {uploadItems.map((item, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 border rounded">
                                                <div className="flex items-center space-x-2">
                                                    <FileText className="h-4 w-4" />
                                                    <span className="text-sm truncate max-w-48">
                                                        {item.file.name}
                                                    </span>
                                                    <Badge variant={
                                                        item.status === 'uploaded' ? 'default' :
                                                            item.status === 'processing' ? 'secondary' :
                                                                item.status === 'failed' ? 'destructive' : 'outline'
                                                    }>
                                                        {item.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Progress
                                                        value={item.uploadProgress || 0}
                                                        className="h-2 w-20"
                                                    />
                                                    <span className="text-xs w-8">
                                                        {item.uploadProgress || 0}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
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
                                            <TableHead className="text-xs">Confidence</TableHead>
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
                                                <TableCell className="text-xs">
                                                    {item.extractedData?.extraction_confidence && (
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-xs ${item.extractedData.extraction_confidence === 'HIGH' ? 'bg-green-50 text-green-700' :
                                                                item.extractedData.extraction_confidence === 'MEDIUM' ? 'bg-yellow-50 text-yellow-700' :
                                                                    'bg-red-50 text-red-700'
                                                                }`}
                                                        >
                                                            {item.extractedData.extraction_confidence}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs">{getStatusBadge(item.status)}</TableCell>
                                                <TableCell className="text-xs">
                                                    <div className="flex gap-1 flex-wrap">
                                                        {item.status === 'failed' && (
                                                            <div className="text-red-500 text-xs mb-1 w-full">{item.error}</div>
                                                        )}

                                                        {(item.status === 'unmatched' || item.status === 'failed') && (
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

                                                        {/* FIX: Always show View button to allow manual inspection */}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="bg-purple-50 text-purple-700 text-xs h-6"
                                                            onClick={() => showStatementExtraction(item)}
                                                        >
                                                            <Eye className="h-3 w-3 mr-1" />
                                                            View
                                                        </Button>
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

                    {/* VOUCHING TAB: This is where the primary fix is applied */}
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
                                    {/* Enhanced Global Vouch All Header */}
                                    <Card className="border-2 border-blue-200 bg-blue-50">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    <Building className="h-5 w-5 text-blue-600" />
                                                    Vouching Summary
                                                </CardTitle>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-sm text-blue-700">
                                                        {companyGroups.filter(g => g.isVouched).length} / {companyGroups.length} companies vouched
                                                    </div>
                                                    <Button
                                                        onClick={() => handleVouchAllCompanies()}
                                                        disabled={uploading || companyGroups.every(g => g.isVouched)}
                                                        className="bg-blue-600 hover:bg-blue-700 gap-2"
                                                        size="lg"
                                                    >
                                                        {uploading ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <CheckCircle className="h-4 w-4" />
                                                        )}
                                                        Vouch & Save All Companies
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-4 text-sm mt-2">
                                                <div className="bg-white p-2 rounded text-center">
                                                    <div className="font-bold text-lg text-blue-600">
                                                        {companyGroups.reduce((sum, g) => sum + g.statements.length, 0)}
                                                    </div>
                                                    <div className="text-blue-600">Total Statements</div>
                                                </div>
                                                <div className="bg-white p-2 rounded text-center">
                                                    <div className="font-bold text-lg text-green-600">
                                                        {companyGroups.reduce((sum, g) => sum + g.statements.filter(s => s.isVouched).length, 0)}
                                                    </div>
                                                    <div className="text-green-600">Vouched</div>
                                                </div>
                                                <div className="bg-white p-2 rounded text-center">
                                                    <div className="font-bold text-lg text-purple-600">
                                                        {companyGroups.reduce((sum, g) => sum + g.statements.filter(s => s.extractedData?.extraction_confidence === 'HIGH').length, 0)}
                                                    </div>
                                                    <div className="text-purple-600">High Confidence</div>
                                                </div>
                                                <div className="bg-white p-2 rounded text-center">
                                                    <div className="font-bold text-lg text-orange-600">
                                                        {companyGroups.reduce((sum, g) => sum + g.statements.filter(s => s.passwordApplied).length, 0)}
                                                    </div>
                                                    <div className="text-orange-600">Auto-Unlocked</div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>

                                    {/* Enhanced Collapsible Company Groups */}
                                    <div className="space-y-3">
                                        {companyGroups.map((group) => (
                                            <Collapsible
                                                key={group.companyId}
                                                open={group.isExpanded}
                                                onOpenChange={(open) => toggleCompanyExpansion(group.companyId, open)}
                                            >
                                                <Card className={`transition-all duration-200 ${group.isVouched
                                                    ? 'border-green-200 bg-green-50 shadow-sm'
                                                    : 'border-amber-200 bg-amber-50 shadow-md'
                                                    }`}>
                                                    <CollapsibleTrigger asChild>
                                                        <CardHeader className="cursor-pointer hover:bg-opacity-80 transition-colors pb-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex items-center gap-2">
                                                                        {group.isExpanded ? (
                                                                            <ChevronDown className="h-4 w-4 text-gray-500" />
                                                                        ) : (
                                                                            <ChevronRight className="h-4 w-4 text-gray-500" />
                                                                        )}
                                                                        <Building className="h-5 w-5 text-blue-600" />
                                                                    </div>
                                                                    <div>
                                                                        <CardTitle className="text-base">{group.companyName}</CardTitle>
                                                                        <div className="text-sm text-muted-foreground mt-1">
                                                                            {group.statements.length} statements •
                                                                            {group.statements.filter(s => s.statementType === 'range').length} range •
                                                                            {group.statements.filter(s => s.extractedData?.extraction_confidence === 'HIGH').length} high confidence
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-sm text-right">
                                                                        <div className="font-medium">
                                                                            {group.statements.filter(s => s.isVouched).length} / {group.statements.length} vouched
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            Total Value: {formatCurrency(
                                                                                group.statements.reduce((sum, s) =>
                                                                                    sum + (s.extractedData?.closing_balance || 0), 0
                                                                                ),
                                                                                group.statements[0]?.extractedData?.currency || 'USD'
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {group.isVouched ? (
                                                                        <Badge className="bg-green-100 text-green-800 gap-1">
                                                                            <CheckCircle className="h-3.5 w-3.5" />
                                                                            Vouched
                                                                        </Badge>
                                                                    ) : (
                                                                        <Button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleVouchCompany(group.companyId);
                                                                            }}
                                                                            disabled={uploading}
                                                                            className="bg-amber-600 hover:bg-amber-700 gap-1"
                                                                            size="sm"
                                                                        >
                                                                            <CheckCircle className="h-4 w-4" />
                                                                            Vouch & Save All
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </CardHeader>
                                                    </CollapsibleTrigger>

                                                    <CollapsibleContent>
                                                        <CardContent className="pt-0 pb-4">
                                                            <div className="border rounded-lg overflow-hidden">
                                                                <Table>
                                                                    <TableHeader className="bg-gray-50">
                                                                        <TableRow>
                                                                            <TableHead className="w-[50px]">
                                                                                <Checkbox
                                                                                    checked={group.statements.every(s => s.isVouched)}
                                                                                    indeterminate={group.statements.some(s => s.isVouched) && !group.statements.every(s => s.isVouched)}
                                                                                    onCheckedChange={(checked) => markCompanyVouched(group.companyId, !!checked)}
                                                                                />
                                                                            </TableHead>
                                                                            <TableHead>File Name</TableHead>
                                                                            <TableHead>Period</TableHead>
                                                                            <TableHead>Type</TableHead>
                                                                            <TableHead>Confidence</TableHead>
                                                                            <TableHead>Closing Balance</TableHead>
                                                                            <TableHead>QB Balance</TableHead>
                                                                            <TableHead>Difference</TableHead>
                                                                            <TableHead>Status</TableHead>
                                                                            <TableHead>Actions</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {group.statements.map((statement, idx) => (
                                                                            // FIX: Connect the new handlers to the component props
                                                                            <StatementRowComponent
                                                                                key={`${group.companyId}-${idx}-${statement.file.name}`}
                                                                                statement={statement}
                                                                                onVouchToggle={(vouched) => handleVouchStatement(statement, !!vouched)}
                                                                                onViewStatement={() => showStatementExtraction(statement)}
                                                                                onEditPeriod={() => handleEditPeriod(statement)}
                                                                                onBalanceUpdate={(field, value) => handleBalanceUpdate(statement, field, value)}
                                                                            />
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </CardContent>
                                                    </CollapsibleContent>
                                                </Card>
                                            </Collapsible>
                                        ))}
                                    </div>
                                </div>
                            )}
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

            {/* Enhanced Manual Period Input Dialog */}
            {showPeriodInputDialog && selectedItemForPeriod !== null && (
                <Dialog open={showPeriodInputDialog} onOpenChange={setShowPeriodInputDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Enhanced Period Input</DialogTitle>
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
                                <Alert className="mt-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription className="text-xs">
                                        Enhanced processing will apply intelligent scenario handling:
                                        <br />• Incomplete months will be marked as null
                                        <br />• Period adjustments will be tracked
                                        <br />• Manual input will be flagged for validation
                                    </AlertDescription>
                                </Alert>
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
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Apply Enhanced Period
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Enhanced BankExtractionDialog with sequential processing */}
            {showExtractionDialog && currentProcessingItem && currentStatementForDialog && (
                <BankExtractionDialog
                    isOpen={showExtractionDialog}
                    onClose={() => {
                        // Revoke the object URL to prevent memory leaks
                        if (currentStatementForDialog?.statement_document?.statement_pdf?.startsWith('blob:')) {
                            URL.revokeObjectURL(currentStatementForDialog.statement_document.statement_pdf);
                        }
                        setShowExtractionDialog(false);
                        setCurrentStatementForDialog(null);
                        setCurrentProcessingItem(null);
                    }}
                    bank={currentProcessingItem.matchedBank || {
                        id: -1,
                        bank_name: currentProcessingItem.detectedBankName || currentProcessingItem.extractedData?.bank_name || 'Unknown Bank',
                        account_number: currentProcessingItem.detectedAccountNumber || currentProcessingItem.extractedData?.account_number || 'Unknown Account',
                        bank_currency: currentProcessingItem.extractedData?.currency || 'USD',
                        company_id: -1,
                        company_name: currentProcessingItem.extractedData?.company_name || 'Unknown Company',
                        acc_password: currentProcessingItem.detectedPassword || ''
                    }}
                    statement={currentStatementForDialog}
                    onStatementUpdated={async (updatedStatement) => {
                        // When the user saves in the dialog, update the BulkUploadItem in our state
                        if (!updatedStatement) return;

                        const itemIndex = uploadItems.findIndex(item =>
                            item.file.name === currentProcessingItem?.file.name
                        );

                        if (itemIndex > -1) {
                            setUploadItems(prev => {
                                const newItems = [...prev];
                                const oldItem = newItems[itemIndex];
                                newItems[itemIndex] = {
                                    ...oldItem,
                                    extractedData: updatedStatement.statement_extractions,
                                    status: 'vouched', // Mark as vouched after saving
                                    isVouched: true
                                };
                                return newItems;
                            });

                            toast({
                                title: 'Statement Saved',
                                description: `${currentProcessingItem.file.name} has been reviewed and saved`,
                            });
                        }

                        // Clean up current dialog
                        if (currentStatementForDialog?.statement_document?.statement_pdf?.startsWith('blob:')) {
                            URL.revokeObjectURL(currentStatementForDialog.statement_document.statement_pdf);
                        }
                        setShowExtractionDialog(false);
                        setCurrentStatementForDialog(null);

                        // Check if this is part of sequential processing
                        if (currentStatementForDialog?._sequentialIndex !== undefined) {
                            const uploadedItems = uploadItems.filter(item => item.status === 'uploaded');
                            await proceedToNextItem(currentStatementForDialog._sequentialIndex, uploadedItems);
                        } else {
                            setCurrentProcessingItem(null);
                        }
                    }}
                    onStatementDeleted={() => {
                        // Handle deletion in sequential process
                        if (currentStatementForDialog?._sequentialIndex !== undefined) {
                            const uploadedItems = uploadItems.filter(item => item.status === 'uploaded');
                            proceedToNextItem(currentStatementForDialog._sequentialIndex, uploadedItems);
                        }
                        setShowExtractionDialog(false);
                    }}
                />
            )}

            {currentItemIndex >= 0 && (
                <Alert className="mt-4">
                    <FileText className="h-4 w-4" />
                    <AlertTitle>Sequential Processing Active</AlertTitle>
                    <AlertDescription>
                        Currently reviewing statement {currentItemIndex + 1} of {uploadItems.filter(i => i.status === 'uploaded').length}.
                        Please complete the review to automatically proceed to the next statement.
                    </AlertDescription>
                </Alert>
            )}
        </Dialog>
    )
}