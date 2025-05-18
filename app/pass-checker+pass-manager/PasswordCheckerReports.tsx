// components/ManufacturersDetailsReports.tsx
// @ts-nocheck
"use client";

import React, { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, RefreshCw, Download, Eye, EyeOff, Filter, ArrowUpDown } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui';
import { Spinner } from '@/components/Spinner';

interface Manufacturer {
  id: number
  company_name: string
  // KRA
  kra_pin: string
  kra_password: string
  // NHIF
  nhif_id: string
  nhif_code: string
  nhif_password: string
  // NSSF
  nssf_id: string
  nssf_code: string
  nssf_password: string
  // eCitizen
  ecitizen_id: string
  ecitizen_password: string
  director: string
  // QuickBooks
  quickbooks_id: string
  quickbooks_password: string
  // KEBS
  kebs_id: string
  kebs_password: string
  categories: string[]
  status: string
  acc_client_status: string
  imm_client_status: string
  sheria_client_status: string
  audit_client_status: string
  acc_client_effective_from: string
  acc_client_effective_to: string
  imm_client_effective_from: string
  imm_client_effective_to: string
  sheria_client_effective_from: string
  sheria_client_effective_to: string
  audit_client_effective_from: string
  audit_client_effective_to: string
}
const columnGroups = {
  companyDetails: [
    { key: 'company_name', label: 'Company Name' },
  ],
  kraDetails: [
    { key: 'kra_pin', label: 'KRA Pin No' },
    { key: 'kra_password', label: 'KRA Password' },
    { key: 'kra_status', label: 'KRA Status' },
    { key: "last_checked", label: "Last Checked" },
  ],
  nhifDetails: [
    { key: 'nhif_id', label: 'NHIF ID' },
    { key: 'nhif_code', label: 'NHIF Code' },
    { key: 'nhif_password', label: 'NHIF Password' },
    { key: 'nhif_status', label: 'NHIF Status' },
    { key: "last_checked", label: "Last Checked" },
  ],
  nssfDetails: [
    { key: 'nssf_id', label: 'NSSF ID' },
    { key: 'nssf_code', label: 'NSSF Code' },
    { key: 'nssf_password', label: 'NSSF Password' },
    { key: 'nssf_status', label: 'NSSF Status' },
    { key: "last_checked", label: "Last Checked" },
  ],
  kebsDetails: [
    { key: 'kebs_id', label: 'KEBS ID' },
    { key: 'kebs_password', label: 'KEBS Password' },
    { key: 'kebs_status', label: 'KEBS Status' },
    { key: "last_checked", label: "Last Checked" },
  ],
  quickbooksDetails: [
    { key: 'quickbooks_id', label: 'Quickbooks ID' },
    { key: 'quickbooks_password', label: 'Quickbooks Password' },
    { key: 'quickbooks_status', label: 'Quickbooks Status' },
    { key: "last_checked", label: "Last Checked" },
  ]
};

export default function PasswordCheckerReports() {
  const [isLoading, setIsLoading] = useState(false);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [filteredManufacturers, setFilteredManufacturers] = useState<Manufacturer[]>([]);
  const [searchTerm, setSearchTerm] = useState('')
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null)
  const [visibleColumns, setVisibleColumns] = useState({
    company_name: true,
    kra_pin: true,
    kra_password: true,
    nhif_id: true,
    nhif_code: true,
    nhif_password: true,
    nssf_id: true,
    nssf_code: true,
    nssf_password: true,
    ecitizen_id: true,
    ecitizen_password: true,
    director: true,
    quickbooks_id: true,
    quickbooks_password: true,
    kebs_id: true,
    kebs_password: true
  })
  const [sortConfig, setSortConfig] = useState({ key: 'company_name', direction: 'ascending' })
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false)
  const [categoryFilters, setCategoryFilters] = useState<{
    categories: { [key: string]: boolean };
    categorySettings: {
      [key: string]: {
        clientStatus: { [key: string]: boolean };
        sectionStatus: { [key: string]: boolean };
      };
    };
  }>({
    categories: {
      'All Categories': false,
      'Acc': true,
      'Imm': false,
      'Sheria': false,
      'Audit': false
    },
    categorySettings: {
      'Acc': {
        clientStatus: {
          All: false,
          Active: true,
          Inactive: false
        },
        sectionStatus: {
          All: false,
          Active: true,
          Inactive: false,
          Missing: false
        }
      }
    }
  });
  const [showStatsRows, setShowStatsRows] = useState(true);

  const calculateClientStatus = (fromDate: string, toDate: string) => {
    if (!fromDate || !toDate) return 'inactive';

    const today = new Date();
    const from = new Date(fromDate.split('/').reverse().join('-'));
    const to = new Date(toDate.split('/').reverse().join('-'));

    if (today >= from && today <= to) return 'active';
    return 'inactive';
  }


  const fetchReports = async () => {
    setIsLoading(true);
    try {
      // Fetch companies from acc_portal_company_duplicate
      const { data: companiesData, error: companiesError } = await supabase
        .from('acc_portal_company_duplicate')
        .select('*')
        .order('company_name', { ascending: true });

      if (companiesError) {
        console.error('Error fetching companies:', companiesError);
        return;
      }

      // Fetch manufacturer details
      const { data: manufacturersData, error: manufacturersError } = await supabase
        .from('ManufacturersDetails')
        .select('*');

      if (manufacturersError) {
        console.error('Error fetching manufacturer details:', manufacturersError);
        return;
      }

      // Map companies with their manufacturer details
      const mappedData = companiesData.map(company => {
        const manufacturerDetails = manufacturersData.find(m => m.company_id === company.id) || {};

        // Helper function to determine if a company belongs to a category and its status
        const getCategoryStatus = (category: string) => {
          const categoryId = category.toLowerCase();
          const fromDate = company[`${categoryId}_client_effective_from`];
          const toDate = company[`${categoryId}_client_effective_to`];

          if (!fromDate || !toDate) return 'inactive';

          const today = new Date();
          const from = new Date(fromDate.split('/').reverse().join('-'));
          const to = new Date(toDate.split('/').reverse().join('-'));

          return today >= from && today <= to ? 'active' : 'inactive';
        };

        // Helper function to determine if a company belongs to a category
        const belongsToCategory = (category: string) => {
          const categoryId = category.toLowerCase();
          const fromDate = company[`${categoryId}_client_effective_from`];
          const toDate = company[`${categoryId}_client_effective_to`];
          return fromDate && toDate; // Company belongs if it has dates set
        };

        // Get all categories this company belongs to
        const companyCategories = ['Acc', 'Imm', 'Sheria', 'Audit'].filter(cat => {
          const categoryId = cat.toLowerCase();
          const fromDate = company[`${categoryId}_client_effective_from`];
          const toDate = company[`${categoryId}_client_effective_to`];
          return fromDate && toDate; // Company belongs if it has dates set
        });

        return {
          id: company.id,
          company_name: company.company_name,
          kra_pin: company.kra_pin,
          // Map effective dates and statuses from company data
          acc_client_effective_from: company.acc_client_effective_from || null,
          acc_client_effective_to: company.acc_client_effective_to || null,
          imm_client_effective_from: company.imm_client_effective_from || null,
          imm_client_effective_to: company.imm_client_effective_to || null,
          sheria_client_effective_from: company.sheria_client_effective_from || null,
          sheria_client_effective_to: company.sheria_client_effective_to || null,
          audit_client_effective_from: company.audit_client_effective_from || null,
          audit_client_effective_to: company.audit_client_effective_to || null,
          // Map client statuses
          acc_client_status: company.acc_client_status || 'inactive',
          imm_client_status: company.imm_client_status || 'inactive',
          sheria_client_status: company.sheria_client_status || 'inactive',
          audit_client_status: company.audit_client_status || 'inactive',
          categories: companyCategories,
          status: manufacturerDetails.status || null
        };
      });

      setManufacturers(mappedData);
    } finally {
      setIsLoading(false);
    }
  }

  const applyFiltersToData = (data, filters) => {
    if (!filters.categories || Object.keys(filters.categories).length === 0) {
      return data;
    }

    return data.filter(manufacturer => {
      const selectedCategories = Object.entries(filters.categories)
        .filter(([category, isSelected]) => category && category !== 'All Categories' && isSelected)
        .map(([category]) => category);

      if (selectedCategories.length === 0) {
        return true;
      }

      if (filters.categories['All Categories']) {
        return true;
      }

      const matchesCategory = selectedCategories.some(category => {
        const categoryId = category.toLowerCase().slice(0, 3);
        const fromDate = manufacturer[`${categoryId}_client_effective_from`];
        const toDate = manufacturer[`${categoryId}_client_effective_to`];

        // If no dates are set, this company doesn't belong to this category
        if (!fromDate || !toDate) {
          return false;
        }

        // Calculate current status based on today's date
        const today = new Date();
        const effectiveFrom = new Date(fromDate.split('/').reverse().join('-'));
        const effectiveTo = new Date(toDate.split('/').reverse().join('-'));
        const currentStatus = today >= effectiveFrom && today <= effectiveTo ? 'active' : 'inactive';

        // Get selected statuses from filter
        const categorySettings = filters.categorySettings?.[category];
        if (!categorySettings) {
          return true;
        }

        const selectedClientStatuses = Object.entries(categorySettings.clientStatus || {})
          .filter(([_, isSelected]) => isSelected)
          .map(([status]) => status.toLowerCase());

        // If 'All' is selected or no statuses are selected, include all
        if (selectedClientStatuses.includes('all') || selectedClientStatuses.length === 0) {
          return true;
        }

        // Check if current status matches selected filters
        return selectedClientStatuses.includes(currentStatus);
      });

      return matchesCategory;
    });
  };

  const handleSave = async (updatedManufacturer: Manufacturer) => {
    try {
      const { id, ...updateData } = updatedManufacturer;

      // First, check if a record exists in ManufacturersDetails for this company_id
      const { data: existingData } = await supabase
        .from('ManufacturersDetails')
        .select('*')
        .eq('company_id', id)
        .single();

      if (existingData) {
        // Update existing record
        const { error } = await supabase
          .from('ManufacturersDetails')
          .update(updateData)
          .eq('company_id', id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('ManufacturersDetails')
          .insert([updateData]);

        if (error) throw error;
      }

      setManufacturers(manufacturers.map(m => m.id === updatedManufacturer.id ? updatedManufacturer : m));
      setEditingManufacturer(null);
    } catch (error) {
      console.error('Error updating manufacturer:', error);
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const handleEdit = (manufacturer: Manufacturer) => {
    setEditingManufacturer(manufacturer)
  }

  const handleDelete = async (id: number) => {
    const { error } = await supabase
      .from('ManufacturersDetails')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting manufacturer:', error)
    } else {
      setManufacturers(manufacturers.filter(m => m.id !== id))
    }
  }

  const toggleColumnVisibility = (column: string) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }))
  }

  const renderTableHeaders = () => {
    return Object.entries(columnGroups).map(([groupName, columns]) => (
      <React.Fragment key={groupName}>
        {columns.map(column => (
          <TableHead
            key={column.key}
            className="sticky top-0 bg-white text-center text-[12px] text-black font-bold border border-gray-200 py-2 px-3"
            onClick={() => requestSort(column.key)}
          >
            <Button
              variant="ghost"
              onClick={() => requestSort(column.key)}
              className="h-8 p-0 text-[12px] text-black font-bold capitalize py-2 px-3"
            >
              <span>{column.label}</span>
              <ArrowUpDown className={`ml-2 h-4 w-4 ${sortConfig.key === column.key ? 'text-blue-600' : 'text-gray-400'} ${sortConfig.key === column.key && sortConfig.direction === 'descending' ? 'rotate-180' : ''}`} />
            </Button>
          </TableHead>
        ))}
      </React.Fragment>
    ));
  }

  const calculateTotals = () => {
    const totals = {
      overall: {
        total: 0,
        complete: 0,
        pending: 0,
        missing: 0,
      },
    };

    manufacturers.forEach(manufacturer => {
      totals.overall.total += 1;
      let isComplete = true;

      for (const key in manufacturer) {
        if (!totals[key]) {
          totals[key] = { total: 0, complete: 0, pending: 0, missing: 0 };
        }
        totals[key].total += 1;

        if (manufacturer[key] === null || manufacturer[key] === '') {
          isComplete = false;
          totals[key].pending += 1;
        } else {
          totals[key].complete += 1;
        }

        if (key === 'kra_pin' && !manufacturer[key]) {
          totals[key].missing += 1;
        }
      }

      if (isComplete) {
        totals.overall.complete += 1;
      } else {
        totals.overall.pending += 1;
      }

      if (!manufacturer.kra_pin) {
        totals.overall.missing += 1;
      }
    });

    // Ensure all keys are initialized
    Object.keys(manufacturers[0] || {}).forEach(key => {
      if (!totals[key]) {
        totals[key] = { total: 0, complete: 0, pending: 0, missing: 0 };
      }
    });

    return totals;
  };

  const totals = calculateTotals();

  const renderTotalsRow = () => (
    <>
      <TableRow className="bg-gray-100 border-b">
        {Object.keys(totals).map((key) => (
          <TableCell key={key} className="font-bold uppercase px-1 text-center" style={{ height: '10px', fontSize: '10px' }}>{key === 'overall' ? 'Total' : key}</TableCell>
        ))}
      </TableRow>
      <TableRow className="bg-gray-100 border-b">
        {Object.keys(totals).map((key) => (
          <TableCell key={key} className="text-center px-1" style={{ height: '10px', fontSize: '10px' }}>{totals[key].complete}</TableCell>
        ))}
      </TableRow>
      <TableRow className="bg-gray-100 border-b">
        {Object.keys(totals).map((key) => (
          <TableCell key={key} className="text-center px-1" style={{ height: '10px', fontSize: '10px' }}>{totals[key].pending}</TableCell>
        ))}
      </TableRow>
      <TableRow className="bg-gray-100 border-b">
        {Object.keys(totals).map((key) => (
          <TableCell key={key} className="text-center px-1 bg-red-100" style={{ height: '10px', fontSize: '10px' }}>{totals[key].missing}</TableCell>
        ))}
      </TableRow>
    </>
  );

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Manufacturers')

    // Add headers
    const headers = Object.keys(manufacturers[0])
      .filter(key => visibleColumns[key])
      .map(header => {
        return header
          .split(/(?=[A-Z])/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      })
    worksheet.addRow(['Index', ...headers])

    // Add data
    manufacturers.forEach((manufacturer, index) => {
      const row = Object.keys(manufacturers[0])
        .filter(key => visibleColumns[key])
        .map(header => manufacturer[header])
      worksheet.addRow([index + 1, ...row])
    })

    // Style the header row
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF00' }
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
      cell.font = { bold: true }
    })

    // Style all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (rowNumber > 1) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
          if (cell.value === 'MISSING') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF0000' }
            }
          }
        }
      })
    })

    // Autofit columns
    worksheet.columns.forEach((column) => {
      let maxLength = 0
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10
        if (columnLength > maxLength) {
          maxLength = columnLength
        }
      })
      column.width = maxLength < 10 ? 10 : maxLength
    })

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'manufacturers_report.xlsx'
    link.click()
  }

  const uniqueManufacturers = manufacturers.filter((manufacturer, index, self) =>
    index === self.findIndex((m) => (
      m.company_name === manufacturer.company_name
    ))
  );

  useEffect(() => {
    if (!manufacturers.length) return;

    const sortedManufacturers = [...manufacturers].sort((a, b) => {
      return a.company_name.localeCompare(b.company_name);
    });

    const filteredResults = sortedManufacturers.filter(manufacturer => {
      // Search term filtering
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const searchFields = [
          manufacturer.company_name,
          manufacturer.kra_pin,
          manufacturer.manufacturer_name,
          manufacturer.itax_mobile_number,
          manufacturer.itax_main_email_address
        ];
        const matchesSearch = searchFields.some(field =>
          field?.toString().toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }

      // Category filtering
      const selectedCategories = Object.entries(categoryFilters.categories || {})
        .filter(([category, isSelected]) => category && category !== 'All Categories' && isSelected)
        .map(([category]) => category);

      // If no categories selected or All Categories is selected, include all
      if (selectedCategories.length === 0 || categoryFilters.categories?.['All Categories']) {
        return true;
      }

      return selectedCategories.some(category => {
        const categoryId = category.toLowerCase().slice(0, 3);
        const fromDate = manufacturer[`${categoryId}_client_effective_from`];
        const toDate = manufacturer[`${categoryId}_client_effective_to`];

        // If no dates are set, this company doesn't belong to this category
        if (!fromDate || !toDate) {
          return false;
        }

        // Calculate current status based on today's date
        const today = new Date();
        const effectiveFrom = new Date(fromDate.split('/').reverse().join('-'));
        const effectiveTo = new Date(toDate.split('/').reverse().join('-'));
        const currentStatus = today >= effectiveFrom && today <= effectiveTo ? 'active' : 'inactive';

        // Get selected statuses from filter
        const categorySettings = categoryFilters.categorySettings?.[category];
        if (!categorySettings?.clientStatus) {
          return true;
        }

        const selectedClientStatuses = Object.entries(categorySettings.clientStatus)
          .filter(([_, isSelected]) => isSelected)
          .map(([status]) => status.toLowerCase());

        // If All is selected or no statuses selected, include all
        if (selectedClientStatuses.includes('all') || selectedClientStatuses.length === 0) {
          return true;
        }

        // Check if current status matches selected filters
        return selectedClientStatuses.includes(currentStatus);
      });
    });

    setFilteredManufacturers(filteredResults);
  }, [manufacturers, searchTerm, categoryFilters]);

  // Sort the filtered manufacturers for display
  const handleApplyFilters = (newFilters: any) => {
    setCategoryFilters(newFilters);
  };

  const handleClearFilters = () => {
    setCategoryFilters({ categories: {}, categorySettings: {} });
  };

  const requestSort = (key: string) => {
    let direction = 'ascending';
    if (sortConfig.key === key) {
      direction = sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    }
    setSortConfig({ key, direction });
  };

  const sortData = (data: any[], key: string | null, direction: 'ascending' | 'descending') => {
    if (!key) return data;

    return [...data].sort((a, b) => {
      const aValue = a[key];
      const bValue = b[key];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return direction === 'ascending' ? 1 : -1;
      if (bValue === null || bValue === undefined) return direction === 'ascending' ? -1 : 1;

      // Handle dates
      if (key.includes('date') || key.includes('_at')) {
        const dateA = new Date(aValue);
        const dateB = new Date(bValue);
        return direction === 'ascending' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      }

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ascending' ? aValue - bValue : bValue - aValue;
      }

      // Handle strings (case-insensitive)
      const stringA = String(aValue).toLowerCase();
      const stringB = String(bValue).toLowerCase();
      return direction === 'ascending' ? stringA.localeCompare(stringB) : stringB.localeCompare(stringA);
    });
  };
  const sortedManufacturers = sortData(filteredManufacturers, sortConfig.key, sortConfig.direction);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Manufacturers Details Reports</h3>
        <div className="space-x-2">
          <Button variant="outline" onClick={fetchReports} size="sm">
            <RefreshCw className="h-3 w-3 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToExcel} size="sm">
            <Download className="h-3 w-3 mr-2" />
            Export to Excel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Column Visibility</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.keys(visibleColumns).map((column) => (
                <DropdownMenuCheckboxItem
                  key={column}
                  checked={visibleColumns[column]}
                  onCheckedChange={() => toggleColumnVisibility(column)}
                >
                  {column.replace(/_/g, ' ').charAt(0).toUpperCase() + column.replace(/_/g, ' ').slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* <Button variant="destructive" onClick={handleDeleteAll} size="sm">Delete All</Button> */}
        </div>
      </div>
      <div className="flex space-x-2">
        <Input
          placeholder="Search Manufacturers..."
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
        open={isCategoryFilterOpen}
        onOpenChange={setIsCategoryFilterOpen}
        onFilterChange={handleApplyFilters}
        showSectionName=""
        initialFilters={categoryFilters}
        showSectionStatus={false}
      />

      <div className="rounded-md border flex-1 flex flex-col relative">
        <div className="overflow-x-auto">
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <Table className="text-[11px] text-black border-collapse w-full relative">
              <style jsx>{`
                .sticky-col {
                  position: sticky;
                  background: white;
                  z-index: 10;
                }
                .index-col {
                  left: 0;
                }
                .company-col {
                  left: 50px;
                }
              `}</style>
              <TableHeader className="bg-gray-50">
                {/* Group Headers Row */}
                <TableRow className="uppercase border-b border-gray-200">
                  <TableHead className="sticky top-0 bg-white text-center text-[12px] text-black font-bold border border-gray-200 py-2 px-3 sticky-col index-col" style={{ minWidth: '50px', top: 0 }} rowSpan={2}>Index</TableHead>
                  {Object.entries(columnGroups).map(([groupName, columns], index) => (
                    <TableHead
                      key={groupName}
                      className="sticky top-0 bg-white text-center text-[12px] text-black font-bold border border-gray-200 py-2 px-3"
                      colSpan={columns.length}
                      style={{ top: 0 }}
                    >
                      {groupName.replace(/([A-Z])/g, ' $1').trim()}
                    </TableHead>
                  ))}
                  <TableHead className="sticky top-0 bg-white text-center text-[12px] text-black font-bold border border-gray-200 py-2 px-3" style={{ top: 0 }} rowSpan={2}>Actions</TableHead>
                </TableRow>
                {/* Column Headers Row */}
                <TableRow className="border-b border-gray-200">
                  {Object.entries(columnGroups).map(([groupName, columns]) => (
                    <React.Fragment key={groupName}>
                      {columns.map(column => (
                        <TableHead
                          key={column.key}
                          className={`sticky bg-white text-center text-[11px] text-black font-medium border border-gray-200 py-2 px-3 ${column.key === 'company_name' ? 'sticky-col company-col' : ''}`}
                          onClick={() => requestSort(column.key)}
                          style={{ top: '40px' }}
                        >
                          <Button
                            variant="ghost"
                            onClick={() => requestSort(column.key)}
                            className="h-6 p-0 text-[11px] text-black font-medium capitalize py-1 px-2"
                          >
                            <span>{column.label}</span>
                            <ArrowUpDown className={`ml-1 h-3 w-3 ${sortConfig.key === column.key ? 'text-blue-600' : 'text-gray-400'} ${sortConfig.key === column.key && sortConfig.direction === 'descending' ? 'rotate-180' : ''}`} />
                          </Button>
                        </TableHead>
                      ))}
                    </React.Fragment>
                  ))}
                </TableRow>
                {showStatsRows && (
                  <>
                    <TableRow className="bg-gray-100">
                      <TableCell className="text-center text-[10px] font-bold">Complete</TableCell>
                      {Object.values(columnGroups).flatMap(columns => 
                        columns.map(column => {
                          const completeCount = filteredManufacturers.filter(m => m[column.key] && m[column.key].toString().trim() !== '').length;
                          const percentage = Math.round((completeCount / filteredManufacturers.length) * 100);
                          return (
                            <TableCell key={`complete-${column.key}`} className="text-center text-[10px]">
                              <span className={percentage === 100 ? 'text-green-600 font-bold' : ''}>
                                {completeCount}
                              </span>
                            </TableCell>
                          );
                        })
                      )}
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow className="bg-gray-50">
                      <TableCell className="text-center text-[10px] font-bold">Missing</TableCell>
                      {Object.values(columnGroups).flatMap(columns => 
                        columns.map(column => {
                          const missingCount = filteredManufacturers.filter(m => !m[column.key] || m[column.key].toString().trim() === '').length;
                          const percentage = Math.round((missingCount / filteredManufacturers.length) * 100);
                          return (
                            <TableCell key={`missing-${column.key}`} className="text-center text-[10px]">
                              <span className={percentage > 0 ? 'text-red-600 font-bold' : ''}>
                                {missingCount}
                              </span>
                            </TableCell>
                          );
                        })
                      )}
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={Object.values(columnGroups).reduce((acc, columns) => acc + columns.length, 0) + 2} className="h-[200px]">
                      <div className="flex items-center justify-center w-full h-full">
                        <Spinner />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedManufacturers.map((manufacturer, index) => (
                    <TableRow key={manufacturer.id} className={`h-8 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <TableCell className="text-center font-bold sticky-col index-col" style={{ minWidth: '50px' }}>{index + 1}</TableCell>
                      {Object.values(columnGroups).flatMap(columns =>
                        columns.map(column => (
                          <TableCell 
                            key={column.key} 
                            className={`${column.key === 'company_name' ? 'text-left whitespace-nowrap font-bold sticky-col company-col' : 'text-center'}`}
                            style={column.key === 'company_name' ? { minWidth: '200px' } : undefined}
                          >
                            {manufacturer[column.key] || <span className="font-bold text-red-500">Missing</span>}
                          </TableCell>
                        ))
                      )}
                      <TableCell className="text-center">
                        <div className="flex justify-center space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => handleEdit(manufacturer)}>Edit</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px]">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-semibold">Edit Manufacturer Details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto px-1">
                                {Object.entries(columnGroups).map(([groupName, columns]) => (
                                  <div key={groupName} className="space-y-4 bg-gray-50 p-4 rounded-lg shadow-sm">
                                    <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">
                                      {groupName.replace(/([A-Z])/g, ' $1').trim()}
                                    </h4>
                                    <div className="grid gap-3">
                                      {columns.map(column => (
                                        <div key={column.key} className="grid grid-cols-5 items-center gap-4">
                                          <Label htmlFor={column.key} className="text-right text-xs font-medium text-gray-600 col-span-2">
                                            {column.label}
                                          </Label>
                                          <Input
                                            id={column.key}
                                            value={editingManufacturer?.[column.key] || ''}
                                            onChange={(e) => setEditingManufacturer(prev => ({ ...prev, [column.key]: e.target.value }))}
                                            className="col-span-3 text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder={`Enter ${column.label.toLowerCase()}`}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-end space-x-2 pt-4 border-t">
                                <DialogClose asChild>
                                  <Button variant="outline" size="sm">Cancel</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                  <Button size="sm" onClick={() => handleSave(editingManufacturer)} className="bg-blue-600 hover:bg-blue-700">
                                    Save Changes
                                  </Button>
                                </DialogClose>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <tfoot>
                <tr><td className="py-4"></td></tr>
              </tfoot>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}