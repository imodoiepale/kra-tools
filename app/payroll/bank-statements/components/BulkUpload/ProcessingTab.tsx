// components/BankStatements/BulkUpload/ProcessingTab.tsx
import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    CheckCircle,
    CircleDashed,
    AlertTriangle,
    XCircle,
    Loader2
} from 'lucide-react';
import FileStatusBadge from './SharedComponents/FileStatusBadge';
import { formatFileSize } from './utils/extractionUtils';
import { BulkUploadItem } from './types';

interface ProcessingTabProps {
    value: string;
    uploadItems: BulkUploadItem[];
    overallProgress: number;
    setActiveTab: React.Dispatch<React.SetStateAction<string>>;
    uploading: boolean;
}

export default function ProcessingTab({
    value,
    uploadItems,
    overallProgress,
    setActiveTab,
    uploading
}: ProcessingTabProps) {
    return (
        <TabsContent value={value} className="flex-1 flex flex-col overflow-auto p-2">
            <div className="space-y-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center">
                            <Loader2 className={`h-5 w-5 mr-2 ${uploading ? 'animate-spin' : ''}`} />
                            Bulk Processing Status
                        </CardTitle>
                        <CardDescription>
                            Processing {uploadItems.length} files {uploading ? '(in progress)' : '(completed)'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {/* Overall Progress */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Overall Progress</span>
                                    <span>{overallProgress}%</span>
                                </div>
                                <Progress value={overallProgress} className="h-2" />
                            </div>

                            {/* Stages Progress */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className={`p-3 rounded-md border ${overallProgress >= 25
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center gap-2">
                                        {overallProgress >= 25 ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                        )}
                                        <span className="text-sm font-medium">File Processing</span>
                                    </div>
                                </div>
                                <div className={`p-3 rounded-md border ${overallProgress >= 50
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center gap-2">
                                        {overallProgress >= 50 ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                        )}
                                        <span className="text-sm font-medium">Data Extraction</span>
                                    </div>
                                </div>
                                <div className={`p-3 rounded-md border ${overallProgress >= 75
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center gap-2">
                                        {overallProgress >= 75 ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                        )}
                                        <span className="text-sm font-medium">Statement Creation</span>
                                    </div>
                                </div>
                                <div className={`p-3 rounded-md border ${overallProgress >= 95
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center gap-2">
                                        {overallProgress >= 95 ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <CircleDashed className="h-4 w-4 text-gray-400" />
                                        )}
                                        <span className="text-sm font-medium">Finalizing</span>
                                    </div>
                                </div>
                            </div>

                            {/* Processing Stats */}
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                <div className="p-3 bg-green-50 rounded-md border border-green-200">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                        <span className="text-sm font-medium text-green-800">
                                            Matched: {uploadItems.filter(i => i.status === 'matched' || i.status === 'uploaded').length}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                        <span className="text-sm font-medium text-yellow-800">
                                            Unmatched: {uploadItems.filter(i => i.status === 'unmatched').length}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-3 bg-red-50 rounded-md border border-red-200">
                                    <div className="flex items-center gap-2">
                                        <XCircle className="h-4 w-4 text-red-500" />
                                        <span className="text-sm font-medium text-red-800">
                                            Failed: {uploadItems.filter(i => i.status === 'failed').length}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (overallProgress >= 100) {
                                            setActiveTab('vouching');
                                        } else {
                                            setActiveTab('review');
                                        }
                                    }}
                                    disabled={uploading}
                                    className="bg-blue-500 hover:bg-blue-600 text-white hover:text-white"
                                >
                                    {overallProgress >= 100 ? 'Continue to Vouching' : 'Review Results'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Individual File Status Table */}
                <div className="border rounded-md overflow-hidden" style={{ maxHeight: '400px' }}>
                    <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
                        <Table className="w-full">
                            <TableHeader className="sticky top-0 bg-white z-10 shadow">
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>File Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Progress</TableHead>
                                    <TableHead>Bank/Account</TableHead>
                                    <TableHead>Password</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {uploadItems.map((item, index) => (
                                    <TableRow key={index} className={item.status === 'failed' ? 'bg-red-50' : ''}>
                                        <TableCell className="text-xs">{index + 1}</TableCell>
                                        <TableCell className="font-medium text-sm truncate max-w-[200px]" title={item.file.name}>
                                            {item.file.name}
                                        </TableCell>
                                        <TableCell><FileStatusBadge status={item.status} /></TableCell>
                                        <TableCell>
                                            <Progress value={item.uploadProgress || 0} className="h-2 w-32" />
                                        </TableCell>
                                        <TableCell>
                                            {item.matchedBank ? (
                                                <div className="text-xs">
                                                    <div className="font-medium">{item.matchedBank.bank_name}</div>
                                                    <div className="text-muted-foreground">{item.matchedBank.account_number}</div>
                                                </div>
                                            ) : item.detectedInfo?.accountNumber ? (
                                                <div className="text-xs">
                                                    <div className="text-muted-foreground">Detected: {item.detectedInfo.accountNumber}</div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">Not detected</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.passwordApplied ? (
                                                <div className="text-xs font-mono text-green-600">{item.password}</div>
                                            ) : item.detectedInfo?.password ? (
                                                <div className="text-xs font-mono">{item.detectedInfo.password}</div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">Not detected</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.status === 'failed' ? (
                                                <div className="text-red-500">{item.error}</div>
                                            ) : item.status === 'processing' ? (
                                                <div className="text-blue-600">Processing...</div>
                                            ) : (
                                                <div className="text-muted-foreground">
                                                    {item.extractedData ? 'Data extracted' : 'No data yet'}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </TabsContent>
    );
}