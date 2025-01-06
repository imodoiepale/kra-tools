import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, RefreshCw, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import BulkDownloadDialog from './BulkDownloadDialog';

interface SummaryViewProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    visibleColumns: { StatutoryDocs: boolean; PayrollDocs: boolean; PaymentLists: boolean; };
    setVisibleColumns: (columns: any) => void;
    latestReports: any[];
    isLoading: boolean;
    fetchReports: () => void;
    sortConfig: { key: string; direction: string; };
    renderTableHeader: (showPeriod: boolean) => JSX.Element;
    renderTableRow: (report: any, index: number, showPeriod: boolean) => JSX.Element;
    exportToExcel: (reports: any[]) => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({
    searchTerm,
    setSearchTerm,
    visibleColumns,
    setVisibleColumns,
    latestReports,
    isLoading,
    fetchReports,
    sortConfig,
    renderTableHeader,
    renderTableRow,
    exportToExcel
}) => {
    const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);
    const currentMonthYear = new Date('2025-01-06T15:21:41+03:00').toLocaleString('default', { month: 'long', year: 'numeric' });
    const [selectedDocs, setSelectedDocs] = useState({
        PAYE_PDF: false,
        NSSF_PDF: false,
        NHIF_PDF: false,
        SHIF_PDF: false,
        Housing_Levy_PDF: false,
        NITA_PDF: false,
        PAYE_CSV: false,
        Housing_Levy_CSV: false,
        NSSF_Excel: false,
        NHIF_Excel: false,
        SHIF_Excel: false,
        Payroll_Summary_PDF: false,
        Payroll_Summary_Excel: false,
        Payroll_Recon: false,
        Control_Total: false,
        Payslips: false,
        Bank_List: false,
        Cash_List: false,
        MPESA_List: false
    });

    const handleBulkDownload = async () => {
        try {
            const response = await fetch('/api/bulkDownload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ selectedDocs }),
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            // Get the blob from the response
            const blob = await response.blob();

            // Create a download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bulk_download_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();

            // Cleanup
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading files:', error);
            // You might want to show an error message to the user here
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-[300px]"
                    />
                </div>
                <div className="text-center font-bold text-lg">
                    {currentMonthYear}
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" onClick={() => exportToExcel(latestReports)}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                    <Button variant="outline" onClick={() => setBulkDownloadOpen(true)}>
                        <Download className="mr-2 h-4 w-4" />
                        Bulk Download
                    </Button>
                    <Button variant="outline" onClick={fetchReports}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <MoreHorizontal className="mr-2 h-4 w-4" />
                                Sections
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuCheckboxItem
                                checked={visibleColumns.StatutoryDocs}
                                onCheckedChange={(checked) =>
                                    setVisibleColumns(prev => ({ ...prev, StatutoryDocs: checked }))
                                }
                            >
                                Statutory Documents
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={visibleColumns.PayrollDocs}
                                onCheckedChange={(checked) =>
                                    setVisibleColumns(prev => ({ ...prev, PayrollDocs: checked }))
                                }
                            >
                                Payroll Documents
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={visibleColumns.PaymentLists}
                                onCheckedChange={(checked) =>
                                    setVisibleColumns(prev => ({ ...prev, PaymentLists: checked }))
                                }
                            >
                                Payment Lists
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="rounded-md border">
                <ScrollArea className="h-[calc(100vh-300px)]">
                    <Table>
                        <TableHeader>
                            {renderTableHeader(false)}
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={20} className="text-center">
                                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                                    </TableCell>
                                </TableRow>
                            ) : latestReports.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={20} className="text-center">
                                        No reports found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                latestReports
                                    .sort((a, b) => {
                                        if (sortConfig.key === 'CompanyName') {
                                            return sortConfig.direction === 'asc'
                                                ? a.CompanyName.localeCompare(b.CompanyName)
                                                : b.CompanyName.localeCompare(a.CompanyName);
                                        }
                                        return 0;
                                    })
                                    .map((report, index) => renderTableRow(report, index, false))
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>

            <BulkDownloadDialog
                open={bulkDownloadOpen}
                onOpenChange={setBulkDownloadOpen}
                selectedDocs={selectedDocs}
                setSelectedDocs={setSelectedDocs}
                onDownload={handleBulkDownload}
            />
        </div>
    );
};

export default SummaryView;
