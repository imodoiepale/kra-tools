// components/PasswordCheckerReports.tsx
// @ts-nocheck
import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Download } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import ExcelJS from 'exceljs'

interface Company {
  id: number
  company_name: string
  kra_pin: string
  kra_password: string
  status: string
  last_checked: string
}

export  default function PasswordCheckerReports() {
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [newCompany, setNewCompany] = useState<Partial<Company>>({
    company_name: '',
    kra_pin: '',
    kra_password: '',
  })
  const [activeTab, setActiveTab] = useState('PasswordChecker')
  const [companies, setCompanies] = useState<Company[]>([])

  useEffect(() => {
    const fetchReports = async () => {
      const { data, error } = await supabase
        .from(activeTab)
        .select('*')
        .order('id')
  
      if (error) {
        console.error(`Error fetching reports from ${activeTab}:`, error)
      } else {
        setCompanies(data || [])
      }
    }
  
    fetchReports()
  }, [activeTab])
  const handleEdit = (company: Company) => {
    setEditingCompany(company)
  }

  const handleSave = async (updatedCompany: Company) => {
    const { id, ...updateData } = updatedCompany
    const { error } = await supabase
      .from('PasswordChecker')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('Error updating company:', error)
    } else {
      setCompanies(companies.map(c => c.id === updatedCompany.id ? updatedCompany : c))
      setEditingCompany(null)
    }
  }

  const handleDelete = async (id: number) => {
    const { error } = await supabase
      .from('PasswordChecker')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting company:', error)
    } else {
      setCompanies(companies.filter(c => c.id !== id))
    }
  }

  const handleDeleteAll = async () => {
    const { error } = await supabase
      .from('PasswordChecker')
      .delete()
      .neq('id', 0)  // This will delete all rows

    if (error) {
      console.error('Error deleting all companies:', error)
    } else {
      setCompanies([])
    }
  }

  const handleAddCompany = async () => {
    const { data, error } = await supabase
      .from('PasswordChecker')
      .insert([newCompany])
      .select()

    if (error) {
      console.error('Error adding company:', error)
    } else {
      setCompanies([...companies, data[0]])
      setNewCompany({
        company_name: '',
        kra_pin: '',
        kra_password: '',
      })
    }
  }

  const handleDownloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Password Check Reports');
  
    // Add headers starting from B2
    const headers = ['Index', 'Company Name', 'KRA PIN', 'KRA Password', 'Status', 'Last Checked'];
    
    worksheet.addRow([]); // Create empty first row
    const headerRow = worksheet.getRow(2);
    headers.forEach((header, i) => {
      headerRow.getCell(i + 2).value = header; // Start from column B
    });
  
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' }
      };
    });
  
    // Add data starting from row 3 (B3 onwards)
    companies.forEach((company, index) => {
      const row = worksheet.addRow([
        '', // Empty cell in column A
        index + 1, // Index in B
        company.company_name, // Company Name in C
        company.kra_pin, // KRA PIN in D
        company.kra_password, // KRA Password in E
        company.status, // Status in F
        company.last_checked ? new Date(company.last_checked).toLocaleString() : 'Missing' // Last Checked in G
      ]);
  
      // Center-align the index column (column B)
      row.getCell(2).alignment = { horizontal: 'center' };
  
      // Set status cell background color
      const statusCell = row.getCell(6); // Status is in column F (6th column)
      if (company.status.toLowerCase() === 'valid') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF90EE90' } // Light green for valid
        };
      } else if (company.status.toLowerCase() === 'invalid') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF6347' } // Tomato red for invalid
        };
      } else {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFD700' } // Gold for other statuses
        };
      }
    });
  
    // Auto-fit columns based on their content
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value ? cell.value.toString().length : 10;
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      });
      column.width = maxLength + 2; // Add padding for better readability
    });
  
    // Add borders to all cells, except column A (empty column)
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > 1) { // Skip borders for column A
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      });
    });
  
    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
  
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'password_check_reports.xlsx';
    link.click();
  
    // Clean up
    URL.revokeObjectURL(url);
  };
  

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Password Check Reports</h3>
        <div className="flex space-x-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm">Add New Company</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Add New Company</SheetTitle>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={newCompany.company_name}
                    onChange={(e) => setNewCompany({ ...newCompany, company_name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="kra_pin">KRA PIN</Label>
                  <Input
                    id="kra_pin"
                    value={newCompany.kra_pin}
                    onChange={(e) => setNewCompany({ ...newCompany, kra_pin: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="kra_password">KRA Password</Label>
                  <Input
                    id="kra_password"
                    type="password"
                    value={newCompany.kra_password}
                    onChange={(e) => setNewCompany({ ...newCompany, kra_password: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    id="status"
                    value={newCompany.status}
                    onValueChange={(value) => setNewCompany({ ...newCompany, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="valid">Valid</SelectItem>
                      <SelectItem value="invalid">Invalid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SheetClose asChild>
                <Button size="sm" onClick={handleAddCompany}>Add Company</Button>
              </SheetClose>
            </SheetContent>
          </Sheet>
          <Button size="sm" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            Download Excel
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDeleteAll}>
            Delete All
          </Button>
        </div>
      </div>
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <Table className="text-sm pb-4">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Index</TableHead>
                  <TableHead>Company Name</TableHead>
                  <TableHead className="text-center">KRA PIN</TableHead>
                  <TableHead className="text-center">KRA Password</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Last Checked</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company, index) => (
                  <TableRow key={company.id} className={`h-10 ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}>
                    <TableCell className="text-center">{index + 1}</TableCell>
                    <TableCell>{company.company_name || <span className="font-bold text-red-600">Missing</span>}</TableCell>
                    <TableCell className="text-center">{company.kra_pin || <span className="font-bold text-red-600">Missing</span>}</TableCell>
                    <TableCell className="text-center">{company.kra_password || <span className="font-bold text-red-600">Missing</span>}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(company.status)}`}>
                        {company.status || <span className="font-bold text-red-600">Missing</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{company.last_checked ? new Date(company.last_checked).toLocaleString() : <span className="font-bold text-red-600">Missing</span>}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => handleEdit(company)}>Edit</Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Edit Company</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="company_name">Company Name</Label>
                                <Input
                                  id="company_name"
                                  value={editingCompany?.company_name}
                                  onChange={(e) => setEditingCompany({ ...editingCompany, company_name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="kra_pin">KRA PIN</Label>
                                <Input
                                  id="kra_pin"
                                  value={editingCompany?.kra_pin}
                                  onChange={(e) => setEditingCompany({ ...editingCompany, kra_pin: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="kra_password">KRA Password</Label>
                                <Input
                                  id="kra_password"
                                  value={editingCompany?.kra_password}
                                  onChange={(e) => setEditingCompany({ ...editingCompany, kra_password: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="status">Status</Label>
                                <Input
                                  id="status"
                                  value={editingCompany?.status}
                                  onChange={(e) => setEditingCompany({ ...editingCompany, status: e.target.value })}
                                  disabled
                                />
                              </div>
                            </div>
                            <DialogClose asChild>
                              <Button onClick={() => handleSave(editingCompany)}>Save Changes</Button>
                            </DialogClose>
                          </DialogContent>
                        </Dialog>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(company.id)}>
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
      <style jsx>{`
        .overflow-x-auto {
          overflow-x: auto
        }
        .overflow-y-auto {
          overflow-y: auto
        }
        .max-h-[calc(100vh-300px)] {
          max-height: calc(100vh - 300px)
        }
        thead {
          position: sticky
          top: 0
          z-index: 10
        }
        th {
          background-color: inherit
        }
      `}</style>
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Valid':
      return 'bg-green-100 text-green-800'
    case 'Invalid':
      return 'bg-red-100 text-red-800'
    case 'Locked':
    case 'Password Expired':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
