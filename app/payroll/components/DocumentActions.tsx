// components/payroll/DocumentActions.tsx
import { useState } from 'react'
import { MoreHorizontal, Download, Trash2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CompanyPayrollRecord, DocumentType } from '../types'
import { toast } from '@/hooks/use-toast'

interface DocumentActionsProps {
    record: CompanyPayrollRecord;
    documentLabels: Record<DocumentType, string>;
    onDelete: (documentType: DocumentType) => Promise<void>;
    onDownload: (documentPath: string) => Promise<void>;
}

export function DocumentActions({
    record,
    documentLabels,
    onDelete,
    onDownload
}: DocumentActionsProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleDownload = async (documentPath: string | null) => {
        if (!documentPath) return;
        try {
            await onDownload(documentPath);
            toast({
                title: "Success",
                description: "Document downloaded successfully"
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to download document",
                variant: "destructive"
            });
        }
    };

    const handleDelete = async (documentType: DocumentType) => {
        try {
            await onDelete(documentType);
            toast({
                title: "Success",
                description: "Document deleted successfully"
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete document",
                variant: "destructive"
            });
        }
    };

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsOpen(true)}
            >
                <MoreHorizontal className="h-4 w-4" />
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Document Actions - {record.company.company_name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {(Object.entries(documentLabels) as [DocumentType, string][]).map(([type, label]) => {
                            const document = record.documents[type];
                            return (
                                <div key={type} className="flex items-center justify-between">
                                    <span className="font-medium">{label}</span>
                                    <div className="flex gap-2">
                                        {document ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8"
                                                    onClick={() => handleDownload(document)}
                                                >
                                                    <Download className="h-4 w-4 mr-1" />
                                                    View
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="h-8"
                                                    onClick={() => handleDelete(type)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-1" />
                                                    Delete
                                                </Button>
                                            </>
                                        ) : (
                                            <Badge variant="outline">Not uploaded</Badge>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}