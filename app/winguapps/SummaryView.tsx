import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, RefreshCw, MoreHorizontal, ChevronRight, ChevronLeft } from 'lucide-react';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Type Definitions
interface ReportRecord {
    ID: number;
    Month: number;
    Year: number;
    CompanyID: number;
    CompanyName: string;
    PAYE_Link: string;
    NSSF_Link: string;
    NHIF_Link: string;
    SHIF_Link: string;
    Housing_Levy_Link: string;
    NITA_List: string;
    NSSF_Excel_Link: string;
    NHIF_Excel_Link: string;
    SHIF_Excel_Link: string;
    PAYE_CSV_Link: string;
    Housing_Levy_CSV_Link: string;
    Payroll_Summary_Link: string;
    Payroll_Summary_Excel_Link: string;
    Payroll_Recon_Link: string;
    Control_Total_Link: string;
    Payslips_Link: string;
    Bank_List_Link: string;
    Cash_List: string;
    MPESA_List: string;
}

interface VisibleColumns {
    StatutoryDocs: boolean;
    PayrollDocs: boolean;
    PaymentLists: boolean;
}

interface SummaryViewProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    visibleColumns: VisibleColumns;
    setVisibleColumns: (columns: VisibleColumns) => void;
    latestReports: ReportRecord[];
    isLoading: boolean;
    fetchReports: () => Promise<void>;
    renderTableHeader: (showPeriod: boolean) => JSX.Element;
    renderTableRow: (report: ReportRecord, index: number, showPeriod: boolean) => JSX.Element;
    exportToExcel: (reports: ReportRecord[]) => Promise<void>;
    setBulkDownloadOpen: (open: boolean) => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({
    searchTerm,
    setSearchTerm,
    visibleColumns,
    setVisibleColumns,
    latestReports,
    isLoading,
    fetchReports,
    renderTableHeader,
    renderTableRow,
    exportToExcel,
    setBulkDownloadOpen
}) => {
    // Get current month/year
    const currentMonthYear = new Date().toLocaleString('default', {
        month: 'long',
        year: 'numeric'
    });

    // Filter reports based on search term
    const filteredReports = React.useMemo(() => {
        return latestReports.filter(report =>
            report.CompanyName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [latestReports, searchTerm]);

    // Handle export button click
    const handleExport = async () => {
        try {
            await exportToExcel(filteredReports);
        } catch (error) {
            console.error('Export failed:', error);
            // Handle error appropriately
        }
    };

    // Handle refresh button click
    const handleRefresh = async () => {
        try {
            await fetchReports();
        } catch (error) {
            console.error('Refresh failed:', error);
            // Handle error appropriately
        }
    };

    const [viewerConfig, setViewerConfig] = useState({
    isOpen: false,
    url: '',
    title: '',
    fileType: ''
});

const openDocument = (url: string, title: string, fileType: string) => {
    setViewerConfig({
        isOpen: true,
        url,
        title,
        fileType
    });
};


    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return {
            month: now.getMonth() + 1,
            year: now.getFullYear()
        };
    });

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const handlePreviousMonth = () => {
        setSelectedDate(prev => {
            if (prev.month === 1) {
                return { month: 12, year: prev.year - 1 };
            }
            return { month: prev.month - 1, year: prev.year };
        });
    };

    const handleNextMonth = () => {
        setSelectedDate(prev => {
            if (prev.month === 12) {
                return { month: 1, year: prev.year + 1 };
            }
            return { month: prev.month + 1, year: prev.year };
        });
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
                {/* Search Box */}
                <div className="flex items-center min-w-[300px]">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search companies..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full"
                            aria-label="Search companies"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousMonth}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedDate.month}
                            onChange={(e) => setSelectedDate(prev => ({
                                ...prev,
                                month: parseInt(e.target.value)
                            }))}
                            className="text-sm border rounded px-2 py-1"
                        >
                            {monthNames.map((month, index) => (
                                <option key={month} value={index + 1}>
                                    {month}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedDate.year}
                            onChange={(e) => setSelectedDate(prev => ({
                                ...prev,
                                year: parseInt(e.target.value)
                            }))}
                            className="text-sm border rounded px-2 py-1"
                        >
                            {Array.from({ length: 5 }, (_, i) =>
                                selectedDate.year - 2 + i
                            ).map(year => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextMonth}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>


                {/* Current Month/Year */}
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {currentMonthYear}
                    </h2>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        className="bg-white hover:bg-gray-50"
                        disabled={isLoading || filteredReports.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => setBulkDownloadOpen(true)}
                        className="bg-white hover:bg-gray-50"
                        disabled={isLoading || filteredReports.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Bulk Download
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        className="bg-white hover:bg-gray-50"
                        disabled={isLoading}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="bg-white hover:bg-gray-50">
                                <MoreHorizontal className="mr-2 h-4 w-4" />
                                Sections
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuCheckboxItem
                                checked={visibleColumns.StatutoryDocs}
                                onCheckedChange={(checked) =>
                                    setVisibleColumns({ ...visibleColumns, StatutoryDocs: !!checked })
                                }
                            >
                                Statutory Documents
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={visibleColumns.PayrollDocs}
                                onCheckedChange={(checked) =>
                                    setVisibleColumns({ ...visibleColumns, PayrollDocs: !!checked })
                                }
                            >
                                Payroll Documents
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={visibleColumns.PaymentLists}
                                onCheckedChange={(checked) =>
                                    setVisibleColumns({ ...visibleColumns, PaymentLists: !!checked })
                                }
                            >
                                Payment Lists
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Table Section */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <ScrollArea className="h-[calc(100vh-280px)]">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-white">
                            {renderTableHeader(false)}
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={20} className="h-32 text-center text-gray-500">
                                        <RefreshCw className="h-8 w-8 animate-spin mx-auto" />
                                        <div className="mt-2">Loading reports...</div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredReports.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={20} className="h-32 text-center text-gray-500">
                                        <div className="text-sm">No reports found</div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredReports.map((report, index) =>
                                    renderTableRow(report, index, false)
                                )
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    );
};

export default SummaryView;