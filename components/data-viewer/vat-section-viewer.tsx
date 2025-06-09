"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ExportButton } from "@/components/data-viewer/export-button"
import type { VatReturnDetails } from "@/lib/supabase"

interface VatSectionViewerProps {
  companyId: number
  vatReturns: VatReturnDetails[]
}

export function VatSectionViewer({ companyId, vatReturns }: VatSectionViewerProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all")
  const [sectionViewMode, setSectionViewMode] = useState<"detailed" | "summary" | "compact">("detailed")

  const filteredReturns =
    selectedPeriod === "all" ? vatReturns : vatReturns.filter((r) => `${r.year}-${r.month}` === selectedPeriod)

  const sections = [
    {
      key: "section_b",
      name: "Section B",
      title: "Sales and Output Tax",
      description: "Detailed sales transactions",
      color: "bg-blue-100 text-blue-800",
    },
    {
      key: "section_b2",
      name: "Section B2",
      title: "Sales Totals",
      description: "Sales summary totals",
      color: "bg-green-100 text-green-800",
    },
    {
      key: "section_e",
      name: "Section E",
      title: "Sales Exempt",
      description: "Exempt sales transactions",
      color: "bg-purple-100 text-purple-800",
    },
    {
      key: "section_f",
      name: "Section F",
      title: "Purchases and Input Tax",
      description: "Detailed purchase transactions",
      color: "bg-orange-100 text-orange-800",
    },
    {
      key: "section_f2",
      name: "Section F2",
      title: "Purchases Totals",
      description: "Purchase summary totals",
      color: "bg-red-100 text-red-800",
    },
    {
      key: "section_k3",
      name: "Section K3",
      title: "Credit Adjustment Voucher",
      description: "Credit adjustments",
      color: "bg-yellow-100 text-yellow-800",
    },
    {
      key: "section_m",
      name: "Section M",
      title: "Sales Summary",
      description: "Sales summary by rate",
      color: "bg-indigo-100 text-indigo-800",
    },
    {
      key: "section_n",
      name: "Section N",
      title: "Purchases Summary",
      description: "Purchases summary by rate",
      color: "bg-pink-100 text-pink-800",
    },
    {
      key: "section_o",
      name: "Section O",
      title: "Tax Calculation",
      description: "Final tax calculations",
      color: "bg-gray-100 text-gray-800",
    },
  ]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const parseAmount = (value: any): number => {
    if (value === null || value === undefined || value === "" || value === "-") return 0
    const cleanValue = String(value)
      .replace(/[^\d.-]/g, "")
      .replace(/,/g, "")
    const parsed = Number.parseFloat(cleanValue)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  const periods = vatReturns.map((r) => ({
    value: `${r.year}-${r.month}`,
    label: new Date(r.year, r.month - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  }))

  // Render Section O with new format
  const renderSectionO = () => {
    const allData: any[] = []

    filteredReturns.forEach((vatReturn) => {
      const sectionO = vatReturn.section_o
      if (sectionO?.data && Array.isArray(sectionO.data)) {
        sectionO.data.forEach((row: any) => {
          allData.push({
            ...row,
            _period: new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            }),
            _year: vatReturn.year,
            _month: vatReturn.month,
          })
        })
      }
    })

    if (allData.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data available for Section O</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            {allData.length} records
          </Badge>
          <ExportButton
            data={allData.map((row: any, index: number) => ({ "Sr.No.": index + 1, ...row }))}
            filename="Section_O_Tax_Calculation"
            type="section-data"
            variant="outline"
            size="sm"
          />
        </div>

        <div className="overflow-auto border rounded-lg max-h-96">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Sr.No.</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Period</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Sr.No.</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Amount (Ksh)</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b">Descriptions</th>
              </tr>
            </thead>
            <tbody>
              {allData.map((row: any, index: number) => (
                <tr key={index} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                  <td className="px-3 py-2 text-gray-900 font-medium border-r">{index + 1}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium border-r">{row._period}</td>
                  <td className="px-3 py-2 text-gray-900 border-r">{row["Sr.No."] || "-"}</td>
                  <td className="px-3 py-2 text-gray-900 border-r">
                    {formatCurrency(parseAmount(row["Amount (Ksh)"]))}
                  </td>
                  <td className="px-3 py-2 text-gray-900">{row["Descriptions"] || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Render Section B2 with new format
  const renderSectionB2 = () => {
    const allData: any[] = []

    filteredReturns.forEach((vatReturn) => {
      const sectionB2 = vatReturn.section_b2
      if (sectionB2?.data && Array.isArray(sectionB2.data)) {
        sectionB2.data.forEach((row: any) => {
          allData.push({
            ...row,
            _period: new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            }),
            _year: vatReturn.year,
            _month: vatReturn.month,
          })
        })
      }
    })

    if (allData.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data available for Section B2</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            {allData.length} records
          </Badge>
          <ExportButton
            data={allData.map((row: any, index: number) => ({ "Sr.No.": index + 1, ...row }))}
            filename="Section_B2_Sales_Totals"
            type="section-data"
            variant="outline"
            size="sm"
          />
        </div>

        <div className="overflow-auto border rounded-lg max-h-96">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Sr.No.</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Period</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Description</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Amount of VAT (Ksh)</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b">Taxable Value (Ksh)</th>
              </tr>
            </thead>
            <tbody>
              {allData.map((row: any, index: number) => (
                <tr key={index} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                  <td className="px-3 py-2 text-gray-900 font-medium border-r">{index + 1}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium border-r">{row._period}</td>
                  <td className="px-3 py-2 text-gray-900 border-r">{row["Description"] || "-"}</td>
                  <td className="px-3 py-2 text-gray-900 border-r">
                    {formatCurrency(parseAmount(row["Amount of VAT (Ksh)"]))}
                  </td>
                  <td className="px-3 py-2 text-gray-900">{formatCurrency(parseAmount(row["Taxable Value (Ksh)"]))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Render Section F2 with new format
  const renderSectionF2 = () => {
    const allData: any[] = []

    filteredReturns.forEach((vatReturn) => {
      const sectionF2 = vatReturn.section_f2
      if (sectionF2?.data && Array.isArray(sectionF2.data)) {
        sectionF2.data.forEach((row: any) => {
          allData.push({
            ...row,
            _period: new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            }),
            _year: vatReturn.year,
            _month: vatReturn.month,
          })
        })
      }
    })

    if (allData.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data available for Section F2</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            {allData.length} records
          </Badge>
          <ExportButton
            data={allData.map((row: any, index: number) => ({ "Sr.No.": index + 1, ...row }))}
            filename="Section_F2_Purchases_Totals"
            type="section-data"
            variant="outline"
            size="sm"
          />
        </div>

        <div className="overflow-auto border rounded-lg max-h-96">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Sr.No.</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Period</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Description</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Amount of VAT (Ksh)</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b">Taxable Value (Ksh)</th>
              </tr>
            </thead>
            <tbody>
              {allData.map((row: any, index: number) => (
                <tr key={index} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                  <td className="px-3 py-2 text-gray-900 font-medium border-r">{index + 1}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium border-r">{row._period}</td>
                  <td className="px-3 py-2 text-gray-900 border-r">{row["Description"] || "-"}</td>
                  <td className="px-3 py-2 text-gray-900 border-r">
                    {formatCurrency(parseAmount(row["Amount of VAT (Ksh)"]))}
                  </td>
                  <td className="px-3 py-2 text-gray-900">{formatCurrency(parseAmount(row["Taxable Value (Ksh)"]))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Generic render for other sections (keeping original format)
  const renderGenericSection = (sectionKey: string, sectionName: string) => {
    const allData: any[] = []

    filteredReturns.forEach((vatReturn) => {
      const sectionData = (vatReturn as any)[sectionKey]
      if (sectionData?.data && Array.isArray(sectionData.data)) {
        sectionData.data.forEach((row: any) => {
          allData.push({
            ...row,
            _period: new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            }),
            _year: vatReturn.year,
            _month: vatReturn.month,
          })
        })
      }
    })

    if (allData.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data available for {sectionName}</p>
        </div>
      )
    }

    const headers = Object.keys(allData[0]).filter((key) => !key.startsWith("_"))

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            {allData.length} records
          </Badge>
          <ExportButton
            data={allData.map((row: any, index: number) => ({ "Sr.No.": index + 1, ...row }))}
            filename={`${sectionName.replace(/[^a-zA-Z0-9]/g, "_")}`}
            type="section-data"
            variant="outline"
            size="sm"
          />
        </div>

        <div className="overflow-auto border rounded-lg max-h-96">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Sr.No.</th>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b border-r">Period</th>
                {headers.map((header) => (
                  <th
                    key={header}
                    className={`px-3 py-2 text-left font-medium text-gray-900 border-b ${header === headers[headers.length - 1] ? "" : "border-r"
                      }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allData.map((row: any, index: number) => (
                <tr key={index} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                  <td className="px-3 py-2 text-gray-900 font-medium border-r">{index + 1}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium border-r">{row._period}</td>
                  {headers.map((header, headerIndex) => (
                    <td
                      key={header}
                      className={`px-3 py-2 text-gray-900 ${headerIndex === headers.length - 1 ? "" : "border-r"}`}
                    >
                      {typeof row[header] === "number" && header.toLowerCase().includes("ksh")
                        ? formatCurrency(row[header])
                        : row[header] || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Get sections that have data
  const sectionsWithData = sections.filter((section) => {
    return filteredReturns.some((vatReturn) => {
      const sectionData = (vatReturn as any)[section.key]
      return sectionData?.data && Array.isArray(sectionData.data) && sectionData.data.length > 0
    })
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              {periods.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">{sectionsWithData.length} sections with data</div>
      </div>

      {filteredReturns.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">No VAT returns found for the selected period</p>
          </CardContent>
        </Card>
      ) : sectionsWithData.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">No section data available for the selected period</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>VAT Sections</CardTitle>
            <CardDescription>
              Data extracted from VAT return sections - Section O, B2, and F2 use optimized formats for better analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={sectionsWithData[0]?.key} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-1">
                {sectionsWithData.map((section) => {
                  const recordCount = filteredReturns.reduce((count, vatReturn) => {
                    const sectionData = (vatReturn as any)[section.key]
                    return count + (sectionData?.data?.length || 0)
                  }, 0)

                  return (
                    <TabsTrigger
                      key={section.key}
                      value={section.key}
                      className="flex flex-col items-center gap-1 h-auto py-2 px-2"
                    >
                      <span className="font-medium text-xs">{section.name}</span>
                      <Badge variant="secondary" className={`text-xs ${section.color}`}>
                        {recordCount}
                      </Badge>
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              {sectionsWithData.map((section) => (
                <TabsContent key={section.key} value={section.key} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{section.title}</h3>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                  </div>

                  {section.key === "section_o" && renderSectionO()}
                  {section.key === "section_b2" && renderSectionB2()}
                  {section.key === "section_f2" && renderSectionF2()}
                  {!["section_o", "section_b2", "section_f2"].includes(section.key) &&
                    renderGenericSection(section.key, section.title)}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
