import { useState } from 'react';
import { DocumentType } from '../types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DocumentViewer } from './DocumentViewer';

interface DocumentPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    documents: Array<{
        file: File;
        type: DocumentType;
        label: string;
        extractions: {
            amount: string | null;
            payment_date: string | null;
            payment_mode: string | null;
            bank_name: string | null;
        };
    }>;
    companyName: string;
}

export function DocumentPreview({
    isOpen,
    onClose,
    documents,
    companyName
}: DocumentPreviewProps) {
    const [selectedDoc, setSelectedDoc] = useState(documents[0]);

    const handleDocumentSelect = (doc: typeof documents[0]) => {
        setSelectedDoc(doc);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[80vh]">
                <DialogHeader>
                    <DialogTitle>Document Preview - {selectedDoc.label}</DialogTitle>
                </DialogHeader>
                <div className="flex h-full gap-4">
                    <div className="w-1/4 overflow-y-auto border-r pr-4">
                        {documents.map((doc, index) => (
                            <div
                                key={index}
                                className={`p-2 cursor-pointer rounded ${
                                    selectedDoc === doc ? 'bg-blue-100' : 'hover:bg-gray-100'
                                }`}
                                onClick={() => handleDocumentSelect(doc)}
                            >
                                <h4 className="font-medium text-sm">{doc.label}</h4>
                                <p className="text-xs text-gray-500">{doc.type}</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 h-full">
                        <DocumentViewer
                            url={URL.createObjectURL(selectedDoc.file)}
                            isOpen={true}
                            onClose={() => {}}
                            title={selectedDoc.label}
                            companyName={companyName}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
