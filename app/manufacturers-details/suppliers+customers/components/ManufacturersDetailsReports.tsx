// components/ManufacturersDetailsReports.tsx
// @ts-nocheck
"use client";

import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, RefreshCw, Download, Eye, EyeOff, Filter, ArrowUpDown } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ClientCategoryFilter } from "@/components/ClientCategoryFilter"
import { supabase } from '@/lib/supabase'
import { TablePagination } from "@/components/TablePagination"
import { fetchSuppliers, type Supplier } from '../utils/suppliers';

interface Manufacturer {
  id: number
  manufacturer_name: string
  pin_no: string
  itax_office_no: string
  itax_telephone_no: string
  itax_main_email_address: string
  itax_sec_email_address: string
  itax_website: string
  itax_town: string
  itax_postal_code: string
  itax_po_box: string
  itax_county: string
  itax_tax_area: string
  itax_business_name: string
  itax_business_reg_cert_no: string
  itax_business_reg_date: string
  itax_business_commenced_date: string
  category: string
  status: string
}

export function ManufacturersDetailsReports() {
  const [manufacturers, setManufacturers] = useState<Supplier[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [editingManufacturer, setEditingManufacturer] = useState<Supplier | null>(null)
  const [visibleColumns, setVisibleColumns] = useState({
    manufacturer_name: { visible: true, label: 'Manufacturer\'s Name' },
    pin_no: { visible: true, label: 'PIN Number' },
    itax_office_no: { visible: false, label: 'Office Number' },
    itax_telephone_no: { visible: true, label: 'Telephone Number' },
    itax_main_email_address: { visible: true, label: 'Main Email' },
    itax_sec_email_address: { visible: false, label: 'Secondary Email' },
    itax_website: { visible: false, label: 'Website' },
    itax_town: { visible: true, label: 'Town' },
    itax_postal_code: { visible: true, label: 'Postal Code' },
    itax_po_box: { visible: true, label: 'P.O Box' },
    itax_county: { visible: false, label: 'County' },
    itax_tax_area: { visible: false, label: 'Tax Area' },
    itax_business_name: { visible: true, label: 'Business Name' },
    itax_business_reg_cert_no: { visible: true, label: 'Registration Number' },
    itax_business_reg_date: { visible: true, label: 'Registration Date' },
    itax_business_commenced_date: { visible: true, label: 'Commencement Date' },
  })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' })
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false)
  const [categoryFilters, setCategoryFilters] = useState({})
  const [showStatsRows, setShowStatsRows] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const fetchReports = async () => {
    try {
      const data = await fetchSuppliers()
      setManufacturers(data || [])
    } catch (error) {
      console.error('Error fetching reports:', error)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const handleEdit = (manufacturer: Supplier) => {
    setEditingManufacturer(manufacturer)
  }

  const handleSave = async (updatedManufacturer: Supplier) => {
    const { id, ...updateData } = updatedManufacturer
    const { error } = await supabase
      .from('acc_portal_kra_pins_suppliers_and_customers')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('Error updating manufacturer:', error)
    } else {
      setManufacturers(manufacturers.map(m => m.id === updatedManufacturer.id ? updatedManufacturer : m))
      setEditingManufacturer(null)
    }
  }

  const handleDelete = async (id: number) => {
    const { error } = await supabase
      .from('acc_portal_kra_pins_suppliers_and_customers')
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

        if (key === 'pin_no' && !manufacturer[key]) {
          totals[key].missing += 1;
        }
      }

      if (isComplete) {
        totals.overall.complete += 1;
      } else {
        totals.overall.pending += 1;
      }

      if (!manufacturer.pin_no) {
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
      <TableRow className="bg-gray-100 border-b border-gray-200">
        {Object.keys(totals).map((key) => (
          <TableCell key={key} className="font-bold uppercase px-1 text-center" style={{ height: '10px', fontSize: '10px' }}>{key === 'overall' ? 'Total' : key}</TableCell>
        ))}
      </TableRow>
      <TableRow className="bg-gray-100 border-b border-gray-200">
        {Object.keys(totals).map((key) => (
          <TableCell key={key} className="text-center px-1" style={{ height: '10px', fontSize: '10px' }}>{totals[key].complete}</TableCell>
        ))}
      </TableRow>
      <TableRow className="bg-gray-100 border-b border-gray-200">
        {Object.keys(totals).map((key) => (
          <TableCell key={key} className="text-center px-1" style={{ height: '10px', fontSize: '10px' }}>{totals[key].pending}</TableCell>
        ))}
      </TableRow>
      <TableRow className="bg-gray-100 border-b border-gray-200">
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
      m.pin_no === manufacturer.pin_no
    ))
  );

  const sortedManufacturers = [...uniqueManufacturers].sort((a, b) => {
    if (sortConfig.key !== null) {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Put missing values at the top when sorting
      if (!aValue && !bValue) return 0;
      if (!aValue) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (!bValue) return sortConfig.direction === 'ascending' ? 1 : -1;

      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
    }
    return 0;
  });

  const filteredManufacturers = sortedManufacturers.filter(manufacturer => {
    // Apply search filter
    const matchesSearch = Object.entries(manufacturer).some(([key, value]) => {
      if (value === null || value === undefined) {
        return false;
      }
      return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (!matchesSearch) return false;

    // Apply category filters
    if (Object.keys(categoryFilters).length > 0) {
      // Check if any category filter is active
      const hasActiveFilters = Object.values(categoryFilters).some(categoryStatus =>
        Object.values(categoryStatus as Record<string, boolean>).some(isSelected => isSelected)
      );

      if (hasActiveFilters) {
        // Get the manufacturer's category and status
        const category = manufacturer.category || 'all';
        const status = manufacturer.status === 'active' ? 'active' : 'inactive';

        // Check if this category has any filters
        const categoryFilter = categoryFilters[category] as Record<string, boolean> | undefined;
        if (!categoryFilter) {
          // Check if 'all' category has this status selected
          const allCategoryFilter = categoryFilters['all'] as Record<string, boolean> | undefined;
          return allCategoryFilter?.[status] || allCategoryFilter?.['all'];
        }

        // Check if this specific status is selected for this category
        return categoryFilter[status] || categoryFilter['all'];
      }
    }

    return true;
  });

  const paginatedManufacturers = filteredManufacturers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: string) => {
    setPageSize(Number(size))
    setCurrentPage(1) // Reset to first page when changing page size
  }

  const requestSort = (key: string) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="flex justify-between items-center mb-4">
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
      <div className="flex space-x-2 mb-4">
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
        isOpen={isCategoryFilterOpen}
        onClose={() => setIsCategoryFilterOpen(false)}
        onApplyFilters={(filters) => setCategoryFilters(filters)}
        onClearFilters={() => setCategoryFilters({})}
        selectedFilters={categoryFilters}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <div className="rounded-md border flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <Table className="text-[11px] text-black border-collapse w-full">
              <TableHeader className="bg-gray-50">
                <TableRow className="border-b border-gray-200">
                  <TableHead className="sticky top-0 bg-white text-center text-[12px] text-black font-bold border border-gray-200 py-2 px-3">Index</TableHead>
                  {Object.entries(visibleColumns).map(([column, config]) => (
                    config.visible && (
                      <TableHead key={column} className="sticky top-0 bg-white border border-gray-200 "
                        onClick={() => requestSort(column)}>
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
                    <TableRow className="bg-gray-100 border-b border-gray-200">
                      <TableCell className="text-center text-[10px] font-bold border border-gray-200">Complete</TableCell>
                      {Object.entries(visibleColumns).map(([column, config]) => {
                        if (!config.visible) return null;
                        const completeCount = manufacturers.filter(m => m[column] && m[column].toString().trim() !== '').length;
                        const percentage = Math.round((completeCount / manufacturers.length) * 100);
                        return (
                          <TableCell key={`complete-${column}`} className="text-center text-[10px] border border-gray-200">
                            <span className={percentage === 100 ? 'text-green-600 font-bold' : ''}>
                              {completeCount}
                            </span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="border border-gray-200"></TableCell>
                    </TableRow>
                    <TableRow className="bg-gray-50 border-b border-gray-200">
                      <TableCell className="text-center text-[10px] font-bold border border-gray-200">Missing</TableCell>
                      {Object.entries(visibleColumns).map(([column, config]) => {
                        if (!config.visible) return null;
                        const missingCount = manufacturers.filter(m => !m[column] || m[column].toString().trim() === '').length;
                        const percentage = Math.round((missingCount / manufacturers.length) * 100);
                        return (
                          <TableCell key={`missing-${column}`} className="text-center text-[10px] border border-gray-200">
                            <span className={percentage > 0 ? 'text-red-600 font-bold' : ''}>
                              {missingCount}
                            </span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="border border-gray-200"></TableCell>
                    </TableRow>
                  </>
                )}
              </TableHeader>
              <TableBody>
                {paginatedManufacturers.map((manufacturer, index) => (
                  <TableRow key={manufacturer.id} className={`h-8 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}>
                    <TableCell className="font-bold border border-gray-200">{index + 1}</TableCell>
                    {Object.entries(visibleColumns).map(([column, config]) => (
                      config.visible && (
                        <TableCell key={column} className={`border border-gray-200 py-2 px-3 ${column === 'pin_no' ? 'text-left whitespace-nowrap font-bold' : ''}`}>
                          {manufacturer[column] ? (
                            manufacturer[column]
                          ) : (
                            <span className="font-bold text-red-500">Missing</span>
                          )}
                        </TableCell>
                      )
                    ))}
                    <TableCell className="text-center border border-gray-200">
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {/* Spacer row to ensure last items are visible */}

              <tr><td className="py-4"></td></tr>

            </Table>

          </div>

          <div className="border-t bg-white">
            <TablePagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredManufacturers.length}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>

        </div>
      </div>

    </div>

  )

}