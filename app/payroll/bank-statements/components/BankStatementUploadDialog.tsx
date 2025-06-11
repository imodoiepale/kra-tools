// @ts-nocheck
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, AlertTriangle, CheckCircle, UploadCloud, FileText, Sheet, Building, Landmark, CreditCard, DollarSign, Calendar } from 'lucide-react';
import { BankValidationDialog } from './BankValidationDialog';
import { performBankStatementExtraction } from '@/lib/bankExtractionUtils';

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
}

interface BankStatement {
    id: string;
    // other properties
}

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
    const { toast } = useToast();
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [hasSoftCopy, setHasSoftCopy] = useState<boolean>(existingStatement?.has_soft_copy ?? true);
    const [hasHardCopy, setHasHardCopy] = useState<boolean>(existingStatement?.has_hard_copy ?? false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    const pdfInputRef = useRef<HTMLInputElement>(null);
    const excelInputRef = useRef<HTMLInputElement>(null);

    const resetForm = useCallback(() => {
        setPdfFile(null);
        setExcelFile(null);
        setHasSoftCopy(true);
        setHasHardCopy(false);
        setIsProcessing(false);
        if (pdfInputRef.current) pdfInputRef.current.value = '';
        if (excelInputRef.current) excelInputRef.current.value = '';
    }, []);

    const handleDialogClose = () => {
        resetForm();
        onClose();
    };

    const handleUpload = async () => {
        if (!pdfFile && !existingStatement) {
            toast({ title: 'File Missing', description: 'Please select a PDF file to upload.', variant: 'destructive' });
            return;
        }
        if (!statementCycleId) {
            toast({ title: 'Error', description: 'Statement cycle is not available. Cannot upload.', variant: 'destructive' });
            return;
        }

        setIsProcessing(true);
        try {
            // This is where you would call the centralized function from the hook
            // For now, we'll implement the logic directly but it should be moved.
            let extractedData = existingStatement?.statement_extractions || null;
            let pdfPath = existingStatement?.statement_document?.statement_pdf || null;
            let excelPath = existingStatement?.statement_document?.statement_excel || null;

            if (pdfFile) {
                const fileUrl = URL.createObjectURL(pdfFile);
                try {
                    const extraction = await performBankStatementExtraction(fileUrl, { month: cycleMonth, year: cycleYear });
                    extractedData = extraction.extractedData;
                } catch (extractionError) {
                    toast({ title: 'Extraction Warning', description: `Could not fully extract data, but proceeding with upload. ${extractionError.message}`, variant: 'default' });
                } finally {
                    URL.revokeObjectURL(fileUrl);
                }

                const filePath = `statement_documents/${cycleYear}/${cycleMonth + 1}/${bank.company_id}/bank_${bank.id}_${Date.now()}.pdf`;
                const { data, error } = await supabase.storage.from('Statement-Cycle').upload(filePath, pdfFile, { upsert: true });
                if (error) throw error;
                pdfPath = data.path;
            }

            if (excelFile) {
                const excelFilePath = `statement_documents/${cycleYear}/${cycleMonth + 1}/${bank.company_id}/bank_${bank.id}_${Date.now()}.xlsx`;
                const { data, error } = await supabase.storage.from('Statement-Cycle').upload(excelFilePath, excelFile, { upsert: true });
                if (error) throw error;
                excelPath = data.path;
            }

            const statementData = {
                id: existingStatement?.id,
                bank_id: bank.id,
                company_id: bank.company_id,
                statement_cycle_id: statementCycleId,
                statement_month: cycleMonth,
                statement_year: cycleYear,
                has_soft_copy: hasSoftCopy,
                has_hard_copy: hasHardCopy,
                statement_document: { statement_pdf: pdfPath, statement_excel: excelPath },
                statement_extractions: extractedData,
                validation_status: { is_validated: false, mismatches: [] },
                status: { status: 'pending_validation' },
                quickbooks_balance: existingStatement?.quickbooks_balance,
            };

            const { data: upsertedStatement, error: upsertError } = await supabase
                .from('acc_cycle_bank_statements')
                .upsert(statementData, { onConflict: 'id' })
                .select()
                .single();

            if (upsertError) throw upsertError;

            toast({ title: 'Success', description: 'Bank statement processed successfully.' });
            onStatementUploaded(upsertedStatement);

        } catch (error) {
            console.error("Upload failed:", error);
            toast({ title: 'Upload Error', description: `Upload failed: ${error.message}`, variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
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
                                    <div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-blue-600" /><span className="font-medium">{bank.bank_name}</span></div>
                                    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-600" /><span className="font-mono text-xs">{bank.account_number}</span></div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-blue-800 border-b border-blue-100 pb-1 mb-2">Currency</h3>
                                <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-blue-600" /><span className="font-medium">{bank.bank_currency}</span></div>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-blue-800 border-b border-blue-100 pb-1 mb-2">Statement Period</h3>
                                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-600" /><span className="font-medium">{format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')}</span></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="pdf-file" className="flex items-center gap-1.5"><FileText className="h-4 w-4 text-blue-600" />Bank Statement PDF</Label>
                            <Input id="pdf-file" ref={pdfInputRef} type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} disabled={isProcessing} className="cursor-pointer file:bg-blue-50 file:text-blue-700 file:border-blue-200 hover:file:bg-blue-100 file:mr-4 file:px-3 file:py-2 file:rounded-md file:transition-colors" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="excel-file" className="flex items-center gap-1.5"><Sheet className="h-4 w-4 text-emerald-600" />Bank Statement Excel (Optional)</Label>
                            <Input id="excel-file" ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} disabled={isProcessing} className="cursor-pointer file:bg-emerald-50 file:text-emerald-700 file:border-emerald-200 hover:file:bg-emerald-100 file:mr-4 file:px-3 file:py-2 file:rounded-md file:transition-colors" />
                        </div>
                    </div>

                    <div className="flex flex-row gap-6 mt-2 p-4 bg-slate-50/80 rounded-md border border-slate-200">
                        <div className="flex items-center space-x-2"><Checkbox id="has-soft-copy" checked={hasSoftCopy} onCheckedChange={(checked) => setHasSoftCopy(!!checked)} disabled={isProcessing} /><Label htmlFor="has-soft-copy">Has Soft Copy</Label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="has-hard-copy" checked={hasHardCopy} onCheckedChange={(checked) => setHasHardCopy(!!checked)} disabled={isProcessing} /><Label htmlFor="has-hard-copy">Has Hard Copy</Label></div>
                    </div>

                    {existingStatement && (
                        <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <div className="ml-2">
                                <AlertTitle className="text-sm font-medium text-amber-800">Updating Existing Statement</AlertTitle>
                                <AlertDescription className="text-xs text-amber-700">New uploads will replace the current files and may re-extract data.</AlertDescription>
                            </div>
                        </Alert>
                    )}
                </div>

                <DialogFooter className="bg-gradient-to-r from-slate-50 to-blue-50 -mx-6 -mb-6 p-4 border-t flex items-center justify-between">
                    <Button type="button" variant="outline" onClick={handleDialogClose} disabled={isProcessing}>Cancel</Button>
                    <Button type="button" onClick={handleUpload} disabled={isProcessing || (!pdfFile && !existingStatement)}>
                        {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><Upload className="mr-2 h-4 w-4" />Upload Statement</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}