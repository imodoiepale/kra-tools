import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateForDisplay, formatDateForSubmission, isValidDate } from '../utils/dateUtils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface EditDatesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    company: {
        id: string;
        company_name: string;
        acc_client_effective_from: string;
        acc_client_effective_to: string;
        audit_tax_client_effective_from: string;
        audit_tax_client_effective_to: string;
    };
    onSuccess: () => void;
}

export function EditDatesDialog({ open, onOpenChange, company, onSuccess }: EditDatesDialogProps) {
    const [dates, setDates] = useState({
        acc_from: formatDateForDisplay(company.acc_client_effective_from),
        acc_to: formatDateForDisplay(company.acc_client_effective_to),
        audit_from: formatDateForDisplay(company.audit_tax_client_effective_from),
        audit_to: formatDateForDisplay(company.audit_tax_client_effective_to)
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const validateDates = (): boolean => {
        const allDates = Object.values(dates);
        return allDates.every(date => !date || isValidDate(date));
    };

    const handleSubmit = async () => {
        if (!validateDates()) {
            toast.error('Please enter valid dates in DD/MM/YYYY format');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('acc_portal_company_duplicate')
                .update({
                    acc_client_effective_from: formatDateForSubmission(dates.acc_from),
                    acc_client_effective_to: formatDateForSubmission(dates.acc_to),
                    audit_tax_client_effective_from: formatDateForSubmission(dates.audit_from),
                    audit_tax_client_effective_to: formatDateForSubmission(dates.audit_to)
                })
                .eq('id', company.id);

            if (error) throw error;

            toast.success('Dates updated successfully');
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Error updating dates:', error);
            toast.error('Failed to update dates');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Client Dates - {company.company_name}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="acc_from">ACC From</Label>
                            <Input
                                id="acc_from"
                                value={dates.acc_from}
                                onChange={(e) => setDates(prev => ({ ...prev, acc_from: e.target.value }))}
                                placeholder="DD/MM/YYYY"
                            />
                        </div>
                        <div>
                            <Label htmlFor="acc_to">ACC To</Label>
                            <Input
                                id="acc_to"
                                value={dates.acc_to}
                                onChange={(e) => setDates(prev => ({ ...prev, acc_to: e.target.value }))}
                                placeholder="DD/MM/YYYY"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="audit_from">Audit From</Label>
                            <Input
                                id="audit_from"
                                value={dates.audit_from}
                                onChange={(e) => setDates(prev => ({ ...prev, audit_from: e.target.value }))}
                                placeholder="DD/MM/YYYY"
                            />
                        </div>
                        <div>
                            <Label htmlFor="audit_to">Audit To</Label>
                            <Input
                                id="audit_to"
                                value={dates.audit_to}
                                onChange={(e) => setDates(prev => ({ ...prev, audit_to: e.target.value }))}
                                placeholder="DD/MM/YYYY"
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button 
                        variant="outline" 
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
