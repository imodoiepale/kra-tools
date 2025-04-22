// @ts-nocheck
import React, { useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputDialogProps {
    isOpen?: boolean;
    bank?: {
        id: number;
        bank_name: string;
        account_number: string;
        acc_password?: string;
    };
    files?: Array<any>;
    onClose: () => void;
    onSave?: (password: string) => void;
    onPasswordSubmit?: (password: string, indexes: number[]) => void;
    onSkip?: (indexes: number[]) => void;
    cycleId?: string;
}

export function PasswordInputDialog({
    isOpen = true,
    bank,
    files,
    onClose,
    onSave,
    onPasswordSubmit,
    onSkip,
    cycleId
}: PasswordInputDialogProps) {
    const [password, setPassword] = useState(bank?.acc_password || '')
    const [showPassword, setShowPassword] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState(files ? files.map((_, i) => i) : [])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (bank && onSave) {
            onSave(password)
        } else if (files && onPasswordSubmit) {
            onPasswordSubmit(password, selectedFiles)
        }
    }

    const handleSkip = () => {
        if (onSkip && selectedFiles.length > 0) {
            onSkip(selectedFiles)
        }
    }

    const toggleFileSelection = (index) => {
        setSelectedFiles(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index) 
                : [...prev, index]
        )
    }

    const title = bank 
        ? `Update Bank Password` 
        : `Password Required for PDF Files`

    const description = bank 
        ? `Enter the password for ${bank.bank_name} - ${bank.account_number}`
        : `Enter the password for the selected PDF files`

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {files && files.length > 0 && (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            <Label>Select files to apply password:</Label>
                            {files.map((file, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id={`file-${index}`}
                                        checked={selectedFiles.includes(index)}
                                        onChange={() => toggleFileSelection(index)}
                                        className="h-4 w-4"
                                    />
                                    <Label htmlFor={`file-${index}`} className="text-sm">
                                        {file.name || `File ${index + 1}`}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="flex gap-2">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter bank statement password"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between">
                        <div>
                            {onSkip && (
                                <Button type="button" variant="outline" onClick={handleSkip}>
                                    Skip Selected
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {bank ? 'Save Password' : 'Apply Password'}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}