// BankStatementUploadDialog.tsx
// @ts-nocheck
import { useState, useRef } from 'react'
import { Loader2, Upload, AlertTriangle, CheckCircle } from 'lucide-react'
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

interface BankStatementUploadDialogProps {
    isOpen: boolean
    onClose: () => void
    bank: Bank
    cycleMonth: number
    cycleYear: number
    onStatementUploaded: (statement: BankStatement) => void
    existingStatement: BankStatement | null
}

export function BankStatementUploadDialog({
    isOpen,
    onClose,
    bank,
    cycleMonth,
    cycleYear,
    onStatementUploaded,
    existingStatement
}: BankStatementUploadDialogProps) {
    const [pdfFile, setPdfFile] = useState<File | null>(null)
    const [excelFile, setExcelFile] = useState<File | null>(null)
    const [hasSoftCopy, setHasSoftCopy] = useState<boolean>(existingStatement?.has_soft_copy || false)
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

        return {
            isValid: mismatches.length === 0,
            mismatches,
            extractedData: extracted
        }
    }

    const handleUpload = async (proceed: boolean = true) => {
        if (!pdfFile && !hasSoftCopy) {
            toast({
                title: 'Validation Error',
                description: 'Please upload a PDF file or check "Has Soft Copy"',
                variant: 'destructive'
            })
            return
        }

        try {
            setUploading(true)

            // If we have a PDF file, first extract data for validation
            if (pdfFile && !validationResult && proceed) {
                setExtracting(true)

                // Generate a temporary URL for the file
                const fileUrl = URL.createObjectURL(pdfFile)

                try {
                    // Extract data from the PDF
                    const extractionResult = await performBankStatementExtraction(
                        fileUrl,
                        {
                            month: cycleMonth,
                            year: cycleYear
                        }
                    )

                    // Validate the extracted data
                    const validation = validateExtractedData(extractionResult.extractedData)
                    setValidationResult(validation)

                    // If there are mismatches, show validation dialog
                    if (!validation.isValid) {
                        setShowValidation(true)
                        setExtracting(false)
                        setUploading(false)
                        return
                    }
                } catch (error) {
                    console.error('Extraction error:', error)
                    toast({
                        title: 'Extraction Error',
                        description: 'Failed to extract data from the PDF. Proceeding with upload only.',
                        variant: 'destructive'
                    })
                } finally {
                    URL.revokeObjectURL(fileUrl)
                    setExtracting(false)
                }
            }

            // Upload files to storage
            let pdfPath = existingStatement?.statement_document.statement_pdf || null
            let excelPath = existingStatement?.statement_document.statement_excel || null

            // Upload PDF if provided
            if (pdfFile) {
                const pdfFileName = `bank_statement_${bank.company_id}_${bank.id}_${cycleYear}_${cycleMonth}.pdf`
                const pdfFilePath = `bank_statements/${cycleYear}/${cycleMonth}/${bank.company_id}/${pdfFileName}`

                const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                    .from('Payroll-Cycle')
                    .upload(pdfFilePath, pdfFile, {
                        cacheControl: '3600',
                        upsert: true
                    })

                if (pdfUploadError) throw pdfUploadError

                pdfPath = pdfUploadData.path
            }

            // Upload Excel if provided
            if (excelFile) {
                const excelFileName = `bank_statement_${bank.company_id}_${bank.id}_${cycleYear}_${cycleMonth}.xlsx`
                const excelFilePath = `bank_statements/${cycleYear}/${cycleMonth}/${bank.company_id}/${excelFileName}`

                const { data: excelUploadData, error: excelUploadError } = await supabase.storage
                    .from('Payroll-Cycle')
                    .upload(excelFilePath, excelFile, {
                        cacheControl: '3600',
                        upsert: true
                    })

                if (excelUploadError) throw excelUploadError

                excelPath = excelUploadData.path
            }

            // Prepare statement data
            const statementData = {
                bank_id: bank.id,
                company_id: bank.company_id,
                statement_month: cycleMonth,
                statement_year: cycleYear,
                statement_document: {
                    statement_pdf: pdfPath,
                    statement_excel: excelPath
                },
                has_soft_copy: hasSoftCopy,
                has_hard_copy: hasHardCopy
            }

            // If we have extracted data from validation, include it
            if (validationResult) {
                Object.assign(statementData, {
                    statement_extractions: validationResult.extractedData,
                    validation_status: {
                        is_validated: validationResult.isValid,
                        validation_date: new Date().toISOString(),
                        validated_by: null,
                        mismatches: validationResult.mismatches
                    }
                })
            }

            // Create or update record in database
            let statement: BankStatement

            if (existingStatement) {
                // Update existing statement
                const { data, error } = await supabase
                    .from('acc_cycle_bank_statements ')
                    .update(statementData)
                    .eq('id', existingStatement.id)
                    .select('*')
                    .single()

                if (error) throw error
                statement = data
            } else {
                // Create new statement
                const { data, error } = await supabase
                    .from('acc_cycle_bank_statements ')
                    .insert(statementData)
                    .select('*')
                    .single()

                if (error) throw error
                statement = data
            }

            // Notify parent component
            onStatementUploaded(statement)
            resetForm()

            toast({
                title: 'Success',
                description: 'Bank statement uploaded successfully'
            })
        } catch (error) {
            console.error('Upload error:', error)
            toast({
                title: 'Upload Error',
                description: 'Failed to upload bank statement',
                variant: 'destructive'
            })
        } finally {
            setUploading(false)
        }
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => {
                if (!open) resetForm()
                onClose()
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Upload Bank Statement</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="bank-name" className="text-right">Bank</Label>
                                <span className="font-medium text-primary">{bank.bank_name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="account-number" className="text-right">Account Number</Label>
                                <span className="font-medium">{bank.account_number}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="currency" className="text-right">Currency</Label>
                                <span className="font-medium">{bank.bank_currency}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="period" className="text-right">Statement Period</Label>
                                <span className="font-medium">
                                    {format(new Date(cycleYear, cycleMonth - 1, 1), 'MMMM yyyy')}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pdf-file">Bank Statement PDF</Label>
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
                                className="cursor-pointer"
                            />
                            {existingStatement?.statement_document.statement_pdf && (
                                <div className="flex items-center text-sm text-muted-foreground">
                                    <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                                    Existing PDF will be replaced if you upload a new one
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="excel-file">Bank Statement Excel (Optional)</Label>
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
                                className="cursor-pointer"
                            />
                            {existingStatement?.statement_document.statement_excel && (
                                <div className="flex items-center text-sm text-muted-foreground">
                                    <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                                    Existing Excel will be replaced if you upload a new one
                                </div>
                            )}
                        </div>

                        <div className="flex items-center space-x-2 mt-4">
                            <Checkbox
                                id="has-soft-copy"
                                checked={hasSoftCopy}
                                onCheckedChange={(checked) => setHasSoftCopy(!!checked)}
                                disabled={uploading}
                            />
                            <Label htmlFor="has-soft-copy">Has Soft Copy</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="has-hard-copy"
                                checked={hasHardCopy}
                                onCheckedChange={(checked) => setHasHardCopy(!!checked)}
                                disabled={uploading}
                            />
                            <Label htmlFor="has-hard-copy">Has Hard Copy</Label>
                        </div>

                        {existingStatement && (
                            <Alert>
                                <AlertTitle className="flex items-center">
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    Note
                                </AlertTitle>
                                <AlertDescription>
                                    You are updating an existing bank statement. New uploads will replace existing files.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter className="sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={uploading || extracting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => handleUpload()}
                            disabled={uploading || extracting}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading
                                </>
                            ) : extracting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Extracting Data
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
                />
            )}
        </>
    )
}