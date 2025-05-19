// components/PinCheckerDetailsReports.tsx
// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Download, RefreshCw, ArrowUpDown, Trash2Icon, Filter, Eye, EyeOff } from 'lucide-react'
import ExcelJS from 'exceljs'
import { ClientCategoryFilter } from "./ClientCategoryFilter"

interface PinCheckerDetail {
    id: number;
    company_name: string;
    income_tax_company_status: string;
    income_tax_company_effective_from: string;
    income_tax_company_effective_to: string;
    vat_status: string;
    vat_effective_from: string;
    vat_effective_to: string;
    paye_status: string;
    paye_effective_from: string;
    paye_effective_to: string;
    rent_income_mri_status: string;
    rent_income_mri_effective_from: string;
    rent_income_mri_effective_to: string;
    resident_individual_status: string;
    resident_individual_effective_from: string;
    resident_individual_effective_to: string;
    turnover_tax_status: string;
    turnover_tax_effective_from: string;
    turnover_tax_effective_to: string;
    error_message?: string;
    last_checked_at: string;
}

type SortField = keyof PinCheckerDetail | 'last_checked_date' | 'last_checked_time';
type SortOrder = 'asc' | 'desc';

export function PinCheckerDetailsReports() {
    const [details, setDetails] = useState<PinCheckerDetail[]>([])
    const [companies, setCompanies] = useState<any[]>([]);
    const [editingDetail, setEditingDetail] = useState<PinCheckerDetail | null>(null)
    const [sortField, setSortField] = useState<SortField>('company_name')
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
    const [searchTerm, setSearchTerm] = useState('')
    const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false)
    const [categoryFilters, setCategoryFilters] = useState({})
    const [showStatsRows, setShowStatsRows] = useState(true)
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        fetchReports();
        fetchCompanies();

        // Set default filter for accounting if not already initialized
        if (!initialized && Object.keys(categoryFilters).length === 0) {
            setCategoryFilters({
                'acc': { 'all': true }
            });
            setInitialized(true);
        }
    }, [initialized]);

    const fetchReports = async () => {
        const { data, error } = await supabase
            .from('PinCheckerDetails')
            .select('*')
            .order('id', { ascending: true })

        if (error) {
            console.error('Error fetching reports:', error)
        } else {
            setDetails(data || [])
        }
    }
    const fetchCompanies = async () => {
        const { data, error } = await supabase
            .from('acc_portal_company_duplicate')
            .select(`
      id,
      company_name,
      kra_pin,
      imm_client_effective_from,
      imm_client_effective_to,
      acc_client_effective_from,
      acc_client_effective_to,
      sheria_client_effective_from,
      sheria_client_effective_to,
      audit_client_effective_from,
      audit_client_effective_to
    `);

        if (error) {
            console.error('Error fetching companies:', error);
        } else {
            setCompanies(data || []);
        }
    };

    // Helper function to determine if a client date range is active
    const isClientTypeActive = (fromDate, toDate) => {
        if (!fromDate || !toDate) return false;

        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Parse dates with format handling
        const parseDate = (dateStr) => {
            // Handle different date formats
            if (dateStr.includes('/')) {
                // Format: DD/MM/YYYY
                const [day, month, year] = dateStr.split('/').map(Number);
                return new Date(year, month - 1, day);
            } else {
                // Format: YYYY-MM-DD
                return new Date(dateStr);
            }
        };

        const from = parseDate(fromDate);
        const to = parseDate(toDate);
        const current = new Date(currentDate);

        return from <= current && current <= to;
    };

    // Join details with company data
    const joinedDetails = React.useMemo(() => {
        return details.map(detail => {
            // Find matching company by name
            const matchingCompany = companies.find(
                company => company.company_name === detail.company_name
            );

            return {
                ...detail,
                companyData: matchingCompany || null,
                // Add missing PIN indicator
                pinStatus: matchingCompany && matchingCompany.kra_pin ? 'PIN available' : 'Missing PIN'
            };
        });
    }, [details, companies]);


    // Helper function to determine if a detail has active tax obligations
    const isDetailActiveByTaxStatus = (detail) => {
        const activeStatuses = ['Registered', 'Active'];

        return [
            detail.income_tax_company_status,
            detail.vat_status,
            detail.paye_status,
            detail.rent_income_mri_status,
            detail.resident_individual_status,
            detail.turnover_tax_status
        ].some(status =>
            status && activeStatuses.includes(status)
        );
    };

    // Filter joined details based on search and category filters
    const filteredDetails = React.useMemo(() => {
        if (Object.keys(categoryFilters).length === 0) {
            // If no category filters, apply search filter to joined details
            return joinedDetails.filter(detail =>
                searchTerm === '' ||
                Object.entries(detail).some(([key, value]) => {
                    if (value === null || value === undefined || key === 'companyData') {
                        return false;
                    }
                    return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
                })
            );
        }

        // Apply both category filters and search filter
        return joinedDetails.filter(detail => {
            // Apply search filter
            const matchesSearch = searchTerm === '' ||
                Object.entries(detail).some(([key, value]) => {
                    if (value === null || value === undefined || key === 'companyData') {
                        return false;
                    }
                    return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
                });

            if (!matchesSearch) return false;

            // Get company data
            const company = detail.companyData;
            if (!company) return false;

            // Determine if detail has active tax obligations
            const hasActiveTaxObligations = isDetailActiveByTaxStatus(detail);
            const status = hasActiveTaxObligations ? 'active' : 'inactive';

            // Check if the detail matches any selected category-status
            for (const [category, statusFilters] of Object.entries(categoryFilters)) {
                // Skip if no status is selected for this category
                if (!Object.values(statusFilters).some(isSelected => isSelected)) continue;

                // For 'all' category, check if any client type is active
                if (category === 'all') {
                    const anyClientTypeActive = ['acc', 'imm', 'sheria', 'audit'].some(cat =>
                        isClientTypeActive(
                            company[`${cat}_client_effective_from`],
                            company[`${cat}_client_effective_to`]
                        )
                    );

                    if (!anyClientTypeActive) continue;
                } else {
                    // For specific categories, check if that client type is active
                    const isClientActive = isClientTypeActive(
                        company[`${category}_client_effective_from`],
                        company[`${category}_client_effective_to`]
                    );

                    if (!isClientActive) continue;
                }

                // Check if the status matches any selected status
                if (statusFilters['all'] || statusFilters[status]) {
                    return true;
                }
            }

            return false;
        });
    }, [joinedDetails, categoryFilters, searchTerm]);

    // Calculate counts for display in the filter UI
    const calculateCategoryCounts = () => {
        const counts = {
            'all': { 'all': 0, 'active': 0, 'inactive': 0 },
            'acc': { 'all': 0, 'active': 0, 'inactive': 0 },
            'imm': { 'all': 0, 'active': 0, 'inactive': 0 },
            'sheria': { 'all': 0, 'active': 0, 'inactive': 0 },
            'audit': { 'all': 0, 'active': 0, 'inactive': 0 },
        };

        // Filter details based on search term only
        const searchFilteredDetails = joinedDetails.filter(detail =>
            searchTerm === '' ||
            Object.entries(detail).some(([key, value]) => {
                if (value === null || value === undefined || key === 'companyData') {
                    return false;
                }
                return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
            })
        );

        // Count all search-filtered items
        counts['all']['all'] = searchFilteredDetails.length;

        searchFilteredDetails.forEach(detail => {
            // Get the company details if available
            const company = detail.companyData;

            if (!company) {
                // If company data is not available, count as 'all' and 'inactive'
                counts['all']['inactive']++;
                return;
            }

            // Check if the detail has any active tax obligations
            const hasActiveTaxObligations = isDetailActiveByTaxStatus(detail);

            // Count for each client type category
            const categories = ['acc', 'imm', 'sheria', 'audit'];
            let hasAnyActiveClientType = false;

            categories.forEach(category => {
                const isActive = isClientTypeActive(
                    company[`${category}_client_effective_from`],
                    company[`${category}_client_effective_to`]
                );

                if (isActive) {
                    hasAnyActiveClientType = true;
                    counts[category]['all']++;
                    counts[category][hasActiveTaxObligations ? 'active' : 'inactive']++;
                }
            });

            // Update 'all' category counts if any client type is active
            if (hasAnyActiveClientType) {
                counts['all'][hasActiveTaxObligations ? 'active' : 'inactive']++;
            }
        });

        return counts;
    };

    const categoryCounts = calculateCategoryCounts();

    const handleEdit = (detail: PinCheckerDetail) => {
        setEditingDetail(detail)
    }

    const handleSave = async (updatedDetail: PinCheckerDetail) => {
        const { error } = await supabase
            .from('PinCheckerDetails')
            .update(updatedDetail)
            .eq('id', updatedDetail.id)

        if (error) {
            console.error('Error updating detail:', error)
        } else {
            setDetails(details.map(d => d.id === updatedDetail.id ? updatedDetail : d))
            setEditingDetail(null)
        }
    }

    const handleDelete = async (id: number) => {
        const { error } = await supabase
            .from('PinCheckerDetails')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Error deleting detail:', error)
        } else {
            setDetails(details.filter(d => d.id !== id))
        }
    }

    const handleDeleteAll = async () => {
        const { error } = await supabase
            .from('PinCheckerDetails')
            .delete()
            .neq('id', 0)  // This will delete all rows

        if (error) {
            console.error('Error deleting all details:', error)
        } else {
            setDetails([])
        }
    }

    const handleDownloadExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('PIN Checker Details');

        // Add headers
        worksheet.addRow([
            'Index',
            'Company Name',
            'KRA PIN',
            'Income Tax Company Status', 'Income Tax Company From', 'Income Tax Company To',
            'VAT Status', 'VAT From', 'VAT To',
            'PAYE Status', 'PAYE From', 'PAYE To',
            'Rent Income (MRI) Status', 'Rent Income (MRI) From', 'Rent Income (MRI) To',
            'Resident Individual Status', 'Resident Individual From', 'Resident Individual To',
            'Turnover Tax Status', 'Turnover Tax From', 'Turnover Tax To',
            'Error Message', 'Last Checked At'
        ]);

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF00' }
        };

        // Add data and apply styles
        details.forEach((detail, index) => {
            const row = worksheet.addRow([
                index + 1,
                detail.company_name,
                detail.income_tax_company_status, detail.income_tax_company_effective_from, detail.income_tax_company_effective_to,
                detail.vat_status, detail.vat_effective_from, detail.vat_effective_to,
                detail.paye_status, detail.paye_effective_from, detail.paye_effective_to,
                detail.rent_income_mri_status, detail.rent_income_mri_effective_from, detail.rent_income_mri_effective_to,
                detail.resident_individual_status, detail.resident_individual_effective_from, detail.resident_individual_effective_to,
                detail.turnover_tax_status, detail.turnover_tax_effective_from, detail.turnover_tax_effective_to,
                detail.error_message,
                detail.last_checked_at
            ]);

            // Make indexing bold and centered
            const indexCell = row.getCell(1);
            indexCell.font = { bold: true };
            indexCell.alignment = { vertical: 'middle', horizontal: 'center' };

            // Apply background colors
            const colors = {
                income_tax_company: 'FFE6F2FF',
                vat: 'FFE6FFE6',
                paye: 'FFFFF2E6',
                rent_income: 'FFF2E6FF',
                resident_individual: 'FFFFE6F2'
            };

            ['income_tax_company', 'vat', 'paye', 'rent_income', 'resident_individual'].forEach((type, typeIndex) => {
                for (let i = 0; i < 3; i++) {
                    const cell = row.getCell(typeIndex * 3 + 3 + i);
                    const status = cell.value?.toString().toLowerCase();
                    if (!status) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFCCCB' }
                        };
                    } else if (status === 'no obligation') {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFCCCB' }
                        };
                    } else if (status === 'cancelled') {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFFF00' }
                        };
                    } else {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: colors[type] }
                        };
                    }
                }
            });

            // Add borders
            row.eachCell({ includeEmpty: true }, cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const cellLength = cell.value ? cell.value.toString().length : 10;
                if (cellLength > maxLength) {
                    maxLength = cellLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength;
        });

        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = 'pin_checker_details.xlsx';
        link.click();
    }

    const getCellColor = (obligationType: string) => {
        switch (obligationType) {
            case 'income_tax_company':
                return 'bg-blue-100';
            case 'vat':
                return 'bg-green-100';
            case 'paye':
                return 'bg-yellow-100';
            case 'rent_income_mri':
                return 'bg-purple-100';
            case 'resident_individual':
                return 'bg-pink-100';
            case 'turnover_tax':
                return 'bg-orange-100';
            default:
                return '';
        }
    }

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        
        // Try parsing the date
        const date = new Date(dateString);
        
        // Check if the date is valid
        if (isNaN(date.getTime())) {
            // If parsing fails, try to handle common formats
            const parts = dateString.split(/[-/.]/);
            if (parts.length === 3) {
                // Assume yyyy-mm-dd, dd-mm-yyyy, or mm-dd-yyyy
                const [a, b, c] = parts;
                if (a.length === 4) {
                    // yyyy-mm-dd
                    date.setFullYear(parseInt(a), parseInt(b) - 1, parseInt(c));
                } else if (c.length === 4) {
                    // dd-mm-yyyy or mm-dd-yyyy
                    date.setFullYear(parseInt(c), parseInt(b) - 1, parseInt(a));
                }
            } else {
                // If we can't parse it, return the original string
                return dateString;
            }
        }
        
        // Format the date
        const day = date.getDate().toString().padStart(2, '0');
        // const month = date.toLocaleString('en-GB', { month: 'short' });
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}.${month}.${year}`;
    }



    const sortedDetails = React.useMemo(() => {
        return [...filteredDetails].sort((a, b) => {
            let aValue: any = a[sortField as keyof PinCheckerDetail];
            let bValue: any = b[sortField as keyof PinCheckerDetail];

            // Handle special cases for last_checked_date and last_checked_time
            if (sortField === 'last_checked_date') {
                aValue = new Date(a.last_checked_at).toLocaleDateString();
                bValue = new Date(b.last_checked_at).toLocaleDateString();
            } else if (sortField === 'last_checked_time') {
                aValue = new Date(a.last_checked_at).toLocaleTimeString();
                bValue = new Date(b.last_checked_at).toLocaleTimeString();
            } else if (sortField.endsWith('_status')) {
                // For status fields, use a custom sorting order
                const statusOrder = ['Registered', 'Active', 'Suspended', 'Cancelled', 'No Obligation'];
                aValue = statusOrder.indexOf(aValue || 'No Obligation');
                bValue = statusOrder.indexOf(bValue || 'No Obligation');
            } else if (sortField.endsWith('_from') || sortField.endsWith('_to')) {
                // For date fields, convert to Date objects for comparison
                aValue = aValue ? new Date(aValue) : new Date(0);
                bValue = bValue ? new Date(bValue) : new Date(0);
            }

            // Perform the comparison
            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredDetails, sortField, sortOrder]);


    // Calculate statistics for complete and missing entries
    const calculateStats = () => {
        const stats = {
            complete: {},
            missing: {}
        };

        // Define all fields to check for completeness, including sub-columns
        const fieldsToCheck = [
            'company_name',
            // Income Tax Company fields
            'income_tax_company_status',
            'income_tax_company_effective_from',
            'income_tax_company_effective_to',
            // VAT fields
            'vat_status',
            'vat_effective_from',
            'vat_effective_to',
            // PAYE fields
            'paye_status',
            'paye_effective_from',
            'paye_effective_to',
            // Rent Income (MRI) fields
            'rent_income_mri_status',
            'rent_income_mri_effective_from',
            'rent_income_mri_effective_to',
            // Resident Individual fields
            'resident_individual_status',
            'resident_individual_effective_from',
            'resident_individual_effective_to',
            // Turnover Tax fields
            'turnover_tax_status',
            'turnover_tax_effective_from',
            'turnover_tax_effective_to'
        ];

        // Initialize stats for each field
        fieldsToCheck.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        // Calculate stats for each field individually
        sortedDetails.forEach(detail => {
            fieldsToCheck.forEach(field => {
                const value = detail[field as keyof PinCheckerDetail];
                // For status fields, 'No Obligation' is considered missing
                if (field.endsWith('_status')) {
                    if (value && 
                        value.toString().trim() !== '' && 
                        value.toString().toLowerCase() !== 'no obligation') {
                        stats.complete[field]++;
                    } else {
                        stats.missing[field]++;
                    }
                } 
                // For date fields
                else if (field.endsWith('_from') || field.endsWith('_to')) {
                    if (value && value.toString().trim() !== '') {
                        stats.complete[field]++;
                    } else {
                        stats.missing[field]++;
                    }
                }
                // For other fields
                else {
                    if (value && value.toString().trim() !== '') {
                        stats.complete[field]++;
                    } else {
                        stats.missing[field]++;
                    }
                }
            });
        });

        return stats;
    };

    const stats = calculateStats();

    const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
        <Button variant="ghost" onClick={() => handleSort(field)} className="h-8 px-2">
            {children}
            <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
    );


    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">PIN Checker Details Reports</h3>
                <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={fetchReports}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Excel
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDeleteAll}>Delete All</Button>
                </div>
            </div>
            <div className="flex space-x-2">
                <Input
                    placeholder="Search details..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
                <Button variant="outline" onClick={() => setIsCategoryFilterOpen(true)} size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Categories
                </Button>
                <Button 
                    variant="outline" 
                    onClick={() => setShowStatsRows(!showStatsRows)} 
                    size="sm"
                >
                    {showStatsRows ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {showStatsRows ? 'Hide Stats' : 'Show Stats'}
                </Button>
            </div>
            
            <ClientCategoryFilter
                isOpen={isCategoryFilterOpen}
                onClose={() => setIsCategoryFilterOpen(false)}
                onApplyFilters={(filters) => setCategoryFilters(filters)}
                onClearFilters={() => setCategoryFilters({})}
                selectedFilters={categoryFilters}
                counts={categoryCounts}
            />

            <div className="rounded-md border">
                <div className="overflow-x-auto">
                    <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                        <Table className="text-xs pb-2">
                            <TableHeader>
                                <TableRow className="h-8">
                                    <TableHead className="sticky top-0 bg-white border-r border-black border-b font-bold text-black text-center">Index</TableHead>
                                    <TableHead className="sticky top-0 bg-white border-r border-black border-b font-bold text-black">
                                        <SortableHeader field="company_name">Company Name</SortableHeader>
                                    </TableHead>
                                    <TableHead className="sticky top-0 bg-white border-r border-black border-b font-bold text-black">
                                        <SortableHeader field="company_name">KRA PIN</SortableHeader>
                                    </TableHead>
                                    {['Income Tax Company', 'VAT', 'PAYE', 'Rent Income (MRI)', 'Resident Individual', 'Turnover Tax'].map((header, index) => (
                                        <TableHead key={index} className={`sticky top-0 ${getCellColor(header.toLowerCase().replace(' ', '_'))} border-r border-black border-b text-center font-bold text-black`} colSpan={3}>{header}</TableHead>
                                    ))}
                                    <TableHead className="sticky top-0 bg-white border-r border-black border-b font-bold text-black text-center" colSpan={2}>Last Checked</TableHead>
                                    <TableHead className="sticky top-0 bg-white border-b font-bold text-black text-center">Actions</TableHead>
                                </TableRow>
                                {showStatsRows && (
                                    <>
                                        <TableRow className="h-6 bg-blue-50">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-black">Complete</TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-black">
                                                <span className={stats.complete.company_name === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.company_name}
                                                </span>
                                            </TableCell>
                                            
                                            {/* Income Tax Company */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('income_tax_company')}`}>
                                                <span className={stats.complete.income_tax_company_status === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.income_tax_company_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('income_tax_company')}`}>
                                                <span className={stats.complete.income_tax_company_effective_from === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.income_tax_company_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('income_tax_company')}`}>
                                                <span className={stats.complete.income_tax_company_effective_to === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.income_tax_company_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            {/* VAT */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('vat')}`}>
                                                <span className={stats.complete.vat_status === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.vat_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('vat')}`}>
                                                <span className={stats.complete.vat_effective_from === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.vat_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('vat')}`}>
                                                <span className={stats.complete.vat_effective_to === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.vat_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            {/* PAYE */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('paye')}`}>
                                                <span className={stats.complete.paye_status === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.paye_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('paye')}`}>
                                                <span className={stats.complete.paye_effective_from === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.paye_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('paye')}`}>
                                                <span className={stats.complete.paye_effective_to === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.paye_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            {/* Rent Income (MRI) */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('rent_income_mri')}`}>
                                                <span className={stats.complete.rent_income_mri_status === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.rent_income_mri_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('rent_income_mri')}`}>
                                                <span className={stats.complete.rent_income_mri_effective_from === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.rent_income_mri_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('rent_income_mri')}`}>
                                                <span className={stats.complete.rent_income_mri_effective_to === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.rent_income_mri_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            {/* Resident Individual */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('resident_individual')}`}>
                                                <span className={stats.complete.resident_individual_status === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.resident_individual_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('resident_individual')}`}>
                                                <span className={stats.complete.resident_individual_effective_from === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.resident_individual_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('resident_individual')}`}>
                                                <span className={stats.complete.resident_individual_effective_to === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.resident_individual_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            {/* Turnover Tax */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('turnover_tax')}`}>
                                                <span className={stats.complete.turnover_tax_status === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.turnover_tax_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('turnover_tax')}`}>
                                                <span className={stats.complete.turnover_tax_effective_from === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.turnover_tax_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('turnover_tax')}`}>
                                                <span className={stats.complete.turnover_tax_effective_to === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.turnover_tax_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            <TableCell colSpan={2} className="border-r border-black"></TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                        <TableRow className="h-6 bg-red-50">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-black">Missing</TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-black">
                                                <span className={stats.missing.company_name > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.company_name}
                                                </span>
                                            </TableCell>
                                            
                                            {/* Income Tax Company */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('income_tax_company')}`}>
                                                <span className={stats.missing.income_tax_company_status > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.income_tax_company_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('income_tax_company')}`}>
                                                <span className={stats.missing.income_tax_company_effective_from > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.income_tax_company_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('income_tax_company')}`}>
                                                <span className={stats.missing.income_tax_company_effective_to > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.income_tax_company_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            {/* VAT */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('vat')}`}>
                                                <span className={stats.missing.vat_status > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.vat_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('vat')}`}>
                                                <span className={stats.missing.vat_effective_from > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.vat_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('vat')}`}>
                                                <span className={stats.missing.vat_effective_to > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.vat_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            {/* PAYE */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('paye')}`}>
                                                <span className={stats.missing.paye_status > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.paye_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('paye')}`}>
                                                <span className={stats.missing.paye_effective_from > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.paye_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('paye')}`}>
                                                <span className={stats.missing.paye_effective_to > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.paye_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            {/* Rent Income (MRI) */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('rent_income_mri')}`}>
                                                <span className={stats.missing.rent_income_mri_status > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.rent_income_mri_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('rent_income_mri')}`}>
                                                <span className={stats.missing.rent_income_mri_effective_from > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.rent_income_mri_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('rent_income_mri')}`}>
                                                <span className={stats.missing.rent_income_mri_effective_to > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.rent_income_mri_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            {/* Resident Individual */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('resident_individual')}`}>
                                                <span className={stats.missing.resident_individual_status > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.resident_individual_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('resident_individual')}`}>
                                                <span className={stats.missing.resident_individual_effective_from > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.resident_individual_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('resident_individual')}`}>
                                                <span className={stats.missing.resident_individual_effective_to > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.resident_individual_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            {/* Turnover Tax */}
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('turnover_tax')}`}>
                                                <span className={stats.missing.turnover_tax_status > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.turnover_tax_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('turnover_tax')}`}>
                                                <span className={stats.missing.turnover_tax_effective_from > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.turnover_tax_effective_from}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-center text-[10px] border-r border-black ${getCellColor('turnover_tax')}`}>
                                                <span className={stats.missing.turnover_tax_effective_to > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.turnover_tax_effective_to}
                                                </span>
                                            </TableCell>
                                            
                                            <TableCell colSpan={2} className="border-r border-black"></TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    </>
                                )}
                                <TableRow className="h-8">
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b"></TableHead>
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b"></TableHead>
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b"></TableHead>
                                    {['Income Tax Company', 'VAT', 'PAYE', 'Rent Income (MRI)', 'Resident Individual', 'Turnover Tax'].flatMap((header) => (
                                        ['Status', 'From', 'To'].map((subHeader, index) => {
                                            const field = `${header.toLowerCase().replace(' ', '_')}_${subHeader.toLowerCase()}` as SortField;
                                            return (
                                                <TableHead key={`${header}-${subHeader}`} className={`sticky top-8 ${getCellColor(header.toLowerCase().replace(' ', '_'))} border-r border-black border-b text-black text-center`}>
                                                    <SortableHeader field={field}>{subHeader}</SortableHeader>
                                                </TableHead>
                                            );
                                        })
                                    ))}
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b">
                                        <SortableHeader field="last_checked_date">Date</SortableHeader>
                                    </TableHead>
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b">
                                        <SortableHeader field="last_checked_time">Time</SortableHeader>
                                    </TableHead>
                                    <TableHead className="sticky top-8 bg-white border-b"></TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {sortedDetails.map((detail, index) => (
                                    <TableRow key={detail.id} className="h-6">
                                        <TableCell className="border-r border-black font-bold text-black text-center">{index + 1}</TableCell>
                                        <TableCell className="border-r border-black">{detail.company_name}</TableCell>
                                        <TableCell className="border-r border-black">
                                            {detail.pinStatus === 'Missing PIN' ? (
                                                <span className="text-red-600 font-semibold">Missing PIN</span>
                                            ) : (
                                                <span>{detail.companyData?.kra_pin || detail.company_name}</span>
                                            )}
                                        </TableCell>
                                        {['income_tax_company', 'vat', 'paye', 'rent_income_mri', 'resident_individual', 'turnover_tax'].map((type) => (
                                            <React.Fragment key={type}>
                                                <TableCell className={`${getCellColor(type)} border-l border-r border-black ${!detail[`${type}_status` as keyof PinCheckerDetail] || detail[`${type}_status` as keyof PinCheckerDetail]?.toLowerCase() === 'no obligation' ? 'font-bold text-red-600 bg-red-100' : ''} text-center`}>
                                                    {!detail[`${type}_status` as keyof PinCheckerDetail] ? (
                                                        <span className="font-bold text-red-600">No Obligation</span>
                                                    ) : detail[`${type}_status` as keyof PinCheckerDetail]?.toLowerCase() === 'cancelled' ? (
                                                        <span className="bg-amber-500 text-amber-800 px-1 py-1 rounded-full text-xs font-semibold">
                                                            {detail[`${type}_status` as keyof PinCheckerDetail]}
                                                        </span>
                                                    ) : detail[`${type}_status` as keyof PinCheckerDetail]?.toLowerCase() === 'registered' ? (
                                                        <span className="bg-green-400 text-green-800 px-1 py-1 rounded-full text-xs font-semibold">
                                                            {detail[`${type}_status` as keyof PinCheckerDetail]}
                                                        </span>
                                                    ) : (
                                                        detail[`${type}_status` as keyof PinCheckerDetail]
                                                    )}
                                                </TableCell>
                                                <TableCell className={`${getCellColor(type)} border-r border-black text-center ${!detail[`${type}_effective_from` as keyof PinCheckerDetail] ? 'font-bold text-red-600 bg-red-100' : ''}`}>
                                                    {detail[`${type}_effective_from` as keyof PinCheckerDetail] ? formatDate(detail[`${type}_effective_from` as keyof PinCheckerDetail] as string) : <span className="font-bold text-red-600">No Obligation</span>}
                                                </TableCell>
                                                <TableCell className={`${getCellColor(type)} border-r border-black text-center ${!detail[`${type}_effective_to` as keyof PinCheckerDetail] ? 'font-bold text-red-600 bg-red-100' : ''}`}>
                                                    {detail[`${type}_effective_to` as keyof PinCheckerDetail] ? formatDate(detail[`${type}_effective_to` as keyof PinCheckerDetail] as string) : <span className="font-bold text-red-600">No Obligation</span>}
                                                </TableCell>
                                            </React.Fragment>
                                        ))}

                                        <TableCell className="border-r border-black text-center">
                                            {formatDate(detail.last_checked_at)}
                                        </TableCell>
                                        <TableCell className="border-r border-black text-center">
                                            {new Date(detail.last_checked_at).toLocaleTimeString()}
                                        </TableCell>

                                        <TableCell className="border-black">
                                            <div className="flex space-x-2">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" onClick={() => handleEdit(detail)}>Edit</Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-[425px]">
                                                        <DialogHeader>
                                                            <DialogTitle>Edit PIN Checker Detail</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="grid gap-4 py-4">
                                                            {editingDetail && Object.entries(editingDetail).map(([key, value]) => (
                                                                <div key={key} className="grid grid-cols-4 items-center gap-4">
                                                                    <Label htmlFor={key} className="text-right">
                                                                        {key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)}
                                                                    </Label>
                                                                    <Input id={key} value={value} onChange={(e) => setEditingDetail({ ...editingDetail, [key]: e.target.value })} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <DialogClose asChild>
                                                            <Button onClick={() => handleSave(editingDetail!)}>Save</Button>
                                                        </DialogClose>
                                                    </DialogContent>
                                                </Dialog>
                                                <Button variant="destructive" size="sm" onClick={() => handleDelete(detail.id)}>
                                                    <Trash2Icon className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </div>
    )
}
