// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload, AlertTriangle, UploadCloud, FileText, Building, CreditCard, DollarSign, Sheet, Landmark, Calendar, Check, X } from 'lucide-react';
import { BankValidationDialog } from './BankValidationDialog';
import {
    performBankStatementExtraction,
    generateMonthRange,
    parseStatementPeriod,
} from '@/lib/bankExtractionUtils';
import { useStatementCycle } from '@/app/payroll/hooks/useStatementCycle';

// --- Interfaces & Types ---
interface Bank {
    id: number;
    bank_name: string;
    account_number: string;
    bank_currency: string;
    company_id: number;
    company_name: string;
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
    cycleMonth: number; // 0-indexed
    cycleYear: number;
    onStatementUploaded: (statement: BankStatement) => void;
    existingStatement: BankStatement | null;
    statementCycleId: string | null;
    onOpenExtractionDialog?: (statement: BankStatement) => void;
}

// Helper to normalize currency codes
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
    const { getOrCreateStatementCycle, loading: cycleLoading, error: cycleError } = useStatementCycle();
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [hasSoftCopy, setHasSoftCopy] = useState<boolean>(true);
    const [hasHardCopy, setHasHardCopy] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [showValidationDialog, setShowValidationDialog] = useState<boolean>(false);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setPdfFile(null);
            setExcelFile(null);
            setValidationResult(null);
            setHasSoftCopy(existingStatement?.has_soft_copy ?? true);
            setHasHardCopy(existingStatement?.has_hard_copy ?? false);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
        }
    }, [isOpen, existingStatement]);

    // <--- MODIFIED handleUpload function --->
    const handleUpload = async (passedExtractedData: any = null): Promise<BankStatement | null> => {
        // Declare these at the top of the function to ensure scope for finally block
        let pdfPath: string | null = null;
        let documentSize: number = 0;

        if (!pdfFile && !existingStatement && !passedExtractedData) {
            toast({ title: 'File Missing', description: 'Please select a PDF file or provide existing data.', variant: 'destructive' });
            return null;
        }
        setIsProcessing(true);
        setStatusMessage('Starting...');

        try {
            let extractedData: any = {};

            // Step 1: Handle PDF Upload / Path
            if (pdfFile) {
                setStatusMessage('Uploading PDF file...');
                const tempFilePath = `statement_documents/temp/${bank.company_id}/bank_${bank.id}_${Date.now()}.pdf`;
                const { data, error } = await supabase.storage.from('Statement-Cycle').upload(tempFilePath, pdfFile, { upsert: true });
                if (error) throw error;
                pdfPath = data.path;
                documentSize = pdfFile.size;
            } else if (existingStatement?.statement_document?.statement_pdf) {
                // If no new file, but an existing statement, use its path
                pdfPath = existingStatement.statement_document.statement_pdf;
                documentSize = existingStatement.statement_document.document_size || 0;
            } else {
                // This case should ideally be covered by the initial check, but as a fallback
                throw new Error("No PDF file or existing statement document path available.");
            }

            // Step 2: Determine Extracted Data (Avoid re-extraction if already provided)
            if (passedExtractedData) {
                extractedData = { ...passedExtractedData }; // Use data passed from validation dialog
            } else if (pdfPath) { // Only extract if there's a new PDF path or it's the initial upload
                setStatusMessage('Extracting data...');
                const fileUrl = supabase.storage.from('Statement-Cycle').getPublicUrl(pdfPath).data.publicUrl;
                try {
                    const extraction = await performBankStatementExtraction(fileUrl, { month: cycleMonth, year: cycleYear });
                    if (!extraction.success) {
                        console.error('Extraction failed:', extraction.message);
                        extractedData = {}; // Ensure it's an empty object even on failure
                    } else {
                        extractedData = { ...extraction.extractedData };
                    }
                } catch (extractionError) {
                    console.error("Error during extraction:", extractionError);
                    extractedData = {}; // Ensure it's an empty object even on failure
                }
            } else {
                throw new Error("No extracted data available and no PDF to extract from.");
            }

            // Post-extraction processing: Ensure bank_name is consistent if account number matches
            if (extractedData.account_number && extractedData.account_number === bank.account_number) {
                extractedData.bank_name = bank.bank_name;
            }
            // <--- END MODIFIED handleUpload function --->


            // Step 3: Determine target month(s) and collect validation mismatches
            let targetMonths: { month: number; year: number }[] = [];
            const mismatches: string[] = [];

            if (extractedData.statement_period) {
                const period = parseStatementPeriod(extractedData.statement_period);
                if (period) {
                    targetMonths = generateMonthRange(
                        period.startMonth,
                        period.startYear,
                        period.endMonth,
                        period.endYear
                    );

                    // Check if current dialog period is included
                    const currentPeriodIncluded = targetMonths.some(
                        m => m.month === (cycleMonth + 1) && m.year === cycleYear
                    );

                    if (!currentPeriodIncluded) {
                        mismatches.push(`Statement period (${format(new Date(period.startYear, period.startMonth - 1), 'MMM yyyy')} to ${format(new Date(period.endYear, period.endMonth - 1), 'MMM yyyy')}) does not include the selected period (${format(new Date(cycleYear, cycleMonth), 'MMMM yyyy')}).`);
                    }
                } else {
                    console.warn('Could not parse statement period from extraction. Falling back to selected month.');
                    targetMonths = [{ month: cycleMonth + 1, year: cycleYear }];
                    mismatches.push('Could not parse statement period from document. Defaulting to selected month for save.');
                }
            } else {
                console.warn('No statement period found in extraction. Falling back to selected month.');
                targetMonths = [{ month: cycleMonth + 1, year: cycleYear }];
                mismatches.push('No statement period found in document. Defaulting to selected month for save.');
            }

            // Check for other extracted data mismatches
            if (extractedData.bank_name && !extractedData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())) {
                mismatches.push(`Bank name mismatch: Expected "${bank.bank_name}", Found "${extractedData.bank_name}".`);
            }
            if (extractedData.account_number && extractedData.account_number !== bank.account_number) {
                mismatches.push(`Account number mismatch: Expected "${bank.account_number}", Found "${extractedData.account_number}".`);
            }
            if (extractedData.currency && normalizeCurrencyCode(extractedData.currency) !== normalizeCurrencyCode(bank.bank_currency)) {
                mismatches.push(`Currency mismatch: Expected "${bank.bank_currency}", Found "${extractedData.currency}".`);
            }
            if (extractedData.monthly_balances?.length === 0) {
                mismatches.push('No monthly balances extracted from the document.');
            }

            // Set validation result
            const finalValidationResult: ValidationResult = {
                isValid: mismatches.length === 0,
                mismatches: mismatches,
                extractedData: extractedData,
                monthlyBalances: extractedData.monthly_balances || []
            };
            setValidationResult(finalValidationResult);

            // Step 4: Show validation dialog if issues exist
            if (!passedExtractedData && finalValidationResult.mismatches.length > 0) { // Only show dialog if not force proceeding and issues exist
                setShowValidationDialog(true);
                setIsProcessing(false);
                return null;
            }

            // Step 5: Save to all relevant months
            setStatusMessage('Saving statements for all periods...');
            const savedStatements = [];

            // Move PDF to permanent location if uploaded and not already permanent
            let permanentPdfPath = pdfPath; // Use the already determined pdfPath
            if (pdfFile && pdfPath && pdfPath.startsWith('statement_documents/temp/')) {
                const folderMonth = targetMonths[0] || { month: cycleMonth + 1, year: cycleYear };
                permanentPdfPath = `statement_documents/${folderMonth.year}/${folderMonth.month.toString().padStart(2, '0')}/${bank.company_id}/bank_${bank.id}_${Date.now()}.pdf`;
                const { error: moveError } = await supabase.storage.from('Statement-Cycle').move(pdfPath, permanentPdfPath);
                if (moveError) throw moveError;
            }

            for (const monthPeriod of targetMonths) {
                // Get or create statement cycle for this month
                const cycleIdForThisMonth = await getOrCreateStatementCycle(monthPeriod.month, monthPeriod.year);

                // Check if statement already exists
                const { data: existingMonthStatement } = await supabase
                    .from('acc_cycle_bank_statements')
                    .select('id, statement_document')
                    .eq('bank_id', bank.id)
                    .eq('statement_month', monthPeriod.month - 1) // Store 0-indexed
                    .eq('statement_year', monthPeriod.year)
                    .single();

                let statementIdToUpsert = existingMonthStatement?.id || undefined;

                // Delete old PDF if replacing with a new one
                if (existingMonthStatement && pdfFile && existingMonthStatement.statement_document?.statement_pdf && existingMonthStatement.statement_document.statement_pdf !== permanentPdfPath) {
                    await supabase.storage.from('Statement-Cycle').remove([existingMonthStatement.statement_document.statement_pdf]).catch(e => console.error("Failed to delete old PDF:", e));
                }

                // Find specific month data if available
                const monthSpecificBalance = extractedData.monthly_balances?.find(
                    mb => mb.month === monthPeriod.month && mb.year === monthPeriod.year
                );

                // Create/Update statement data
                const statementData = {
                    id: statementIdToUpsert,
                    bank_id: bank.id,
                    company_id: bank.company_id,
                    statement_cycle_id: cycleIdForThisMonth,
                    statement_month: monthPeriod.month - 1, // Store 0-indexed
                    statement_year: monthPeriod.year,
                    has_soft_copy: hasSoftCopy,
                    has_hard_copy: hasHardCopy,
                    statement_document: {
                        statement_pdf: permanentPdfPath,
                        document_size: documentSize
                    },
                    statement_extractions: {
                        ...extractedData,
                        closing_balance: monthSpecificBalance?.closing_balance || extractedData.closing_balance || null,
                        opening_balance: monthSpecificBalance?.opening_balance || extractedData.opening_balance || null,
                    },
                    validation_status: {
                        is_validated: finalValidationResult.isValid,
                        mismatches: finalValidationResult.mismatches,
                        validation_date: new Date().toISOString()
                    },
                    status: {
                        status: 'pending_validation'
                    }
                };

                const { data: savedStatement, error } = await supabase
                    .from('acc_cycle_bank_statements')
                    .upsert(statementData, { onConflict: 'id' })
                    .select()
                    .single();

                if (error) throw error;
                savedStatements.push(savedStatement);
            }

            // Notify user
            if (savedStatements.length > 1) {
                toast({
                    title: 'Success',
                    description: `Saved statement to ${savedStatements.length} months.`
                });
            } else if (savedStatements.length === 1) {
                toast({
                    title: 'Success',
                    description: 'Bank statement processed successfully.'
                });
            }

            // Find the statement for current dialog month
            const statementForCurrentDialogMonth = savedStatements.find(
                s => s.statement_month === cycleMonth && s.statement_year === cycleYear
            );

            if (statementForCurrentDialogMonth) {
                onStatementUploaded(statementForCurrentDialogMonth);
                // Auto-open extraction dialog if handler provided
                if (onOpenExtractionDialog) {
                    setTimeout(() => {
                        onOpenExtractionDialog(statementForCurrentDialogMonth);
                    }, 300);
                }
            } else if (savedStatements.length > 0) {
                toast({
                    title: 'Info',
                    description: `Statement saved to different period(s). Please navigate to ${format(new Date(savedStatements[0].statement_year, savedStatements[0].statement_month), 'MMMM yyyy')} to view.`
                });
                onClose();
            } else {
                toast({
                    title: 'Info',
                    description: `No statements were saved. Please check extracted period details.`
                });
                onClose();
            }
            return null;

        } catch (error: any) {
            console.error('Upload error:', error);
            toast({
                title: 'Upload Error',
                description: error.message || 'Failed to process statement.',
                variant: 'destructive'
            });
            // Clean up temp file if error
            if (pdfPath && pdfPath.startsWith('statement_documents/temp/')) {
                await supabase.storage.from('Statement-Cycle').remove([pdfPath]).catch(e => console.error("Failed to clean up temp file:", e));
            }
            return null;
        } finally {
            setIsProcessing(false);
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
                                        <span className="font-medium">{format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* File Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="pdf-file" className="flex items-center gap-1.5">
                                    <FileText className="h-4 w-4 text-blue-600" />Bank Statement PDF
                                </Label>
                                <Input
                                    id="pdf-file"
                                    ref={pdfInputRef}
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => {
                                        setPdfFile(e.target.files?.[0] || null);
                                        setValidationResult(null);
                                    }}
                                    disabled={isProcessing}
                                    className="cursor-pointer file:bg-blue-50 file:text-blue-700 file:border-blue-200 hover:file:bg-blue-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="excel-file" className="flex items-center gap-1.5">
                                    <Sheet className="h-4 w-4 text-emerald-600" />Bank Statement Excel (Optional)
                                </Label>
                                <Input
                                    id="excel-file"
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                                    disabled={isProcessing}
                                    className="cursor-pointer file:bg-emerald-50 file:text-emerald-700 file:border-emerald-200 hover:file:bg-emerald-100"
                                />
                            </div>
                        </div>

                        {/* Checkboxes */}
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
                            onClick={() => handleUpload(null)} // Initial call, no passedExtractedData
                            disabled={isProcessing || (!pdfFile && !existingStatement)}
                            className="min-w-[120px]"
                        >
                            {isProcessing ?
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{statusMessage}</> :
                                <><Upload className="mr-2 h-4 w-4" />Upload & Validate</>
                            }
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
                    onProceed={async (data) => { // <--- Changed signature to accept data
                        setShowValidationDialog(false);
                        await handleUpload(data); // <--- Pass the extracted data back
                    }}
                    onCancel={() => {
                        setShowValidationDialog(false);
                        setIsProcessing(false);
                    }}
                    cycleMonth={cycleMonth}
                    cycleYear={cycleYear}
                    statementId={existingStatement?.id}
                />
            )}
        </>
    );
}