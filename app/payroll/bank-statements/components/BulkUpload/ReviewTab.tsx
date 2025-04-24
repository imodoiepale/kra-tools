// components/BankStatements/BulkUpload/ReviewTab.tsx
import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileCheck } from 'lucide-react';
import FileStatusBadge from './SharedComponents/FileStatusBadge';
import { BulkUploadItem } from './types';

interface ReviewTabProps {
    value: string;
    uploadItems: BulkUploadItem[];
    onClose: () => void;
    handleStartProcessing: () => void;
    setActiveTab: React.Dispatch<React.SetStateAction<string>>;
    uploading: boolean;
    setCurrentManualMatchItem: React.Dispatch<React.SetStateAction<number | null>>;
    setShowBankSelectorDialog: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ReviewTab({
    value,
    uploadItems,
    onClose,
    handleStartProcessing,
    setActiveTab,
    uploading,
    setCurrentManualMatchItem,
    setShowBankSelectorDialog
}: ReviewTabProps) {
    return (
        <TabsContent value={value} className="flex-1 flex flex-col overflow-auto p-2">
            <div className="border rounded-md overflow-hidden">
                <div className="max-h-[calc(90vh-420px)] overflow-y-auto">
                    <Table className="min-w-full">
                        <TableHeader className="sticky top-0 bg-white z-10 shadow">
                            <TableRow>
                                <TableHead className="w-[40px] text-xs font-semibold">#</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Bank Name</TableHead>
                                <TableHead>Account Number</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Extraction</TableHead>
                                <TableHead>Password</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uploadItems.map((item, index) => (
                                <TableRow key={index} className={item.status === 'unmatched' ? 'bg-yellow-50' : ''}>
                                    <TableCell className="text-xs">{index + 1}</TableCell>
                                    <TableCell className="text-xs">{item.matchedBank?.company_name || 'Unknown'}</TableCell>
                                    <TableCell className="text-xs">{item.matchedBank?.bank_name || item.detectedInfo?.bankName || 'Unknown'}</TableCell>
                                    <TableCell className="font-mono text-xs">{item.matchedBank?.account_number || item.detectedInfo?.accountNumber || 'Unknown'}</TableCell>
                                    <TableCell className="text-xs"><FileStatusBadge status={item.status} /></TableCell>
                                    <TableCell className="text-xs">
                                        {item.extractedData ? (
                                            <Badge variant="outline" className="bg-green-50 text-green-700">
                                                Extracted
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-gray-50">
                                                None
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {item.passwordApplied ? (
                                            <Badge variant="outline" className="bg-green-50 text-green-700">
                                                Applied
                                            </Badge>
                                        ) : item.detectedInfo?.password ? (
                                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                                                Detected
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-gray-50">
                                                None
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {item.status === 'failed' ? (
                                            <div className="text-red-500">{item.error}</div>
                                        ) : item.status === 'unmatched' ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="bg-green-800 text-white text-xs"
                                                onClick={() => {
                                                    setCurrentManualMatchItem(index);
                                                    setShowBankSelectorDialog(true);
                                                }}
                                            >
                                                Match Manually
                                            </Button>
                                        ) : (
                                            <></>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="mt-4 flex justify-between">
                <Button variant="outline" onClick={onClose} disabled={uploading} className="text-xs px-3 py-1">
                    Close
                </Button>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setActiveTab('vouching')}
                        disabled={uploadItems.filter(i => i.status === 'matched' || i.status === 'uploaded').length === 0}
                        className="text-xs px-3 py-1"
                    >
                        Go to Vouching
                    </Button>

                    <Button
                        variant="default"
                        onClick={handleStartProcessing}
                        disabled={uploadItems.length === 0 || uploading}
                        className="text-xs px-3 py-1"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <FileCheck className="h-3 w-3 mr-1" />
                                Process Remaining Files
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </TabsContent>
    );
}