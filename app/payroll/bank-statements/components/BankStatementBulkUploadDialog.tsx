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
import {
    getPdfDocument,
    processBulkExtraction,
    detectFileInfo,
    getOrCreateStatementCycle
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

    // Manual matching
    const [currentManualMatchItem, setCurrentManualMatchItem] = useState<number | null>(null);
    const [showBankSelectorDialog, setShowBankSelectorDialog] = useState<boolean>(false);

    // Password handling
    const [passwordProtectedFiles, setPasswordProtectedFiles] = useState<any[]>([]);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);

    // Batch processing
    const [batchProcessingQueue, setBatchProcessingQueue] = useState<number[]>([]);

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

    // OPTIMIZED: Batch file processing with enhanced password detection
    const processFileWithPasswordDetection = async (file: File, index: number): Promise<BulkUploadItem> => {
        const fileInfo = detectFileInfo(file.name);

        // Enhanced bank matching with multiple criteria
        let matchedBank = null;
        let matchConfidence = 0;

        // Try account number matching first (highest confidence)
        if (fileInfo.accountNumber) {
            matchedBank = safeBanks.find(bank =>
                bank.account_number.includes(fileInfo.accountNumber) ||
                fileInfo.accountNumber.includes(bank.account_number)
            );
            if (matchedBank) matchConfidence = 0.9;
        }

        // Try bank name matching if no account match
        if (!matchedBank && fileInfo.bankName) {
            matchedBank = safeBanks.find(bank =>
                bank.bank_name.toLowerCase().includes(fileInfo.bankName.toLowerCase()) ||
                fileInfo.bankName.toLowerCase().includes(bank.bank_name.toLowerCase())
            );
            if (matchedBank) matchConfidence = 0.7;
        }

        // Check password protection and auto-unlock
        let needsPassword = false;
        let passwordApplied = false;
        let appliedPassword = null;

        if (file.type === 'application/pdf') {
            needsPassword = await isPdfPasswordProtected(file);

            if (needsPassword) {
                // Priority: Bank password > Detected password
                const passwordsToTry = [
                    matchedBank?.acc_password,
                    fileInfo.password
                ].filter(Boolean);

                for (const password of passwordsToTry) {
                    if (await applyPasswordToFiles(file, password)) {
                        passwordApplied = true;
                        appliedPassword = password;
                        needsPassword = false;
                        break;
                    }
                }
            }
        }

        // Preliminary statement type detection from filename
        let preliminaryType: 'monthly' | 'range' = 'monthly';
        const fileName = file.name.toLowerCase();

        // Check filename for range indicators
        if (fileName.includes('quarter') || fileName.includes('q1') || fileName.includes('q2') ||
            fileName.includes('q3') || fileName.includes('q4') || fileName.includes('range') ||
            fileName.includes('multi') || fileName.includes('annual')) {
            preliminaryType = 'range';
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
            status: 'pending',
            extractedData: null,
            closingBalance: null,
            error: null,
            uploadProgress: 0,
            hasSoftCopy: true,
            hasHardCopy: false,
            statementType: preliminaryType // Will be updated after extraction
        };
    };

    // OPTIMIZED: Faster file selection with parallel processing
    const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        setUploading(true);

        try {
            // Process files in parallel for faster detection
            const processingPromises = fileArray.map((file, i) =>
                processFileWithPasswordDetection(file, uploadItems.length + i)
            );

            const newItems = await Promise.all(processingPromises);
            setUploadItems(prev => [...prev, ...newItems]);

            // Show auto-detection summary
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

    // OPTIMIZED: Bulk extraction using the utility function
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
            // Prepare batch files for bulk extraction
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

            console.log(`Starting bulk extraction for ${batchFiles.length} files`);

            // Use the optimized bulk extraction from utils
            const results = await processBulkExtraction(
                batchFiles,
                { month: cycleMonth, year: cycleYear },
                (progress) => {
                    setOverallProgress(Math.round(progress * 100));
                }
            );

            // Process results with enhanced type detection
            let matched = 0;
            let failed = 0;
            let monthlyCount = 0;
            let rangeCount = 0;

            results.forEach(result => {
                const itemIndex = result.index;

                if (result.success && result.extractedData) {
                    // Enhanced statement type detection
                    const detectedType = determineStatementType(result.extractedData);
                    const periodAnalysis = result.extractedData.statement_period ?
                        parseStatementPeriodAdvanced(result.extractedData.statement_period) : null;

                    console.log(`File ${itemIndex} detected as: ${detectedType}`, {
                        fileName: uploadItems[itemIndex]?.file?.name,
                        statementPeriod: result.extractedData.statement_period,
                        monthlyBalancesCount: result.extractedData.monthly_balances?.length || 0,
                        periodAnalysis: periodAnalysis?.reason
                    });

                    if (detectedType === 'monthly') monthlyCount++;
                    else rangeCount++;

                    setUploadItems(prev => {
                        const updated = [...prev];
                        updated[itemIndex] = {
                            ...updated[itemIndex],
                            status: 'matched',
                            extractedData: result.extractedData,
                            statementType: detectedType,
                            uploadProgress: 100
                        };
                        return updated;
                    });
                    matched++;
                } else {
                    setUploadItems(prev => {
                        const updated = [...prev];
                        updated[itemIndex] = {
                            ...updated[itemIndex],
                            status: 'failed',
                            error: result.error || 'Extraction failed',
                            uploadProgress: 0
                        };
                        return updated;
                    });
                    failed++;
                }
            });

            setTotalMatched(matched);
            setTotalUnmatched(failed);

            // Cleanup URLs
            batchFiles.forEach(file => URL.revokeObjectURL(file.fileUrl));

            toast({
                title: 'Bulk Extraction Complete',
                description: `${matched} successful (${monthlyCount} monthly, ${rangeCount} range), ${failed} failed`,
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

    const getMonthNumber = (monthName: string): number | null => {
        if (!monthName) return null;

        const monthLower = monthName.toLowerCase().trim();

        const monthMap: { [key: string]: number } = {
            // Full names
            'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
            'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
            // Abbreviations
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12,
            // Alternative abbreviations
            'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6,
            'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
        };

        // Direct lookup
        if (monthMap[monthLower]) {
            return monthMap[monthLower];
        }

        // Partial match (at least 3 characters)
        if (monthLower.length >= 3) {
            for (const [fullName, number] of Object.entries(monthMap)) {
                if (fullName.startsWith(monthLower)) {
                    return number;
                }
            }
        }

        return null;
    };

    const parseStatementPeriodAdvanced = (periodString: string): {
        isRange: boolean;
        startMonth?: number;
        startYear?: number;
        endMonth?: number;
        endYear?: number;
        reason?: string;
    } => {
        if (!periodString) return { isRange: false, reason: 'No period string' };

        const normalizedPeriod = periodString.trim().replace(/\s+/g, ' ').toLowerCase();
        console.log('Parsing period:', normalizedPeriod);

        // Pattern 1: Explicit range indicators
        const rangeKeywords = [
            'quarter', 'quarterly', 'q1', 'q2', 'q3', 'q4',
            'half year', 'semi-annual', 'annual', 'yearly'
        ];

        for (const keyword of rangeKeywords) {
            if (normalizedPeriod.includes(keyword)) {
                return { isRange: true, reason: `Contains range keyword: ${keyword}` };
            }
        }

        // Pattern 2: Date range formats "DD/MM/YYYY - DD/MM/YYYY"
        const dateRangePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(?:to|[-–—])\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
        const dateRangeMatch = normalizedPeriod.match(dateRangePattern);

        if (dateRangeMatch) {
            const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = dateRangeMatch;

            const startMonthNum = parseInt(startMonth, 10);
            const startYearNum = parseInt(startYear, 10);
            const endMonthNum = parseInt(endMonth, 10);
            const endYearNum = parseInt(endYear, 10);

            // Check if it spans multiple months or years
            if (startYearNum !== endYearNum || startMonthNum !== endMonthNum) {
                return {
                    isRange: true,
                    startMonth: startMonthNum,
                    startYear: startYearNum,
                    endMonth: endMonthNum,
                    endYear: endYearNum,
                    reason: 'Date range spans multiple months/years'
                };
            } else {
                return {
                    isRange: false,
                    startMonth: startMonthNum,
                    startYear: startYearNum,
                    endMonth: endMonthNum,
                    endYear: endYearNum,
                    reason: 'Date range within same month'
                };
            }
        }

        // Pattern 3: Month name ranges "January - March 2024" or "Jan to Mar 2024"
        const monthRangePattern = /(\w+)\s*(?:to|[-–—])\s*(\w+)\s+(\d{4})/;
        const monthRangeMatch = normalizedPeriod.match(monthRangePattern);

        if (monthRangeMatch) {
            const [, startMonthName, endMonthName, year] = monthRangeMatch;
            const startMonth = getMonthNumber(startMonthName.toLowerCase());
            const endMonth = getMonthNumber(endMonthName.toLowerCase());

            if (startMonth && endMonth && startMonth !== endMonth) {
                return {
                    isRange: true,
                    startMonth,
                    startYear: parseInt(year),
                    endMonth,
                    endYear: parseInt(year),
                    reason: `Month range: ${startMonthName} to ${endMonthName}`
                };
            }
        }

        // Pattern 4: Cross-year ranges "December 2023 - February 2024"
        const crossYearPattern = /(\w+)\s+(\d{4})\s*(?:to|[-–—])\s*(\w+)\s+(\d{4})/;
        const crossYearMatch = normalizedPeriod.match(crossYearPattern);

        if (crossYearMatch) {
            const [, startMonthName, startYear, endMonthName, endYear] = crossYearMatch;
            const startMonth = getMonthNumber(startMonthName.toLowerCase());
            const endMonth = getMonthNumber(endMonthName.toLowerCase());

            if (startMonth && endMonth) {
                const startYearNum = parseInt(startYear);
                const endYearNum = parseInt(endYear);

                if (startYearNum !== endYearNum || startMonth !== endMonth) {
                    return {
                        isRange: true,
                        startMonth,
                        startYear: startYearNum,
                        endMonth,
                        endYear: endYearNum,
                        reason: `Cross-year range: ${startMonthName} ${startYear} to ${endMonthName} ${endYear}`
                    };
                }
            }
        }

        // Pattern 5: Single month "January 2024" or "Jan 2024"
        const singleMonthPattern = /^(\w+)\s+(\d{4})$/;
        const singleMonthMatch = normalizedPeriod.match(singleMonthPattern);

        if (singleMonthMatch) {
            const [, monthName, year] = singleMonthMatch;
            const month = getMonthNumber(monthName.toLowerCase());

            if (month) {
                return {
                    isRange: false,
                    startMonth: month,
                    startYear: parseInt(year),
                    endMonth: month,
                    endYear: parseInt(year),
                    reason: `Single month: ${monthName} ${year}`
                };
            }
        }

        // Pattern 6: Same-month date ranges "01/01/2024 - 31/01/2024" (same month)
        const sameDatePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
        const allDates = [...normalizedPeriod.matchAll(sameDatePattern)];

        if (allDates.length >= 2) {
            const firstDate = allDates[0];
            const lastDate = allDates[allDates.length - 1];

            const firstMonth = parseInt(firstDate[2], 10);
            const firstYear = parseInt(firstDate[3], 10);
            const lastMonth = parseInt(lastDate[2], 10);
            const lastYear = parseInt(lastDate[3], 10);

            if (firstYear === lastYear && firstMonth === lastMonth) {
                return {
                    isRange: false,
                    startMonth: firstMonth,
                    startYear: firstYear,
                    endMonth: lastMonth,
                    endYear: lastYear,
                    reason: 'Same month date range'
                };
            } else {
                return {
                    isRange: true,
                    startMonth: firstMonth,
                    startYear: firstYear,
                    endMonth: lastMonth,
                    endYear: lastYear,
                    reason: 'Multi-month date range'
                };
            }
        }

        return { isRange: false, reason: 'No clear pattern detected, defaulting to monthly' };
    };


    // OPTIMIZED: Determine statement type from extracted data
    const determineStatementType = (extractedData: any): 'monthly' | 'range' => {
        if (!extractedData) return 'monthly';

        const monthlyBalances = extractedData.monthly_balances || [];
        const statementPeriod = extractedData.statement_period;

        console.log('Determining statement type:', {
            statementPeriod,
            monthlyBalancesCount: monthlyBalances.length,
            monthlyBalances: monthlyBalances.map(b => ({ month: b.month, year: b.year }))
        });

        // 1. Check monthly balances count (most reliable indicator)
        if (monthlyBalances.length > 1) {
            console.log('Detected RANGE statement: Multiple monthly balances found');
            return 'range';
        }

        // 2. Parse statement period for date range analysis
        if (statementPeriod) {
            const periodResult = parseStatementPeriodAdvanced(statementPeriod);
            if (periodResult.isRange) {
                console.log('Detected RANGE statement: Period spans multiple months');
                return 'range';
            }
        }

        console.log('Detected MONTHLY statement: Single month or same-month period');
        return 'monthly';
    };

    // OPTIMIZED: Fast validation
    const validateExtractedData = (extracted: any, bank: Bank | null) => {
        const mismatches: string[] = [];

        if (!bank) {
            mismatches.push('No bank matched');
            return { isValid: false, mismatches };
        }

        // Quick validation checks
        if (extracted.bank_name && !extracted.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())) {
            mismatches.push('Bank name mismatch');
        }

        if (extracted.account_number && !extracted.account_number.includes(bank.account_number)) {
            mismatches.push('Account number mismatch');
        }

        if (extracted.currency && normalizeCurrencyCode(extracted.currency) !== normalizeCurrencyCode(bank.bank_currency)) {
            mismatches.push('Currency mismatch');
        }

        return { isValid: mismatches.length === 0, mismatches };
    };

    // OPTIMIZED: Bulk upload to database
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
            // Get or create appropriate cycles
            const cyclePromises = itemsToUpload.map(async (item) => {
                const statementType = item.statementType || 'monthly';
                return await getOrCreateStatementCycle(cycleYear, cycleMonth, statementType);
            });

            const cycleIds = await Promise.all(cyclePromises);

            // Upload files in parallel batches
            const BATCH_SIZE = 5;
            const batches = [];

            for (let i = 0; i < itemsToUpload.length; i += BATCH_SIZE) {
                batches.push(itemsToUpload.slice(i, i + BATCH_SIZE));
            }

            let uploadedCount = 0;

            for (const batch of batches) {
                const uploadPromises = batch.map(async (item, batchIndex) => {
                    const itemIndex = uploadItems.indexOf(item);
                    const globalIndex = batches.indexOf(batch) * BATCH_SIZE + batchIndex;
                    const cycleId = cycleIds[globalIndex];

                    try {
                        // Upload file
                        const fileName = `bulk_${item.matchedBank.company_id}_${item.matchedBank.id}_${cycleYear}_${cycleMonth}_${Date.now()}.pdf`;
                        const filePath = `statement_documents/${cycleYear}/${cycleMonth + 1}/${item.matchedBank.company_id}/${fileName}`;

                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('Statement-Cycle')
                            .upload(filePath, item.file, { upsert: true });

                        if (uploadError) throw uploadError;

                        // Create statement record
                        const statementData = {
                            bank_id: item.matchedBank.id,
                            company_id: item.matchedBank.company_id,
                            statement_cycle_id: cycleId,
                            statement_month: cycleMonth,
                            statement_year: cycleYear,
                            statement_type: item.statementType || 'monthly',
                            has_soft_copy: item.hasSoftCopy || true,
                            has_hard_copy: item.hasHardCopy || false,
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

                        // Update status
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

                // Update progress
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

        // Auto-expand first non-vouched group
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
                            {format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')} - Optimized for Speed
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
                                        <p className="text-xs text-gray-400 mt-1">Auto-detection and parallel processing enabled</p>
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
                                <AlertTitle>Optimized Bulk Processing</AlertTitle>
                                <AlertDescription>
                                    Parallel file processing, auto-password detection, smart bank matching, and bulk extraction for maximum speed.
                                    Support for both monthly and range statements with automatic type detection.
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
                                    Bulk processing {uploadItems.length} files with enhanced speed optimizations
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
                                            <div className="text-xs text-yellow-600">Unmatched</div>
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
                                                    {item.status === 'failed' && (
                                                        <div className="text-red-500 text-xs">{item.error}</div>
                                                    )}
                                                    {item.status === 'unmatched' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="bg-green-50 text-green-700 text-xs h-6"
                                                            onClick={() => {
                                                                setCurrentManualMatchItem(index);
                                                                setShowBankSelectorDialog(true);
                                                            }}
                                                        >
                                                            Match
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
                                                    <Building className="h-4 w-4 text-blue-600" />
                                                    <span className="font-medium">{group.companyName}</span>
                                                    <Badge variant="outline">
                                                        {group.statements.length} statements
                                                    </Badge>
                                                    <Badge variant="secondary">
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
                                                            Pending
                                                        </Badge>
                                                    )}
                                                </div>
                                            </CollapsibleTrigger>

                                            <CollapsibleContent className="p-3">
                                                <div className="grid gap-3">
                                                    {group.statements.map((statement, idx) => (
                                                        <div key={idx} className="border rounded-md p-3 bg-white">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <FileText className="h-4 w-4 text-blue-600" />
                                                                    <span className="font-medium text-sm">{statement.file.name}</span>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {statement.statementType || 'monthly'}
                                                                    </Badge>
                                                                    {statement.passwordApplied && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            <Lock className="h-3 w-3 mr-1" />
                                                                            Auto-unlocked
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {getStatusBadge(statement.status)}
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                                <div>
                                                                    <p><span className="font-medium">Bank:</span> {statement.extractedData?.bank_name || 'Not detected'}</p>
                                                                    <p><span className="font-medium">Account:</span> {statement.extractedData?.account_number || 'Not detected'}</p>
                                                                    <p><span className="font-medium">Period:</span> {statement.extractedData?.statement_period || 'Current month'}</p>
                                                                </div>
                                                                <div>
                                                                    <p><span className="font-medium">Opening:</span> {formatCurrency(statement.extractedData?.opening_balance, statement.extractedData?.currency || 'USD')}</p>
                                                                    <p><span className="font-medium">Closing:</span> {formatCurrency(statement.extractedData?.closing_balance, statement.extractedData?.currency || 'USD')}</p>
                                                                    <p><span className="font-medium">Currency:</span> {statement.extractedData?.currency || 'USD'}</p>
                                                                </div>
                                                            </div>

                                                            <div className="mt-3 flex justify-between items-center">
                                                                <div className="flex items-center space-x-2">
                                                                    <Checkbox
                                                                        id={`vouched-${idx}`}
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
                                                                    <Label htmlFor={`vouched-${idx}`} className="text-sm">
                                                                        Verified and vouched
                                                                    </Label>
                                                                </div>

                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        toast({
                                                                            title: "Statement Preview",
                                                                            description: `Viewing ${statement.file.name}`,
                                                                        });
                                                                    }}
                                                                >
                                                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                                                    View
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex justify-end pt-3 mt-3 border-t">
                                                    <Button
                                                        variant={group.isVouched ? "outline" : "default"}
                                                        onClick={() => markCompanyVouched(group.companyId, !group.isVouched)}
                                                        className={group.isVouched ? "" : "bg-purple-600 hover:bg-purple-700"}
                                                    >
                                                        {group.isVouched ? (
                                                            <>
                                                                <X className="h-4 w-4 mr-2" />
                                                                Unmark as Vouched
                                                            </>
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
                                                    status: 'matched'
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
        </Dialog>
    )
}