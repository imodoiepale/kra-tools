// components/PinCheckerDetailsReports.tsx
// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Download, RefreshCw, ArrowUpDown, Trash2Icon, Filter, Eye, EyeOff, Calendar } from 'lucide-react'
import ExcelJS from 'exceljs'
import { ClientCategoryFilter } from "./ClientCategoryFilter"

interface PinCheckerDetail {
    id: number;
    company_name: string;
    kra_pin: string;
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
    etims_registration: string;  // Field for eTIMS Registration status
    tims_registration: string;   // Field for TIMS Registration status
    vat_compliance: string;      // Field for VAT Compliance status
    error_message?: string;
    last_checked_at: string;
}

type SortField = keyof PinCheckerDetail | 'last_checked_date' | 'last_checked_time';
type SortOrder = 'asc' | 'desc';

// Define tax types once to avoid repetition
const TAX_TYPES = [
    { id: 'income_tax_company', label: 'Income Tax Company' },
    { id: 'vat', label: 'VAT' },
    { id: 'paye', label: 'PAYE' },
    { id: 'rent_income_mri', label: 'Rent Income (MRI)' },
    { id: 'resident_individual', label: 'Resident Individual' },
    { id: 'turnover_tax', label: 'Turnover Tax' }
];

const TAX_COLUMNS = ['Status', 'From', 'To'];

// Define compliance types for the new columns
const COMPLIANCE_TYPES = [
    { id: 'etims_registration', label: 'eTIMS Registration' },
    { id: 'tims_registration', label: 'TIMS Registration' },
    { id: 'vat_compliance', label: 'VAT Compliance' }
];

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
    const [showDateColumns, setShowDateColumns] = useState(false);

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
        const headers = [
            'Index',
            'Company Name',
            'KRA PIN',
        ];

        // Add tax type headers
        TAX_TYPES.forEach(taxType => {
            headers.push(`${taxType.label} Status`, `${taxType.label} From`, `${taxType.label} To`);
        });

        // Add compliance headers
        COMPLIANCE_TYPES.forEach(compType => {
            headers.push(`${compType.label} Status`);
        });

        // Add last checked headers
        headers.push('Error Message', 'Last Checked At');

        worksheet.addRow(headers);

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF00' }
        };

        // Add data and apply styles
        details.forEach((detail, index) => {
            const rowData = [
                index + 1,
                detail.company_name,
                detail.kra_pin,
            ];

            // Add tax type data
            TAX_TYPES.forEach(taxType => {
                rowData.push(
                    detail[`${taxType.id}_status`],
                    detail[`${taxType.id}_effective_from`],
                    detail[`${taxType.id}_effective_to`]
                );
            });

            // Add compliance data
            COMPLIANCE_TYPES.forEach(compType => {
                const status = detail[`${compType.id}_status`];
                rowData.push(status || 'Not Available');
            });

            // Add last checked data
            rowData.push(detail.error_message, detail.last_checked_at);

            const row = worksheet.addRow(rowData);

            // Make indexing bold and centered
            const indexCell = row.getCell(1);
            indexCell.font = { bold: true };
            indexCell.alignment = { vertical: 'middle', horizontal: 'center' };

            // Apply background colors
            const colors = {
                income_tax_company: 'FFE6F2FF',
                vat: 'FFE6FFE6',
                paye: 'FFFFF2E6',
                rent_income_mri: 'FFF2E6FF',
                resident_individual: 'FFFFE6F2',
                turnover_tax: 'FFFFE6CC',
                etims_registration: 'FFE6FFFF',
                tims_registration: 'FFCCFFCC',
                vat_compliance: 'FFFFCCFF'
            };

            // Apply colors for tax type columns
            TAX_TYPES.forEach((taxType, typeIndex) => {
                for (let i = 0; i < 3; i++) {
                    const cellIndex = typeIndex * 3 + 3 + i;
                    const cell = row.getCell(cellIndex);
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
                    } else if (status === 'dormant') {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFCCCB' }
                        };
                    } else {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: colors[taxType.id] }
                        };
                    }
                }
            });

            // Apply colors for compliance columns
            COMPLIANCE_TYPES.forEach((compType, compIndex) => {
                const cellIndex = TAX_TYPES.length * 3 + 3 + compIndex;
                const cell = row.getCell(cellIndex);
                const status = cell.value?.toString().toLowerCase();

                if (!status) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFCCCB' }
                    };
                } else if (status === 'inactive' || status === 'non-compliant') {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFCCCB' }
                    };
                } else if (status === 'active' || status === 'compliant') {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFE6FFE6' }
                    };
                } else {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: colors[compType.id] }
                    };
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

    // Helper function to get cell color based on type
    const getCellColor = (type: string) => {
        const colorMap = {
            'income_tax_company': 'bg-blue-100',
            'vat': 'bg-green-100',
            'paye': 'bg-yellow-100',
            'rent_income_mri': 'bg-purple-100',
            'resident_individual': 'bg-pink-100',
            'turnover_tax': 'bg-orange-100',
            'etims_registration': 'bg-cyan-100',
            'tims_registration': 'bg-lime-100',
            'vat_compliance': 'bg-fuchsia-100'
        };

        return colorMap[type] || '';
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

    // Generate the fields to check for stats
    const fieldsToCheck = [
        'company_name',
        'kra_pin',
        // Generate tax field names
        ...TAX_TYPES.flatMap(taxType =>
            TAX_COLUMNS.map(col =>
                `${taxType.id}_${col.toLowerCase()}`
            )
        ),
        // Generate compliance field names
        ...COMPLIANCE_TYPES.map(compType => `${compType.id}_status`)
    ];

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
                const statusOrder = ['Registered', 'Active', 'Compliant', 'Suspended', 'Cancelled', 'Inactive', 'Non-Compliant', 'No Obligation', 'Dormant'];
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

        // Initialize stats for each field
        fieldsToCheck.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        // Calculate stats for each field individually
        sortedDetails.forEach(detail => {
            fieldsToCheck.forEach(field => {
                const value = detail[field as keyof PinCheckerDetail];
                // For status fields, 'No Obligation' or 'Inactive' is considered missing
                if (field.endsWith('_status')) {
                    if (value &&
                        value.toString().trim() !== '' &&
                        value.toString().toLowerCase() !== 'no obligation' &&
                        value.toString().toLowerCase() !== 'inactive' &&
                        value.toString().toLowerCase() !== 'non-compliant') {
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

    // Helper function to render status cell with proper styling
    const renderStatusCell = (detail: any, typeId: string) => {
        const status = detail[`${typeId}_status`];
        const isComplianceType = ['etims_registration', 'tims_registration', 'vat_compliance'].includes(typeId);

        if (!status) {
            return isComplianceType
                ? <span className="font-bold text-gray-600">Not Available</span>
                : <span className="font-bold text-red-600">No Obligation</span>;
        }

        if (status.toLowerCase() === 'cancelled') {
            return (
                <span className="bg-amber-500 text-amber-800 px-1 py-1 rounded-full text-xs font-semibold">
                    {status}
                </span>
            );
        }

        if (status.toLowerCase() === 'dormant') {
            return (
                <span className="bg-red-500 text-red-800 px-1 py-1 rounded-full text-xs font-semibold">
                    {status}
                </span>
            );
        }

        if (status.toLowerCase() === 'registered' || status.toLowerCase() === 'active' || status.toLowerCase() === 'compliant') {
            return (
                <span className="bg-green-400 text-green-800 px-1 py-1 rounded-full text-xs font-semibold">
                    {status}
                </span>
            );
        }

        if (status.toLowerCase() === 'inactive' || status.toLowerCase() === 'non-compliant') {
            return (
                <span className="bg-red-400 text-red-800 px-1 py-1 rounded-full text-xs font-semibold">
                    {status}
                </span>
            );
        }

        return status;
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                {/* <h3 className="text-lg font-medium">PIN Checker Details Reports</h3> */}
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
                    <Button
                        variant="outline"
                        onClick={() => setShowDateColumns(!showDateColumns)}
                        size="sm"
                    >
                        <Calendar className="h-4 w-4 mr-2" />
                        {showDateColumns ? 'Hide Dates' : 'Show Dates'}
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


            <div className="rounded-md border">
                <div className="overflow-x-auto">
                    <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                        <Table className="text-xs pb-2">
                            <TableHeader>
                                <TableRow className="h-8">
                                    <TableHead className="sticky top-0 bg-white border-r border-black border-b font-bold text-black text-center">Index</TableHead>
                                    <TableHead className="sticky top-0 bg-white border-r border-black border-b font-bold text-black">
                                        <SortableHeader field="company_name">Company Name</SortableHeader>
                                    </TableHead>
                                    <TableHead className="sticky top-0 bg-white border-r border-black border-b font-bold text-black">
                                        <SortableHeader field="kra_pin">KRA PIN</SortableHeader>
                                    </TableHead>

                                    {/* Map tax type headers - adjust colspan based on showDateColumns */}
                                    {TAX_TYPES.map(taxType => (
                                        <TableHead
                                            key={taxType.id}
                                            className={`sticky top-0 ${getCellColor(taxType.id)} border-r border-black border-b text-center font-bold text-black`}
                                            colSpan={showDateColumns ? 3 : 1}
                                        >
                                            {taxType.label}
                                        </TableHead>
                                    ))}

                                    {/* Map compliance type headers */}
                                    {COMPLIANCE_TYPES.map(compType => (
                                        <TableHead
                                            key={compType.id}
                                            className={`sticky top-0 ${getCellColor(compType.id)} border-r border-black border-b text-center font-bold text-black`}
                                        >
                                            {compType.label}
                                        </TableHead>
                                    ))}

                                    <TableHead className="sticky top-0 bg-white border-r border-black border-b font-bold text-black text-center" colSpan={2}>Last Checked</TableHead>
                                    <TableHead className="sticky top-0 bg-white border-b font-bold text-black text-center">Actions</TableHead>
                                </TableRow>

                                {showStatsRows && (
                                    <>
                                        {/* Complete Stats Row - conditionally show date columns */}
                                        <TableRow className="h-6 bg-blue-50">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-black">Complete</TableCell>

                                            {/* Company Name stats */}
                                            <TableCell className="text-center text-[10px] border-r border-black">
                                                <span className={stats.complete.company_name === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.company_name}
                                                </span>
                                            </TableCell>

                                            {/* KRA PIN stats */}
                                            <TableCell className="text-center text-[10px] border-r border-black">
                                                <span className={stats.complete.kra_pin === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.kra_pin}
                                                </span>
                                            </TableCell>

                                            {/* Map tax type stats cells - conditionally show date columns */}
                                            {TAX_TYPES.flatMap(taxType => {
                                                const statusField = `${taxType.id}_status`;
                                                const cells = [
                                                    // Status cell is always shown
                                                    <TableCell
                                                        key={`${taxType.id}-status-complete`}
                                                        className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}
                                                    >
                                                        <span className={stats.complete[statusField] === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                            {stats.complete[statusField]}
                                                        </span>
                                                    </TableCell>
                                                ];

                                                // From and To cells conditionally shown
                                                if (showDateColumns) {
                                                    const fromField = `${taxType.id}_effective_from`;
                                                    const toField = `${taxType.id}_effective_to`;

                                                    cells.push(
                                                        <TableCell
                                                            key={`${taxType.id}-from-complete`}
                                                            className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}
                                                        >
                                                            <span className={stats.complete[fromField] === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                                {stats.complete[fromField]}
                                                            </span>
                                                        </TableCell>,
                                                        <TableCell
                                                            key={`${taxType.id}-to-complete`}
                                                            className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}
                                                        >
                                                            <span className={stats.complete[toField] === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                                {stats.complete[toField]}
                                                            </span>
                                                        </TableCell>
                                                    );
                                                }

                                                return cells;
                                            })}

                                            {/* Map compliance type stats cells */}
                                            {COMPLIANCE_TYPES.map(compType => {
                                                const fieldName = `${compType.id}_status`;
                                                return (
                                                    <TableCell
                                                        key={`${compType.id}-complete`}
                                                        className={`text-center text-[10px] border-r border-black ${getCellColor(compType.id)}`}
                                                    >
                                                        <span className={stats.complete[fieldName] === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                            {stats.complete[fieldName]}
                                                        </span>
                                                    </TableCell>
                                                );
                                            })}

                                            <TableCell colSpan={2} className="border-r border-black"></TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>

                                        {/* Missing Stats Row - conditionally show date columns */}
                                        <TableRow className="h-6 bg-red-50">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-black">Missing</TableCell>

                                            {/* Company Name stats */}
                                            <TableCell className="text-center text-[10px] border-r border-black">
                                                <span className={stats.missing.company_name > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.company_name}
                                                </span>
                                            </TableCell>

                                            {/* KRA PIN stats */}
                                            <TableCell className="text-center text-[10px] border-r border-black">
                                                <span className={stats.missing.kra_pin > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.kra_pin}
                                                </span>
                                            </TableCell>

                                            {/* Map tax type stats cells - conditionally show date columns */}
                                            {TAX_TYPES.flatMap(taxType => {
                                                const statusField = `${taxType.id}_status`;
                                                const cells = [
                                                    // Status cell is always shown
                                                    <TableCell
                                                        key={`${taxType.id}-status-missing`}
                                                        className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}
                                                    >
                                                        <span className={stats.missing[statusField] > 0 ? 'text-red-600 font-bold' : ''}>
                                                            {stats.missing[statusField]}
                                                        </span>
                                                    </TableCell>
                                                ];

                                                // From and To cells conditionally shown
                                                if (showDateColumns) {
                                                    const fromField = `${taxType.id}_effective_from`;
                                                    const toField = `${taxType.id}_effective_to`;

                                                    cells.push(
                                                        <TableCell
                                                            key={`${taxType.id}-from-missing`}
                                                            className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}
                                                        >
                                                            <span className={stats.missing[fromField] > 0 ? 'text-red-600 font-bold' : ''}>
                                                                {stats.missing[fromField]}
                                                            </span>
                                                        </TableCell>,
                                                        <TableCell
                                                            key={`${taxType.id}-to-missing`}
                                                            className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}
                                                        >
                                                            <span className={stats.missing[toField] > 0 ? 'text-red-600 font-bold' : ''}>
                                                                {stats.missing[toField]}
                                                            </span>
                                                        </TableCell>
                                                    );
                                                }

                                                return cells;
                                            })}

                                            {/* Map compliance type stats cells */}
                                            {COMPLIANCE_TYPES.map(compType => {
                                                const fieldName = `${compType.id}_status`;
                                                return (
                                                    <TableCell
                                                        key={`${compType.id}-missing`}
                                                        className={`text-center text-[10px] border-r border-black ${getCellColor(compType.id)}`}
                                                    >
                                                        <span className={stats.missing[fieldName] > 0 ? 'text-red-600 font-bold' : ''}>
                                                            {stats.missing[fieldName]}
                                                        </span>
                                                    </TableCell>
                                                );
                                            })}

                                            <TableCell colSpan={2} className="border-r border-black"></TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    </>
                                )}

                                {/* Column sub-headers */}
                                <TableRow className="h-8">
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b"></TableHead>
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b"></TableHead>
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b"></TableHead>

                                    {/* Tax type sub-headers - conditionally show date columns */}
                                    {TAX_TYPES.flatMap(taxType => {
                                        // Status column is always shown
                                        const headers = [
                                            <TableHead
                                                key={`${taxType.id}-status`}
                                                className={`sticky top-8 ${getCellColor(taxType.id)} border-r border-black border-b text-black text-center`}
                                            >
                                                <SortableHeader field={`${taxType.id}_status` as SortField}>Status</SortableHeader>
                                            </TableHead>
                                        ];

                                        // From and To columns conditionally shown
                                        if (showDateColumns) {
                                            headers.push(
                                                <TableHead
                                                    key={`${taxType.id}-from`}
                                                    className={`sticky top-8 ${getCellColor(taxType.id)} border-r border-black border-b text-black text-center`}
                                                >
                                                    <SortableHeader field={`${taxType.id}_effective_from` as SortField}>From</SortableHeader>
                                                </TableHead>,
                                                <TableHead
                                                    key={`${taxType.id}-to`}
                                                    className={`sticky top-8 ${getCellColor(taxType.id)} border-r border-black border-b text-black text-center`}
                                                >
                                                    <SortableHeader field={`${taxType.id}_effective_to` as SortField}>To</SortableHeader>
                                                </TableHead>
                                            );
                                        }

                                        return headers;
                                    })}

                                    {/* Compliance type sub-headers */}
                                    {COMPLIANCE_TYPES.map(compType => {
                                        const field = `${compType.id}_status` as SortField;
                                        return (
                                            <TableHead
                                                key={`${compType.id}-status`}
                                                className={`sticky top-8 ${getCellColor(compType.id)} border-r border-black border-b text-black text-center`}
                                            >
                                                <SortableHeader field={field}>Status</SortableHeader>
                                            </TableHead>
                                        );
                                    })}

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
                                                <span>{detail.companyData?.kra_pin || detail.kra_pin}</span>
                                            )}
                                        </TableCell>

                                        {/* Tax type cells - conditionally show date columns */}
                                        {TAX_TYPES.flatMap(taxType => {
                                            // Status cell is always shown
                                            const cells = [
                                                <TableCell
                                                    key={`${taxType.id}-status-${detail.id}`}
                                                    className={`${getCellColor(taxType.id)} border-l border-r border-black 
                                                        ${!detail[`${taxType.id}_status`] || detail[`${taxType.id}_status`]?.toLowerCase() === 'no obligation'
                                                            ? 'font-bold text-red-600 bg-red-100' : ''} text-center`}
                                                >
                                                    {renderStatusCell(detail, taxType.id)}
                                                </TableCell>
                                            ];

                                            // From and To cells conditionally shown
                                            if (showDateColumns) {
                                                cells.push(
                                                    <TableCell
                                                        key={`${taxType.id}-from-${detail.id}`}
                                                        className={`${getCellColor(taxType.id)} border-r border-black text-center 
                                                            ${!detail[`${taxType.id}_effective_from`] ? 'font-bold text-red-600 bg-red-100' : ''}`}
                                                    >
                                                        {detail[`${taxType.id}_effective_from`]
                                                            ? formatDate(detail[`${taxType.id}_effective_from`])
                                                            : <span className="font-bold text-red-600">No Obligation</span>}
                                                    </TableCell>,
                                                    <TableCell
                                                        key={`${taxType.id}-to-${detail.id}`}
                                                        className={`${getCellColor(taxType.id)} border-r border-black text-center 
                                                            ${!detail[`${taxType.id}_effective_to`] ? 'font-bold text-red-600 bg-red-100' : ''}`}
                                                    >
                                                        {detail[`${taxType.id}_effective_to`]
                                                            ? formatDate(detail[`${taxType.id}_effective_to`])
                                                            : <span className="font-bold text-red-600">No Obligation</span>}
                                                    </TableCell>
                                                );
                                            }

                                            return cells;
                                        })}

                                        {/* Compliance type cells */}
                                        {COMPLIANCE_TYPES.map(compType => (
                                            <TableCell
                                                key={compType.id}
                                                className={`${getCellColor(compType.id)} border-r border-black text-center 
            ${!detail[`${compType.id}_status`]
                                                        ? 'font-bold text-gray-600 bg-gray-100'
                                                        : (detail[`${compType.id}_status`]?.toLowerCase() === 'inactive' ||
                                                            detail[`${compType.id}_status`]?.toLowerCase() === 'non-compliant'
                                                            ? 'font-bold text-red-600 bg-red-100'
                                                            : '')}`}
                                            >
                                                {renderStatusCell(detail, compType.id)}
                                            </TableCell>
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
                                                        <Button variant="outline" size="sm" onClick={() => handleEdit(detail)}>
                                                            View
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-5xl p-6 bg-white rounded-lg shadow-lg">
                                                        <DialogHeader className="pb-4 border-b">
                                                            <DialogTitle className="text-xl font-semibold text-gray-800">
                                                                Company Details: {editingDetail?.company_name}
                                                            </DialogTitle>
                                                        </DialogHeader>

                                                        {editingDetail && (
                                                            <div className="py-2 overflow-y-auto max-h-[calc(100vh-200px)]">
                                                                {/* Company Information Section */}
                                                                <div className="mb-6">
                                                                    <div className="grid grid-cols-3 gap-4">
                                                                        <div className="space-y-1">
                                                                            <p className="text-sm font-medium text-gray-500">Company Name</p>
                                                                            <p className="bg-gray-50 p-2 rounded-md">{editingDetail.company_name}</p>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <p className="text-sm font-medium text-gray-500">KRA PIN</p>
                                                                            <p className="bg-gray-50 p-2 rounded-md">{editingDetail.kra_pin || 'Not Available'}</p>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <p className="text-sm font-medium text-gray-500">Last Checked</p>
                                                                            <p className="bg-gray-50 p-2 rounded-md">{formatDate(editingDetail.last_checked_at)} {new Date(editingDetail.last_checked_at).toLocaleTimeString()}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Tax Obligations Section */}
                                                                <div className="mb-6">
                                                                    <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b">Tax Obligations</h3>

                                                                    {/* Group tax types and display them in a structured way */}
                                                                    <div className="grid grid-cols-3 gap-4">
                                                                        {TAX_TYPES.map(taxType => (
                                                                            <div key={taxType.id} className={`p-3 rounded-md ${getCellColor(taxType.id)}`}>
                                                                                <h4 className="font-medium mb-2 pb-1 border-b border-gray-200">{taxType.label}</h4>
                                                                                <div className="space-y-2">
                                                                                    <div className="space-y-1">
                                                                                        <p className="text-sm font-medium text-gray-500">Status :{editingDetail[`${taxType.id}_status` as keyof PinCheckerDetail] ? (
                                                                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${editingDetail[`${taxType.id}_status` as keyof PinCheckerDetail]?.toString().toLowerCase() === 'registered' ||
                                                                                                editingDetail[`${taxType.id}_status` as keyof PinCheckerDetail]?.toString().toLowerCase() === 'active'
                                                                                                ? 'bg-green-100 text-green-800'
                                                                                                : editingDetail[`${taxType.id}_status` as keyof PinCheckerDetail]?.toString().toLowerCase() === 'cancelled'
                                                                                                    ? 'bg-amber-100 text-amber-800'
                                                                                                    : 'bg-red-100 text-red-800'
                                                                                                }`}>
                                                                                                {editingDetail[`${taxType.id}_status` as keyof PinCheckerDetail]}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-red-600 font-medium">No Obligation</span>
                                                                                        )}
                                                                                        </p>
                                                                                    </div>
                                                                                    <div className="grid grid-cols-2 gap-2">
                                                                                        <div className="space-y-1">
                                                                                            <p className="text-sm font-medium text-gray-500">From :   {editingDetail[`${taxType.id}_effective_from` as keyof PinCheckerDetail]
                                                                                                ? formatDate(editingDetail[`${taxType.id}_effective_from` as keyof PinCheckerDetail] as string)
                                                                                                : 'N/A'}</p>
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <p className="text-sm font-medium text-gray-500">To : {editingDetail[`${taxType.id}_effective_to` as keyof PinCheckerDetail]
                                                                                                ? formatDate(editingDetail[`${taxType.id}_effective_to` as keyof PinCheckerDetail] as string)
                                                                                                : 'N/A'}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* Compliance Section */}
                                                                <div className="mb-6">
                                                                    <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b">Registration & Compliance Status</h3>
                                                                    <div className="grid grid-cols-3 gap-4">
                                                                        {COMPLIANCE_TYPES.map(compType => (
                                                                            <div key={compType.id} className={`p-3 rounded-md ${getCellColor(compType.id)}`}>
                                                                                <h4 className="font-medium mb-2 pb-1 border-b border-gray-200">{compType.label}</h4>
                                                                                <div className="space-y-1">
                                                                                    <p className="text-sm font-medium text-gray-500">Status : {editingDetail[`${compType.id}_status` as keyof PinCheckerDetail] ? (
                                                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${editingDetail[`${compType.id}_status` as keyof PinCheckerDetail]?.toString().toLowerCase() === 'active' ||
                                                                                            editingDetail[`${compType.id}_status` as keyof PinCheckerDetail]?.toString().toLowerCase() === 'compliant'
                                                                                            ? 'bg-green-100 text-green-800'
                                                                                            : 'bg-red-100 text-red-800'
                                                                                            }`}>
                                                                                            {editingDetail[`${compType.id}_status` as keyof PinCheckerDetail]}
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-gray-500">Not Available</span>
                                                                                    )}</p>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* Additional Information Section */}
                                                                {editingDetail.error_message && (
                                                                    <div>
                                                                        <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b">Additional Information</h3>
                                                                        <div className="mb-4">
                                                                            <p className="text-sm font-medium text-gray-500 mb-1">Error Message</p>
                                                                            <div className="bg-red-50 p-3 rounded-md text-red-800 border border-red-200">
                                                                                {editingDetail.error_message}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </DialogContent>
                                                </Dialog>
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