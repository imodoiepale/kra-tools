"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Download, Eye } from "lucide-react"
import Link from "next/link"
import type { Company, VatReturnDetails } from "@/lib/data-viewer/supabase"

interface VatDataTableProps {
  companies: Company[]
  vatReturns: VatReturnDetails[]
  viewType: "summary" | "detailed"
}

export function VatDataTable({ companies, vatReturns, viewType }: VatDataTableProps) {
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [selectedCompany, setSelectedCompany] = useState<string>("all")

  const years = Array.from(new Set(vatReturns.map((r) => r.year))).sort((a, b) => b - a)

  const filteredReturns = vatReturns.filter((vatReturn) => {
    if (selectedYear !== "all" && vatReturn.year !== Number.parseInt(selectedYear)) return false
    if (selectedCompany !== "all" && vatReturn.company_id !== Number.parseInt(selectedCompany)) return false
    return true
  })

  const getCompanyName = (companyId: number) => {
    const company = companies.find((c) => c.id === companyId)
    return company?.company_name || `Company ${companyId}`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "decimal",
      // currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const calculateVatTotals = (vatReturn: VatReturnDetails) => {
    if (vatReturn.is_nil_return) return { outputVat: 0, inputVat: 0, netVat: 0 }

    let outputVat = 0
    let inputVat = 0

    // Calculate from section M (Sales Summary)
    if (vatReturn.section_m?.data && Array.isArray(vatReturn.section_m.data)) {
      vatReturn.section_m.data.forEach((row: any) => {
        if (row["Amount of Output VAT (Ksh)"]) {
          outputVat += Number(row["Amount of Output VAT (Ksh)"]) || 0
        }
      })
    }

    // Calculate from section N (Purchases Summary)
    if (vatReturn.section_n?.data && Array.isArray(vatReturn.section_n.data)) {
      vatReturn.section_n.data.forEach((row: any) => {
        if (row["Amount of Input VAT (Ksh)"]) {
          inputVat += Number(row["Amount of Input VAT (Ksh)"]) || 0
        }
      })
    }

    return { outputVat, inputVat, netVat: outputVat - inputVat }
  }

  if (viewType === "summary") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center">
          <div className="grid gap-2">
            <CardTitle>VAT Returns Summary</CardTitle>
            <CardDescription>Overview of all VAT returns from database</CardDescription>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Sr.No.</th>
                  <th className="pb-2 font-medium">Company</th>
                  <th className="pb-2 font-medium">Period</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Output VAT</th>
                  <th className="pb-2 font-medium">Input VAT</th>
                  <th className="pb-2 font-medium">Net VAT</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      No VAT returns found for the selected filters
                    </td>
                  </tr>
                ) : (
                  filteredReturns.slice(0, 50).map((vatReturn, index) => {
                    const { outputVat, inputVat, netVat } = calculateVatTotals(vatReturn)
                    return (
                      <tr
                        key={`${vatReturn.company_id}-${vatReturn.year}-${vatReturn.month}`}
                        className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}
                      >
                        <td className="py-3">{index + 1}</td>
                        <td className="py-3">{getCompanyName(vatReturn.company_id)}</td>
                        <td className="py-3">
                          {new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3">
                          <div
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              vatReturn.is_nil_return
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                            }`}
                          >
                            {vatReturn.is_nil_return ? "Nil" : "Data"}
                          </div>
                        </td>
                        <td className="py-3">{vatReturn.is_nil_return ? "-" : formatCurrency(outputVat)}</td>
                        <td className="py-3">{vatReturn.is_nil_return ? "-" : formatCurrency(inputVat)}</td>
                        <td className="py-3">{vatReturn.is_nil_return ? "-" : formatCurrency(netVat)}</td>
                        <td className="py-3">
                          <div
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              vatReturn.processing_status === "completed"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                            }`}
                          >
                            {vatReturn.processing_status}
                          </div>
                        </td>
                        <td className="py-3">
                          <Link href={`/companies/${vatReturn.company_id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="mr-1 h-3 w-3" />
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Detailed view - show more granular data
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed VAT Data</CardTitle>
        <CardDescription>Comprehensive view of VAT return details from database</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium">Sr.No.</th>
                <th className="pb-2 font-medium">Company</th>
                <th className="pb-2 font-medium">KRA PIN</th>
                <th className="pb-2 font-medium">Period</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Processing Status</th>
                <th className="pb-2 font-medium">Extraction Date</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.slice(0, 50).map((vatReturn, index) => {
                const company = companies.find((c) => c.id === vatReturn.company_id)
                return (
                  <tr
                    key={`${vatReturn.company_id}-${vatReturn.year}-${vatReturn.month}`}
                    className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}
                  >
                    <td className="py-3">{index + 1}</td>
                    <td className="py-3">{getCompanyName(vatReturn.company_id)}</td>
                    <td className="py-3 font-mono text-xs">{company?.kra_pin || "N/A"}</td>
                    <td className="py-3">
                      {new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3">
                      <div
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          vatReturn.is_nil_return ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                        }`}
                      >
                        {vatReturn.is_nil_return ? "Nil Return" : "Data Return"}
                      </div>
                    </td>
                    <td className="py-3">
                      <div
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          vatReturn.processing_status === "completed"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {vatReturn.processing_status}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(vatReturn.extraction_timestamp).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <Link href={`/companies/${vatReturn.company_id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="mr-1 h-3 w-3" />
                          View Details
                        </Button>
                      </Link>
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
