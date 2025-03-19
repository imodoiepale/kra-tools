// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, FileText, X, CheckCircle, CreditCard, Building, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { detectFileInfo } from '../utils/fileDetectionUtils';

interface PasswordInputDialogProps {
    isOpen: boolean;
    onClose: () => void;
    files: Array<{
        index: number;
        fileName: string;
        passwordAttempts?: number;
        unlocked?: boolean;
        bankPassword?: string; 
        bankName?: string; 
        accountNumber?: string; 
    }>;
    onPasswordSubmit: (password: string, fileIndexes: number[]) => Promise<boolean>;
    onSkip: (fileIndexes: number[]) => void;
}

function extractPasswordFromFilename(filename) {
    if (!filename) return null;

    const detectedInfo = detectFileInfo(filename);
    if (detectedInfo.password) {
        return detectedInfo.password;
    }

    const lowerFilename = filename.toLowerCase();

    const passwordIndicators = [
        'pw', 'pwd', 'password', 'passcode', 'pass', 'p w', 'p-w', 'p_w',
        'pin', 'key', 'code', 'access', 'secure', 'auth'
    ];

    for (const indicator of passwordIndicators) {
        const indicatorIndex = lowerFilename.indexOf(indicator);

        if (indicatorIndex !== -1) {
            const afterIndicator = filename.substring(indicatorIndex + indicator.length).trim();

            const patterns = [
                /^[\s\-_:]*([0-9]{4,12})/,            
                /^[\s\-_:]*([a-zA-Z0-9]{4,12})/,      
                /^[\s\-_:]*"([^"]+)"/,                
                /^[\s\-_:]*\(([^)]+)\)/,              
                /^[\s\-_:]*\[([^\]]+)\]/,             
            ];

            for (const pattern of patterns) {
                const match = afterIndicator.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
        }
    }

    const accountPatterns = [
        /\b(\d{6,12})\b(?!.*\d{6,12})/,              
        /acc(?:ount)?[:\s\-_]+(\d+)/i,               
        /a\/c[:\s\-_]+(\d+)/i,                       
    ];

    for (const pattern of accountPatterns) {
        const match = filename.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    const lastResortMatch = filename.match(/\b(\d{4,8})\b/);
    if (lastResortMatch && lastResortMatch[1]) {
        return lastResortMatch[1];
    }

    return null;
}

function extractAccountFromFilename(filename) {
    if (!filename) return null;
    
    const detectedInfo = detectFileInfo(filename);
    if (detectedInfo.accountNumber) {
        return detectedInfo.accountNumber;
    }
    
    return null;
}

export function PasswordInputDialog({
    isOpen,
    onClose,
    files,
    onPasswordSubmit,
    onSkip
}: PasswordInputDialogProps) {
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<number[]>(files.map(f => f.index));
    const [savedPasswords, setSavedPasswords] = useState<string[]>([]);
    const [customPassword, setCustomPassword] = useState('');

    const [autoPasswords, setAutoPasswords] = useState([]);

    useEffect(() => {
        const extractedPasswords = new Set<string>();
        
        files.forEach(file => {
            if (file.bankPassword) {
                extractedPasswords.add(file.bankPassword);
            }
            
            const extractedPassword = extractPasswordFromFilename(file.fileName);
            if (extractedPassword) {
                extractedPasswords.add(extractedPassword);
            }
        });
        
        setAutoPasswords(Array.from(extractedPasswords));
        
        if (extractedPasswords.size === 1) {
            setPassword(Array.from(extractedPasswords)[0]);
        }
    }, [files]);

    const tryPassword = async (passwordToTry: string) => {
        if (!passwordToTry) {
            setErrorMessage('Please enter a password');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const success = await onPasswordSubmit(passwordToTry, selectedFiles);

            if (success) {
                if (!savedPasswords.includes(passwordToTry)) {
                    setSavedPasswords([...savedPasswords, passwordToTry]);
                }
                setPassword('');
            } else {
                setErrorMessage('Incorrect password. Please try again.');
            }
        } catch (error) {
            setErrorMessage('Error unlocking files: ' + (error.message || 'Unknown error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center">
                        <Lock className="h-5 w-5 mr-2 text-amber-500" />
                        Password Protected Files
                    </DialogTitle>
                    <DialogDescription>
                        {files.length > 1 
                            ? `${files.length} files require a password to open.` 
                            : "This file requires a password to open."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="max-h-[200px] overflow-y-auto space-y-2">
                        {files.map((file, idx) => (
                            <div key={idx} className="flex flex-col p-2 border rounded-md">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-2">
                                        <FileText className="h-4 w-4 mt-0.5 text-blue-500" />
                                        <div>
                                            <div className="text-sm font-medium truncate max-w-[250px]">
                                                {file.fileName}
                                            </div>
                                            
                                            {file.bankName && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <Building className="h-3.5 w-3.5 text-gray-500" />
                                                    <span className="text-xs text-gray-600">{file.bankName}</span>
                                                </div>
                                            )}
                                            
                                            {file.accountNumber && (
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <CreditCard className="h-3.5 w-3.5 text-gray-500" />
                                                    <span className="text-xs font-mono text-gray-600">
                                                        {file.accountNumber}
                                                    </span>
                                                    
                                                    {extractAccountFromFilename(file.fileName) && 
                                                     extractAccountFromFilename(file.fileName) !== file.accountNumber && (
                                                        <div className="flex items-center ml-1">
                                                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                            <span className="text-xs text-amber-600 ml-0.5">Mismatch</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {file.bankPassword && (
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <Lock className="h-3.5 w-3.5 text-purple-500" />
                                                    <span className="text-xs text-gray-600">Stored Password: </span>
                                                    <code className="text-xs bg-purple-50 px-1 py-0.5 rounded border border-purple-100">
                                                        {file.bankPassword}
                                                    </code>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {file.unlocked && (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Unlocked
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {autoPasswords.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Detected Passwords</Label>
                            <div className="flex flex-wrap gap-2">
                                {autoPasswords.map((pwd, idx) => (
                                    <Button
                                        key={idx}
                                        type="button"
                                        variant={password === pwd ? "default" : "outline"}
                                        size="sm"
                                        className={password === pwd ? "bg-blue-600" : "border-blue-200 text-blue-700"}
                                        onClick={() => setPassword(pwd)}
                                    >
                                        {pwd}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded-md mb-4 text-sm">
                            {errorMessage}
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="new-password" className="text-sm font-medium text-gray-700">Enter Password</Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    id="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password to unlock PDFs"
                                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <Button
                                    onClick={() => tryPassword(password, selectedFiles)}
                                    disabled={isSubmitting || !password || !selectedFiles.length}
                                    className="text-sm px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
                                >
                                    {isSubmitting ? 'Trying...' : 'Try Password'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex justify-between mt-4">
                        <Button
                            variant="outline"
                            onClick={() => onSkip(selectedFiles)}
                            disabled={isSubmitting || !selectedFiles.length}
                        >
                            Skip Selected Files
                        </Button>
                        <Button
                            variant="default"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Done
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}