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
    import { performBankStatementExtraction, processBulkExtraction } from '@/lib/bankExtractionUtils'
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
    import { PasswordInputDialog } from './PasswordInputDialog'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"


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

        useEffect(() => {
            if (isOpen) {
                console.log('Bulk upload dialog opened with cycle ID:', statementCycleId);
            }
        }, [isOpen, statementCycleId]);

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

        const [localCycleId, setLocalCycleId] = useState<string | null>(statementCycleId);

        const [currentManualMatchItem, setCurrentManualMatchItem] = useState<number | null>(null);
        const [showBankSelectorDialog, setShowBankSelectorDialog] = useState<boolean>(false);

        const [passwordProtectedFiles, setPasswordProtectedFiles] = useState([]);
        const [showPasswordDialog, setShowPasswordDialog] = useState(false);
        const [batchFiles, setBatchFiles] = useState([]);


        // Use useEffect to sync with prop changes
        useEffect(() => {
            if (statementCycleId) {
                setLocalCycleId(statementCycleId);
            }
        }, [statementCycleId]);

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

        const formatFileName = (file: File): { shortName: string, fullName: string, extension: string } => {
            if (!file) return { shortName: 'Unknown file', fullName: 'Unknown file', extension: '' };

            const name = file.name || '';
            const lastDotIndex = name.lastIndexOf('.');

            // Handle files with no extension
            if (lastDotIndex === -1) {
                return {
                    shortName: name.length > 30 ? name.substring(0, 27) + '...' : name,
                    fullName: name,
                    extension: ''
                };
            }

            const baseName = name.substring(0, lastDotIndex);
            const extension = name.substring(lastDotIndex + 1);

            return {
                shortName: baseName.length > 30 ? baseName.substring(0, 27) + '...' : baseName,
                fullName: name,
                extension: extension
            };
        };
        const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = event.target.files;
            if (!files || files.length === 0) return;

            const fileArray = Array.from(files);
            const newItems: BulkUploadItem[] = fileArray.map(file => ({
                file,
                status: 'pending',
                extractedData: null,
                matchedBank: null,
                closingBalance: null,
                error: null,
                matchConfidence: 0,
                uploadProgress: 0,
                fileName: formatFileName(file), // Use formatted name
                originalName: file.name, // Store original name for processing
            }));

            setUploadItems([...uploadItems, ...newItems]);
        };

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
                });
                return;
            }

            // Check if we have a cycle ID, create one if not
            let cycleId = localCycleId;
            if (!cycleId) {
                try {
                    const monthStr = (cycleMonth + 1).toString().padStart(2, '0');
                    const cycleMonthYear = `${cycleYear}-${monthStr}`;

                    console.log(`Trying to find or create cycle for: ${cycleMonthYear}`);

                    // First check if cycle exists
                    const { data: existingCycle, error: checkError } = await supabase
                        .from('statement_cycles')
                        .select('id')
                        .eq('month_year', cycleMonthYear)
                        .maybeSingle();

                    if (!checkError && existingCycle) {
                        // Use existing cycle
                        cycleId = existingCycle.id;
                        setLocalCycleId(existingCycle.id);
                        console.log(`Using existing cycle: ${cycleId}`);
                    } else {
                        // Create new cycle
                        const { data: newCycle, error: createError } = await supabase
                            .from('statement_cycles')
                            .insert({
                                month_year: cycleMonthYear,
                                status: 'active',
                                created_at: new Date().toISOString()
                            })
                            .select('id')
                            .single();

                        if (createError) {
                            console.error('Error creating cycle:', createError);
                            toast({
                                title: 'Error',
                                description: 'Failed to create statement cycle',
                                variant: 'destructive'
                            });
                            return;
                        }

                        cycleId = newCycle.id;
                        setLocalCycleId(newCycle.id);
                        console.log(`Created new cycle: ${cycleId}`);
                    }
                } catch (error) {
                    console.error('Error initializing cycle:', error);
                    toast({
                        title: 'Error',
                        description: 'Failed to initialize statement cycle',
                        variant: 'destructive'
                    });
                    return;
                }
            }

            // Continue with normal processing
            setUploading(true);
            setActiveTab('processing');
            await processFiles(cycleId);
        };


        function extractPasswordFromFilename(filename) {
            if (!filename) return null;

            const lowerFilename = filename.toLowerCase();

            // Common password indicators in bank statement filenames
            const passwordIndicators = [
                'pw', 'pwd', 'password', 'passcode', 'pass', 'p w', 'p-w', 'p_w'
            ];

            // Try each indicator
            for (const indicator of passwordIndicators) {
                // Find the indicator in the filename
                const indicatorIndex = lowerFilename.indexOf(indicator);

                if (indicatorIndex !== -1) {
                    // Get text after the indicator
                    const afterIndicator = filename.substring(indicatorIndex + indicator.length).trim();

                    // Extract the number/password (looking for sequences of digits)
                    const passwordMatch = afterIndicator.match(/^[\s-_]*([0-9]+)/);

                    if (passwordMatch && passwordMatch[1]) {
                        return passwordMatch[1];
                    }
                }
            }

            // Also check for account numbers that might be passwords
            // This handles cases where files are named with account numbers at the end
            const accountMatch = filename.match(/\b(\d{6,12})\b(?!.*\d{6,12})/);
            if (accountMatch && accountMatch[1]) {
                return accountMatch[1];
            }

            return null;
        }


        
        // Modified processFiles function focused on batch processing
        // Enhanced processFiles function with better error handling and progress tracking
        const processFiles = async (cycleId) => {
            try {
                setTotalMatched(0);
                setTotalUnmatched(0);

                // Filter out files that are already processed
                const filesToProcess = uploadItems.filter(item =>
                    item.status !== 'uploaded' && item.status !== 'vouched'
                );

                if (filesToProcess.length === 0) {
                    toast({
                        title: 'No files to process',
                        description: 'All files have already been processed',
                        variant: 'default'
                    });
                    return;
                }

                setUploading(true);
                setOverallProgress(10);
                console.log(`Starting to process ${filesToProcess.length} files...`);

                // Create batch with URLs and params
                const newBatchFiles = await Promise.all(filesToProcess.map(async (item, index) => {
                    if (!item || !item.file) {
                        console.error(`Item at index ${index} is missing or has no file property`);
                        return null;
                    }

                    try {
                        const fileUrl = URL.createObjectURL(item.file);

                        // Safely extract filename 
                        const fileName = item.file.name || `file-${index}`;

                        // Try to extract password from filename
                        const potentialPassword = extractPasswordFromFilename(fileName);

                        // Update UI to show item is being processed
                        setUploadItems(items => {
                            const updated = [...items];
                            if (updated[index]) {
                                updated[index] = {
                                    ...updated[index],
                                    status: 'processing',
                                    uploadProgress: 10
                                };
                            }
                            return updated;
                        });

                        return {
                            fileUrl,
                            index,
                            originalItem: item,
                            params: { month: cycleMonth, year: cycleYear },
                            password: potentialPassword,
                            potentialPassword: potentialPassword,
                            fileName: fileName
                        };
                    } catch (error) {
                        console.error(`Error preparing file at index ${index}:`, error);

                        // Update UI to show error
                        setUploadItems(items => {
                            const updated = [...items];
                            if (updated[index]) {
                                updated[index] = {
                                    ...updated[index],
                                    status: 'failed',
                                    error: `Failed to prepare file: ${error.message}`,
                                    uploadProgress: 0
                                };
                            }
                            return updated;
                        });

                        return null;
                    }
                }));

                // Filter out null results and store batch files
                const validBatchFiles = newBatchFiles.filter(file => file !== null);
                setBatchFiles(validBatchFiles);

                if (validBatchFiles.length === 0) {
                    throw new Error('No valid files to process');
                }

                console.log(`Processing ${validBatchFiles.length} valid files...`);

                // Process batch extraction with retry mechanism
                let retryCount = 0;
                let batchResult;

                while (retryCount < 3) {
                    try {
                        batchResult = await processBulkExtraction(
                            validBatchFiles,
                            { month: cycleMonth, year: cycleYear },
                            (progress) => setOverallProgress(Math.min(70, 10 + Math.floor(progress * 60)))
                        );
                        break; // Success - exit retry loop
                    } catch (error) {
                        retryCount++;
                        console.error(`Batch processing attempt ${retryCount} failed:`, error);

                        if (retryCount >= 3) {
                            throw error; // Give up after 3 attempts
                        }

                        // Wait before retrying (exponential backoff)
                        await new Promise(r => setTimeout(r, 1000 * retryCount));
                    }
                }

                // Check if we got results or a combined object with password-protected files
                let resultsToProcess = [];

                if (batchResult && batchResult.passwordProtectedFiles && batchResult.passwordProtectedFiles.length > 0) {
                    // Store the password-protected files for later handling
                    setPasswordProtectedFiles(batchResult.passwordProtectedFiles);

                    // Show the password dialog
                    setShowPasswordDialog(true);

                    // Use the partial results we have
                    resultsToProcess = batchResult.results || [];
                } else {
                    // If no password-protected files, use all results
                    resultsToProcess = batchResult || [];
                }

                // Update UI with results and log each result
                for (const result of resultsToProcess) {
                    const { index, extractedData, success, error } = result;
                    console.log(`Processing result for file ${index}: ${success ? 'Success' : 'Failed - ' + (error || 'Unknown error')}`);

                    setUploadItems(items => {
                        const updated = [...items];
                        if (updated[index]) {
                            if (success) {
                                updated[index] = {
                                    ...updated[index],
                                    status: 'matched',
                                    extractedData,
                                    uploadProgress: 80
                                };
                            } else {
                                updated[index] = {
                                    ...updated[index],
                                    status: 'unmatched',
                                    error: error || 'Failed to extract data',
                                    uploadProgress: 70
                                };
                            }
                        }
                        return updated;
                    });
                }

                // Upload successful extractions
                const successfulItems = resultsToProcess.filter(r => r.success);
                if (successfulItems.length > 0) {
                    await uploadBatchStatements(successfulItems, cycleId);
                }

                // Clean up
                validBatchFiles.forEach(file => {
                    if (file.fileUrl) URL.revokeObjectURL(file.fileUrl);
                });

                // Update counts for display
                setTotalMatched(successfulItems.length);
                setTotalUnmatched(resultsToProcess.length - successfulItems.length);

                // Show retry button for failed items
                const failedItems = resultsToProcess.filter(r => !r.success);
                if (failedItems.length > 0) {
                    toast({
                        title: 'Some files failed to process',
                        description: `${failedItems.length} file(s) could not be processed. You can retry them.`,
                        variant: 'warning'
                    });
                }

            } catch (error) {
                console.error('Batch processing error:', error);
                toast({
                    title: 'Error',
                    description: `Failed to process files: ${error.message}`,
                    variant: 'destructive'
                });
            } finally {
                setUploading(false);
                setOverallProgress(100);

                if (totalMatched > 0) {
                    setActiveTab('vouching');
                } else {
                    setActiveTab('review');
                }

                onUploadsComplete();
            }
        };

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


        const uploadBatchStatements = async (successfulItems, cycleId) => {
            const uploadPromises = [];
            
            for (const item of successfulItems) {
                const { index, extractedData, originalItem } = item;
                
                // Create upload promise for each item
                uploadPromises.push(
                    (async () => {
                        try {
                            // Upload file to storage
                            const fileName = `bank_statement_${extractedData.company_name || 'unknown'}_${extractedData.account_number || 'unknown'}_${cycleYear}_${cycleMonth}.pdf`;
                            const filePath = `statement_documents/${cycleYear}/${cycleMonth}/${extractedData.company_name || 'unknown'}/${fileName}`;
                            
                            const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                                .from('Statement-Cycle')
                                .upload(filePath, originalItem.file, {
                                    cacheControl: '3600',
                                    upsert: true
                                });
                            
                            if (pdfUploadError) throw pdfUploadError;
                            
                            // Create statement record
                            const statementData = {
                                statement_cycle_id: cycleId,
                                statement_month: cycleMonth,
                                statement_year: cycleYear,
                                has_soft_copy: true,
                                has_hard_copy: false,
                                statement_document: {
                                    statement_pdf: pdfUploadData.path,
                                    statement_excel: null,
                                    document_size: originalItem.file.size
                                },
                                statement_extractions: extractedData,
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
                            
                            // Insert the statement record
                            await supabase
                                .from('acc_cycle_bank_statements')
                                .insert([statementData]);
                            
                            // Update UI status
                            setUploadItems(items => {
                                const updated = [...items];
                                updated[index] = {
                                    ...updated[index],
                                    status: 'uploaded',
                                    uploadProgress: 100
                                };
                                return updated;
                            });

                            if (onUploadsComplete) {
                                onUploadsComplete();
                            }
                            
                            return { success: true, index };
                        } catch (error) {
                            console.error(`Error uploading item ${index}:`, error);
                            
                            // Update UI with error
                            setUploadItems(items => {
                                const updated = [...items];
                                updated[index] = {
                                    ...updated[index],
                                    status: 'failed',
                                    error: error.message || 'Failed to upload statement',
                                    uploadProgress: 70
                                };
                                return updated;
                            });
                            
                            return { success: false, index, error };
                        }
                    })()
                );
            }
            
            // Wait for all uploads to complete
            const results = await Promise.allSettled(uploadPromises);
            
            // Count successes and failures
            const successes = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failures = results.length - successes;
            
            // Update totals
            setTotalMatched(prev => prev + successes);
            setTotalUnmatched(prev => prev + failures);
            
            toast({
                title: 'Statements Uploaded',
                description: `Successfully uploaded ${successes} statements${failures > 0 ? `, ${failures} failed` : ''}`
            });
        };

        const uploadStatementFile = async (index: number, matchedBank: Bank, cycleId: string) => {
            try {
                const item = uploadItems[index];
                const extractedData = item.extractedData;

                // Get or create statement cycle based on period
                let cyclePeriodId = cycleId;  // Use the provided cycleId
                let targetMonth = cycleMonth;
                let targetYear = cycleYear;

                if (extractedData?.statement_period) {
                    const periodDates = parseStatementPeriod(extractedData.statement_period);
                    if (periodDates) {
                        // For multi-month statements, create separate entries for each month
                        const monthsInRange = generateMonthRange(
                            periodDates.startMonth,
                            periodDates.startYear,
                            periodDates.endMonth,
                            periodDates.endYear
                        );

                        // Create statement cycles for each month
                        for (const { month, year } of monthsInRange) {
                            // Check if statement already exists
                            const existingStatementId = await checkStatementExists(matchedBank.id, month, year);
                            if (existingStatementId) {
                                console.log(`Statement already exists for bank ${matchedBank.id} in ${month}/${year}`);
                                continue;
                            }

                            // Get or create cycle for this month
                            cyclePeriodId = await getOrCreateStatementCycle(month, year);
                            if (!cyclePeriodId) {
                                throw new Error(`Failed to get or create statement cycle for ${month}/${year}`);
                            }

                            targetMonth = month;
                            targetYear = year;

                            // Upload file to storage
                            let pdfPath = null;
                            if (item.file) {
                                const pdfFileName = `bank_statement_${matchedBank.company_id}_${matchedBank.id}_${year}_${month}.pdf`;
                                const pdfFilePath = `statement_documents/${year}/${month}/${matchedBank.company_id}/${pdfFileName}`;

                                const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                                    .from('Statement-Cycle')
                                    .upload(pdfFilePath, item.file, {
                                        cacheControl: '3600',
                                        upsert: true
                                    });

                                if (pdfUploadError) throw pdfUploadError;
                                pdfPath = pdfUploadData.path;
                            }

                            // Prepare document paths
                            const documentPaths = {
                                statement_pdf: pdfPath,
                                statement_excel: null,
                                document_size: item.file ? item.file.size : 0
                            };

                            // Base statement data
                            const baseStatementData = {
                                bank_id: matchedBank.id,
                                company_id: matchedBank.company_id,
                                statement_cycle_id: cyclePeriodId,
                                statement_month: month,
                                statement_year: year,
                                has_soft_copy: item.hasSoftCopy || false,
                                has_hard_copy: item.hasHardCopy || false,
                                statement_document: documentPaths,
                                statement_extractions: extractedData,
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

                            // Create statement record
                            const { error: insertError } = await supabase
                                .from('acc_cycle_bank_statements')
                                .insert(baseStatementData);

                            if (insertError) throw insertError;
                        }

                        setUploadItems(items => {
                            const updated = [...items];
                            updated[index] = {
                                ...updated[index],
                                status: 'uploaded',
                                matchedBank,
                                uploadProgress: 100
                            };
                            return updated;
                        });

                        return;
                    }
                }

                // For single month statement
                const existingStatementId = await checkStatementExists(matchedBank.id, targetMonth, targetYear);
                if (existingStatementId) {
                    throw new Error(`Statement already exists for bank ${matchedBank.id} in ${targetMonth}/${targetYear}`);
                }

                // Use the provided cycleId for single month statements
                if (!cyclePeriodId) {
                    throw new Error('No statement cycle ID provided');
                }

                // Upload file to storage
                let pdfPath = null;
                if (item.file) {
                    const pdfFileName = `bank_statement_${matchedBank.company_id}_${matchedBank.id}_${targetYear}_${targetMonth}.pdf`;
                    const pdfFilePath = `statement_documents/${targetYear}/${targetMonth}/${matchedBank.company_id}/${pdfFileName}`;

                    const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                        .from('Statement-Cycle')
                        .upload(pdfFilePath, item.file, {
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (pdfUploadError) throw pdfUploadError;
                    pdfPath = pdfUploadData.path;
                }

                // Prepare document paths
                const documentPaths = {
                    statement_pdf: pdfPath,
                    statement_excel: null,
                    document_size: item.file ? item.file.size : 0
                };

                // Base statement data for single month
                const baseStatementData = {
                    bank_id: matchedBank.id,
                    company_id: matchedBank.company_id,
                    statement_cycle_id: cyclePeriodId,
                    statement_month: targetMonth,
                    statement_year: targetYear,
                    has_soft_copy: item.hasSoftCopy || false,
                    has_hard_copy: item.hasHardCopy || false,
                    statement_document: documentPaths,
                    statement_extractions: extractedData,
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

                // Create statement record
                const { error: insertError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .insert(baseStatementData);

                if (insertError) throw insertError;

                setUploadItems(items => {
                    const updated = [...items];
                    updated[index] = {
                        ...updated[index],
                        status: 'uploaded',
                        matchedBank,
                        uploadProgress: 100
                    };
                    return updated;
                });

                return;
            } catch (error) {
                console.error('Error uploading statement:', error);
                throw error;
            }
        };

        const handleContinueAfterValidation = async () => {
            if (!currentValidationItem) return;

            setShowValidation(false);
            setUploading(true);

            try {
                // Upload the file despite validation issues
                await uploadStatementFile(
                    currentValidationItem.index,
                    currentValidationItem.item.matchedBank!,
                    localCycleId!  // Use localCycleId
                );

                // Continue processing remaining files
                const remainingFiles = uploadItems.filter(
                    (item, idx) => idx > currentValidationItem.index && item.status === 'pending'
                );

                if (remainingFiles.length > 0) {
                    processFiles(localCycleId!);  // Use localCycleId for processing remaining files
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
        };

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
                });
                return;
            }

            if (!localCycleId) {
                toast({
                    title: 'Error',
                    description: 'No active statement cycle found',
                    variant: 'destructive'
                });
                return;
            }

            setUploadItems(items => {
                const updated = [...items];
                updated[index] = {
                    ...updated[index],
                    status: 'processing',
                    uploadProgress: 10
                };
                return updated;
            });

            try {
                // Find the selected bank
                const selectedBank = banks.find(b => b.id === bankId);
                if (!selectedBank) throw new Error('Selected bank not found');

                // Set as the matched bank
                setUploadItems(items => {
                    const updated = [...items];
                    updated[index] = {
                        ...updated[index],
                        matchedBank: selectedBank
                    };
                    return updated;
                });

                // Upload the file using localCycleId
                await uploadStatementFile(index, selectedBank, localCycleId);

                // Update closing balance if provided
                if (closingBalance !== null) {
                    await updateClosingBalance(index, closingBalance);
                }

                toast({
                    title: 'Success',
                    description: `Statement uploaded for ${selectedBank.company_name} / ${selectedBank.bank_name}`
                });

            } catch (error) {
                console.error('Error in manual upload:', error);
                setUploadItems(items => {
                    const updated = [...items];
                    updated[index] = {
                        ...updated[index],
                        status: 'failed',
                        error: error.message || 'Failed to upload statement'
                    };
                    return updated;
                });

                toast({
                    title: 'Upload Failed',
                    description: error.message || 'Failed to upload statement',
                    variant: 'destructive'
                });
            }
        };

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
            if (!extractedData || !Array.isArray(banks) || banks.length === 0) return null;

            // Log extraction results for debugging
            console.log("Extracted data for matching:", {
                bank_name: extractedData.bank_name,
                account_number: extractedData.account_number,
                company_name: extractedData.company_name,
                currency: extractedData.currency
            });

            let bestMatch: Bank | null = null;
            let bestScore = 0;
            let matchDetails: Record<string, any> = {};

            // Filter out banks without company_id
            const validBanks = banks.filter(bank => bank.company_id !== null);

            // First try exact account number matching (highest priority)
            if (extractedData.account_number) {
                // Clean up the account number (remove spaces, dashes, etc.)
                const cleanedExtractedAccount = extractedData.account_number.replace(/[\s\-\.]/g, '');

                for (const bank of validBanks) {
                    const cleanedBankAccount = bank.account_number.replace(/[\s\-\.]/g, '');

                    // Try exact account number match first
                    if (cleanedBankAccount === cleanedExtractedAccount) {
                        console.log(`Found exact account match: ${bank.bank_name} - ${bank.company_name}`);
                        return bank; // Immediate return on exact account match
                    }

                    // Check if one contains the other
                    if (cleanedBankAccount.includes(cleanedExtractedAccount) ||
                        cleanedExtractedAccount.includes(cleanedBankAccount)) {
                        let score = 8; // High score for partial account match

                        // Additional checks to increase confidence
                        if (extractedData.bank_name &&
                            bank.bank_name.toLowerCase().includes(extractedData.bank_name.toLowerCase())) {
                            score += 3;
                        }

                        if (extractedData.company_name &&
                            bank.company_name.toLowerCase().includes(extractedData.company_name.toLowerCase())) {
                            score += 3;
                        }

                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = bank;
                            matchDetails = {
                                reason: "Account number partial match",
                                score: score,
                                accountMatch: true
                            };
                        }
                    }
                }
            }

            // If we already have a high confidence match from account number, return it
            if (bestScore >= 10) {
                console.log(`High confidence match based on account: ${bestMatch?.company_name}`, matchDetails);
                return bestMatch;
            }

            // Otherwise do a more thorough scoring
            for (const bank of validBanks) {
                let score = 0;
                let matchReasons = [];

                // Check bank name match
                if (extractedData.bank_name && bank.bank_name) {
                    if (bank.bank_name.toLowerCase().includes(extractedData.bank_name.toLowerCase()) ||
                        extractedData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())) {
                        score += 3;
                        matchReasons.push("Bank name match");
                    }
                }

                // Check account number match (if we didn't get a match above)
                if (extractedData.account_number && bank.account_number) {
                    // If last 4-6 digits match
                    const extAccountEnd = extractedData.account_number.slice(-6);
                    const bankAccountEnd = bank.account_number.slice(-6);

                    if (extAccountEnd === bankAccountEnd) {
                        score += 4;
                        matchReasons.push("Account ending match");
                    }
                }

                // Check company name match with higher weight
                if (extractedData.company_name && bank.company_name) {
                    // Clean up names for better matching
                    const cleanExtCompany = extractedData.company_name.toLowerCase()
                        .replace(/\s+limited$|\s+ltd\.?$|\s+llc$|\s+inc\.?$|\s+corporation$|\s+corp\.?$/i, '')
                        .trim();

                    const cleanBankCompany = bank.company_name.toLowerCase()
                        .replace(/\s+limited$|\s+ltd\.?$|\s+llc$|\s+inc\.?$|\s+corporation$|\s+corp\.?$/i, '')
                        .trim();

                    if (cleanBankCompany.includes(cleanExtCompany) ||
                        cleanExtCompany.includes(cleanBankCompany)) {
                        score += 5; // Higher weight for company name
                        matchReasons.push("Company name match");
                    }
                }

                // Check currency match
                if (extractedData.currency && bank.bank_currency) {
                    const normExtCurrency = normalizeCurrencyCode(extractedData.currency);
                    const normBankCurrency = normalizeCurrencyCode(bank.bank_currency);

                    if (normExtCurrency === normBankCurrency) {
                        score += 2;
                        matchReasons.push("Currency match");
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = bank;
                    matchDetails = {
                        reason: matchReasons.join(", "),
                        score: score
                    };
                }
            }

            // Lower threshold for matching
            if (bestScore >= 3) {
                console.log(`Matched with score ${bestScore}: ${bestMatch?.company_name}`, matchDetails);
                return bestMatch;
            }

            console.log("No match found with sufficient confidence");
            return null;
        };

        // Helper function to parse statement period
        const parseStatementPeriod = (periodString: string) => {
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

        // Helper function to generate month range
        const generateMonthRange = (startMonth: number, startYear: number, endMonth: number, endYear: number) => {
            const months = [];
            let currentDate = new Date(startYear, startMonth);
            const endDate = new Date(endYear, endMonth);

            while (currentDate <= endDate) {
                months.push({
                    month: currentDate.getMonth() + 1,
                    year: currentDate.getFullYear()
                });
                currentDate.setMonth(currentDate.getMonth() + 1);
            }

            return months;
        }

        // Helper function to get or create statement cycle
        const getOrCreateStatementCycle = async (month, year) => {
            try {
                const monthStr = (month + 1).toString().padStart(2, '0'); // Correct 0-based to 1-based
                const monthYearStr = `${year}-${monthStr}`;

                // Try to find existing cycle
                const { data: existingCycle, error: findError } = await supabase
                    .from('statement_cycles')
                    .select('id')
                    .eq('month_year', monthYearStr)
                    .maybeSingle(); // Use maybeSingle to prevent 406 errors

                if (findError && findError.code !== 'PGRST116') throw findError;

                if (existingCycle) {
                    console.log(`Using existing cycle for ${monthYearStr}: ${existingCycle.id}`);
                    return existingCycle.id;
                }

                // Create new cycle if not found
                console.log(`Creating new cycle for ${monthYearStr}`);
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

                console.log(`Created new cycle for ${monthYearStr}: ${newCycle.id}`);
                return newCycle.id;
            } catch (error) {
                console.error('Error in getOrCreateStatementCycle:', error);
                throw error;
            }
        };

        // Helper function to check if statement exists
        const checkStatementExists = async (bankId: number, month: number, year: number) => {
            try {
                const { data, error } = await supabase
                    .from('acc_cycle_bank_statements')
                    .select('id')
                    .eq('bank_id', bankId)
                    .eq('statement_month', month)
                    .eq('statement_year', year)
                    .maybeSingle();

                if (error && error.code !== 'PGRST116') throw error;
                return data?.id;
            } catch (error) {
                console.error('Error checking statement existence:', error);
                return null;
            }
        };

        // Helper function to handle multi-month statement submission
        const handleMultiMonthStatement = async (baseStatementData: any, bank: Bank, extractedData: any, documentPaths: any) => {
            try {
                // Parse the statement period
                const periodDates = parseStatementPeriod(extractedData.statement_period);
                if (!periodDates) {
                    console.warn('Could not parse statement period:', extractedData.statement_period);
                    return false;
                }

                const { startMonth, startYear, endMonth, endYear } = periodDates;
                const monthsInRange = generateMonthRange(startMonth, startYear, endMonth, endYear);

                // Create entries for each month
                for (const { month, year } of monthsInRange) {
                    // Get or create statement cycle for this month
                    const cyclePeriodId = await getOrCreateStatementCycle(month, year);

                    // Check if statement already exists
                    const { data: existingStatement } = await supabase
                        .from('acc_cycle_bank_statements')
                        .select('id')
                        .eq('bank_id', bank.id)
                        .eq('statement_month', month)
                        .eq('statement_year', year)
                        .single();

                    if (existingStatement) {
                        console.log(`Statement already exists for ${month}/${year}`);
                        continue;
                    }

                    // Find specific month data if available
                    const monthData = extractedData.monthly_balances?.find(
                        (mb: any) => mb.month === month && mb.year === year
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

                    // Create statement for this month
                    const newStatementData = {
                        ...baseStatementData,
                        statement_cycle_id: cyclePeriodId,
                        statement_month: month,
                        statement_year: year,
                        statement_document: documentPaths,
                        statement_extractions: {
                            ...extractedData,
                            monthly_balances: [monthData]
                        }
                    };

                    // Insert the statement
                    await supabase
                        .from('acc_cycle_bank_statements')
                        .insert([newStatementData]);

                    console.log(`Created statement for ${month}/${year}`);
                }

                return true;
            } catch (error) {
                console.error('Error handling multi-month statement:', error);
                throw error;
            }
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

        const [vouchingNotes, setVouchingNotes] = useState<{ [key: number]: string }>({});
        const [vouchingChecked, setVouchingChecked] = useState<{ [key: number]: boolean }>({});
        const [closingBalanceInputs, setClosingBalanceInputs] = useState<{ [key: number]: string }>({});
        const [selectedBankIds, setSelectedBankIds] = useState<{ [key: number]: number }>({});
        const [softCopyStates, setSoftCopyStates] = useState<{ [key: number]: boolean }>({});
        const [hardCopyStates, setHardCopyStates] = useState<{ [key: number]: boolean }>({});

        // Initialize states when items change
        useEffect(() => {
            const newVouchingNotes: { [key: number]: string } = {};
            const newVouchingChecked: { [key: number]: boolean } = {};
            const newClosingBalances: { [key: number]: string } = {};
            const newSelectedBanks: { [key: number]: number } = {};
            const newSoftCopyStates: { [key: number]: boolean } = {};
            const newHardCopyStates: { [key: number]: boolean } = {};

            uploadItems.forEach((item, index) => {
                newVouchingNotes[index] = item.vouchNotes || '';
                newVouchingChecked[index] = item.isVouched || false;
                newClosingBalances[index] = item.closingBalance?.toString() || item.extractedData?.closing_balance?.toString() || '';
                newSelectedBanks[index] = item.matchedBank?.id || 0;
                newSoftCopyStates[index] = item.hasSoftCopy || true;
                newHardCopyStates[index] = item.hasHardCopy || false;
            });

            setVouchingNotes(newVouchingNotes);
            setVouchingChecked(newVouchingChecked);
            setClosingBalanceInputs(newClosingBalances);
            setSelectedBankIds(newSelectedBanks);
            setSoftCopyStates(newSoftCopyStates);
            setHardCopyStates(newHardCopyStates);
        }, [uploadItems]);

        const renderClosingBalanceInput = (item: BulkUploadItem, index: number) => {
            return (
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        step="0.01"
                        placeholder="Closing Balance"
                        value={closingBalanceInputs[index] || ''}
                        onChange={(e) => setClosingBalanceInputs(prev => ({ ...prev, [index]: e.target.value }))}
                        className="w-32"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateClosingBalance(index, parseFloat(closingBalanceInputs[index]))}
                        disabled={!item.matchedBank || !closingBalanceInputs[index]}
                    >
                        Update
                    </Button>
                </div>
            )
        }

        const renderBankSelector = (item: BulkUploadItem, index: number) => {
            return (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <select
                            className="border rounded p-1 text-sm w-64"
                            value={selectedBankIds[index] || 0}
                            onChange={(e) => setSelectedBankIds(prev => ({ ...prev, [index]: parseInt(e.target.value) }))}
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
                            value={closingBalanceInputs[index] || ''}
                            onChange={(e) => setClosingBalanceInputs(prev => ({ ...prev, [index]: e.target.value }))}
                            className="w-32"
                        />
                    </div>

                    <div className="flex gap-4 mt-1">
                        <div className="flex items-center gap-1">
                            <Checkbox
                                id={`soft-copy-${index}`}
                                checked={softCopyStates[index]}
                                onCheckedChange={(checked) => {
                                    setSoftCopyStates(prev => ({ ...prev, [index]: !!checked }));
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
                                checked={hardCopyStates[index]}
                                onCheckedChange={(checked) => {
                                    setHardCopyStates(prev => ({ ...prev, [index]: !!checked }));
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
                                selectedBankIds[index],
                                closingBalanceInputs[index] ? parseFloat(closingBalanceInputs[index]) : null
                            )}
                            disabled={selectedBankIds[index] === 0}
                        >
                            Upload
                        </Button>
                    </div>
                </div>
            )
        }

        const renderVouchingDetails = (item: BulkUploadItem, index: number) => {
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
                                <p><span className="font-medium">Period:</span> {item.extractedData?.statement_period || format(new Date(cycleYear, cycleMonth), 'MMMM yyyy')}</p>
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
                            value={vouchingNotes[index] || ''}
                            onChange={(e) => {
                                setVouchingNotes(prev => ({ ...prev, [index]: e.target.value }));
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
                                checked={vouchingChecked[index] || false}
                                onCheckedChange={(checked) => {
                                    setVouchingChecked(prev => ({ ...prev, [index]: !!checked }));
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


        const tryPassword = async (password, fileIndexes) => {
            // Update the password in the file objects
            const updatedFiles = [...passwordProtectedFiles];

            for (const index of fileIndexes) {
                const fileIndex = updatedFiles.findIndex(f => f.index === index);
                if (fileIndex >= 0) {
                    updatedFiles[fileIndex].passwordAttempts = (updatedFiles[fileIndex].passwordAttempts || 0) + 1;
                }
            }

            setPasswordProtectedFiles(updatedFiles);

            // Make sure batchFiles is defined and not empty
            if (!batchFiles || batchFiles.length === 0) {
                console.error("batchFiles is undefined or empty");
                return false;
            }

            // Create a new batch of files using only the selected ones with the password set
            const filesToRetry = batchFiles.filter(file =>
                fileIndexes.includes(file.index)
            ).map(file => ({
                ...file,
                password
            }));

            // Try to process these files again
            if (filesToRetry.length === 0) return false;

            try {
                const retryResults = await processBulkExtraction(
                    filesToRetry,
                    { month: cycleMonth, year: cycleYear },
                    (progress) => { }
                );

                // Check if we still have password issues
                if (retryResults.passwordProtectedFiles && retryResults.passwordProtectedFiles.length > 0) {
                    // Password still didn't work
                    return false;
                }

                // Update the successful files
                const successfulFiles = updatedFiles.filter(f =>
                    fileIndexes.includes(f.index)
                ).map(f => ({
                    ...f,
                    unlocked: true
                }));

                setPasswordProtectedFiles(prevFiles =>
                    prevFiles.map(f => {
                        const updated = successfulFiles.find(sf => sf.index === f.index);
                        return updated || f;
                    })
                );

                // Integrate the new results with existing ones
                const newResults = retryResults.results || retryResults;

                // Update UI with results
                for (const result of newResults) {
                    const { index, extractedData, success } = result;
                    if (success) {
                        setUploadItems(items => {
                            const updated = [...items];
                            updated[index] = {
                                ...updated[index],
                                status: 'matched',
                                extractedData,
                                uploadProgress: 80
                            };
                            return updated;
                        });
                    }
                }

                // See if all files are now unlocked
                const remainingLocked = passwordProtectedFiles.filter(f =>
                    !f.unlocked && fileIndexes.includes(f.index)
                );

                if (remainingLocked.length === 0) {
                    setPasswordProtectedFiles(prev => prev.filter(f => !fileIndexes.includes(f.index)));
                    return true;
                }

                return false;
            } catch (error) {
                console.error('Error retrying with password:', error);
                return false;
            }
        };


        const skipPasswordFiles = (fileIndexes) => {
            // Remove these files from passwordProtectedFiles
            setPasswordProtectedFiles(prev => prev.filter(f => !fileIndexes.includes(f.index)));

            // Update the UI to show these as failed
            setUploadItems(items => {
                return items.map((item, idx) => {
                    if (fileIndexes.includes(idx)) {
                        return {
                            ...item,
                            status: 'failed',
                            error: 'Skipped password-protected file',
                            uploadProgress: 0
                        };
                    }
                    return item;
                });
            });

            // If no more password-protected files, close dialog
            if (passwordProtectedFiles.length <= fileIndexes.length) {
                setShowPasswordDialog(false);
            }
        };


        function handleDrop(event) {
            event.preventDefault();
            const files = event.dataTransfer.files;
            handleFileSelection({ target: { files } });
        }

        function handleDragOver(event) {
            event.preventDefault();
        }


        const handleClick = () => {
            if (fileInputRef.current) {
                fileInputRef.current.click();
            }
        };



        return (
            <>
                <Dialog open={isOpen} onOpenChange={(open) => {
                    if (!open && !uploading) {
                        onClose();
                        setUploadItems([]);
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
                                    {format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')}
                                </p>
                            </div>
                        </DialogHeader>

                        <Tabs
                            defaultValue="upload"
                            value={activeTab}
                            onValueChange={setActiveTab}
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
                                        <div
                                            className="group relative border-dashed border-2 border-gray-300 p-6 rounded-md hover:bg-gray-50 transition-colors"
                                            onDrop={handleDrop}
                                            onDragOver={handleDragOver}
                                            onClick={handleClick}
                                        >
                                            <Input
                                                id="pdf-file"
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf"
                                                multiple
                                                onChange={handleFileSelection}
                                                className="cursor-pointer opacity-0 absolute inset-0"
                                            />
                                            <p className="text-center text-gray-500">Drag and drop files here, or click to select files</p>
                                        </div>
                                        <Button
                                            onClick={handleStartProcessing}
                                            disabled={uploadItems.length === 0}
                                        >
                                            <FilePlus className="h-4 w-4 mr-2" />
                                            Process Files ({uploadItems.length})
                                        </Button>
                                    </div>

                                    <div className="border rounded-md overflow-hidden" style={{ maxHeight: '400px' }}>
                                        <div className="overflow-y-auto" style={{ maxHeight: '350px' }}>
                                            <Table className="w-full">
                                                <TableHeader className="sticky top-0 bg-background z-10">
                                                    <TableRow>
                                                        <TableHead>#</TableHead>
                                                        <TableHead>File Name</TableHead>
                                                        <TableHead>Size</TableHead>
                                                        <TableHead>Action</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {uploadItems.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                                No files selected. Select PDF bank statements to upload.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        uploadItems.map((item, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                                                                <TableCell className="font-medium">{item.file.name}</TableCell>
                                                                <TableCell>{formatFileSize(item.file.size)}</TableCell>
                                                                <TableCell>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="bg-red-50 hover:bg-red-100 text-red-600"
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

                            <TabsContent value="processing" className="flex-1 flex flex-col space-y-2 py-2 px-2">
                                <div className="space-y-2">

                                    <div className="border rounded-md overflow-hidden" style={{ maxHeight: '400px' }}>
                                        <div className="overflow-y-auto" style={{ maxHeight: '350px' }}>
                                            <Table className="w-full table-compact">
                                                <TableHeader className="sticky top-0 bg-background z-10">
                                                    <TableRow>
                                                        <TableHead className="w-[40px]">#</TableHead>
                                                        <TableHead className="w-[50%]">File Name</TableHead>
                                                        <TableHead>Size</TableHead>
                                                        <TableHead className="w-[80px]">Type</TableHead>
                                                        <TableHead className="w-[80px]">Action</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {uploadItems.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                                No files selected. Select PDF bank statements to upload.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        uploadItems.map((item, index) => {
                                                            const fileInfo = formatFileName(item.file);
                                                            return (
                                                                <TableRow key={index}>
                                                                    <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                                                                    <TableCell className="font-medium truncate">
                                                                        <TooltipProvider>
                                                                            <Tooltip>
                                                                                <TooltipTrigger className="truncate block w-full text-left">
                                                                                    {fileInfo.fullName}
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>{fileInfo.fullName}</TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                    </TableCell>
                                                                    <TableCell>{formatFileSize(item.file.size)}</TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {fileInfo.extension.toUpperCase()}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                            onClick={() => removeItem(index)}
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    <Card>
                                        <CardHeader className="pb-2">
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
                                                <div className=" flex justify-end">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setActiveTab('review')}
                                                        disabled={uploading}
                                                        className='bg-green-500 hover:bg-green-600  text-white hover:text-white'
                                                    >
                                                        <ArrowRight className="h-4 w-4 mr-2" />
                                                        Review Results
                                                    </Button>
                                                </div>
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

                                        </CardContent>

                                    </Card>


                                </div>
                            </TabsContent>


                            <TabsContent value="review" className="flex-1 flex flex-col overflow-hidden">
                                <div className="border rounded-md overflow-hidden flex-1">
                                    <div className="max-h-[calc(90vh-420px)] overflow-y-auto">
                                        <Table className="min-w-full">
                                            <TableHeader className="sticky top-0 bg-white z-10 shadow">
                                                <TableRow>
                                                    <TableHead className="w-[40px] text-xs font-semibold">#</TableHead>
                                                    <TableHead className="text-xs font-semibold">Company</TableHead>
                                                    <TableHead className="text-xs font-semibold">Bank Name</TableHead>
                                                    <TableHead className="text-xs font-semibold">Account Number</TableHead>
                                                    <TableHead className="text-xs font-semibold">Currency</TableHead>
                                                    <TableHead className="text-xs font-semibold">Period</TableHead>
                                                    <TableHead className="text-xs font-semibold">Status</TableHead>
                                                    <TableHead className="text-xs font-semibold">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {uploadItems.map((item, index) => (
                                                    <TableRow key={index} className={item.status === 'unmatched' ? 'bg-yellow-50' : ''}>
                                                        <TableCell className="text-xs">{index + 1}</TableCell>
                                                        <TableCell className="text-xs">{item.matchedBank?.company_name || item.extractedData?.company_name || '-'}</TableCell>
                                                        <TableCell className="text-xs">{item.matchedBank?.bank_name || item.extractedData?.bank_name || '-'}</TableCell>
                                                        <TableCell className="font-mono text-xs">{item.matchedBank?.account_number || item.extractedData?.account_number || '-'}</TableCell>
                                                        <TableCell className="text-xs">{item.matchedBank?.bank_currency || item.extractedData?.currency || '-'}</TableCell>
                                                        <TableCell className="text-xs">{item.extractedData?.statement_period || '-'}</TableCell>
                                                        <TableCell className="text-xs">{getStatusBadge(item.status)}</TableCell>
                                                        <TableCell className="text-xs">
                                                            {item.status === 'failed' && (
                                                                <div className="text-red-500">{item.error}</div>
                                                            )}
                                                            {item.status === 'unmatched' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="bg-green-800 text-white text-xs"
                                                                    onClick={() => {
                                                                        setCurrentManualMatchItem(index);
                                                                        setShowBankSelectorDialog(true);
                                                                    }}
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
                                    <Button variant="outline" onClick={onClose} disabled={uploading} className="text-xs px-3 py-1">
                                        Close
                                    </Button>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setActiveTab('vouching')}
                                            disabled={uploadItems.filter(i => i.status === 'matched' || i.status === 'uploaded').length === 0}
                                            className="text-xs px-3 py-1"
                                        >
                                            Go to Vouching
                                        </Button>

                                        <Button
                                            variant="default"
                                            onClick={handleStartProcessing}
                                            disabled={uploadItems.length === 0 || uploading}
                                            className="text-xs px-3 py-1"
                                        >
                                            {uploading ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    <FileCheck className="h-3 w-3 mr-1" />
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


                {/* Password dialog */}
                {showPasswordDialog && (
                    <PasswordInputDialog
                        isOpen={showPasswordDialog}
                        onClose={() => setShowPasswordDialog(false)}
                        files={passwordProtectedFiles}
                        onPasswordSubmit={tryPassword}
                        onSkip={skipPasswordFiles}
                    />
                )}

                {showBankSelectorDialog && currentManualMatchItem !== null && (
                    <Dialog open={showBankSelectorDialog} onOpenChange={setShowBankSelectorDialog}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Select Bank for Statement</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-3">
                                <Label>Select a bank for this statement</Label>
                                <select
                                    className="w-full p-2 border rounded-md"
                                    value={selectedBankIds[currentManualMatchItem] || 0}
                                    onChange={(e) => setSelectedBankIds(prev => ({
                                        ...prev,
                                        [currentManualMatchItem]: parseInt(e.target.value)
                                    }))}
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
                                    placeholder="Closing Balance (optional)"
                                    value={closingBalanceInputs[currentManualMatchItem] || ''}
                                    onChange={(e) => setClosingBalanceInputs(prev => ({
                                        ...prev,
                                        [currentManualMatchItem]: e.target.value
                                    }))}
                                />
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowBankSelectorDialog(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="default"
                                    onClick={() => {
                                        // Apply the manual match
                                        const bankId = selectedBankIds[currentManualMatchItem] || 0;
                                        if (bankId > 0) {
                                            handleManualUpload(
                                                currentManualMatchItem,
                                                bankId,
                                                closingBalanceInputs[currentManualMatchItem] ?
                                                    parseFloat(closingBalanceInputs[currentManualMatchItem]) :
                                                    null
                                            );
                                        }
                                        setShowBankSelectorDialog(false);
                                    }}
                                    disabled={!selectedBankIds[currentManualMatchItem] || selectedBankIds[currentManualMatchItem] === 0}
                                >
                                    Apply Match
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
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