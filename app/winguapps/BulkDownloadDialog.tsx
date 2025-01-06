import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Loader2 } from 'lucide-react';
import { DownloadStatus, SelectedDocs } from './types';

interface DocumentGroup {
    key: keyof SelectedDocs;
    label: string;
}

interface DocumentGroups {
    [key: string]: DocumentGroup[];
}

interface BulkDownloadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedDocs: SelectedDocs;
    setSelectedDocs: (docs: SelectedDocs) => void;
    onDownload: () => Promise<void>;
}

const documentGroups: DocumentGroups = {
    'Statutory Documents (PDF)': [
        { key: 'PAYE_PDF', label: 'PAYE Returns' },
        { key: 'NSSF_PDF', label: 'NSSF Returns' },
        { key: 'NHIF_PDF', label: 'NHIF Returns' },
        { key: 'SHIF_PDF', label: 'SHIF Returns' },
        { key: 'Housing_Levy_PDF', label: 'Housing Levy Returns' },
        { key: 'NITA_PDF', label: 'NITA Returns' }
    ],
    'Statutory Documents (Excel/CSV)': [
        { key: 'PAYE_CSV', label: 'PAYE CSV' },
        { key: 'Housing_Levy_CSV', label: 'Housing Levy CSV' },
        { key: 'NSSF_Excel', label: 'NSSF Excel' },
        { key: 'NHIF_Excel', label: 'NHIF Excel' },
        { key: 'SHIF_Excel', label: 'SHIF Excel' }
    ],
    'Payroll Documents': [
        { key: 'Payroll_Summary_PDF', label: 'Payroll Summary PDF' },
        { key: 'Payroll_Summary_Excel', label: 'Payroll Summary Excel' },
        { key: 'Payroll_Recon', label: 'Payroll Recon' },
        { key: 'Control_Total', label: 'Control Total' },
        { key: 'Payslips', label: 'Payslips' }
    ],
    'Payment Lists': [
        { key: 'Bank_List', label: 'Bank List' },
        { key: 'Cash_List', label: 'Cash List' },
        { key: 'MPESA_List', label: 'M-PESA List' }
    ]
};

const BulkDownloadDialog: React.FC<BulkDownloadDialogProps> = ({
    open,
    onOpenChange,
    selectedDocs,
    setSelectedDocs,
    onDownload
}) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({ logs: [], errors: [], progress: '' });
    const logsEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (downloadStatus.logs.length > 0) {
            scrollToBottom();
        }
    }, [downloadStatus.logs]);

    const handleDownload = async () => {
        setIsDownloading(true);
        setDownloadStatus({ logs: [], errors: [], progress: '' });
        
        try {
            const response = await fetch('/api/bulkDownload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ selectedDocs }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get logs from headers
            const logsHeader = response.headers.get('X-Download-Logs');
            if (logsHeader) {
                const decodedLogs = JSON.parse(atob(logsHeader)) as { logs: string[], errors: string[] };
                setDownloadStatus(prev => ({
                    ...prev,
                    logs: decodedLogs.logs,
                    errors: decodedLogs.errors
                }));
            }

            // Get the blob and create download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bulk_download_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('Download failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setDownloadStatus(prev => ({
                ...prev,
                logs: [...prev.logs, `[ERROR] ${errorMessage}`],
                errors: [...prev.errors, errorMessage]
            }));
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Bulk Download Documents</DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 min-h-0 flex flex-col">
                    <ScrollArea className="flex-1 border rounded-md p-4 mb-4">
                        {Object.entries(documentGroups).map(([groupName, docs]) => (
                            <div key={groupName} className="mb-6">
                                <h3 className="font-semibold mb-2">{groupName}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {docs.map(({ key, label }) => (
                                        <div key={key} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={key}
                                                checked={selectedDocs[key]}
                                                onCheckedChange={(checked) => {
                                                    setSelectedDocs({
                                                        ...selectedDocs,
                                                        [key]: checked
                                                    });
                                                }}
                                            />
                                            <Label htmlFor={key}>{label}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </ScrollArea>

                    {isDownloading && downloadStatus.logs.length > 0 && (
                        <ScrollArea className="h-[200px] border rounded-md p-4 mb-4 bg-muted">
                            <div className="space-y-1">
                                {downloadStatus.logs.map((log, index) => (
                                    <div 
                                        key={index} 
                                        className={`text-sm ${
                                            log.includes('[SUCCESS]') ? 'text-green-600' :
                                            log.includes('[ERROR]') ? 'text-red-600' :
                                            'text-foreground'
                                        }`}
                                    >
                                        {log}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </ScrollArea>
                    )}

                    <div className="flex justify-end space-x-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isDownloading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDownload}
                            disabled={isDownloading || !Object.values(selectedDocs).some(Boolean)}
                        >
                            {isDownloading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Downloading...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Selected
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default BulkDownloadDialog;
