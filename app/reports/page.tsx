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
  const [yearRange, setYearRange] = useState<string[]>([years[0] || ''])
  const [viewMode, setViewMode] = useState<'detailed' | 'comparison'>('detailed')
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

  const getActiveTaxType = () => {
    if (selectedColumns.length === 2) {
      return selectedColumns[1] as "paye" | "housingLevy" | "nita" | "shif" | "nssf"
    }
    return "paye" // Default to PAYE if multiple or no taxes selected
  }

  const exportToExcel = () => {
    if (yearRange.length === 0) return

    // For comparison view, export the selected tax type across years
    if (viewMode === 'comparison') {
      const taxType = getActiveTaxType()
      const taxName = taxTypes.find(t => t.id === taxType)?.name || 'Tax'
      
      const data = [];
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      
      // Add header row with years
      months.forEach(month => {
        const row: any = { Month: month }
        yearRange.forEach(year => {
          row[year] = (reportData[year] || []).find(entry => entry.month === month)?.[taxType]?.amount || 0
        })
        data.push(row)
      })
      
      // Add total row
      const totalRow: any = { Month: "TOTAL" }
      yearRange.forEach(year => {
        totalRow[year] = (reportData[year] || []).reduce((sum, entry) => sum + entry[taxType].amount, 0)
      })
      data.push(totalRow)
      
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `${taxName} Comparison`)
      XLSX.writeFile(wb, `${selectedCompanyName}_${taxName}_${yearRange.join('-')}_comparison.xlsx`)
    } else {
      // For detailed view, export the selected year with all selected taxes
      const year = selectedYear
      if (!reportData[year]) return
      
      const data = reportData[year].map(entry => {
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
      XLSX.writeFile(wb, `${selectedCompanyName}_${year}_tax_report.xlsx`)
    }
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

            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">View:</span>
                <div className="flex border rounded-md">
                  <Button 
                    variant={viewMode === 'detailed' ? "default" : "ghost"} 
                    size="sm"
                    onClick={() => setViewMode('detailed')}
                    className="rounded-r-none"
                  >
                    Detailed
                  </Button>
                  <Button 
                    variant={viewMode === 'comparison' ? "default" : "ghost"} 
                    size="sm"
                    onClick={() => setViewMode('comparison')}
                    className="rounded-l-none"
                  >
                    Year Comparison
                  </Button>
                </div>
              </div>

              {viewMode === 'detailed' ? (
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
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Years:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {years.map(year => (
                      <Button
                        key={year}
                        variant={yearRange.includes(year) ? "default" : "outline"}
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => {
                          if (yearRange.includes(year)) {
                            // Remove if already selected and not the only year
                            if (yearRange.length > 1) {
                              setYearRange(yearRange.filter(y => y !== year))
                            }
                          } else {
                            // Add year to selection (up to 3 years)
                            if (yearRange.length < 3) {
                              setYearRange([...yearRange, year].sort())
                            }
                          }
                        }}
                      >
                        {year}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <DropdownMenu open={taxDropdownOpen} onOpenChange={setTaxDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-between">
                    Select Taxes
                    <span className="text-xs text-muted-foreground">
                      ({viewMode === 'comparison' && selectedColumns.length > 2 
                        ? "1 will show" 
                        : `${selectedColumns.length - 1} selected`})
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
                    {viewMode === 'detailed' && (
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
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {taxTypes.slice(1).map(tax => (
                    <DropdownMenuCheckboxItem
                      key={tax.id}
                      checked={selectedColumns.includes(tax.id)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) => {
                        if (viewMode === 'comparison') {
                          // In comparison view, only allow one tax type selection
                          setSelectedColumns(['month', tax.id])
                        } else {
                          // In detailed view, allow multiple selections
                          if (checked) {
                            setSelectedColumns([...selectedColumns, tax.id])
                          } else {
                            setSelectedColumns(selectedColumns.filter(col => col !== tax.id))
                          }
                        }
                      }}
                    >
                      {tax.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {viewMode === 'detailed' && (
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
              )}
            </div>

            <div className="relative">
              <DataTable 
                data={reportData[selectedYear] || []}
                selectedColumns={getFilteredColumns()}
                selectedSubColumns={selectedSubColumns}
                isHorizontalView={viewMode === 'comparison'}
                yearlyData={Object.fromEntries(
                  yearRange.map(year => [year, reportData[year] || []])
                )}
                taxType={getActiveTaxType()}
                title={viewMode === 'comparison' 
                  ? `${taxTypes.find(t => t.id === getActiveTaxType())?.name || 'Tax'} Comparison (${yearRange.join(' - ')})`
                  : undefined}
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