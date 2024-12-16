// components/PasswordCheckerReports.tsx
// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Download, Filter } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import ExcelJS from 'exceljs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import Start from './Start'
import PasswordCheckerRunning from './PasswordCheckerRunning'

interface Company {
  id: number
  name: string
  identifier: string
  password: string
  status: string
  last_checked?: string
  code?: string
  director?: string
  acc_billing_client_effective_from?: string
  acc_billing_client_effective_to?: string
  cps_sheria_client_effective_from?: string
  cps_sheria_client_effective_to?: string
  imm_client_effective_from?: string
  imm_client_effective_to?: string
  audit_tax_client_effective_from?: string
  audit_tax_client_effective_to?: string
  acc_client_effective_from?: string
  acc_client_effective_to?: string
}

interface CategoryFilter {
  label: string;
  key: string;
  checked: boolean;
}

function getStatusColor(status: string | null): string {
  if (!status) return 'bg-gray-100 text-gray-800' // Default styling for null/undefined status
  
  const lowerStatus = status.toLowerCase();

  switch (lowerStatus) {
    case 'valid':
      return 'bg-green-100 text-green-800';
    case 'invalid':
      case 'error':
      return 'bg-red-100 text-red-800';
    case 'locked':
      case 'pending':
    case 'password expired':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Helper function to parse dates in various formats
const parseDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null;

  // Handle Excel serial number format
  if (!isNaN(Number(dateStr))) {
    // Excel date serial numbers start from 1900-01-01
    const excelEpoch = new Date(1900, 0, 1);
    const daysSinceEpoch = Number(dateStr) - 1; // Subtract 1 because Excel counts from 1/1/1900
    const millisecondsSinceEpoch = daysSinceEpoch * 24 * 60 * 60 * 1000;
    return new Date(excelEpoch.getTime() + millisecondsSinceEpoch);
  }

  // Try different date formats
  const formats = [
    'DD/MM/YYYY',
    'DD-MM-YYYY',
    'YYYY-MM-DD',
    'MM/DD/YYYY',
    'DD-MM-YY',
    'YYYY/MM/DD'
  ];

  for (const format of formats) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
};

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
  const [automationProgress, setAutomationProgress] = useState(null);
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilter[]>([
    { label: 'Accounting', key: 'acc', checked: true },
    { label: 'Audit Tax', key: 'audit_tax', checked: false },
    { label: 'Sheria', key: 'cps_sheria', checked: false },
    { label: 'Immigration', key: 'imm', checked: false },
  ]);

  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Not Started");
  const [categoriesData, setCategoriesData] = useState({});

  useEffect(() => {
    fetchReports();
  }, [activeTab]);

  useEffect(() => {
    fetchCategoriesData();
  }, []);

  const fetchReports = async () => {
    const tableName = getTableName();
    try {
      // Fetch data from both tables
      const [mainData, duplicateData] = await Promise.all([
        supabase.from(tableName).select('*'),
        supabase.from('acc_portal_company_duplicate').select('*')
      ]);

      if (mainData.error) throw mainData.error;
      if (duplicateData.error) throw duplicateData.error;

      // Create a map of company data from acc_portal_company_duplicate
      const duplicateMap = new Map(
        duplicateData.data.map(company => [
          company.company_name.toLowerCase().trim(),
          company
        ])
      );

      // Merge the data
      const mergedData = mainData.data.map(company => {
        const companyName = (company.company_name || company.name || '').toLowerCase().trim();
        const duplicateInfo = duplicateMap.get(companyName);

        return {
          ...company,
          acc_client_effective_from: duplicateInfo?.acc_client_effective_from || '1950-01-01',
          acc_client_effective_to: duplicateInfo?.acc_client_effective_to || '1990-01-01',
          audit_tax_client_effective_from: duplicateInfo?.audit_tax_client_effective_from || '1950-01-01',
          audit_tax_client_effective_to: duplicateInfo?.audit_tax_client_effective_to || '1990-01-01',
          cps_sheria_client_effective_from: duplicateInfo?.cps_sheria_client_effective_from || '1950-01-01',
          cps_sheria_client_effective_to: duplicateInfo?.cps_sheria_client_effective_to || '1990-01-01',
          imm_client_effective_from: duplicateInfo?.imm_client_effective_from || '1950-01-01',
          imm_client_effective_to: duplicateInfo?.imm_client_effective_to || '1990-01-01'
        };
      });

      setCompanies(mergedData);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

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
      const row = worksheet.addRow([
        '', // Empty cell in column A
        index + 1, // Index in B starting from 1
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
      const statusColor = {
        'valid': 'FF90EE90', // Light green for valid
        'invalid': 'FFFF6347', // Tomato red for invalid
        'default': 'FFFFD700' // Gold for other statuses
      };

      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: statusColor[company.status.toLowerCase()] || statusColor.default }
      };
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

  const fetchCategoriesData = async () => {
    try {
      const { data, error } = await supabase
        .from('category_table_mappings')
        .select('category, subcategory, table_name');

      if (error) throw error;

      const newCategoriesData = {};
      data.forEach(item => {
        if (!newCategoriesData[item.category]) {
          newCategoriesData[item.category] = {};
        }
        newCategoriesData[item.category][item.subcategory] = item.table_name;
      });

      setCategoriesData(newCategoriesData);
      console.log('Fetched categories data:', newCategoriesData);
    } catch (error) {
      console.error('Error fetching categories data:', error);
    }
  };


  const getTableName = () => {
    const category = activeTab.toUpperCase();
  
    // Find the matching category and subcategory
    for (const [cat, subcategories] of Object.entries(categoriesData)) {
      if (cat.toUpperCase() === category) {
        // If we find a matching category, return the first table_name we find
        // You might want to adjust this logic if you have multiple subcategories per category
        for (const [subcat, table_name] of Object.entries(subcategories)) {
          if (table_name) {
            return table_name;
          }
        }
      }
    }

    console.error(`No table found for category: ${category}`);
    return 'PasswordChecker'; // Default fallback
  };

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

  const handleCategoryFilterChange = (key: string) => {
    setCategoryFilters(categoryFilters.map(filter => filter.key === key ? { ...filter, checked: !filter.checked } : filter));
  }

  const isCompanyActive = (company: Company) => {
    // If no filters are checked, show all companies
    const activeFilters = categoryFilters.filter(filter => filter.checked);
    if (activeFilters.length === 0) {
      return true;
    }

    const currentDate = new Date();
  
    const isActiveForCategory = (fromStr: string | null | undefined, toStr: string | null | undefined): boolean => {
      if (!fromStr && !toStr) return false;

      const from = parseDate(fromStr || '');
      const to = parseDate(toStr || '');

      if (!from && !to) return false;

      // If only from date exists, consider it active if it's in the past
      if (from && !to) {
        return from <= currentDate;
      }

      // If only to date exists, consider it active if it's in the future
      if (!from && to) {
        return currentDate <= to;
      }

      // Both dates exist
      return from! <= currentDate && currentDate <= to!;
    };

    return activeFilters.some(category => {
      switch (category.key) {
        case 'acc_billing':
          return isActiveForCategory(company.acc_billing_client_effective_from, company.acc_billing_client_effective_to);
        case 'cps_sheria':
          return isActiveForCategory(company.cps_sheria_client_effective_from, company.cps_sheria_client_effective_to);
        case 'imm':
          return isActiveForCategory(company.imm_client_effective_from, company.imm_client_effective_to);
        case 'audit_tax':
          return isActiveForCategory(company.audit_tax_client_effective_from, company.audit_tax_client_effective_to);
        case 'acc':
          return isActiveForCategory(company.acc_client_effective_from, company.acc_client_effective_to);
        default:
          return false;
      }
    });
  };

  // Add this style to highlight inactive rows
  const getRowStyle = (company: Company) => {
    const isActive = isCompanyActive(company);
    return isActive ? '' : 'bg-red-50';
  };

  const filteredCompanies = companies.filter(isCompanyActive);

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center mb-4">
            <TabsList className="h-10">
              {Object.keys(categoriesData).map(category => (
                <TabsTrigger key={category} value={category.toLowerCase()} className="px-4">
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
          
            <div className="flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter Categories
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2">
                  {categoryFilters.map((filter) => (
                    <div key={filter.key} className="flex items-center space-x-2 p-2">
                      <Checkbox
                        id={filter.key}
                        checked={filter.checked}
                        onCheckedChange={() => handleCategoryFilterChange(filter.key)}
                      />
                      <label
                        htmlFor={filter.key}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {filter.label}
                      </label>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            
              <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
                <Download className="h-4 w-4 mr-2" />
                Download Excel
              </Button>
            </div>
          </div>
        </Tabs>

        <div className="rounded-md border">
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Index</TableHead>
                <TableHead>Name</TableHead>
                {activeTab === 'kra' ? (
                  <>
                    <TableHead className="text-center">KRA PIN</TableHead>
                    <TableHead className="text-center">KRA Password</TableHead>
                    <TableHead className="text-center">Status	</TableHead>
                    <TableHead className="text-center">Last Checked</TableHead>
                  </>
                ) : (
                  <>

                    {activeTab === 'nhif' && (
                      <>
                        <TableHead className="text-center">NHIF ID</TableHead>
                        <TableHead className="text-center">NHIF Code</TableHead>
                        <TableHead className="text-center">NHIF Password</TableHead>
                      </>
                    )}
                    {activeTab === 'nssf' && (
                      <>
                        <TableHead className="text-center">NSSF ID</TableHead>
                        <TableHead className="text-center">NSSF Code</TableHead>
                        <TableHead className="text-center">NSSF Password</TableHead>
                      </>
                    )}
                    {activeTab === 'ecitizen' && (
                      <>
                        <TableHead className="text-center">eCitizen ID</TableHead>
                        <TableHead className="text-center">eCitizen Password</TableHead>
                        <TableHead >Director</TableHead>
                      </>
                    )}
                    {activeTab === 'quickbooks' && (
                      <>
                        <TableHead className="text-center">ID</TableHead>
                        <TableHead className="text-center">Password</TableHead>
                      </>
                    )}
                    {activeTab === 'kebs' && (
                      <>
                        <TableHead className="text-center">ID</TableHead>
                        <TableHead className="text-center">Password</TableHead>
                      </>
                    )}
                
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Last Checked</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company, index) => (
                <TableRow key={company.id} className={getRowStyle(company)}>
                  <TableCell className="text-center">{index + 1}</TableCell>
                  <TableCell>{company.company_name || company.name}</TableCell>
                  <TableCell className="text-center">{company.kra_pin || company.identifier || company.ecitizen_identifier}</TableCell>
                  <TableCell className="text-center">{company.kra_password || company.password || company.ecitizen_password}</TableCell>
                  {activeTab === 'nssf' && (
                    <>
                    <TableCell className="text-center">{company.nssf_code}</TableCell>
                      <TableCell className="text-center">{company.nssf_password}</TableCell>
                      </>
                  )}
                  {activeTab === 'nhif' && (
                     <>
                    <TableCell className="text-center">{company.nhif_code}</TableCell>
                    <TableCell className="text-center">{company.nhif_password}</TableCell>
                     </>
                  )}
                  {activeTab === 'ecitizen' && (
                    <TableCell className="">{company.director}</TableCell>
                  )}
                  <TableCell className="text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(company.status)}`}>
                      {company.status || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {company.last_checked ? new Date(company.last_checked).toLocaleString() : 'Never'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center space-x-2 ">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(company)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(company.id)}>
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
  )
}