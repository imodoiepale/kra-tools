// @ts-nocheck
"use client"
import { useCompanyFilters } from "./hooks/useCompanyFilters"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "./components/data-table"
import { Input } from "@/components/ui/input"
import { useCompanyTaxReports } from "./hooks/useCompanyTaxReports"
import { useState, useEffect, useMemo, useCallback } from "react"
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
import { Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Configure the query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15 * 60 * 1000, // 15 minutes
      cacheTime: 24 * 60 * 60 * 1000, // 24 hours
      retry: 1,
      retryDelay: 1000,
      keepPreviousData: true,
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
    loading,
    selectedColumns,
    setSelectedColumns,
    prefetchCompanyData,
    clearCache
  } = useCompanyTaxReports()
  
  const {
    searchQuery,
    setSearchQuery,
    selectedFilters,
    setSelectedFilters,
    filteredCompanies,
    getFilters,
    handleFilterChange,
    isDateInRange
  } = useCompanyFilters(companies)

  const [selectedSubColumns, setSelectedSubColumns] = useState<("amount" | "date" | "all")[]>(["all"])
  const [taxDropdownOpen, setTaxDropdownOpen] = useState(false)
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false)
  
  // Store the last valid company data to avoid UI flashing
  const [stableReportData, setStableReportData] = useState({})
  
  // Update stableReportData when reportData changes and has content
  useEffect(() => {
    if (reportData && Object.keys(reportData).length > 0) {
      setStableReportData(reportData);
    }
  }, [reportData]);
  
  // Get available years from either current or stable data
  const years = useMemo(() => {
    const dataToUse = Object.keys(reportData).length > 0 ? reportData : stableReportData;
    return Object.keys(dataToUse).sort().reverse();
  }, [reportData, stableReportData]);
  
  // Ensure selectedYear is valid
  const [selectedYear, setSelectedYear] = useState('')
  useEffect(() => {
    if (years.length > 0 && (!selectedYear || !years.includes(selectedYear))) {
      setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);
  
  const currentDate = new Date();
  
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

  // More robust export function
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

  // Get data to display (from either reportData or stable backup)
  const displayData = useMemo(() => {
    // If we have current data for the selected year, use it
    if (reportData[selectedYear]?.length > 0) {
      return reportData[selectedYear];
    }
    
    // Otherwise, fall back to stable data
    if (stableReportData[selectedYear]?.length > 0) {
      return stableReportData[selectedYear];
    }
    
    return [];
  }, [reportData, stableReportData, selectedYear]);

  return (
    <div className="flex h-screen max-h-screen">
      <div className="w-48 border-r p-2">
        <div className="space-y-2 mb-4">
          <h2 className="font-semibold text-xs">Companies</h2>
          <div className="space-y-2">
            <Input
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full h-8 flex items-center justify-between text-xs">
                  <div className="flex items-center">
                    <Filter className="mr-2 h-3 w-3" />
                    Service Categories
                  </div>
                  {selectedFilters.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedFilters.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel className="text-xs font-medium">Service Categories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2">
                  {getFilters().map((filter) => (
                    <label
                      key={filter.key}
                      className="flex items-center space-x-2 mb-2 last:mb-0 cursor-pointer"
                    >
                      <Checkbox
                        checked={filter.key === 'all' ? selectedFilters.length === 0 : filter.selected}
                        onCheckedChange={() => handleFilterChange(filter.key)}
                        className="h-4 w-4"
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{filter.label}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <ScrollArea className="h-[calc(100vh-8rem)]">
          {loading && companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-xs text-muted-foreground">Loading companies...</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredCompanies.map((company, index) => {
                const { short, full } = getTruncatedCompanyName(company.name)
                return (
                  <div
                    key={company.id}
                    className={`p-1.5 cursor-pointer text-xs transition-all group relative rounded-md ${
                      selectedCompany === company.id 
                        ? "bg-blue-500 text-white border border-blue-600" 
                        : "hover:border hover:border-muted-foreground/20"
                    }`}
                    onClick={() => setSelectedCompany(company.id)}
                    onMouseEnter={() => prefetchCompanyData(company.id, index)}
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
        
        {/* Debug button - can be removed in production */}
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4 w-full text-xs hidden" // hidden by default
          onClick={clearCache}
        >
          Clear Cache (Debug)
        </Button>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {loading && Object.keys(stableReportData).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
             {displayData.length > 0 ? (
               <DataTable 
                 data={displayData}
                 selectedColumns={getFilteredColumns()}
                 selectedSubColumns={selectedSubColumns}
                 isLoading={loading && selectedCompany !== null} // Pass loading state when company is selected
               />
             ) : (
               <div className="flex flex-col items-center justify-center h-32 border rounded-md bg-muted/10 space-y-4">
                 {loading ? (
                   <>
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                     <p className="text-xs">Loading data...</p>
                   </>
                 ) : (
                   <><p className="text-muted-foreground">Loading data  {selectedYear}</p><div className="flex justify-center items-center h-screen">
                            <div className="rounded-full h-20 w-20 bg-blue-600 animate-ping"></div>
                          </div></>
                 )}
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