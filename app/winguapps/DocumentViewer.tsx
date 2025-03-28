"use client"

import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";

interface DocumentViewerProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title: string;
    fileType: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
    isOpen,
    onClose,
    url,
    title,
    fileType
}) => {
    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !url) return;

        const fetchDocument = async () => {
            try {
                setLoading(true);
                setError(null);
                setContent(null);

                if (fileType === 'pdf') {
                    setLoading(false);
                    return;
                }

                const response = await fetch(`/api/viewDocument?url=${encodeURIComponent(url)}&type=${fileType}`);
                if (!response.ok) throw new Error('Failed to fetch document');

                const data = await response.json();
                if (data.error) throw new Error(data.error);
                
                setContent(data);
            } catch (err: any) {
                setError(err.message || 'Failed to load document');
            } finally {
                setLoading(false);
            }
        };

        fetchDocument();
    }, [url, fileType, isOpen]);

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center h-96 space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <div className="text-sm text-gray-600">Loading document...</div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-96 space-y-4">
                    <div className="text-red-500 text-center">
                        <div className="text-lg font-semibold">Error Loading Document</div>
                        <div className="text-sm">{error}</div>
                    </div>
                </div>
            );
        }

        switch (fileType.toLowerCase()) {
            case 'pdf':
                return (
                    <iframe
                        src={`/api/viewDocument?url=${encodeURIComponent(url)}&type=pdf`}
                        className="w-full h-[calc(100vh-200px)]"
                    />
                );
            case 'excel':
            case 'csv':
                if (!content?.data) return null;
                return (
                    <ScrollArea className="h-[calc(100vh-200px)]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {content.headers.map((header: string, index: number) => (
                                        <TableCell
                                            key={index}
                                            className="bg-blue-600 text-white font-semibold text-[11px] py-2"
                                        >
                                            {header}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {content.data.map((row: any[], rowIndex: number) => (
                                    <TableRow key={rowIndex} className="hover:bg-gray-50">
                                        {row.map((cell, cellIndex) => (
                                            <TableCell
                                                key={cellIndex}
                                                className="text-[11px] py-1"
                                            >
                                                {cell}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                );
            default:
                return <div>Unsupported file type</div>;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl w-full">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(url, '_blank')}
                            >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>
                {renderContent()}
            </DialogContent>
        </Dialog>
    );
};

export default DocumentViewer;
