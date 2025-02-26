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

const taxTypes = [
  { id: 'all', name: 'All Taxes' },
  { id: 'paye', name: 'PAYE' },
  { id: 'housingLevy', name: 'Housing Levy' },
  { id: 'nita', name: 'NITA' },
  { id: 'shif', name: 'SHIF' },
  { id: 'nssf', name: 'NSSF' }
] as const

export default function CompanyReports() {
  const {
    companies,
    reportData,
    selectedCompany,
    setSelectedCompany,
    searchQuery,
    setSearchQuery,
    loading,
    selectedColumns,
    setSelectedColumns
  } = useCompanyTaxReports()
  
  const years = Object.keys(reportData).sort().reverse()
  const [selectedYear, setSelectedYear] = useState(years[0] || '')
  const [selectedTaxType, setSelectedTaxType] = useState<typeof taxTypes[number]['id']>('all')
  const selectedCompanyName = companies.find(c => c.id === selectedCompany)?.name || ""

  const getTruncatedCompanyName = (name: string) => {
    const words = name.split(' ')
    return {
      short: words.slice(0, 2).join(' '),
      full: name
    }
  }

  const getFilteredColumns = () => {
    if (selectedTaxType === 'all') return selectedColumns
    return ['month', selectedTaxType]
  }

  const exportToExcel = () => {
    if (!selectedYear || !reportData[selectedYear]) return

    const data = reportData[selectedYear].map(entry => {
      const row: any = { Month: entry.month }
      if (selectedTaxType === 'all' || selectedTaxType === 'paye') {
        row['PAYE Amount'] = entry.paye.amount
        row['PAYE Pay Date'] = entry.paye.date || '-'
      }
      if (selectedTaxType === 'all' || selectedTaxType === 'housingLevy') {
        row['Housing Levy Amount'] = entry.housingLevy.amount
        row['Housing Levy Pay Date'] = entry.housingLevy.date || '-'
      }
      if (selectedTaxType === 'all' || selectedTaxType === 'nita') {
        row['NITA Amount'] = entry.nita.amount
        row['NITA Pay Date'] = entry.nita.date || '-'
      }
      if (selectedTaxType === 'all' || selectedTaxType === 'shif') {
        row['SHIF Amount'] = entry.shif.amount
        row['SHIF Pay Date'] = entry.shif.date || '-'
      }
      if (selectedTaxType === 'all' || selectedTaxType === 'nssf') {
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
          <h2 className="font-semibold text-sm">Companies</h2>
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm"
          />
        </div>
        <ScrollArea className="h-[calc(100vh-8rem)]">
          {loading && companies.length === 0 ? (
            <div className="p-2 text-sm text-muted-foreground">Loading companies...</div>
          ) : (
            <div className="space-y-1">
              {companies.map((company, index) => {
                const { short, full } = getTruncatedCompanyName(company.name)
                return (
                  <div
                    key={company.id}
                    className={`p-2 cursor-pointer hover:bg-muted/50 text-sm group relative rounded-md transition-colors ${
                      selectedCompany === company.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedCompany(company.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-5">{index + 1}.</span>
                      <span className="truncate">{short}</span>
                    </div>
                    <div className="absolute z-50 left-7 invisible group-hover:visible bg-white border rounded-md p-2 mt-1 shadow-lg">
                      {full}
                    </div>
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

              <Select value={selectedTaxType} onValueChange={setSelectedTaxType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select tax type" />
                </SelectTrigger>
                <SelectContent>
                  {taxTypes.map(tax => (
                    <SelectItem key={tax.id} value={tax.id}>
                      {tax.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <DataTable 
                data={reportData[selectedYear] || []}
                selectedColumns={getFilteredColumns()}
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