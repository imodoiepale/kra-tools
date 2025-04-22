// @ts-nocheck
// BankStatementBulkUploadDialog.tsx

import { useState, useRef, useEffect } from 'react'
import {
    Loader2, Upload, AlertTriangle, CheckCircle, UploadCloud,
    FileText, Building, Landmark, CreditCard, DollarSign,
    Calendar, X, ArrowRight, FileCheck, FilePlus, FileWarning,
    ChevronDown, ChevronRight, Save, Eye, CircleDashed, XCircle, FileSearch
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
import { BankExtractionDialog } from './BankExtractionDialog'
import {
    isPdfPasswordProtected,
    applyPasswordToFiles,
    performBankStatementExtraction,
    processBulkExtraction
} from '@/lib/bankExtractionUtils'
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

// Import PDF.js functionality
import * as pdfjsLib from 'pdfjs-dist';
// Initialize PDF.js worker
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
    acc_password?: string
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
    password?: string
    passwordApplied?: boolean
    detectedInfo?: {
        password?: string;
        accountNumber?: string;
        bankName?: string;
    }
}

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
    statementCycleId: string | null
    onUploadsComplete: () => void
}

export function BankStatementBulkUploadDialog({
    isOpen,
    onClose,
    banks = [],
    cycleMonth,
    cycleYear,
    statementCycleId,
    onUploadsComplete
}: BankStatementBulkUploadDialogProps) {
    const safeBanks = Array.isArray(banks) ? banks : [];
    const [activeTab, setActiveTab] = useState<string>('upload')
    const [uploadItems, setUploadItems] = useState<BulkUploadItem[]>([])
    const [uploading, setUploading] = useState<boolean>(false)
    const [processingIndex, setProcessingIndex] = useState<number>(-1)
    const [overallProgress, setOverallProgress] = useState<number>(0)
    const [totalMatched, setTotalMatched] = useState<number>(0)
    const [totalUnmatched, setTotalUnmatched] = useState<number>(0)
    const [companyGroups, setCompanyGroups] = useState<CompanyGroup[]>([])

    // Enhanced state for validation and extraction dialogs
    const [showValidationDialog, setShowValidationDialog] = useState<boolean>(false)
    const [showExtractionDialog, setShowExtractionDialog] = useState<boolean>(false)
    const [currentProcessingItem, setCurrentProcessingItem] = useState<BulkUploadItem | null>(null)
    const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1)
    const [extractionResults, setExtractionResults] = useState<any>(null)
    const [validationResults, setValidationResults] = useState<{ isValid: boolean, mismatches: string[] } | null>(null)
    const [processingQueue, setProcessingQueue] = useState<number[]>([])

    const [showValidation, setShowValidation] = useState<boolean>(false)
    const [currentValidationItem, setCurrentValidationItem] = useState<{ item: BulkUploadItem, index: number } | null>(null)
    const [validationResult, setValidationResult] = useState<any>(null)

    const [localCycleId, setLocalCycleId] = useState<string | null>(statementCycleId);

    const [currentManualMatchItem, setCurrentManualMatchItem] = useState<number | null>(null);
    const [showBankSelectorDialog, setShowBankSelectorDialog] = useState<boolean>(false);

    const [passwordProtectedFiles, setPasswordProtectedFiles] = useState([]);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
    const [vouchingNotes, setVouchingNotes] = useState<{ [key: number]: string }>({});
    const [vouchingChecked, setVouchingChecked] = useState<{ [key: number]: boolean }>({});
    const [closingBalanceInputs, setClosingBalanceInputs] = useState<{ [key: number]: string }>({});
    const [selectedBankIds, setSelectedBankIds] = useState<{ [key: number]: number }>({});
    const [softCopyStates, setSoftCopyStates] = useState<{ [key: number]: boolean }>({});
    const [hardCopyStates, setHardCopyStates] = useState<{ [key: number]: boolean }>({});

    // New state for companies
    const [companies, setCompanies] = useState<any[]>([]);
    const [availableBanks, setAvailableBanks] = useState<any[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState<boolean>(false);
    const [isDragging, setIsDragging] = useState<boolean>(false);

    // New state for random mode
    const [randomMode, setRandomMode] = useState<boolean>(false);

    const fileInputRef = useRef<HTMLInputElement>(null)
    const { toast } = useToast()

    // Use useEffect to sync with prop changes
    useEffect(() => {
        if (statementCycleId) {
            setLocalCycleId(statementCycleId);
        }
    }, [statementCycleId]);

    // Fetch companies when dialog opens
    useEffect(() => {
        let isMounted = true;

        const fetchCompanies = async () => {
            if (!isOpen) return;

            setLoadingCompanies(true);
            try {
                console.log("Fetching companies and matching with banks");
                // First fetch all banks to ensure we have the data
                const { data: banksData, error: banksError } = await supabase
                    .from('acc_portal_banks')
                    .select('id, company_id, bank_name, account_number, company_name, acc_password, bank_currency');

                if (banksError) {
                    console.error('Error fetching banks:', banksError);
                    throw banksError;
                }

                console.log("Available banks:", banksData);

                // Then fetch companies
                const { data: companiesData, error: companiesError } = await supabase
                    .from('acc_portal_company_duplicate')
                    .select('*')
                    .order('company_name');

                if (!isMounted) return; // Don't update state if component unmounted

                if (companiesError) {
                    console.error('Error fetching companies:', companiesError);
                    toast({
                        title: 'Error',
                        description: 'Failed to fetch companies',
                        variant: 'destructive',
                    });
                    return;
                }

                // Group banks by company for accurate counting
                const banksByCompany = {};
                banksData?.forEach(bank => {
                    if (bank && bank.company_id) {
                        if (!banksByCompany[bank.company_id]) {
                            banksByCompany[bank.company_id] = [];
                        }
                        banksByCompany[bank.company_id].push(bank);
                    }
                });

                console.log("Banks by company:", banksByCompany);

                // Process companies to include bank count
                const companiesWithBankCount = (companiesData || []).map(company => {
                    const companyBanks = banksByCompany[company.id] || [];
                    return {
                        ...company,
                        bankCount: companyBanks.length
                    };
                });

                // Sort companies - those with banks first, then alphabetically
                companiesWithBankCount.sort((a, b) => {
                    // Companies with banks go first
                    if (a.bankCount > 0 && b.bankCount === 0) return -1;
                    if (a.bankCount === 0 && b.bankCount > 0) return 1;
                    // Then sort alphabetically
                    return a.company_name.localeCompare(b.company_name);
                });

                if (isMounted) {
                    setCompanies(companiesWithBankCount);
                    setAvailableBanks(banksData);
                }
            } catch (error) {
                console.error('Error fetching companies:', error);
                if (isMounted) {
                    toast({
                        title: 'Error',
                        description: 'Failed to fetch companies',
                        variant: 'destructive'
                    });
                }
            } finally {
                if (isMounted) {
                    setLoadingCompanies(false);
                }
            }
        };

        // Only fetch companies when the dialog opens
        if (isOpen) {
            fetchCompanies();
        }

        return () => {
            isMounted = false;
        };
    // Only depend on isOpen to avoid endless fetching
    }, [isOpen]); 

    // Effect to fetch all banks when in random mode
    useEffect(() => {
        if (!randomMode) return;
        
        const fetchAllBanks = async () => {
            try {
                console.log('Fetching all banks for random mode');
                
                const { data, error } = await supabase
                    .from('acc_portal_banks')
                    .select('*');
                
                if (error) {
                    console.error('Error fetching all banks:', error);
                    return;
                }
                
                console.log(`Found ${data?.length || 0} total banks for random mode`);
                setAvailableBanks(data || []);
            } catch (error) {
                console.error('Error in fetchAllBanks:', error);
            }
        };
        
        fetchAllBanks();
    }, [randomMode]);

    // Effect to fetch banks when company changes
    useEffect(() => {
        if (!selectedCompanyId) return;
        
        const fetchBanksForCompany = async () => {
            try {
                console.log(`Fetching banks specifically for company ID: ${selectedCompanyId}`);
                
                const { data, error } = await supabase
                    .from('acc_portal_banks')
                    .select('*')
                    .eq('company_id', selectedCompanyId);
                
                if (error) {
                    console.error('Error fetching banks for company:', error);
                    return;
                }
                
                console.log(`Found ${data?.length || 0} banks for company ${selectedCompanyId}:`, data);
                setAvailableBanks(data || []);
            } catch (error) {
                console.error('Error in fetchBanksForCompany:', error);
            }
        };
        
        fetchBanksForCompany();
    }, [selectedCompanyId]);

    // Effect to organize items by company after processing
    useEffect(() => {
        if (activeTab === 'vouching') {
            organizeByCompany();
        }
    }, [activeTab, uploadItems]);

    // Drag and drop handlers
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (!randomMode && !selectedCompanyId) {
            toast({
                title: "Selection Required",
                description: "Please select a company or enable random mode",
                variant: "warning"
            });
            return;
        }

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelection({ target: { files: e.dataTransfer.files } });
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleClick = () => {
        if (fileInputRef.current && (!randomMode || selectedCompanyId)) {
            fileInputRef.current.click();
        } else if (!randomMode && !selectedCompanyId) {
            toast({
                title: "Select a Company",
                description: "Please select a company before uploading files",
                variant: "warning"
            });
        }
    };

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

    // Enhanced function to get bank name from filename with fuzzy matching
    const getBankNameFromFilename = (filename: string) => {
        // Convert filename to lowercase for case-insensitive matching
        const lowerFilename = filename.toLowerCase();
        
        // Common bank names to check
        const bankNames = [
            'kcb', 'equity', 'stanbic', 'standard chartered', 'stanchart', 'absa', 'barclays', 
            'coop', 'cooperative', 'ncba', 'cba', 'diamond trust', 'dtb', 'family', 'i&m', 'im bank',
            'gulf', 'uob', 'prime', 'bank of africa', 'boa', 'credit bank', 'eco bank', 'ecobank'
        ];
        
        // Try to find any bank name in the filename
        for (const bank of bankNames) {
            if (lowerFilename.includes(bank)) {
                return bank;
            }
        }
        
        return null;
    };
    
    // Extract account number from filename
    const getAccountNumberFromFilename = (filename: string) => {
        // Look for common account number patterns
        // This regex matches sequences that look like account numbers:
        // - Groups of digits (at least 5) 
        // - May contain hyphens or spaces
        const accountNumberRegex = /[0-9]{5,}|[0-9]{2,}[-\s][0-9]{2,}[-\s][0-9]{2,}/g;
        const matches = filename.match(accountNumberRegex);
        
        return matches ? matches[0] : null;
    };
    
    // Fuzzy match a bank based on filename
    const fuzzyMatchBank = (filename: string, allBanks: any[]) => {
        console.log('Attempting fuzzy match for filename:', filename);
        
        if (!filename || !allBanks || allBanks.length === 0) {
            return null;
        }
        
        // Extract potential bank name and account number
        const detectedBankName = getBankNameFromFilename(filename);
        const detectedAccountNumber = getAccountNumberFromFilename(filename);
        
        console.log('Detected in filename:', { 
            bankName: detectedBankName, 
            accountNumber: detectedAccountNumber 
        });
        
        // If we have an account number, it's the strongest match
        if (detectedAccountNumber) {
            const normalizedDetectedNumber = detectedAccountNumber.replace(/[-\s]/g, '');
            
            // Try to find an exact match for account number
            const exactMatch = allBanks.find(bank => {
                const normalizedBankNumber = (bank.account_number || '').replace(/[-\s]/g, '');
                return normalizedBankNumber === normalizedDetectedNumber;
            });
            
            if (exactMatch) {
                console.log('Found exact account number match:', exactMatch);
                return exactMatch;
            }
            
            // Try to find a partial match (account number contains or is contained in)
            const partialMatch = allBanks.find(bank => {
                const normalizedBankNumber = (bank.account_number || '').replace(/[-\s]/g, '');
                return normalizedBankNumber.includes(normalizedDetectedNumber) || 
                       normalizedDetectedNumber.includes(normalizedBankNumber);
            });
            
            if (partialMatch) {
                console.log('Found partial account number match:', partialMatch);
                return partialMatch;
            }
        }
        
        // If we have a bank name, try to match it
        if (detectedBankName) {
            const bankMatch = allBanks.find(bank => {
                const bankNameLower = (bank.bank_name || '').toLowerCase();
                return bankNameLower.includes(detectedBankName) || 
                       detectedBankName.includes(bankNameLower);
            });
            
            if (bankMatch) {
                console.log('Found bank name match:', bankMatch);
                return bankMatch;
            }
        }
        
        // If all else fails, look for any overlap between filename and bank/company name
        for (const bank of allBanks) {
            const bankNameLower = (bank.bank_name || '').toLowerCase();
            const companyNameLower = (bank.company_name || '').toLowerCase();
            
            if (bankNameLower && lowerFilename.includes(bankNameLower)) {
                console.log('Found bank name in filename match:', bank);
                return bank;
            }
            
            if (companyNameLower && lowerFilename.includes(companyNameLower)) {
                console.log('Found company name in filename match:', bank);
                return bank;
            }
        }
        
        console.log('No matches found for file:', filename);
        return null;
    };

    const handleFileSelection = (event: any) => {
        if (!randomMode && !selectedCompanyId) {
            toast({
                title: "Selection Required",
                description: "Please select a company or enable random mode",
                variant: "warning"
            });
            return;
        }

        const files = event?.target?.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        const newItems = fileArray.map((file: File) => {
            if (!file) return null;

            // Detect file information
            const fileName = file.name || '';
            const detectedPassword = detectPasswordFromFilename(fileName);
            const detectedAccountNumber = detectAccountNumberFromFilename(fileName);
            const detectedBankName = getBankNameFromFilename(fileName);

            // Find matching bank for this company
            let matchedBank = null;
            let matchConfidence = 0;

            // Try to match by account number first (highest confidence)
            if (detectedAccountNumber) {
                if (randomMode) {
                    matchedBank = fuzzyMatchBank(fileName, availableBanks);
                    if (matchedBank) matchConfidence = 50;
                } else {
                    const companyBanks = availableBanks.filter(bank => bank?.company_id === selectedCompanyId);
                    matchedBank = companyBanks.find(bank =>
                        bank?.account_number?.includes(detectedAccountNumber) ||
                        detectedAccountNumber.includes(bank?.account_number || '')
                    );
                    if (matchedBank) matchConfidence = 90;
                }
            }

            // If no match by account number, try by bank name (medium confidence)
            if (!matchedBank && detectedBankName) {
                if (randomMode) {
                    matchedBank = fuzzyMatchBank(fileName, availableBanks);
                    if (matchedBank) matchConfidence = 50;
                } else {
                    const companyBanks = availableBanks.filter(bank => bank?.company_id === selectedCompanyId);
                    matchedBank = companyBanks.find(bank =>
                        bank?.bank_name?.toLowerCase().includes(detectedBankName.toLowerCase()) ||
                        detectedBankName.toLowerCase().includes(bank?.bank_name?.toLowerCase() || '')
                    );
                    if (matchedBank) matchConfidence = 70;
                }
            }

            return {
                file,
                status: matchedBank ? 'matched' : 'unmatched',
                extractedData: null,
                matchedBank: matchedBank,
                closingBalance: null,
                error: null,
                matchConfidence,
                uploadProgress: 0,
                detectedInfo: {
                    password: detectedPassword,
                    accountNumber: detectedAccountNumber,
                    bankName: detectedBankName
                },
                fileName: formatFileName(file),
                originalName: file.name || 'Unknown file',
                hasSoftCopy: true,
                hasHardCopy: false
            };
        }).filter(Boolean);

        setUploadItems(prevItems => [...prevItems, ...newItems]);
    };

    // Enhanced version of handleStartProcessing to use the new flow
    const handleStartProcessing = async () => {
        if (!uploadItems || uploadItems.length === 0) {
            toast({
                title: 'No files selected',
                description: 'Please select bank statement files to upload',
                variant: 'destructive'
            });
            return;
        }

        // Check if we have a cycle ID
        if (!localCycleId) {
            toast({
                title: 'Error',
                description: 'No statement cycle ID available',
                variant: 'destructive'
            });
            return;
        }

        // Check that all items have matched banks
        const unmatchedItems = uploadItems.filter(item => !item.matchedBank);
        if (unmatchedItems.length > 0) {
            toast({
                title: 'Unmatched Banks',
                description: `${unmatchedItems.length} file(s) don't have matched banks. Please match all files before proceeding.`,
                variant: 'destructive'
            });
            return;
        }

        setUploading(true);
        setActiveTab('processing');
        setOverallProgress(10);

        // Create a queue of items to process
        const itemsToProcess = uploadItems
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.status !== 'uploaded' && item.status !== 'vouched')
            .map(({ index }) => index);

        setProcessingQueue(itemsToProcess);
        setOverallProgress(20);

        // Check for password-protected files first
        await processPasswordProtectedFiles();
    };

    // Function to handle password-protected files
    const processPasswordProtectedFiles = async () => {
        try {
            // Check each file for password protection
            const passwordItems = [];

            for (let i = 0; i < uploadItems.length; i++) {
                const item = uploadItems[i];
                if (!item || !item.file || item.status === 'uploaded' || item.status === 'vouched') continue;

                // Update status to processing for UI feedback
                setUploadItems(prev => {
                    const updated = [...prev];
                    if (updated[i]) {
                        updated[i] = {
                            ...updated[i],
                            status: 'processing',
                            uploadProgress: 10
                        };
                    }
                    return updated;
                });

                // Check if PDF is password protected
                let isProtected = false;
                try {
                    isProtected = await isPdfPasswordProtected(item.file);
                } catch (error) {
                    console.error(`Error checking if file is password protected:`, error);
                    // Assume it might be protected if we can't check
                    isProtected = true;
                }

                if (isProtected) {
                    console.log(`File ${i} is password protected`);

                    // Try with bank's password first
                    if (item.matchedBank?.acc_password) {
                        try {
                            const success = await applyPasswordToFiles(item.file, item.matchedBank.acc_password);
                            if (success) {
                                // Password applied successfully
                                setUploadItems(prev => {
                                    const updated = [...prev];
                                    if (updated[i]) {
                                        updated[i] = {
                                            ...updated[i],
                                            password: item.matchedBank?.acc_password,
                                            passwordApplied: true,
                                            uploadProgress: 20
                                        };
                                    }
                                    return updated;
                                });
                                continue;
                            }
                        } catch (error) {
                            console.error(`Error applying bank password:`, error);
                        }
                    }

                    // Try with detected password
                    if (item.detectedInfo?.password) {
                        try {
                            const success = await applyPasswordToFiles(item.file, item.detectedInfo.password);
                            if (success) {
                                // Password applied successfully
                                setUploadItems(prev => {
                                    const updated = [...prev];
                                    if (updated[i]) {
                                        updated[i] = {
                                            ...updated[i],
                                            password: item.detectedInfo?.password,
                                            passwordApplied: true,
                                            uploadProgress: 20
                                        };
                                    }
                                    return updated;
                                });
                                continue;
                            }
                        } catch (error) {
                            console.error(`Error applying detected password:`, error);
                        }
                    }

                    // If we reach here, we couldn't auto-apply a password
                    passwordItems.push({
                        index: i,
                        fileName: item.file.name || 'Unknown file',
                        file: item.file,
                        possiblePasswords: [
                            item.detectedInfo?.password,
                            item.matchedBank?.acc_password
                        ].filter(Boolean)
                    });
                }
            }

            // If we have password-protected files that need manual input
            if (passwordItems.length > 0) {
                setPasswordProtectedFiles(passwordItems);
                setShowPasswordDialog(true);
                setOverallProgress(30);
                return; // Halt processing until passwords are provided
            }

            // If no password-protected files, proceed with the document processing queue
            if (processingQueue.length > 0) {
                const firstItemIndex = processingQueue[0];
                const updatedQueue = processingQueue.slice(1);
                setProcessingQueue(updatedQueue);

                // Start processing the first item
                handleFileExtraction(firstItemIndex);
            } else {
                // No items to process
                setUploading(false);
                setOverallProgress(100);
                toast({
                    title: 'No Files to Process',
                    description: 'All files have been processed already',
                    variant: 'default'
                });
            }

        } catch (error) {
            console.error('Error processing password-protected files:', error);
            toast({
                title: 'Error',
                description: `Failed to process files: ${error?.message || 'Unknown error'}`,
                variant: 'destructive'
            });
            setUploading(false);
        }
    };

    const handleFileExtraction = async (itemIndex: number) => {
        const item = uploadItems[itemIndex];
        if (!item || !item.file || !item.matchedBank) {
            console.error('Invalid item for extraction');
            return;
        }

        setCurrentProcessingItem(item);
        setCurrentItemIndex(itemIndex);
        setExtractionResults(null);
        setValidationResults(null);

        try {
            // Create temporary URL for extraction
            const fileUrl = URL.createObjectURL(item.file);

            // Perform extraction
            const extractionResult = await performBankStatementExtraction(
                fileUrl,
                {
                    month: cycleMonth,
                    year: cycleYear,
                    password: item.passwordApplied ? item.password : null
                }
            );

            // Store results
            setExtractionResults(extractionResult);

            // Validate the results if extraction successful
            if (extractionResult?.success) {
                const validationResult = validateExtractedData(extractionResult.extractedData, item.matchedBank);
                setValidationResults(validationResult);

                // Show validation dialog
                setShowValidationDialog(true);
            } else {
                // If extraction failed, continue with upload anyway
                toast({
                    title: "Extraction Warning",
                    description: "Could not extract data from the statement. Continuing with upload.",
                    variant: "warning"
                });

                // Proceed with upload without extraction data
                await handleFileUpload(itemIndex, null);
            }

            // Clean up URL
            URL.revokeObjectURL(fileUrl);
        } catch (error) {
            console.error('Extraction error:', error);
            toast({
                title: "Extraction Error",
                description: `Failed to extract data: ${error?.message || 'Unknown error'}`,
                variant: "destructive"
            });

            // Continue with upload anyway
            await handleFileUpload(itemIndex, null);
        }
    };

    const handleFileUpload = async (itemIndex: number, extractedData: any) => {
        const item = uploadItems[itemIndex];
        if (!item || !item.file || !item.matchedBank) {
            console.error('Invalid item for upload');
            return;
        }

        // Update UI
        setUploadItems(prev => {
            const updated = [...prev];
            if (updated[itemIndex]) {
                updated[itemIndex] = {
                    ...updated[itemIndex],
                    status: 'processing',
                    uploadProgress: 50
                };
            }
            return updated;
        });

        try {
            // Upload file to storage
            const bank = item.matchedBank;
            const pdfFileName = `bank_statement_${bank.company_id || 'unknown'}_${bank.id || 'unknown'}_${cycleYear}_${cycleMonth}.pdf`;
            const pdfFilePath = `statement_documents/${cycleYear}/${cycleMonth}/${bank.company_name || 'unknown'}/${pdfFileName}`;

            const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                .from('Statement-Cycle')
                .upload(pdfFilePath, item.file, {
                    cacheControl: '0',
                    upsert: true
                });

            if (pdfUploadError) throw pdfUploadError;
            const pdfPath = pdfUploadData?.path;

            // Update UI
            setUploadItems(prev => {
                const updated = [...prev];
                if (updated[itemIndex]) {
                    updated[itemIndex].uploadProgress = 75;
                }
                return updated;
            });

            // Create statement document info
            const statementDocumentInfo = {
                statement_pdf: pdfPath,
                statement_excel: null,
                document_size: item.file.size || 0,
                password: item.passwordApplied ? item.password : null
            };

            // Create statement data
            const statementData = {
                bank_id: bank.id,
                company_id: bank.company_id,
                statement_cycle_id: localCycleId,
                statement_month: cycleMonth,
                statement_year: cycleYear,
                has_soft_copy: item.hasSoftCopy || false,
                has_hard_copy: item.hasHardCopy || false,
                statement_document: statementDocumentInfo,
                statement_extractions: extractedData || {
                    bank_name: null,
                    account_number: null,
                    currency: null,
                    statement_period: null,
                    opening_balance: null,
                    closing_balance: null,
                    monthly_balances: []
                },
                validation_status: {
                    is_validated: validationResults?.isValid || false,
                    validation_date: validationResults ? new Date().toISOString() : null,
                    validated_by: null,
                    mismatches: validationResults?.mismatches || []
                },
                status: {
                    status: 'pending_validation',
                    assigned_to: null,
                    verification_date: null
                }
            };

            // Check if statement already exists (continued)
            const { data: existingStatement, error: existingError } = await supabase
                .from('acc_cycle_bank_statements')
                .select('id')
                .eq('bank_id', bank.id)
                .eq('statement_month', cycleMonth)
                .eq('statement_year', cycleYear)
                .single();

            if (existingError && existingError.code !== 'PGRST116') {
                // If error is not "no rows returned" error, throw it
                throw existingError;
            }

            // Update or insert statement record
            let statementResponse;
            if (existingStatement?.id) {
                statementResponse = await supabase
                    .from('acc_cycle_bank_statements')
                    .update(statementData)
                    .eq('id', existingStatement.id)
                    .select();
            } else {
                statementResponse = await supabase
                    .from('acc_cycle_bank_statements')
                    .insert(statementData)
                    .select();
            }

            if (statementResponse.error) throw statementResponse.error;

            // Update UI to show success
            setUploadItems(prev => {
                const updated = [...prev];
                if (updated[itemIndex]) {
                    updated[itemIndex] = {
                        ...updated[itemIndex],
                        status: 'uploaded',
                        uploadProgress: 100,
                        extractedData: extractedData
                    };
                }
                return updated;
            });

            // Process next item in queue
            processNextQueueItem();

            return true;
        } catch (error) {
            console.error('Upload error:', error);

            // Update UI to show failure
            setUploadItems(prev => {
                const updated = [...prev];
                if (updated[itemIndex]) {
                    updated[itemIndex] = {
                        ...updated[itemIndex],
                        status: 'failed',
                        error: error?.message || 'Unknown error',
                        uploadProgress: 0
                    };
                }
                return updated;
            });

            // Process next item in queue
            processNextQueueItem();

            return false;
        }
    };

    // Function to process the next item in the queue
    const processNextQueueItem = () => {
        if (processingQueue.length > 0) {
            const nextItemIndex = processingQueue[0];
            const updatedQueue = processingQueue.slice(1);
            setProcessingQueue(updatedQueue);

            // Process the next item
            handleFileExtraction(nextItemIndex);
        } else {
            // All items processed
            setShowValidationDialog(false);
            setShowExtractionDialog(false);
            setCurrentProcessingItem(null);
            setCurrentItemIndex(-1);

            // Show completion toast
            toast({
                title: 'Upload Complete',
                description: 'All statements have been processed',
                variant: 'default'
            });

            // Switch to vouching tab
            setActiveTab('vouching');
            organizeByCompany();
        }
    };

    // Function to handle validation results
    const handleProceedWithValidation = async () => {
        setShowValidationDialog(false);

        if (currentItemIndex >= 0 && extractionResults?.success) {
            // Proceed with upload using the extracted data
            await handleFileUpload(currentItemIndex, extractionResults.extractedData);

            // Show extraction dialog if needed
            if (extractionResults.extractedData) {
                setShowExtractionDialog(true);
            }
        } else {
            // Process next item if this one failed
            processNextQueueItem();
        }
    };

    // Function to cancel current upload
    const cancelCurrentUpload = () => {
        setShowValidationDialog(false);
        setShowExtractionDialog(false);

        // Update item status
        if (currentItemIndex >= 0) {
            setUploadItems(prev => {
                const updated = [...prev];
                if (updated[currentItemIndex]) {
                    updated[currentItemIndex] = {
                        ...updated[currentItemIndex],
                        status: 'failed',
                        error: 'Canceled by user',
                        uploadProgress: 0
                    };
                }
                return updated;
            });
        }

        // Process next item
        processNextQueueItem();
    };

    // Function to handle extraction dialog close
    const handleExtractionDialogClose = () => {
        setShowExtractionDialog(false);
        processNextQueueItem();
    };

    // Validate extracted data
    const validateExtractedData = (extractedData: any, bank: Bank) => {
        const mismatches: string[] = [];

        if (!extractedData || !bank) {
            return { isValid: false, mismatches: ['No extracted data or bank match'] };
        }

        // Check bank name
        if (extractedData.bank_name && !extractedData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())) {
            mismatches.push('Bank name mismatch');
        }

        // Check account number
        if (extractedData.account_number && !extractedData.account_number.includes(bank.account_number)) {
            mismatches.push('Account number mismatch');
        }

        // Check currency
        if (extractedData.currency) {
            const normalizedExtractedCurrency = normalizeCurrencyCode(extractedData.currency);
            const normalizedBankCurrency = normalizeCurrencyCode(bank.bank_currency);

            if (normalizedExtractedCurrency !== normalizedBankCurrency) {
                mismatches.push('Currency mismatch');
            }
        }

        // Check statement period
        if (extractedData.statement_period) {
            const periodContainsExpectedMonth = isPeriodContained(
                extractedData.statement_period,
                cycleMonth,
                cycleYear
            );

            if (!periodContainsExpectedMonth) {
                mismatches.push('Statement period mismatch');
            }
        }

        return {
            isValid: mismatches.length === 0,
            mismatches
        };
    };

    // Normalize currency code
    const normalizeCurrencyCode = (code: string | null): string => {
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
            'SH': 'KES',
            'KES': 'KES'
        };

        return currencyMap[upperCode] || upperCode;
    };

    // Check if period is contained within a given month/year
    const isPeriodContained = (statementPeriod: string, cycleMonth: number, cycleYear: number): boolean => {
        if (!statementPeriod) return false;

        const monthYearRegex = new RegExp(`\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+${cycleYear}\\b`, 'i');
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

        if (monthYearRegex.test(statementPeriod)) {
            const normalizedPeriod = statementPeriod.toLowerCase();
            const cycleMonthName = monthNames[cycleMonth];
            return normalizedPeriod.includes(cycleMonthName);
        }

        try {
            // If there's a date range format (e.g., "01/01/2024 - 30/01/2024")
            const dates = statementPeriod.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g);
            if (!dates || dates.length < 2) return false;

            const parseDate = (dateStr: string) => {
                const parts = dateStr.split(/[\/\-\.]/);
                if (parts.length !== 3) return null;

                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);

                if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                    return { day, month, year };
                }

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

            if (startDate.year < cycleYear && endDate.year > cycleYear) return true;
            if (startDate.year > cycleYear || endDate.year < cycleYear) return false;

            if (startDate.year === cycleYear && cycleMonth < startDate.month) return false;
            if (endDate.year === cycleYear && cycleMonth > endDate.month) return false;

            return true;
        } catch (error) {
            console.error('Error validating statement period:', error);
            return false;
        }
    };

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

    const removeItem = (index: number) => {
        setUploadItems(items => items.filter((_, i) => i !== index));
    };

    // Format file size utility function
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Get status badge
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="bg-gray-100 text-gray-800">Pending</Badge>;
            case 'processing':
                return <Badge variant="outline" className="bg-blue-100 text-blue-800">Processing</Badge>;
            case 'matched':
                return <Badge variant="outline" className="bg-green-100 text-green-800">Matched</Badge>;
            case 'unmatched':
                return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Unmatched</Badge>;
            case 'failed':
                return <Badge variant="outline" className="bg-red-100 text-red-800">Failed</Badge>;
            case 'uploaded':
                return <Badge variant="outline" className="bg-green-100 text-green-800">Uploaded</Badge>;
            case 'vouched':
                return <Badge variant="outline" className="bg-purple-100 text-purple-800">Vouched</Badge>;
            default:
                return <Badge variant="outline">Unknown</Badge>;
        }
    };

    // Return the JSX component
    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => {
                if (!open && !uploading) {
                    onClose();
                    setUploadItems([]);
                    setSelectedCompanyId(null);
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
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="upload" disabled={uploading}>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Files
                            </TabsTrigger>
                            <TabsTrigger value="processing">
                                <Loader2 className="w-4 h-4 mr-2" />
                                Processing
                            </TabsTrigger>
                            <TabsTrigger value="review">
                                <FileCheck className="w-4 h-4 mr-2" />
                                Review & Match
                            </TabsTrigger>
                            <TabsTrigger value="vouching">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Vouching
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="upload" className="flex-1 flex flex-col space-y-4 py-4 px-1">
                            <div className="space-y-4">
                                {/* Company Selection */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-sm font-medium">Select Company</Label>
                                        <div className="flex items-center space-x-2">
                                            <Switch 
                                                id="random-mode"
                                                checked={randomMode}
                                                onCheckedChange={setRandomMode}
                                            />
                                            <Label htmlFor="random-mode" className="text-xs">Random Mode</Label>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="cursor-help ml-1">
                                                        <HelpCircle className="h-3.5 w-3.5 text-gray-500" />
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs">
                                                    <p>Random mode auto-detects company and bank from filenames using fuzzy matching</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                    {loadingCompanies ? (
                                        <div className="flex items-center justify-center py-2">
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Loading companies...
                                        </div>
                                    ) : (
                                        <Select
                                            value={selectedCompanyId?.toString() || "placeholder"}
                                            onValueChange={(value) => setSelectedCompanyId(value === "placeholder" ? null : parseInt(value))}
                                            disabled={loadingCompanies || randomMode}
                                        >
                                            <SelectTrigger className={`w-full ${randomMode ? 'opacity-50' : ''}`}>
                                                <SelectValue placeholder={randomMode ? "Auto-detect from filenames" : "Select a company"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="placeholder">-- Select a Company --</SelectItem>
                                                {companies.map((company: any) => (
                                                    <SelectItem key={company.id} value={company.id.toString()}>
                                                        {company.company_name} {company.bankCount > 0 ? `(${company.bankCount} banks)` : "(No banks)"}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                {/* Display company's banks when selected */}
                                {(selectedCompanyId || randomMode) && (
                                    <div className="border rounded-md p-4 bg-gray-50 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-medium">
                                                {randomMode ? "Auto-detect Mode Active" : "Available Banks"}
                                            </h3>
                                            {!randomMode && selectedCompanyId && (
                                                <Badge variant="outline" className="bg-blue-50">
                                                    {availableBanks.length} Banks
                                                </Badge>
                                            )}
                                        </div>

                                        {randomMode ? (
                                            <div className="bg-white border rounded-md p-4">
                                                <div className="flex items-start space-x-3">
                                                    <div className="bg-blue-50 p-2 rounded-full">
                                                        <FileSearch className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-sm mb-1">Auto-detect Mode</h4>
                                                        <p className="text-sm text-gray-600">
                                                            In this mode, you can upload statements from any company. The system will 
                                                            automatically try to match each file with the appropriate bank account using:
                                                        </p>
                                                        <ul className="text-sm text-gray-600 mt-2 list-disc pl-5 space-y-1">
                                                            <li>Bank name detection from filename</li>
                                                            <li>Account number extraction</li>
                                                            <li>Company name matching</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : selectedCompanyId && availableBanks.length === 0 ? (
                                            <div className="text-center text-gray-500 py-6 bg-white border rounded-md">
                                                <Landmark className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                                <p>No banks configured for this company</p>
                                            </div>
                                        ) : selectedCompanyId ? (
                                            <div className="border rounded-md overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-gray-100">
                                                        <TableRow>
                                                            <TableHead className="font-medium">#</TableHead>
                                                            <TableHead className="font-medium">Bank Name</TableHead>
                                                            <TableHead className="font-medium">Account Number</TableHead>
                                                            <TableHead className="font-medium">Currency</TableHead>
                                                            <TableHead className="font-medium">Password</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {availableBanks
                                                            .filter(bank => bank?.company_id === selectedCompanyId)
                                                            .map((bank, index) => (
                                                                <TableRow key={bank.id}>
                                                                    <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                                                                    <TableCell className="font-medium">{bank.bank_name}</TableCell>
                                                                    <TableCell className="font-mono text-sm">{bank.account_number}</TableCell>
                                                                    <TableCell>{bank.bank_currency || 'KES'}</TableCell>
                                                                    <TableCell>
                                                                        {bank.acc_password ? (
                                                                            <Badge variant="outline" className="bg-green-50 text-green-700">
                                                                                {bank.acc_password}
                                                                            </Badge>
                                                                        ) : (
                                                                            <Badge variant="outline" className="bg-red-50 text-red-700">
                                                                                Not Set
                                                                            </Badge>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        ) : (
                                            <div className="text-center text-gray-500 py-6 bg-white border rounded-md">
                                                <Landmark className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                                <p>Select a company to view available banks</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Enhanced drag and drop area */}
                                <div className="flex items-center gap-4">
                                    <div
                                        className={`
                                            group relative flex-1 border-2 border-dashed rounded-md 
                                            transition-all duration-200 cursor-pointer
                                            ${isDragging
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                                            }
                                            ${!randomMode && !selectedCompanyId ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragEnter}
                                        onDragLeave={handleDragLeave}
                                        onClick={handleClick}
                                    >
                                        <div className="p-8 flex flex-col items-center justify-center space-y-2">
                                            <UploadCloud className={`h-10 w-10 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                                            <p className="text-center text-gray-500">
                                                {isDragging
                                                    ? 'Drop files here...'
                                                    : 'Drag and drop files here, or click to select files'
                                                }
                                            </p>
                                            <p className="text-xs text-gray-400">Only PDF files are accepted</p>
                                        </div>
                                        <Input
                                            id="pdf-file"
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf"
                                            multiple
                                            onChange={handleFileSelection}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            disabled={!randomMode && !selectedCompanyId}
                                        />
                                    </div>
                                    <Button
                                        onClick={handleStartProcessing}
                                        disabled={uploadItems.length === 0 || (!randomMode && !selectedCompanyId) || uploading}
                                        className="h-[100px] px-6"
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <FilePlus className="h-5 w-5 mr-2" />
                                                Process Files ({uploadItems.length})
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {/* Files table */}
                                <div className="border rounded-md overflow-hidden">
                                    <div className="max-h-[350px] overflow-y-auto">
                                        <Table className="w-full">
                                            <TableHeader className="sticky top-0 bg-background z-10">
                                                <TableRow>
                                                    <TableHead className="w-[50px]">#</TableHead>
                                                    <TableHead>File Name</TableHead>
                                                    <TableHead className="w-[100px]">Size</TableHead>
                                                    <TableHead>Matched Bank</TableHead>
                                                    <TableHead className="w-[120px]">Status</TableHead>
                                                    <TableHead className="w-[80px]">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {uploadItems.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                            No files selected. Select PDF bank statements to upload.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    uploadItems.map((item, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                                                            <TableCell className="font-medium">{item.fileName.fullName}</TableCell>
                                                            <TableCell className="text-muted-foreground">
                                                                {formatFileSize(item.file.size)}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.matchedBank ? (
                                                                    <div>
                                                                        <p className="font-medium">{item.matchedBank.bank_name}</p>
                                                                        <p className="text-xs font-mono text-muted-foreground">
                                                                            {item.matchedBank.account_number}
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                                                                        No match
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                                                            <TableCell>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
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
                                        Upload multiple bank statements at once. The system will attempt to automatically match each statement with the correct bank account.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </TabsContent>

                        <TabsContent value="processing" className="flex-1 flex flex-col space-y-2 py-2 px-2">
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg flex items-center">
                                            <Loader2 className={`h-5 w-5 mr-2 ${uploading ? 'animate-spin' : ''}`} />
                                            Bulk Processing Status
                                        </CardTitle>
                                        <CardDescription>
                                            Processing {uploadItems.length} files {uploading ? '(in progress)' : '(completed)'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-6">
                                            {/* Overall Progress */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Overall Progress</span>
                                                    <span>{overallProgress}%</span>
                                                </div>
                                                <Progress value={overallProgress} className="h-2" />
                                            </div>

                                            {/* Stages Progress */}
                                            <div className="grid grid-cols-4 gap-4">
                                                <div className={`p-3 rounded-md border ${overallProgress >= 25
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {overallProgress >= 25 ? (
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                                        )}
                                                        <span className="text-sm font-medium">File Processing</span>
                                                    </div>
                                                </div>
                                                <div className={`p-3 rounded-md border ${overallProgress >= 50
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {overallProgress >= 50 ? (
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                                        )}
                                                        <span className="text-sm font-medium">Data Extraction</span>
                                                    </div>
                                                </div>
                                                <div className={`p-3 rounded-md border ${overallProgress >= 75
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {overallProgress >= 75 ? (
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                                        )}
                                                        <span className="text-sm font-medium">Statement Creation</span>
                                                    </div>
                                                </div>
                                                <div className={`p-3 rounded-md border ${overallProgress >= 95
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {overallProgress >= 95 ? (
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                                        )}
                                                        <span className="text-sm font-medium">Finalizing</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Processing Stats */}
                                            <div className="grid grid-cols-3 gap-4 mt-4">
                                                <div className="p-3 bg-green-50 rounded-md border border-green-200">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                        <span className="text-sm font-medium text-green-800">
                                                            Matched: {uploadItems.filter(i => i.status === 'matched' || i.status === 'uploaded').length}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                                                    <div className="flex items-center gap-2">
                                                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                        <span className="text-sm font-medium text-yellow-800">
                                                            Unmatched: {uploadItems.filter(i => i.status === 'unmatched').length}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-red-50 rounded-md border border-red-200">
                                                    <div className="flex items-center gap-2">
                                                        <XCircle className="h-4 w-4 text-red-500" />
                                                        <span className="text-sm font-medium text-red-800">
                                                            Failed: {uploadItems.filter(i => i.status === 'failed').length}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex justify-end pt-4">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        if (overallProgress >= 100) {
                                                            setActiveTab('vouching');
                                                        } else {
                                                            setActiveTab('review');
                                                        }
                                                    }}
                                                    disabled={uploading}
                                                    className="bg-blue-500 hover:bg-blue-600 text-white hover:text-white"
                                                >
                                                    {overallProgress >= 100 ? 'Continue to Vouching' : 'Review Results'}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Individual File Status Table */}
                                <div className="border rounded-md overflow-hidden" style={{ maxHeight: '400px' }}>
                                    <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
                                        <Table className="w-full">
                                            <TableHeader className="sticky top-0 bg-white z-10">
                                                <TableRow>
                                                    <TableHead>#</TableHead>
                                                    <TableHead>File Name</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Progress</TableHead>
                                                    <TableHead>Bank/Account</TableHead>
                                                    <TableHead>Password</TableHead>
                                                    <TableHead>Details</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {uploadItems.map((item, index) => (
                                                    <TableRow key={index} className={item.status === 'failed' ? 'bg-red-50' : ''}>
                                                        <TableCell className="text-xs">{index + 1}</TableCell>
                                                        <TableCell className="font-medium text-sm truncate max-w-[200px]" title={item.file.name}>
                                                            {item.file.name}
                                                        </TableCell>
                                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                                        <TableCell>
                                                            <Progress value={item.uploadProgress || 0} className="h-2 w-32" />
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.matchedBank ? (
                                                                <div className="text-xs">
                                                                    <div className="font-medium">{item.matchedBank.bank_name}</div>
                                                                    <div className="text-muted-foreground">{item.matchedBank.account_number}</div>
                                                                </div>
                                                            ) : item.detectedInfo?.accountNumber ? (
                                                                <div className="text-xs">
                                                                    <div className="text-muted-foreground">Detected: {item.detectedInfo.accountNumber}</div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">Not detected</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.passwordApplied ? (
                                                                <div className="text-xs font-mono text-green-600">{item.password}</div>
                                                            ) : item.detectedInfo?.password ? (
                                                                <div className="text-xs font-mono">{item.detectedInfo.password}</div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">Not detected</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.status === 'failed' ? (
                                                                <div className="text-red-500">{item.error}</div>
                                                            ) : item.status === 'processing' ? (
                                                                <div className="text-blue-600">Processing...</div>
                                                            ) : (
                                                                <div className="text-muted-foreground">
                                                                    {item.extractedData ? 'Data extracted' : 'No data yet'}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
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
                                                <TableHead className="text-xs font-semibold">Status</TableHead>
                                                <TableHead className="text-xs font-semibold">Extraction</TableHead>
                                                <TableHead className="text-xs font-semibold">Password</TableHead>
                                                <TableHead className="text-xs font-semibold">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {uploadItems.map((item, index) => (
                                                <TableRow key={index} className={item.status === 'unmatched' ? 'bg-yellow-50' : ''}>
                                                    <TableCell className="text-xs">{index + 1}</TableCell>
                                                    <TableCell className="text-xs">{item.matchedBank?.company_name || 'Unknown'}</TableCell>
                                                    <TableCell className="text-xs">{item.matchedBank?.bank_name || item.detectedInfo?.bankName || 'Unknown'}</TableCell>
                                                    <TableCell className="font-mono text-xs">{item.matchedBank?.account_number || item.detectedInfo?.accountNumber || 'Unknown'}</TableCell>
                                                    <TableCell className="text-xs">{getStatusBadge(item.status)}</TableCell>
                                                    <TableCell className="text-xs">
                                                        {item.extractedData ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700">
                                                                Extracted
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-gray-50">
                                                                None
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {item.passwordApplied ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700">
                                                                Applied
                                                            </Badge>
                                                        ) : item.detectedInfo?.password ? (
                                                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                                                                Detected
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-gray-50">
                                                                None
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {item.status === 'failed' ? (
                                                            <div className="text-red-500">{item.error}</div>
                                                        ) : item.status === 'unmatched' ? (
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
                                                        ) : (
                                                            <></>
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
                                                            <div className="space-y-3 py-2 px-3 bg-slate-50 rounded-md border border-slate-200">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-slate-500">Statement Details</Label>
                                                                        <div className="text-sm">
                                                                            <p><span className="font-medium">Bank Name:</span> {statement.matchedBank?.bank_name || 'Not detected'}</p>
                                                                            <p><span className="font-medium">Account Number:</span> {statement.matchedBank?.account_number || 'Not detected'}</p>
                                                                            <p><span className="font-medium">Currency:</span> {statement.matchedBank?.bank_currency || 'Not detected'}</p>
                                                                            <p><span className="font-medium">Period:</span> {statement.extractedData?.statement_period || format(new Date(cycleYear, cycleMonth), 'MMMM yyyy')}</p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-slate-500">Balance Information</Label>
                                                                        <div className="text-sm">
                                                                            <p><span className="font-medium">Opening Balance:</span> {statement.extractedData?.opening_balance ?? 'Not extracted'}</p>
                                                                            <p><span className="font-medium">Closing Balance:</span> {statement.extractedData?.closing_balance ?? 'Not extracted'}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-1">
                                                                    <Label className="text-xs text-slate-500">Vouching Notes</Label>
                                                                    <Input
                                                                        placeholder="Add notes about this statement verification..."
                                                                        value={vouchingNotes[statement.file.name] || ''}
                                                                        onChange={(e) => {
                                                                            setVouchingNotes(prev => ({ ...prev, [statement.file.name]: e.target.value }));

                                                                            // Also update the uploadItems
                                                                            setUploadItems(items => {
                                                                                const updated = [...items];
                                                                                const index = items.findIndex(i => i === statement);
                                                                                if (index >= 0) {
                                                                                    updated[index].vouchNotes = e.target.value;
                                                                                }
                                                                                return updated;
                                                                            });
                                                                        }}
                                                                    />
                                                                </div>

                                                                <div className="flex justify-between items-center pt-2">
                                                                    <div className="flex items-center space-x-2">
                                                                        <Checkbox
                                                                            id={`vouched-${statementIdx}`}
                                                                            checked={vouchingChecked[statement.file.name] || false}
                                                                            onCheckedChange={(checked) => {
                                                                                setVouchingChecked(prev => ({ ...prev, [statement.file.name]: !!checked }));

                                                                                // Also update the uploadItems
                                                                                setUploadItems(items => {
                                                                                    const updated = [...items];
                                                                                    const index = items.findIndex(i => i === statement);
                                                                                    if (index >= 0) {
                                                                                        updated[index].isVouched = !!checked;
                                                                                        updated[index].status = checked ? 'vouched' : 'uploaded';
                                                                                    }
                                                                                    return updated;
                                                                                });
                                                                            }}
                                                                        />
                                                                        <Label htmlFor={`vouched-${statementIdx}`} className="text-sm font-medium">
                                                                            Verified and vouched
                                                                        </Label>
                                                                    </div>

                                                                    <div className="space-x-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                // Logic to view statement
                                                                                toast({
                                                                                    title: "View Statement",
                                                                                    description: `Viewing statement for ${statement.matchedBank?.company_name} / ${statement.matchedBank?.bank_name}`,
                                                                                });
                                                                            }}
                                                                        >
                                                                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                                                                            View
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
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
                                    onClick={() => {
                                        onClose();
                                        onUploadsComplete();
                                    }}
                                >
                                    Complete Vouching
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Bank Validation Dialog */}
            {showValidationDialog && currentProcessingItem && validationResults && (
                <BankValidationDialog
                    isOpen={showValidationDialog}
                    onClose={() => setShowValidationDialog(false)}
                    bank={currentProcessingItem.matchedBank}
                    extractedData={extractionResults?.extractedData}
                    mismatches={validationResults.mismatches}
                    onProceed={handleProceedWithValidation}
                    onCancel={cancelCurrentUpload}
                    cycleMonth={cycleMonth}
                    cycleYear={cycleYear}
                    fileUrl={currentProcessingItem.file ? URL.createObjectURL(currentProcessingItem.file) : null}
                />
            )}

            {/* Bank Extraction Dialog */}
            {showExtractionDialog && currentProcessingItem && extractionResults && (
                <BankExtractionDialog
                    isOpen={showExtractionDialog}
                    onClose={handleExtractionDialogClose}
                    bank={currentProcessingItem.matchedBank}
                    statement={{
                        id: "temp-id",
                        bank_id: currentProcessingItem.matchedBank.id,
                        statement_month: cycleMonth,
                        statement_year: cycleYear,
                        statement_document: {
                            statement_pdf: null,
                            statement_excel: null,
                            document_size: currentProcessingItem.file?.size || 0
                        },
                        statement_extractions: extractionResults.extractedData,
                        validation_status: {
                            is_validated: validationResults?.isValid || false,
                            validation_date: new Date().toISOString(),
                            validated_by: null,
                            mismatches: validationResults?.mismatches || []
                        },
                        has_soft_copy: currentProcessingItem.hasSoftCopy || true,
                        has_hard_copy: currentProcessingItem.hasHardCopy || false,
                        status: {
                            status: 'pending_validation',
                            assigned_to: null,
                            verification_date: null
                        }
                    }}
                    pdfPassword={currentProcessingItem.passwordApplied ? currentProcessingItem.password : null}
                    onStatementUpdated={() => {
                        handleExtractionDialogClose();
                    }}
                />
            )}

            {/* Password Dialog */}
            {showPasswordDialog && passwordProtectedFiles.length > 0 && (
                <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Password Required</DialogTitle>
                            <DialogDescription>
                                {passwordProtectedFiles.length} file(s) require a password to continue.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 mt-4">
                            {passwordProtectedFiles.map((fileItem, idx) => (
                                <div key={idx} className="border rounded-md p-3 bg-slate-50">
                                    <div className="font-medium text-sm mb-2 flex items-center">
                                        <FileText className="h-4 w-4 mr-2 text-blue-600" />
                                        <span className="truncate max-w-[260px]" title={fileItem.fileName}>
                                            {fileItem.fileName}
                                        </span>
                                    </div>

                                    <div className="grid gap-2">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="password"
                                                placeholder="Enter password"
                                                className="text-sm"
                                                onChange={(e) => {
                                                    // Update password for this file
                                                    const updatedItems = [...uploadItems];
                                                    if (updatedItems[fileItem.index]) {
                                                        updatedItems[fileItem.index].password = e.target.value;
                                                    }
                                                    setUploadItems(updatedItems);
                                                }}
                                                value={uploadItems[fileItem.index]?.password || ''}
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={async () => {
                                                    const item = uploadItems[fileItem.index];
                                                    if (!item || !item.file || !item.password) return;

                                                    try {
                                                        const success = await applyPasswordToFiles(item.file, item.password);
                                                        if (success) {
                                                            // Password applied successfully
                                                            setUploadItems(prev => {
                                                                const updated = [...prev];
                                                                updated[fileItem.index] = {
                                                                    ...updated[fileItem.index],
                                                                    passwordApplied: true
                                                                };
                                                                return updated;
                                                            });

                                                            // Remove from password list
                                                            setPasswordProtectedFiles(prev =>
                                                                prev.filter(f => f.index !== fileItem.index)
                                                            );

                                                            toast({
                                                                title: "Success",
                                                                description: `Password applied to ${fileItem.fileName}`,
                                                            });
                                                        } else {
                                                            toast({
                                                                title: "Error",
                                                                description: "Invalid password",
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
                                                    }
                                                }}
                                            >
                                                Apply
                                            </Button>
                                        </div>

                                        {/* Show possible passwords if available */}
                                        {fileItem.possiblePasswords && fileItem.possiblePasswords.length > 0 && (
                                            <div className="text-xs text-gray-600 mt-1">
                                                <div>Possible passwords:</div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {fileItem.possiblePasswords.map((pwd, pwdIdx) => (
                                                        <Badge
                                                            key={pwdIdx}
                                                            variant="outline"
                                                            className="cursor-pointer hover:bg-blue-50"
                                                            onClick={async () => {
                                                                // Apply this password
                                                                const item = uploadItems[fileItem.index];
                                                                if (!item || !item.file) return;

                                                                try {
                                                                    const success = await applyPasswordToFiles(item.file, pwd);
                                                                    if (success) {
                                                                        // Password applied successfully
                                                                        setUploadItems(prev => {
                                                                            const updated = [...prev];
                                                                            updated[fileItem.index] = {
                                                                                ...updated[fileItem.index],
                                                                                password: pwd,
                                                                                passwordApplied: true
                                                                            };
                                                                            return updated;
                                                                        });

                                                                        // Remove from password list
                                                                        setPasswordProtectedFiles(prev =>
                                                                            prev.filter(f => f.index !== fileItem.index)
                                                                        );

                                                                        toast({
                                                                            title: "Success",
                                                                            description: `Password applied to ${fileItem.fileName}`,
                                                                        });
                                                                    } else {
                                                                        toast({
                                                                            title: "Warning",
                                                                            description: "Suggested password didn't work",
                                                                            variant: "warning"
                                                                        });
                                                                    }
                                                                } catch (error) {
                                                                    console.error('Error applying password:', error);
                                                                }
                                                            }}
                                                        >
                                                            {pwd}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {uploadItems[fileItem.index]?.passwordApplied && (
                                            <div className="text-xs text-green-600 flex items-center">
                                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                Password applied successfully
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <DialogFooter className="flex justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    // Skip password-protected files
                                    setShowPasswordDialog(false);

                                    // Mark all password files as failed
                                    setUploadItems(prev => {
                                        const updated = [...prev];
                                        passwordProtectedFiles.forEach(file => {
                                            if (updated[file.index] && !updated[file.index].passwordApplied) {
                                                updated[file.index] = {
                                                    ...updated[file.index],
                                                    status: 'failed',
                                                    error: 'Password required but not provided',
                                                    uploadProgress: 0
                                                };
                                            }
                                        });
                                        return updated;
                                    });

                                    // Continue with the process queue
                                    processNextQueueItem();
                                }}
                            >
                                Skip Password Files
                            </Button>

                            <Button
                                type="button"
                                onClick={() => {
                                    // Check if all files have passwords applied
                                    const allApplied = passwordProtectedFiles.every(file =>
                                        uploadItems[file.index]?.passwordApplied
                                    );

                                    if (allApplied) {
                                        setShowPasswordDialog(false);
                                        // Continue with the processing queue
                                        if (processingQueue.length > 0) {
                                            const nextItemIndex = processingQueue[0];
                                            const updatedQueue = processingQueue.slice(1);
                                            setProcessingQueue(updatedQueue);
                                            handleFileExtraction(nextItemIndex);
                                        }
                                    } else {
                                        toast({
                                            title: "Password Required",
                                            description: "Please apply passwords to all files or skip them",
                                            variant: "warning"
                                        });
                                    }
                                }}
                            >
                                Continue
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Bank Selector Dialog for Manual Matching */}
            {showBankSelectorDialog && currentManualMatchItem !== null && (
                <Dialog open={showBankSelectorDialog} onOpenChange={setShowBankSelectorDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Select Bank for Statement</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-3">
                            <Label>Select a bank for this statement</Label>
                            <Select
                                value={selectedBankIds[currentManualMatchItem]?.toString() || "placeholder"}
                                onValueChange={(value) => setSelectedBankIds(prev => ({
                                    ...prev,
                                    [currentManualMatchItem]: value === "placeholder" ? 0 : parseInt(value)
                                }))}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a bank" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="placeholder">-- Select Bank --</SelectItem>
                                    {availableBanks
                                        .filter(bank => bank?.company_id === selectedCompanyId)
                                        .map(bank => (
                                        <SelectItem key={bank.id} value={bank.id.toString()}>
                                            {bank.bank_name} - {bank.account_number}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

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
                                        const matchedBank = availableBanks.find(b => b.id === bankId);
                                        if (matchedBank) {
                                            setUploadItems(items => {
                                                const updated = [...items];
                                                if (updated[currentManualMatchItem]) {
                                                    updated[currentManualMatchItem] = {
                                                        ...updated[currentManualMatchItem],
                                                        matchedBank,
                                                        status: 'matched',
                                                        closingBalance: closingBalanceInputs[currentManualMatchItem] ?
                                                            parseFloat(closingBalanceInputs[currentManualMatchItem]) : null
                                                    };
                                                }
                                                return updated;
                                            });
                                        }
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
    );
}