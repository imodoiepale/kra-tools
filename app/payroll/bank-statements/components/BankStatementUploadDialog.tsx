// app/payroll/bank-statements/components/BankStatementUploadDialog.tsx
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Bank, BankStatement, ValidationResult } from '../../types';

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

const isValidDate = (dateValue: any): boolean => {
    if (!dateValue) return false;

    if (dateValue instanceof Date) {
        return !isNaN(dateValue.getTime());
    }

    if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        return !isNaN(parsed.getTime());
    }

    return false;
};

const createSafeDate = (year: number, month: number, day: number = 1): Date | null => {
    try {
        if (!year || !month || year < 1900 || year > 2100 || month < 1 || month > 12) {
            console.error('Invalid date parameters:', { year, month, day });
            return null;
        }

        const date = new Date(year, month - 1, day);

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

const parseStatementPeriodSafe = (periodString: string) => {
    if (!periodString || typeof periodString !== 'string') {
        return null;
    }

    console.log('Parsing statement period:', periodString);

    try {
        const normalizedPeriod = periodString.trim().replace(/\s+/g, ' ');

        const dateRangePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–—]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/;
        const dateRangeMatch = normalizedPeriod.match(dateRangePattern);

        if (dateRangeMatch) {
            const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = dateRangeMatch;

            const startMonthNum = parseInt(startMonth, 10);
            const startYearNum = parseInt(startYear, 10);
            const endMonthNum = parseInt(endMonth, 10);
            const endYearNum = parseInt(endYear, 10);

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

    if (monthLower.length >= 3) {
        for (let i = 0; i < fullMonths.length; i++) {
            if (fullMonths[i].startsWith(monthLower)) {
                return i + 1;
            }
        }
    }

    return null;
};

const determineStatementType = (extractedData: any, userSelection?: 'monthly' | 'range'): 'monthly' | 'range' => {
    if (userSelection) return userSelection;

    if (!extractedData) return 'monthly';

    const monthlyBalances = extractedData.monthly_balances || [];
    const statementPeriod = extractedData.statement_period;

    // If multiple monthly balances, it's definitely a range statement
    if (monthlyBalances.length > 1) return 'range';

    // If no statement period, default to monthly
    if (!statementPeriod) return 'monthly';

    // Parse the statement period to check if it spans multiple months
    const periodCheck = parseStatementPeriodSafe(statementPeriod);
    if (periodCheck) {
        const { startMonth, startYear, endMonth, endYear } = periodCheck;

        // Check if it spans multiple months or years
        if (startYear !== endYear) {
            return 'range'; // Different years = definitely range
        }

        if (startMonth !== endMonth) {
            return 'range'; // Different months = range
        }

        // Same month and year = monthly statement
        return 'monthly';
    }

    // Check for explicit range indicators in the period text
    const periodLower = statementPeriod.toLowerCase();
    if (periodLower.includes('quarter') ||
        periodLower.includes('q1') ||
        periodLower.includes('q2') ||
        periodLower.includes('q3') ||
        periodLower.includes('q4') ||
        periodLower.includes('jan') && periodLower.includes('mar') || // Q1
        periodLower.includes('apr') && periodLower.includes('jun') || // Q2
        periodLower.includes('jul') && periodLower.includes('sep') || // Q3
        periodLower.includes('oct') && periodLower.includes('dec')) { // Q4
        return 'range';
    }

    // Default to monthly for same-month periods like "01/03/2024 - 31/03/2024"
    return 'monthly';
};

const isRangePeriod = (statementPeriod: string): boolean => {
    if (!statementPeriod) return false;

    // Parse to check actual date span
    const periodCheck = parseStatementPeriodSafe(statementPeriod);
    if (periodCheck) {
        const { startMonth, startYear, endMonth, endYear } = periodCheck;

        // Only consider it range if it spans multiple months or years
        if (startYear !== endYear || startMonth !== endMonth) {
            return true;
        }
        return false; // Same month = not range
    }

    // Check for explicit range indicators
    const period = statementPeriod.toLowerCase();
    return period.includes('quarter') ||
        /q[1-4]/i.test(period) ||
        (period.includes('jan') && period.includes('mar')) ||
        (period.includes('apr') && period.includes('jun')) ||
        (period.includes('jul') && period.includes('sep')) ||
        (period.includes('oct') && period.includes('dec'));
};

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

    const [detectedPassword, setDetectedPassword] = useState<string>('');
    const [detectedAccountNumber, setDetectedAccountNumber] = useState<string>('');
    const [autoPasswordApplied, setAutoPasswordApplied] = useState<boolean>(false);
    const [pdfNeedsPassword, setPdfNeedsPassword] = useState<boolean>(false);
    const [password, setPassword] = useState<string>('');
    const [passwordApplied, setPasswordApplied] = useState<boolean>(false);
    const [applyingPassword, setApplyingPassword] = useState<boolean>(false);

    const [selectedStatementType, setSelectedStatementType] = useState<'monthly' | 'range'>('monthly');
    const [showConflictDialog, setShowConflictDialog] = useState(false);

    const [uploadMode, setUploadMode] = useState<'new' | 'replace' | 'additional'>('new');
    const [conflictingStatements, setConflictingStatements] = useState<BankStatement[]>([]);

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
            setSelectedStatementType('monthly');
            setHasSoftCopy(existingStatement?.has_soft_copy ?? true);
            setHasHardCopy(existingStatement?.has_hard_copy ?? false);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
        }
    }, [isOpen, existingStatement]);

    const checkForExistingStatements = async () => {
        if (!statementCycleId || !bank) return;

        const { data: existing, error } = await supabase
            .from('acc_cycle_bank_statements')
            .select('*')
            .eq('bank_id', bank.id)
            .eq('statement_cycle_id', statementCycleId)
            .eq('statement_type', selectedStatementType);

        if (error) {
            console.error('Error checking existing statements:', error);
            return;
        }

        if (existing && existing.length > 0) {
            setConflictingStatements(existing);
            // Show conflict resolution dialog
            setShowConflictDialog(true);
        }
    };
    const checkStatementPeriod = (extractedData: any): { isValid: boolean; message: string } => {
        try {
            if (!extractedData.statement_period) {
                return { isValid: true, message: 'No statement period found in document' };
            }

            const period = parseStatementPeriodSafe(extractedData.statement_period);
            if (!period) {
                return { isValid: true, message: 'Could not parse statement period' };
            }

            const expectedDate = createSafeDate(cycleYear, cycleMonth + 1);
            const statementStartDate = createSafeDate(period.startYear, period.startMonth);
            const statementEndDate = createSafeDate(period.endYear, period.endMonth);

            if (!expectedDate || !statementStartDate || !statementEndDate) {
                console.error('Failed to create valid dates for comparison');
                return { isValid: true, message: 'Could not validate dates' };
            }

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

    const handleFileSelection = async (selectedFile: File, fileType: 'pdf' | 'excel') => {
        if (fileType === 'pdf') {
            setPdfFile(selectedFile);

            setAutoPasswordApplied(false);
            setPdfNeedsPassword(false);
            setPassword('');
            setPasswordApplied(false);

            const fileInfo = detectFileInfo(selectedFile.name);
            console.log('Detected file info:', fileInfo);

            if (fileInfo.password) {
                setDetectedPassword(fileInfo.password);
            }
            if (fileInfo.accountNumber) {
                setDetectedAccountNumber(fileInfo.accountNumber);
            }

            try {
                const isProtected = selectedFile.type === 'application/pdf' ?
                    await isPdfPasswordProtected(selectedFile) : false;
                setPdfNeedsPassword(isProtected);

                if (isProtected) {
                    console.log('PDF is password protected. Attempting automatic password application.');

                    if (bank?.acc_password) {
                        console.log('Trying bank stored password:', bank.acc_password);
                        try {
                            const success = await applyPasswordToFiles(selectedFile, bank.acc_password);
                            if (success) {
                                setPassword(bank.acc_password);
                                setPasswordApplied(true);
                                setAutoPasswordApplied(true);
                                setPdfNeedsPassword(false);
                                toast({
                                    title: "Success",
                                    description: "Bank's stored password applied successfully",
                                });
                                return;
                            }
                        } catch (error) {
                            console.error('Bank password failed:', error);
                        }
                    }

                    if (fileInfo?.password) {
                        console.log('Trying detected password from filename:', fileInfo.password);
                        try {
                            const success = await applyPasswordToFiles(selectedFile, fileInfo.password);
                            if (success) {
                                setPassword(fileInfo.password);
                                setPasswordApplied(true);
                                setAutoPasswordApplied(true);
                                setPdfNeedsPassword(false);
                                toast({
                                    title: "Success",
                                    description: "Password detected from filename and applied successfully",
                                });
                                return;
                            }
                        } catch (error) {
                            console.error('Detected password failed:', error);
                        }
                    }

                    toast({
                        title: "Password Required",
                        description: "This PDF is password protected. Automatic detection failed. Please enter the password manually.",
                        variant: "warning"
                    });
                }
            } catch (error) {
                console.error('Error handling PDF password:', error);
                toast({
                    title: "Error",
                    description: "Failed to analyze PDF protection. Please try again.",
                    variant: "destructive"
                });
            }
        } else if (fileType === 'excel') {
            setExcelFile(selectedFile);
        }
    };

    const validateExtractedData = (extractedData: any): { isValid: boolean; mismatches: string[] } => {
        const mismatches: string[] = [];

        if (extractedData.bank_name && bank.bank_name) {
            const extractedBankLower = extractedData.bank_name.toLowerCase();
            const bankNameLower = bank.bank_name.toLowerCase();
            if (!extractedBankLower.includes(bankNameLower) && !bankNameLower.includes(extractedBankLower)) {
                mismatches.push(`Bank name mismatch: Expected "${bank.bank_name}", found "${extractedData.bank_name}"`);
            }
        }

        if (extractedData.account_number && bank.account_number) {
            if (!extractedData.account_number.includes(bank.account_number) &&
                !bank.account_number.includes(extractedData.account_number)) {
                mismatches.push(`Account number mismatch: Expected "${bank.account_number}", found "${extractedData.account_number}"`);
            }
        }

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

            if (pdfFile) {
                setStatusMessage('Extracting data...');

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

                const extractedData = { ...extractionResults.extractedData };
                if (extractedData.account_number && extractedData.account_number === bank.account_number) {
                    extractedData.bank_name = bank.bank_name;
                }

                const periodCheck = checkStatementPeriod(extractedData);
                if (!periodCheck.isValid) {
                    setStatusMessage('Period mismatch detected');
                    console.warn('Period mismatch:', periodCheck.message);
                }

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

            if (currentValidationResult && !currentValidationResult.isValid && !forceProceed) {
                setShowValidationDialog(true);
                setIsProcessing(false);
                return null;
            }

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

            const determinedType = determineStatementType(currentValidationResult?.extractedData, selectedStatementType);

            // FIX: Check for existing statements of the SAME TYPE only
            const { data: existingStatementsOfSameType, error: existingError } = await supabase
                .from('acc_cycle_bank_statements')
                .select('*')
                .eq('bank_id', bank.id)
                .eq('statement_cycle_id', statementCycleId)
                .eq('statement_month', cycleMonth)
                .eq('statement_year', cycleYear)
                .eq('statement_type', determinedType);

            if (existingError) throw existingError;

            let upsertId = existingStatement?.id;

            // If there's an existing statement of the same type, use its ID for upserting
            if (existingStatementsOfSameType && existingStatementsOfSameType.length > 0) {
                upsertId = existingStatementsOfSameType[0].id;
            }

            const dataToSave = {
                id: upsertId, // Will be undefined for new statements
                bank_id: bank.id,
                company_id: bank.company_id,
                statement_cycle_id: statementCycleId,
                statement_month: cycleMonth,
                statement_year: cycleYear,
                statement_type: determinedType,
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
                status: {
                    ...existingStatement?.status,
                    status: 'pending_validation'
                }
            };

            const { data: upsertedStatement, error } = await supabase
                .from('acc_cycle_bank_statements')
                .upsert(dataToSave, { onConflict: 'id' })
                .select()
                .single();
            if (error) throw error;

            toast({
                title: 'Success',
                description: `${determinedType} bank statement processed successfully.`
            });
            onStatementUploaded(upsertedStatement);

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
                                <div>
                                    <h3 className="text-sm font-medium text-purple-800 border-b border-purple-100 pb-1 mb-2">Account Password</h3>
                                    <div className="flex items-center gap-2">
                                        <Lock className="h-4 w-4 text-purple-600" />
                                        {bank.acc_password ? (
                                            <span className="text-green-700 font-bold text-sm">
                                                {bank.acc_password}
                                            </span>
                                        ) : (
                                            <span className="text-red-700 font-bold text-sm">
                                                Missing
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

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

                        <div className="space-y-2">
                            <Label htmlFor="statement-type" className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-blue-600" />
                                Statement Type
                            </Label>
                            <Select value={selectedStatementType} onValueChange={(value: 'monthly' | 'range') => setSelectedStatementType(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select statement type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Monthly Statement</SelectItem>
                                    <SelectItem value="range">Range Statement (Multi-month)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

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
                        const result = await handleUpload(true);
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

            {showConflictDialog && (
                <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Statement Type Conflict</AlertDialogTitle>
                            <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                    <span>A {selectedStatementType} statement already exists for this period.</span>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="uploadMode"
                                                value="replace"
                                                checked={uploadMode === 'replace'}
                                                onChange={(e) => setUploadMode(e.target.value as any)}
                                            />
                                            <span className="text-sm">Replace existing {selectedStatementType} statement</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="uploadMode"
                                                value="additional"
                                                checked={uploadMode === 'additional'}
                                                onChange={(e) => setUploadMode(e.target.value as any)}
                                            />
                                            <span className="text-sm">Upload as additional statement (different type)</span>
                                        </label>
                                    </div>
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                                setShowConflictDialog(false);
                                handleUpload();
                            }}>
                                Proceed
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

        </>
    );
}