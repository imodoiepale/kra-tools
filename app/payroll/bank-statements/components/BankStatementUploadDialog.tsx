// BankStatementUploadDialog.tsx
// @ts-nocheck
import { useState, useRef } from 'react'
import { Loader2, Upload, AlertTriangle, CheckCircle, UploadCloud, FileText, Sheet, Building, Landmark, CreditCard, DollarSign, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { BankValidationDialog } from './BankValidationDialog'
import { performBankStatementExtraction } from '@/lib/bankExtractionUtils'

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
}

interface BankStatement {
    id: string
    bank_id: number
    statement_month: number
    statement_year: number
    quickbooks_balance: number | null
    statement_document: {
        statement_pdf: string | null
        statement_excel: string | null
    }
    statement_extractions: {
        bank_name: string | null
        account_number: string | null
        currency: string | null
        statement_period: string | null
        opening_balance: number | null
        closing_balance: number | null
        monthly_balances: Array<{
            month: number
            year: number
            closing_balance: number
            opening_balance: number
            statement_page: number
            highlight_coordinates: {
                x1: number
                y1: number
                x2: number
                y2: number
                page: number
            }
            is_verified: boolean
            verified_by: string | null
            verified_at: string | null
        }>
    }
    validation_status: {
        is_validated: boolean
        validation_date: string | null
        validated_by: string | null
        mismatches: Array<string>
    }
    has_soft_copy: boolean
    has_hard_copy: boolean
    status: {
        status: string
        assigned_to: string | null
        verification_date: string | null
    }
}

interface ValidationResult {
    isValid: boolean
    mismatches: string[]
    extractedData: {
        bank_name: string | null
        account_number: string | null
        currency: string | null
        statement_period: string | null
        opening_balance: number | null
        closing_balance: number | null
        monthly_balances: any[]
    }
}

// BankStatementUploadDialog.tsx
interface BankStatementUploadDialogProps {
    isOpen: boolean
    onClose: () => void
    bank: Bank
    cycleMonth: number
    cycleYear: number
    onStatementUploaded: (statement: BankStatement) => void
    existingStatement: BankStatement | null
    statementCycleId: string | null
}


function isPeriodContained(statementPeriod, cycleMonth, cycleYear) {
    if (!statementPeriod) return false;

    // For simple month/year validation
    const monthYearRegex = new RegExp(`\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+${cycleYear}\\b`, 'i');
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

    if (monthYearRegex.test(statementPeriod)) {
        // Check if the month matches
        const normalizedPeriod = statementPeriod.toLowerCase();
        const cycleMonthName = monthNames[cycleMonth];
        return normalizedPeriod.includes(cycleMonthName);
    }

    try {
        // If there's a date range format (e.g., "01/01/2024 - 30/01/2024")
        const dates = statementPeriod.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g);
        if (!dates || dates.length < 2) return false;

        // Try to parse dates - first attempt DD/MM/YYYY format
        const parseDate = (dateStr) => {
            const parts = dateStr.split(/[\/\-\.]/);
            if (parts.length !== 3) return null;

            // Try DD/MM/YYYY
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                return { day, month, year };
            }

            // Try MM/DD/YYYY
            const day2 = parseInt(parts[1], 10);
            const month2 = parseInt(parts[0], 10);

            if (day2 >= 1 && day2 <= 31 && month2 >= 1 && month2 <= 12) {
                return { day: day2, month: month2, year };
            }

            return null;
        };

        const startDate = parseDate(dates[0]);
        const endDate = parseDate(dates[1]);

        if (!startDate || !endDate) return false;

        // Check if the cycle month/year is within the date range
        // Compare years first
        if (startDate.year < cycleYear && endDate.year > cycleYear) return true;
        if (startDate.year > cycleYear || endDate.year < cycleYear) return false;

        // If start year equals cycle year, check if cycle month is >= start month
        if (startDate.year === cycleYear && cycleMonth < startDate.month) return false;

        // If end year equals cycle year, check if cycle month is <= end month
        if (endDate.year === cycleYear && cycleMonth > endDate.month) return false;

        return true;
    } catch (error) {
        console.error('Error validating statement period:', error);
        return false;
    }
}

export function BankStatementUploadDialog({
    isOpen,
    onClose,
    bank,
    cycleMonth,
    cycleYear,
    onStatementUploaded,
    existingStatement,
    statementCycleId
}: BankStatementUploadDialogProps) {
    const [pdfFile, setPdfFile] = useState<File | null>(null)
    const [excelFile, setExcelFile] = useState<File | null>(null)
    const [hasSoftCopy, setHasSoftCopy] = useState<boolean>(existingStatement?.has_soft_copy || true)
    const [hasHardCopy, setHasHardCopy] = useState<boolean>(existingStatement?.has_hard_copy || false)
    const [uploading, setUploading] = useState<boolean>(false)
    const [extracting, setExtracting] = useState<boolean>(false)
    const [showValidation, setShowValidation] = useState<boolean>(false)
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

    const pdfInputRef = useRef<HTMLInputElement>(null)
    const excelInputRef = useRef<HTMLInputElement>(null)

    const { toast } = useToast()

    const resetForm = () => {
        setPdfFile(null)
        setExcelFile(null)
        setHasSoftCopy(existingStatement?.has_soft_copy || false)
        setHasHardCopy(existingStatement?.has_hard_copy || false)
        setShowValidation(false)
        setValidationResult(null)
        if (pdfInputRef.current) pdfInputRef.current.value = ''
        if (excelInputRef.current) excelInputRef.current.value = ''
    }

    const validateExtractedData = (extracted: any): ValidationResult => {
        const mismatches: string[] = []

        // Validate bank name
        if (extracted.bank_name && !extracted.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())) {
            mismatches.push(`Bank name mismatch: Expected "${bank.bank_name}", found "${extracted.bank_name}"`)
        }

        // Validate account number
        if (extracted.account_number && !extracted.account_number.includes(bank.account_number)) {
            mismatches.push(`Account number mismatch: Expected "${bank.account_number}", found "${extracted.account_number}"`)
        }

        // Validate currency
        if (extracted.currency && extracted.currency !== bank.bank_currency) {
            mismatches.push(`Currency mismatch: Expected "${bank.bank_currency}", found "${extracted.currency}"`)
        }

        // Validate statement month/year
        // Use the isPeriodContained function from BankValidationDialog
        if (extracted.statement_period) {
            const isPeriodValid = isPeriodContained(extracted.statement_period, cycleMonth, cycleYear)
            if (!isPeriodValid) {
                mismatches.push(`Statement period mismatch: Expected statement for ${format(new Date(cycleYear, cycleMonth), 'MMMM yyyy')}, found "${extracted.statement_period}"`)
            }
        }

        // For monthly balances, check if the expected month/year exists
        if (extracted.monthly_balances && extracted.monthly_balances.length > 0) {
            const hasExpectedMonth = extracted.monthly_balances.some(
                balance => balance.month === cycleMonth && balance.year === cycleYear
            )

            if (!hasExpectedMonth) {
                mismatches.push(`Monthly balance mismatch: Expected balance for ${format(new Date(cycleYear, cycleMonth), 'MMMM yyyy')} not found in statement`)
            }
        }

        return {
            isValid: mismatches.length === 0,
            mismatches,
            extractedData: extracted
        }
    }

    if (!statementCycleId) {
        toast({
            title: 'Error',
            description: 'No active payroll cycle found. Please ensure the cycle exists.',
            variant: 'destructive'
        });
        return;
    }

    // Helper function to parse statement period string into start and end dates
    function parseStatementPeriod(periodString) {
        if (!periodString) return null;

        // Try to match various date formats
        // Format: "January 2024" (single month)
        const singleMonthMatch = periodString.match(/(\w+)\s+(\d{4})/i);
        if (singleMonthMatch) {
            const month = new Date(`${singleMonthMatch[1]} 1, 2000`).getMonth() + 1;
            const year = parseInt(singleMonthMatch[2]);
            return {
                startMonth: month,
                startYear: year,
                endMonth: month,
                endYear: year
            };
        }

        // Format: "January - March 2024" or "January to March 2024"
        const sameYearMatch = periodString.match(/(\w+)\s*(?:-|to)\s*(\w+)\s+(\d{4})/i);
        if (sameYearMatch) {
            const startMonth = new Date(`${sameYearMatch[1]} 1, 2000`).getMonth() + 1;
            const endMonth = new Date(`${sameYearMatch[2]} 1, 2000`).getMonth() + 1;
            const year = parseInt(sameYearMatch[3]);
            return {
                startMonth,
                startYear: year,
                endMonth,
                endYear: year
            };
        }

        // Format: "January 2024 - March 2024" or "January 2024 to March 2024"
        const differentYearMatch = periodString.match(/(\w+)\s+(\d{4})\s*(?:-|to)\s*(\w+)\s+(\d{4})/i);
        if (differentYearMatch) {
            const startMonth = new Date(`${differentYearMatch[1]} 1, 2000`).getMonth() + 1;
            const startYear = parseInt(differentYearMatch[2]);
            const endMonth = new Date(`${differentYearMatch[3]} 1, 2000`).getMonth() + 1;
            const endYear = parseInt(differentYearMatch[4]);
            return {
                startMonth,
                startYear,
                endMonth,
                endYear
            };
        }

        return null;
    }

    // Helper function to determine if a statement spans multiple months
    function isMultiMonthPeriod(periodString) {
        const periodDates = parseStatementPeriod(periodString);
        if (!periodDates) return false;

        const { startMonth, startYear, endMonth, endYear } = periodDates;

        // Check if period spans multiple months
        if (startYear < endYear) return true;
        if (startYear === endYear && startMonth < endMonth) return true;

        return false;
    }

    const handleUpload = async (proceed: boolean = true) => {
        if (!pdfFile && !hasSoftCopy) {
            toast({
                title: 'Validation Error',
                description: 'Please upload a PDF file or check "Has Soft Copy"',
                variant: 'destructive'
            });
            return;
        }

        // Add safe check for statementCycleId
        if (!statementCycleId) {
            toast({
                title: 'Error',
                description: 'No active statement cycle found. Please try again later.',
                variant: 'destructive'
            });
            return;
        }

        try {
            setUploading(true);

            // If we have a PDF file, first extract data for validation
            if (pdfFile && !validationResult && proceed) {
                setExtracting(true);

                // Generate a temporary URL for the file
                const fileUrl = URL.createObjectURL(pdfFile);

                try {
                    // Extract data from the PDF - only first and last pages
                    const extractionResult = await performBankStatementExtraction(
                        fileUrl,
                        {
                            month: cycleMonth,
                            year: cycleYear
                        }
                    );

                    // Validate the extracted data
                    const validation = validateExtractedData(extractionResult.extractedData);
                    setValidationResult(validation);

                    // Only show validation for critical mismatches (bank name, account number)
                    // Filter out period mismatches which aren't critical
                    const criticalMismatches = validation.mismatches.filter(mismatch =>
                        !mismatch.toLowerCase().includes('period')
                    );

                    if (criticalMismatches.length > 0) {
                        setShowValidation(true);
                        setExtracting(false);
                        setUploading(false);
                        return;
                    }
                } catch (error) {
                    console.error('Extraction error:', error);
                    toast({
                        title: 'Extraction Error',
                        description: 'Failed to extract data from the PDF. Proceeding with upload only.',
                        variant: 'destructive'
                    });
                } finally {
                    URL.revokeObjectURL(fileUrl);
                    setExtracting(false);
                }
            }

            // Upload files to storage
            let pdfPath = existingStatement?.statement_document.statement_pdf || null;
            let excelPath = existingStatement?.statement_document.statement_excel || null;

            // Upload PDF if provided
            if (pdfFile) {
                const pdfFileName = `bank_statement_${bank.company_id}_${bank.id}_${cycleYear}_${cycleMonth}.pdf`;
                const pdfFilePath = `statement_documents/${cycleYear}/${cycleMonth}/${bank.company_id}/${pdfFileName}`;

                const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                    .from('Statement-Cycle')  // Changed from 'Payroll-Cycle'
                    .upload(pdfFilePath, pdfFile, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (pdfUploadError) throw pdfUploadError;

                pdfPath = pdfUploadData.path;
            }

            // Upload Excel if provided
            if (excelFile) {
                const excelFileName = `bank_statement_${bank.company_id}_${bank.id}_${cycleYear}_${cycleMonth}.xlsx`;
                const excelFilePath = `statement_documents/${cycleYear}/${cycleMonth}/${bank.company_id}/${excelFileName}`;

                const { data: excelUploadData, error: excelUploadError } = await supabase.storage
                    .from('Statement-Cycle')  // Changed from 'Payroll-Cycle'
                    .upload(excelFilePath, excelFile, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (excelUploadError) throw excelUploadError;

                excelPath = excelUploadData.path;
            }

            // Document paths for database
            const documentPaths = {
                statement_pdf: pdfPath,
                statement_excel: excelPath,
                document_size: pdfFile ? pdfFile.size : existingStatement?.statement_document.document_size || 0
            };

            // Prepare base statement data
            const baseStatementData = {
                bank_id: bank.id,
                company_id: bank.company_id,
                statement_cycle_id: statementCycleId,  // Changed from payroll_cycle_id
                statement_month: cycleMonth,
                statement_year: cycleYear,
                statement_document: documentPaths,
                has_soft_copy: hasSoftCopy,
                has_hard_copy: hasHardCopy
            };

            // If we have extracted data from validation, include it
            if (validationResult) {
                Object.assign(baseStatementData, {
                    statement_extractions: validationResult.extractedData,
                    validation_status: {
                        is_validated: validationResult.isValid,
                        validation_date: new Date().toISOString(),
                        validated_by: null,
                        mismatches: validationResult.mismatches
                    }
                });
            }

            // Determine if this is a multi-month statement
            const isMultiMonth = validationResult && validationResult.extractedData.statement_period
                ? isMultiMonthPeriod(validationResult.extractedData.statement_period)
                : false;

            let statement;

            if (isMultiMonth) {
                // Handle multi-month statement (create entries for each month)
                await handleMultiMonthStatement(
                    baseStatementData,
                    bank,
                    validationResult.extractedData,
                    documentPaths
                );

                // Get the current month statement to return
                const { data: currentMonthStatement, error: getCurrentError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .select('*')
                    .eq('bank_id', bank.id)
                    .eq('statement_month', cycleMonth)
                    .eq('statement_year', cycleYear)
                    .single();

                if (getCurrentError) throw getCurrentError;
                statement = currentMonthStatement;

                toast({
                    title: 'Success',
                    description: 'Multi-month bank statement processed successfully'
                });
            } else {
                // Regular single-month statement handling
                if (existingStatement) {
                    // Update existing statement
                    const { data, error } = await supabase
                        .from('acc_cycle_bank_statements')
                        .update(baseStatementData)
                        .eq('id', existingStatement.id)
                        .select('*')
                        .single();

                    if (error) throw error;
                    statement = data;
                } else {
                    // Create new statement
                    const { data, error } = await supabase
                        .from('acc_cycle_bank_statements')
                        .insert(baseStatementData)
                        .select('*')
                        .single();

                    if (error) throw error;
                    statement = data;
                }
            }

            // Notify parent component
            onStatementUploaded(statement);
            resetForm();

            toast({
                title: 'Success',
                description: 'Bank statement uploaded successfully'
            });
        } catch (error) {
            console.error('Upload error:', error);
            toast({
                title: 'Upload Error',
                description: 'Failed to upload bank statement',
                variant: 'destructive'
            });
        } finally {
            setUploading(false);
        }
    };

    // Helper function to generate month range from start to end
    function generateMonthRange(startMonth, startYear, endMonth, endYear) {
        const months = [];

        for (let year = startYear; year <= endYear; year++) {
            const start = year === startYear ? startMonth : 1;
            const end = year === endYear ? endMonth : 12;

            for (let month = start; month <= end; month++) {
                months.push({ month, year });
            }
        }

        return months;
    }

    // Function to handle multi-month statement submission
    async function handleMultiMonthStatement(
        baseStatementData,
        bank,
        extractedData,
        documentPaths
    ) {
        try {
            // Parse the statement period to get all months in the range
            const periodDates = parseStatementPeriod(extractedData.statement_period);

            if (!periodDates) {
                console.warn('Could not parse statement period, using only current month');
                return;
            }

            const { startMonth, startYear, endMonth, endYear } = periodDates;
            const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

            // For each month in the range, create a separate statement entry
            for (const { month, year } of monthsInRange) {
                // Format month/year for cycle lookup
                const monthStr = month.toString().padStart(2, '0');
                const monthYearStr = `${year}-${monthStr}`;

                // Check if a statement cycle exists for this month, create if needed
                let cyclePeriod;

                const { data: existingCycle, error: cycleError } = await supabase
                    .from('statement_cycles')
                    .select('id')
                    .eq('month_year', monthYearStr)
                    .single();

                if (cycleError) {
                    if (cycleError.code === 'PGRST116') { // No rows found
                        // Create new cycle for this month
                        const { data: newCycle, error: createError } = await supabase
                            .from('statement_cycles')
                            .insert({
                                month_year: monthYearStr,
                                status: 'active',
                                created_at: new Date().toISOString()
                            })
                            .select('id')
                            .single();

                        if (createError) throw createError;
                        cyclePeriod = newCycle;
                    } else {
                        throw cycleError;
                    }
                } else {
                    cyclePeriod = existingCycle;
                }

                // Check if a statement already exists for this bank/month
                const { data: existingStatement } = await supabase
                    .from('acc_cycle_bank_statements')
                    .select('id')
                    .eq('bank_id', bank.id)
                    .eq('statement_month', month)
                    .eq('statement_year', year)
                    .single();

                if (existingStatement) {
                    console.log(`Statement already exists for ${month}/${year}`);
                    continue; // Skip if already exists
                }

                // Find specific month data if available
                const monthData = extractedData.monthly_balances.find(
                    mb => mb.month === month && mb.year === year
                ) || {
                    month,
                    year,
                    opening_balance: null,
                    closing_balance: null,
                    statement_page: 1,
                    highlight_coordinates: null,
                    is_verified: false,
                    verified_by: null,
                    verified_at: null
                };

                // Create new statement for this month
                const newStatementData = {
                    ...baseStatementData,
                    statement_cycle_id: cyclePeriod.id,
                    statement_month: month,
                    statement_year: year,
                    statement_document: documentPaths, // Same document for all periods
                    statement_extractions: {
                        ...extractedData,
                        // Only include relevant month in monthly_balances
                        monthly_balances: [monthData]
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

                // Insert the new statement
                await supabase
                    .from('acc_cycle_bank_statements')
                    .insert([newStatementData]);

                console.log(`Created statement record for ${month}/${year}`);
            }

            return true;
        } catch (error) {
            console.error('Error handling multi-month statement:', error);
            throw error;
        }
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => {
                if (!open) resetForm()
                onClose()
            }}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <div className="bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50 -mx-6 -mt-6 p-6 rounded-t-lg border-b border-blue-200">
                            <div className="mb-2 flex justify-center">
                                <div className="h-14 w-14 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shadow-sm">
                                    <UploadCloud className="h-7 w-7 text-blue-600" />
                                </div>
                            </div>
                            <DialogTitle className="text-center text-xl text-blue-800">Upload Bank Statement</DialogTitle>
                            <p className="text-center text-blue-600 text-sm mt-1">
                                {bank.company_name}
                            </p>
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
                                            {format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')}
                                        </span>
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
                                <div className="group relative">
                                    <Input
                                        id="pdf-file"
                                        ref={pdfInputRef}
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                                setPdfFile(file)
                                                setValidationResult(null)
                                            }
                                        }}
                                        disabled={uploading || extracting}
                                        className="cursor-pointer file:bg-blue-50 file:text-blue-700 file:border-blue-200 
                                   hover:file:bg-blue-100 file:mr-4 file:px-3 file:py-2 file:rounded-md
                                   file:transition-colors group-hover:border-blue-300"
                                    />
                                    {pdfFile && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-700 bg-blue-50/80 
                                      py-0.5 px-2 rounded-full text-xs font-medium border border-blue-200 truncate max-w-[200px]">
                                            {pdfFile.name}
                                        </div>
                                    )}
                                </div>
                                {existingStatement?.statement_document.statement_pdf && (
                                    <div className="flex items-center text-xs text-green-600 pl-1">
                                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                        Existing PDF will be replaced
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="excel-file" className="flex items-center gap-1.5">
                                    <Sheet className="h-4 w-4 text-emerald-600" />
                                    Bank Statement Excel (Optional)
                                </Label>
                                <div className="group relative">
                                    <Input
                                        id="excel-file"
                                        ref={excelInputRef}
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) setExcelFile(file)
                                        }}
                                        disabled={uploading}
                                        className="cursor-pointer file:bg-emerald-50 file:text-emerald-700 file:border-emerald-200 
                                   hover:file:bg-emerald-100 file:mr-4 file:px-3 file:py-2 file:rounded-md
                                   file:transition-colors group-hover:border-emerald-300"
                                    />
                                    {excelFile && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-emerald-700 bg-emerald-50/80 
                                      py-0.5 px-2 rounded-full text-xs font-medium border border-emerald-200 truncate max-w-[200px]">
                                            {excelFile.name}
                                        </div>
                                    )}
                                </div>
                                {existingStatement?.statement_document.statement_excel && (
                                    <div className="flex items-center text-xs text-green-600 pl-1">
                                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                        Existing Excel will be replaced
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-row gap-6 mt-2 p-4 bg-slate-50/80 rounded-md border border-slate-200">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="has-soft-copy"
                                    checked={hasSoftCopy}
                                    onCheckedChange={(checked) => setHasSoftCopy(!!checked)}
                                    disabled={uploading}
                                    className="text-blue-600 rounded-sm"
                                />
                                <Label htmlFor="has-soft-copy" className="text-sm font-medium">Has Soft Copy</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="has-hard-copy"
                                    checked={hasHardCopy}
                                    onCheckedChange={(checked) => setHasHardCopy(!!checked)}
                                    disabled={uploading}
                                    className="text-blue-600 rounded-sm"
                                />
                                <Label htmlFor="has-hard-copy" className="text-sm font-medium">Has Hard Copy</Label>
                            </div>
                        </div>

                        {existingStatement && (
                            <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <div className="ml-2">
                                    <AlertTitle className="text-sm font-medium text-amber-800">Updating Existing Statement</AlertTitle>
                                    <AlertDescription className="text-xs text-amber-700">
                                        You are updating an existing bank statement. New uploads will replace the current files.
                                    </AlertDescription>
                                </div>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter className="bg-gradient-to-r from-slate-50 to-blue-50 -mx-6 -mb-6 p-4 border-t flex items-center justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={uploading || extracting}
                            className="border-gray-300 hover:bg-slate-100"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => handleUpload()}
                            disabled={uploading || extracting}
                            className="bg-blue-600 hover:bg-blue-700 px-6"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : extracting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Extracting Data...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload Statement
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {showValidation && validationResult && (
                <BankValidationDialog
                    isOpen={showValidation}
                    onClose={() => setShowValidation(false)}
                    bank={bank}
                    extractedData={validationResult.extractedData}
                    mismatches={validationResult.mismatches}
                    onProceed={() => {
                        setShowValidation(false)
                        handleUpload(true)
                    }}
                    onCancel={() => {
                        setShowValidation(false)
                        setValidationResult(null)
                    }}
                    cycleMonth={cycleMonth}
                    cycleYear={cycleYear}
                />
            )}
        </>
    )
}