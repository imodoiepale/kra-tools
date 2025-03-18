// components/PasswordInputDialog.tsx
import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, FileText, X, CheckCircle } from 'lucide-react';

interface PasswordInputDialogProps {
    isOpen: boolean;
    onClose: () => void;
    files: Array<{
        index: number;
        fileName: string;
        passwordAttempts?: number;
        unlocked?: boolean;
    }>;
    onPasswordSubmit: (password: string, fileIndexes: number[]) => Promise<boolean>;
    onSkip: (fileIndexes: number[]) => void;
}


function extractPasswordFromFilename(filename) {
    if (!filename) return null;

    const lowerFilename = filename.toLowerCase();

    // Expanded set of password indicators in bank statement filenames
    const passwordIndicators = [
        'pw', 'pwd', 'password', 'passcode', 'pass', 'p w', 'p-w', 'p_w',
        'pin', 'key', 'code', 'access', 'secure', 'auth'
    ];

    // Try each indicator with more patterns
    for (const indicator of passwordIndicators) {
        // Find the indicator in the filename
        const indicatorIndex = lowerFilename.indexOf(indicator);

        if (indicatorIndex !== -1) {
            // Get text after the indicator
            const afterIndicator = filename.substring(indicatorIndex + indicator.length).trim();

            // Extract patterns: numbers, or letters+numbers
            const patterns = [
                /^[\s\-_:]*([0-9]{4,12})/,            // Just numbers (common passwords)
                /^[\s\-_:]*([a-zA-Z0-9]{4,12})/,      // Alphanumeric
                /^[\s\-_:]*"([^"]+)"/,                // Anything in quotes
                /^[\s\-_:]*\(([^)]+)\)/,              // Anything in parentheses
                /^[\s\-_:]*\[([^\]]+)\]/,             // Anything in square brackets
            ];

            for (const pattern of patterns) {
                const match = afterIndicator.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
        }
    }

    // Account number patterns
    const accountPatterns = [
        /\b(\d{6,12})\b(?!.*\d{6,12})/,              // 6-12 digit number (likely account)
        /acc(?:ount)?[:\s\-_]+(\d+)/i,               // "acc" or "account" followed by numbers
        /a\/c[:\s\-_]+(\d+)/i,                       // "a/c" followed by numbers
    ];

    for (const pattern of accountPatterns) {
        const match = filename.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    // Last resort: look for 4-8 digit numbers anywhere in the filename
    const lastResortMatch = filename.match(/\b(\d{4,8})\b/);
    if (lastResortMatch && lastResortMatch[1]) {
        return lastResortMatch[1];
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
        const extracted = files.map(file => ({
            index: file.index,
            filename: file.fileName,
            password: extractPasswordFromFilename(file.fileName)
        })).filter(item => item.password);

        setAutoPasswords(extracted);
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
                // Add password to saved passwords if not already there
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
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-6xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center">
                        <Lock className="mr-2 h-5 w-5 text-amber-500" />
                        Password Protected PDFs Detected
                    </DialogTitle>
                    <DialogDescription>
                        The following {files.length} file(s) require a password to unlock. Please enter the password below.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-60 overflow-y-auto border rounded-md p-2 mb-4">
                    <div className="text-sm font-medium mb-2 text-muted-foreground">Protected Files:</div>
                    {files.map((file) => (
                        <div key={file.index} className="flex items-center mb-2 py-1 border-b last:border-b-0">
                            <input
                                type="checkbox"
                                checked={selectedFiles.includes(file.index)}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setSelectedFiles([...selectedFiles, file.index]);
                                    } else {
                                        setSelectedFiles(selectedFiles.filter(idx => idx !== file.index));
                                    }
                                }}
                                className="mr-2"
                            />
                            <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="flex-1 truncate">{file.fileName}</span>
                            {file.unlocked && (
                                <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                            )}
                            {!file.unlocked && file.passwordAttempts && file.passwordAttempts > 0 && (
                                <span className="text-xs text-amber-600 ml-2">
                                    {file.passwordAttempts} attempt{file.passwordAttempts !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {errorMessage && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded-md mb-4 text-sm">
                        {errorMessage}
                    </div>
                )}

                <div className="space-y-6">
                    {/* New password input */}
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

                    {autoPasswords.length > 0 && (
                        <div className="space-y-3">
                            <Label className="text-sm font-medium text-gray-700">Auto-Detected Passwords</Label>
                            <div className="bg-green-50 border border-green-200 p-4 rounded-md">
                                <p className="text-sm text-green-800 mb-3">
                                    Potential passwords detected from filenames:
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    {autoPasswords.map((item, i) => (
                                        <Button
                                            key={i}
                                            variant="outline"
                                            size="sm"
                                            className="bg-green-100 hover:bg-green-200 text-green-800 text-sm px-3 py-1 rounded-md"
                                            onClick={() => tryPassword(item.password, [item.index])}
                                        >
                                            Try "{item.password}"
                                            <span className="text-xs ml-2 opacity-75">
                                                (from {item.filename.substring(0, 15)}...)
                                            </span>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
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
            </DialogContent>
        </Dialog>
    );
}