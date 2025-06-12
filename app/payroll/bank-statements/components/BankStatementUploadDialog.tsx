// @ts-nocheck
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
import { Loader2, Upload, AlertTriangle, UploadCloud, FileText, Sheet, Building, Landmark, CreditCard, DollarSign, Calendar } from 'lucide-react';
import { BankValidationDialog } from './BankValidationDialog'; // Ensure correct import path
import { performBankStatementExtraction } from '@/lib/bankExtractionUtils'; // Ensure correct import path

// --- Interfaces & Types ---
interface Bank { id: number; bank_name: string; account_number: string; bank_currency: string; company_id: number; company_name: string; }
interface BankStatement { id: string; has_soft_copy: boolean; has_hard_copy: boolean; statement_document: { statement_pdf: string | null; }; statement_extractions: any; validation_status: any; status: any; }
interface ValidationResult { isValid: boolean; mismatches: string[]; extractedData: any; }
interface BankStatementUploadDialogProps { isOpen: boolean; onClose: () => void; bank: Bank; cycleMonth: number; cycleYear: number; onStatementUploaded: (statement: BankStatement) => void; existingStatement: BankStatement | null; statementCycleId: string | null; }

// --- Main Component ---
export function BankStatementUploadDialog({ isOpen, onClose, bank, cycleMonth, cycleYear, onStatementUploaded, existingStatement, statementCycleId }: BankStatementUploadDialogProps) {
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
            setValidationResult(null); // Clear previous validation result on open
            setHasSoftCopy(existingStatement?.has_soft_copy ?? true);
            setHasHardCopy(existingStatement?.has_hard_copy ?? false);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
        }
    }, [isOpen, existingStatement]);

    const handleUpload = async (forceProceed = false) => {
        if (!pdfFile && !existingStatement) {
            toast({ title: 'File Missing', description: 'Please select a PDF file.', variant: 'destructive' });
            return;
        }
        setIsProcessing(true);
        setStatusMessage('Starting...');

        try {
            // Use a local variable to hold the validation result for this run.
            let currentValidationResult = validationResult;

            // Step 1: Extract & Validate ONLY if a new file exists and hasn't been validated yet.
            if (pdfFile && !currentValidationResult) {
                setStatusMessage('Extracting data...');
                const fileUrl = URL.createObjectURL(pdfFile);
                try {
                    const extraction = await performBankStatementExtraction(fileUrl, { month: cycleMonth, year: cycleYear });
                    if (!extraction.success) throw new Error(extraction.message || 'Failed to extract data.');
                    // For now, we assume validation is complex and handled in the dialog.
                    // Let's create a placeholder result.
                    currentValidationResult = { isValid: false, mismatches: ["Needs review"], extractedData: extraction.extractedData };
                    setValidationResult(currentValidationResult); // Save result to state
                } finally {
                    URL.revokeObjectURL(fileUrl);
                }
            }

            // Step 2: If validation issues exist and we are NOT forcing, show the dialog.
            if (currentValidationResult && !currentValidationResult.isValid && !forceProceed) {
                setShowValidationDialog(true);
                setIsProcessing(false);
                return;
            }

            // Step 3: Upload files and save data.
            setStatusMessage('Uploading files...');
            let pdfPath = existingStatement?.statement_document?.statement_pdf || null;
            if (pdfFile) {
                const filePath = `statement_documents/${cycleYear}/${cycleMonth + 1}/${bank.company_id}/bank_${bank.id}_${Date.now()}.pdf`;
                const { data, error } = await supabase.storage.from('Statement-Cycle').upload(filePath, pdfFile, { upsert: true });
                if (error) throw error;
                pdfPath = data.path;
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
                statement_document: { statement_pdf: pdfPath },
                statement_extractions: currentValidationResult?.extractedData || existingStatement?.statement_extractions || {},
                validation_status: currentValidationResult ? { is_validated: currentValidationResult.isValid, mismatches: currentValidationResult.mismatches, validation_date: new Date().toISOString() } : (existingStatement?.validation_status || {}),
                status: { ...existingStatement?.status, status: 'pending_validation' }
            };

            const { data: upsertedStatement, error } = await supabase.from('acc_cycle_bank_statements').upsert(dataToSave).select().single();
            if (error) throw error;

            toast({ title: 'Success', description: 'Bank statement processed successfully.' });
            onStatementUploaded(upsertedStatement);
            onClose();

        } catch (error) {
            toast({ title: 'Upload Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}><DialogContent className="sm:max-w-2xl">{/* Dialog UI */}</DialogContent></Dialog>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <div className="bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50 -mx-6 -mt-6 p-6 rounded-t-lg border-b border-blue-200">
                            <div className="mb-2 flex justify-center"><div className="h-14 w-14 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shadow-sm"><UploadCloud className="h-7 w-7 text-blue-600" /></div></div>
                            <DialogTitle className="text-center text-xl text-blue-800">Upload Bank Statement</DialogTitle>
                            <p className="text-center text-blue-600 text-sm mt-1">{bank.company_name}</p>
                        </div>
                    </DialogHeader>
                    <div className="space-y-4 py-4 mt-2">
                        {/* Info Section */}
                        <div className="bg-gradient-to-r from-blue-50/80 to-blue-50/40 rounded-md p-4 border border-blue-100 shadow-sm">
                            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                                <div className="col-span-3"><h3 className="text-sm font-medium text-blue-800 border-b border-blue-100 pb-1 mb-2">Company Information</h3><div className="flex items-center gap-2"><Building className="h-4 w-4 text-blue-600" /><span className="font-medium">{bank.company_name}</span></div></div>
                                <div><h3 className="text-sm font-medium text-blue-800 border-b border-blue-100 pb-1 mb-2">Bank Details</h3><div className="space-y-1.5"><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-blue-600" /><span className="font-medium">{bank.bank_name}</span></div><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-600" /><span className="font-mono text-xs">{bank.account_number}</span></div></div></div>
                                <div><h3 className="text-sm font-medium text-blue-800 border-b border-blue-100 pb-1 mb-2">Currency</h3><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-blue-600" /><span className="font-medium">{bank.bank_currency}</span></div></div>
                                <div><h3 className="text-sm font-medium text-blue-800 border-b border-blue-100 pb-1 mb-2">Statement Period</h3><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-600" /><span className="font-medium">{format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')}</span></div></div>
                            </div>
                        </div>
                        {/* File Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="pdf-file" className="flex items-center gap-1.5"><FileText className="h-4 w-4 text-blue-600" />Bank Statement PDF</Label>
                                <Input id="pdf-file" ref={pdfInputRef} type="file" accept=".pdf" onChange={(e) => { setPdfFile(e.target.files?.[0] || null); setValidationResult(null); }} disabled={isProcessing} className="cursor-pointer file:bg-blue-50 file:text-blue-700 file:border-blue-200 hover:file:bg-blue-100" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="excel-file" className="flex items-center gap-1.5"><Sheet className="h-4 w-4 text-emerald-600" />Bank Statement Excel (Optional)</Label>
                                <Input id="excel-file" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} disabled={isProcessing} className="cursor-pointer file:bg-emerald-50 file:text-emerald-700 file:border-emerald-200 hover:file:bg-emerald-100" />
                            </div>
                        </div>
                        {/* Checkboxes and Alert */}
                        <div className="flex flex-row gap-6 mt-2 p-4 bg-slate-50/80 rounded-md border border-slate-200">
                            <div className="flex items-center space-x-2"><Checkbox id="has-soft-copy" checked={hasSoftCopy} onCheckedChange={(checked) => setHasSoftCopy(!!checked)} disabled={isProcessing} /><Label htmlFor="has-soft-copy">Has Soft Copy</Label></div>
                            <div className="flex items-center space-x-2"><Checkbox id="has-hard-copy" checked={hasHardCopy} onCheckedChange={(checked) => setHasHardCopy(!!checked)} disabled={isProcessing} /><Label htmlFor="has-hard-copy">Has Hard Copy</Label></div>
                        </div>
                        {existingStatement && (<Alert className="bg-amber-50 border-amber-200 text-amber-800"><AlertTriangle className="h-4 w-4 text-amber-600" /><div className="ml-2"><AlertTitle>Updating Existing Statement</AlertTitle><AlertDescription>New uploads will replace the current files.</AlertDescription></div></Alert>)}
                    </div>
                    <DialogFooter className="bg-gradient-to-r from-slate-50 to-blue-50 -mx-6 -mb-6 p-4 border-t flex items-center justify-between">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>Cancel</Button>
                        <Button type="button" onClick={() => handleUpload(false)} disabled={isProcessing || (!pdfFile && !existingStatement)} className="min-w-[120px]">
                            {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{statusMessage}</> : <><Upload className="mr-2 h-4 w-4" />Upload & Validate</>}
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
                    onProceed={() => {
                        setShowValidationDialog(false);
                        handleUpload(true); // Force proceed past validation
                    }}
                    onCancel={() => setShowValidationDialog(false)}
                    cycleMonth={cycleMonth}
                    cycleYear={cycleYear}
                />
            )}
        </>
    );
}