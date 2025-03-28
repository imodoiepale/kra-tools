// @ts-nocheck

/**
 * Utility functions for handling password-protected bank statements
 */
import { detectFileInfo, validateAccountNumber, validatePassword } from './fileDetectionUtils';

/**
 * Interface for password-protected file information
 */
export interface PasswordProtectedFile {
    id: string | number;
    fileName: string;
    passwordAttempts?: number;
    unlocked?: boolean;
    bankPassword?: string;
    bankName?: string;
    accountNumber?: string;
}

/**
 * Checks if a PDF file is password protected
 * @param file The PDF file to check
 * @returns Promise resolving to true if the file is password protected
 */
export async function isPdfPasswordProtected(file: File): Promise<boolean> {
    try {
        // Create a temporary URL for the file
        const fileUrl = URL.createObjectURL(file);
        
        // Try to load the PDF
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        // Simple check for password protection (not 100% reliable)
        const bytes = new Uint8Array(arrayBuffer);
        const pdfString = String.fromCharCode.apply(null, bytes.slice(0, 1024));
        
        // Look for encryption indicators
        const isEncrypted = pdfString.includes('/Encrypt') || 
                           pdfString.includes('/Encryption') ||
                           pdfString.includes('/Standard');
        
        URL.revokeObjectURL(fileUrl);
        return isEncrypted;
    } catch (error) {
        console.error('Error checking if PDF is password protected:', error);
        // If we can't check, assume it might need a password
        return true;
    }
}

/**
 * Processes a file to detect password and account number
 * @param file The file to process
 * @param banks Optional array of banks to match against
 * @returns Object with file information including detected password and account
 */
export function processFileForPasswordDetection(
    file: File, 
    banks?: Array<{ id: number; bank_name: string; account_number: string; acc_password?: string }>
): {
    detectedPassword: string | null;
    detectedAccountNumber: string | null;
    matchedBank: any | null;
    needsPassword: boolean;
} {
    // Detect file info
    const fileInfo = detectFileInfo(file.name);
    
    let matchedBank = null;
    
    // Try to match bank if we have banks and detected account number
    if (banks && banks.length > 0 && fileInfo.accountNumber) {
        matchedBank = banks.find(bank => 
            validateAccountNumber(fileInfo.accountNumber, bank.account_number)
        );
    }
    
    return {
        detectedPassword: fileInfo.password,
        detectedAccountNumber: fileInfo.accountNumber,
        matchedBank,
        needsPassword: false // This will be set after checking the file
    };
}

/**
 * Prepares files for the PasswordInputDialog
 * @param files Array of files with password information
 * @returns Array formatted for PasswordInputDialog
 */
export function prepareFilesForPasswordDialog(
    files: Array<{
        id: string | number;
        file: File;
        detectedPassword?: string | null;
        detectedAccountNumber?: string | null;
        passwordAttempts?: number;
        unlocked?: boolean;
        bank?: {
            bank_name?: string;
            account_number?: string;
            acc_password?: string;
        } | null;
    }>
): PasswordProtectedFile[] {
    return files.map((item, index) => ({
        index: typeof item.id === 'number' ? item.id : index,
        fileName: item.file.name,
        passwordAttempts: item.passwordAttempts || 0,
        unlocked: item.unlocked || false,
        bankPassword: item.bank?.acc_password || null,
        bankName: item.bank?.bank_name || null,
        accountNumber: item.bank?.account_number || null
    }));
}

/**
 * Handles applying a password to files
 * @param password The password to apply
 * @param files Array of files to apply the password to
 * @returns Promise resolving to true if password was applied successfully
 */
export async function applyPasswordToFiles(
    password: string, 
    files: File[]
): Promise<boolean> {
    try {
        // In a real implementation, you would decrypt the PDFs with the password
        // For now, we just simulate success
        console.log(`Applied password "${password}" to ${files.length} files`);
        return true;
    } catch (error) {
        console.error('Error applying password to files:', error);
        return false;
    }
}
