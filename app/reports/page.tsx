// @ts-nocheck
"use client"

import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "./components/data-table"
import { Input } from "@/components/ui/input"
import { useCompanyTaxReports } from "./hooks/useCompanyTaxReports"
import { useState } from "react"
import * as XLSX from 'xlsx'
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

const taxTypes = [
  { id: 'all', name: 'All Taxes' },
  { id: 'paye', name: 'PAYE' },
  { id: 'housingLevy', name: 'Housing Levy' },
  { id: 'nita', name: 'NITA' },
  { id: 'shif', name: 'SHIF' },
  { id: 'nssf', name: 'NSSF' }
] as const

export default function CompanyReportsWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <CompanyReports />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

function CompanyReports() {
  const {
    companies,
    reportData,
    selectedCompany,
    setSelectedCompany,
    searchQuery,
    setSearchQuery,
    loading,
    selectedColumns,
    setSelectedColumns,
    prefetchCompanyData
  } = useCompanyTaxReports()
  
  const [selectedSubColumns, setSelectedSubColumns] = useState<("amount" | "date" | "all")[]>(["all"])
  const [taxDropdownOpen, setTaxDropdownOpen] = useState(false)
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false)
  const years = Object.keys(reportData).sort().reverse()
  const [selectedYear, setSelectedYear] = useState(years[0] || '')
  const selectedCompanyName = companies.find(c => c.id === selectedCompany)?.name || ""

  const getTruncatedCompanyName = (name: string) => {
    const words = name.split(' ')
    return {
      short: words.slice(0, 2).join(' '),
      full: name
    }
  }

  const getFilteredColumns = () => {
    if (selectedColumns.includes('all')) return selectedColumns
    return ['month', ...selectedColumns]
  }

  const exportToExcel = () => {
    if (!selectedYear || !reportData[selectedYear]) return

    const data = reportData[selectedYear].map(entry => {
      const row: any = { Month: entry.month }
      if (selectedColumns.includes('all') || selectedColumns.includes('paye')) {
        row['PAYE Amount'] = entry.paye.amount
        row['PAYE Pay Date'] = entry.paye.date || '-'
      }
      if (selectedColumns.includes('all') || selectedColumns.includes('housingLevy')) {
        row['Housing Levy Amount'] = entry.housingLevy.amount
        row['Housing Levy Pay Date'] = entry.housingLevy.date || '-'
      }
      if (selectedColumns.includes('all') || selectedColumns.includes('nita')) {
        row['NITA Amount'] = entry.nita.amount
        row['NITA Pay Date'] = entry.nita.date || '-'
      }
      if (selectedColumns.includes('all') || selectedColumns.includes('shif')) {
        row['SHIF Amount'] = entry.shif.amount
        row['SHIF Pay Date'] = entry.shif.date || '-'
      }
      if (selectedColumns.includes('all') || selectedColumns.includes('nssf')) {
        row['NSSF Amount'] = entry.nssf.amount
        row['NSSF Pay Date'] = entry.nssf.date || '-'
      }
      return row
    })

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tax Report')
    XLSX.writeFile(wb, `${selectedCompanyName}_${selectedYear}_tax_report.xlsx`)
  }

  return (
    <div className="flex h-screen max-h-screen">
      <div className="w-48 border-r p-2">
        <div className="space-y-2 mb-4">
          <h2 className="font-semibold text-xs">Companies</h2>
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs"
          />
        </div>
        <ScrollArea className="h-[calc(100vh-8rem)]">
          {loading && companies.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">Loading companies...</div>
          ) : (
            <div className="space-y-0.5">
              {companies.map((company, index) => {
                const { short, full } = getTruncatedCompanyName(company.name)
                return (
                  <div
                    key={company.id}
                    className={`p-1.5 cursor-pointer text-xs transition-all  group relative rounded-md ${
                      selectedCompany === company.id 
                        ? "bg-blue-500 text-white border border-blue-600" 
                        : "hover:border hover:border-muted-foreground/20"
                    }`}
                    onClick={() => setSelectedCompany(company.id)}
                    onMouseEnter={() => prefetchCompanyData(company.id)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground text-[10px] w-4">{index + 1}.</span>
                      <span className="truncate">{short}</span>
                    </div>
                    {full !== short && (
                      <div className="absolute z-50 left-full ml-2 invisible group-hover:visible bg-popover border rounded-md p-2 mt-1 shadow-lg text-xs">
                        {full}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {loading && selectedCompany ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading tax data...</p>
          </div>
        ) : selectedCompany ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedCompanyName}</h2>
              <Button onClick={exportToExcel} variant="outline" className="ml-auto">
                Export to Excel
              </Button>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu open={taxDropdownOpen} onOpenChange={setTaxDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-between">
                    Select Taxes
                    <span className="text-xs text-muted-foreground">
                      ({selectedColumns.length - 1} selected)
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="w-[180px]"
                  onInteractOutside={(e) => {
                    // Only close if clicking outside both dropdowns
                    if (!e.target.closest('[role="dialog"]')) {
                      setTaxDropdownOpen(false)
                    }
                  }}
                >
                  <DropdownMenuLabel className="flex items-center justify-between">
                    Tax Types
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        if (selectedColumns.length === taxTypes.length) {
                          setSelectedColumns(['month'])
                        } else {
                          setSelectedColumns(['month', ...taxTypes.slice(1).map(t => t.id)])
                        }
                      }}
                    >
                      {selectedColumns.length === taxTypes.length ? 'Unselect All' : 'Select All'}
                    </Button>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {taxTypes.slice(1).map(tax => (
                    <DropdownMenuCheckboxItem
                      key={tax.id}
                      checked={selectedColumns.includes(tax.id)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedColumns([...selectedColumns, tax.id])
                        } else {
                          setSelectedColumns(selectedColumns.filter(col => col !== tax.id))
                        }
                      }}
                    >
                      {tax.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu open={columnDropdownOpen} onOpenChange={setColumnDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-between">
                    Column Details
                    <span className="text-xs text-muted-foreground">
                      {selectedSubColumns.includes("all") 
                        ? "(All)" 
                        : `(${selectedSubColumns.length} selected)`}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="w-[180px]"
                  onInteractOutside={(e) => {
                    // Only close if clicking outside both dropdowns
                    if (!e.target.closest('[role="dialog"]')) {
                      setColumnDropdownOpen(false)
                    }
                  }}
                >
                  <DropdownMenuLabel className="flex items-center justify-between">
                  
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        if (selectedSubColumns.includes("all")) {
                          setSelectedSubColumns(["amount"])
                        } else {
                          setSelectedSubColumns(["all"])
                        }
                      }}
                    >
                      {selectedSubColumns.includes("all") ? 'Show Custom' : 'Show All'}
                    </Button>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={selectedSubColumns.includes("all")}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSubColumns(["all"])
                      } else {
                        setSelectedSubColumns(["amount"])
                      }
                    }}
                  >
                    All Details
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={selectedSubColumns.includes("amount") || selectedSubColumns.includes("all")}
                    disabled={selectedSubColumns.includes("all")}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSubColumns(prev => {
                          const newSelection = prev.filter(col => col !== "all").concat("amount")
                          return newSelection.length > 0 ? newSelection : ["amount"]
                        })
                      } else {
                        setSelectedSubColumns(prev => {
                          const newSelection = prev.filter(col => col !== "amount" && col !== "all")
                          return newSelection.length > 0 ? newSelection : ["date"]
                        })
                      }
                    }}
                  >
                    Amount
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={selectedSubColumns.includes("date") || selectedSubColumns.includes("all")}
                    disabled={selectedSubColumns.includes("all")}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSubColumns(prev => {
                          const newSelection = prev.filter(col => col !== "all").concat("date")
                          return newSelection.length > 0 ? newSelection : ["date"]
                        })
                      } else {
                        setSelectedSubColumns(prev => {
                          const newSelection = prev.filter(col => col !== "date" && col !== "all")
                          return newSelection.length > 0 ? newSelection : ["amount"]
                        })
                      }
                    }}
                  >
                    Pay Date
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="relative">
              <DataTable 
                data={reportData[selectedYear] || []}
                selectedColumns={getFilteredColumns()}
                selectedSubColumns={selectedSubColumns}
              />
              {loading && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Select a company to view tax reports</p>
          </div>
        )}
      </div>
    </div>
  )
}