// @ts-nocheck

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { DocumentViewer } from './DocumentViewer'
import { DocumentType, ReceiptExtraction } from '../types'
import { useToast } from '@/hooks/use-toast'

interface DocumentExtractionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documentPath: string;
    documentType: DocumentType;
    extractions: ReceiptExtraction;
    onSave: (extractions: ReceiptExtraction) => Promise<void>;
}

export function DocumentExtractionsDialog({
    open,
    onOpenChange,
    documentPath,
    documentType,
    extractions: initialExtractions,
    onSave
}: DocumentExtractionsDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [extractions, setExtractions] = useState<ReceiptExtraction>(initialExtractions);
    const { toast } = useToast();

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            await onSave(extractions);
            onOpenChange(false);
            toast({
                title: "Success",
                description: "Document extractions updated successfully"
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update document extractions",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Document Extractions</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                        <DocumentViewer
                            documentPath={documentPath}
                            file={null}
                        />
                    </div>
                    <div className="border-l pl-4">
                        <h3 className="font-semibold mb-4">Extractions</h3>
                        <ScrollArea className="h-[400px]">
                            <Card className="p-4">
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="amount">Amount</Label>
                                        <Input
                                            id="amount"
                                            type="number"
                                            value={extractions.amount || ''}
                                            onChange={(e) => setExtractions(prev => ({
                                                ...prev,
                                                amount: parseFloat(e.target.value) || null
                                            }))}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="payment_date">Payment Date</Label>
                                        <Input
                                            id="payment_date"
                                            type="date"
                                            value={extractions.payment_date ? new Date(extractions.payment_date).toISOString().split('T')[0] : ''}
                                            onChange={(e) => setExtractions(prev => ({
                                                ...prev,
                                                payment_date: e.target.value
                                            }))}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="payment_mode">Payment Mode</Label>
                                        <Input
                                            id="payment_mode"
                                            value={extractions.payment_mode || ''}
                                            onChange={(e) => setExtractions(prev => ({
                                                ...prev,
                                                payment_mode: e.target.value
                                            }))}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="bank_name">Bank Name</Label>
                                        <Input
                                            id="bank_name"
                                            value={extractions.bank_name || ''}
                                            onChange={(e) => setExtractions(prev => ({
                                                ...prev,
                                                bank_name: e.target.value
                                            }))}
                                        />
                                    </div>
                                </div>
                            </Card>
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
