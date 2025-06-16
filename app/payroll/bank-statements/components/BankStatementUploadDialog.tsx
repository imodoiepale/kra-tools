import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useStatementCycle } from '@/app/payroll/hooks/useStatementCycle';
import { ExtractionsService } from '@/lib/services/ExtractionsService';
import { BankValidationDialog } from './BankValidationDialog';
import { BankExtractionDialog } from './BankExtractionDialog';
import { Upload, FileText, AlertCircle, CheckCircle2, Eye, Lock, Unlock } from 'lucide-react';

// Types and Interfaces
interface Bank {
    id: number;
    bank_name: string;
    account_number: string;
    bank_currency: string;
    company_id: number;
    acc_password?: string;
}

interface BankStatement {
    id: string;
    bank_id: number;
    statement_cycle_id: string;
    statement_month: number;
    statement_year: number;
    statement_type: 'monthly' | 'range';
    has_soft_copy: boolean;
    has_hard_copy: boolean;
    statement_document: {
        statement_pdf?: string;
        statement_excel?: string;
        document_size?: number;
        password?: string;
    };
    statement_extractions: any;
    validation_status?: {
        is_validated: boolean;
        validation_date: string;
        validated_by: string | null;
        mismatches: string[];
    };
    status?: {
        status: string;
        assigned_to: string | null;
        verification_date: string | null;
    };
    related_statements?: string[];
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
    cycleMonth: number; // 0-indexed
    cycleYear: number;
    onStatementUploaded: (statement: BankStatement) => void;
    existingStatement: BankStatement | null;
    statementCycleId: string | null;
    onOpenExtractionDialog?: (statement: BankStatement) => void;
}

// Helper Functions
const normalizeCurrencyCode = (code: string | null | undefined): string => {
    if (!code) return '';
    const upperCode = code.toUpperCase().trim();
    const currencyMap: { [key: string]: string } = {
        'EURO': 'EUR', 'EUROS': 'EUR', 'US DOLLAR': 'USD', 'US DOLLARS': 'USD', 'USDOLLAR': 'USD',
        'POUND': 'GBP', 'POUNDS': 'GBP', 'STERLING': 'GBP', 'KENYA SHILLING': 'KES',
        'KENYA SHILLINGS': 'KES', 'KENYAN SHILLING': 'KES', 'KSH': 'KES', 'K.SH': 'KES',
        'KSHS': 'KES', 'K.SHS': 'KES', 'SH': 'KES'
    };
    return currencyMap[upperCode] || upperCode;
};

const detectPasswordFromFilename = (filename: string): string | null => {
    if (!filename) return null;

    const lowerFilename = filename.toLowerCase();
    const passwordIndicators = ['pw', 'pwd', 'password', 'passcode', 'pass', 'p w', 'p-w', 'p_w'];

    for (const indicator of passwordIndicators) {
        const indicatorIndex = lowerFilename.indexOf(indicator);
        if (indicatorIndex !== -1) {
            const afterIndicator = filename.substring(indicatorIndex + indicator.length).trim();
            const passwordMatch = afterIndicator.match(/^[\s-_]*([0-9]+)/);
            if (passwordMatch && passwordMatch[1]) {
                return passwordMatch[1];
            }
        }
    }

    // Check for 4-digit numbers that might be passwords
    const digitMatch = filename.match(/\b\d{4}\b/);
    return digitMatch ? digitMatch[0] : null;
};

const getBankNameFromFilename = (filename: string): string | null => {
    const lowerFilename = filename.toLowerCase();
    const bankNames = [
        'kcb', 'equity', 'stanbic', 'standard chartered', 'stanchart', 'absa', 'barclays',
        'coop', 'cooperative', 'ncba', 'cba', 'diamond trust', 'dtb', 'family', 'i&m', 'im bank',
        'gulf', 'uob', 'prime', 'bank of africa', 'boa', 'credit bank', 'eco bank', 'ecobank'
    ];

    for (const bank of bankNames) {
        if (lowerFilename.includes(bank)) {
            return bank;
        }
    }
    return null;
};

const parseStatementPeriod = (period: string) => {
    if (!period) return null;

    const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];

    // Handle different period formats
    const patterns = [
        /(\w+)\s+(\d{4})\s*-\s*(\w+)\s+(\d{4})/i, // "January 2024 - March 2024"
        /(\w+)\s*-\s*(\w+)\s+(\d{4})/i, // "January - March 2024"
        /(\w+)\s+(\d{4})/i // "January 2024"
    ];

    for (const pattern of patterns) {
        const match = period.match(pattern);
        if (match) {
            if (match.length === 5) {
                // Range format: "January 2024 - March 2024"
                const startMonth = monthNames.indexOf(match[1].toLowerCase()) + 1;
                const startYear = parseInt(match[2]);
                const endMonth = monthNames.indexOf(match[3].toLowerCase()) + 1;
                const endYear = parseInt(match[4]);

                if (startMonth > 0 && endMonth > 0) {
                    return { startMonth, startYear, endMonth, endYear };
                }
            } else if (match.length === 4) {
                // Range format: "January - March 2024"
                const startMonth = monthNames.indexOf(match[1].toLowerCase()) + 1;
                const endMonth = monthNames.indexOf(match[2].toLowerCase()) + 1;
                const year = parseInt(match[3]);

                if (startMonth > 0 && endMonth > 0) {
                    return { startMonth, startYear: year, endMonth, endYear: year };
                }
            } else if (match.length === 3) {
                // Single month format: "January 2024"
                const month = monthNames.indexOf(match[1].toLowerCase()) + 1;
                const year = parseInt(match[2]);

                if (month > 0) {
                    return { startMonth: month, startYear: year, endMonth: month, endYear: year };
                }
            }
        }
    }

    return null;
};

const generateMonthRange = (startMonth: number, startYear: number, endMonth: number, endYear: number) => {
    const months = [];
    let currentMonth = startMonth;
    let currentYear = startYear;

    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        months.push({ month: currentMonth, year: currentYear });

        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
    }

    return months;
};

const validateExtractedData = (extractedData: any, expectedBank?: Bank): ValidationResult => {
    const mismatches: string[] = [];

    if (!extractedData) {
        return {
            isValid: false,
            mismatches: ['No data extracted from statement'],
            extractedData: null
        };
    }

    // Check for essential fields
    if (!extractedData.bank_name) mismatches.push('Bank name not found');
    if (!extractedData.account_number) mismatches.push('Account number not found');
    if (!extractedData.currency) mismatches.push('Currency not found');

    // If we have expected bank, validate against it
    if (expectedBank) {
        if (extractedData.bank_name && !extractedData.bank_name.toLowerCase().includes(expectedBank.bank_name.toLowerCase())) {
            mismatches.push(`Bank name mismatch: Expected "${expectedBank.bank_name}", found "${extractedData.bank_name}"`);
        }

        if (extractedData.account_number && !extractedData.account_number.includes(expectedBank.account_number)) {
            mismatches.push(`Account number mismatch: Expected "${expectedBank.account_number}", found "${extractedData.account_number}"`);
        }

        if (extractedData.currency && normalizeCurrencyCode(extractedData.currency) !== normalizeCurrencyCode(expectedBank.bank_currency)) {
            mismatches.push(`Currency mismatch: Expected "${expectedBank.bank_currency}", found "${extractedData.currency}"`);
        }
    }

    return {
        isValid: mismatches.length === 0,
        mismatches,
        extractedData
    };
};

// Main Component
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
    const { getOrCreateStatementCycle, loading: cycleLoading, error: cycleError } = useStatementCycle();

    // File and form states
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [hasSoftCopy, setHasSoftCopy] = useState<boolean>(true);
    const [hasHardCopy, setHasHardCopy] = useState<boolean>(false);

    // Password handling
    const [password, setPassword] = useState<string>('');
    const [detectedPassword, setDetectedPassword] = useState<string>('');
    const [pdfNeedsPassword, setPdfNeedsPassword] = useState<boolean>(false);
    const [passwordApplied, setPasswordApplied] = useState<boolean>(false);
    const [applyingPassword, setApplyingPassword] = useState<boolean>(false);

    // Processing states
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [uploading, setUploading] = useState<boolean>(false);
    const [extracting, setExtracting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);

    // Dialog states
    const [showValidationDialog, setShowValidationDialog] = useState<boolean>(false);
    const [showExtractionDialog, setShowExtractionDialog] = useState<boolean>(false);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [extractionResults, setExtractionResults] = useState<any>(null);
    const [validationResults, setValidationResults] = useState<any>(null);
    const [uploadedStatement, setUploadedStatement] = useState<BankStatement | null>(null);

    // Refs
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Reset form when dialog opens
    useEffect(() => {
        if (isOpen) {
            setPdfFile(null);
            setExcelFile(null);
            setPassword('');
            setDetectedPassword('');
            setPdfNeedsPassword(false);
            setPasswordApplied(false);
            setValidationResult(null);
            setExtractionResults(null);
            setValidationResults(null);
            setUploadedStatement(null);
            setHasSoftCopy(existingStatement?.has_soft_copy ?? true);
            setHasHardCopy(existingStatement?.has_hard_copy ?? false);
            setStatusMessage('');
            setUploadProgress(0);
        }
    }, [isOpen, existingStatement]);

    // Auto-detect password when file is selected
    useEffect(() => {
        if (pdfFile) {
            const detected = detectPasswordFromFilename(pdfFile.name);
            if (detected) {
                setDetectedPassword(detected);
                setPassword(detected);
            }

            // Also try bank's stored password
            if (bank.acc_password) {
                setPassword(bank.acc_password);
            }
        }
    }, [pdfFile, bank.acc_password]);

    // Multi-month statement handler
    const handleMultiMonthStatement = async (
        statementData: any,
        bank: Bank,
        extractedData: any,
        documentInfo: any
    ) => {
        const additionalStatements = [];

        try {
            // Parse statement period
            const periodDates = parseStatementPeriod(extractedData.statement_period);
            if (!periodDates) return additionalStatements;

            console.log('Processing multi-month statement:', periodDates);

            // Generate all months in the range
            const monthsInRange = generateMonthRange(
                periodDates.startMonth,
                periodDates.startYear,
                periodDates.endMonth,
                periodDates.endYear
            );

            // Skip the primary month (already created)
            const primaryMonth = cycleMonth + 1; // Convert to 1-based
            const primaryYear = cycleYear;

            for (const monthPeriod of monthsInRange) {
                if (monthPeriod.month === primaryMonth && monthPeriod.year === primaryYear) {
                    continue; // Skip primary month
                }

                // Get or create cycle for this month
                const cycle = await getOrCreateStatementCycle(monthPeriod.month - 1, monthPeriod.year); // Convert back to 0-based

                // Find balance for this specific month
                const monthBalance = extractedData.monthly_balances?.find(
                    (balance: any) => balance.month === monthPeriod.month && balance.year === monthPeriod.year
                );

                const additionalStatementData = {
                    ...statementData,
                    statement_cycle_id: cycle.id,
                    statement_month: monthPeriod.month - 1, // Convert to 0-based
                    statement_year: monthPeriod.year,
                    statement_type: 'range',
                    statement_extractions: {
                        ...extractedData,
                        opening_balance: monthBalance?.opening_balance || null,
                        closing_balance: monthBalance?.closing_balance || null,
                    }
                };

                const { data: additionalStatement, error } = await supabase
                    .from('acc_cycle_bank_statements')
                    .insert(additionalStatementData)
                    .select()
                    .single();

                if (!error && additionalStatement) {
                    additionalStatements.push(additionalStatement);
                    console.log(`Created additional statement for ${monthPeriod.month}/${monthPeriod.year}`);
                }
            }
        } catch (error) {
            console.error('Error creating multi-month statements:', error);
        }

        return additionalStatements;
    };

    // Password application handler
    const handleApplyPassword = async () => {
        if (!pdfFile || !password) {
            toast({
                title: "Missing Information",
                description: "Please select a file and enter a password",
                variant: "destructive"
            });
            return;
        }

        setApplyingPassword(true);
        try {
            // Test if password works by attempting extraction
            const extractionOptions = {
                month: cycleMonth,
                year: cycleYear,
                password: password,
                testPasswordOnly: true
            };

            const testResult = await ExtractionsService.getExtraction(pdfFile, extractionOptions);

            if (testResult?.success || !testResult?.requiresPassword) {
                setPasswordApplied(true);
                setPdfNeedsPassword(false);
                toast({
                    title: "Success",
                    description: "Password applied successfully",
                    variant: "default"
                });
            } else {
                toast({
                    title: "Invalid Password",
                    description: "The password provided doesn't unlock this PDF. Please try again.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error('Error applying password:', error);
            toast({
                title: "Error",
                description: "Failed to apply password",
                variant: "destructive"
            });
        } finally {
            setApplyingPassword(false);
        }
    };

    // Main upload processor
    const processUpload = async (extractedData?: any) => {
        let mainStatement: BankStatement | null = null;
        let additionalStatements: BankStatement[] = [];
        let fileUrl: string | null = null;

        try {
            setUploading(true);
            setUploadProgress(10);

            if (!pdfFile) {
                throw new Error('No PDF file selected');
            }

            // Get or create statement cycle
            const cycleId = statementCycleId || (await getOrCreateStatementCycle(cycleMonth, cycleYear)).id;
            setUploadProgress(20);

            // Upload PDF file
            const pdfFileName = `${bank.id}_${cycleMonth + 1}_${cycleYear}_${Date.now()}.pdf`;
            const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                .from('bank-statements')
                .upload(pdfFileName, pdfFile);

            if (pdfUploadError) throw pdfUploadError;
            setUploadProgress(40);

            // Upload Excel file if provided
            let excelFileName: string | null = null;
            if (excelFile) {
                excelFileName = `${bank.id}_${cycleMonth + 1}_${cycleYear}_${Date.now()}.xlsx`;
                const { error: excelUploadError } = await supabase.storage
                    .from('bank-statements')
                    .upload(excelFileName, excelFile);

                if (excelUploadError) {
                    console.warn('Excel upload failed:', excelUploadError);
                    excelFileName = null;
                }
            }
            setUploadProgress(60);

            // Prepare document info
            const documentInfo = {
                statement_pdf: pdfUploadData.path,
                statement_excel: excelFileName,
                document_size: pdfFile.size,
                password: passwordApplied ? password : null
            };

            // Determine if this is a multi-month statement
            const isMultiMonth = extractedData && extractedData.statement_period &&
                parseStatementPeriod(extractedData.statement_period) &&
                (() => {
                    const period = parseStatementPeriod(extractedData.statement_period);
                    return period && (period.startMonth !== period.endMonth || period.startYear !== period.endYear);
                })();

            // Prepare main statement data
            const statementData = {
                company_id: bank.company_id,
                bank_id: bank.id,
                statement_cycle_id: cycleId,
                statement_month: cycleMonth,
                statement_year: cycleYear,
                statement_type: isMultiMonth ? 'range' : 'monthly',
                has_soft_copy: hasSoftCopy,
                has_hard_copy: hasHardCopy,
                statement_document: documentInfo,
                statement_extractions: extractedData || {},
                extraction_performed: !!extractedData,
                extraction_timestamp: extractedData ? new Date().toISOString() : null,
                validation_status: extractedData ? {
                    is_validated: validationResults?.isValid || false,
                    validation_date: new Date().toISOString(),
                    validated_by: null,
                    mismatches: validationResults?.mismatches || []
                } : null,
                status: {
                    status: extractedData ? 'pending_validation' : 'uploaded',
                    assigned_to: null,
                    verification_date: null
                }
            };

            // Insert or update main statement
            if (existingStatement) {
                const { data: updatedStatement, error: updateError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .update(statementData)
                    .eq('id', existingStatement.id)
                    .select()
                    .single();

                if (updateError) throw updateError;
                mainStatement = updatedStatement;
            } else {
                const { data: newStatement, error: insertError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .insert(statementData)
                    .select()
                    .single();

                if (insertError) throw insertError;
                mainStatement = newStatement;
                console.log("Created new statement:", mainStatement.id);
            }
            setUploadProgress(80);

            // Handle multi-month statement if needed
            if (isMultiMonth && extractedData && mainStatement) {
                try {
                    additionalStatements = await handleMultiMonthStatement(
                        statementData,
                        bank,
                        extractedData,
                        documentInfo
                    );

                    console.log(`Created ${additionalStatements.length} additional statements for multi-month range`);

                    // Update the main statement to reflect it's part of a multi-month set
                    const { error: updateError } = await supabase
                        .from('acc_cycle_bank_statements')
                        .update({
                            related_statements: additionalStatements.map(s => s.id),
                            statement_extractions: {
                                ...mainStatement.statement_extractions,
                                is_multi_month: true,
                                multi_month_statement_ids: additionalStatements.map(s => s.id)
                            }
                        })
                        .eq('id', mainStatement.id);

                    if (updateError) {
                        console.error("Error updating main statement with multi-month info:", updateError);
                    }
                } catch (multiMonthError) {
                    console.error("Error processing multi-month statements:", multiMonthError);
                    toast({
                        title: 'Warning',
                        description: 'Failed to create additional months from multi-month statement',
                        variant: 'default'
                    });
                }
            }
            setUploadProgress(90);

            // Set the uploaded statement and show extraction dialog
            setUploadedStatement(mainStatement);
            onStatementUploaded(mainStatement);

            // Show extraction dialog for reviewing/editing extracted data
            if (extractedData && onOpenExtractionDialog) {
                onOpenExtractionDialog(mainStatement);
            } else if (extractedData) {
                setShowExtractionDialog(true);
            }

            // Clear URL objects
            if (fileUrl) {
                URL.revokeObjectURL(fileUrl);
            }

            setUploadProgress(100);
            setUploading(false);

            toast({
                title: 'Success',
                description: isMultiMonth
                    ? `Uploaded statement for ${additionalStatements.length + 1} months`
                    : 'Statement uploaded successfully',
            });

            return mainStatement;
        } catch (error) {
            console.error('Upload error:', error);
            setUploading(false);
            setUploadProgress(0);
            toast({
                title: 'Upload Error',
                description: error.message || 'An error occurred during upload',
                variant: 'destructive'
            });
            throw error;
        }
    };

    // Main upload handler
    const handleUpload = async () => {
        if (!pdfFile) {
            toast({
                title: 'No File Selected',
                description: 'Please select a file to upload',
                variant: 'destructive'
            });
            return;
        }

        setUploading(true);
        setStatusMessage('Starting extraction...');

        try {
            // First attempt extraction with Gemini AI
            const extractionOptions = {
                month: cycleMonth,
                year: cycleYear,
                password: pdfNeedsPassword ? password : null,
                forceAiExtraction: true
            };

            const extractionResults = await ExtractionsService.getExtraction(pdfFile, extractionOptions);
            setExtractionResults(extractionResults);

            // If extraction successful, validate the data
            if (extractionResults?.success) {
                const validationResult = validateExtractedData(extractionResults.extractedData, bank);
                setValidationResults(validationResult);

                // If validation issues, show validation dialog
                if (!validationResult.isValid) {
                    setShowValidationDialog(true);
                    setUploading(false);
                    return;
                }
            } else if (extractionResults?.requiresPassword) {
                setPdfNeedsPassword(true);
                setUploading(false);
                toast({
                    title: "Password Required",
                    description: "This PDF is password protected. Please provide a password.",
                    variant: "default"
                });
                return;
            }

            // Continue with upload process
            await processUpload(extractionResults?.success ? extractionResults.extractedData : null);

        } catch (error) {
            console.error('Upload error:', error);
            setUploading(false);
            toast({
                title: 'Upload Error',
                description: error.message || 'An error occurred during upload',
                variant: 'destructive'
            });
        }
    };

    // Validation dialog handlers
    const handleProceedWithValidation = async (updatedExtractedData: any) => {
        try {
            setShowValidationDialog(false);
            await processUpload(updatedExtractedData);
        } catch (error) {
            console.error('Error proceeding with validation:', error);
            toast({
                title: 'Error',
                description: 'Failed to proceed with upload',
                variant: 'destructive'
            });
        }
    };

    const handleCancelValidation = () => {
        setShowValidationDialog(false);
        setUploading(false);
        toast({
            title: 'Upload Cancelled',
            description: 'Upload cancelled due to validation issues',
            variant: 'default'
        });
    };

    // Extraction dialog handlers
    const handleExtractionDialogClose = () => {
        setShowExtractionDialog(false);
        onClose();
    };

    const handleExtractionSave = async (updatedStatement: BankStatement) => {
        setShowExtractionDialog(false);
        onStatementUploaded(updatedStatement);
        onClose();
    };

    // File handlers
    const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPdfFile(file);

            // Auto-detect password
            const detected = detectPasswordFromFilename(file.name);
            if (detected) {
                setDetectedPassword(detected);
                setPassword(detected);
            }
        }
    };

    const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setExcelFile(file);
        }
    };

    // Computed values
    const isFormValid = useMemo(() => {
        return pdfFile && (!pdfNeedsPassword || (password && passwordApplied));
    }, [pdfFile, pdfNeedsPassword, password, passwordApplied]);

    const uploadButtonText = useMemo(() => {
        if (uploading) return 'Uploading...';
        if (existingStatement) return 'Update Statement';
        return 'Upload Statement';
    }, [uploading, existingStatement]);

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {existingStatement ? 'Update Bank Statement' : 'Upload Bank Statement'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Bank Information */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Bank</Label>
                                        <p className="font-medium">{bank.bank_name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Account</Label>
                                        <p className="font-medium">{bank.account_number}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Period</Label>
                                        <p className="font-medium">
                                            {new Date(cycleYear, cycleMonth).toLocaleDateString('en-US', {
                                                month: 'long',
                                                year: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Currency</Label>
                                        <p className="font-medium">{bank.bank_currency}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Upload Progress */}
                        {uploading && (
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Upload Progress</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <Progress value={uploadProgress} className="w-full" />
                                        {statusMessage && (
                                            <p className="text-sm text-muted-foreground">{statusMessage}</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Tabs defaultValue="upload" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="upload">File Upload</TabsTrigger>
                                <TabsTrigger value="options">Options</TabsTrigger>
                            </TabsList>

                            <TabsContent value="upload" className="space-y-4">
                                {/* PDF Upload */}
                                <div className="space-y-2">
                                    <Label htmlFor="pdf-upload">PDF Statement *</Label>
                                    <div className="space-y-2">
                                        <Input
                                            id="pdf-upload"
                                            ref={pdfInputRef}
                                            type="file"
                                            accept=".pdf"
                                            onChange={handlePdfFileChange}
                                            disabled={uploading}
                                        />
                                        {pdfFile && (
                                            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                                <FileText className="h-4 w-4 text-blue-600" />
                                                <span className="text-sm font-medium">{pdfFile.name}</span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                                                </Badge>
                                                {pdfNeedsPassword && !passwordApplied && (
                                                    <Badge variant="destructive" className="text-xs">
                                                        <Lock className="h-3 w-3 mr-1" />
                                                        Password Required
                                                    </Badge>
                                                )}
                                                {passwordApplied && (
                                                    <Badge variant="default" className="text-xs">
                                                        <Unlock className="h-3 w-3 mr-1" />
                                                        Unlocked
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Password Section */}
                                {(pdfNeedsPassword || detectedPassword) && (
                                    <div className="space-y-3 p-4 bg-orange-50 border border-orange-200 rounded-md">
                                        <div className="flex items-center gap-2">
                                            <Lock className="h-4 w-4 text-orange-600" />
                                            <Label className="font-medium text-orange-800">
                                                PDF Password Protection
                                            </Label>
                                        </div>

                                        {detectedPassword && (
                                            <div className="flex items-center gap-2 text-sm text-green-700">
                                                <CheckCircle2 className="h-4 w-4" />
                                                <span>Auto-detected password: {detectedPassword}</span>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label htmlFor="pdf-password">Password</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="pdf-password"
                                                    type="password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="Enter PDF password"
                                                    disabled={applyingPassword || passwordApplied}
                                                />
                                                <Button
                                                    type="button"
                                                    variant={passwordApplied ? "default" : "outline"}
                                                    onClick={handleApplyPassword}
                                                    disabled={!password || applyingPassword || passwordApplied}
                                                    className="min-w-[100px]"
                                                >
                                                    {applyingPassword ? (
                                                        "Testing..."
                                                    ) : passwordApplied ? (
                                                        <>
                                                            <Unlock className="h-4 w-4 mr-1" />
                                                            Applied
                                                        </>
                                                    ) : (
                                                        "Apply"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        {bank.acc_password && (
                                            <div className="text-xs text-muted-foreground">
                                                <span>Bank's stored password available</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Excel Upload */}
                                <div className="space-y-2">
                                    <Label htmlFor="excel-upload">Excel Statement (Optional)</Label>
                                    <Input
                                        id="excel-upload"
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleExcelFileChange}
                                        disabled={uploading}
                                    />
                                    {excelFile && (
                                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                            <FileText className="h-4 w-4 text-green-600" />
                                            <span className="text-sm font-medium">{excelFile.name}</span>
                                            <Badge variant="secondary" className="text-xs">
                                                {(excelFile.size / 1024 / 1024).toFixed(2)} MB
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="options" className="space-y-4">
                                {/* Copy Options */}
                                <div className="space-y-4">
                                    <Label className="text-base font-medium">Statement Availability</Label>

                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="soft-copy"
                                                checked={hasSoftCopy}
                                                onCheckedChange={setHasSoftCopy}
                                                disabled={uploading}
                                            />
                                            <Label htmlFor="soft-copy" className="text-sm">
                                                Soft copy available (Digital)
                                            </Label>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="hard-copy"
                                                checked={hasHardCopy}
                                                onCheckedChange={setHasHardCopy}
                                                disabled={uploading}
                                            />
                                            <Label htmlFor="hard-copy" className="text-sm">
                                                Hard copy available (Physical)
                                            </Label>
                                        </div>
                                    </div>
                                </div>

                                {/* Extraction Status */}
                                {extractionResults && (
                                    <div className="space-y-2">
                                        <Label className="text-base font-medium">Extraction Status</Label>
                                        <div className="p-3 bg-muted rounded-md">
                                            {extractionResults.success ? (
                                                <div className="flex items-center gap-2 text-green-700">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    <span className="text-sm">Data extracted successfully</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-orange-700">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <span className="text-sm">
                                                        {extractionResults.requiresPassword
                                                            ? "Password required for extraction"
                                                            : "No data could be extracted"
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Validation Status */}
                                {validationResults && (
                                    <div className="space-y-2">
                                        <Label className="text-base font-medium">Validation Status</Label>
                                        <div className="p-3 bg-muted rounded-md">
                                            {validationResults.isValid ? (
                                                <div className="flex items-center gap-2 text-green-700">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    <span className="text-sm">All validations passed</span>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-orange-700">
                                                        <AlertCircle className="h-4 w-4" />
                                                        <span className="text-sm">Validation issues found</span>
                                                    </div>
                                                    <ul className="text-xs text-muted-foreground list-disc list-inside">
                                                        {validationResults.mismatches.map((mismatch: string, index: number) => (
                                                            <li key={index}>{mismatch}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>

                        <Separator />

                        {/* Action Buttons */}
                        <div className="flex justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={uploading}
                            >
                                Cancel
                            </Button>

                            <div className="flex gap-2">
                                {uploadedStatement && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowExtractionDialog(true)}
                                        disabled={uploading}
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Review Extraction
                                    </Button>
                                )}

                                <Button
                                    type="button"
                                    onClick={handleUpload}
                                    disabled={!isFormValid || uploading}
                                    className="min-w-[150px]"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                            {uploadButtonText}
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4 mr-2" />
                                            {uploadButtonText}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Status Message */}
                        {statusMessage && !uploading && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                <p className="text-sm text-blue-800">{statusMessage}</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Bank Validation Dialog */}
            {showValidationDialog && validationResults && extractionResults && (
                <BankValidationDialog
                    isOpen={showValidationDialog}
                    onClose={() => setShowValidationDialog(false)}
                    bank={bank}
                    extractedData={extractionResults.extractedData}
                    mismatches={validationResults.mismatches}
                    onProceed={handleProceedWithValidation}
                    onCancel={handleCancelValidation}
                    cycleMonth={cycleMonth}
                    cycleYear={cycleYear}
                    fileUrl={pdfFile ? URL.createObjectURL(pdfFile) : null}
                />
            )}

            {/* Bank Extraction Dialog */}
            {showExtractionDialog && uploadedStatement && (
                <BankExtractionDialog
                    isOpen={showExtractionDialog}
                    onClose={handleExtractionDialogClose}
                    bank={bank}
                    statement={uploadedStatement}
                    pdfPassword={passwordApplied ? password : null}
                    onSave={handleExtractionSave}
                    extractionResults={extractionResults}
                    validationResults={validationResults}
                />
            )}
        </>
    );
}