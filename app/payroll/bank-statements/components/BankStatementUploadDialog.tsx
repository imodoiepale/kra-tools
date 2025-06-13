import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, AlertTriangle, UploadCloud, FileText, Building, CreditCard, DollarSign, Sheet, Landmark, Calendar } from 'lucide-react';
import { BankValidationDialog } from './BankValidationDialog';
import { performBankStatementExtraction } from '@/lib/bankExtractionUtils';
import { useStatementCycle } from '@/app/payroll/hooks/useStatementCycle';

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
    const { getOrCreateStatementCycle } = useStatementCycle();
    const { toast } = useToast();
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [hasSoftCopy, setHasSoftCopy] = useState<boolean>(true);
    const [hasHardCopy, setHasHardCopy] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [showValidationDialog, setShowValidationDialog] = useState<boolean>(false);
    const [validationResult, setValidationResult] = useState<any>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    // Initialize formData with proper structure
    const [formData, setFormData] = useState({
        bank_name: existingStatement?.statement_extractions?.bank_name || '',
        account_number: existingStatement?.statement_extractions?.account_number || '',
        currency: existingStatement?.statement_extractions?.currency || '',
        statementPeriod: existingStatement?.statement_extractions?.statement_period || '',
        quickbooks_balance: existingStatement?.status?.quickbooks_balance ?? null,
    });

    useEffect(() => {
        if (!isOpen) return;

        // Reset form when dialog opens
        setFormData({
            bank_name: existingStatement?.statement_extractions?.bank_name || '',
            account_number: existingStatement?.statement_extractions?.account_number || '',
            currency: existingStatement?.statement_extractions?.currency || '',
            statementPeriod: existingStatement?.statement_extractions?.statement_period || '',
            quickbooks_balance: existingStatement?.status?.quickbooks_balance ?? null,
        });

        setPdfFile(null);
        setExcelFile(null);
        setValidationResult(null);
        setHasSoftCopy(existingStatement?.has_soft_copy ?? true);
        setHasHardCopy(existingStatement?.has_hard_copy ?? false);
        if (pdfInputRef.current) pdfInputRef.current.value = '';
    }, [isOpen, existingStatement]);

    const normalizeCurrencyCode = (code: string | null | undefined): string => {
        if (!code) return '';
        const upperCode = code.toUpperCase().trim();
        const currencyMap: Record<string, string> = {
            'EURO': 'EUR', 'EUROS': 'EUR', 'US DOLLAR': 'USD', 'US DOLLARS': 'USD', 'USDOLLAR': 'USD',
            'POUND': 'GBP', 'POUNDS': 'GBP', 'STERLING': 'GBP', 'KENYA SHILLING': 'KES',
            'KENYA SHILLINGS': 'KES', 'KENYAN SHILLING': 'KES', 'KSH': 'KES', 'K.SH': 'KES',
            'KSHS': 'KES', 'K.SHS': 'KES', 'SH': 'KES'
        };
        return currencyMap[upperCode] || upperCode;
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpload = async (passedExtractedData: any = null): Promise<BankStatement | null> => {
        setIsProcessing(true);
        setStatusMessage('Starting upload process...');

        try {
            // Step 1: Upload files if provided
            let pdfPath = existingStatement?.statement_document?.statement_pdf || null;
            let documentSize = existingStatement?.statement_document?.document_size || 0;

            if (pdfFile) {
                setStatusMessage('Uploading PDF document...');
                const tempFilePath = `statement_documents/temp/${bank.company_id}/bank_${bank.id}_${Date.now()}.pdf`;
                const { data: uploadData, error: uploadError } = await supabase
                    .storage
                    .from('Statement-Cycle')
                    .upload(tempFilePath, pdfFile, { upsert: true });

                if (uploadError) throw uploadError;
                pdfPath = uploadData.path;
                documentSize = pdfFile.size;
            }

            // Step 2: Perform extraction if not passed from validation
            let extractedData = passedExtractedData || {};
            if (!passedExtractedData && pdfPath) {
                setStatusMessage('Extracting data from document...');
                const fileUrl = supabase.storage.from('Statement-Cycle').getPublicUrl(pdfPath).data.publicUrl;
                const extraction = await performBankStatementExtraction(fileUrl, {
                    month: cycleMonth,
                    year: cycleYear
                });

                if (!extraction.success) throw new Error(extraction.message || 'Extraction failed');
                extractedData = extraction.extractedData;
            }

            // Step 3: Validate extracted data
            const mismatches: string[] = [];
            if (!extractedData.bank_name?.toLowerCase().includes(bank.bank_name.toLowerCase())) {
                mismatches.push(`Bank name mismatch: Expected "${bank.bank_name}", Found "${extractedData.bank_name}"`);
            }
            if (!extractedData.account_number?.includes(bank.account_number)) {
                mismatches.push(`Account number mismatch: Expected "${bank.account_number}", Found "${extractedData.account_number}"`);
            }
            if (extractedData.currency && normalizeCurrencyCode(extractedData.currency) !== normalizeCurrencyCode(bank.bank_currency)) {
                mismatches.push(`Currency mismatch: Expected "${bank.bank_currency}", Found "${extractedData.currency}"`);
            }

            // Step 4: Handle statement period
            const periodDates = parseStatementPeriod(extractedData.statement_period);
            const isMultiMonth = periodDates && (
                periodDates.startMonth !== periodDates.endMonth ||
                periodDates.startYear !== periodDates.endYear
            );

            // Step 5: Move from temp to permanent location if new upload
            if (pdfFile && pdfPath.startsWith('statement_documents/temp/')) {
                const targetFolder = isMultiMonth
                    ? `statement_documents/${periodDates.startYear}/${periodDates.startMonth.toString().padStart(2, '0')}`
                    : `statement_documents/${cycleYear}/${(cycleMonth + 1).toString().padStart(2, '0')}`;

                const permanentPath = `${targetFolder}/${bank.company_id}/bank_${bank.id}_${Date.now()}.pdf`;

                setStatusMessage('Finalizing document storage...');
                const { error: moveError } = await supabase
                    .storage
                    .from('Statement-Cycle')
                    .move(pdfPath, permanentPath);

                if (moveError) throw moveError;
                pdfPath = permanentPath;
            }

            // Step 6: Create/update statement records
            const documentPaths = {
                statement_pdf: pdfPath,
                statement_excel: null,
                document_size: documentSize,
                document_type: 'application/pdf'
            };

            if (isMultiMonth && periodDates) {
                await handleMultiMonthStatement(
                    existingStatement,
                    bank,
                    { month: cycleMonth, year: cycleYear },
                    statementCycleId,
                    extractedData,
                    documentPaths
                );
            } else {
                // Handle single month statement
                const statementData = {
                    bank_id: bank.id,
                    company_id: bank.company_id,
                    statement_cycle_id: statementCycleId,
                    statement_month: cycleMonth,
                    statement_year: cycleYear,
                    statement_document: documentPaths,
                    statement_extractions: extractedData,
                    has_soft_copy: hasSoftCopy,
                    has_hard_copy: hasHardCopy,
                    validation_status: {
                        is_validated: mismatches.length === 0,
                        validation_date: new Date().toISOString(),
                        validated_by: 'current_user_id',
                        mismatches
                    },
                    status: {
                        status: mismatches.length === 0 ? 'validated' : 'pending_review',
                        quickbooks_balance: null
                    }
                };

                if (existingStatement) {
                    const { data, error } = await supabase
                        .from('acc_cycle_bank_statements')
                        .update(statementData)
                        .eq('id', existingStatement.id)
                        .select()
                        .single();

                    if (error) throw error;
                    onStatementUploaded(data);
                } else {
                    const { data, error } = await supabase
                        .from('acc_cycle_bank_statements')
                        .insert(statementData)
                        .select()
                        .single();

                    if (error) throw error;
                    onStatementUploaded(data);
                }
            }

            // Step 7: Show success and open extraction dialog
            toast({
                title: 'Success',
                description: 'Bank statement processed successfully'
            });

            if (onOpenExtractionDialog) {
                // For multi-month, we need to fetch the current month's statement
                if (isMultiMonth) {
                    const { data: currentStatement } = await supabase
                        .from('acc_cycle_bank_statements')
                        .select('*')
                        .eq('bank_id', bank.id)
                        .eq('statement_month', cycleMonth)
                        .eq('statement_year', cycleYear)
                        .single();

                    if (currentStatement) {
                        setTimeout(() => onOpenExtractionDialog(currentStatement), 300);
                    }
                } else if (!existingStatement) {
                    const { data: newStatement } = await supabase
                        .from('acc_cycle_bank_statements')
                        .select('*')
                        .eq('bank_id', bank.id)
                        .eq('statement_month', cycleMonth)
                        .eq('statement_year', cycleYear)
                        .single();

                    if (newStatement) {
                        setTimeout(() => onOpenExtractionDialog(newStatement), 300);
                    }
                }
            }

            return null;
        } catch (error: any) {
            console.error('Upload error:', error);
            toast({
                title: 'Upload Error',
                description: error.message || 'Failed to process statement',
                variant: 'destructive'
            });
            return null;
        } finally {
            setIsProcessing(false);
        }
    };

    async function handleMultiMonthStatement(
        existingStatement: BankStatement | null,
        bank: Bank,
        cycleMonthYear: { month: number; year: number },
        statementCycleId: string | null,
        extractedData: any,
        documentPaths: { statement_pdf: string | null; statement_excel: string | null; document_size?: number; document_type?: string }
    ) {
        const periodDates = parseStatementPeriod(extractedData.statement_period);
        if (!periodDates) throw new Error('Invalid statement period');

        const { startMonth, startYear, endMonth, endYear } = periodDates;
        const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

        // Process each month in the range
        for (const { month, year } of monthsInRange) {
            const monthStr = month.toString().padStart(2, '0');
            const monthYearStr = `${year}-${monthStr}`;

            // Get or create statement cycle for this month
            let cycleIdForMonth = statementCycleId;
            if (month !== cycleMonthYear.month + 1 || year !== cycleMonthYear.year) {
                const { data: cycle, error: cycleError } = await supabase
                    .from('statement_cycles')
                    .select('id')
                    .eq('month_year', monthYearStr)
                    .maybeSingle();

                if (cycleError && cycleError.code !== 'PGRST116') throw cycleError;
                cycleIdForMonth = cycle?.id || null;

                if (!cycleIdForMonth) {
                    const { data: newCycle, error: createError } = await supabase
                        .from('statement_cycles')
                        .insert({ month_year: monthYearStr, status: 'active' })
                        .select('id')
                        .single();

                    if (createError) throw createError;
                    cycleIdForMonth = newCycle.id;
                }
            }

            // Find specific month data
            const monthData = (extractedData.monthly_balances || []).find(
                (mb: any) => mb.month === month && mb.year === year
            ) || {
                month,
                year,
                opening_balance: null,
                closing_balance: null,
                statement_page: 1,
                is_verified: false
            };

            // Prepare statement data for this month
            const statementData = {
                bank_id: bank.id,
                company_id: bank.company_id,
                statement_cycle_id: cycleIdForMonth,
                statement_month: month - 1,
                statement_year: year,
                statement_document: documentPaths,
                statement_extractions: {
                    ...extractedData,
                    opening_balance: monthData.opening_balance,
                    closing_balance: monthData.closing_balance,
                    monthly_balances: [monthData]
                },
                has_soft_copy: true,
                has_hard_copy: false,
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

            // Check if statement exists for this month
            const { data: existingMonthStatement } = await supabase
                .from('acc_cycle_bank_statements')
                .select('id')
                .eq('bank_id', bank.id)
                .eq('statement_month', month - 1)
                .eq('statement_year', year)
                .maybeSingle();

            if (existingMonthStatement) {
                // Update existing statement
                await supabase
                    .from('acc_cycle_bank_statements')
                    .update(statementData)
                    .eq('id', existingMonthStatement.id);
            } else {
                // Create new statement
                await supabase
                    .from('acc_cycle_bank_statements')
                    .insert(statementData);
            }
        }
    }

    function parseStatementPeriod(periodString: string | null) {
        if (!periodString) return null;

        // Try common formats
        const formats = [
            // "January 2023 - March 2024"
            /^(?<startMonth>\w+)\s+(?<startYear>\d{4})\s*(?:-|to)\s*(?<endMonth>\w+)\s+(?<endYear>\d{4})$/i,
            // "Jan 2023 - Mar 2024"
            /^(?<startMonth>\w{3})\s+(?<startYear>\d{4})\s*(?:-|to)\s*(?<endMonth>\w{3})\s+(?<endYear>\d{4})$/i,
            // "01/2023 - 03/2024"
            /^(?<startMonth>\d{2})\/(?<startYear>\d{4})\s*(?:-|to)\s*(?<endMonth>\d{2})\/(?<endYear>\d{4})$/,
            // "January 2023" (single month)
            /^(?<startMonth>\w+)\s+(?<startYear>\d{4})$/i
        ];

        for (const format of formats) {
            const match = periodString.match(format);
            if (match) {
                const startMonth = new Date(`${match.groups?.startMonth} 1, 2000`).getMonth() + 1;
                const startYear = parseInt(match.groups?.startYear || '0');
                let endMonth = startMonth;
                let endYear = startYear;

                if (match.groups?.endMonth && match.groups?.endYear) {
                    endMonth = new Date(`${match.groups.endMonth} 1, 2000`).getMonth() + 1;
                    endYear = parseInt(match.groups.endYear);
                }

                if (startMonth && startYear) {
                    return { startMonth, startYear, endMonth, endYear };
                }
            }
        }

        return null;
    }

    function generateMonthRange(startMonth: number, startYear: number, endMonth: number, endYear: number) {
        const months: { month: number; year: number }[] = [];

        for (let year = startYear; year <= endYear; year++) {
            const monthStart = year === startYear ? startMonth : 1;
            const monthEnd = year === endYear ? endMonth : 12;

            for (let month = monthStart; month <= monthEnd; month++) {
                months.push({ month, year });
            }
        }

        return months;
    }

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
                            onClick={() => handleUpload(null)}
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
                    onProceed={async (data) => {
                        setShowValidationDialog(false);
                        await handleUpload(data);
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