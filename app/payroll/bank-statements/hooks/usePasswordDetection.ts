/**
 * Hook for handling password detection and management in bank statements
 */
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
    isPdfPasswordProtected, 
    processFileForPasswordDetection,
    prepareFilesForPasswordDialog,
    applyPasswordToFiles,
    PasswordProtectedFile
} from '../utils/bankStatementPasswordUtils';

interface UsePasswordDetectionProps {
    banks?: Array<{ 
        id: number; 
        bank_name: string; 
        account_number: string; 
        acc_password?: string;
    }>;
}

interface PasswordProtectedItem {
    id: string | number;
    file: File;
    detectedPassword?: string | null;
    detectedAccountNumber?: string | null;
    needsPassword?: boolean;
    passwordAttempts?: number;
    unlocked?: boolean;
    bank?: any;
}

export function usePasswordDetection({ banks = [] }: UsePasswordDetectionProps = {}) {
    const [passwordProtectedFiles, setPasswordProtectedFiles] = useState<PasswordProtectedItem[]>([]);
    const [showPasswordDialog, setShowPasswordDialog] = useState<boolean>(false);
    const { toast } = useToast();

    // Process a file for password detection
    const processFile = async (file: File, id: string | number, bank?: any): Promise<PasswordProtectedItem> => {
        const fileInfo = processFileForPasswordDetection(file, banks);
        
        // Check if PDF is password protected
        let needsPassword = false;
        if (file.type === 'application/pdf') {
            needsPassword = await isPdfPasswordProtected(file);
        }
        
        return {
            id,
            file,
            detectedPassword: fileInfo.detectedPassword,
            detectedAccountNumber: fileInfo.detectedAccountNumber,
            needsPassword,
            passwordAttempts: 0,
            unlocked: false,
            bank: bank || fileInfo.matchedBank
        };
    };

    // Process multiple files
    const processFiles = async (
        files: Array<{ file: File; id: string | number; bank?: any }>
    ): Promise<PasswordProtectedItem[]> => {
        const processedFiles: PasswordProtectedItem[] = [];
        
        for (const item of files) {
            const processedFile = await processFile(item.file, item.id, item.bank);
            processedFiles.push(processedFile);
        }
        
        // Filter password-protected files
        const passwordFiles = processedFiles.filter(item => item.needsPassword);
        
        if (passwordFiles.length > 0) {
            setPasswordProtectedFiles(passwordFiles);
            setShowPasswordDialog(true);
        }
        
        return processedFiles;
    };

    // Handle password submission
    const handlePasswordSubmit = async (password: string, fileIndexes: number[]): Promise<boolean> => {
        try {
            // Get the files to apply the password to
            const filesToUnlock = fileIndexes.map(index => {
                const file = passwordProtectedFiles[index];
                return file.file;
            });
            
            // Apply the password
            const success = await applyPasswordToFiles(password, filesToUnlock);
            
            if (success) {
                // Update the password-protected files
                const updatedFiles = passwordProtectedFiles.map((file, index) => {
                    if (fileIndexes.includes(index)) {
                        return {
                            ...file,
                            unlocked: true,
                            passwordAttempts: file.passwordAttempts! + 1,
                            detectedPassword: password
                        };
                    }
                    return file;
                });
                
                setPasswordProtectedFiles(updatedFiles);
                
                // Check if all files are unlocked
                const allUnlocked = updatedFiles.every(file => file.unlocked);
                if (allUnlocked) {
                    setShowPasswordDialog(false);
                }
                
                toast({
                    title: 'Password Applied',
                    description: 'The password has been applied to the selected files.',
                    variant: 'default'
                });
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error applying password:', error);
            toast({
                title: 'Password Error',
                description: 'Failed to apply the password to the files.',
                variant: 'destructive'
            });
            return false;
        }
    };

    // Handle skipping password-protected files
    const handleSkipPasswordFiles = (fileIndexes: number[]) => {
        const updatedFiles = passwordProtectedFiles.map((file, index) => {
            if (fileIndexes.includes(index)) {
                return {
                    ...file,
                    unlocked: false,
                    passwordAttempts: file.passwordAttempts! + 1
                };
            }
            return file;
        });
        
        setPasswordProtectedFiles(updatedFiles);
        setShowPasswordDialog(false);
    };

    // Prepare files for the password dialog
    const getPasswordDialogFiles = (): PasswordProtectedFile[] => {
        return prepareFilesForPasswordDialog(passwordProtectedFiles);
    };

    return {
        passwordProtectedFiles,
        showPasswordDialog,
        setShowPasswordDialog,
        processFile,
        processFiles,
        handlePasswordSubmit,
        handleSkipPasswordFiles,
        getPasswordDialogFiles
    };
}
