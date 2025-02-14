// @ts-nocheck
import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CompanyPayrollRecord, DocumentType } from '../types'
import { PayrollTable } from './components/PayrollTable'
import { MonthYearSelector } from '../components/MonthYearSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings2 } from 'lucide-react'

interface PayrollManagementProps {
    payrollRecords: CompanyPayrollRecord[]
    selectedYear: number
    selectedMonth: number
    searchTerm: string
    loading: boolean
    setSelectedYear: (year: number) => void
    setSelectedMonth: (month: number) => void
    setSearchTerm: (term: string) => void
    handleDocumentUpload: (recordId: string, file: File, documentType: DocumentType, subFolder: string) => Promise<string | undefined>
    handleDocumentDelete: (recordId: string, documentType: DocumentType) => Promise<void>
    handleStatusUpdate: (recordId: string, statusUpdate: Partial<CompanyPayrollRecord['status']>) => Promise<void>
    setPayrollRecords: React.Dispatch<React.SetStateAction<CompanyPayrollRecord[]>>
}

export default function PayrollManagementWingu({
    payrollRecords,
    selectedYear,
    selectedMonth,
    searchTerm,
    loading,
    setSelectedYear,
    setSelectedMonth,
    setSearchTerm,
    handleDocumentUpload,
    handleDocumentDelete,
    handleStatusUpdate,
    setPayrollRecords
}: PayrollManagementProps) {
    const handleDocumentUploadWithFolder = (recordId: string, file: File, documentType: DocumentType) => {
        return handleDocumentUpload(recordId, file, documentType, 'PREP DOCS')
    }

    const columnDefinitions = [
        { id: 'index', label: 'Index (#)', defaultVisible: true },
        { id: 'companyName', label: 'Company Name', defaultVisible: true },
        { id: 'obligationDate', label: 'Obligation Date', defaultVisible: false },
        { id: 'numberOfEmployees', label: 'No. of Employees', defaultVisible: false },
        { id: 'finalizationDate', label: 'Finalization Date', defaultVisible: true },
        { id: 'payeCsv', label: 'PAYE (CSV)', defaultVisible: true },
        { id: 'hslevyCsv', label: 'HSLEVY (CSV)', defaultVisible: true },
        { id: 'shifExl', label: 'SHIF (EXL)', defaultVisible: true },
        { id: 'nssfExl', label: 'NSSF (EXL)', defaultVisible: true },
        { id: 'zipFileKra', label: 'ZIP FILE-KRA', defaultVisible: true },
        { id: 'allCsv', label: 'All CSV', defaultVisible: true },
        { id: 'readyToFile', label: 'Ready to File', defaultVisible: true },
        { id: 'assignedTo', label: 'Assigned To', defaultVisible: false },
        { id: 'actions', label: 'Actions', defaultVisible: true },
    ];

    // Initialize column visibility state from definitions
    const [columnVisibility, setColumnVisibility] = useState(() => {
        const initialState = {};
        columnDefinitions.forEach(col => {
            initialState[col.id] = col.defaultVisible;
        });
        return initialState;
    });

    // Toggle column visibility
    const toggleColumnVisibility = (columnId: string, isVisible: boolean) => {
        setColumnVisibility(prev => ({
            ...prev,
            [columnId]: isVisible
        }));
    };

    // Filter records based on search term
    const filteredRecords = useMemo(() => {
        if (!searchTerm.trim()) return payrollRecords;
        
        const searchLower = searchTerm.toLowerCase();
        return payrollRecords.filter(record => {
            const companyName = record.company?.company_name || '';
            const companyId = record.company?.id?.toString() || '';
            return companyName.toLowerCase().includes(searchLower) || 
                   companyId.includes(searchLower);
        });
    }, [payrollRecords, searchTerm]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <MonthYearSelector
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    onYearChange={setSelectedYear}
                    onMonthChange={setSelectedMonth}
                />
                <div className="flex gap-4 items-center">
                    <Input
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64"
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-10 w-10">
                                <Settings2 className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {columnDefinitions.map(column => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    checked={columnVisibility[column.id]}
                                    onCheckedChange={(checked) => toggleColumnVisibility(column.id, checked)}
                                >
                                    {column.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline">Export</Button>
                    <Button variant="outline">Extract All</Button>
                </div>
            </div>

            <PayrollTable
                records={filteredRecords}
                onDocumentUpload={handleDocumentUploadWithFolder}
                onDocumentDelete={handleDocumentDelete}
                onStatusUpdate={handleStatusUpdate}
                loading={loading}
                setPayrollRecords={setPayrollRecords}
                columnVisibility={columnVisibility}
            />
        </div>
    )
}