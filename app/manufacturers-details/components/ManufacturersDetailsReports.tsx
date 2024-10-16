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
import { Trash2, RefreshCw, Download, Eye, EyeOff } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Manufacturer {
  id: number
  company_name: string
  kra_pin: string
  manufacturer_name: string
  mobile_number: string
  main_email_address: string
  business_reg_cert_no: string
  business_reg_date: string
  business_commencement_date: string
  postal_code: string
  po_box: string
  town: string
  desc_addr: string
}

export function ManufacturersDetailsReports() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null)
  const [visibleColumns, setVisibleColumns] = useState({
    company_name: true,
    kra_pin: true,
    manufacturer_name: false,
    mobile_number: true,
    main_email_address: true,
    business_reg_cert_no: true,
    business_reg_date: true,
    business_commencement_date: true,
    postal_code: true,
    po_box: true,
    town: true,
    desc_addr: false,
  })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' })

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('ManufacturersDetails')
      .select('*')
      .order('company_name', { ascending: true })

    if (error) {
      console.error('Error fetching reports:', error)
    } else {
      setManufacturers(data || [])
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const handleEdit = (manufacturer: Manufacturer) => {
    setEditingManufacturer(manufacturer)
  }

  const handleSave = async (updatedManufacturer: Manufacturer) => {
    const { id, ...updateData } = updatedManufacturer
    const { error } = await supabase
      .from('ManufacturersDetails')
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
      .from('ManufacturersDetails')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting manufacturer:', error)
    } else {
      setManufacturers(manufacturers.filter(m => m.id !== id))
    }
  }

  const handleDeleteAll = async () => {
    const { error } = await supabase
      .from('ManufacturersDetails')
      .delete()
      .neq('id', 0)  // This will delete all rows

    if (error) {
      console.error('Error deleting all manufacturers:', error)
    } else {
      setManufacturers([])
    }
  }

  const toggleColumnVisibility = (column: string) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }))
  }

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

  const sortedManufacturers = [...manufacturers].sort((a, b) => {
    if (sortConfig.key !== null) {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1
      }
    }
    return 0
  })

  const requestSort = (key: string) => {
    let direction = 'ascending'
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending'
    }
    setSortConfig({ key, direction })
  }

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
          <Button variant="destructive" onClick={handleDeleteAll} size="sm">Delete All</Button>
        </div>
      </div>
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <Table className="text-[11px] pb-2 text-black">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center text-black">Index</TableHead>
                  {Object.entries(visibleColumns).map(([column, isVisible]) => (
                    isVisible && (
                      <TableHead
                        key={column}
                        className={`cursor-pointer text-black capitalize ${column === 'company_name' ? 'text-left' : 'text-center'}`}
                        onClick={() => requestSort(column)}
                      >
                        {column.replace(/_/g, ' ').charAt(0).toUpperCase() + column.replace(/_/g, ' ').slice(1)}
                        {sortConfig.key === column && (
                          <span>{sortConfig.direction === 'ascending' ? ' ▲' : ' ▼'}</span>
                        )}
                      </TableHead>
                    )
                  ))}
                  <TableHead className="text-center text-black">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedManufacturers.map((manufacturer, index) => (
                  <TableRow key={manufacturer.id} className={`h-8 ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}>
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
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(manufacturer.id)}>
                          <Trash2 className="h-4 w-4" />
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