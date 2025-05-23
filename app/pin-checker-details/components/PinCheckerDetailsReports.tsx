// components/PinCheckerDetailsReports.tsx
// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ArrowUpDown, Trash2, Download, RefreshCw, Filter, Eye, EyeOff, Calendar } from 'lucide-react'
import ExcelJS from 'exceljs'
import { ClientCategoryFilter } from "./ClientCategoryFilter"

interface PinCheckerDetail {
    id: number;
    company_name: string;
    kra_pin: string;
    pin_status: string;
    itax_status: string;
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
    etims_registration: string;
    tims_registration: string;
    vat_compliance: string;
    error_message?: string;
    last_checked_at: string;
}

type SortField = keyof PinCheckerDetail | 'last_checked_date' | 'last_checked_time';
type SortOrder = 'asc' | 'desc';

const TAX_TYPES = [
    { id: 'income_tax_company', label: 'Income Tax Company' },
    { id: 'vat', label: 'VAT' },
    { id: 'paye', label: 'PAYE' },
    { id: 'rent_income_mri', label: 'Rent Income (MRI)' },
    { id: 'resident_individual', label: 'Resident Individual' },
    { id: 'turnover_tax', label: 'Turnover Tax' }
];

const COMPLIANCE_TYPES = [
    { id: 'etims_registration', label: 'eTIMS Registration' },
    { id: 'tims_registration', label: 'TIMS Registration' },
    { id: 'vat_compliance', label: 'VAT Compliance' }
];

// Fields for the initial columns in the header that display stats
const initialStatsDisplayFields = [
    { key: 'company_name', label: 'Company Name' },
    { key: 'kra_pin', label: 'KRA PIN' },
    { key: 'pin_status', label: 'PIN Status', color: 'bg-olive-100' },
    { key: 'itax_status', label: 'iTax Status', color: 'bg-blue-100' }
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

    const isClientTypeActive = (fromDate, toDate) => {
        if (!fromDate || !toDate) return false;

        const currentDate = new Date().toISOString().split('T')[0];

        const parseDate = (dateStr) => {
            if (dateStr.includes('/')) {
                const [day, month, year] = dateStr.split('/').map(Number);
                return new Date(year, month - 1, day);
            } else {
                return new Date(dateStr);
            }
        };

        const from = parseDate(fromDate);
        const to = parseDate(toDate);
        const current = new Date(currentDate);

        return from <= current && current <= to;
    };

    const joinedDetails = React.useMemo(() => {
        return details.map(detail => {
            const matchingCompany = companies.find(
                company => company.company_name === detail.company_name
            );

            return {
                ...detail,
                companyData: matchingCompany || null,
                pinStatus: matchingCompany && matchingCompany.kra_pin ? 'PIN available' : 'Missing PIN'
            };
        });
    }, [details, companies]);


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

    const filteredDetails = React.useMemo(() => {
        if (Object.keys(categoryFilters).length === 0) {
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

        return joinedDetails.filter(detail => {
            const matchesSearch = searchTerm === '' ||
                Object.entries(detail).some(([key, value]) => {
                    if (value === null || value === undefined || key === 'companyData') {
                        return false;
                    }
                    return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
                });

            if (!matchesSearch) return false;

            const company = detail.companyData;
            if (!company) return false;

            const hasActiveTaxObligations = isDetailActiveByTaxStatus(detail);
            const status = hasActiveTaxObligations ? 'active' : 'inactive';

            for (const [category, statusFilters] of Object.entries(categoryFilters)) {
                if (!Object.values(statusFilters).some(isSelected => isSelected)) continue;

                if (category === 'all') {
                    const anyClientTypeActive = ['acc', 'imm', 'sheria', 'audit'].some(cat =>
                        isClientTypeActive(
                            company[`${cat}_client_effective_from`],
                            company[`${cat}_client_effective_to`]
                        )
                    );

                    if (!anyClientTypeActive) continue;
                } else {
                    const isClientActive = isClientTypeActive(
                        company[`${category}_client_effective_from`],
                        company[`${category}_client_effective_to`]
                    );

                    if (!isClientActive) continue;
                }

                if (statusFilters['all'] || statusFilters[status]) {
                    return true;
                }
            }

            return false;
        });
    }, [joinedDetails, categoryFilters, searchTerm]);

    const calculateCategoryCounts = () => {
        const counts = {
            'all': { 'all': 0, 'active': 0, 'inactive': 0 },
            'acc': { 'all': 0, 'active': 0, 'inactive': 0 },
            'imm': { 'all': 0, 'active': 0, 'inactive': 0 },
            'sheria': { 'all': 0, 'active': 0, 'inactive': 0 },
            'audit': { 'all': 0, 'active': 0, 'inactive': 0 },
        };

        const searchFilteredDetails = joinedDetails.filter(detail =>
            searchTerm === '' ||
            Object.entries(detail).some(([key, value]) => {
                if (value === null || value === undefined || key === 'companyData') {
                    return false;
                }
                return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
            })
        );

        counts['all']['all'] = searchFilteredDetails.length;

        searchFilteredDetails.forEach(detail => {
            const company = detail.companyData;

            if (!company) {
                counts['all']['inactive']++;
                return;
            }

            const hasActiveTaxObligations = isDetailActiveByTaxStatus(detail);

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

    const handleDownloadExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('PIN Checker Details');

        // Helper function to return 'N/A' for null, undefined, empty, or 'Unknown' for VAT Compliance
        const getValueForExport = (value: any, isVatCompliance: boolean = false) => {
            if (value === null || value === undefined || String(value).trim() === '') {
                return 'N/A';
            }
            if (isVatCompliance && String(value).toLowerCase().trim() === 'unknown') {
                return 'N/A';
            }
            return String(value);
        };

        // Add headers
        const headers = [
            'Index',
            'ID',
            'Company Name',
            'KRA PIN',
            'PIN Status',
            'iTax Status'
        ];

        TAX_TYPES.forEach(taxType => {
            headers.push(`${taxType.label} Status`, `${taxType.label} From`, `${taxType.label} To`);
        });

        COMPLIANCE_TYPES.forEach(compType => {
            headers.push(`${compType.label}`);
        });

        headers.push('Error Message', 'Last Checked Date', 'Last Checked Time');

        worksheet.addRow(headers);

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF00' }
        };

        sortedDetails.forEach((detail, index) => {
            const rowData = [
                index + 1,
                detail.id,
                detail.company_name,
                detail.companyData?.kra_pin || detail.kra_pin || 'Missing PIN',
                getValueForExport(detail.pin_status),
                getValueForExport(detail.itax_status)
            ];

            TAX_TYPES.forEach(taxType => {
                rowData.push(
                    getValueForExport(detail[`${taxType.id}_status`]),
                    getValueForExport(detail[`${taxType.id}_effective_from`]),
                    getValueForExport(detail[`${taxType.id}_effective_to`])
                );
            });

            COMPLIANCE_TYPES.forEach(compType => {
                const status = detail[compType.id];
                rowData.push(getValueForExport(status, compType.id === 'vat_compliance'));
            });

            rowData.push(
                detail.error_message || '', // Ensure blank if null/undefined/empty
                formatDate(detail.last_checked_at),
                new Date(detail.last_checked_at).toLocaleTimeString()
            );

            const row = worksheet.addRow(rowData);

            const indexCell = row.getCell(1);
            indexCell.font = { bold: true };
            indexCell.alignment = { vertical: 'middle', horizontal: 'center' };

            const colors = {
                income_tax_company: 'FFE6F2FF', // Light Blue
                vat: 'FFE6FFE6', // Light Green
                paye: 'FFFFF2E6', // Light Orange
                rent_income_mri: 'FFF2E6FF', // Light Purple
                resident_individual: 'FFFFE6F2', // Light Pink
                turnover_tax: 'FFFFE6CC', // Light Gold
                etims_registration: 'FFE6FFFF', // Light Cyan
                tims_registration: 'FFCCFFCC', // Lighter Green
                vat_compliance: 'FFFFCCFF', // Light Magenta
                pin_status: 'FFD8E4BC', // Light olive green
                itax_status: 'FFB8CCE4'  // Light blue
            };

            // Apply colors for PIN Status and iTax Status columns
            const pinStatusCell = row.getCell(5);
            const itaxStatusCell = row.getCell(6);

            pinStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.pin_status } };
            itaxStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.itax_status } };

            // Apply colors for tax type columns
            TAX_TYPES.forEach((taxType, typeIndex) => {
                for (let i = 0; i < 3; i++) {
                    const cellIndex = 6 + (typeIndex * 3) + i + 1;
                    const cell = row.getCell(cellIndex);
                    const status = cell.value?.toString().toLowerCase();
                    let cellColor = colors[taxType.id];

                    if (!status || status === 'no obligation' || status === 'dormant' || status === 'inactive' || status === 'not compliant' || status === 'n/a') {
                        cellColor = 'FFFFCCCB'; // Light Red for 'Missing/No Obligation/Dormant/Inactive/N/A'
                    } else if (status === 'cancelled') {
                        cellColor = 'FFFFFF00'; // Yellow for 'Cancelled'
                    } else if (['registered', 'active', 'compliant', 'ipage updated'].includes(status)) {
                        cellColor = 'FFE6FFE6'; // Light Green for 'Registered/Active/Compliant/iPage Updated'
                    }

                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellColor } };
                }
            });

            // Apply colors for compliance columns
            COMPLIANCE_TYPES.forEach((compType, compIndex) => {
                const cellIndex = 6 + (TAX_TYPES.length * 3) + compIndex + 1;
                const cell = row.getCell(cellIndex);
                const status = cell.value?.toString().toLowerCase();
                let cellColor = colors[compType.id];

                if (!status || status === 'inactive' || status === 'not compliant' || status === 'n/a') {
                    cellColor = 'FFFFCCCB'; // Light Red for 'Inactive/Not Compliant/N/A'
                } else if (status === 'active' || status === 'compliant') {
                    cellColor = 'FFE6FFE6'; // Light Green for 'Active/Compliant'
                }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellColor } };
            });

            row.eachCell({ includeEmpty: true }, cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

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

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '.');

        // --- Start of the fix: Define clientCategory based on categoryFilters ---
        let clientCategoryString = 'ALL'; // Default to 'ALL' if no specific category is selected or filter object is empty

        // Find the first active category filter to use in the filename
        const categories = ['all', 'acc', 'imm', 'sheria', 'audit'];
        for (const cat of categories) {
            if (categoryFilters[cat] && Object.values(categoryFilters[cat]).some(val => val === true)) {
                clientCategoryString = cat;
                // If 'all' is explicitly selected, prioritize it for the filename, then break
                if (cat === 'all') break;
            }
        }
        const clientCategory = clientCategoryString.toUpperCase();
        // --- End of the fix ---

        link.download = `PIN CHECKER DETAILS - ${clientCategory} - ${currentDate}.xlsx`;
        link.click();
    }

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
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            const parts = dateString.split(/[-/.]/);
            if (parts.length === 3) {
                const [a, b, c] = parts;
                if (a.length === 4) {
                    return `${c}.${b}.${a}`; // yyyy-mm-dd to dd.mm.yyyy
                } else if (c.length === 4) {
                    return `${a}.${b}.${c}`; // dd-mm-yyyy or mm-dd-yyyy to dd.mm.yyyy
                }
            }
            return dateString;
        }
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    const sortedDetails = React.useMemo(() => {
        return [...filteredDetails].sort((a, b) => {
            let aValue: any = a[sortField as keyof PinCheckerDetail];
            let bValue: any = b[sortField as keyof PinCheckerDetail];

            if (sortField === 'last_checked_date') {
                aValue = new Date(a.last_checked_at).toLocaleDateString();
                bValue = new Date(b.last_checked_at).toLocaleDateString();
            } else if (sortField === 'last_checked_time') {
                aValue = new Date(a.last_checked_at).toLocaleTimeString();
                bValue = new Date(b.last_checked_at).toLocaleTimeString();
            } else if (sortField.endsWith('_status') || COMPLIANCE_TYPES.some(ct => ct.id === sortField)) { // Check for _status or direct compliance fields
                // Custom sorting order for all status fields
                const statusOrder = [
                    'Registered', 'Active', 'Compliant', 'iPage Updated', // Positive statuses first
                    'Suspended', // Neutral/Warning
                    'Cancelled', 'Dormant', 'Inactive', 'Not Compliant', 'No Obligation', // Negative statuses last
                    'Not Available', '' // Empty/Unknown at the very end
                ];
                aValue = statusOrder.indexOf(aValue || '');
                bValue = statusOrder.indexOf(bValue || '');
            } else if (sortField.endsWith('_from') || sortField.endsWith('_to')) {
                aValue = aValue ? new Date(aValue) : new Date(0);
                bValue = bValue ? new Date(bValue) : new Date(0);
            }

            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredDetails, sortField, sortOrder]);

    // Define all fields for which statistics are calculated
    const allStatsFields = React.useMemo(() => [
        'company_name',
        'kra_pin',
        'pin_status',
        'itax_status',
        ...TAX_TYPES.flatMap(taxType => [
            `${taxType.id}_status`,
            `${taxType.id}_effective_from`,
            `${taxType.id}_effective_to`
        ]),
        ...COMPLIANCE_TYPES.map(compType => compType.id)
    ], []);

    const calculateStats = () => {
        const stats = {
            complete: {},
            missing: {}
        };

        // Initialize stats for each field
        allStatsFields.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        sortedDetails.forEach(detail => {
            allStatsFields.forEach(field => {
                let isComplete = false;
                const value = detail[field as keyof PinCheckerDetail];
                const lowerValue = (value || '').toString().toLowerCase().trim();

                if (field === 'kra_pin') {
                    // KRA PIN is complete if companyData has it
                    isComplete = detail.pinStatus === 'PIN available';
                } else if (field === 'pin_status' || field === 'itax_status') {
                    // PIN Status/iTax Status is complete if 'active' or 'ipage updated'
                    isComplete = ['active', 'ipage updated'].includes(lowerValue);
                } else if (COMPLIANCE_TYPES.some(ct => ct.id === field)) {
                    // Compliance fields are complete if 'active' or 'compliant'
                    isComplete = ['active', 'compliant'].includes(lowerValue);
                } else if (TAX_TYPES.some(tt => `${tt.id}_status` === field)) {
                    // Tax obligation statuses are complete if 'registered' or 'active'
                    isComplete = ['registered', 'active'].includes(lowerValue);
                } else if (field.endsWith('_from') || field.endsWith('_to')) {
                    // Date fields are complete if they have a non-empty value
                    isComplete = !!value;
                } else if (field === 'company_name') {
                    // Company name is complete if it has a non-empty value
                    isComplete = !!value;
                }

                if (isComplete) {
                    stats.complete[field]++;
                } else {
                    stats.missing[field]++;
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

    const renderStatusCell = (detail: any, typeId: string) => {
        let statusValue: string | undefined;

        // Determine how to get the status value based on the typeId
        if (typeId === 'pin_status' || typeId === 'itax_status' || COMPLIANCE_TYPES.some(ct => ct.id === typeId)) {
            // These are direct fields on the detail object
            statusValue = detail[typeId];
        } else {
            // Tax types use the '_status' suffix
            statusValue = detail[`${typeId}_status`];
        }

        const lowerStatus = (statusValue || '').toLowerCase(); // Convert to lowercase for easier comparison, handle null/undefined

        // Specific handling for "Unknown" in VAT Compliance
        if (typeId === 'vat_compliance' && lowerStatus === 'unknown') {
            return <span className="font-bold text-red-600 px-1 py-1 rounded-full text-xs font-semibold whitespace-nowrap">N/A</span>;
        }

        // Handle generic "Not Available" if statusValue is null, undefined, or empty after initial retrieval
        if (!statusValue || lowerStatus.trim() === '') {
            return <span className="font-bold text-gray-600 whitespace-nowrap">Not Available</span>;
        }

        // Apply specific styling based on status content
        if (lowerStatus === 'cancelled' || lowerStatus === 'ipage updated') {
            return <span className="bg-amber-500 text-amber-800 px-1 py-1 rounded-full text-xs font-semibold whitespace-nowrap">{statusValue}</span>;
        }
        if (lowerStatus === 'dormant') {
            return <span className="bg-red-500 text-red-800 px-1 py-1 rounded-full text-xs font-semibold whitespace-nowrap">{statusValue}</span>;
        }
        if (['registered', 'active', 'compliant', 'ipage updated'].includes(lowerStatus)) {
            return <span className="bg-green-400 text-green-800 px-1 py-1 rounded-full text-xs font-semibold whitespace-nowrap">{statusValue}</span>;
        }
        if (['inactive', 'not compliant', 'no obligation', 'ipage not updated'].includes(lowerStatus)) {
            return <span className="bg-red-400 text-red-800 px-1 py-1 rounded-full text-xs font-semibold whitespace-nowrap">{statusValue}</span>;
        }

        // Default return for statuses not covered by specific rules (e.g., 'Suspended' if not styled)
        return statusValue;
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
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
                </div>
            </div>

            <div className="rounded-md border">
                <div className="overflow-x-auto" style={{
                    transform: 'scale(0.9)',
                    transformOrigin: 'top left',
                    width: '111%',
                    height: '111%'
                }}>
                    <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                        <Table className="text-xs pb-2">
                            <TableHeader>
                                <TableRow className="h-8">
                                    <TableHead className="sticky top-0 bg-white border-r border-black border-b font-bold text-black text-center w-16" style={{ minWidth: '90px' }}>IDX | ID</TableHead>
                                    <TableHead className="sticky top-0 bg-white border-r border-black border-b font-bold text-black">
                                        <SortableHeader field="company_name">Company Name</SortableHeader>
                                    </TableHead>
                                    <TableHead className="sticky top-0 bg-white border-r border-black border-b font-bold text-black">
                                        <SortableHeader field="kra_pin">KRA PIN</SortableHeader>
                                    </TableHead>

                                    <TableHead className="sticky top-0 bg-olive-200 text-center border-r border-black border-b font-bold text-black">
                                        PIN Status
                                    </TableHead>

                                    <TableHead className="sticky top-0 bg-blue-200 text-center border-r border-black border-b font-bold text-black">
                                        iTax Status
                                    </TableHead>

                                    {TAX_TYPES.map(taxType => (
                                        <TableHead
                                            key={taxType.id}
                                            className={`sticky top-0 ${getCellColor(taxType.id)} border-r border-black border-b text-center font-bold text-black`}
                                            colSpan={showDateColumns ? 3 : 1}
                                        >
                                            {taxType.label}
                                        </TableHead>
                                    ))}

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
                                        {/* Complete Stats Row */}
                                        <TableRow className="h-6 bg-blue-50">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-black">Complete</TableCell>

                                            {initialStatsDisplayFields.map(field => (
                                                <TableCell key={field.key} className={`text-center text-[10px] border-r border-black ${field.color || ''}`}>
                                                    <span className={stats.complete[field.key] === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                        {stats.complete[field.key]}
                                                    </span>
                                                </TableCell>
                                            ))}

                                            {TAX_TYPES.flatMap(taxType => {
                                                const cells = [
                                                    <TableCell
                                                        key={`${taxType.id}-status-complete`}
                                                        className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}
                                                    >
                                                        <span className={stats.complete[`${taxType.id}_status`] === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                            {stats.complete[`${taxType.id}_status`]}
                                                        </span>
                                                    </TableCell>
                                                ];
                                                if (showDateColumns) {
                                                    cells.push(
                                                        <TableCell key={`${taxType.id}-from-complete`} className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}>
                                                            <span className={stats.complete[`${taxType.id}_effective_from`] === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                                {stats.complete[`${taxType.id}_effective_from`]}
                                                            </span>
                                                        </TableCell>,
                                                        <TableCell key={`${taxType.id}-to-complete`} className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}>
                                                            <span className={stats.complete[`${taxType.id}_effective_to`] === sortedDetails.length ? 'text-green-600 font-bold' : ''}>
                                                                {stats.complete[`${taxType.id}_effective_to`]}
                                                            </span>
                                                        </TableCell>
                                                    );
                                                }
                                                return cells;
                                            })}

                                            {COMPLIANCE_TYPES.map(compType => {
                                                const fieldName = compType.id;
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

                                        {/* Missing Stats Row */}
                                        <TableRow className="h-6 bg-red-50">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-black">Missing</TableCell>

                                            {initialStatsDisplayFields.map(field => (
                                                <TableCell key={field.key} className={`text-center text-[10px] border-r border-black ${field.color || ''}`}>
                                                    <span className={stats.missing[field.key] > 0 ? 'text-red-600 font-bold' : ''}>
                                                        {stats.missing[field.key]}
                                                    </span>
                                                </TableCell>
                                            ))}

                                            {TAX_TYPES.flatMap(taxType => {
                                                const cells = [
                                                    <TableCell
                                                        key={`${taxType.id}-status-missing`}
                                                        className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}
                                                    >
                                                        <span className={stats.missing[`${taxType.id}_status`] > 0 ? 'text-red-600 font-bold' : ''}>
                                                            {stats.missing[`${taxType.id}_status`]}
                                                        </span>
                                                    </TableCell>
                                                ];
                                                if (showDateColumns) {
                                                    cells.push(
                                                        <TableCell key={`${taxType.id}-from-missing`} className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}>
                                                            <span className={stats.missing[`${taxType.id}_effective_from`] > 0 ? 'text-red-600 font-bold' : ''}>
                                                                {stats.missing[`${taxType.id}_effective_from`]}
                                                            </span>
                                                        </TableCell>,
                                                        <TableCell key={`${taxType.id}-to-missing`} className={`text-center text-[10px] border-r border-black ${getCellColor(taxType.id)}`}>
                                                            <span className={stats.missing[`${taxType.id}_effective_to`] > 0 ? 'text-red-600 font-bold' : ''}>
                                                                {stats.missing[`${taxType.id}_effective_to`]}
                                                            </span>
                                                        </TableCell>
                                                    );
                                                }
                                                return cells;
                                            })}

                                            {COMPLIANCE_TYPES.map(compType => {
                                                const fieldName = compType.id;
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

                                <TableRow className="h-8">
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b"></TableHead>
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b"></TableHead>
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b"></TableHead>
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b"></TableHead>
                                    <TableHead className="sticky top-8 bg-white border-r border-black border-b"></TableHead>

                                    {TAX_TYPES.flatMap(taxType => {
                                        const headers = [
                                            <TableHead
                                                key={`${taxType.id}-status`}
                                                className={`sticky top-8 ${getCellColor(taxType.id)} border-r border-black border-b text-black text-center`}
                                            >
                                                <SortableHeader field={`${taxType.id}_status` as SortField}>Status</SortableHeader>
                                            </TableHead>
                                        ];
                                        if (showDateColumns) {
                                            headers.push(
                                                <TableHead key={`${taxType.id}-from`} className={`sticky top-8 ${getCellColor(taxType.id)} border-r border-black border-b text-black text-center`}>
                                                    <SortableHeader field={`${taxType.id}_effective_from` as SortField}>From</SortableHeader>
                                                </TableHead>,
                                                <TableHead key={`${taxType.id}-to`} className={`sticky top-8 ${getCellColor(taxType.id)} border-r border-black border-b text-black text-center`}>
                                                    <SortableHeader field={`${taxType.id}_effective_to` as SortField}>To</SortableHeader>
                                                </TableHead>
                                            );
                                        }
                                        return headers;
                                    })}

                                    {COMPLIANCE_TYPES.map(compType => {
                                        const field = compType.id as SortField; // Direct field name for sorting
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
                                        <TableCell className="border-r border-black font-bold text-black text-center">{index + 1} | {detail.id}</TableCell>
                                        <TableCell className="border-r border-black">{detail.company_name}</TableCell>
                                        <TableCell className="border-r border-black">
                                            {detail.pinStatus === 'Missing PIN' ? (
                                                <span className="text-red-600 font-semibold">Missing PIN</span>
                                            ) : (
                                                <span>{detail.companyData?.kra_pin || detail.kra_pin}</span>
                                            )}
                                        </TableCell>

                                        <TableCell className="border-r border-black bg-olive-100 text-center">
                                            {renderStatusCell(detail, 'pin_status')}
                                        </TableCell>

                                        <TableCell className="border-r border-black bg-blue-100 text-center">
                                            {renderStatusCell(detail, 'itax_status')}
                                        </TableCell>

                                        {TAX_TYPES.flatMap(taxType => {
                                            const cells = [
                                                <TableCell
                                                    key={`${taxType.id}-status-${detail.id}`}
                                                    className={`${getCellColor(taxType.id)} border-l border-r border-black text-center`}
                                                >
                                                    {renderStatusCell(detail, taxType.id)}
                                                </TableCell>
                                            ];
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

                                        {COMPLIANCE_TYPES.map(compType => (
                                            <TableCell
                                                key={compType.id}
                                                className={`${getCellColor(compType.id)} border-r border-black text-center`}
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
                                                                <div className="mb-6">
                                                                    <div className="grid grid-cols-3 gap-4 mb-4">
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

                                                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                                                        <div className="space-y-1 p-3 rounded-md bg-amber-50">
                                                                            <p className="text-sm font-medium text-gray-500">PIN Status : {renderStatusCell(editingDetail, 'pin_status')}</p>
                                                                        </div>
                                                                        <div className="space-y-1 p-3 rounded-md bg-blue-50">
                                                                            <p className="text-sm font-medium text-gray-500">iTax Status : {renderStatusCell(editingDetail, 'itax_status')}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="mb-6">
                                                                    <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b">Tax Obligations</h3>
                                                                    <div className="grid grid-cols-3 gap-4">
                                                                        {TAX_TYPES.map(taxType => (
                                                                            <div key={taxType.id} className={`p-3 rounded-md ${getCellColor(taxType.id)}`}>
                                                                                <h4 className="font-medium mb-2 pb-1 border-b border-gray-200">{taxType.label}</h4>
                                                                                <div className="space-y-2">
                                                                                    <div className="space-y-1">
                                                                                        <p className="text-sm font-medium text-gray-500">Status : {renderStatusCell(editingDetail, taxType.id)}</p>
                                                                                    </div>
                                                                                    <div className="grid grid-cols-2 gap-2">
                                                                                        <div className="space-y-1">
                                                                                            <p className="text-sm font-medium text-gray-500">From : {editingDetail[`${taxType.id}_effective_from` as keyof PinCheckerDetail]
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

                                                                <div className="mb-6">
                                                                    <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b">Registration & Compliance Status</h3>
                                                                    <div className="grid grid-cols-3 gap-4">
                                                                        {COMPLIANCE_TYPES.map(compType => (
                                                                            <div key={compType.id} className={`p-3 rounded-md ${getCellColor(compType.id)}`}>
                                                                                <h4 className="font-medium mb-2 pb-1 border-b border-gray-200">{compType.label}</h4>
                                                                                <div className="space-y-1">
                                                                                    <p className="text-sm font-medium text-gray-500">Status : {renderStatusCell(editingDetail, compType.id)}</p>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

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