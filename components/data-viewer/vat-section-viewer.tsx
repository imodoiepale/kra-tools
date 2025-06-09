// @ts-nocheck
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ExportButton } from "@/components/data-viewer/export-button"
import type { VatReturnDetails } from "@/lib/data-viewer/supabase"

interface VatSectionViewerProps {
  companyId: number
  vatReturns: VatReturnDetails[]
}

// Configuration for optimized sections
const SECTION_O_FIELDS = [
  { key: 'outputVat', srNo: 13, label: 'Output VAT', description: 'Output VAT (6)' },
  { key: 'inputVat', srNo: 14, label: 'Input VAT', description: 'Input VAT (12)' },
  { key: 'vatClaimable', srNo: 15, label: 'VAT Claimable', description: 'VAT Claimable on Services' },
  { key: 'inputVatExempt', srNo: 16, label: 'Input VAT Exempt', description: 'Input VAT attributable to Only Exempt Supplies' },
  { key: 'inputVatMixed', srNo: 17, label: 'Input VAT Mixed', description: 'Input VAT attributable to Taxable and Exempt' },
  { key: 'nonDeductible', srNo: 18, label: 'Non-Deductible', description: 'Less: Non-Deductible Input VAT' },
  { key: 'deductibleInput', srNo: 19, label: 'Deductible Input', description: 'Deductible Input VAT' },
  { key: 'vatPayable', srNo: 20, label: 'VAT Payable', description: 'VAT Payable/Credit Due for the period' },
  { key: 'creditBF', srNo: 21, label: 'Credit B/F', description: 'Credit Brought Forward from previous month' },
  { key: 'vatWithholding', srNo: 22, label: 'VAT Withholding', description: 'Total VAT Withholding Credit' },
  { key: 'refundClaim', srNo: 23, label: 'Refund Claim', description: 'Add: Refund Claim Lodged' },
  { key: 'totalVatPayable', srNo: 24, label: 'Total VAT Payable', description: 'Total VAT Payable' },
  { key: 'vatPaid', srNo: 25, label: 'VAT Paid', description: 'Total VAT Paid' },
  { key: 'creditAdjustment', srNo: 26, label: 'Credit Adjustment', description: 'Total Credit Adjustment/Inventory Approval' },
  { key: 'debitAdjustment', srNo: 27, label: 'Debit Adjustment', description: 'Total Debit Adjustment Voucher' },
  { key: 'netVat', srNo: 28, label: 'Net VAT', description: 'Net VAT Payable/Credit Carried Forward' }
] as const

const SECTION_B2_FIELDS = [
  { key: 'registeredCustomersAmount', label: 'Registered VAT', description: 'customers registered for vat' },
  { key: 'registeredCustomersTaxable', label: 'Registered Taxable', description: 'customers registered for vat' },
  { key: 'nonRegisteredCustomersAmount', label: 'Non-Registered VAT', description: 'customers not registered for vat' },
  { key: 'nonRegisteredCustomersTaxable', label: 'Non-Registered Taxable', description: 'customers not registered for vat' },
  { key: 'totalAmount', label: 'Total VAT', description: 'total' },
  { key: 'totalTaxable', label: 'Total Taxable', description: 'total' }
] as const

const SECTION_F2_FIELDS = [
  { key: 'localSuppliersAmount', label: 'Local VAT', description: 'suppliers registered for vat' },
  { key: 'localSuppliersTaxable', label: 'Local Taxable', description: 'suppliers registered for vat' },
  { key: 'importSuppliersAmount', label: 'Import VAT', description: 'suppliers not registered for vat' },
  { key: 'importSuppliersTaxable', label: 'Import Taxable', description: 'suppliers not registered for vat' },
  { key: 'totalAmount', label: 'Total VAT', description: 'total' },
  { key: 'totalTaxable', label: 'Total Taxable', description: 'total' }
] as const

export function VatSectionViewer({ companyId, vatReturns }: VatSectionViewerProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all")

  const filteredReturns = useMemo(() =>
    selectedPeriod === "all" ? vatReturns : vatReturns.filter((r) => `${r.year}-${r.month}` === selectedPeriod),
    [selectedPeriod, vatReturns]
  )

  const sections = useMemo(() => [
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
  ], [])

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

  const periods = useMemo(() =>
    vatReturns.map((r) => ({
      value: `${r.year}-${r.month}`,
      label: new Date(r.year, r.month - 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    })),
    [vatReturns]
  )

  // Create unique period map to avoid duplications
  const uniqueReturns = useMemo(() => {
    const periodMap = new Map<string, VatReturnDetails>()

    filteredReturns.forEach((vatReturn) => {
      const periodKey = `${vatReturn.year}-${vatReturn.month}`
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, vatReturn)
      }
    })

    return Array.from(periodMap.values()).sort((a, b) => {
      const dateA = new Date(a.year, a.month - 1)
      const dateB = new Date(b.year, b.month - 1)
      return dateB.getTime() - dateA.getTime() // Most recent first
    })
  }, [filteredReturns])

  // Memoized data processing for each section
  const processedSectionData = useMemo(() => {
    const data: Record<string, any[]> = {}

    // Process Section O - Tax Calculation
    data.section_o = uniqueReturns.map((vatReturn, index) => {
      const sectionO = vatReturn.section_o
      const period = new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })

      // Initialize all fields to 0
      const extractedValues = SECTION_O_FIELDS.reduce((acc, field) => {
        acc[field.key] = 0
        return acc
      }, {} as Record<string, number>)

      // Add metadata
      const rowData = {
        id: `${vatReturn.year}-${vatReturn.month}`,
        period,
        year: vatReturn.year,
        month: vatReturn.month,
        ...extractedValues
      }

      if (sectionO?.data && Array.isArray(sectionO.data)) {
        sectionO.data.forEach((row: any) => {
          const srNo = parseInt(row["Sr.No."] || "0")
          const amount = parseAmount(row["Amount (Ksh)"])

          const field = SECTION_O_FIELDS.find(f => f.srNo === srNo)
          if (field) {
            rowData[field.key] = amount
          }
        })
      }

      return rowData
    }).filter(item => Object.values(item).some(value => typeof value === 'number' && value !== 0))

    // Process Section B2 - Sales Totals
    data.section_b2 = uniqueReturns.map((vatReturn) => {
      const sectionB2 = vatReturn.section_b2
      const period = new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })

      const rowData = {
        id: `${vatReturn.year}-${vatReturn.month}`,
        period,
        year: vatReturn.year,
        month: vatReturn.month,
        registeredCustomersAmount: 0,
        registeredCustomersTaxable: 0,
        nonRegisteredCustomersAmount: 0,
        nonRegisteredCustomersTaxable: 0,
        totalAmount: 0,
        totalTaxable: 0,
      }

      if (sectionB2?.data && Array.isArray(sectionB2.data)) {
        sectionB2.data.forEach((row: any) => {
          const description = (row["Description"] || "").toLowerCase()
          const vatAmount = parseAmount(row["Amount of VAT (Ksh)"])
          const taxableValue = parseAmount(row["Taxable Value (Ksh)"])

          if (description.includes("customers registered for vat")) {
            rowData.registeredCustomersAmount = vatAmount
            rowData.registeredCustomersTaxable = taxableValue
          } else if (description.includes("customers not registered for vat")) {
            rowData.nonRegisteredCustomersAmount = vatAmount
            rowData.nonRegisteredCustomersTaxable = taxableValue
          } else if (description.includes("total") && !description.includes("customers")) {
            rowData.totalAmount = vatAmount
            rowData.totalTaxable = taxableValue
          }
        })
      }

      return rowData
    }).filter(item => item.totalAmount !== 0 || item.totalTaxable !== 0)

    // Process Section F2 - Purchases Totals
    data.section_f2 = uniqueReturns.map((vatReturn) => {
      const sectionF2 = vatReturn.section_f2
      const period = new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })

      const rowData = {
        id: `${vatReturn.year}-${vatReturn.month}`,
        period,
        year: vatReturn.year,
        month: vatReturn.month,
        localSuppliersAmount: 0,
        localSuppliersTaxable: 0,
        importSuppliersAmount: 0,
        importSuppliersTaxable: 0,
        totalAmount: 0,
        totalTaxable: 0,
      }

      if (sectionF2?.data && Array.isArray(sectionF2.data)) {
        sectionF2.data.forEach((row: any) => {
          const description = (row["Description"] || "").toLowerCase()
          const vatAmount = parseAmount(row["Amount of VAT (Ksh)"])
          const taxableValue = parseAmount(row["Taxable Value (Ksh)"])

          if (description.includes("suppliers registered for vat") && description.includes("local")) {
            rowData.localSuppliersAmount = vatAmount
            rowData.localSuppliersTaxable = taxableValue
          } else if (description.includes("suppliers not registered for vat") && description.includes("import")) {
            rowData.importSuppliersAmount = vatAmount
            rowData.importSuppliersTaxable = taxableValue
          } else if (description.includes("total") && !description.includes("suppliers")) {
            rowData.totalAmount = vatAmount
            rowData.totalTaxable = taxableValue
          }
        })
      }

      return rowData
    }).filter(item => item.totalAmount !== 0 || item.totalTaxable !== 0)

    // Process Section M - Sales Summary by Rate
    data.section_m = uniqueReturns.map((vatReturn) => {
      const sectionM = vatReturn.section_m
      const period = new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })

      const rates: Record<string, { amount: number, vat: number }> = {}
      let totalAmount = 0
      let totalVat = 0

      if (sectionM?.data && Array.isArray(sectionM.data)) {
        sectionM.data.forEach((row: any) => {
          const rate = row["Rate (%)"] || "0"
          const amount = parseAmount(row["Amount (Excl. VAT) (Ksh)"])
          const vat = parseAmount(row["Amount of Output VAT (Ksh)"])

          if (!rates[rate]) {
            rates[rate] = { amount: 0, vat: 0 }
          }
          rates[rate].amount += amount
          rates[rate].vat += vat
          totalAmount += amount
          totalVat += vat
        })
      }

      return {
        id: `${vatReturn.year}-${vatReturn.month}`,
        period,
        year: vatReturn.year,
        month: vatReturn.month,
        rates,
        totalAmount,
        totalVat,
      }
    }).filter(item => item.totalAmount !== 0 || item.totalVat !== 0)

    // Process Section N - Purchases Summary by Rate
    data.section_n = uniqueReturns.map((vatReturn) => {
      const sectionN = vatReturn.section_n
      const period = new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })

      const rates: Record<string, { amount: number, vat: number }> = {}
      let totalAmount = 0
      let totalVat = 0

      if (sectionN?.data && Array.isArray(sectionN.data)) {
        sectionN.data.forEach((row: any) => {
          const rate = row["Rate (%)"] || "0"
          const amount = parseAmount(row["Amount (Excl. VAT) (Ksh)"])
          const vat = parseAmount(row["Amount of Input VAT (Ksh)"])

          if (!rates[rate]) {
            rates[rate] = { amount: 0, vat: 0 }
          }
          rates[rate].amount += amount
          rates[rate].vat += vat
          totalAmount += amount
          totalVat += vat
        })
      }

      return {
        id: `${vatReturn.year}-${vatReturn.month}`,
        period,
        year: vatReturn.year,
        month: vatReturn.month,
        rates,
        totalAmount,
        totalVat,
      }
    }).filter(item => item.totalAmount !== 0 || item.totalVat !== 0)

    // Process other sections using generic approach
    sections.forEach((section) => {
      if (!['section_o', 'section_b2', 'section_f2', 'section_m', 'section_n'].includes(section.key)) {
        const allData: any[] = []

        uniqueReturns.forEach((vatReturn) => {
          const sectionData = (vatReturn as any)[section.key]
          if (sectionData?.data && Array.isArray(sectionData.data)) {
            sectionData.data.forEach((row: any, rowIndex: number) => {
              allData.push({
                id: `${vatReturn.year}-${vatReturn.month}-${rowIndex}`,
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

        data[section.key] = allData
      }
    })

    return data
  }, [uniqueReturns, sections])

  // Get all unique rates for sections M and N
  const allRatesM = useMemo(() =>
    Array.from(new Set(processedSectionData.section_m?.flatMap((data: any) => Object.keys(data.rates)) || [])).sort(),
    [processedSectionData.section_m]
  )

  const allRatesN = useMemo(() =>
    Array.from(new Set(processedSectionData.section_n?.flatMap((data: any) => Object.keys(data.rates)) || [])).sort(),
    [processedSectionData.section_n]
  )

  // Render Section O with mapped headers and data
  const renderSectionO = () => {
    const monthlyData = processedSectionData.section_o || []

    if (monthlyData.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data available for Section O</p>
        </div>
      )
    }

    const headers = [
      { key: 'srNo', label: 'Sr.No.', className: 'px-2 py-2 text-left font-medium text-gray-900 border-b border-r' },
      { key: 'period', label: 'Period', className: 'px-2 py-2 text-left font-medium text-gray-900 border-b border-r' },
      ...SECTION_O_FIELDS.map(field => ({
        key: field.key,
        label: `${field.label}`,
        srNo: `(${field.srNo})`,
        className: 'px-2 py-2 text-center font-medium text-gray-900 border-b border-r'
      }))
    ]

    // Remove border-r from last header
    if (headers.length > 0) {
      headers[headers.length - 1].className = headers[headers.length - 1].className.replace(' border-r', '')
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            {monthlyData.length} periods
          </Badge>
          <ExportButton
            data={monthlyData.map((row: any, index: number) => ({ "Sr.No.": index + 1, ...row }))}
            filename="Section_O_Tax_Calculation_Monthly"
            type="section-data"
            variant="outline"
            size="sm"
          />
        </div>

        <div className="overflow-auto border rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {headers.map((header, index) => (
                  <th key={header.key} className={header.className}>
                    {header.label}
                    {header.srNo && <br />}
                    {header.srNo && <span className="text-xs text-gray-500">{header.srNo}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row: any, index: number) => (
                <tr key={row.id} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                  <td className="px-2 py-2 text-gray-900 font-medium border-r">{index + 1}</td>
                  <td className="px-2 py-2 text-gray-900 font-medium border-r">{row.period}</td>
                  {SECTION_O_FIELDS.map((field, fieldIndex) => (
                    <td
                      key={field.key}
                      className={`px-2 py-2 text-gray-900 text-right ${fieldIndex === SECTION_O_FIELDS.length - 1 ? '' : 'border-r'}`}
                    >
                      {formatCurrency(row[field.key])}
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

  // Render Section B2 with mapped headers and data
  const renderSectionB2 = () => {
    const monthlyData = processedSectionData.section_b2 || []

    if (monthlyData.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data available for Section B2</p>
        </div>
      )
    }

    const headerGroups = [
      { key: 'registered', label: 'Registered Customers', colSpan: 2, bgColor: 'bg-green-50' },
      { key: 'nonRegistered', label: 'Non-Registered Customers', colSpan: 2, bgColor: 'bg-blue-50' },
      { key: 'total', label: 'Total', colSpan: 2, bgColor: 'bg-gray-50' }
    ]

    const subHeaders = [
      { key: 'registeredCustomersAmount', label: 'VAT Amount', bgColor: 'bg-green-50' },
      { key: 'registeredCustomersTaxable', label: 'Taxable Value', bgColor: 'bg-green-50' },
      { key: 'nonRegisteredCustomersAmount', label: 'VAT Amount', bgColor: 'bg-blue-50' },
      { key: 'nonRegisteredCustomersTaxable', label: 'Taxable Value', bgColor: 'bg-blue-50' },
      { key: 'totalAmount', label: 'VAT Amount', bgColor: 'bg-gray-50' },
      { key: 'totalTaxable', label: 'Taxable Value', bgColor: 'bg-gray-50' }
    ]

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            {monthlyData.length} periods
          </Badge>
          <ExportButton
            data={monthlyData.map((row: any, index: number) => ({ "Sr.No.": index + 1, ...row }))}
            filename="Section_B2_Sales_Totals_Monthly"
            type="section-data"
            variant="outline"
            size="sm"
          />
        </div>

        <div className="overflow-auto border rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th rowSpan={2} className="px-3 py-3 text-left font-medium text-gray-900 border-b border-r">Sr.No.</th>
                <th rowSpan={2} className="px-3 py-3 text-left font-medium text-gray-900 border-b border-r">Period</th>
                {headerGroups.map((group, index) => (
                  <th
                    key={group.key}
                    colSpan={group.colSpan}
                    className={`px-3 py-2 text-center font-medium text-gray-900 border-b ${index === headerGroups.length - 1 ? '' : 'border-r'} ${group.bgColor}`}
                  >
                    {group.label}
                  </th>
                ))}
              </tr>
              <tr>
                {subHeaders.map((subHeader, index) => (
                  <th
                    key={subHeader.key}
                    className={`px-2 py-2 text-center font-medium text-gray-900 border-b ${index === subHeaders.length - 1 ? '' : 'border-r'} ${subHeader.bgColor}`}
                  >
                    {subHeader.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row: any, index: number) => (
                <tr key={row.id} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                  <td className="px-3 py-3 text-gray-900 font-medium border-r">{index + 1}</td>
                  <td className="px-3 py-3 text-gray-900 font-medium border-r">{row.period}</td>
                  {subHeaders.map((subHeader, subIndex) => (
                    <td
                      key={subHeader.key}
                      className={`px-2 py-3 text-gray-900 text-right ${subIndex === subHeaders.length - 1 ? '' : 'border-r'} ${subIndex >= 4 ? 'font-semibold' : ''}`}
                    >
                      {formatCurrency(row[subHeader.key])}
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

  // Render Section M with mapped headers and data
  const renderSectionM = () => {
    const monthlyData = processedSectionData.section_m || []

    if (monthlyData.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data available for Section M</p>
        </div>
      )
    }

    const rateHeaders = allRatesM.map(rate => [
      { key: `rate_${rate}_amount`, label: 'Amount', bgColor: 'bg-indigo-50' },
      { key: `rate_${rate}_vat`, label: 'Output VAT', bgColor: 'bg-indigo-50' }
    ]).flat()

    const totalHeaders = [
      { key: 'totalAmount', label: 'Total Amount', bgColor: 'bg-gray-50' },
      { key: 'totalVat', label: 'Total VAT', bgColor: 'bg-gray-50' }
    ]

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            {monthlyData.length} periods
          </Badge>
          <ExportButton
            data={monthlyData.map((row: any, index: number) => ({ "Sr.No.": index + 1, ...row }))}
            filename="Section_M_Sales_Summary_Monthly"
            type="section-data"
            variant="outline"
            size="sm"
          />
        </div>

        <div className="overflow-auto border rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th rowSpan={2} className="px-3 py-3 text-left font-medium text-gray-900 border-b border-r">Sr.No.</th>
                <th rowSpan={2} className="px-3 py-3 text-left font-medium text-gray-900 border-b border-r">Period</th>
                {allRatesM.map((rate, index) => (
                  <th
                    key={rate}
                    colSpan={2}
                    className={`px-3 py-2 text-center font-medium text-gray-900 border-b ${index === allRatesM.length - 1 && totalHeaders.length === 0 ? '' : 'border-r'} bg-indigo-50`}
                  >
                    Rate {rate}%
                  </th>
                ))}
                {totalHeaders.length > 0 && (
                  <th colSpan={2} className="px-3 py-2 text-center font-medium text-gray-900 border-b bg-gray-50">
                    Total
                  </th>
                )}
              </tr>
              <tr>
                {rateHeaders.map((header, index) => (
                  <th
                    key={header.key}
                    className={`px-2 py-2 text-center font-medium text-gray-900 border-b ${index === rateHeaders.length - 1 && totalHeaders.length === 0 ? '' : 'border-r'} ${header.bgColor}`}
                  >
                    {header.label}
                  </th>
                ))}
                {totalHeaders.map((header, index) => (
                  <th
                    key={header.key}
                    className={`px-2 py-2 text-center font-medium text-gray-900 border-b ${index === totalHeaders.length - 1 ? '' : 'border-r'} ${header.bgColor}`}
                  >
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row: any, index: number) => (
                <tr key={row.id} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                  <td className="px-3 py-3 text-gray-900 font-medium border-r">{index + 1}</td>
                  <td className="px-3 py-3 text-gray-900 font-medium border-r">{row.period}</td>
                  {allRatesM.map((rate, rateIndex) => (
                    <>
                      <td
                        key={`${rate}-amount`}
                        className={`px-2 py-3 text-gray-900 border-r text-right`}
                      >
                        {formatCurrency(row.rates[rate]?.amount || 0)}
                      </td>
                      <td
                        key={`${rate}-vat`}
                        className={`px-2 py-3 text-gray-900 ${rateIndex === allRatesM.length - 1 && totalHeaders.length === 0 ? '' : 'border-r'} text-right`}
                      >
                        {formatCurrency(row.rates[rate]?.vat || 0)}
                      </td>
                    </>
                  ))}
                  {totalHeaders.map((header, headerIndex) => (
                    <td
                      key={header.key}
                      className={`px-2 py-3 text-gray-900 text-right font-semibold ${headerIndex === totalHeaders.length - 1 ? '' : 'border-r'}`}
                    >
                      {formatCurrency(row[header.key])}
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

  // Render Section N with mapped headers and data
  const renderSectionN = () => {
    const monthlyData = processedSectionData.section_n || []

    if (monthlyData.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data available for Section N</p>
        </div>
      )
    }

    const rateHeaders = allRatesN.map(rate => [
      { key: `rate_${rate}_amount`, label: 'Amount', bgColor: 'bg-pink-50' },
      { key: `rate_${rate}_vat`, label: 'Input VAT', bgColor: 'bg-pink-50' }
    ]).flat()

    const totalHeaders = [
      { key: 'totalAmount', label: 'Total Amount', bgColor: 'bg-gray-50' },
      { key: 'totalVat', label: 'Total VAT', bgColor: 'bg-gray-50' }
    ]

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            {monthlyData.length} periods
          </Badge>
          <ExportButton
            data={monthlyData.map((row: any, index: number) => ({ "Sr.No.": index + 1, ...row }))}
            filename="Section_N_Purchases_Summary_Monthly"
            type="section-data"
            variant="outline"
            size="sm"
          />
        </div>

        <div className="overflow-auto border rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th rowSpan={2} className="px-3 py-3 text-left font-medium text-gray-900 border-b border-r">Sr.No.</th>
                <th rowSpan={2} className="px-3 py-3 text-left font-medium text-gray-900 border-b border-r">Period</th>
                {allRatesN.map((rate, index) => (
                  <th
                    key={rate}
                    colSpan={2}
                    className={`px-3 py-2 text-center font-medium text-gray-900 border-b ${index === allRatesN.length - 1 && totalHeaders.length === 0 ? '' : 'border-r'} bg-pink-50`}
                  >
                    Rate {rate}%
                  </th>
                ))}
                {totalHeaders.length > 0 && (
                  <th colSpan={2} className="px-3 py-2 text-center font-medium text-gray-900 border-b bg-gray-50">
                    Total
                  </th>
                )}
              </tr>
              <tr>
                {rateHeaders.map((header, index) => (
                  <th
                    key={header.key}
                    className={`px-2 py-2 text-center font-medium text-gray-900 border-b ${index === rateHeaders.length - 1 && totalHeaders.length === 0 ? '' : 'border-r'} ${header.bgColor}`}
                  >
                    {header.label}
                  </th>
                ))}
                {totalHeaders.map((header, index) => (
                  <th
                    key={header.key}
                    className={`px-2 py-2 text-center font-medium text-gray-900 border-b ${index === totalHeaders.length - 1 ? '' : 'border-r'} ${header.bgColor}`}
                  >
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row: any, index: number) => (
                <tr key={row.id} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                  <td className="px-3 py-3 text-gray-900 font-medium border-r">{index + 1}</td>
                  <td className="px-3 py-3 text-gray-900 font-medium border-r">{row.period}</td>
                  {allRatesN.map((rate, rateIndex) => (
                    <>
                      <td
                        key={`${rate}-amount`}
                        className={`px-2 py-3 text-gray-900 border-r text-right`}
                      >
                        {formatCurrency(row.rates[rate]?.amount || 0)}
                      </td>
                      <td
                        key={`${rate}-vat`}
                        className={`px-2 py-3 text-gray-900 ${rateIndex === allRatesN.length - 1 && totalHeaders.length === 0 ? '' : 'border-r'} text-right`}
                      >
                        {formatCurrency(row.rates[rate]?.vat || 0)}
                      </td>
                    </>
                  ))}
                  {totalHeaders.map((header, headerIndex) => (
                    <td
                      key={header.key}
                      className={`px-2 py-3 text-gray-900 text-right font-semibold ${headerIndex === totalHeaders.length - 1 ? '' : 'border-r'}`}
                    >
                      {formatCurrency(row[header.key])}
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

  // Render Section F2 with mapped headers and data
  const renderSectionF2 = () => {
    const monthlyData = processedSectionData.section_f2 || []

    if (monthlyData.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data available for Section F2</p>
        </div>
      )
    }

    const headerGroups = [
      { key: 'local', label: 'Local Suppliers (Registered)', colSpan: 2, bgColor: 'bg-orange-50' },
      { key: 'import', label: 'Import Suppliers (Not Registered)', colSpan: 2, bgColor: 'bg-red-50' },
      { key: 'total', label: 'Total', colSpan: 2, bgColor: 'bg-gray-50' }
    ]

    const subHeaders = [
      { key: 'localSuppliersAmount', label: 'VAT Amount', bgColor: 'bg-orange-50' },
      { key: 'localSuppliersTaxable', label: 'Taxable Value', bgColor: 'bg-orange-50' },
      { key: 'importSuppliersAmount', label: 'VAT Amount', bgColor: 'bg-red-50' },
      { key: 'importSuppliersTaxable', label: 'Taxable Value', bgColor: 'bg-red-50' },
      { key: 'totalAmount', label: 'VAT Amount', bgColor: 'bg-gray-50' },
      { key: 'totalTaxable', label: 'Taxable Value', bgColor: 'bg-gray-50' }
    ]

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            {monthlyData.length} periods
          </Badge>
          <ExportButton
            data={monthlyData.map((row: any, index: number) => ({ "Sr.No.": index + 1, ...row }))}
            filename="Section_F2_Purchases_Totals_Monthly"
            type="section-data"
            variant="outline"
            size="sm"
          />
        </div>

        <div className="overflow-auto border rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th rowSpan={2} className="px-3 py-3 text-left font-medium text-gray-900 border-b border-r">Sr.No.</th>
                <th rowSpan={2} className="px-3 py-3 text-left font-medium text-gray-900 border-b border-r">Period</th>
                {headerGroups.map((group, index) => (
                  <th
                    key={group.key}
                    colSpan={group.colSpan}
                    className={`px-3 py-2 text-center font-medium text-gray-900 border-b ${index === headerGroups.length - 1 ? '' : 'border-r'} ${group.bgColor}`}
                  >
                    {group.label}
                  </th>
                ))}
              </tr>
              <tr>
                {subHeaders.map((subHeader, index) => (
                  <th
                    key={subHeader.key}
                    className={`px-2 py-2 text-center font-medium text-gray-900 border-b ${index === subHeaders.length - 1 ? '' : 'border-r'} ${subHeader.bgColor}`}
                  >
                    {subHeader.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row: any, index: number) => (
                <tr key={row.id} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                  <td className="px-3 py-3 text-gray-900 font-medium border-r">{index + 1}</td>
                  <td className="px-3 py-3 text-gray-900 font-medium border-r">{row.period}</td>
                  {subHeaders.map((subHeader, subIndex) => (
                    <td
                      key={subHeader.key}
                      className={`px-2 py-3 text-gray-900 text-right ${subIndex === subHeaders.length - 1 ? '' : 'border-r'} ${subIndex >= 4 ? 'font-semibold' : ''}`}
                    >
                      {formatCurrency(row[subHeader.key])}
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

  // Generic render for other sections with mapped headers
  const renderGenericSection = (sectionKey: string, sectionName: string) => {
    const allData = processedSectionData[sectionKey] || []

    if (allData.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data available for {sectionName}</p>
        </div>
      )
    }

    const headers = Object.keys(allData[0] || {}).filter((key) => !key.startsWith("_") && key !== 'id')
    const mappedHeaders = [
      { key: 'srNo', label: 'Sr.No.', isSpecial: true },
      { key: '_period', label: 'Period', isSpecial: true },
      ...headers.filter(h => !['srNo', '_period'].includes(h)).map(header => ({
        key: header,
        label: header.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        isSpecial: false
      }))
    ]

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
                {mappedHeaders.map((header, index) => (
                  <th
                    key={header.key}
                    className={`px-3 py-2 text-left font-medium text-gray-900 border-b ${index === mappedHeaders.length - 1 ? '' : 'border-r'}`}
                  >
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allData.map((row: any, index: number) => (
                <tr key={row.id || index} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                  <td className="px-3 py-2 text-gray-900 font-medium border-r">{index + 1}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium border-r">{row._period}</td>
                  {headers.filter(h => !['srNo', '_period'].includes(h)).map((header, headerIndex) => (
                    <td
                      key={header}
                      className={`px-3 py-2 text-gray-900 ${headerIndex === headers.length - 3 ? '' : 'border-r'}`}
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
  const sectionsWithData = useMemo(() =>
    sections.filter((section) => {
      const sectionData = processedSectionData[section.key]
      return sectionData && sectionData.length > 0
    }),
    [sections, processedSectionData]
  )

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
              Data extracted from VAT return sections - Section O, B2, F2, M, N use optimized formats for better analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={sectionsWithData[0]?.key} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-1">
                {sectionsWithData.map((section) => {
                  const recordCount = processedSectionData[section.key]?.length || 0

                  return (
                    <TabsTrigger
                      key={section.key}
                      value={section.key}
                      className="flex items-center gap-4 py-2 px-2"
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
                  {section.key === "section_m" && renderSectionM()}
                  {section.key === "section_n" && renderSectionN()}
                  {!["section_o", "section_b2", "section_f2", "section_m", "section_n"].includes(section.key) &&
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