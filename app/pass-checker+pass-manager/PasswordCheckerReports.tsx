// components/PasswordCheckerReports.tsx
// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Download } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import ExcelJS from 'exceljs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Start from './Start';
import PasswordCheckerRunning from './PasswordCheckerRunning';
interface Company {
  id: number
  name: string
  identifier: string
  password: string
  status: string
  last_checked?: string
  code?: string
  director?: string
}

export default function PasswordCheckerReports() {
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [newCompany, setNewCompany] = useState<Partial<Company>>({
    name: '',
    identifier: '',
    password: '',
  })
  const [activeTab, setActiveTab] = useState('kra')
  const [companies, setCompanies] = useState<Company[]>([])
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [searchTerm, setSearchTerm] = useState('');

  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Not Started");

  useEffect(() => {
    fetchReports()
  }, [activeTab])

  const fetchReports = async () => {
    let tableName = ''
    switch (activeTab) {
      case 'kra':
        tableName = 'PasswordChecker'
        break
      case 'nssf':
        tableName = 'nssf_companies'
        break
      case 'nhif':
        tableName = 'nhif_companies'
        break
      case 'ecitizen':
        tableName = 'ecitizen_companies'
        break
      case 'quickbooks':
        tableName = 'quickbooks_companies'
        break
      default:
        tableName = 'PasswordChecker'
    }

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('id')

    if (error) {
      console.error(`Error fetching reports from ${tableName}:`, error)
    } else {
      setCompanies(data || [])
    }
  }

  const handleEdit = (company: Company) => {
    setEditingCompany(company)
  }

  const handleSave = async (updatedCompany: Company) => {
    const { id, ...updateData } = updatedCompany
    let tableName = getTableName()

    const { error } = await supabase
      .from(tableName)
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
    let tableName = getTableName()

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting company:', error)
    } else {
      setCompanies(companies.filter(c => c.id !== id))
    }
  }

  const handleDeleteAll = async () => {
    let tableName = getTableName()

    const { error } = await supabase
      .from(tableName)
      .delete()
      .neq('id', 0)  // This will delete all rows

    if (error) {
      console.error('Error deleting all companies:', error)
    } else {
      setCompanies([])
    }
  }

  const handleAddCompany = async () => {
    let tableName = getTableName()

    const { data, error } = await supabase
      .from(tableName)
      .insert([newCompany])
      .select()

    if (error) {
      console.error('Error adding company:', error)
    } else {
      setCompanies([...companies, data[0]])
      setNewCompany({
        name: '',
        identifier: '',
        password: '',
      })
    }
  }

  const handleDownloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Password Check Reports');
  
    // Add headers
    const headers = ['Index', 'Name', 'Identifier', 'Password', 'Status', 'Last Checked']
    if (activeTab === 'nhif' || activeTab === 'nssf') headers.push('Code')
    if (activeTab === 'ecitizen') headers.push('Director')
    
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
  
    // Add data
    companies.forEach((company, index) => {
      const row = [
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
      if (company.status.toLowerCase() === 'Valid') {
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
  
    // Auto-fit columns and add styling
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value ? cell.value.toString().length : 10;
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      });
      column.width = maxLength + 2;
    });
  
    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
  
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTab}_password_check_reports.xlsx`;
    link.click();
  
    URL.revokeObjectURL(url);
  };

  const getTableName = () => {
    switch (activeTab) {
      case 'kra':
        return 'PasswordChecker'
      case 'nssf':
        return 'nssf_companies'
      case 'nhif':
        return 'nhif_companies'
      case 'ecitizen':
        return 'ecitizen_companies'
      case 'quickbooks':
        return 'quickbooks_companies'
      default:
        return 'PasswordChecker'
    }
  }


const handleStopCheck = async () => {
    if (!isChecking) {
        alert('There is no automation currently running.');
        return;
    }

    try {
        const response = await fetch('/api/password-checker', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: "stop" })
        })

        if (!response.ok) throw new Error('Failed to stop automation')

        const data = await response.json()
        console.log('Automation stopped:', data)
        setIsChecking(false)
        setStatus("Stopped")
        alert('Automation stopped successfully.')
    } catch (error) {
        console.error('Error stopping automation:', error)
        alert('Failed to stop automation. Please try again.')
    }
}
  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
            <TabsTrigger value="kra">KRA</TabsTrigger>
            <TabsTrigger value="nssf">NSSF</TabsTrigger>
            <TabsTrigger value="nhif">NHIF</TabsTrigger>
            <TabsTrigger value="ecitizen">E-Citizen</TabsTrigger>
            <TabsTrigger value="quickbooks">QuickBooks</TabsTrigger>
        </TabsList>    
        <div className="flex justify-end space-x-2">
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
                  <Label htmlFor="name">Company Name</Label>
                  <Input
                    id="name"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="identifier">Identifier</Label>
                  <Input
                    id="identifier"
                    value={newCompany.identifier}
                    onChange={(e) => setNewCompany({ ...newCompany, identifier: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newCompany.password}
                    onChange={(e) => setNewCompany({ ...newCompany, password: e.target.value })}
                  />
                </div>
                {(activeTab === 'nhif' || activeTab === 'nssf') && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      value={newCompany.code}
                      onChange={(e) => setNewCompany({ ...newCompany, code: e.target.value })}
                    />
                  </div>
                )}
                {activeTab === 'ecitizen' && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="director">Director</Label>
                    <Input
                      id="director"
                      value={newCompany.director}
                      onChange={(e) => setNewCompany({ ...newCompany, director: e.target.value })}
                    />
                  </div>
                )}
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
      </Tabs>
      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="start">Start</TabsTrigger>
          <TabsTrigger value="running">Running</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="start">
          <Start
            companies={companies}
            isChecking={isChecking}
            // handleStartCheck={handleStartCheck}
            handleStopCheck={handleStopCheck}
            activeTab={activeTab} 
          />
        </TabsContent>
        <TabsContent value="running">
          <PasswordCheckerRunning
            progress={progress}
            status={status}
            isChecking={isChecking}
            handleStopCheck={handleStopCheck}
            activeTab={activeTab} 
            onComplete={() => {
              setActiveTab("Reports")
              setIsChecking(false)
              setStatus("Completed")
            }}
          />
        </TabsContent>
        <TabsContent value="reports">
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                <Table className="text-sm pb-4">
                  <TableHeader>
                    <TableRow>
                    <TableHead className="text-center">Index</TableHead>
                    <TableHead>Name</TableHead>
                      {activeTab === 'kra' ? (
                        <>
                          <TableHead className="text-center">KRA PIN</TableHead>
                          <TableHead className="text-center">KRA Password</TableHead>
                        </>
                      ) : (
                        <>
                  
                      {activeTab === 'nssf' && (
                        <>
                         <TableHead className="text-center">NSSF ID</TableHead>
                        <TableHead className="text-center">NSSF Code</TableHead>
                        <TableHead className="text-center">NSSF Password</TableHead>
                        </>
                      )}
                      {activeTab === 'nhif' && (
                        <>
                         <TableHead className="text-center">NHIF ID</TableHead>
                         <TableHead className="text-center">NHIF Password</TableHead>
                        <TableHead className="text-center">NHIF Code</TableHead>
                        </>
                      )}
                      {activeTab === 'ecitizen' && (
                        <>
                         <TableHead className="text-center">eCitizen ID</TableHead>
                         <TableHead className="text-center">eCitizen Password</TableHead>
                        <TableHead className="text-center">Director</TableHead>
                        </>
                      )}
                       {activeTab === 'quickbooks' && (
                        <>
                         <TableHead className="text-center">ID</TableHead>
                         <TableHead className="text-center">Password</TableHead>
                        </>
                      )}
                        </>
                      )}
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center">Last Checked</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company, index) => (
                      <TableRow key={company.id} className={`h-10 ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}>
                        {activeTab === 'kra' ? (
                          <>
                            <TableCell className="text-center">{company.id}</TableCell>
                            <TableCell>{company.company_name || <span className="font-bold text-red-600">Missing</span>}</TableCell>
                            <TableCell className="text-center">{company.kra_pin || <span className="font-bold text-red-600">Missing</span>}</TableCell>
                            <TableCell className="text-center">{company.kra_password || <span className="font-bold text-red-600">Missing</span>}</TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(company.status)}`}>
                                {company.status || <span className="font-bold text-red-600">Missing</span>}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">{company.last_checked ? new Date(company.last_checked).toLocaleString() : <span className="font-bold text-red-600">Missing</span>}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-center">{index + 1}</TableCell>
                            <TableCell>{company.name || <span className="font-bold text-red-600">Missing</span>}</TableCell>
                            <TableCell className="text-center">{company.identifier || <span className="font-bold text-red-600">Missing</span>}</TableCell>
                            <TableCell className="text-center">{company.password || <span className="font-bold text-red-600">Missing</span>}</TableCell>
                            {(activeTab === 'nhif' || activeTab === 'nssf') && (
                              <TableCell className="text-center">{company.code || <span className="font-bold text-red-600">Missing</span>}</TableCell>
                            )}
                            {activeTab === 'ecitizen' && (
                              <TableCell className="text-center">{company.director || <span className="font-bold text-red-600">Missing</span>}</TableCell>
                            )}
                            <TableCell className="text-center">
                              <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(company.status)}`}>
                                {company.status || <span className="font-bold text-red-600">Missing</span>}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">{company.last_checked ? new Date(company.last_checked).toLocaleString() : <span className="font-bold text-red-600">Missing</span>}</TableCell>
                          </>
                        )}
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
                                    <Label htmlFor="name">Company Name</Label>
                                    <Input
                                      id="name"
                                      value={editingCompany?.name}
                                      onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
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
        </TabsContent>
      </Tabs>
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
