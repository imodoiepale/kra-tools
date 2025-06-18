// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Loader2, Upload, AlertTriangle, UploadCloud, FileText, Building,
    CreditCard, DollarSign, Sheet, Landmark, Calendar, Check, X,
    Lock, CheckCircle
} from 'lucide-react';
import { BankValidationDialog } from './BankValidationDialog';
import {
    performBankStatementExtraction,
    generateMonthRange,
    parseStatementPeriod,
    getPdfDocument,
    detectPasswordFromFilename
} from '@/lib/bankExtractionUtils';
import { detectFileInfo } from '../utils/fileDetectionUtils';
import { ExtractionsService } from '@/lib/services/extractionService';

// --- Interfaces & Types ---
interface Bank {
    id: number;
    bank_name: string;
    account_number: string;
    bank_currency: string;
    company_id: number;
    company_name: string;
    acc_password?: string;
}

interface BankStatement {
    id: string;
    has_soft_copy: boolean;
    has_hard_copy: boolean;
    statement_document: {
        statement_pdf: string | null;
        statement_excel: string | null;
        document_size?: number;
        document_type?: string;
        password?: string | null;
    };
    statement_extractions: any;
    validation_status: any;
    status: any;
    statement_month?: number;
    statement_year?: number;
}

interface ValidationResult {
    isValid: boolean;
    mismatches: string[];
    extractedData: any;
    monthlyBalances?: Array<{
        month: number;
        year: number;
        opening_balance: number | null;
        closing_balance: number | null;
        statement_page: number;
        is_verified: boolean;
    }>;
}

interface BankStatementUploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    bank: Bank;
    cycleMonth: number;
    cycleYear: number;
    onStatementUploaded: (statement: BankStatement) => void;
    existingStatement: BankStatement | null;
    statementCycleId: string | null;
    onOpenExtractionDialog?: (statement: BankStatement) => void;
}

// --- Utility Functions ---

// Fixed date validation function
const isValidDate = (dateValue: any): boolean => {
    if (!dateValue) return false;

    if (dateValue instanceof Date) {
        return !isNaN(dateValue.getTime());
    }

    // Try to parse as string
    if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        return !isNaN(parsed.getTime());
    }

    return false;
};

// Fixed safe date creation function
const createSafeDate = (year: number, month: number, day: number = 1): Date | null => {
    try {
        // Validate inputs
        if (!year || !month || year < 1900 || year > 2100 || month < 1 || month > 12) {
            console.error('Invalid date parameters:', { year, month, day });
            return null;
        }

        // Create date (month is 0-indexed in Date constructor)
        const date = new Date(year, month - 1, day);

        // Verify the date was created correctly
        if (date.getFullYear() !== year || date.getMonth() !== (month - 1)) {
            console.error('Date creation resulted in different values:', {
                expected: { year, month, day },
                actual: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
            });
            return null;
        }

        return date;
    } catch (error) {
        console.error('Error creating date:', error, { year, month, day });
        return null;
    }
};

// Enhanced period parsing with better error handling
const parseStatementPeriodSafe = (periodString: string) => {
    if (!periodString || typeof periodString !== 'string') {
        return null;
    }

    console.log('Parsing statement period:', periodString);

    try {
        // Clean the period string
        const normalizedPeriod = periodString.trim().replace(/\s+/g, ' ');

        // Pattern 1: Date range format "01/01/2024 - 30/07/2024"
        const dateRangePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–—]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/;
        const dateRangeMatch = normalizedPeriod.match(dateRangePattern);

        if (dateRangeMatch) {
            const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = dateRangeMatch;

            const startMonthNum = parseInt(startMonth, 10);
            const startYearNum = parseInt(startYear, 10);
            const endMonthNum = parseInt(endMonth, 10);
            const endYearNum = parseInt(endYear, 10);

            // Validate parsed values
            if (startMonthNum >= 1 && startMonthNum <= 12 &&
                endMonthNum >= 1 && endMonthNum <= 12 &&
                startYearNum > 1900 && endYearNum > 1900) {

                return {
                    startMonth: startMonthNum,
                    startYear: startYearNum,
                    endMonth: endMonthNum,
                    endYear: endYearNum
                };
            }
        }

        // Pattern 2: Single month format "January 2024"
        const singleMonthMatch = normalizedPeriod.match(/^(\w+)\s+(\d{4})$/i);
        if (singleMonthMatch) {
            const monthName = singleMonthMatch[1].toLowerCase();
            const year = parseInt(singleMonthMatch[2], 10);

            const monthNumber = getMonthNumber(monthName);
            if (monthNumber && year > 1900) {
                return {
                    startMonth: monthNumber,
                    startYear: year,
                    endMonth: monthNumber,
                    endYear: year
                };
            }
        }

        // Pattern 3: Month range same year "January - March 2024"
        const sameYearMatch = normalizedPeriod.match(/(\w+)\s*[-–—]\s*(\w+)\s+(\d{4})/i);
        if (sameYearMatch) {
            const startMonthName = sameYearMatch[1].toLowerCase();
            const endMonthName = sameYearMatch[2].toLowerCase();
            const year = parseInt(sameYearMatch[3], 10);

            const startMonth = getMonthNumber(startMonthName);
            const endMonth = getMonthNumber(endMonthName);

            if (startMonth && endMonth && year > 1900) {
                return {
                    startMonth,
                    startYear: year,
                    endMonth,
                    endYear: year
                };
            }
        }

        console.warn('Could not parse statement period:', periodString);
        return null;

    } catch (error) {
        console.error('Error parsing statement period:', error, periodString);
        return null;
    }
};

// Helper function to convert month names to numbers
const getMonthNumber = (monthName: string): number | null => {
    if (!monthName) return null;

    const monthLower = monthName.toLowerCase().trim();

    const fullMonths = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];

    const abbrevMonths = [
        'jan', 'feb', 'mar', 'apr', 'may', 'jun',
        'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];

    const fullIndex = fullMonths.indexOf(monthLower);
    if (fullIndex !== -1) {
        return fullIndex + 1;
    }

    const abbrevIndex = abbrevMonths.indexOf(monthLower);
    if (abbrevIndex !== -1) {
        return abbrevIndex + 1;
    }

    // Try partial matches
    if (monthLower.length >= 3) {
        for (let i = 0; i < fullMonths.length; i++) {
            if (fullMonths[i].startsWith(monthLower)) {
                return i + 1;
            }
        }
    }

    return null;
};

// --- Main Component ---
export function BankStatementUploadDialog({
    isOpen,
    onClose,
    bank,
    cycleMonth,
    cycleYear,
    onStatementUploaded,
    existingStatement,
    statementCycleId,
    onOpenExtractionDialog
}: BankStatementUploadDialogProps) {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [hasSoftCopy, setHasSoftCopy] = useState<boolean>(true);
    const [hasHardCopy, setHasHardCopy] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [showValidationDialog, setShowValidationDialog] = useState<boolean>(false);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [extractionResults, setExtractionResults] = useState<any>(null);
    const [validationResults, setValidationResults] = useState<{ isValid: boolean, mismatches: string[] } | null>(null);

    // Password detection state
    const [detectedPassword, setDetectedPassword] = useState<string>('');
    const [detectedAccountNumber, setDetectedAccountNumber] = useState<string>('');
    const [autoPasswordApplied, setAutoPasswordApplied] = useState<boolean>(false);
    const [pdfNeedsPassword, setPdfNeedsPassword] = useState<boolean>(false);
    const [password, setPassword] = useState<string>('');
    const [passwordApplied, setPasswordApplied] = useState<boolean>(false);
    const [applyingPassword, setApplyingPassword] = useState<boolean>(false);

    const pdfInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setPdfFile(null);
            setExcelFile(null);
            setValidationResult(null);
            setDetectedPassword('');
            setDetectedAccountNumber('');
            setAutoPasswordApplied(false);
            setPdfNeedsPassword(false);
            setPassword('');
            setPasswordApplied(false);
            setHasSoftCopy(existingStatement?.has_soft_copy ?? true);
            setHasHardCopy(existingStatement?.has_hard_copy ?? false);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
        }
    }, [isOpen, existingStatement]);

    // Fixed statement period checking function
    const checkStatementPeriod = (extractedData: any): { isValid: boolean; message: string } => {
        try {
            if (!extractedData.statement_period) {
                return { isValid: true, message: 'No statement period found in document' };
            }

            const period = parseStatementPeriodSafe(extractedData.statement_period);
            if (!period) {
                return { isValid: true, message: 'Could not parse statement period' };
            }

            // Create safe dates for comparison
            const expectedDate = createSafeDate(cycleYear, cycleMonth + 1); // cycleMonth is 0-indexed
            const statementStartDate = createSafeDate(period.startYear, period.startMonth);
            const statementEndDate = createSafeDate(period.endYear, period.endMonth);

            if (!expectedDate || !statementStartDate || !statementEndDate) {
                console.error('Failed to create valid dates for comparison');
                return { isValid: true, message: 'Could not validate dates' };
            }

            // Check if the expected date falls within the statement period
            const isWithinPeriod = expectedDate >= statementStartDate && expectedDate <= statementEndDate;

            if (!isWithinPeriod) {
                const formatOptions = { month: 'short', year: 'numeric' } as const;
                const statementPeriodText = period.startMonth === period.endMonth && period.startYear === period.endYear
                    ? statementStartDate.toLocaleDateString('en-US', formatOptions)
                    : `${statementStartDate.toLocaleDateString('en-US', formatOptions)} to ${statementEndDate.toLocaleDateString('en-US', formatOptions)}`;

                const expectedText = expectedDate.toLocaleDateString('en-US', formatOptions);

                return {
                    isValid: false,
                    message: `Statement period (${statementPeriodText}) does not include selected period (${expectedText})`
                };
            }

            return { isValid: true, message: 'Period matches' };

        } catch (error) {
            console.error('Error in checkStatementPeriod:', error);
            return { isValid: true, message: 'Error validating period, proceeding anyway' };
        }
    };

    // Enhanced file selection with automatic password detection
    const handleFileSelection = async (selectedFile: File, fileType: 'pdf' | 'excel') => {
        if (fileType === 'pdf') {
            setPdfFile(selectedFile);

            // Auto-detect file information
            const fileInfo = detectFileInfo(selectedFile.name);
            console.log('Detected file info:', fileInfo);

            if (fileInfo.password) {
                setDetectedPassword(fileInfo.password);
            }
            if (fileInfo.accountNumber) {
                setDetectedAccountNumber(fileInfo.accountNumber);
            }

            try {
                // Check if PDF is password protected
                const isProtected = selectedFile.type === 'application/pdf' ?
                    await isPdfPasswordProtected(selectedFile) : false;
                setPdfNeedsPassword(isProtected);

                if (isProtected) {
                    console.log('PDF is password protected. Attempting automatic password application.');

                    // Try bank password first
                    if (bank?.acc_password) {
                        console.log('Trying bank stored password');
                        const bankPassword = detectPasswordFromFilename(bank.acc_password);

                        if (bankPassword) {
                            setPassword(bankPassword);
                            setPasswordApplied(true);
                            setAutoPasswordApplied(true);
                            setPdfNeedsPassword(false);
                            toast({
                                title: "Success",
                                description: "Bank's stored password detected from filename",
                            });
                            return;
                        }
                    }

                    // Try detected password if bank password failed
                    if (fileInfo?.password) {
                        console.log('Trying detected password:', fileInfo.password);
                        const detectedPassword = detectPasswordFromFilename(fileInfo.password);

                        if (detectedPassword) {
                            setPassword(detectedPassword);
                            setPasswordApplied(true);
                            setAutoPasswordApplied(true);
                            setPdfNeedsPassword(false);
                            toast({
                                title: "Success",
                                description: "Password detected from filename",
                            });
                            return;
                        }
                    }

                    // If no automatic password worked
                    toast({
                        title: "Password Required",
                        description: "This PDF is password protected. Please enter the password manually.",
                        variant: "warning"
                    });
                }
            } catch (error) {
                console.error('Error handling PDF password:', error);
            }
        } else if (fileType === 'excel') {
            setExcelFile(selectedFile);
        }
    };

    // Validate extracted data against bank information
    const validateExtractedData = (extractedData: any): { isValid: boolean; mismatches: string[] } => {
        const mismatches: string[] = [];

        // Bank name validation
        if (extractedData.bank_name && bank.bank_name) {
            const extractedBankLower = extractedData.bank_name.toLowerCase();
            const bankNameLower = bank.bank_name.toLowerCase();
            if (!extractedBankLower.includes(bankNameLower) && !bankNameLower.includes(extractedBankLower)) {
                mismatches.push(`Bank name mismatch: Expected "${bank.bank_name}", found "${extractedData.bank_name}"`);
            }
        }

        // Account number validation
        if (extractedData.account_number && bank.account_number) {
            if (!extractedData.account_number.includes(bank.account_number) &&
                !bank.account_number.includes(extractedData.account_number)) {
                mismatches.push(`Account number mismatch: Expected "${bank.account_number}", found "${extractedData.account_number}"`);
            }
        }

        // Currency validation
        if (extractedData.currency && bank.bank_currency) {
            const normalizeCurrency = (currency: string) => currency.toUpperCase().replace(/[^A-Z]/g, '');
            if (normalizeCurrency(extractedData.currency) !== normalizeCurrency(bank.bank_currency)) {
                mismatches.push(`Currency mismatch: Expected "${bank.bank_currency}", found "${extractedData.currency}"`);
            }
        }

        return {
            isValid: mismatches.length === 0,
            mismatches
        };
    };

    const handleUpload = async (forceProceed = false): Promise<BankStatement | null> => {
        if (!pdfFile && !existingStatement) {
            toast({ title: 'File Missing', description: 'Please select a PDF file.', variant: 'destructive' });
            return null;
        }
        setIsProcessing(true);
        setStatusMessage('Starting...');

        try {
            let currentValidationResult = validationResult;

            // Step 1: Extract & Validate ONLY if a new file exists and hasn't been validated yet
            if (pdfFile) {
                setStatusMessage('Extracting data...');

                // Use ExtractionsService for consistency
                const extractionResults = await ExtractionsService.getExtraction(pdfFile, {
                    month: cycleMonth,
                    year: cycleYear,
                    password: passwordApplied ? password : null,
                    forceAiExtraction: true
                });

                setExtractionResults(extractionResults);

                if (!extractionResults.success) {
                    if (extractionResults.requiresPassword && !passwordApplied) {
                        setPdfNeedsPassword(true);
                        toast({
                            title: "Password Required",
                            description: "This PDF requires a password for extraction",
                            variant: "warning"
                        });
                        setIsProcessing(false);
                        return null;
                    }
                    throw new Error(extractionResults.message || 'Failed to extract data.');
                }

                // Use bank name from DB if account number matches
                const extractedData = { ...extractionResults.extractedData };
                if (extractedData.account_number && extractedData.account_number === bank.account_number) {
                    extractedData.bank_name = bank.bank_name;
                }

                // Check statement period with improved error handling
                const periodCheck = checkStatementPeriod(extractedData);
                if (!periodCheck.isValid) {
                    setStatusMessage('Period mismatch detected');
                    const expectedPeriod = createSafeDate(cycleYear, cycleMonth + 1);
                    const expectedText = expectedPeriod ? expectedPeriod.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `${cycleMonth + 1}/${cycleYear}`;

                    const confirm = window.confirm(`${periodCheck.message}. Do you want to continue with the selected period (${expectedText})?`);
                    if (!confirm) {
                        setIsProcessing(false);
                        return null;
                    }
                }

                // Validate extracted data
                const validationCheck = validateExtractedData(extractedData);

                currentValidationResult = {
                    isValid: validationCheck.isValid && periodCheck.isValid,
                    mismatches: [
                        ...validationCheck.mismatches,
                        ...(periodCheck.isValid ? [] : [periodCheck.message])
                    ],
                    extractedData
                };
                setValidationResult(currentValidationResult);
                setValidationResults(validationCheck);
            }

            // Step 2: If validation issues exist and we are NOT forcing, show the dialog
            if (currentValidationResult && !currentValidationResult.isValid && !forceProceed) {
                setShowValidationDialog(true);
                setIsProcessing(false);
                return null;
            }

            // Step 3: Upload files and save data
            setStatusMessage('Uploading files...');
            let pdfPath = existingStatement?.statement_document?.statement_pdf || null;
            let documentSize = existingStatement?.statement_document?.document_size || 0;

            if (pdfFile) {
                const filePath = `statement_documents/${cycleYear}/${cycleMonth + 1}/${bank.company_id}/bank_${bank.id}_${Date.now()}.pdf`;
                const { data, error } = await supabase.storage.from('Statement-Cycle').upload(filePath, pdfFile, { upsert: true });
                if (error) throw error;
                pdfPath = data.path;
                documentSize = pdfFile.size;
            }

            setStatusMessage('Saving statement...');
            const dataToSave = {
                id: existingStatement?.id,
                bank_id: bank.id,
                company_id: bank.company_id,
                statement_cycle_id: statementCycleId,
                statement_month: cycleMonth,
                statement_year: cycleYear,
                has_soft_copy: hasSoftCopy,
                has_hard_copy: hasHardCopy,
                statement_document: {
                    statement_pdf: pdfPath,
                    document_size: documentSize,
                    password: passwordApplied ? password : null
                },
                statement_extractions: currentValidationResult?.extractedData || existingStatement?.statement_extractions || {},
                validation_status: currentValidationResult ? {
                    is_validated: currentValidationResult.isValid,
                    mismatches: currentValidationResult.mismatches,
                    validation_date: new Date().toISOString()
                } : (existingStatement?.validation_status || {}),
                status: { ...existingStatement?.status, status: 'pending_validation' }
            };

            const { data: upsertedStatement, error } = await supabase
                .from('acc_cycle_bank_statements')
                .upsert(dataToSave, { onConflict: 'id' })
                .select()
                .single();
            if (error) throw error;

            toast({ title: 'Success', description: 'Bank statement processed successfully.' });
            onStatementUploaded(upsertedStatement);

            // Auto-open extraction dialog if callback provided
            if (onOpenExtractionDialog && currentValidationResult?.extractedData) {
                onOpenExtractionDialog(upsertedStatement);
            }

            onClose();
            return upsertedStatement;

        } catch (error) {
            console.error('Upload error:', error);
            toast({ title: 'Upload Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
        return null;
    };

    // Password checking functions (implement these based on your PDF library)
    const isPdfPasswordProtected = async (file: File): Promise<boolean> => {
        try {
            const result = await getPdfDocument(file);
            return result.requiresPassword || false;
        } catch (error) {
            console.error('Error checking PDF password protection:', error);
            return false;
        }
    };

    const applyPasswordToFiles = async (file: File, password: string): Promise<boolean> => {
        try {
            const result = await getPdfDocument(file, password);
            return result.success;
        } catch (error) {
            console.error('Error applying password to PDF:', error);
            return false;
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <div className="bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50 -mx-6 -mt-6 p-6 rounded-t-lg border-b border-blue-200">
                            <div className="mb-2 flex justify-center">
                                <div className="h-14 w-14 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shadow-sm">
                                    <UploadCloud className="h-7 w-7 text-blue-600" />
                                </div>
                            </div>
                            <DialogTitle className="text-center text-xl text-blue-800">Upload Bank Statement</DialogTitle>
                            <p className="text-center text-blue-600 text-sm mt-1">{bank.company_name}</p>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 py-4 mt-2">
                        {/* Info Section */}
                        <div className="bg-gradient-to-r from-blue-50/80 to-blue-50/40 rounded-md p-4 border border-blue-100 shadow-sm">
                            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                                <div className="col-span-3">
                                    <h3 className="text-sm font-medium text-blue-800 border-b border-blue-100 pb-1 mb-2">Company Information</h3>
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4 text-blue-600" />
                                        <span className="font-medium">{bank.company_name}</span>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-blue-800 border-b border-blue-100 pb-1 mb-2">Bank Details</h3>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <Landmark className="h-4 w-4 text-blue-600" />
                                            <span className="font-medium">{bank.bank_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="h-4 w-4 text-blue-600" />
                                            <span className="font-mono text-xs">{bank.account_number}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-blue-800 border-b border-blue-100 pb-1 mb-2">Currency</h3>
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-blue-600" />
                                        <span className="font-medium">{bank.bank_currency}</span>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-blue-800 border-b border-blue-100 pb-1 mb-2">Statement Period</h3>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-blue-600" />
                                        <span className="font-medium">
                                            {(() => {
                                                const date = createSafeDate(cycleYear, cycleMonth + 1);
                                                return date ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `${cycleMonth + 1}/${cycleYear}`;
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* File Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="pdf-file" className="flex items-center gap-1.5">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                    Bank Statement PDF
                                </Label>
                                <Input
                                    id="pdf-file"
                                    ref={pdfInputRef}
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            handleFileSelection(file, 'pdf');
                                        }
                                        setValidationResult(null);
                                    }}
                                    disabled={isProcessing}
                                    className="cursor-pointer file:bg-blue-50 file:text-blue-700 file:border-blue-200 hover:file:bg-blue-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="excel-file" className="flex items-center gap-1.5">
                                    <Sheet className="h-4 w-4 text-emerald-600" />
                                    Bank Statement Excel (Optional)
                                </Label>
                                <Input
                                    id="excel-file"
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            handleFileSelection(file, 'excel');
                                        }
                                    }}
                                    disabled={isProcessing}
                                    className="cursor-pointer file:bg-emerald-50 file:text-emerald-700 file:border-emerald-200 hover:file:bg-emerald-100"
                                />
                            </div>
                        </div>

                        {/* File Analysis Section */}
                        {pdfFile && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <h4 className="text-sm font-medium mb-2">File Analysis</h4>

                                {detectedPassword && (
                                    <div className="flex items-center mb-2">
                                        <Badge variant="outline" className="mr-2">
                                            Password Detected: {detectedPassword}
                                        </Badge>
                                        {autoPasswordApplied && (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        )}
                                    </div>
                                )}

                                {detectedAccountNumber && (
                                    <div className="flex items-center mb-2">
                                        <Badge variant="outline">
                                            Account: {detectedAccountNumber}
                                        </Badge>
                                        {bank && detectedAccountNumber.includes(bank.account_number) && (
                                            <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                                        )}
                                    </div>
                                )}

                                {pdfNeedsPassword && !passwordApplied && (
                                    <Alert className="mt-2">
                                        <Lock className="h-4 w-4" />
                                        <AlertTitle>Password Protection Detected</AlertTitle>
                                        <AlertDescription>
                                            This PDF is password protected. Please enter the password below.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}

                        {/* Manual Password Input */}
                        {pdfNeedsPassword && !passwordApplied && (
                            <div className="mt-4">
                                <Label htmlFor="pdf-password">PDF Password</Label>
                                <div className="flex gap-2 mt-1">
                                    <Input
                                        id="pdf-password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter PDF password"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={async () => {
                                            if (!password || !pdfFile) return;
                                            setApplyingPassword(true);
                                            try {
                                                const success = await applyPasswordToFiles(pdfFile, password);
                                                if (success) {
                                                    setPasswordApplied(true);
                                                    setPdfNeedsPassword(false);
                                                    toast({
                                                        title: "Success",
                                                        description: "Password applied successfully",
                                                    });
                                                } else {
                                                    toast({
                                                        title: "Error",
                                                        description: "Invalid password",
                                                        variant: "destructive"
                                                    });
                                                }
                                            } catch (error) {
                                                toast({
                                                    title: "Error",
                                                    description: "Failed to apply password",
                                                    variant: "destructive"
                                                });
                                            } finally {
                                                setApplyingPassword(false);
                                            }
                                        }}
                                        disabled={applyingPassword}
                                    >
                                        {applyingPassword ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            'Apply Password'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Checkboxes and Alert */}
                        <div className="flex flex-row gap-6 mt-2 p-4 bg-slate-50/80 rounded-md border border-slate-200">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="has-soft-copy"
                                    checked={hasSoftCopy}
                                    onCheckedChange={(checked) => setHasSoftCopy(!!checked)}
                                    disabled={isProcessing}
                                />
                                <Label htmlFor="has-soft-copy">Has Soft Copy</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="has-hard-copy"
                                    checked={hasHardCopy}
                                    onCheckedChange={(checked) => setHasHardCopy(!!checked)}
                                    disabled={isProcessing}
                                />
                                <Label htmlFor="has-hard-copy">Has Hard Copy</Label>
                            </div>
                        </div>

                        {existingStatement && (
                            <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <div className="ml-2">
                                    <AlertTitle>Updating Existing Statement</AlertTitle>
                                    <AlertDescription>New uploads will replace the current files.</AlertDescription>
                                </div>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter className="bg-gradient-to-r from-slate-50 to-blue-50 -mx-6 -mb-6 p-4 border-t flex items-center justify-between">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => handleUpload(false)}
                            disabled={isProcessing || (!pdfFile && !existingStatement)}
                            className="min-w-[120px]"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {statusMessage}
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload & Validate
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {showValidationDialog && validationResult && (
                <BankValidationDialog
                    isOpen={showValidationDialog}
                    onClose={() => setShowValidationDialog(false)}
                    bank={bank}
                    extractedData={validationResult.extractedData}
                    mismatches={validationResult.mismatches}
                    onProceed={async (statement) => {
                        setShowValidationDialog(false);
                        const result = await handleUpload(true); // Force proceed past validation
                        if (result && result.id) {
                            onStatementUploaded(result);
                            if (onOpenExtractionDialog) {
                                onOpenExtractionDialog(result);
                            }
                        }
                    }}
                    onCancel={() => setShowValidationDialog(false)}
                    cycleMonth={cycleMonth}
                    cycleYear={cycleYear}
                    statementId={existingStatement?.id}
                />
            )}
        </>
    );
}