// components/ManufacturersDetailsReports.tsx
// @ts-nocheck
"use client";

import { useEffect, useState } from 'react'
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
  kra_pin: string
  manufacturer_name: string
  itax_mobile_number: string
  itax_main_email_address: string
  itax_business_reg_cert_no: string
  itax_business_reg_date: string
  itax_business_commencement_date: string
  itax_postal_code: string
  itax_po_box: string
  itax_town: string
  desc_addr: string
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

export function ManufacturersDetailsReports() {
  const [isLoading, setIsLoading] = useState(false);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [filteredManufacturers, setFilteredManufacturers] = useState<Manufacturer[]>([]);
  const [searchTerm, setSearchTerm] = useState('')
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null)
  const [visibleColumns, setVisibleColumns] = useState({
    company_name: true,
    kra_pin: true,
    manufacturer_name: false,
    itax_mobile_number: true,
    itax_main_email_address: true,
    itax_business_reg_cert_no: true,
    itax_business_reg_date: true,
    itax_business_commencement_date: true,
    itax_postal_code: true,
    itax_po_box: true,
    itax_town: true,
    desc_addr: false,
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
          manufacturer_name: manufacturerDetails.manufacturer_name || null,
          itax_mobile_number: manufacturerDetails.itax_mobile_number || null,
          itax_main_email_address: manufacturerDetails.itax_main_email_address || null,
          itax_business_reg_cert_no: manufacturerDetails.itax_business_reg_cert_no || null,
          itax_business_reg_date: manufacturerDetails.itax_business_reg_date || null,
          itax_business_commencement_date: manufacturerDetails.itax_business_commencement_date || null,
          itax_postal_code: manufacturerDetails.itax_postal_code || null,
          itax_po_box: manufacturerDetails.itax_po_box || null,
          itax_town: manufacturerDetails.itax_town || null,
          desc_addr: manufacturerDetails.itax_desc_addr || null,
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

      <div className="rounded-md border flex-1 flex flex-col relative min-h-[200px]">
        <div className="overflow-x-auto">
          <div className="max-h-[calc(100vh-550px)] overflow-y-auto">
            <Table className="text-[11px] text-black border-collapse w-full">
              <TableHeader className="bg-gray-50">
                <TableRow className="border-b border-gray-200">
                  <TableHead className="sticky top-0 bg-white text-center text-[12px] text-black font-bold border border-gray-200 py-2 px-3">Index</TableHead>
                  {Object.entries(visibleColumns).map(([column, isVisible]) => (
                    isVisible && (
                      <TableHead
                        key={column}
                        className={`sticky top-0 bg-white border border-gray-200 ${column === 'company_name' ? 'text-left' : 'text-center'}`}
                        onClick={() => requestSort(column)}
                      >
                        <Button
                          variant="ghost"
                          onClick={() => requestSort(column)}
                          className="h-8 p-0 text-[12px] text-black font-bold capitalize py-2 px-3"
                        >
                          <span>{column.replace(/_/g, ' ').charAt(0).toUpperCase() + column.replace(/_/g, ' ').slice(1)}</span>
                          <ArrowUpDown className={`ml-2 h-4 w-4 ${sortConfig.key === column ? 'text-blue-600' : 'text-gray-400'} ${sortConfig.key === column && sortConfig.direction === 'descending' ? 'rotate-180' : ''}`} />
                        </Button>
                      </TableHead>
                    )
                  ))}
                  <TableHead className="sticky top-0 bg-white text-center text-[12px] text-black font-bold border border-gray-200 py-2 px-3">Actions</TableHead>
                </TableRow>
                {showStatsRows && (
                  <>
                    <TableRow className="bg-gray-100">
                      <TableCell className="text-center text-[10px] font-bold">Complete</TableCell>
                      {Object.entries(visibleColumns).map(([column, isVisible]) => {
                        if (!isVisible) return null;
                        const completeCount = filteredManufacturers.filter(m => m[column] && m[column].toString().trim() !== '').length;
                        const percentage = Math.round((completeCount / filteredManufacturers.length) * 100);
                        return (
                          <TableCell key={`complete-${column}`} className="text-center text-[10px]">
                            <span className={percentage === 100 ? 'text-green-600 font-bold' : ''}>
                              {completeCount}
                            </span>
                          </TableCell>
                        );
                      })}
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow className="bg-gray-50">
                      <TableCell className="text-center text-[10px] font-bold">Missing</TableCell>
                      {Object.entries(visibleColumns).map(([column, isVisible]) => {
                        if (!isVisible) return null;
                        const missingCount = filteredManufacturers.filter(m => !m[column] || m[column].toString().trim() === '').length;
                        const percentage = Math.round((missingCount / filteredManufacturers.length) * 100);
                        return (
                          <TableCell key={`missing-${column}`} className="text-center text-[10px]">
                            <span className={percentage > 0 ? 'text-red-600 font-bold' : ''}>
                              {missingCount}
                            </span>
                          </TableCell>
                        );
                      })}
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 2} className="h-[200px]">
                      <div className="flex items-center justify-center w-full h-full">
                        <Spinner />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedManufacturers.map((manufacturer, index) => (
                    <TableRow key={manufacturer.id} className={`h-8 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <TableCell className="text-center font-bold">{index + 1}</TableCell>
                      {Object.entries(visibleColumns).map(([column, isVisible]) => (
                        isVisible && (
                          <TableCell key={column} className={`${column === 'company_name' ? 'text-left whitespace-nowrap font-bold' : 'text-center'}`}>
                            {manufacturer[column] ? (
                              column === 'manufacturer_name' ? manufacturer[column].toUpperCase() : manufacturer[column]
                            ) : (
                              <span className="font-bold text-red-500">Missing</span>
                            )}
                          </TableCell>
                        )
                      ))}
                      <TableCell className="text-center">
                        <div className="flex justify-center space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => handleEdit(manufacturer)}>Edit</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[350px]">
                              <DialogHeader>
                                <DialogTitle>Edit Manufacturer Details</DialogTitle>
                              </DialogHeader>
                              <div className="grid gap-2 py-2">
                                {Object.entries(editingManufacturer || {}).map(([key, value]) => (
                                  <div key={key} className="grid grid-cols-4 items-center gap-2">
                                    <Label htmlFor={key} className="text-right text-xs">
                                      {key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)}
                                    </Label>
                                    <Input
                                      id={key}
                                      value={value}
                                      onChange={(e) => setEditingManufacturer({ ...editingManufacturer, [key]: e.target.value })}
                                      className="col-span-3 text-xs"
                                    />
                                  </div>
                                ))}
                              </div>
                              <DialogClose asChild>
                                <Button size="sm" onClick={() => handleSave(editingManufacturer)}>Save Changes</Button>
                              </DialogClose>
                            </DialogContent>
                          </Dialog>
                          {/* <Button variant="destructive" size="sm" onClick={() => handleDelete(manufacturer.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button> */}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {/* Spacer row to ensure last items are visible */}
              <tr><td className="py-4"></td></tr>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}