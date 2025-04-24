//@ts-nocheck
// BankValidationDialog.tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle } from "lucide-react"
import { format } from 'date-fns'
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils";

interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
}

interface ExtractedData {
    bank_name: string | null
    company_name: string | null
    account_number: string | null
    currency: string | null
    statement_period: string | null
    opening_balance: number | null
    closing_balance: number | null
    monthly_balances: Array<{
        month: number
        year: number
        opening_balance: number
        closing_balance: number
        statement_page: number
    }>
    bank_name_source?: string
}

interface BankValidationDialogProps {
    isOpen: boolean
    onClose: () => void
    bank: Bank
    extractedData: ExtractedData
    mismatches: string[]
    onProceed: () => void
    onCancel: () => void
    selectedMonths?: number[]
    cycleYear?: number
    fileUrl?: string
}

// Simple component to show match status with reason tooltip
const MatchStatus = ({ isMatch, mismatchReason = null }) => {
  return isMatch ? (
    <span className="text-green-600 font-medium flex items-center">
      <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
      Match
    </span>
  ) : (
    <div className="text-red-600 font-medium flex items-center group relative">
      <span className="h-2 w-2 bg-red-500 rounded-full mr-2"></span>
      Mismatch
      {mismatchReason && (
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-red-50 border border-red-200 p-2 rounded-md text-xs text-red-800 w-48 z-50">
          {mismatchReason}
        </div>
      )}
    </div>
  );
};

export function BankValidationDialog({
    isOpen,
    onClose,
    bank,
    extractedData,
    mismatches,
    onProceed,
    onCancel,
    selectedMonths = [],
    cycleYear,
    fileUrl
}: BankValidationDialogProps) {
    const formatMonthYear = (month: number, year: number) => {
        try {
            const date = new Date(year, month - 1);
            return format(date, 'MMMM yyyy');
        } catch (error) {
            return 'Invalid Date';
        }
    };

    // Log what we're getting to help debug validation issues
    console.log("BankValidationDialog received:", { 
        bank, 
        extractedData: extractedData || "No data",
        mismatches
    });

    // Determine match status for expected fields
    const bankNameMatch = !mismatches?.includes('bank_name');
    const accountNumberMatch = !mismatches?.includes('account_number');
    const companyNameMatch = !mismatches?.includes('company_name');
    const currencyMatch = !mismatches?.includes('currency');
    const statementPeriodMatch = !mismatches?.includes('statement_period');

    // Build a user-friendly message about the bank name source
    const getBankNameSourceLabel = () => {
        if (!extractedData?.bank_name_source) return '';
        
        switch(extractedData.bank_name_source) {
            case 'database':
                return ' (matched from database by account number)';
            case 'normalized':
                return ' (normalized from extracted name)';
            case 'extraction':
                return ' (extracted from document)';
            default:
                return '';
        }
    };

    // Enhanced function to update a statement with extracted data 
    const updateStatementWithExtraction = async (extractedData) => {
        try {
            setSubmitting(true);
            
            let statementId = statement?.id;
            
            // Try to find statement ID if missing
            if (!statementId) {
                console.log('Statement ID missing, attempting to locate it');
                
                // Try to find the statement ID using bank_id and statement date
                if (statement && statement.bank_id && statement.statement_month && statement.statement_year) {
                    try {
                        console.log('Looking up statement by bank and date', {
                            bank_id: statement.bank_id,
                            month: statement.statement_month,
                            year: statement.statement_year
                        });
                        
                        const { data: foundStatement, error } = await supabase
                            .from('acc_cycle_bank_statements')
                            .select('id')
                            .eq('bank_id', statement.bank_id)
                            .eq('statement_month', statement.statement_month)
                            .eq('statement_year', statement.statement_year)
                            .maybeSingle();
                        
                        if (error) {
                            console.error('Database lookup error:', error);
                            throw error;
                        }
                        
                        if (foundStatement) {
                            statementId = foundStatement.id;
                            console.log('Found statement ID in database:', statementId);
                            
                            // Update local statement object with found ID
                            setStatement(prev => ({ ...prev, id: statementId }));
                        } else {
                            console.log('No matching statement found in database');
                        }
                    } catch (findError) {
                        console.error('Error finding statement ID:', findError);
                    }
                }
            }
            
            // If still no valid statement ID, show error and return
            if (!statementId) {
                console.error('Could not find valid statement ID for saving');
                toast({
                    title: 'Update Error',
                    description: 'Could not find a valid statement ID. The statement may need to be created first.',
                    variant: 'destructive'
                });
                setSubmitting(false);
                return;
            }
            
            console.log('Proceeding to update with statementId:', statementId);
            
            // Update the statement with extractedData
            const { data, error } = await supabase
                .from('acc_cycle_bank_statements')
                .update({
                    statement_extractions: extractedData,
                    modified_at: new Date().toISOString()
                })
                .eq('id', statementId)
                .select();
            
            if (error) throw error;
            
            console.log("Statement updated successfully:", data);
            
            // Check if reconciliation dialog should show
            if (bank?.quickbooks_config?.reconciliation_date) {
                setShowReconciliation(true);
            } else {
                // No need for reconciliation, show success
                toast({
                    title: "Update Successful",
                    description: "Statement updated with extracted data"
                });
                setSubmitting(false);
                onClose?.();
            }
        } catch (error) {
            console.error("Error updating statement:", error);
            toast({
                title: "Update Error",
                description: error.message || "Failed to update statement",
                variant: "destructive"
            });
            setSubmitting(false);
        }
    };

    // Find a bank by name or account number to validate against
    const findBankByNameOrAccountNumber = async (extractedData) => {
        if (!extractedData) return null;
        
        console.log('Looking for bank with extracted data:', 
            { name: extractedData.bank_name, account: extractedData.account_number });
            
        // Try to find by account number first
        if (extractedData.account_number) {
            try {
                const cleanAccountNumber = extractedData.account_number.replace(/\D/g, '');
                
                // Look for matching account number
                const { data: banks, error } = await supabase
                    .from('acc_portal_banks')
                    .select('*');
                
                if (error) throw error;
                
                if (banks && banks.length > 0) {
                    // Try various account number matching strategies
                    for (const bank of banks) {
                        if (!bank.account_number) continue;
                        
                        const bankAccountNumber = bank.account_number.replace(/\D/g, '');
                        
                        // Exact match
                        if (bankAccountNumber === cleanAccountNumber) {
                            console.log(`Found bank by exact account match: ${bank.bank_name}`);
                            return bank;
                        }
                        
                        // Last 4-6 digits match (common in statements)
                        if (cleanAccountNumber.length >= 4 && bankAccountNumber.length >= 4) {
                            const lastFourA = cleanAccountNumber.slice(-4);
                            const lastFourB = bankAccountNumber.slice(-4);
                            
                            if (lastFourA === lastFourB) {
                                console.log(`Found bank by last 4 digits match: ${bank.bank_name}`);
                                return bank;
                            }
                            
                            // Try last 6 if available
                            if (cleanAccountNumber.length >= 6 && bankAccountNumber.length >= 6) {
                                const lastSixA = cleanAccountNumber.slice(-6);
                                const lastSixB = bankAccountNumber.slice(-6);
                                
                                if (lastSixA === lastSixB) {
                                    console.log(`Found bank by last 6 digits match: ${bank.bank_name}`);
                                    return bank;
                                }
                            }
                        }
                        
                        // Contains match
                        if (bankAccountNumber.includes(cleanAccountNumber) || 
                            cleanAccountNumber.includes(bankAccountNumber)) {
                            console.log(`Found bank by partial account match: ${bank.bank_name}`);
                            return bank;
                        }
                    }
                }
            } catch (error) {
                console.error('Error finding bank by account number:', error);
            }
        }
        
        // Try to find by bank name
        if (extractedData.bank_name) {
            try {
                const { data: banks, error } = await supabase
                    .from('acc_portal_banks')
                    .select('*');
                
                if (error) throw error;
                
                if (banks && banks.length > 0) {
                    // Try exact name match first
                    const exactMatch = banks.find(b => 
                        b.bank_name && b.bank_name.toLowerCase() === extractedData.bank_name.toLowerCase()
                    );
                    
                    if (exactMatch) {
                        console.log(`Found bank by exact name match: ${exactMatch.bank_name}`);
                        return exactMatch;
                    }
                    
                    // Then try contains match
                    const containsMatch = banks.find(b => 
                        b.bank_name && 
                        (b.bank_name.toLowerCase().includes(extractedData.bank_name.toLowerCase()) ||
                         extractedData.bank_name.toLowerCase().includes(b.bank_name.toLowerCase()))
                    );
                    
                    if (containsMatch) {
                        console.log(`Found bank by partial name match: ${containsMatch.bank_name}`);
                        return containsMatch;
                    }
                }
            } catch (error) {
                console.error('Error finding bank by name:', error);
            }
        }
        
        console.log('No matching bank found in database');
        return null;
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-4xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center text-amber-600">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        Validation Issues Detected
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        The extracted bank information doesn't match the expected details.
                        Please review the differences below:
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="py-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Field</TableHead>
                                <TableHead>Expected Value</TableHead>
                                <TableHead>Extracted Value</TableHead>
                                <TableHead className="w-[100px]">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium">Company Name</TableCell>
                                <TableCell>{bank?.company_name || 'Not set'}</TableCell>
                                <TableCell>{extractedData?.company_name || 'Not detected'}</TableCell>
                                <TableCell>
                                    {extractedData?.company_name && bank?.company_name && 
                                     extractedData.company_name.toLowerCase().includes(bank.company_name.toLowerCase()) ? (
                                        <span className="text-green-500 font-medium">Match</span>
                                    ) : (
                                        <span className="text-red-500 font-medium">Mismatch</span>
                                    )}
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Account Number</TableCell>
                                <TableCell>{bank?.account_number || 'Not set'}</TableCell>
                                <TableCell>{extractedData?.account_number || 'Not detected'}</TableCell>
                                <TableCell>
                                    {extractedData?.account_number && bank?.account_number && 
                                     extractedData.account_number.includes(bank.account_number) ? (
                                        <span className="text-green-500 font-medium">Match</span>
                                    ) : (
                                        <span className="text-red-500 font-medium">Mismatch</span>
                                    )}
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Bank Name</TableCell>
                                <TableCell>
                                    {bank?.bank_name || "Not available"}
                                </TableCell>
                                <TableCell className="relative">
                                    {extractedData?.bank_name || "Not extracted"}
                                    {extractedData?.bank_name_source && (
                                        <Badge 
                                            variant="outline" 
                                            className={cn(
                                                "ml-2 text-xs",
                                                extractedData.bank_name_source === 'database' ? "bg-green-100 text-green-800" :
                                                extractedData.bank_name_source === 'normalized' ? "bg-blue-100 text-blue-800" :
                                                "bg-gray-100 text-gray-800"
                                            )}
                                        >
                                            {extractedData.bank_name_source === 'database' ? "From database" :
                                             extractedData.bank_name_source === 'normalized' ? "Normalized" :
                                             extractedData.bank_name_source === 'extraction' ? "From extraction" : 
                                             "Unknown source"}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <MatchStatus 
                                        isMatch={mismatches.every(m => !m.includes('bank name'))}
                                        mismatchReason={mismatches.find(m => m.includes('bank name'))} 
                                    />
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Period</TableCell>
                                <TableCell>{bank?.cycleMonth ? `${bank.cycleMonth}/${bank.cycleYear}` : 'Not set'}</TableCell>
                                <TableCell>{extractedData?.statement_period || 'Not detected'}</TableCell>
                                <TableCell>
                                    {extractedData?.statement_period ? (
                                        <span className="text-green-500 font-medium">Detected</span>
                                    ) : (
                                        <span className="text-red-500 font-medium">Mismatch</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                <div className="py-2 border-t space-y-2">
                    <h4 className="text-sm font-semibold">Additional Extracted Information:</h4>
                    <div className="text-sm">
                        <p><span className="font-medium">Statement Period:</span> {extractedData?.statement_period || 'Not detected'}</p>
                        <p><span className="font-medium">Closing Balance:</span> {extractedData?.closing_balance ? 
                            new Intl.NumberFormat('en-KE', { style: 'currency', currency: extractedData?.currency || 'KES' })
                            .format(extractedData.closing_balance) : 'Not detected'}</p>
                        <p><span className="font-medium">Bank Name:</span> {extractedData?.bank_name || 'Not detected'}{getBankNameSourceLabel()}</p>
                    </div>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>Cancel Upload</AlertDialogCancel>
                    <AlertDialogAction onClick={onProceed}>Proceed Anyway</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}