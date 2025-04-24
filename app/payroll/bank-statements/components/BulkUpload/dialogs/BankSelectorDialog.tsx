// components/BankStatements/BulkUpload/dialogs/BankSelectorDialog.tsx
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BulkUploadItem } from '../types';

interface BankSelectorDialogProps {
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    currentManualMatchItem: number | null;
    selectedBankIds: { [key: number]: number };
    setSelectedBankIds: React.Dispatch<React.SetStateAction<{ [key: number]: number }>>;
    closingBalanceInputs: { [key: number]: string };
    setClosingBalanceInputs: React.Dispatch<React.SetStateAction<{ [key: number]: string }>>;
    availableBanks: any[];
    selectedCompanyId: number | null;
    setUploadItems: React.Dispatch<React.SetStateAction<BulkUploadItem[]>>;
    uploadItems: BulkUploadItem[];
    loadingCompanies: boolean;
    randomMode: boolean;
}

export default function BankSelectorDialog({
    isOpen,
    setIsOpen,
    currentManualMatchItem,
    selectedBankIds,
    setSelectedBankIds,
    closingBalanceInputs,
    setClosingBalanceInputs,
    availableBanks,
    selectedCompanyId,
    setUploadItems,
    uploadItems,
    loadingCompanies,
    randomMode
}: BankSelectorDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Select Bank for Statement</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-3">
                    <Label>Select a bank for this statement</Label>
                    <Select
                        value={selectedBankIds[currentManualMatchItem!]?.toString() || "placeholder"}
                        onValueChange={(value) => setSelectedBankIds(prev => ({
                            ...prev,
                            [currentManualMatchItem!]: value === "placeholder" ? 0 : parseInt(value)
                        }))}
                        disabled={loadingCompanies}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a bank" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="placeholder">-- Select Bank --</SelectItem>
                            {availableBanks
                                .filter(bank => randomMode || bank?.company_id === selectedCompanyId)
                                .map(bank => (
                                    <SelectItem key={bank.id} value={bank.id.toString()}>
                                        {bank.bank_name} - {bank.account_number}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>

                    <Input
                        type="number"
                        step="0.01"
                        placeholder="Closing Balance (optional)"
                        value={closingBalanceInputs[currentManualMatchItem!] || ''}
                        onChange={(e) => setClosingBalanceInputs(prev => ({
                            ...prev,
                            [currentManualMatchItem!]: e.target.value
                        }))}
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="default"
                        onClick={() => {
                            // Apply the manual match
                            if (currentManualMatchItem === null) return;

                            const bankId = selectedBankIds[currentManualMatchItem] || 0;
                            if (bankId > 0) {
                                const matchedBank = availableBanks.find(b => b.id === bankId);
                                if (matchedBank) {
                                    setUploadItems(items => {
                                        const updated = [...items];
                                        if (updated[currentManualMatchItem]) {
                                            updated[currentManualMatchItem] = {
                                                ...updated[currentManualMatchItem],
                                                matchedBank,
                                                status: 'matched',
                                                closingBalance: closingBalanceInputs[currentManualMatchItem] ?
                                                    parseFloat(closingBalanceInputs[currentManualMatchItem]) : null
                                            };
                                        }
                                        return updated;
                                    });
                                }
                            }
                            setIsOpen(false);
                        }}
                        disabled={
                            currentManualMatchItem === null ||
                            !selectedBankIds[currentManualMatchItem] ||
                            selectedBankIds[currentManualMatchItem] === 0
                        }
                    >
                        Apply Match
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}