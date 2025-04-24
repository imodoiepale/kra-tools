// components/BankStatements/BulkUpload/CompanyGroupItem.tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, Building, CheckCircle, FileText, Eye } from 'lucide-react';
import { CompanyGroup, BulkUploadItem } from './types';
import FileStatusBadge from './SharedComponents/FileStatusBadge';
import { format } from 'date-fns';

interface CompanyGroupItemProps {
    group: CompanyGroup;
    toggleCompanyExpansion: (companyId: number) => void;
    markCompanyVouched: (companyId: number, isVouched: boolean) => void;
    vouchingChecked: { [key: string]: boolean };
    setVouchingChecked: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
    vouchingNotes: { [key: string]: string };
    setVouchingNotes: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
    setCurrentProcessingItem: React.Dispatch<React.SetStateAction<BulkUploadItem | null>>;
    setShowExtractionDialog: React.Dispatch<React.SetStateAction<boolean>>;
    pdfUrls: Record<string, string>;
    setUploadItems: React.Dispatch<React.SetStateAction<BulkUploadItem[]>>;
}

export default function CompanyGroupItem({
    group,
    toggleCompanyExpansion,
    markCompanyVouched,
    vouchingChecked,
    setVouchingChecked,
    vouchingNotes,
    setVouchingNotes,
    setCurrentProcessingItem,
    setShowExtractionDialog,
    pdfUrls,
    setUploadItems
}: CompanyGroupItemProps) {
    return (
        <Collapsible
            open={group.isExpanded}
            onOpenChange={() => toggleCompanyExpansion(group.companyId)}
            className="border rounded-md shadow-sm"
        >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-t-md">
                <div className="flex items-center gap-2">
                    {group.isExpanded ?
                        <ChevronDown className="h-4 w-4 text-slate-500" /> :
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                    }
                    <Building className="h-4 w-4 text-blue-600 mr-1" />
                    <span className="font-medium">{group.companyName}</span>
                    <Badge variant="outline" className="ml-2">
                        {group.statements.length} statement{group.statements.length !== 1 ? 's' : ''}
                    </Badge>
                </div>
                <div>
                    {group.isVouched ? (
                        <Badge className="bg-purple-100 text-purple-800">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Vouched
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700">
                            Pending Vouching
                        </Badge>
                    )}
                </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="p-3 space-y-4">
                {group.statements.map((statement, statementIdx) => (
                    <div key={statementIdx} className="border rounded-md overflow-hidden">
                        <div className="p-2 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <span className="font-medium">{statement.file.name}</span>
                            </div>
                            <FileStatusBadge status={statement.status} />
                        </div>

                        {/* Statement details for vouching */}
                        <div className="space-y-3 py-2 px-3 bg-slate-50 rounded-md border border-slate-200">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">Vouch</TableHead>
                                        <TableHead>Bank Name</TableHead>
                                        <TableHead>Account Number</TableHead>
                                        <TableHead>Period</TableHead>
                                        <TableHead>Closing Balance</TableHead>
                                        <TableHead>Notes</TableHead>
                                        <TableHead className="w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {group.statements.map((st, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={vouchingChecked[st.file.name] || false}
                                                    onCheckedChange={(checked) => {
                                                        setVouchingChecked(prev => ({
                                                            ...prev,
                                                            [st.file.name]: !!checked
                                                        }));
                                                        // Update the uploadItems with vouched status
                                                        setUploadItems(items => {
                                                            return items.map(item => {
                                                                if (item === st) {
                                                                    return {
                                                                        ...item,
                                                                        isVouched: !!checked,
                                                                        status: checked ? 'vouched' : 'uploaded'
                                                                    };
                                                                }
                                                                return item;
                                                            });
                                                        });
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>{st.matchedBank?.bank_name}</TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {st.matchedBank?.account_number}
                                            </TableCell>
                                            <TableCell>
                                                {st.extractedData?.statement_period ||
                                                    'Not available'}
                                            </TableCell>
                                            <TableCell>
                                                {st.extractedData?.closing_balance?.toLocaleString() || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    placeholder="Add notes..."
                                                    value={vouchingNotes[st.file.name] || ''}
                                                    onChange={(e) => setVouchingNotes(prev => ({
                                                        ...prev,
                                                        [st.file.name]: e.target.value
                                                    }))}
                                                    className="h-8"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setCurrentProcessingItem(st);
                                                        setShowExtractionDialog(true);
                                                    }}
                                                    className="h-8 px-2"
                                                >
                                                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ))}

                <div className="flex justify-end pt-2">
                    <Button
                        variant={group.isVouched ? "outline" : "default"}
                        onClick={() => markCompanyVouched(group.companyId, !group.isVouched)}
                        className={group.isVouched ? "" : "bg-purple-600 hover:bg-purple-700"}
                    >
                        {group.isVouched ? (
                            <>Unmark as Vouched</>
                        ) : (
                            <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark All as Vouched
                            </>
                        )}
                    </Button>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}