// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Loader2, Upload, AlertTriangle, CheckCircle, UploadCloud,
    FileText, Building, Landmark, CreditCard, DollarSign,
    Calendar, X, ArrowRight, FileCheck, FilePlus, FileWarning,
    ChevronDown, ChevronRight, Save, Eye
} from 'lucide-react';
import { performBankStatementExtraction, processBulkExtraction } from '@/lib/bankExtractionUtils';
import { BankValidationDialog } from './BankValidationDialog';
import { PasswordInputDialog } from './PasswordInputDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Bank {
    id: number;
    bank_name: string;
    account_number: string;
    bank_currency: string;
    company_id: number;
    company_name: string;
}

interface BulkUploadItem {
    file: File;
    status: 'pending' | 'processing' | 'matched' | 'unmatched' | 'failed' | 'uploaded' | 'vouched';
    extractedData: any;
    matchedBank?: Bank;
    error?: string;
    uploadProgress?: number;
    isVouched?: boolean;
    vouchNotes?: string;
}

interface CompanyGroup {
    companyId: number;
    companyName: string;
    isExpanded: boolean;
    isVouched: boolean;
    statements: BulkUploadItem[];
}

interface BankStatementBulkUploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    banks: Bank[];
    cycleMonth: number;
    cycleYear: number;
    statementCycleId: string;
    onUploadsComplete: () => void;
}

export function BankStatementBulkUploadDialog({
    isOpen,
    onClose,
    banks,
    cycleMonth,
    cycleYear,
    statementCycleId,
    onUploadsComplete
}: BankStatementBulkUploadDialogProps) {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('upload');
    const [uploadItems, setUploadItems] = useState<BulkUploadItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);
    const [companyGroups, setCompanyGroups] = useState<CompanyGroup[]>([]);
    const [passwordProtectedFiles, setPasswordProtectedFiles] = useState([]);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setUploadItems([]);
        setActiveTab('upload');
        setIsProcessing(false);
        setOverallProgress(0);
        setCompanyGroups([]);
        setPasswordProtectedFiles([]);
        setShowPasswordDialog(false);
        onClose();
    };

    const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            handleFileSelection({ target: { files: event.dataTransfer.files } });
            event.dataTransfer.clearData();
        }
    };

    const handleFileSelection = (event) => {
        const files = event.target.files;
        if (!files) return;
        const newItems: BulkUploadItem[] = Array.from(files)
            .filter(file => file.type === 'application/pdf')
            .map(file => ({
                file,
                status: 'pending',
                extractedData: null,
                error: null,
            }));
        setUploadItems(prev => [...prev, ...newItems]);
    };

    const removeItem = (index: number) => {
        setUploadItems(items => items.filter((_, i) => i !== index));
    };

    const findMatchingBank = (extractedData, allBanks) => {
        if (!extractedData || !allBanks) return null;
        let bestMatch = null;
        let highScore = 0;

        const extractedAccount = extractedData.account_number?.replace(/\D/g, '');
        if (!extractedAccount) return null;

        for (const bank of allBanks) {
            let score = 0;
            const bankAccount = bank.account_number?.replace(/\D/g, '');

            if (bankAccount && extractedAccount.endsWith(bankAccount.slice(-6))) {
                score += 5;
            }
            if (bank.bank_name && extractedData.bank_name && bank.bank_name.toLowerCase().includes(extractedData.bank_name.toLowerCase().substring(0, 5))) {
                score += 3;
            }

            if (score > highScore) {
                highScore = score;
                bestMatch = bank;
            }
        }
        return highScore > 4 ? bestMatch : null;
    };

    const handleStartProcessing = async () => {
        if (uploadItems.length === 0) return;
        setIsProcessing(true);
        setActiveTab('processing');
        setOverallProgress(5);

        try {
            const itemsToProcess = uploadItems.filter(item => item.status === 'pending');
            const results = await processBulkExtraction(
                itemsToProcess.map(item => item.file),
                { month: cycleMonth, year: cycleYear },
                (progress) => setOverallProgress(5 + Math.floor(progress * 85))
            );

            const updatedItems = [...uploadItems];
            results.forEach((result, i) => {
                const originalItem = itemsToProcess[i];
                const itemIndex = updatedItems.findIndex(item => item === originalItem);

                if (result.success) {
                    const matchedBank = findMatchingBank(result.extractedData, banks);
                    updatedItems[itemIndex] = {
                        ...updatedItems[itemIndex],
                        status: matchedBank ? 'matched' : 'unmatched',
                        extractedData: result.extractedData,
                        matchedBank: matchedBank || undefined,
                    };
                } else {
                    updatedItems[itemIndex] = { ...updatedItems[itemIndex], status: 'failed', error: result.error };
                }
            });
            setUploadItems(updatedItems);
            setOverallProgress(100);
            toast({ title: "Processing Complete", description: "Review the matched and unmatched statements." });
            setActiveTab('review');
        } catch (error) {
            toast({ title: "Processing Error", description: error.message, variant: "destructive" });
            setActiveTab('upload');
            setIsProcessing(false);
        }
    };

    const handleManualUpload = async (index: number, bankId: number) => {
        const item = uploadItems[index];
        const bank = banks.find(b => b.id === bankId);
        if (!item || !bank) return;

        const updatedItems = [...uploadItems];
        updatedItems[index] = { ...item, status: 'processing', uploadProgress: 10 };
        setUploadItems(updatedItems);

        // This would call a centralized upload function from a hook
        // For now, simulating the upload process
        await new Promise(res => setTimeout(res, 1000));

        const finalItems = [...uploadItems];
        finalItems[index] = { ...item, status: 'uploaded', matchedBank: bank, uploadProgress: 100 };
        setUploadItems(finalItems);
        toast({ title: "Manual Upload Success", description: `Statement assigned to ${bank.company_name}.` });
        onUploadsComplete();
    };

    const organizeByCompany = useCallback(() => {
        const validItems = uploadItems.filter(item => item.status === 'matched' || item.status === 'uploaded' || item.status === 'vouched');
        const grouped = validItems.reduce((acc, item) => {
            const companyId = item.matchedBank?.company_id;
            if (!companyId) return acc;
            if (!acc[companyId]) {
                acc[companyId] = { companyId, companyName: item.matchedBank.company_name, isExpanded: false, statements: [], isVouched: false };
            }
            acc[companyId].statements.push(item);
            return acc;
        }, {});

        const groupsArray = Object.values(grouped);
        groupsArray.forEach(group => {
            group.isVouched = group.statements.every(s => s.isVouched);
        });

        setCompanyGroups(groupsArray);
    }, [uploadItems]);

    useEffect(() => {
        if (activeTab === 'vouching') {
            organizeByCompany();
        }
    }, [activeTab, uploadItems, organizeByCompany]);

    const formatFileSize = (bytes) => bytes === 0 ? '0 Bytes' : `${parseFloat((bytes / Math.pow(1024, Math.floor(Math.log(bytes) / Math.log(1024)))).toFixed(2))} ${['Bytes', 'KB', 'MB', 'GB'][Math.floor(Math.log(bytes) / Math.log(1024))]}`;
    const getStatusBadge = (status) => {
        const variants = { pending: 'outline', processing: 'secondary', matched: 'success', unmatched: 'warning', failed: 'destructive', uploaded: 'success', vouched: 'default' };
        return <Badge variant={variants[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetState(); }}>
            <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <div className="bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50 -mx-6 -mt-6 p-6 rounded-t-lg border-b border-blue-200">
                        <div className="mb-2 flex justify-center"><div className="h-14 w-14 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shadow-sm"><UploadCloud className="h-7 w-7 text-blue-600" /></div></div>
                        <DialogTitle className="text-center text-xl text-blue-800">Bulk Upload Bank Statements</DialogTitle>
                        <p className="text-center text-blue-600 text-sm mt-1">{format(new Date(cycleYear, cycleMonth, 1), 'MMMM yyyy')}</p>
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col overflow-hidden">
                    <TabsList className="flex-shrink-0">
                        <TabsTrigger value="upload" disabled={isProcessing}>Upload</TabsTrigger>
                        <TabsTrigger value="processing" disabled={!isProcessing && activeTab !== 'processing'}>Processing</TabsTrigger>
                        <TabsTrigger value="review">Review & Match</TabsTrigger>
                        <TabsTrigger value="vouching">Vouching</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="flex-grow flex flex-col p-4 space-y-4">
                        <div onDrop={handleFileDrop} onDragOver={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()} className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                            <UploadCloud className="h-12 w-12 text-gray-400 mb-4" />
                            <p className="text-lg font-semibold text-gray-600">Drag & drop PDF files here</p>
                            <p className="text-sm text-gray-500">or click to browse</p>
                            <Input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileSelection} className="hidden" />
                        </div>
                        <div className="flex-shrink-0 h-48 border rounded-md overflow-y-auto">
                            <Table>
                                <TableHeader><TableRow><TableHead>File Name</TableHead><TableHead>Size</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {uploadItems.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-gray-500 py-8">No files selected</TableCell></TableRow> :
                                        uploadItems.map((item, index) => (
                                            <TableRow key={index}><TableCell>{item.file.name}</TableCell><TableCell>{formatFileSize(item.file.size)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => removeItem(index)}><X className="h-4 w-4" /></Button></TableCell></TableRow>
                                        ))
                                    }
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleStartProcessing} disabled={uploadItems.length === 0 || isProcessing}><FilePlus className="h-4 w-4 mr-2" />Process {uploadItems.length} Files</Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="processing" className="flex-grow flex flex-col items-center justify-center p-4 space-y-6">
                        <h2 className="text-2xl font-semibold">Processing Statements...</h2>
                        <div className="w-full max-w-lg">
                            <div className="flex justify-between mb-1"><span className="text-base font-medium text-blue-700">Overall Progress</span><span className="text-sm font-medium text-blue-700">{Math.round(overallProgress)}%</span></div>
                            <Progress value={overallProgress} className="w-full" />
                        </div>
                        <p className="text-gray-500">Please wait while we extract and match your documents.</p>
                    </TabsContent>

                    <TabsContent value="review" className="flex-grow overflow-hidden p-1">
                        <div className="h-full overflow-y-auto border rounded-md">
                            <Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Status</TableHead><TableHead>Matched To</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {uploadItems.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{item.file.name}</TableCell>
                                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                                            <TableCell>{item.matchedBank ? `${item.matchedBank.company_name} - ${item.matchedBank.bank_name}` : <span className="text-gray-500">N/A</span>}</TableCell>
                                            <TableCell>
                                                {item.status === 'unmatched' && (
                                                    <select onChange={(e) => handleManualUpload(index, parseInt(e.target.value))} defaultValue="" className="p-1 border rounded-md text-sm">
                                                        <option value="" disabled>Manually Assign...</option>
                                                        {banks.map(bank => <option key={bank.id} value={bank.id}>{`${bank.company_name} / ${bank.bank_name}`}</option>)}
                                                    </select>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="vouching" className="flex-grow overflow-hidden p-1">
                        <div className="h-full overflow-y-auto space-y-2">
                            {companyGroups.map(group => (
                                <Collapsible key={group.companyId} className="border rounded-md">
                                    <CollapsibleTrigger className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100">
                                        <div className="flex items-center gap-3"><ChevronRight className="h-4 w-4" /><Building className="h-5 w-5 text-blue-600" /><span className="font-semibold">{group.companyName}</span><Badge variant="secondary">{group.statements.length}</Badge></div>
                                        {group.isVouched ? <Badge variant="success"><CheckCircle className="h-4 w-4 mr-1" />Vouched</Badge> : <Badge variant="outline">Pending</Badge>}
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="p-4 space-y-4">
                                        {group.statements.map((statement, idx) => (
                                            <div key={idx} className="border rounded-lg p-3">
                                                <p className="font-medium">{statement.file.name}</p>
                                                <div className="text-sm text-gray-600 mt-1">
                                                    <p>Closing Balance: <span className="font-semibold">{statement.extractedData?.closing_balance ? new Intl.NumberFormat().format(statement.extractedData.closing_balance) : 'N/A'}</span></p>
                                                </div>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <Checkbox id={`vouch-${group.companyId}-${idx}`} onCheckedChange={(checked) => {
                                                        const newItems = [...uploadItems];
                                                        const itemIndex = newItems.findIndex(i => i.file.name === statement.file.name);
                                                        newItems[itemIndex].isVouched = !!checked;
                                                        setUploadItems(newItems);
                                                    }} />
                                                    <Label htmlFor={`vouch-${group.companyId}-${idx}`}>I have vouched this statement</Label>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex justify-end mt-2">
                                            <Button onClick={() => {
                                                const newItems = [...uploadItems];
                                                group.statements.forEach(s => {
                                                    const itemIndex = newItems.findIndex(i => i.file.name === s.file.name);
                                                    newItems[itemIndex].isVouched = true;
                                                });
                                                setUploadItems(newItems);
                                                organizeByCompany();
                                            }}>Vouch All for this Company</Button>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}