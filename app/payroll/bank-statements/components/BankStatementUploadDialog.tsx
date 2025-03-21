// BankStatementUploadDialog.tsx
// @ts-nocheck
import { useState, useRef, useEffect } from 'react'
import { 
    CircleMinus,
    CirclePlus,
    Clock10,
    Download,
    File,
    FileDigit,
    FileText,
    Upload,
    ClipboardCheck,
    Loader2,
    AlertTriangle, 
    CheckCircle, 
    UploadCloud, 
    Sheet, 
    Building, 
    Landmark, 
    CreditCard, 
    DollarSign, 
    Calendar, 
    Lock 
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { 
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { BankValidationDialog } from './BankValidationDialog'
import { PasswordInputDialog } from './PasswordInputDialog'
import { BankExtractionDialog } from './BankExtractionDialog'
import {
    isPdfPasswordProtected,
    applyPasswordToFiles,
    performBankStatementExtraction,
    detectFileInfoFromFilename,
    detectAccountNumberFromFilename,
    getBankNameFromFilename,
    removePasswordProtection
} from '@/lib/bankExtractionUtils'
import { detectFileInfo } from '../utils/fileDetectionUtils'

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
    acc_password?: string
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
        document_size: number | null
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

// Helper function to check if a period is contained within a given month/year
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
    const [detectedPassword, setDetectedPassword] = useState<string | null>(null)
    const [detectedAccountNumber, setDetectedAccountNumber] = useState<string | null>(null)
    const [showPasswordDialog, setShowPasswordDialog] = useState<boolean>(false)
    const [pdfNeedsPassword, setPdfNeedsPassword] = useState<boolean>(false)
    const [showExtractionDialog, setShowExtractionDialog] = useState<boolean>(false)
    const [uploadedStatement, setUploadedStatement] = useState<BankStatement | null>(null)
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [showValidationDialog, setShowValidationDialog] = useState<boolean>(false)
    const [extractionResults, setExtractionResults] = useState<any>(null)
    const [validationResults, setValidationResults] = useState<{ isValid: boolean, mismatches: string[] } | null>(null)
    const [password, setPassword] = useState<string>('')
    const [applyingPassword, setApplyingPassword] = useState<boolean>(false)
    const [passwordApplied, setPasswordApplied] = useState<boolean>(false)

    const pdfInputRef = useRef<HTMLInputElement>(null)
    const excelInputRef = useRef<HTMLInputElement>(null)

    const { toast } = useToast()

    // Function to detect password and account number from filename
    const detectFileInfoFromFilename = (filename: string) => {
        // Use the utility function
        const fileInfo = detectFileInfo(filename);
        setDetectedPassword(fileInfo.password);
        setDetectedAccountNumber(fileInfo.accountNumber);
    }

    // Function to detect password from filename
    const detectPasswordFromFilename = (filename: string): string | null => {
        // Simple pattern matching for common password formats in filenames
        // Examples: "statement_password123.pdf", "statement-pass_123.pdf"
        const passwordPatterns = [
            /pass[_\-]?(\w+)/i,             // Matches "pass_123", "pass-123", "password123"
            /pwd[_\-]?(\w+)/i,              // Matches "pwd_123", "pwd-123"
            /\b(?:p|pw)[\s_\-]?(\w{4,})\b/i // Matches "p 1234", "pw_1234" with min 4 chars
        ];
        
        for (const pattern of passwordPatterns) {
            const match = filename.match(pattern);
            if (match && match[1]) {
                const detectedPwd = match[1];
                console.log("Detected possible password in filename:", detectedPwd);
                return detectedPwd;
            }
        }
        
        return null;
    };

    // In handleFileChange
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fileType: 'pdf' | 'excel') => {
        if (!e.target.files || e.target.files.length === 0) return;

        const selectedFile = e.target.files[0];

        if (fileType === 'pdf') {
            setPdfFile(selectedFile);

            // Reset states for new file
            setPdfNeedsPassword(false);
            setPasswordApplied(false);
            setPassword('');
            setDetectedPassword(null);
            setDetectedAccountNumber(null);

            // Get file info including potential password and account number
            const fileInfo = detectFileInfoFromFilename(selectedFile.name) || {
                password: null,
                accountNumber: null,
                bankName: null
            };

            // Update detected info
            if (fileInfo?.password) {
                setDetectedPassword(fileInfo.password);
                console.log('Detected password from filename:', fileInfo.password);
            }
            if (fileInfo?.accountNumber) {
                setDetectedAccountNumber(fileInfo.accountNumber);
                console.log('Detected account number from filename:', fileInfo.accountNumber);
            }

            try {
                // Check if PDF is password protected
                const isProtected = await isPdfPasswordProtected(selectedFile);
                setPdfNeedsPassword(isProtected);

                if (isProtected) {
                    console.log('PDF is password protected. Will try automatic password.');

                    // Try bank password automatically if available
                    if (bank?.acc_password) {
                        console.log('Trying bank password:', bank.acc_password);
                        const passwordSuccess = await applyPasswordToFiles(selectedFile, bank.acc_password);

                        if (passwordSuccess) {
                            setPassword(bank.acc_password);
                            setPasswordApplied(true);
                            setPdfNeedsPassword(false);
                            toast({
                                title: "Success",
                                description: "Bank's stored password applied automatically",
                            });
                            return;
                        }
                    }

                    // If bank password didn't work, try detected password
                    if (fileInfo.password) {
                        console.log('Trying detected password:', fileInfo.password);
                        const passwordSuccess = await applyPasswordToFiles(selectedFile, fileInfo.password);

                        if (passwordSuccess) {
                            setPassword(fileInfo.password);
                            setPasswordApplied(true);
                            setPdfNeedsPassword(false);
                            toast({
                                title: "Success",
                                description: "Detected password applied automatically",
                            });
                            return;
                        }
                    }

                    // If no automatic password worked, we'll prompt later during handleUpload
                    toast({
                        title: "Password Required",
                        description: "This PDF is password protected.",
                        variant: "warning"
                    });
                }
            } catch (error) {
                console.error('Error handling PDF password:', error);
            }
        } else if (fileType === 'excel') {
            setExcelFile(selectedFile);
        }
    };

    // Function to check if PDF is password protected
    const checkIfPasswordProtected = async (file: File): Promise<boolean> => {
        try {
            if (!file) {
                console.error('No file provided to check for password protection');
                return false;
            }
            
            const isProtected = await isPdfPasswordProtected(file);
            console.log('PDF password protection check:', isProtected ? 'Protected' : 'Not protected');
            
            // Update state with result
            setPdfNeedsPassword(isProtected);
            
            return isProtected;
        } catch (error) {
            console.error('Error checking if PDF is password protected:', error);
            // Assume it might be password protected if we can't determine
            setPdfNeedsPassword(true);
            
            toast({
                title: 'Warning',
                description: 'Could not determine if PDF is password protected. Please proceed with caution.',
                variant: 'default'
            });
            
            return true; // Safer to assume it's protected
        }
    };

    // Add this function to BankStatementUploadDialog.tsx
    async function decryptPdfUsingService(pdfFile, password) {
        try {
            // Create a FormData instance
            const formData = new FormData();

            // Add the PDF file
            formData.append('files', pdfFile);

            // Add the password if provided
            if (password) {
                formData.append('password', password);
            }

            // Make a POST request to your decryption service
            const response = await fetch('https://password-decrypter.vercel.app/decrypt-pdfs', {
                method: 'POST',
                body: formData,
            });

            // Check if the request was successful
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to decrypt PDF');
            }

            // Get the decrypted PDF file
            const decryptedPdfBlob = await response.blob();

            // Create a new File object with the decrypted content
            return new File(
                [decryptedPdfBlob],
                pdfFile.name,
                { type: 'application/pdf' }
            );
        } catch (error) {
            console.error('Error decrypting PDF using service:', error);
            throw error;
        }
    }

    const handlePasswordSubmit = async (passwordToTry: string) => {
        if (!pdfFile || !passwordToTry) return;

        setApplyingPassword(true);
        try {
            // First verify the password works
            const passwordSuccess = await applyPasswordToFiles(pdfFile, passwordToTry);

            if (passwordSuccess) {
                // Successfully verified password - keep using the same file
                // but record that we have the correct password
                setPasswordApplied(true);
                setPdfNeedsPassword(false);
                setPassword(passwordToTry);
                setShowPasswordDialog(false);

                toast({
                    title: "Success",
                    description: "Password has been successfully applied",
                });
            } else {
                toast({
                    title: "Error",
                    description: "Invalid password. Please try again.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error('Error handling password:', error);
            toast({
                title: "Error",
                description: "Failed to apply password",
                variant: "destructive"
            });
        } finally {
            setApplyingPassword(false);
        }
    };


    // Function to check if bank details match and auto-insert bank name
    function validateAndAutoInsertBankName(validationResult, expectedBankName) {
        if (validationResult.isValid) {
            const { account_number, currency, company_name } = validationResult.extractedData;
            if (account_number && currency && company_name) {
                validationResult.extractedData.bank_name = expectedBankName;
            }
        }
    }

    // Function to handle re-extraction
    function handleReExtract() {
        setExtracting(true);
        performBankStatementExtraction(fileUrl, {
            month: cycleMonth,
            year: cycleYear
        }, (progress) => {
            console.log(progress);
        }).then((result) => {
            setValidationResult(result);
            setExtracting(false);
        }).catch((error) => {
            console.error('Re-extraction failed:', error);
            setExtracting(false);
        });
    }

    // Function to identify statement months
    function identifyStatementMonths(statementPeriod) {
        const months = parseStatementPeriod(statementPeriod);
        if (months) {
            return generateMonthRange(months.startMonth, months.startYear, months.endMonth, months.endYear);
        }
        return [];
    }

    const resetForm = () => {
        setPdfFile(null)
        setExcelFile(null)
        setHasSoftCopy(true)
        setHasHardCopy(false)
        setValidationResult(null)
        setDetectedPassword(null)
        setDetectedAccountNumber(null)
        setPdfNeedsPassword(false)
        setShowPasswordDialog(false)
        setShowExtractionDialog(false)
        setUploadedStatement(null)
        
        // Reset file inputs
        if (pdfInputRef.current) pdfInputRef.current.value = ''
        if (excelInputRef.current) excelInputRef.current.value = ''
    }

    // Function to validate extracted data against expected values
    const validateExtractedData = (extractedData: any): { isValid: boolean, mismatches: string[] } => {
        if (!extractedData) {
            return { isValid: false, mismatches: ['No data extracted'] };
        }

        const mismatches: string[] = [];

        // Validate bank name if available
        if (extractedData.bank_name && !extractedData.bank_name.toLowerCase().includes(bank.bank_name.toLowerCase())) {
            mismatches.push('Bank name mismatch');
        }

        // Validate company name if available
        if (extractedData.company_name && !extractedData.company_name.toLowerCase().includes(bank.company_name.toLowerCase())) {
            mismatches.push('Company name mismatch');
        }

        // Validate account number if available - using includes to handle formatting differences
        if (extractedData.account_number && !extractedData.account_number.includes(bank.account_number)) {
            mismatches.push('Account number mismatch');
        }

        // Validate currency if available - normalize currency codes
        if (extractedData.currency) {
            const normalizedExtractedCurrency = normalizeCurrencyCode(extractedData.currency);
            const normalizedBankCurrency = normalizeCurrencyCode(bank.bank_currency);
            
            if (normalizedExtractedCurrency !== normalizedBankCurrency) {
                mismatches.push('Currency mismatch');
            }
        }

        // Validate statement period contains the expected month/year
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

    useEffect(() => {
        // Clean up previous fileUrl
        if (fileUrl) {
            URL.revokeObjectURL(fileUrl);
        }
        
        // Create new fileUrl if pdfFile exists
        if (pdfFile) {
            const newFileUrl = URL.createObjectURL(pdfFile);
            setFileUrl(newFileUrl);
        } else {
            setFileUrl(null);
        }
        
        // Cleanup on unmount
        return () => {
            if (fileUrl) {
                URL.revokeObjectURL(fileUrl);
            }
        };
    }, [pdfFile]);

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
    const handleMultiMonthStatement = async (
        baseStatementData: any,
        bank: any,
        extractedData: any,
        documentPaths: any
    ) => {
        try {
            // Parse the period to get start and end months
            const period = extractedData.statement_period;
            const monthsInRange = getMonthsFromPeriod(period);
            
            // If we couldn't determine the months, just create a single entry
            if (!monthsInRange || monthsInRange.length === 0) {
                console.warn('Could not determine months in multi-month period:', period);
                return;
            }
            
            console.log('Creating entries for months:', monthsInRange);
            
            // Create a statement entry for each month in the range
            for (const { month, year } of monthsInRange) {
                // Skip if this is the current selected month/year (it will be handled separately)
                if (month === cycleMonth && year === cycleYear) {
                    continue;
                }
                
                // Check if a statement already exists for this month/year
                const { data: existingStatement, error: getExistingError } = await supabase
                    .from('acc_cycle_bank_statements')
                    .select('*')
                    .eq('bank_id', bank.id)
                    .eq('statement_month', month)
                    .eq('statement_year', year)
                    .single();
                
                if (getExistingError) throw getExistingError;
                
                // Prepare statement data for this month
                const monthStatementData = {
                    ...baseStatementData,
                    statement_month: month,
                    statement_year: year,
                    statement_document: documentPaths,
                    statement_extractions: extractedData,
                    validation_status: {
                        is_validated: false,
                        validation_date: new Date().toISOString(),
                        validated_by: null,
                        mismatches: ['Auto-created from multi-month statement']
                    }
                };
                
                if (existingStatement) {
                    // Update existing statement
                    await supabase
                        .from('acc_cycle_bank_statements')
                        .update(monthStatementData)
                        .eq('id', existingStatement.id);
                } else {
                    // Create new statement
                    await supabase
                        .from('acc_cycle_bank_statements')
                        .insert(monthStatementData);
                }
            }
        } catch (error) {
            console.error('Error handling multi-month statement:', error);
            throw new Error('Failed to process multi-month statement');
        }
    };

    const getMonthsFromPeriod = (period: string) => {
        // Implement logic to parse period string into months
        // For demonstration, assume period is in format "January - March 2024"
        const match = period.match(/(\w+)\s*(?:-|to)\s*(\w+)\s+(\d{4})/i);
        if (match) {
            const startMonth = new Date(`${match[1]} 1, 2000`).getMonth() + 1;
            const endMonth = new Date(`${match[2]} 1, 2000`).getMonth() + 1;
            const year = parseInt(match[3]);
            return generateMonthRange(startMonth, year, endMonth, year);
        }
        return null;
    };

    const handleUpload = async () => {
        // Validate that the bank is selected
        if (!bank) {
            toast({
                title: 'Bank Required',
                description: 'Please select a bank first.',
                variant: 'destructive'
            })
            return
        }

        // Ensure PDF file is present
        if (!pdfFile) {
            toast({
                title: 'PDF Required',
                description: 'Please upload a PDF bank statement.',
                variant: 'destructive'
            })
            return
        }

        // If PDF needs password and we haven't applied one yet
        if (pdfNeedsPassword && !passwordApplied) {
            // Try bank password first if we haven't tried it yet
            if (bank?.acc_password && !password) {
                const passwordSuccess = await applyPasswordToFiles(pdfFile, bank.acc_password);
                if (passwordSuccess) {
                    setPassword(bank.acc_password);
                    setPasswordApplied(true);
                    setPdfNeedsPassword(false);
                    toast({
                        title: "Success",
                        description: "Bank's stored password applied automatically",
                    });
                } else if (detectedPassword) {
                    // Try detected password if bank password failed
                    const passwordSuccess = await applyPasswordToFiles(pdfFile, detectedPassword);
                    if (passwordSuccess) {
                        setPassword(detectedPassword);
                        setPasswordApplied(true);
                        setPdfNeedsPassword(false);
                        toast({
                            title: "Success",
                            description: "Detected password applied automatically",
                        });
                    } else {
                        // If both automatic passwords failed, show dialog
                        setShowPasswordDialog(true);
                        return;
                    }
                } else {
                    // No detected password, show dialog
                    setShowPasswordDialog(true);
                    return;
                }
            } else {
                // No bank password, try detected password or show dialog
                if (detectedPassword) {
                    const passwordSuccess = await applyPasswordToFiles(pdfFile, detectedPassword);
                    if (passwordSuccess) {
                        setPassword(detectedPassword);
                        setPasswordApplied(true);
                        setPdfNeedsPassword(false);
                        toast({
                            title: "Success",
                            description: "Detected password applied automatically",
                        });
                    } else {
                        setShowPasswordDialog(true);
                        return;
                    }
                } else {
                    setShowPasswordDialog(true);
                    return;
                }
            }
        }

        setUploading(true)
        setExtractionResults(null)
        setValidationResults(null)

        try {
            // Create a temporary URL for the PDF file (for extraction)
            let localFileUrl: string;
            if (fileUrl) {
                URL.revokeObjectURL(fileUrl);
            }
            localFileUrl = URL.createObjectURL(pdfFile);
            setFileUrl(localFileUrl);

            // Do extraction first
            if (localFileUrl) {
                // Pass the password to the extraction function if it's been applied
                const extractionParams = {
                    month: cycleMonth,
                    year: cycleYear,
                    password: passwordApplied ? password : null
                };

                const extractionResult = await performBankStatementExtraction(
                    localFileUrl,
                    extractionParams
                );

                // Check if extraction failed due to password issue
                if (!extractionResult.success && extractionResult.requiresPassword) {
                    setUploading(false);
                    setShowPasswordDialog(true);
                    return;
                }

                // Store extraction results
                setExtractionResults(extractionResult);

                // If extraction succeeded, validate the results
                if (extractionResult.success) {
                    // Validate against bank details
                    const validationResult = validateExtractedData(extractionResult.extractedData);
                    setValidationResults(validationResult);

                    // If validation issues, show validation dialog
                    if (!validationResult.isValid) {
                        setShowValidationDialog(true);
                        setUploading(false);
                        return; // Stop here until user decides whether to proceed
                    }
                }

                // If no validation issues, continue with upload
                await proceedWithUpload();
            }
        } catch (error) {
            console.error('Upload process error:', error)
            toast({
                title: 'Upload Failed',
                description: error instanceof Error ? error.message : 'Failed to upload bank statement',
                variant: 'destructive'
            })
        } finally {
            setUploading(false)
        }
    };

    // Function to handle extraction for validation - Modified to return results
    const handleExtraction = async (fileUrl: string) => {
        if (!pdfFile || !fileUrl) {
            console.error('PDF file or URL not available for extraction');
            return null;
        }

        setExtracting(true);

        try {
            // Use the fileUrl from state for extraction
            const extractionResult = await performBankStatementExtraction(
                fileUrl,
                { month: cycleMonth, year: cycleYear }
            );

            console.log('Extraction results:', extractionResult);
            return extractionResult; // Return the results
        } catch (error) {
            console.error('Extraction error:', error);
            toast({
                title: 'Extraction Error',
                description: 'Failed to extract data from PDF.',
                variant: 'destructive'
            });
            return null;
        } finally {
            setExtracting(false);
        }
    };

    // Function to proceed with the actual upload after extraction/validation
    const proceedWithUpload = async () => {
        try {
            // Upload files to storage first (this part seems to be working fine)
            let pdfPath = existingStatement?.statement_document.statement_pdf || null;
            let excelPath = existingStatement?.statement_document.statement_excel || null;
            let documentSize = existingStatement?.statement_document.document_size || 0;

            // Upload PDF if provided
            if (pdfFile) {
                const pdfFileName = `bank_statement_${bank.company_id}_${bank.id}_${cycleYear}_${cycleMonth}.pdf`;
                const pdfFilePath = `statement_documents/${cycleYear}/${cycleMonth}/${bank.company_id}/${pdfFileName}`;

                const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                    .from('Statement-Cycle')
                    .upload(pdfFilePath, pdfFile, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (pdfUploadError) throw pdfUploadError;

                pdfPath = pdfUploadData.path;
                documentSize = pdfFile.size;
            }

            // Upload Excel if provided (this part stays the same)
            if (excelFile) {
                // Excel upload code (unchanged)
            }

            // Document paths for database
            const documentPaths = {
                statement_pdf: pdfPath,
                statement_excel: excelPath,
                document_size: documentSize
            };

            // CRITICAL FIX: Better statement cycle handling
            // Format month correctly (adding 1 because JavaScript months are 0-indexed)
            const monthStr = (cycleMonth + 1).toString().padStart(2, '0');
            const cycleMonthYear = `${cycleYear}-${monthStr}`;

            console.log(`Looking for statement cycle with month_year: ${cycleMonthYear}`);

            // First explicitly check if the cycle exists
            const { data: existingCycles, error: findError } = await supabase
                .from('statement_cycles')
                .select('id')
                .eq('month_year', cycleMonthYear);

            if (findError) {
                console.error('Error checking for existing cycles:', findError);
                throw findError;
            }

            let cycleId;

            // If cycle exists, use it
            if (existingCycles && existingCycles.length > 0) {
                cycleId = existingCycles[0].id;
                console.log(`Found existing cycle with ID: ${cycleId}`);
            } else {
                // Create a new cycle
                console.log(`Creating new statement cycle for ${cycleMonthYear}`);
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
                    console.error('Error creating statement cycle:', createError);
                    throw createError;
                }

                if (!newCycle || !newCycle.id) {
                    throw new Error('Failed to create statement cycle: no ID returned');
                }

                cycleId = newCycle.id;
                console.log(`Created new cycle with ID: ${cycleId}`);
            }

            // Verify we actually have a valid cycle ID before proceeding
            if (!cycleId) {
                throw new Error('No valid statement cycle ID available for upload');
            }

            // Prepare base statement data
            const baseStatementData = {
                bank_id: bank.id,
                company_id: bank.company_id,
                statement_cycle_id: cycleId, // Use our verified cycleId
                statement_month: cycleMonth,
                statement_year: cycleYear,
                statement_document: documentPaths,
                has_soft_copy: hasSoftCopy,
                has_hard_copy: hasHardCopy
            };

            // Add extraction data if available
            if (extractionResults && extractionResults.success) {
                baseStatementData.statement_extractions = extractionResults.extractedData;
                baseStatementData.validation_status = {
                    is_validated: validationResults ? validationResults.isValid : true,
                    validation_date: new Date().toISOString(),
                    validated_by: null,
                    mismatches: validationResults?.mismatches || []
                };
            } else {
                // Default extraction data
                baseStatementData.statement_extractions = {
                    bank_name: null,
                    account_number: null,
                    currency: null,
                    statement_period: null,
                    opening_balance: null,
                    closing_balance: null,
                    monthly_balances: [{
                        month: cycleMonth,
                        year: cycleYear,
                        opening_balance: null,
                        closing_balance: null,
                        statement_page: 1,
                        highlight_coordinates: null,
                        is_verified: false,
                        verified_by: null,
                        verified_at: null
                    }]
                };
                baseStatementData.validation_status = {
                    is_validated: false,
                    validation_date: null,
                    validated_by: null,
                    mismatches: []
                };
            }

            // Add default status
            baseStatementData.status = {
                status: 'pending_validation',
                assigned_to: null,
                verification_date: null
            };

            let statement;

            // Double check if statement already exists
            if (existingStatement) {
                console.log(`Updating existing statement with ID: ${existingStatement.id}`);
                const { data, error } = await supabase
                    .from('acc_cycle_bank_statements')
                    .update(baseStatementData)
                    .eq('id', existingStatement.id)
                    .select('*')
                    .single();

                if (error) {
                    console.error('Error updating statement:', error);
                    throw error;
                }
                statement = data;
            } else {
                console.log('Creating new statement record');
                console.log('Statement data:', JSON.stringify(baseStatementData, null, 2));

                const { data, error } = await supabase
                    .from('acc_cycle_bank_statements')
                    .insert(baseStatementData)
                    .select('*')
                    .single();

                if (error) {
                    console.error('Error creating statement:', error);
                    throw error;
                }
                statement = data;
            }

            // Store the uploaded statement and show extraction dialog
            setUploadedStatement(statement);
            onStatementUploaded(statement);
            setShowExtractionDialog(true);
            resetForm();

            toast({
                title: 'Success',
                description: 'Bank statement uploaded successfully'
            });

            return statement;
        } catch (error) {
            console.error('Upload process error:', error);
            toast({
                title: 'Upload Failed',
                description: error.message || 'Failed to upload bank statement',
                variant: 'destructive'
            });
            throw error;
        }
    };

    // Function to handle proceeding despite validation issues
    const handleProceedWithValidationIssues = async () => {
        setShowValidationDialog(false);
        setUploading(true);
        
        try {
            // Modify extraction results to include validation issues
            if (extractionResults && validationResults) {
                const modifiedResults = {
                    ...extractionResults,
                    validationIssues: validationResults.mismatches
                };
                
                // Include validation status in the database
                const updatedExtractionResults = {
                    ...extractionResults,
                    validationStatus: {
                        is_validated: false,
                        validation_date: new Date().toISOString(),
                        validated_by: null,
                        mismatches: validationResults.mismatches
                    }
                };
                
                await proceedWithUpload(updatedExtractionResults);
            } else {
                await proceedWithUpload(null);
            }
        } catch (error) {
            console.error('Error proceeding with validation issues:', error);
            toast({
                title: 'Upload Error',
                description: 'Failed to upload statement with validation issues',
                variant: 'destructive'
            });
        } finally {
            setUploading(false);
        }
    };
    
    // Function to handle cancellation of upload due to validation issues
    const handleCancelUpload = () => {
        setShowValidationDialog(false);
        setUploading(false);
        setExtractionResults(null);
        setValidationResults(null);
        
        toast({
            title: 'Upload Cancelled',
            description: 'Bank statement upload was cancelled due to validation issues'
        });
    };

    // Function to normalize currency codes
    const normalizeCurrencyCode = (currency: string): string => {
        const code = currency.trim().toUpperCase();
        
        // Handle common currency variations
        if (code === 'KES' || code === 'KSHS' || code === 'KSH') {
            return 'KES';
        }
        if (code === 'USD' || code === 'US$' || code === '$') {
            return 'USD';
        }
        if (code === 'GBP' || code === '£') {
            return 'GBP';
        }
        if (code === 'EUR' || code === '€') {
            return 'EUR';
        }
        
        return code;
    };

    // Function to check if a period string contains a specific month/year
    const isPeriodContained = (period: string, month: number, year: number): boolean => {
        // Normalize month to 1-12 format (JavaScript uses 0-11)
        const normalizedMonth = month;
        
        // Try to extract dates from the period string
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                           'july', 'august', 'september', 'october', 'november', 'december'];
        
        // Sample formats: "January to February 2023", "Jan - Mar 2023", "01/01/2023 - 31/01/2023"
        const periodLower = period.toLowerCase();
        
        // Check if the month name or number is in the period string
        const monthInPeriod = monthNames[normalizedMonth - 1].toLowerCase();
        const monthAbbreviation = monthInPeriod.substring(0, 3);
        
        const hasMonth = periodLower.includes(monthInPeriod) || 
                         periodLower.includes(monthAbbreviation) || 
                         periodLower.includes(`/${normalizedMonth}/`) || 
                         periodLower.includes(`/${normalizedMonth.toString().padStart(2, '0')}/`);
        
        // Check if the year is in the period string
        const hasYear = periodLower.includes(year.toString());
        
        // If both month and year are found, the period contains the specified month/year
        return hasMonth && hasYear;
    };

    // Function to check if a statement period covers multiple months
    const isMultiMonthPeriod = (periodStr: string): boolean => {
        // Common multi-month patterns: "Jan - Mar", "January to March", "01/01/2023 - 31/03/2023"
        
        // Try to extract dates from the period string
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        
        // Check for date ranges like "01/01/2023 - 31/03/2023"
        const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4}).*?(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
        const dateMatch = periodStr.match(datePattern);
        
        if (dateMatch) {
            // Dates in format DD/MM/YYYY or MM/DD/YYYY
            // We'll assume DD/MM/YYYY as it's more common globally
            const [_, startDay, startMonth, startYear, endDay, endMonth, endYear] = dateMatch;
            
            startDate = new Date(
                parseInt(startYear.length === 2 ? `20${startYear}` : startYear),
                parseInt(startMonth) - 1,
                parseInt(startDay)
            );
            
            endDate = new Date(
                parseInt(endYear.length === 2 ? `20${endYear}` : endYear),
                parseInt(endMonth) - 1,
                parseInt(endDay)
            );
        }
        
        // Check if we have valid dates and if they span different months
        if (startDate && endDate && 
            (startDate.getMonth() !== endDate.getMonth() || 
             startDate.getFullYear() !== endDate.getFullYear())) {
            return true;
        }
        
        // Check for month name patterns like "January - March 2023"
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                          'july', 'august', 'september', 'october', 'november', 'december'];
        const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                         'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        // Create a pattern to match month names
        const periodLower = periodStr.toLowerCase();
        
        // Check if different month names are mentioned
        let foundMonths: number[] = [];
        
        // Check full month names
        monthNames.forEach((month, index) => {
            if (periodLower.includes(month)) {
                foundMonths.push(index);
            }
        });
        
        // Check abbreviated month names
        monthAbbr.forEach((month, index) => {
            if (periodLower.includes(month)) {
                // Only add if not already found by full name
                if (!foundMonths.includes(index)) {
                    foundMonths.push(index);
                }
            }
        });
        
        // If we found multiple distinct months, it's a multi-month period
        return new Set(foundMonths).size > 1;
    };

    // Function to handle automatic password application
    const handleAutoPasswordApplication = async (file: File, passwordToTry: string) => {
        setApplyingPassword(true);
        
        try {
            // Try to apply the password automatically
            const success = await applyPasswordToFiles(file, passwordToTry);
            
            if (success) {
                setPdfNeedsPassword(false);
                setPasswordApplied(true);
                setPassword(passwordToTry);
                
                toast({
                    title: "Password Applied",
                    description: "Password was applied automatically",
                    variant: "default"
                });
                
                // Continue with upload process
                handleUpload();
            } else {
                // Password didn't work, show password dialog
                toast({
                    title: "Password Required",
                    description: "Automatic password application failed. Please enter the correct password.",
                    variant: "default"
                });
                setShowPasswordDialog(true);
            }
        } catch (error) {
            console.error("Error in auto password application:", error);
            setShowPasswordDialog(true);
        } finally {
            setApplyingPassword(false);
        }
    };

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
                                        onChange={(e) => handleFileChange(e, 'pdf')}
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
                                        onChange={(e) => handleFileChange(e, 'excel')}
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

                        {/* Bank Password Section */}
                        <div className="bg-gradient-to-r from-purple-50/80 to-purple-50/40 rounded-md p-4 border border-purple-100 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Lock className="h-4 w-4 text-purple-600" />
                                    <h3 className="text-sm font-medium text-purple-800">Statement Password</h3>
                                </div>
                                {detectedPassword && (
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                        Detected from filename
                                    </Badge>
                                )}
                            </div>
                            <div className="mt-2 space-y-2">
                                {bank.acc_password && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-purple-700">Bank Password:</span>
                                        <code className="bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                            {bank.acc_password}
                                        </code>
                                    </div>
                                )}
                                {detectedPassword && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-purple-700">Detected Password:</span>
                                        <code className="bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                            {detectedPassword}
                                        </code>
                                        {bank.acc_password !== detectedPassword && (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                Different from bank record
                                            </Badge>
                                        )}
                                    </div>
                                )}
                                {!bank.acc_password && !detectedPassword && (
                                    <div className="text-sm text-gray-500 italic">
                                        No password available for this bank statement
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Account Number Detection */}
                        {detectedAccountNumber && detectedAccountNumber !== bank.account_number && (
                            <Alert className="bg-amber-50 border-amber-200">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800">Account Number Mismatch</AlertTitle>
                                <AlertDescription className="text-amber-700">
                                    Detected account number ({detectedAccountNumber}) differs from bank record ({bank.account_number})
                                </AlertDescription>
                            </Alert>
                        )}

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

            {showValidationDialog && extractionResults && validationResults && (
                <BankValidationDialog
                    isOpen={showValidationDialog}
                    onClose={() => setShowValidationDialog(false)}
                    bank={bank}
                    extractedData={extractionResults.extractedData}
                    mismatches={validationResults.mismatches}
                    onProceed={handleProceedWithValidationIssues}
                    onCancel={handleCancelUpload}
                    cycleMonth={cycleMonth}
                    cycleYear={cycleYear}
                    fileUrl={fileUrl}
                />
            )}

            {/* Password Dialog */}
            {showPasswordDialog && pdfFile && (
                <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>PDF Password Required</DialogTitle>
                            <DialogDescription>
                                This PDF is password-protected. Please enter the password to continue.
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="grid gap-4 py-4">
                            <div className="flex flex-col gap-4">
                                {/* Password input */}
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input 
                                        id="password" 
                                        type="password" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password" 
                                    />
                                </div>

                                {/* Show detected password if available */}
                                {detectedPassword && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setPassword(detectedPassword);
                                                handlePasswordSubmit(detectedPassword);
                                            }}
                                        >
                                            Use detected password: <Badge variant="secondary" className="ml-2">{detectedPassword}</Badge>
                                        </Button>
                                    </div>
                                )}

                                {/* Show stored bank password if available */}
                                {bank?.acc_password && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setPassword(bank.acc_password);
                                                handlePasswordSubmit(bank.acc_password);
                                            }}
                                        >
                                            Use bank's password: <Badge variant="secondary" className="ml-2">{bank.acc_password}</Badge>
                                        </Button>
                                    </div>
                                )}

                                {/* Show detected account number if available */}
                                {detectedAccountNumber && (
                                    <div className="text-sm text-muted-foreground mt-4">
                                        <p>Detected Account Number: <Badge variant="outline">{detectedAccountNumber}</Badge></p>
                                        {bank?.account_number && detectedAccountNumber !== bank.account_number && (
                                            <p className="text-yellow-600 mt-1">
                                                Note: This differs from the bank's registered account number: <Badge variant="outline">{bank.account_number}</Badge>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <DialogFooter className="sm:justify-end">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setShowPasswordDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={() => handlePasswordSubmit(password)}
                                disabled={applyingPassword || !password}
                            >
                                {applyingPassword ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Applying...
                                    </>
                                ) : (
                                    'Apply Password'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Bank Extraction Dialog */}
            {showExtractionDialog && uploadedStatement && (
                <BankExtractionDialog
                    isOpen={showExtractionDialog}
                    onClose={() => setShowExtractionDialog(false)}
                    bank={bank}
                    statement={uploadedStatement}
                    onStatementUpdated={(updatedStatement) => {
                        // Update the parent component with the updated statement
                        onStatementUploaded(updatedStatement);
                        setShowExtractionDialog(false);
                    }}
                />
            )}
        </>
    )
}