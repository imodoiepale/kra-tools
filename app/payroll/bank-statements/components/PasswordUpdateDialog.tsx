// app/payroll/bank-statements/components/PasswordUpdateDialog.tsx
// @ts-nocheck
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Lock, Eye, EyeOff, Save, Loader2 } from 'lucide-react';

interface Bank {
    id: number;
    bank_name: string;
    account_number: string;
    company_name: string;
    acc_password?: string | null;
}

interface PasswordUpdateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    bank: Bank;
    onPasswordUpdated: (bank: Bank) => void;
}

export function PasswordUpdateDialog({
    isOpen,
    onClose,
    bank,
    onPasswordUpdated
}: PasswordUpdateDialogProps) {
    const [password, setPassword] = useState(bank?.acc_password || '');
    const [showPassword, setShowPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleSave = async () => {
        if (!bank) return;

        setIsSaving(true);
        try {
            const { data, error } = await supabase
                .from('acc_portal_banks')
                .update({ acc_password: password || null })
                .eq('id', bank.id)
                .select()
                .single();

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'Bank password updated successfully'
            });

            onPasswordUpdated({ ...bank, acc_password: password });
            onClose();
        } catch (error) {
            console.error('Error updating password:', error);
            toast({
                title: 'Error',
                description: 'Failed to update bank password',
                variant: 'destructive'
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-blue-600" />
                        Update Bank Password
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="bg-blue-50 p-3 rounded-md">
                        <div className="space-y-2 text-sm">
                            <div><strong>Company:</strong> {bank?.company_name}</div>
                            <div><strong>Bank:</strong> {bank?.bank_name}</div>
                            <div><strong>Account:</strong> {bank?.account_number}</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Account Password</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter account password..."
                                className="pr-10"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1 h-7 w-7 p-0"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            This password will be used for automatic PDF unlocking
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Password
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}