// @ts-nocheck
"use client"

import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "./components/data-table"
import { ColumnFilter } from "./components/column-filter"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCompanyTaxReports } from "./hooks/useCompanyTaxReports"
import { useState } from "react"

const taxTypes = [
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
  
  const [selectedTaxType, setSelectedTaxType] = useState<typeof taxTypes[number]['id']>('paye')
  const years = Object.keys(reportData).sort().reverse()
  const selectedCompanyName = companies.find(c => c.id === selectedCompany)?.name || ""

  const getTruncatedCompanyName = (name: string) => {
    const words = name.split(' ')
    return {
      short: words.slice(0, 2).join(' '),
      full: name
    }
  }

  const YearlyView = ({ year }: { year: string }) => (
    <DataTable 
      data={reportData[year] || []} 
      title={`Year ${year}`}
      selectedColumns={selectedColumns}
    />
  )

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
            companies.map((company) => {
              const { short, full } = getTruncatedCompanyName(company.name)
              return (
                <Card
                  key={company.id}
                  className={`p-2 mb-1 cursor-pointer hover:bg-muted/50 text-sm group relative ${
                    selectedCompany === company.id ? "bg-muted" : ""
                  }`}
                  onClick={() => setSelectedCompany(company.id)}
                >
                  <span>{short}</span>
                  <div className="absolute z-50 invisible group-hover:visible bg-white border rounded-md p-2 mt-1 shadow-lg">
                    {full}
                  </div>
                </Card>
              )
            })
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
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">{selectedCompanyName}</h2>
            </div>

            <Tabs defaultValue="yearly" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="yearly">Recent Tax Reports</TabsTrigger>
                <TabsTrigger value="detailed">Historical Overview</TabsTrigger>
              </TabsList>
              <TabsContent value="yearly" className="space-y-8">
                {years.slice(0, 2).map(year => (
                  <div key={year} className="relative">
                    <YearlyView year={year} />
                    {loading && (
                      <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="detailed" className="space-y-4">
                <div className="flex items-center gap-4">
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
                  <ColumnFilter
                    columns={[
                      { id: 'month', name: 'Month' },
                      { id: 'paye', name: 'PAYE' },
                      { id: 'housingLevy', name: 'Housing Levy' },
                      { id: 'nita', name: 'NITA' },
                      { id: 'shif', name: 'SHIF' },
                      { id: 'nssf', name: 'NSSF' }
                    ]}
                    selectedColumns={selectedColumns}
                    onColumnChange={setSelectedColumns}
                  />
                </div>
                <DataTable
                  data={reportData[years[0]] || []}
                  taxType={selectedTaxType}
                  yearlyData={reportData}
                  isHorizontalView={true}
                  title={`${taxTypes.find(t => t.id === selectedTaxType)?.name} History`}
                  selectedColumns={selectedColumns}
                />
              </TabsContent>
            </Tabs>
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