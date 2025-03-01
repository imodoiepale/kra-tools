// @ts-nocheck
import { useState, useRef, useEffect } from 'react'
import {
    Loader2, Upload, AlertTriangle, CheckCircle, UploadCloud,
    FileText, Building, Landmark, CreditCard, DollarSign,
    Calendar, X, ArrowRight, FileCheck, FilePlus, FileWarning,
    ChevronDown, ChevronRight, Save, Eye
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
import { performBankStatementExtraction } from '@/lib/bankExtractionUtils'
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
    CardFooter,
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

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
}

interface BulkUploadItem {
    file: File
    status: 'pending' | 'processing' | 'matched' | 'unmatched' | 'failed' | 'uploaded' | 'vouched'
    extractedData: any
    matchedBank?: Bank
    closingBalance?: number | null
    error?: string
    matchConfidence?: number
    uploadProgress?: number
    isVouched?: boolean
    vouchNotes?: string
    hasSoftCopy?: boolean
    hasHardCopy?: boolean
}

// Group by company for the vouching process
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
    const [activeTab, setActiveTab] = useState<string>('upload')
    const [uploadItems, setUploadItems] = useState<BulkUploadItem[]>([])
    const [uploading, setUploading] = useState<boolean>(false)
    const [processingIndex, setProcessingIndex] = useState<number>(-1)
    const [overallProgress, setOverallProgress] = useState<number>(0)
    const [totalMatched, setTotalMatched] = useState<number>(0)
    const [totalUnmatched, setTotalUnmatched] = useState<number>(0)
    const [companyGroups, setCompanyGroups] = useState<CompanyGroup[]>([])
    const [showValidation, setShowValidation] = useState<boolean>(false)
    const [currentValidationItem, setCurrentValidationItem] = useState<{ item: BulkUploadItem, index: number } | null>(null)
    const [validationResult, setValidationResult] = useState<any>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const { toast } = useToast()

    // Effect to organize items by company after processing
    useEffect(() => {
        if (activeTab === 'vouching') {
            organizeByCompany();
        }
    }, [activeTab, uploadItems]);

    const organizeByCompany = () => {
        // Only include matched/uploaded items
        const validItems = uploadItems.filter(item =>
            item.status === 'matched' || item.status === 'uploaded' || item.status === 'vouched'
        );

        // Group by company
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

        // Ensure only one company is expanded at a time - expand first non-vouched company
        const firstNonVouchedIndex = groupedByCompany.findIndex(g => !g.isVouched);

        if (firstNonVouchedIndex >= 0) {
            groupedByCompany.forEach((group, index) => {
                group.isExpanded = index === firstNonVouchedIndex;
            });
        } else if (groupedByCompany.length > 0) {
            // If all are vouched, expand the first one
            groupedByCompany[0].isExpanded = true;
        }

        setCompanyGroups(groupedByCompany);
    };

    const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files
        if (!files || files.length === 0) return

        const fileArray = Array.from(files)
        const newItems: BulkUploadItem[] = fileArray.map(file => ({
            file,
            status: 'pending',
            extractedData: null,
            uploadProgress: 0,
            hasSoftCopy: true,
            hasHardCopy: false,
            isVouched: false
        }))

        setUploadItems([...uploadItems, ...newItems])

        // Reset the file input
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

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
        // Update all statements for this company
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

        // Update company group
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

        // Move to next unvouched company
        if (isVouched) {
            const nextNonVouchedGroup = companyGroups.find(g =>
                !g.isVouched && g.companyId !== companyId
            );

            if (nextNonVouchedGroup) {
                toggleCompanyExpansion(nextNonVouchedGroup.companyId);
            }
        }
    };

    const handleStartProcessing = async () => {
        if (uploadItems.length === 0) {
            toast({
                title: 'No files selected',
                description: 'Please select bank statement files to upload',
                variant: 'destructive'
            })
            return
        }

        if (!statementCycleId) {
            toast({
                title: 'Error',
                description: 'No active statement cycle found',
                variant: 'destructive'
            })
            return
        }

        setUploading(true)
        setActiveTab('processing')
        setTotalMatched(0)
        setTotalUnmatched(0)

        // Process each file sequentially
        for (let i = 0; i < uploadItems.length; i++) {
            if (uploadItems[i].status === 'uploaded' || uploadItems[i].status === 'vouched') continue

            setProcessingIndex(i)
            setOverallProgress(Math.floor((i / uploadItems.length) * 100))

            try {
                // Update status to processing
                setUploadItems(items => {
                    const updated = [...items]
                    updated[i] = {
                        ...updated[i],
                        status: 'processing',
                        uploadProgress: 10
                    }
                    return updated
                })

                // Step 1: Extract data from PDF
                const fileUrl = URL.createObjectURL(uploadItems[i].file)
                const extractionResult = await performBankStatementExtraction(
                    fileUrl,
                    {
                        month: cycleMonth,
                        year: cycleYear
                    },
                    (message) => {
                        console.log(`File ${i + 1}/${uploadItems.length}: ${message}`)
                        // Increment progress during extraction
                        setUploadItems(items => {
                            const updated = [...items]
                            updated[i] = {
                                ...updated[i],
                                uploadProgress: Math.min(40, (updated[i].uploadProgress || 0) + 5)
                            }
                            return updated
                        })
                    }
                )

                // Cleanup URL
                URL.revokeObjectURL(fileUrl)

                if (!extractionResult.success) throw new Error('Failed to extract data from PDF')

                // Update with extracted data
                setUploadItems(items => {
                    const updated = [...items]
                    updated[i] = {
                        ...updated[i],
                        extractedData: extractionResult.extractedData,
                        uploadProgress: 50
                    }
                    return updated
                })

                // Step 2: Try to match with a bank
                const matchedBank = findMatchingBank(extractionResult.extractedData, banks)

                if (matchedBank) {
                    setUploadItems(items => {
                        const updated = [...items]
                        updated[i] = {
                            ...updated[i],
                            status: 'matched',
                            matchedBank,
                            uploadProgress: 70
                        }
                        return updated
                    })
                    setTotalMatched(prev => prev + 1)

                    // Validate the extracted data against the matched bank
                    const validation = validateExtractedData(extractionResult.extractedData, matchedBank);

                    // If there are critical mismatches, pause for validation
                    const criticalMismatches = validation.mismatches.filter(mismatch =>
                        !mismatch.toLowerCase().includes('period')
                    );

                    if (criticalMismatches.length > 0) {
                        setCurrentValidationItem({ item: uploadItems[i], index: i });
                        setValidationResult(validation);
                        setShowValidation(true);
                        setUploading(false);
                        return;
                    }

                    // Proceed with upload if no critical mismatches
                    await uploadStatementFile(i, matchedBank);

                } else {
                    setUploadItems(items => {
                        const updated = [...items]
                        updated[i] = {
                            ...updated[i],
                            status: 'unmatched',
                            uploadProgress: 60,
                            error: 'No matching bank found'
                        }
                        return updated
                    })
                    setTotalUnmatched(prev => prev + 1)
                    continue // Skip to next file
                }

            } catch (error) {
                console.error(`Error processing file ${i}:`, error)
                setUploadItems(items => {
                    const updated = [...items]
                    updated[i] = {
                        ...updated[i],
                        status: 'failed',
                        error: error.message || 'Unknown error occurred'
                    }
                    return updated
                })
            }
        }

        setProcessingIndex(-1)
        setOverallProgress(100)
        setUploading(false)

        toast({
            title: 'Upload Complete',
            description: `Successfully processed ${totalMatched} statements. ${totalUnmatched} items couldn't be matched.`
        })

        // Move to vouching tab if we have matched statements
        if (totalMatched > 0) {
            setActiveTab('vouching');
        } else {
            setActiveTab('review');
        }

        onUploadsComplete()
    }

    const validateExtractedData = (extracted: any, bank: Bank): any => {
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
        if (extracted.currency &&
            normalizeCurrencyCode(extracted.currency) !== normalizeCurrencyCode(bank.bank_currency)) {
            mismatches.push(`Currency mismatch: Expected "${bank.bank_currency}", found "${extracted.currency}"`)
        }

        // Validate company name if available
        if (extracted.company_name && bank.company_name &&
            !extracted.company_name.toLowerCase().includes(bank.company_name.toLowerCase()) &&
            !bank.company_name.toLowerCase().includes(extracted.company_name.toLowerCase())) {
            mismatches.push(`Company name mismatch: Expected "${bank.company_name}", found "${extracted.company_name}"`)
        }

        return {
            isValid: mismatches.length === 0,
            mismatches,
            extractedData: extracted
        }
    }

    const uploadStatementFile = async (index: number, bank: Bank) => {
        try {
            // Upload file to storage
            const pdfFileName = `bank_statement_${bank.company_id}_${bank.id}_${cycleYear}_${cycleMonth}.pdf`
            const pdfFilePath = `statement_documents/${cycleYear}/${cycleMonth}/${bank.company_id}/${pdfFileName}`

            const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                .from('Statement-Cycle')
                .upload(pdfFilePath, uploadItems[index].file, {
                    cacheControl: '3600',
                    upsert: true
                })

            if (pdfUploadError) throw pdfUploadError

            setUploadItems(items => {
                const updated = [...items]
                updated[index] = {
                    ...updated[index],
                    uploadProgress: 90
                }
                return updated
            })

            // Create statement record in database
            const baseStatementData = {
                bank_id: bank.id,
                company_id: bank.company_id,
                statement_cycle_id: statementCycleId,
                statement_month: cycleMonth,
                statement_year: cycleYear,
                statement_document: {
                    statement_pdf: pdfUploadData.path,
                    statement_excel: null,
                    document_size: uploadItems[index].file.size
                },
                statement_extractions: uploadItems[index].extractedData,
                has_soft_copy: uploadItems[index].hasSoftCopy || true,
                has_hard_copy: uploadItems[index].hasHardCopy || false,
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
            }

            // Check if statement already exists for this bank/month
            const { data: existingStatement } = await supabase
                .from('acc_cycle_bank_statements')
                .select('id')
                .eq('bank_id', bank.id)
                .eq('statement_month', cycleMonth)
                .eq('statement_year', cycleYear)
                .single()

            if (existingStatement) {
                // Update existing statement
                await supabase
                    .from('acc_cycle_bank_statements')
                    .update(baseStatementData)
                    .eq('id', existingStatement.id)
            } else {
                // Create new statement
                await supabase
                    .from('acc_cycle_bank_statements')
                    .insert([baseStatementData])
            }

            // Update status to uploaded
            setUploadItems(items => {
                const updated = [...items]
                updated[index] = {
                    ...updated[index],
                    status: 'uploaded',
                    uploadProgress: 100
                }
                return updated
            })

            return true;
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }

    const handleContinueAfterValidation = async () => {
        if (!currentValidationItem) return;

        setShowValidation(false);
        setUploading(true);

        try {
            // Upload the file despite validation issues
            await uploadStatementFile(
                currentValidationItem.index,
                currentValidationItem.item.matchedBank!
            );

            // Continue processing remaining files
            const remainingFiles = uploadItems.filter(
                (item, idx) => idx > currentValidationItem.index && item.status === 'pending'
            );

            if (remainingFiles.length > 0) {
                handleStartProcessing();
            } else {
                setUploading(false);
                if (totalMatched > 0) {
                    setActiveTab('vouching');
                } else {
                    setActiveTab('review');
                }
            }
        } catch (error) {
            console.error('Error continuing after validation:', error);
            toast({
                title: 'Upload Error',
                description: 'Failed to upload statement after validation',
                variant: 'destructive'
            });
            setUploading(false);
        }

        setCurrentValidationItem(null);
        setValidationResult(null);
    }

    const handleCancelValidation = () => {
        setShowValidation(false);
        setCurrentValidationItem(null);
        setValidationResult(null);
        setActiveTab('review');
    }

    const handleManualUpload = async (index: number, bankId: number, closingBalance: number | null = null) => {
        if (!bankId) {
            toast({
                title: 'Error',
                description: 'Please select a bank',
                variant: 'destructive'
            })
            return
        }

        setUploadItems(items => {
            const updated = [...items]
            updated[index] = {
                ...updated[index],
                status: 'processing',
                uploadProgress: 10
            }
            return updated
        })

        try {
            // Find the selected bank
            const selectedBank = banks.find(b => b.id === bankId)
            if (!selectedBank) throw new Error('Selected bank not found')

            // Set as the matched bank
            setUploadItems(items => {
                const updated = [...items]
                updated[index] = {
                    ...updated[index],
                    matchedBank: selectedBank
                }
                return updated
            })

            // Upload the file
            await uploadStatementFile(index, selectedBank);

            // Update closing balance if provided
            if (closingBalance !== null) {
                await updateClosingBalance(index, closingBalance);
            }

            toast({
                title: 'Success',
                description: `Statement uploaded for ${selectedBank.company_name} / ${selectedBank.bank_name}`
            })

        } catch (error) {
            console.error('Error in manual upload:', error)
            setUploadItems(items => {
                const updated = [...items]
                updated[index] = {
                    ...updated[index],
                    status: 'failed',
                    error: error.message || 'Failed to upload statement'
                }
                return updated
            })

            toast({
                title: 'Upload Failed',
                description: error.message || 'Failed to upload statement',
                variant: 'destructive'
            })
        }
    }

    const updateClosingBalance = async (index: number, closingBalance: number) => {
        try {
            const item = uploadItems[index];
            if (!item.matchedBank) return;

            // Get the statement ID
            const { data: statement, error: getError } = await supabase
                .from('acc_cycle_bank_statements')
                .select('id, statement_extractions')
                .eq('bank_id', item.matchedBank.id)
                .eq('statement_month', cycleMonth)
                .eq('statement_year', cycleYear)
                .single();

            if (getError) throw getError;

            // Update the extracted data with new closing balance
            let updatedExtractions = { ...statement.statement_extractions };
            updatedExtractions.closing_balance = closingBalance;

            // Update monthly balances if they exist
            if (updatedExtractions.monthly_balances && Array.isArray(updatedExtractions.monthly_balances)) {
                updatedExtractions.monthly_balances = updatedExtractions.monthly_balances.map(balance => {
                    if (balance.month === cycleMonth && balance.year === cycleYear) {
                        return { ...balance, closing_balance: closingBalance };
                    }
                    return balance;
                });
            }

            // Update the statement record
            const { error: updateError } = await supabase
                .from('acc_cycle_bank_statements')
                .update({ statement_extractions: updatedExtractions })
                .eq('id', statement.id);

            if (updateError) throw updateError;

            // Update the local state
            setUploadItems(items => {
                const updated = [...items];
                if (updated[index].extractedData) {
                    updated[index].extractedData.closing_balance = closingBalance;
                }
                updated[index].closingBalance = closingBalance;
                return updated;
            });

            return true;
        } catch (error) {
            console.error('Error updating closing balance:', error);
            throw error;
        }
    }

    // Helper function to find matching bank based on extracted data
    const findMatchingBank = (extractedData: any, banks: Bank[]) => {
        if (!extractedData) return null

        let bestMatch: Bank | null = null
        let bestScore = 0

        for (const bank of banks) {
            let score = 0

            // Check bank name match
            if (extractedData.bank_name &&
                (bank.bank_name.toLowerCase().includes(extractedData.bank_name.toLowerCase()) ||
                    extractedData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase()))) {
                score += 3
            }

            // Check account number match - highest priority
            if (extractedData.account_number &&
                (bank.account_number.includes(extractedData.account_number) ||
                    extractedData.account_number.includes(bank.account_number))) {
                score += 5
            }

            // Check company name match
            if (extractedData.company_name && bank.company_name &&
                (bank.company_name.toLowerCase().includes(extractedData.company_name.toLowerCase()) ||
                    extractedData.company_name.toLowerCase().includes(bank.company_name.toLowerCase()))) {
                score += 2
            }

            // Check currency match
            if (extractedData.currency && bank.bank_currency &&
                normalizeCurrencyCode(extractedData.currency) === normalizeCurrencyCode(bank.bank_currency)) {
                score += 1
            }

            if (score > bestScore) {
                bestScore = score
                bestMatch = bank
            }
        }

        // Only return a match if score is high enough (at least account number or bank name match)
        return bestScore >= 3 ? bestMatch : null
    }

    // Helper function to normalize currency codes
    const normalizeCurrencyCode = (code: string) => {
        if (!code) return 'USD';
        const upperCode = code.toUpperCase().trim();
        const currencyMap: Record<string, string> = {
            'EURO': 'EUR',
            'EUROS': 'EUR',
            'US DOLLAR': 'USD',
            'US DOLLARS': 'USD',
            'USDOLLAR': 'USD',
            'POUND': 'GBP',
            'POUNDS': 'GBP',
            'STERLING': 'GBP',
            'KENYA SHILLING': 'KES',
            'KENYA SHILLINGS': 'KES',
            'KENYAN SHILLING': 'KES',
            'KENYAN SHILLINGS': 'KES',
            'KSH': 'KES',
            'K.SH': 'KES',
            'KSHS': 'KES',
            'K.SHS': 'KES',
            'SH': 'KES'
        };
        return currencyMap[upperCode] || upperCode;
    };

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

    const renderClosingBalanceInput = (item: BulkUploadItem, index: number) => {
        const [inputValue, setInputValue] = useState<string>(
            item.closingBalance !== undefined
                ? item.closingBalance?.toString()
                : item.extractedData?.closing_balance?.toString() || ''
        )

        return (
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    step="0.01"
                    placeholder="Closing Balance"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-32"
                />
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateClosingBalance(index, parseFloat(inputValue))}
                    disabled={!item.matchedBank || !inputValue}
                >
                    Update
                </Button>
            </div>
        )
    }

    const renderBankSelector = (item: BulkUploadItem, index: number) => {
        const [selectedBankId, setSelectedBankId] = useState<number>(item.matchedBank?.id || 0)
        const [closingBalance, setClosingBalance] = useState<string>('')
        const [softCopy, setSoftCopy] = useState<boolean>(item.hasSoftCopy || true)
        const [hardCopy, setHardCopy] = useState<boolean>(item.hasHardCopy || false)

        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <select
                        className="border rounded p-1 text-sm w-64"
                        value={selectedBankId}
                        onChange={(e) => setSelectedBankId(parseInt(e.target.value))}
                    >
                        <option value={0}>-- Select Bank --</option>
                        {banks.map(bank => (
                            <option key={bank.id} value={bank.id}>
                                {bank.company_name} / {bank.bank_name} / {bank.account_number}
                            </option>
                        ))}
                    </select>
                    <Input
                        type="number"
                        step="0.01"
                        placeholder="Closing Balance"
                        value={closingBalance}
                        onChange={(e) => setClosingBalance(e.target.value)}
                        className="w-32"
                    />
                </div>

                <div className="flex gap-4 mt-1">
                    <div className="flex items-center gap-1">
                        <Checkbox
                            id={`soft-copy-${index}`}
                            checked={softCopy}
                            onCheckedChange={(checked) => {
                                setSoftCopy(!!checked);
                                setUploadItems(items => {
                                    const updated = [...items];
                                    updated[index].hasSoftCopy = !!checked;
                                    return updated;
                                });
                            }}
                        />
                        <Label htmlFor={`soft-copy-${index}`} className="text-xs">Soft Copy</Label>
                    </div>

                    <div className="flex items-center gap-1">
                        <Checkbox
                            id={`hard-copy-${index}`}
                            checked={hardCopy}
                            onCheckedChange={(checked) => {
                                setHardCopy(!!checked);
                                setUploadItems(items => {
                                    const updated = [...items];
                                    updated[index].hasHardCopy = !!checked;
                                    return updated;
                                });
                            }}
                        />
                        <Label htmlFor={`hard-copy-${index}`} className="text-xs">Hard Copy</Label>
                    </div>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleManualUpload(
                            index,
                            selectedBankId,
                            closingBalance ? parseFloat(closingBalance) : null
                        )}
                        disabled={selectedBankId === 0}
                    >
                        Upload
                    </Button>
                </div>
            </div>
        )
    }

    const renderVouchingDetails = (item: BulkUploadItem, index: number) => {
        const [notes, setNotes] = useState<string>(item.vouchNotes || '');
        const [isChecked, setIsChecked] = useState<boolean>(item.isVouched || false);

        // Get balance data to display
        const extractedBalance = item.extractedData?.closing_balance;
        const manualBalance = item.closingBalance;
        const displayBalance = manualBalance !== undefined ? manualBalance : extractedBalance;

        return (
            <div className="space-y-3 py-2 px-3 bg-slate-50 rounded-md border border-slate-200">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Statement Details</Label>
                        <div className="text-sm">
                            <p><span className="font-medium">Bank Name:</span> {item.extractedData?.bank_name || 'Not detected'}</p>
                            <p><span className="font-medium">Account Number:</span> {item.extractedData?.account_number || 'Not detected'}</p>
                            <p><span className="font-medium">Currency:</span> {item.extractedData?.currency || 'Not detected'}</p>
                            <p><span className="font-medium">Period:</span> {item.extractedData?.statement_period || format(new Date(cycleYear, cycleMonth - 1), 'MMMM yyyy')}</p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Balance Information</Label>
                        <div className="text-sm">
                            <p><span className="font-medium">Opening Balance:</span> {formatCurrency(item.extractedData?.opening_balance, item.extractedData?.currency || 'USD')}</p>
                            <p><span className="font-medium">Closing Balance:</span> {formatCurrency(displayBalance, item.extractedData?.currency || 'USD')}</p>
                            {manualBalance !== undefined && manualBalance !== extractedBalance && (
                                <p className="text-amber-600 text-xs">* Manual override of original extracted value: {formatCurrency(extractedBalance, item.extractedData?.currency || 'USD')}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Vouching Notes</Label>
                    <Input
                        placeholder="Add notes about this statement verification..."
                        value={notes}
                        onChange={(e) => {
                            setNotes(e.target.value);
                            // Update in the main items array
                            setUploadItems(items => {
                                const updated = [...items];
                                updated[index].vouchNotes = e.target.value;
                                return updated;
                            });
                        }}
                    />
                </div>

                <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id={`vouched-${index}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                                setIsChecked(!!checked);
                                // Update in the main items array
                                setUploadItems(items => {
                                    const updated = [...items];
                                    updated[index].isVouched = !!checked;
                                    updated[index].status = checked ? 'vouched' : 'uploaded';
                                    return updated;
                                });
                            }}
                        />
                        <Label htmlFor={`vouched-${index}`} className="text-sm font-medium">
                            Verified and vouched
                        </Label>
                    </div>

                    <div className="space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                // Logic to update closing balance if needed
                                const item = uploadItems[index];
                                if (item.extractedData?.closing_balance !== item.closingBalance && item.closingBalance !== undefined) {
                                    updateClosingBalance(index, item.closingBalance);
                                }
                            }}
                        >
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                            Save
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                // Logic to view statement PDF
                                const item = uploadItems[index];
                                if (item.matchedBank) {
                                    // Here you would open a dialog to view the statement
                                    toast({
                                        title: "View Statement",
                                        description: `Viewing statement for ${item.matchedBank.company_name} / ${item.matchedBank.bank_name}`,
                                    });
                                }
                            }}
                        >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            View
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => {
                if (!open && !uploading) {
                    onClose()
                    setUploadItems([])
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
                                {format(new Date(cycleYear, cycleMonth - 1, 1), 'MMMM yyyy')}
                            </p>
                        </div>
                    </DialogHeader>

                    <Tabs
                        defaultValue="upload"
                        value={activeTab}
                        onValueChange={setActiveTab}
                    // className=" flex flex-col "
                    >
                        <TabsList>
                            <TabsTrigger value="upload" disabled={uploading}>Upload Files</TabsTrigger>
                            <TabsTrigger value="processing">Processing</TabsTrigger>
                            <TabsTrigger value="review">Review & Match</TabsTrigger>
                            <TabsTrigger value="vouching">Vouching</TabsTrigger>
                        </TabsList>

                        <TabsContent value="upload" className="flex-1 flex flex-col space-y-4 py-4 px-1">
                            <div className="space-y-4 py-4">
                                <div className="flex items-center gap-4">
                                    <div className="group relative">
                                        <Input
                                            id="pdf-file"
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf"
                                            multiple
                                            onChange={handleFileSelection}
                                            className="cursor-pointer file:bg-blue-50 file:text-blue-700 file:border-blue-200 
             hover:file:bg-blue-100 file:mr-4 file:px-3 file:py-2 file:rounded-md
             file:transition-colors group-hover:border-blue-300"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleStartProcessing}
                                        disabled={uploadItems.length === 0}
                                    >
                                        <FilePlus className="h-4 w-4 mr-2" />
                                        Process Files ({uploadItems.length})
                                    </Button>
                                </div>

                                <div className="border rounded-md overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>File Name</TableHead>
                                                <TableHead>Size</TableHead>
                                                <TableHead>Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {uploadItems.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                        No files selected. Select PDF bank statements to upload.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                uploadItems.map((item, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-medium">{item.file.name}</TableCell>
                                                        <TableCell>{formatFileSize(item.file.size)}</TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => removeItem(index)}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                <Alert>
                                    <FileText className="h-4 w-4" />
                                    <AlertTitle>Batch Processing</AlertTitle>
                                    <AlertDescription>
                                        Upload multiple bank statements at once. The system will attempt to automatically match each statement with the correct bank account based on the document content.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </TabsContent>

                        <TabsContent value="processing" className="flex-1 flex flex-col space-y-6 py-4 px-1">
                            <div className="space-y-6 py-4">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle>Processing Progress</CardTitle>
                                        <CardDescription>
                                            Processing {uploadItems.length} files
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>Overall Progress</span>
                                                <span>{overallProgress}%</span>
                                            </div>
                                            <Progress value={overallProgress} className="h-2" />
                                        </div>

                                        {processingIndex >= 0 && processingIndex < uploadItems.length && (
                                            <div className="mt-4 space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Current File: {uploadItems[processingIndex].file.name}</span>
                                                    <span>{uploadItems[processingIndex].uploadProgress || 0}%</span>
                                                </div>
                                                <Progress value={uploadItems[processingIndex].uploadProgress || 0} className="h-2" />
                                            </div>
                                        )}

                                        <div className="mt-6 flex justify-between">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                <span>Matched: {totalMatched}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                <span>Unmatched: {totalUnmatched}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <FileWarning className="h-4 w-4 text-red-500" />
                                                <span>Failed: {uploadItems.filter(i => i.status === 'failed').length}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button
                                            variant="outline"
                                            onClick={() => setActiveTab('review')}
                                            disabled={uploading}
                                            className="w-full"
                                        >
                                            <ArrowRight className="h-4 w-4 mr-2" />
                                            Review Results
                                        </Button>
                                    </CardFooter>
                                </Card>

                                <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-white z-10">
                                            <TableRow>
                                                <TableHead className="w-[40px]">#</TableHead>
                                                <TableHead>File Name</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Progress</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {uploadItems.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>{index + 1}</TableCell>
                                                    <TableCell className="font-medium">{item.file.name}</TableCell>
                                                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                                                    <TableCell>
                                                        <Progress value={item.uploadProgress || 0} className="h-2 w-24" />
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
                                <div className="max-h-[calc(90vh-220px)] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-white z-10">
                                            <TableRow>
                                                <TableHead className="w-[40px]">#</TableHead>
                                                <TableHead>Company</TableHead>
                                                <TableHead>Bank Name</TableHead>
                                                <TableHead>Account Number</TableHead>
                                                <TableHead>Currency</TableHead>
                                                <TableHead>Closing Balance</TableHead>
                                                <TableHead>File Name</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {uploadItems.map((item, index) => (
                                                <TableRow key={index} className={item.status === 'unmatched' ? 'bg-yellow-50' : ''}>
                                                    <TableCell>{index + 1}</TableCell>
                                                    <TableCell>{item.matchedBank?.company_name || '-'}</TableCell>
                                                    <TableCell>{item.matchedBank?.bank_name || item.extractedData?.bank_name || '-'}</TableCell>
                                                    <TableCell className="font-mono text-xs">{item.matchedBank?.account_number || item.extractedData?.account_number || '-'}</TableCell>
                                                    <TableCell>{item.matchedBank?.bank_currency || item.extractedData?.currency || '-'}</TableCell>
                                                    <TableCell>
                                                        {item.status === 'matched' || item.status === 'uploaded' || item.status === 'vouched' ? (
                                                            renderClosingBalanceInput(item, index)
                                                        ) : item.extractedData?.closing_balance ? (
                                                            <span className="font-medium">
                                                                {formatCurrency(item.extractedData.closing_balance,
                                                                    item.extractedData.currency || 'USD')}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">Not available</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.extractedData ? (
                                                            <div className="text-xs space-y-0.5">
                                                                <div><span className="font-medium">Period:</span> {item.extractedData.statement_period || '-'}</div>
                                                                <div><span className="font-medium">Currency:</span> {item.extractedData.currency || '-'}</div>
                                                                <div><span className="font-medium">Opening:</span> {formatCurrency(item.extractedData.opening_balance, item.extractedData.currency || 'USD')}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">Not available</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-medium">{item.file.name}</TableCell>
                                                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                                                    <TableCell>
                                                        {item.status === 'failed' && (
                                                            <div className="text-xs text-red-500">{item.error}</div>
                                                        )}
                                                        {item.status === 'unmatched' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8"
                                                                onClick={() => setActiveTab('review')}
                                                            >
                                                                Match Manually
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

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setActiveTab('vouching')}
                                        disabled={uploadItems.filter(i => i.status === 'matched' || i.status === 'uploaded').length === 0}
                                    >
                                        Go to Vouching
                                    </Button>

                                    <Button
                                        variant="default"
                                        onClick={handleStartProcessing}
                                        disabled={uploadItems.length === 0 || uploading}
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <FileCheck className="h-4 w-4 mr-2" />
                                                Process Remaining Files
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
                                        No statements available for vouching
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
                                                        <Building className="h-4 w-4 text-blue-600 mr-1" />
                                                        <span className="font-medium">{group.companyName}</span>
                                                        <Badge variant="outline" className="ml-2">
                                                            {group.statements.length} statement{group.statements.length !== 1 ? 's' : ''}
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
                                                                Pending Vouching
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </CollapsibleTrigger>

                                                <CollapsibleContent className="p-3 space-y-4">
                                                    {group.statements.map((statement, statementIdx) => (
                                                        <div key={statementIdx} className="border rounded-md overflow-hidden">
                                                            <div className="p-2 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <FileText className="h-4 w-4 text-blue-600" />
                                                                    <span className="font-medium">{statement.file.name}</span>
                                                                </div>
                                                                {getStatusBadge(statement.status)}
                                                            </div>

                                                            {/* Statement details for vouching */}
                                                            {renderVouchingDetails(statement, uploadItems.findIndex(i => i === statement))}
                                                        </div>
                                                    ))}

                                                    <div className="flex justify-end pt-2">
                                                        <Button
                                                            variant={group.isVouched ? "outline" : "default"}
                                                            onClick={() => markCompanyVouched(group.companyId, !group.isVouched)}
                                                            className={group.isVouched ? "" : "bg-purple-600 hover:bg-purple-700"}
                                                        >
                                                            {group.isVouched ? (
                                                                <>Unmark as Vouched</>
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
                                    onClick={onClose}
                                >
                                    Complete Vouching
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {showValidation && validationResult && currentValidationItem && (
                <BankValidationDialog
                    isOpen={showValidation}
                    onClose={handleCancelValidation}
                    bank={currentValidationItem.item.matchedBank!}
                    extractedData={validationResult.extractedData}
                    mismatches={validationResult.mismatches}
                    onProceed={handleContinueAfterValidation}
                    onCancel={handleCancelValidation}
                    cycleMonth={cycleMonth}
                    cycleYear={cycleYear}
                />
            )}
        </>
    )
}

// Utility function to format file size
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Format currency with appropriate currency code
function formatCurrency(amount: number | null, currencyCode: string): string {
    if (amount === null || isNaN(amount)) return '-'

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2
        }).format(amount)
    } catch (error) {
        // Fallback if there's an issue with the currency code
        return new Intl.NumberFormat('en-US', {
            style: 'decimal',
            minimumFractionDigits: 2
        }).format(amount)
    }
}