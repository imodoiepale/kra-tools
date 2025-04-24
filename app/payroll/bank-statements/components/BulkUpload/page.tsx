// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Loader2, FileCheck, CheckCircle, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { TooltipProvider } from '@/components/ui/tooltip';

import UploadTab from './UploadTab';
import ProcessingTab from './ProcessingTab';
import ReviewTab from './ReviewTab';
import VouchingTab from './VouchingTab';
import PasswordDialog from './dialogs/PasswordDialog';
import BankSelectorDialog from './dialogs/BankSelectorDialog';
import { StatementCycleConfirmationDialog } from '../StatementCycleConfirmationDialog';
import { BankValidationDialog } from '../BankValidationDialog';
import { BankExtractionDialog } from '../BankExtractionDialog';
import { ExtractionsService } from '@/lib/extractionService';
import {
    parseStatementPeriod,
    generateMonthRange,
    isPdfPasswordProtected,
    applyPasswordToFiles,
    validateExtractedData
} from './utils/extractionUtils';

import { Bank, BulkUploadItem, CompanyGroup, PasswordProtectedFile } from './types';

interface BankStatementBulkUploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    banks: Bank[];
    cycleMonth: number;
    cycleYear: number;
    statementCycleId: string | null;
    onUploadsComplete?: () => void;
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
    const [activeTab, setActiveTab] = useState<string>('upload');
    const [uploadItems, setUploadItems] = useState<BulkUploadItem[]>([]);
    const [uploading, setUploading] = useState<boolean>(false);
    const [processingIndex, setProcessingIndex] = useState<number>(-1);
    const [overallProgress, setOverallProgress] = useState<number>(0);
    const [totalMatched, setTotalMatched] = useState<number>(0);
    const [totalUnmatched, setTotalUnmatched] = useState<number>(0);
    const [companyGroups, setCompanyGroups] = useState<CompanyGroup[]>([]);

    // Enhanced state for validation and extraction dialogs
    const [showValidationDialog, setShowValidationDialog] = useState<boolean>(false);
    const [showExtractionDialog, setShowExtractionDialog] = useState<boolean>(false);
    const [currentProcessingItem, setCurrentProcessingItem] = useState<BulkUploadItem | null>(null);
    const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1);
    const [extractionResults, setExtractionResults] = useState<any>(null);
    const [validationResults, setValidationResults] = useState<{ isValid: boolean, mismatches: string[] } | null>(null);
    const [processingQueue, setProcessingQueue] = useState<number[]>([]);

    const [showValidation, setShowValidation] = useState<boolean>(false);
    const [currentValidationItem, setCurrentValidationItem] = useState<{ item: BulkUploadItem, index: number } | null>(null);
    const [validationResult, setValidationResult] = useState<any>(null);

    const [localCycleId, setLocalCycleId] = useState<string | null>(statementCycleId);

    const [currentManualMatchItem, setCurrentManualMatchItem] = useState<number | null>(null);
    const [showBankSelectorDialog, setShowBankSelectorDialog] = useState<boolean>(false);

    const [passwordProtectedFiles, setPasswordProtectedFiles] = useState<PasswordProtectedFile[]>([]);
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

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});
    const [showCycleConfirmation, setShowCycleConfirmation] = useState(false);
    const [detectedCycles, setDetectedCycles] = useState({ existing: [], toCreate: [] });
    const [processingFiles, setProcessingFiles] = useState([]);
    const [extractionCache, setExtractionCache] = useState<Record<string, any>>({});
    const [uploadedStatement, setUploadedStatement] = useState(null);

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
    }, [isOpen, toast]);

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

    // Enhanced version of handleStartProcessing
    const handleStartProcessing = async () => {
        setUploading(true);
        setOverallProgress(10);

        try {
            // First, detect periods from each file
            const filesToProcess = uploadItems
                .filter(item => item.status === 'pending' || item.status === 'unmatched' || item.status === 'matched');

            if (filesToProcess.length === 0) {
                toast({
                    title: 'No Files to Process',
                    description: 'There are no files ready to process',
                    variant: 'default'
                });
                setUploading(false);
                return;
            }

            setProcessingFiles(filesToProcess);
            setOverallProgress(20);

            // Process each file and extract period data
            const validPeriods = [];
            const typedFiles = processingFiles as any[];
            for (const item of typedFiles) {
                if (item?.extractedData?.statement_period) {
                    console.log(`Processing file ${item?.file?.name} with period: ${item.extractedData.statement_period}`);
                    validPeriods.push({
                        period: item.extractedData.statement_period,
                        file: item.file || null,
                        matchedBank: item.matchedBank || null
                    });
                }
            }

            // Determine cycles needed based on detected periods
            const allNeededCycles = new Set();
            const detectedPeriods = [];

            console.log("Detected valid period results:", validPeriods.length);
            
            // Use current date as fallback if no valid periods detected
            if (validPeriods.length === 0) {
                const now = new Date();
                const currentMonth = now.getMonth() + 1; // 1-based month
                const currentYear = now.getFullYear();
                console.log(`No valid periods detected, using current month/year: ${currentMonth}/${currentYear}`);
                
                const monthStr = currentMonth.toString().padStart(2, '0');
                const cycleMonthYear = `${currentYear}-${monthStr}`;
                allNeededCycles.add(cycleMonthYear);
            }

            // Process each valid period result
            for (const result of validPeriods) {
                console.log(`Parsing statement period "${result.period}" from file:`, result.file?.name);
                const parsedPeriod = parseStatementPeriod(result.period);
                
                if (parsedPeriod) {
                    console.log(`Successfully parsed period:`, parsedPeriod);
                    detectedPeriods.push({
                        period: result.period,
                        file: result?.file, // Add optional chaining to fix lint error
                        matchedBank: result.matchedBank,
                        ...parsedPeriod
                    });

                    // Generate all months in this period range
                    const monthsInRange = generateMonthRange(
                        parsedPeriod.startMonth,
                        parsedPeriod.startYear,
                        parsedPeriod.endMonth,
                        parsedPeriod.endYear
                    );
                    
                    console.log(`Generated months in range for "${result.period}":`, monthsInRange);

                    // Add each month to the set of needed cycles
                    for (const { month, year } of monthsInRange) {
                        // Month is already 1-based, no need to add 1
                        const monthStr = month.toString().padStart(2, '0');
                        const cycleMonthYear = `${year}-${monthStr}`;
                        allNeededCycles.add(cycleMonthYear);
                        console.log(`Added cycle: ${cycleMonthYear} from month ${month}/${year}`);
                    }
                } else {
                    console.warn(`Failed to parse period "${result.period}" from file:`, result.file?.name);
                    
                    // If we can't parse the period but we have month/year parameters,
                    // at least add the current cycle
                    if (cycleMonth > 0 && cycleYear > 0) {
                        const monthStr = cycleMonth.toString().padStart(2, '0');
                        const cycleMonthYear = `${cycleYear}-${monthStr}`;
                        allNeededCycles.add(cycleMonthYear);
                        console.log(`Added fallback cycle: ${cycleMonthYear} from parameters`);
                    }
                }
            }

            console.log("All detected cycles:", Array.from(allNeededCycles));
            
            if (allNeededCycles.size === 0 && cycleMonth > 0 && cycleYear > 0) {
                // Ensure we have at least the current month if no cycles were detected
                const monthStr = cycleMonth.toString().padStart(2, '0');
                const cycleMonthYear = `${cycleYear}-${monthStr}`;
                allNeededCycles.add(cycleMonthYear);
                console.log(`Added default cycle: ${cycleMonthYear} when no cycles detected`);
            }

            // Check which cycles already exist and which need to be created
            const existingCycles = [];
            const cyclesToCreate = [];

            setOverallProgress(40);
            
            console.log(`Checking ${allNeededCycles.size} cycles against database:`);
            
            if (allNeededCycles.size === 0) {
                console.warn("No needed cycles detected, check period parsing logic");
                
                // Add a log to help diagnose the issue
                console.log("DetectedPeriods:", detectedPeriods);
                console.log("ValidPeriods:", validPeriods);
                console.log("ProcessingFiles:", processingFiles.map(f => 
                    `${f.file?.name}: ${f.extractedData?.statement_period || 'No period'}`));
            }

            // Check each needed cycle against database
            for (const cycleMonthYear of allNeededCycles) {
                try {
                    console.log(`Checking if cycle ${cycleMonthYear} exists in database`);
                    
                    const { data, error } = await supabase
                        .from('statement_cycles')
                        .select('id, month_year, status')
                        .eq('month_year', cycleMonthYear)
                        .maybeSingle();

                    if (error && error.code !== 'PGRST116') {
                        console.error(`Error checking cycle ${cycleMonthYear}:`, error);
                        continue;
                    }

                    if (data) {
                        console.log(`Cycle ${cycleMonthYear} already exists`, data);
                        existingCycles.push(data);
                    } else {
                        console.log(`Cycle ${cycleMonthYear} needs to be created`);
                        cyclesToCreate.push({
                            month_year: cycleMonthYear,
                            status: 'active'
                        });
                    }
                } catch (error) {
                    console.error(`Error checking cycle ${cycleMonthYear}:`, error);
                }
            }
            
            console.log("Existing cycles:", existingCycles);
            console.log("Cycles to create:", cyclesToCreate);

            // Store detected cycles
            setDetectedCycles({
                existing: existingCycles,
                toCreate: cyclesToCreate
            });

            // Show confirmation dialog
            setShowCycleConfirmation(true);
            setOverallProgress(50);
        } catch (error) {
            console.error('Error preparing statement processing:', error);
            toast({
                title: 'Error',
                description: 'Failed to analyze statement periods',
                variant: 'destructive'
            });
            setUploading(false);
        }
    };

    // Try all company passwords to unlock PDF
    const tryAllCompanyPasswords = async (file, companyId, detectedBankName = null) => {
        try {
            console.log('Attempting to unlock PDF with all company passwords');

            // Get all banks for this company
            const { data: companyBanks, error: banksError } = await supabase
                .from('acc_portal_banks')
                .select('id, bank_name, account_number, acc_password')
                .eq('company_id', companyId);

            if (banksError) {
                console.error('Error fetching company banks:', banksError);
                return { success: false, password: null };
            }

            // Filter banks by name if a bank name was detected
            let banksToTry = companyBanks;
            if (detectedBankName) {
                const matchedBanks = companyBanks.filter(bank =>
                    bank.bank_name.toLowerCase().includes(detectedBankName.toLowerCase()) ||
                    detectedBankName.toLowerCase().includes(bank.bank_name.toLowerCase())
                );

                // If we found matching banks, try them first
                if (matchedBanks.length > 0) {
                    banksToTry = [...matchedBanks, ...companyBanks.filter(b =>
                        !matchedBanks.some(mb => mb.id === b.id)
                    )];
                }
            }

            // Collect all unique passwords
            const uniquePasswords = [...new Set(
                banksToTry
                    .filter(bank => bank.acc_password) // Only consider banks with passwords
                    .map(bank => bank.acc_password)
            )];

            console.log(`Found ${uniquePasswords.length} unique passwords to try`);

            // Try each password
            for (const password of uniquePasswords) {
                try {
                    const success = await applyPasswordToFiles(file, password);
                    if (success) {
                        console.log('Successfully unlocked with password:', password);
                        return { success: true, password };
                    }
                } catch (e) {
                    console.log(`Password "${password}" failed:`, e);
                    // Continue to the next password
                }
            }

            console.log('None of the company passwords worked');
            return { success: false, password: null };
        } catch (error) {
            console.error('Error in tryAllCompanyPasswords:', error);
            return { success: false, password: null };
        }
    };

    const handleCycleConfirmation = async (selectedCycles) => {
        setShowCycleConfirmation(false);
        setOverallProgress(60);

        try {
            // Create new cycles that were selected
            for (const cycleToCreate of detectedCycles.toCreate) {
                // Skip if not selected
                if (!selectedCycles.includes(cycleToCreate.month_year)) continue;

                try {
                    const { data, error } = await supabase
                        .from('statement_cycles')
                        .insert({
                            month_year: cycleToCreate.month_year,
                            status: 'active',
                            created_at: new Date().toISOString()
                        })
                        .select();

                    if (error) {
                        console.error(`Error creating cycle ${cycleToCreate.month_year}:`, error);
                    } else if (data && data.length > 0) {
                        console.log(`Created cycle ${cycleToCreate.month_year}:`, data[0]);
                        // Add to existing cycles since it now exists
                        detectedCycles.existing.push(data[0]);
                    }
                } catch (error) {
                    console.error(`Error creating cycle ${cycleToCreate.month_year}:`, error);
                }
            }

            setOverallProgress(70);

            // Now process the files
            const itemsToProcess = processingFiles
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.status === 'pending' || item.status === 'unmatched' || item.status === 'matched')
                .map(({ index }) => index);

            // Set up the processing queue
            setProcessingQueue(itemsToProcess);

            // Switch to processing tab automatically
            setActiveTab('processing');

            // Start processing immediately
            setTimeout(() => {
                processPasswordProtectedFiles();
                // Ensure we move to processing UI right away
                if (itemsToProcess.length > 0) {
                    setProcessingIndex(itemsToProcess[0]);
                }
            }, 100);

        } catch (error) {
            console.error('Error confirming cycles:', error);
            toast({
                title: 'Error',
                description: 'Failed to process statement cycles',
                variant: 'destructive'
            });
            setUploading(false);
        }
    };

    // Function to handle password-protected files
    const processPasswordProtectedFiles = async () => {
        try {
            // Check each file for password protection
            const passwordItems = [];
            const readyForProcessing = [];

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

                                // Add to ready for processing list
                                readyForProcessing.push(i);
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

                                // Add to ready for processing list
                                readyForProcessing.push(i);
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
                } else {
                    // Not password protected, add to ready for processing
                    readyForProcessing.push(i);
                }
            }

            // If we have password-protected files that need manual input
            if (passwordItems.length > 0) {
                setPasswordProtectedFiles(passwordItems);
                setShowPasswordDialog(true);
                setOverallProgress(30);
                return; // Halt processing until passwords are provided
            }

            // Process ready files in batch if possible
            if (readyForProcessing.length > 0) {
                // Update processing queue with ready items
                setProcessingQueue(readyForProcessing);

                // Start processing the first item
                if (readyForProcessing.length > 0) {
                    handleFileExtraction(readyForProcessing[0]);
                }
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
        try {
            // Update status
            setProcessingIndex(itemIndex);
            const item = uploadItems[itemIndex];
            if (!item || !item.file) {
                throw new Error("Invalid file item");
            }

            setUploadItems(prev => {
                const updated = [...prev];
                if (updated[itemIndex]) {
                    updated[itemIndex] = {
                        ...updated[itemIndex],
                        status: 'processing',
                        uploadProgress: 30
                    };
                }
                return updated;
            });

            // Set up current processing item for UI
            setCurrentProcessingItem(item);
            setCurrentItemIndex(itemIndex);
            setExtractionResults(null);
            setValidationResults(null);

            // Prepare extraction options
            const extractionOptions = {
                month: cycleMonth,
                year: cycleYear,
                password: item.passwordApplied ? item.password : null,
                forceAiExtraction: true // Force fresh extraction to avoid cached data issues
            };

            // Use ExtractionsService directly (handles caching and URL cleanup internally)
            const extractionResult = await ExtractionsService.getExtraction(item.file, extractionOptions);

            console.log('Extraction result:', extractionResult?.success ? 'Success' : 'Failed');
            console.log('Raw extracted data sample:', 
                extractionResult?.extractedData 
                    ? JSON.stringify(extractionResult.extractedData).substring(0, 200) 
                    : 'No data extracted'
            );

            // Fix for data loss issue - create a proper deep copy before storing
            const extractionResultCopy = {
                ...extractionResult,
                extractedData: extractionResult?.success && extractionResult?.extractedData 
                    ? JSON.parse(JSON.stringify(extractionResult.extractedData))
                    : null
            };
            
            // Store results with the proper deep copy
            setExtractionResults(extractionResultCopy);
            
            // Validate the results if extraction successful
            if (extractionResultCopy?.success && extractionResultCopy?.extractedData) {
                console.log('Complete extracted data for validation:', extractionResultCopy.extractedData);
                
                const validationResult = validateExtractedData(extractionResultCopy.extractedData, item.matchedBank);
                setValidationResults(validationResult);

                // Store the extracted data directly in the current processing item for redundancy
                setCurrentProcessingItem(prev => ({
                    ...prev,
                    extractedData: extractionResultCopy.extractedData
                }));

                // Show validation dialog
                setShowValidationDialog(true);
            } else {
                // If extraction failed, continue with upload anyway
                toast({
                    title: "Extraction Warning",
                    description: extractionResult.requiresPassword
                        ? "PDF is password protected. Please provide a password."
                        : "Could not extract data from the statement. Continuing with upload.",
                    variant: "warning"
                });

                // Proceed with upload without extraction data
                await handleFileUpload(itemIndex, null);
                processNextQueueItem();
            }
        } catch (error) {
            console.error("Error during file extraction:", error);
            setUploadItems(prev => {
                const updated = [...prev];
                if (updated[itemIndex]) {
                    updated[itemIndex] = {
                        ...updated[itemIndex],
                        status: 'failed',
                        error: error.message || "Extraction failed",
                        uploadProgress: 0
                    };
                }
                return updated;
            });
            processNextQueueItem();
        }
    };

    // Function to process the next item in the queue
    const processNextQueueItem = () => {
        if (processingQueue.length > 0) {
            // Remove the first item (which was just processed)
            const updatedQueue = processingQueue.slice(1);
            setProcessingQueue(updatedQueue);

            // Process the next item if there are any left
            if (updatedQueue.length > 0) {
                const nextItemIndex = updatedQueue[0];
                handleFileExtraction(nextItemIndex);
            } else {
                // All items processed
                setShowValidationDialog(false);
                setShowExtractionDialog(false);
                setCurrentProcessingItem(null);
                setCurrentItemIndex(-1);

                // Show completion toast
                toast({
                    title: 'Processing Complete',
                    description: 'All statements have been processed',
                    variant: 'default'
                });

                // Switch to vouching tab
                setActiveTab('vouching');
                organizeByCompany();
                setUploading(false);
                setOverallProgress(100);
            }
        } else {
            // All items processed
            setShowValidationDialog(false);
            setShowExtractionDialog(false);
            setCurrentProcessingItem(null);
            setCurrentItemIndex(-1);
            setUploading(false);
            setOverallProgress(100);

            // Show completion toast
            toast({
                title: 'Processing Complete',
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
            } else {
                // Process next item if no extraction data
                processNextQueueItem();
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

        // Clean up temporary objects
        if (currentProcessingItem?.file) {
            URL.revokeObjectURL(URL.createObjectURL(currentProcessingItem.file));
        }
    };

    // Function to handle file upload to storage and database
    const handleFileUpload = async (itemIndex: number, extractedData: any, validationResult: any = null) => {
        const item = uploadItems[itemIndex];
        if (!item || !item.file || !item.matchedBank) {
            console.error('Invalid item for upload');
            return;
        }

        // Update UI to show upload in progress
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
            const pdfFileName = `bank_statement_${bank.company_id || 'unknown'}_${bank.id || 'unknown'}_${cycleYear}_${cycleMonth === 0 ? 1 : cycleMonth}.pdf`;
            const pdfFilePath = `statement_documents/${cycleYear}/${cycleMonth === 0 ? 1 : cycleMonth}/${bank.company_name || 'unknown'}/${pdfFileName}`;

            // Only upload if we haven't uploaded this file before
            let pdfPath = item.uploadedPdfPath;
            if (!pdfPath) {
                const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                    .from('Statement-Cycle')
                    .upload(pdfFilePath, item.file, {
                        cacheControl: '0',
                        upsert: true
                    });

                if (pdfUploadError) throw pdfUploadError;
                pdfPath = pdfUploadData?.path;
            }

            // Update UI to show upload progress
            setUploadItems(prev => {
                const updated = [...prev];
                if (updated[itemIndex]) {
                    updated[itemIndex].uploadProgress = 75;
                    updated[itemIndex].uploadedPdfPath = pdfPath;
                }
                return updated;
            });

            // Parse statement period to determine if this is a multi-month statement
            let isMultiMonth = false;
            let statementPeriod = extractedData?.statement_period || null;
            let statementType = 'monthly';

            if (statementPeriod) {
                const periodDates = parseStatementPeriod(statementPeriod);
                if (periodDates) {
                    const { startMonth, startYear, endMonth, endYear } = periodDates;
                    isMultiMonth = !(startMonth === endMonth && startYear === endYear);
                    statementType = isMultiMonth ? 'range' : 'monthly';
                }
            }

            // Create statement document info with proper path
            const statementDocumentInfo = {
                statement_pdf: pdfPath,
                statement_excel: null,
                document_size: item.file.size || 0,
                password: item.passwordApplied ? item.password : null,
                upload_date: new Date().toISOString(),
                file_name: item.file.name
            };

            // Create statement data with complete extracted information
            const statementData = {
                bank_id: bank.id,
                company_id: bank.company_id,
                statement_cycle_id: localCycleId,
                statement_month: cycleMonth === 0 ? 1 : cycleMonth,
                statement_year: cycleYear,
                statement_type: statementType,
                has_soft_copy: item.hasSoftCopy !== undefined ? item.hasSoftCopy : true,
                has_hard_copy: item.hasHardCopy !== undefined ? item.hasHardCopy : false,
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
                extraction_performed: !!extractedData,
                extraction_timestamp: extractedData ? new Date().toISOString() : null,
                validation_status: {
                    is_validated: validationResult?.isValid || false,
                    validation_date: validationResult ? new Date().toISOString() : null,
                    validated_by: null,
                    mismatches: validationResult?.mismatches || []
                },
                status: {
                    status: validationResult?.isValid ? 'validated' : 'pending_validation',
                    assigned_to: null,
                    verification_date: null
                }
            };

            // Check if statement already exists
            const { data: existingStatements, error: existingError } = await supabase
                .from('acc_cycle_bank_statements')
                .select('id')
                .eq('bank_id', bank.id)
                .eq('statement_month', cycleMonth === 0 ? 1 : cycleMonth)
                .eq('statement_year', cycleYear);

            if (existingError) {
                console.error('Error checking for existing statements:', existingError);
                throw existingError;
            }

            // Verify that the statement cycle exists in the correct table
            if (localCycleId) {
                const { data: cycleExists, error: cycleCheckError } = await supabase
                    .from('statement_cycles')
                    .select('id')
                    .eq('id', localCycleId)
                    .maybeSingle();

                if (cycleCheckError || !cycleExists) {
                    console.error('Statement cycle does not exist:', localCycleId);

                    // Create a new cycle since the existing one doesn't exist
                    const { data: newCycle, error: newCycleError } = await supabase
                        .from('statement_cycles')
                        .insert({
                            cycle_month: cycleMonth === 0 ? 1 : cycleMonth,
                            cycle_year: cycleYear,
                            month_year: `${cycleYear}-${(cycleMonth === 0 ? 1 : cycleMonth).toString().padStart(2, '0')}`,
                            status: 'active',
                            created_by: null
                        })
                        .select('id')
                        .single();

                    if (newCycleError) {
                        console.error('Error creating statement cycle:', newCycleError);
                        throw new Error(`Failed to create statement cycle: ${newCycleError.message}`);
                    }

                    // Update the local cycle ID with the new one
                    setLocalCycleId(newCycle.id);

                    // Update the statement data with the new cycle ID
                    statementData.statement_cycle_id = newCycle.id;
                    console.log('Created new statement cycle:', newCycle.id);
                }
            } else {
                // No cycle ID provided, create a new one
                const { data: newCycle, error: newCycleError } = await supabase
                    .from('statement_cycles')
                    .insert({
                        cycle_month: cycleMonth === 0 ? 1 : cycleMonth,
                        cycle_year: cycleYear,
                        month_year: `${cycleYear}-${(cycleMonth === 0 ? 1 : cycleMonth).toString().padStart(2, '0')}`,
                        status: 'active',
                        created_by: null
                    })
                    .select('id')
                    .single();

                if (newCycleError) {
                    console.error('Error creating statement cycle:', newCycleError);
                    throw new Error(`Failed to create statement cycle: ${newCycleError.message}`);
                }

                // Update the local cycle ID with the new one
                setLocalCycleId(newCycle.id);

                // Update the statement data with the new cycle ID
                statementData.statement_cycle_id = newCycle.id;
                console.log('Created new statement cycle:', newCycle.id);
            }

            let statementResponse;
            if (existingStatements && existingStatements.length > 0) {
                // Update existing statement
                console.log(`Updating existing statement for ${bank.bank_name} (${cycleMonth === 0 ? 1 : cycleMonth}/${cycleYear})`);
                statementResponse = await supabase
                    .from('acc_cycle_bank_statements')
                    .update(statementData)
                    .eq('id', existingStatements[0].id)
                    .select();
            } else {
                // Insert new statement
                console.log(`Creating new statement for ${bank.bank_name} (${cycleMonth === 0 ? 1 : cycleMonth}/${cycleYear})`);
                statementResponse = await supabase
                    .from('acc_cycle_bank_statements')
                    .insert(statementData)
                    .select();
            }

            if (statementResponse.error) {
                console.error('Error saving statement data:', statementResponse.error);
                throw statementResponse.error;
            }

            // Get the statement with ID
            const createdStatement = statementResponse.data[0];
            console.log('Statement saved successfully:', createdStatement.id);

            // If this is a multi-month statement, create statements for all months in the range
            if (statementType === 'range' && statementPeriod) {
                try {
                    await handleMultiMonthStatements(
                        createdStatement.id,
                        bank,
                        extractedData,
                        statementDocumentInfo
                    );
                } catch (error) {
                    console.error('Error handling multi-month statements:', error);
                    // Continue despite error in multi-month handling
                }
            }

            // Update UI to show success
            setUploadItems(prev => {
                const updated = [...prev];
                if (updated[itemIndex]) {
                    updated[itemIndex] = {
                        ...updated[itemIndex],
                        status: 'uploaded',
                        uploadProgress: 100,
                        extractedData: extractedData,
                        uploadedStatement: createdStatement,
                        error: null
                    };
                }
                return updated;
            });

            // Add this after updating the uploadItems state
            if (extractionResults?.success) {
                // Make sure we have a statement with an ID before showing the dialog
                if (createdStatement && createdStatement.id) {
                    console.log('Setting uploaded statement with ID:', createdStatement.id);
                    console.log('PDF path being passed to extraction dialog:', pdfPath);

                    // Create a clean statement object with PDF path explicitly included
                    const statementWithExtraction = {
                        ...createdStatement,
                        statement_extractions: extractionResults.extractedData,
                        statement_document: {
                            ...statementDocumentInfo,
                            statement_pdf: pdfPath // Ensure the PDF path is correctly passed
                        }
                    };

                    // Store the updated statement and show the extraction dialog
                    setUploadedStatement(statementWithExtraction);

                    // Show the extraction dialog after successful upload and extraction
                    setShowExtractionDialog(true);
                } else {
                    console.error('Created statement is missing ID', createdStatement);
                    toast({
                        title: 'Warning',
                        description: 'Statement created but ID is missing. Refresh may be required.',
                        variant: 'warning'
                    });

                    // Continue processing
                    processNextQueueItem();
                }
            }

            return createdStatement;
        } catch (error) {
            console.error('Upload error:', error);

            // Update UI to show failure
            setUploadItems(prev => {
                const updated = [...prev];
                if (updated[itemIndex]) {
                    updated[itemIndex] = {
                        ...updated[itemIndex],
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Unknown error',
                        uploadProgress: 0
                    };
                }
                return updated;
            });

            // Continue processing despite error
            processNextQueueItem();

            throw error;
        }
    };

    // Function to handle multi-month statements
    const handleMultiMonthStatements = async (parentId, bank, extractedData, documentInfo) => {
        try {
            // Don't proceed if we're missing key information
            if (!extractedData?.statement_period || !parentId || !bank) {
                console.log('Missing required information for multi-month processing');
                return;
            }

            console.log('Processing multi-month statement', {
                parentId,
                bank: bank?.bank_name,
                period: extractedData?.statement_period,
            });

            // Parse statement period
            const periodDates = parseStatementPeriod(extractedData.statement_period);
            if (!periodDates) {
                console.log('Could not parse statement period:', extractedData.statement_period);
                return;
            }

            console.log('Parsed period dates:', periodDates);

            // Generate all months in the range
            const monthsInRange = generateMonthRange(
                periodDates.startMonth,
                periodDates.startYear,
                periodDates.endMonth,
                periodDates.endYear
            );

            // Skip primary month (already created)
            const primaryMonth = cycleMonth === 0 ? 0 : cycleMonth - 1; // Convert to 0-based
            const primaryYear = cycleYear;

            // Filter out the primary month which is already handled
            const additionalMonths = monthsInRange.filter(
                period => !(period.month === primaryMonth && period.year === primaryYear)
            );

            console.log(`Creating ${additionalMonths.length} additional month statements`);

            // Create child statement records for each additional month
            for (const period of additionalMonths) {
                try {
                    // Find or create cycle for this month
                    const monthStr = (period.month + 1).toString().padStart(2, '0');
                    const cycleMonthYear = `${period.year}-${monthStr}`;

                    // Check if cycle exists
                    const { data: existingCycle, error: cycleError } = await supabase
                        .from('statement_cycles')
                        .select('id')
                        .eq('month_year', cycleMonthYear)
                        .maybeSingle();

                    if (cycleError) {
                        console.error(`Error checking cycle ${cycleMonthYear}:`, cycleError);
                        continue;
                    }

                    let cycleId;
                    if (existingCycle) {
                        cycleId = existingCycle.id;
                    } else {
                        // Create new cycle
                        const { data: newCycle, error: newCycleError } = await supabase
                            .from('statement_cycles')
                            .insert({
                                cycle_month: period.month + 1,
                                cycle_year: period.year,
                                month_year: cycleMonthYear,
                                status: 'active',
                                created_by: null
                            })
                            .select('id')
                            .single();

                        if (newCycleError) {
                            console.error(`Error creating cycle ${cycleMonthYear}:`, newCycleError);
                            continue;
                        }

                        cycleId = newCycle.id;
                    }

                    // Check if statement already exists for this month
                    const { data: existingStatements, error: existingError } = await supabase
                        .from('acc_cycle_bank_statements')
                        .select('id')
                        .eq('bank_id', bank.id)
                        .eq('statement_month', period.month + 1)
                        .eq('statement_year', period.year);

                    if (existingError) {
                        console.error('Error checking for existing statements:', existingError);
                        continue;
                    }

                    // Prepare statement data (reference parent statement)
                    const childStatementData = {
                        bank_id: bank.id,
                        company_id: bank.company_id,
                        statement_cycle_id: cycleId,
                        statement_month: period.month + 1,
                        statement_year: period.year,
                        statement_type: 'range_child',
                        parent_statement_id: parentId,
                        has_soft_copy: true,
                        has_hard_copy: false,
                        statement_document: documentInfo,
                        statement_extractions: extractedData,
                        extraction_performed: true,
                        extraction_timestamp: new Date().toISOString(),
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

                    // Create or update statement
                    if (existingStatements && existingStatements.length > 0) {
                        // Update existing statement
                        const { error: updateError } = await supabase
                            .from('acc_cycle_bank_statements')
                            .update(childStatementData)
                            .eq('id', existingStatements[0].id);

                        if (updateError) {
                            console.error(`Error updating child statement for ${period.month + 1}/${period.year}:`, updateError);
                        } else {
                            console.log(`Updated child statement for ${period.month + 1}/${period.year}`);
                        }
                    } else {
                        // Create new statement
                        const { error: insertError } = await supabase
                            .from('acc_cycle_bank_statements')
                            .insert(childStatementData);

                        if (insertError) {
                            console.error(`Error creating child statement for ${period.month + 1}/${period.year}:`, insertError);
                        } else {
                            console.log(`Created child statement for ${period.month + 1}/${period.year}`);
                        }
                    }
                } catch (error) {
                    console.error(`Error processing month ${period.month + 1}/${period.year}:`, error);
                }
            }

            console.log('Completed multi-month statement processing');
        } catch (error) {
            console.error('Error in handleMultiMonthStatements:', error);
        }
    };

    // Function to lookup bank by account number
    const lookupBankByAccountNumber = async (accountNumber) => {
        if (!accountNumber) return null;
        
        try {
            // Clean the account number for more reliable matching
            const cleanAccountNumber = accountNumber.replace(/\D/g, '');
            
            // Query the banks table
            const { data: banks, error } = await supabase
                .from('acc_portal_banks')
                .select('id, bank_name, account_number, company_id');
                
            if (error) {
                console.error('Error querying banks:', error);
                return null;
            }
            
            if (!banks || banks.length === 0) {
                console.log('No banks found in database');
                return null;
            }
            
            console.log(`Looking through ${banks.length} banks for account match`);
            
            // Try different matching strategies (exact match, contains, last digits)
            for (const bank of banks) {
                if (!bank.account_number) continue;
                
                const bankAccountNumber = bank.account_number.replace(/\D/g, '');
                
                // Exact match
                if (bankAccountNumber === cleanAccountNumber) {
                    console.log(`Found exact account number match: ${bank.bank_name}`);
                    return bank;
                }
                
                // Contains match
                if (bankAccountNumber.includes(cleanAccountNumber) || 
                    cleanAccountNumber.includes(bankAccountNumber)) {
                    console.log(`Found partial account number match: ${bank.bank_name}`);
                    return bank;
                }
                
                // Last digits match (common in statements)
                if (cleanAccountNumber.length >= 4 && bankAccountNumber.length >= 4) {
                    const lastFourDigitsA = cleanAccountNumber.slice(-4);
                    const lastFourDigitsB = bankAccountNumber.slice(-4);
                    
                    if (lastFourDigitsA === lastFourDigitsB) {
                        console.log(`Found last 4 digits match: ${bank.bank_name}`);
                        return bank;
                    }
                }
            }
            
            console.log('No matching bank found for account number:', accountNumber);
            return null;
        } catch (error) {
            console.error('Error looking up bank by account number:', error);
            return null;
        }
    };

    const processExtractionResult = async (extractionId, fileObj, forceShowDialog = false) => {
        try {
            setProcessingItem(fileObj);
            
            // Deep copy the extracted data to avoid reference issues
            const extractedDataCopy = JSON.parse(JSON.stringify(fileObj.extractedData));
            console.log('Processing extraction for file:', fileObj.file.name, 'with data:', extractedDataCopy);
            
            // Attempt to lookup bank by account number if available
            if (extractedDataCopy?.account_number && extractedDataCopy.account_number.length >= 4) {
                try {
                    console.log('Looking up bank by account number:', extractedDataCopy.account_number);
                    const bankDetails = await lookupBankByAccountNumber(extractedDataCopy.account_number);
                    
                    if (bankDetails) {
                        console.log('Found bank from account number:', bankDetails.bank_name);
                        // Override the extracted bank name with the one from database
                        extractedDataCopy.bank_name = bankDetails.bank_name;
                        extractedDataCopy.bank_name_source = 'database';
                        
                        // Also update the fileObj with this info
                        fileObj.extractedData = extractedDataCopy;
                        fileObj.bankNameSource = 'database';
                    }
                } catch (bankLookupError) {
                    console.error('Error looking up bank from account number:', bankLookupError);
                }
            }
            
            // Update the extraction map with the extracted data
            setExtractionMap(prev => ({
                ...prev,
                [extractionId]: {
                    ...prev[extractionId],
                    extractedData: extractedDataCopy,
                    file: fileObj.file,
                    success: fileObj.extractionSuccess
                }
            }));

            // Check if we have bank info available
            const bank = await findBankByNameOrAccountNumber(extractedDataCopy);
            
            // If no matching bank found, fallback to validating just the extract data
            if (!bank) {
                console.log('No matching bank found, validating extracted data only');
                const validation = validateExtractedData(extractedDataCopy);
                
                // If there are validation issues, show the dialog
                if (!validation.isValid || forceShowDialog) {
                    setCurrentProcessingItem({
                        extractionId,
                        fileName: fileObj.file.name,
                        pdfUrl: fileObj.pdfUrl,
                        extractedData: extractedDataCopy,
                        validation
                    });
                    setShowBankValidationDialog(true);
                } else {
                    // Auto-proceed with the validated data
                    await saveExtractedDataToStatement(extractedDataCopy, null, fileObj.pdfUrl);
                    goToNextFile();
                }
                return;
            }
            
            // If we found a bank, check against the bank info
            console.log('Found bank:', bank.bank_name, 'validating against extraction');
            const validation = validateExtractedData(extractedDataCopy, bank);
            
            // Always show dialog if there's a mismatch or if forceShowDialog is true
            if (!validation.isValid || forceShowDialog) {
                setCurrentProcessingItem({
                    extractionId,
                    fileName: fileObj.file.name,
                    bankId: bank.id,
                    pdfUrl: fileObj.pdfUrl,
                    extractedData: extractedDataCopy,
                    validation
                });
                setShowBankValidationDialog(true);
            } else {
                // Auto-proceed with match
                await saveExtractedDataToStatement(extractedDataCopy, bank, fileObj.pdfUrl);
                goToNextFile();
            }
        } catch (error) {
            console.error('Error in processExtractionResult:', error);
            toast({
                title: "Processing Error",
                description: `Failed to process extraction for ${fileObj.file.name}: ${error.message}`,
                variant: "destructive",
            });
            
            // Move to next file even on error
            goToNextFile();
        }
    };

    // Return the JSX component
    return (
        <TooltipProvider>
            <Dialog open={isOpen} onOpenChange={(open) => {
                if (!open && !uploading) {
                    onClose();
                    setUploadItems([]);
                    setSelectedCompanyId(null);
                }
            }}>
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-6xl w-[95vw]">
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

                        <UploadTab
                            value="upload"
                            uploadItems={uploadItems}
                            setUploadItems={setUploadItems}
                            companies={companies}
                            availableBanks={availableBanks}
                            selectedCompanyId={selectedCompanyId}
                            setSelectedCompanyId={setSelectedCompanyId}
                            randomMode={randomMode}
                            setRandomMode={setRandomMode}
                            handleStartProcessing={handleStartProcessing}
                            uploading={uploading}
                            loadingCompanies={loadingCompanies}
                            fileInputRef={fileInputRef}
                            isDragging={isDragging}
                            setIsDragging={setIsDragging}
                            toast={toast}
                        />

                        <ProcessingTab
                            value="processing"
                            uploadItems={uploadItems}
                            overallProgress={overallProgress}
                            setActiveTab={setActiveTab}
                            uploading={uploading}
                        />

                        <ReviewTab
                            value="review"
                            uploadItems={uploadItems}
                            onClose={onClose}
                            handleStartProcessing={handleStartProcessing}
                            setActiveTab={setActiveTab}
                            uploading={uploading}
                            setCurrentManualMatchItem={setCurrentManualMatchItem}
                            setShowBankSelectorDialog={setShowBankSelectorDialog}
                        />

                        <VouchingTab
                            value="vouching"
                            companyGroups={companyGroups}
                            setActiveTab={setActiveTab}
                            onClose={onClose}
                            onUploadsComplete={onUploadsComplete}
                            toggleCompanyExpansion={toggleCompanyExpansion}
                            markCompanyVouched={markCompanyVouched}
                            vouchingChecked={vouchingChecked}
                            setVouchingChecked={setVouchingChecked}
                            vouchingNotes={vouchingNotes}
                            setVouchingNotes={setVouchingNotes}
                            setCurrentProcessingItem={setCurrentProcessingItem}
                            setShowExtractionDialog={setShowExtractionDialog}
                            pdfUrls={pdfUrls}
                            setUploadItems={setUploadItems}
                        />
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Bank Validation Dialog */}
            {showValidationDialog && currentProcessingItem && validationResults && (
                <BankValidationDialog
                    isOpen={showValidationDialog}
                    onClose={() => setShowValidationDialog(false)}
                    bank={currentProcessingItem.matchedBank}
                    extractedData={currentProcessingItem.extractedData || extractionResults?.extractedData}
                    mismatches={validationResults.mismatches}
                    onProceed={handleProceedWithValidation}
                    onCancel={cancelCurrentUpload}
                    cycleMonth={cycleMonth}
                    cycleYear={cycleYear}
                />
            )}

            {/* Bank Extraction Dialog */}
            {showExtractionDialog && currentProcessingItem && extractionResults && (
                <BankExtractionDialog
                    isOpen={showExtractionDialog}
                    onClose={handleExtractionDialogClose}
                    bank={currentProcessingItem.matchedBank}
                    statement={{
                        bank_id: currentProcessingItem.matchedBank.id,
                        statement_month: cycleMonth,
                        statement_year: cycleYear,
                        statement_document: {
                            statement_pdf: currentProcessingItem.uploadedPdfPath || null,
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
                <PasswordDialog
                    isOpen={showPasswordDialog}
                    setIsOpen={setShowPasswordDialog}
                    passwordProtectedFiles={passwordProtectedFiles}
                    uploadItems={uploadItems}
                    setUploadItems={setUploadItems}
                    setPasswordProtectedFiles={setPasswordProtectedFiles}
                    processNextQueueItem={processNextQueueItem}
                    processingQueue={processingQueue}
                    setProcessingQueue={setProcessingQueue}
                    handleFileExtraction={handleFileExtraction}
                />
            )}

            {/* Bank Selector Dialog */}
            {showBankSelectorDialog && currentManualMatchItem !== null && (
                <BankSelectorDialog
                    isOpen={showBankSelectorDialog}
                    setIsOpen={setShowBankSelectorDialog}
                    currentManualMatchItem={currentManualMatchItem}
                    selectedBankIds={selectedBankIds}
                    setSelectedBankIds={setSelectedBankIds}
                    closingBalanceInputs={closingBalanceInputs}
                    setClosingBalanceInputs={setClosingBalanceInputs}
                    availableBanks={availableBanks}
                    selectedCompanyId={selectedCompanyId}
                    setUploadItems={setUploadItems}
                    uploadItems={uploadItems}
                    loadingCompanies={loadingCompanies}
                    randomMode={randomMode}
                />
            )}

            {/* Statement Cycle Confirmation Dialog */}
            <StatementCycleConfirmationDialog
                isOpen={showCycleConfirmation}
                onClose={() => {
                    setShowCycleConfirmation(false);
                    setUploading(false);
                }}
                onConfirm={handleCycleConfirmation}
                statementPeriod={
                    // Join all detected periods for a more comprehensive display
                    processingFiles.length > 0 
                    ? processingFiles.map(file => file.extractedData?.statement_period || '').filter(Boolean).join(', ')
                    : `${cycleMonth === 0 ? 1 : cycleMonth}/${cycleYear}`
                }
                existingCycles={detectedCycles.existing}
                newCyclesToCreate={detectedCycles.toCreate}
                banks={availableBanks}
                files={processingFiles.map(item => ({
                    name: item.file?.name || 'Unknown',
                    matchedBank: item.matchedBank,
                    period: item.extractedData?.statement_period || null
                }))}
            />
        </TooltipProvider>
    );
}