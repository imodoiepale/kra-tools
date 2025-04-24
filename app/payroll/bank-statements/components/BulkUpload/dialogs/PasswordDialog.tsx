// @ts-nocheck
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { applyPasswordToFiles } from '../utils/extractionUtils';
import { BulkUploadItem, PasswordProtectedFile } from '../types';

interface PasswordDialogProps {
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    passwordProtectedFiles: PasswordProtectedFile[];
    uploadItems: BulkUploadItem[];
    setUploadItems: React.Dispatch<React.SetStateAction<BulkUploadItem[]>>;
    setPasswordProtectedFiles: React.Dispatch<React.SetStateAction<PasswordProtectedFile[]>>;
    processNextQueueItem: () => void;
    processingQueue: number[];
    setProcessingQueue: React.Dispatch<React.SetStateAction<number[]>>;
    handleFileExtraction: (itemIndex: number) => Promise<void>;
}

export default function PasswordDialog({
    isOpen,
    setIsOpen,
    passwordProtectedFiles,
    uploadItems,
    setUploadItems,
    setPasswordProtectedFiles,
    processNextQueueItem,
    processingQueue,
    setProcessingQueue,
    handleFileExtraction
}: PasswordDialogProps) {
    const { toast } = useToast();

    const handleApplyPassword = async (fileIndex: number, password: string) => {
        const item = uploadItems[fileIndex];
        if (!item || !item.file || !password) return;

        try {
            const success = await applyPasswordToFiles(item.file, password);
            if (success) {
                // Password applied successfully
                setUploadItems(prev => {
                    const updated = [...prev];
                    updated[fileIndex] = {
                        ...updated[fileIndex],
                        passwordApplied: true,
                        password: password
                    };
                    return updated;
                });

                // Remove from password list
                setPasswordProtectedFiles(prev =>
                    prev.filter(f => f.index !== fileIndex)
                );

                toast({
                    title: "Success",
                    description: `Password applied successfully`,
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
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-4xl">
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
                                <span className="" title={fileItem.fileName}>
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
                                        onClick={() => handleApplyPassword(
                                            fileItem.index,
                                            uploadItems[fileItem.index]?.password || ''
                                        )}
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
                                                    onClick={() => handleApplyPassword(fileItem.index, pwd)}
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
                            setIsOpen(false);

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
                                setIsOpen(false);
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
    );
}