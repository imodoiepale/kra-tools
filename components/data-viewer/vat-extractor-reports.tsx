"use client"

import { useState, useEffect } from "react"
import { BarChart3, Download, Filter, RotateCcw, Search, Settings, Calendar, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCompanies, getVatReturnDetails } from "@/lib/data-viewer/data-fetchers"
import type { Company, VatReturnDetails } from "@/lib/data-viewer/supabase"

export function VatExtractorReports() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [vatReturns, setVatReturns] = useState<VatReturnDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"summary" | "detailed">("summary")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<string>("all")

  useEffect(() => {
    async function loadData() {
      try {
        const [companiesData, vatData] = await Promise.all([getCompanies(), getVatReturnDetails()])
        setCompanies(companiesData)
        setVatReturns(vatData)
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const getCompanyName = (companyId: number) => {
    const company = companies.find((c) => c.id === companyId)
    return company?.company_name || `Company ${companyId}`
  }

  const getCompanyPin = (companyId: number) => {
    const company = companies.find((c) => c.id === companyId)
    return company?.kra_pin || ""
  }

  const calculateCompanyStats = (companyId: number) => {
    const companyReturns = vatReturns.filter((r) => r.company_id === companyId)
    const totalReturns = companyReturns.length
    const nilReturns = companyReturns.filter((r) => r.is_nil_return).length
    const dataReturns = totalReturns - nilReturns

    let totalOutputVat = 0
    let totalInputVat = 0

    companyReturns.forEach((vatReturn) => {
      if (!vatReturn.is_nil_return) {
        // Calculate from section M (Sales Summary)
        if (vatReturn.section_m?.data && Array.isArray(vatReturn.section_m.data)) {
          vatReturn.section_m.data.forEach((row: any) => {
            if (row["Amount of Output VAT (Ksh)"]) {
              totalOutputVat += Number(row["Amount of Output VAT (Ksh)"]) || 0
            }
          })
        }

        // Calculate from section N (Purchases Summary)
        if (vatReturn.section_n?.data && Array.isArray(vatReturn.section_n.data)) {
          vatReturn.section_n.data.forEach((row: any) => {
            if (row["Amount of Input VAT (Ksh)"]) {
              totalInputVat += Number(row["Amount of Input VAT (Ksh)"]) || 0
            }
          })
        }
      }
    })

    const latestExtraction = companyReturns.length > 0 ? companyReturns[0].extraction_timestamp : null

    return {
      totalReturns,
      nilReturns,
      dataReturns,
      totalOutputVat,
      totalInputVat,
      netVat: totalOutputVat - totalInputVat,
      latestExtraction,
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "decimal",
      // currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    })
  }

  const uniqueCompanies = Array.from(new Set(vatReturns.map((r) => r.company_id)))
    .map((id) => companies.find((c) => c.id === id))
    .filter(Boolean) as Company[]

  const filteredCompanies = uniqueCompanies.filter((company) => {
    if (selectedCompany !== "all" && company.id.toString() !== selectedCompany) return false
    if (searchTerm && !company.company_name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-lg font-medium">Loading VAT extractor reports...</div>
          <div className="text-sm text-gray-500">Please wait while we fetch the data</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <Card className="border-0 bg-white shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">VAT Extractor Reports</CardTitle>
                <p className="text-sm text-gray-600">Analysis and reporting for VAT extractions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "summary" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("summary")}
                className="h-8"
              >
                <Settings className="mr-1 h-3 w-3" />
                Summary
              </Button>
              <Button
                variant={viewMode === "detailed" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("detailed")}
                className="h-8"
              >
                <BarChart3 className="mr-1 h-3 w-3" />
                Detailed
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Search and Filters */}
      <Card className="border-0 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search companies, categories, amounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter Categories
              <Badge variant="secondary" className="ml-1">
                {filteredCompanies.length}
              </Badge>
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {viewMode === "summary" ? (
        <SummaryView
          companies={filteredCompanies}
          calculateCompanyStats={calculateCompanyStats}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      ) : (
        <DetailedView
          companies={filteredCompanies}
          vatReturns={vatReturns}
          getCompanyName={getCompanyName}
          getCompanyPin={getCompanyPin}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}
    </div>
  )
}

function SummaryView({
  companies,
  calculateCompanyStats,
  formatCurrency,
  formatDate,
}: {
  companies: Company[]
  calculateCompanyStats: (id: number) => any
  formatCurrency: (amount: number) => string
  formatDate: (date: string | null) => string
}) {
  return (
    <Card className="border-0 bg-white shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  IDX | ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex items-center gap-1">
                    Company
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex items-center gap-1">
                    Returns
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex items-center gap-1">
                    Nil Returns
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex items-center gap-1">
                    Latest Extraction
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex items-center gap-1">
                    Data Returns
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex items-center justify-end gap-1">
                    Total Amount
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {companies.map((company, index) => {
                const stats = calculateCompanyStats(company.id)
                return (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {index + 1} | {company.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        {company.company_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">{stats.totalReturns}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">{stats.nilReturns}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(stats.latestExtraction)}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">{stats.dataReturns}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-green-600">
                      {formatCurrency(stats.netVat)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function DetailedView({
  companies,
  vatReturns,
  getCompanyName,
  getCompanyPin,
  formatCurrency,
  formatDate,
}: {
  companies: Company[]
  vatReturns: VatReturnDetails[]
  getCompanyName: (id: number) => string
  getCompanyPin: (id: number) => string
  formatCurrency: (amount: number) => string
  formatDate: (date: string | null) => string
}) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    companies.length > 0 ? companies[0].id : null,
  )

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId)
  const companyReturns = vatReturns.filter((r) => r.company_id === selectedCompanyId)

  if (!selectedCompany) {
    return (
      <Card className="border-0 bg-white shadow-sm">
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">No company selected</p>
        </CardContent>
      </Card>
    )
  }

  const totalAmount = companyReturns.reduce((sum, vatReturn) => {
    if (vatReturn.is_nil_return) return sum

    let outputVat = 0
    let inputVat = 0

    if (vatReturn.section_m?.data && Array.isArray(vatReturn.section_m.data)) {
      vatReturn.section_m.data.forEach((row: any) => {
        if (row["Amount of Output VAT (Ksh)"]) {
          outputVat += Number(row["Amount of Output VAT (Ksh)"]) || 0
        }
      })
    }

    if (vatReturn.section_n?.data && Array.isArray(vatReturn.section_n.data)) {
      vatReturn.section_n.data.forEach((row: any) => {
        if (row["Amount of Input VAT (Ksh)"]) {
          inputVat += Number(row["Amount of Input VAT (Ksh)"]) || 0
        }
      })
    }

    return sum + (outputVat - inputVat)
  }, 0)

  return (
    <div className="space-y-4">
      {/* Company Selection */}
      <Card className="border-0 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedCompany.company_name}</h3>
              <p className="text-sm text-gray-600">
                {companyReturns.length} extraction periods | Total: {formatCurrency(totalAmount)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" className="gap-1">
                  <BarChart3 className="h-3 w-3" />
                  All Data
                  <Badge variant="secondary" className="ml-1">
                    {companyReturns.length}
                  </Badge>
                </Button>
                <Button variant="outline" size="sm" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  Month View
                  <Badge variant="secondary" className="ml-1">
                    {companyReturns.length}
                  </Badge>
                </Button>
                <Button variant="outline" size="sm" className="gap-1">
                  Totals
                  <span className="text-xs">3 years</span>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  Reset
                </Button>
                <span className="text-xs text-gray-500">Tab: allData</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-0 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Select date range</span>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search within data..." className="pl-10" />
            </div>
            <span className="text-xs text-gray-500">{companyReturns.length} records</span>
            <Button variant="outline" size="sm">
              Columns
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card className="border-0 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-1">
                      Month/Year
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-1">
                      Sr.No.
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-1">
                      Company PIN
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-1">
                      Return Type
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-1">
                      Status
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-1">
                      Output VAT
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-1">
                      Input VAT
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-1">
                      Extraction Date
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {companyReturns.map((vatReturn, index) => {
                  let outputVat = 0
                  let inputVat = 0

                  if (!vatReturn.is_nil_return) {
                    if (vatReturn.section_m?.data && Array.isArray(vatReturn.section_m.data)) {
                      vatReturn.section_m.data.forEach((row: any) => {
                        if (row["Amount of Output VAT (Ksh)"]) {
                          outputVat += Number(row["Amount of Output VAT (Ksh)"]) || 0
                        }
                      })
                    }

                    if (vatReturn.section_n?.data && Array.isArray(vatReturn.section_n.data)) {
                      vatReturn.section_n.data.forEach((row: any) => {
                        if (row["Amount of Input VAT (Ksh)"]) {
                          inputVat += Number(row["Amount of Input VAT (Ksh)"]) || 0
                        }
                      })
                    }
                  }

                  return (
                    <tr key={`${vatReturn.year}-${vatReturn.month}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-600">
                        {getCompanyPin(vatReturn.company_id)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {vatReturn.is_nil_return ? "Nil Return" : "Data Return"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={vatReturn.processing_status === "completed" ? "default" : "secondary"}
                          className="bg-gray-800 text-white"
                        >
                          {vatReturn.processing_status === "completed" ? "Active" : "Processing"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {vatReturn.is_nil_return ? "-" : formatCurrency(outputVat)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {vatReturn.is_nil_return ? "-" : formatCurrency(inputVat)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{formatDate(vatReturn.extraction_timestamp)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
