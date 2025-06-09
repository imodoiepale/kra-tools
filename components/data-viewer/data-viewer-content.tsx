"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Building2,
  FileText,
  BarChart3,
  Users,
  CalendarDays,
  AlertTriangle,
  CheckCircle,
  Mail,
} from "lucide-react"
import { VatSectionViewer } from "@/components/data-viewer/vat-section-viewer"
import { ReturnListingsTable } from "@/components/data-viewer/return-listings-table"
import { ExportButton } from "@/components/data-viewer/export-button"
import { getCompanyReturnListings } from "@/lib/data-viewer/data-fetchers"
import type { Company, VatReturnDetails, CompanyVatReturnListings } from "@/lib/data-viewer/supabase"

interface DataViewerContentProps {
  companies: Company[]
  allVatReturns: VatReturnDetails[]
}

export function DataViewerContent({ companies, allVatReturns }: DataViewerContentProps) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [companySearch, setCompanySearch] = useState("")
  const [fromYear, setFromYear] = useState<string>("2024")
  const [fromMonth, setFromMonth] = useState<string>("1")
  const [toYear, setToYear] = useState<string>("2024")
  const [toMonth, setToMonth] = useState<string>("12")
  const [companyVatReturns, setCompanyVatReturns] = useState<VatReturnDetails[]>([])
  const [companyListings, setCompanyListings] = useState<CompanyVatReturnListings[]>([])
  const [loading, setLoading] = useState(false)

  // Filter companies based on search
  const filteredCompanies = companies.filter(
    (company) =>
      company.company_name.toLowerCase().includes(companySearch.toLowerCase()) ||
      (company.kra_pin && company.kra_pin.toLowerCase().includes(companySearch.toLowerCase())),
  )

  // Get available years from data
  const availableYears = Array.from(new Set(allVatReturns.map((r) => r.year))).sort((a, b) => b - a)
  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ]

  // Load company-specific data when company or date range changes
  useEffect(() => {
    if (!selectedCompany) return

    const loadCompanyData = async () => {
      setLoading(true)
      try {
        // Filter VAT returns by company and date range
        const filteredReturns = allVatReturns.filter((vatReturn) => {
          if (vatReturn.company_id !== selectedCompany.id) return false

          const returnDate = new Date(vatReturn.year, vatReturn.month - 1)
          const fromDate = new Date(Number.parseInt(fromYear), Number.parseInt(fromMonth) - 1)
          const toDate = new Date(Number.parseInt(toYear), Number.parseInt(toMonth) - 1)

          return returnDate >= fromDate && returnDate <= toDate
        })

        setCompanyVatReturns(filteredReturns)

        // Load company listings
        const listings = await getCompanyReturnListings(selectedCompany.id)
        setCompanyListings(listings)
      } catch (error) {
        console.error("Error loading company data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadCompanyData()
  }, [selectedCompany, fromYear, fromMonth, toYear, toMonth, allVatReturns])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    try {
      // Handle DD/MM/YYYY format from the attachment
      if (dateString.includes("/")) {
        const [day, month, year] = dateString.split("/")
        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`
      }

      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, "0")
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    } catch {
      return dateString || "-"
    }
  }

  // Helper function to safely parse numbers from various formats
  const parseAmount = (value: any): number => {
    if (value === null || value === undefined || value === "" || value === "-") return 0

    // Convert to string and clean up
    const cleanValue = String(value)
      .replace(/[^\d.-]/g, "") // Remove all non-numeric characters except dots and minus
      .replace(/,/g, "") // Remove commas

    const parsed = Number.parseFloat(cleanValue)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  // Check if filing date is late (past 20th of next month)
  const isFilingLate = (vatReturn: VatReturnDetails, filingDate: string) => {
    if (!filingDate) return false

    try {
      // Parse DD/MM/YYYY format for filing date
      const [day, month, year] = filingDate.split("/")
      const filing = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))

      // Calculate deadline: 20th of the month AFTER the VAT period
      const returnPeriod = new Date(vatReturn.year, vatReturn.month - 1)
      const deadline = new Date(returnPeriod.getFullYear(), returnPeriod.getMonth() + 1, 20) // 20th of next month

      return filing > deadline
    } catch (error) {
      return false
    }
  }

  // Extract specific values from Section O using the exact structure from attachment
  const extractSectionOValues = (vatReturn: VatReturnDetails) => {
    const sectionO = vatReturn.section_o
    if (!sectionO?.data || !Array.isArray(sectionO.data)) {
      return {
        outputVat6: 0,
        inputVat12: 0,
        totalVatWithholding: 0,
        creditBroughtForward: 0,
        netVatPayable: 0,
      }
    }

    let outputVat6 = 0
    let inputVat12 = 0
    let totalVatWithholding = 0
    let creditBroughtForward = 0
    let netVatPayable = 0

    sectionO.data.forEach((row: any) => {
      const srNo = row["Sr.No."] || ""
      const amount = parseAmount(row["Amount (Ksh)"])
      const descriptions = (row["Descriptions"] || "").toLowerCase()

      const srNoStr = String(srNo).trim()

      switch (srNoStr) {
        case "13":
          if (descriptions.includes("output vat")) {
            outputVat6 = amount
          }
          break
        case "14":
          if (descriptions.includes("input vat")) {
            inputVat12 = amount
          }
          break
        case "21":
          if (descriptions.includes("credit brought forward")) {
            creditBroughtForward = amount
          }
          break
        case "22":
          if (descriptions.includes("vat withholding")) {
            totalVatWithholding = amount
          }
          break
        case "28":
          if (descriptions.includes("net vat payable") || descriptions.includes("credit carried forward")) {
            netVatPayable = amount
          }
          break
      }
    })

    return {
      outputVat6,
      inputVat12,
      totalVatWithholding,
      creditBroughtForward,
      netVatPayable,
    }
  }

  // Extract values from Section B2 using exact structure from attachment
  const extractSectionB2Values = (vatReturn: VatReturnDetails) => {
    const sectionB2 = vatReturn.section_b2
    if (!sectionB2?.data || !Array.isArray(sectionB2.data)) {
      return { salesRegistered: 0, salesNotRegistered: 0 }
    }

    let salesRegistered = 0
    let salesNotRegistered = 0

    sectionB2.data.forEach((row: any) => {
      const description = (row["Description"] || "").toLowerCase()
      const vatAmount = parseAmount(row["Amount of VAT (Ksh)"])

      if (description.includes("customers registered for vat")) {
        salesRegistered = vatAmount
      } else if (description.includes("customers not registered for vat")) {
        salesNotRegistered = vatAmount
      }
    })

    return { salesRegistered, salesNotRegistered }
  }

  // Extract values from Section F2 using exact structure from attachment
  const extractSectionF2Values = (vatReturn: VatReturnDetails) => {
    const sectionF2 = vatReturn.section_f2
    if (!sectionF2?.data || !Array.isArray(sectionF2.data)) {
      return { purchasesRegistered: 0, purchasesNotRegistered: 0 }
    }

    let purchasesRegistered = 0
    let purchasesNotRegistered = 0

    sectionF2.data.forEach((row: any) => {
      const description = (row["Description"] || "").toLowerCase()
      const vatAmount = parseAmount(row["Amount of VAT (Ksh)"])

      if (description.includes("suppliers registered for vat") && description.includes("local")) {
        purchasesRegistered = vatAmount
      } else if (description.includes("suppliers not registered for vat") && description.includes("import")) {
        purchasesNotRegistered = vatAmount
      }
    })

    return { purchasesRegistered, purchasesNotRegistered }
  }

  // Get filing date from return listings - improved logic
  const getFilingDate = (vatReturn: VatReturnDetails) => {
    console.log("Looking for filing date for VAT period:", vatReturn.month, vatReturn.year)
    console.log("Available listings:", companyListings.length)

    // Check all listings for this company
    for (const listing of companyListings) {
      if (!listing.listing_data) continue

      const listingData = listing.listing_data as any
      console.log("Checking listing:", listing.id)

      // Handle different possible structures
      let dataArray = []
      if (listingData.data && Array.isArray(listingData.data)) {
        dataArray = listingData.data
      } else if (Array.isArray(listingData)) {
        dataArray = listingData
      }

      console.log("Data array length:", dataArray.length)

      // Look through the data array for VAT returns matching our period
      for (const row of dataArray) {
        const taxObligation = row["Tax Obligation"] || ""
        const returnPeriodFrom = row["Return Period from"] || ""
        const filingDate = row["Date of Filing"] || ""

        console.log(`Checking row: Tax: ${taxObligation}, Period: ${returnPeriodFrom}, Filing: ${filingDate}`)

        // Check if it's a VAT return
        if (!taxObligation.includes("Value Added Tax")) continue

        // Parse the "Return Period from" date (DD/MM/YYYY format)
        try {
          if (returnPeriodFrom.includes("/")) {
            const [day, month, year] = returnPeriodFrom.split("/")
            const periodYear = Number.parseInt(year)
            const periodMonth = Number.parseInt(month)

            console.log(
              `Parsed: Year ${periodYear}, Month ${periodMonth} vs VAT: ${vatReturn.year}, ${vatReturn.month}`,
            )

            // Match by year and month of the VAT period
            if (periodYear === vatReturn.year && periodMonth === vatReturn.month) {
              console.log("MATCH FOUND! Filing date:", filingDate)
              return filingDate
            }
          }
        } catch (error) {
          console.log("Error parsing return period:", error)
        }
      }
    }

    console.log("No filing date found for period:", vatReturn.month, vatReturn.year)
    return null
  }

  // Email function (placeholder for now)
  const handleEmailReport = () => {
    alert("Email functionality will be configured later. Report data is ready to be sent.")
  }

  // Prepare summary data for export
  const prepareSummaryData = () => {
    return companyVatReturns.map((vatReturn, index) => {
      const sectionOValues = extractSectionOValues(vatReturn)
      const sectionB2Values = extractSectionB2Values(vatReturn)
      const sectionF2Values = extractSectionF2Values(vatReturn)
      const filingDate = getFilingDate(vatReturn)
      const isLate = filingDate ? isFilingLate(vatReturn, filingDate) : false

      return {
        "Sr.No.": index + 1,
        "Company Name": selectedCompany?.company_name || "",
        "KRA PIN": selectedCompany?.kra_pin || "",
        Period: new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        "Filing Date": filingDate || "-",
        "Filing Status": isLate ? "Late" : "On Time",
        "Return Type": vatReturn.is_nil_return ? "Nil" : "Data",
        "Output VAT (6)": vatReturn.is_nil_return ? 0 : sectionOValues.outputVat6,
        "Input VAT (12)": vatReturn.is_nil_return ? 0 : sectionOValues.inputVat12,
        "VAT Withholding": vatReturn.is_nil_return ? 0 : sectionOValues.totalVatWithholding,
        "Credit B/F": vatReturn.is_nil_return ? 0 : sectionOValues.creditBroughtForward,
        "Net VAT Payable": vatReturn.is_nil_return ? 0 : sectionOValues.netVatPayable,
        "Purchases Registered": vatReturn.is_nil_return ? 0 : sectionF2Values.purchasesRegistered,
        "Purchases Not Registered": vatReturn.is_nil_return ? 0 : sectionF2Values.purchasesNotRegistered,
        "Sales Registered": vatReturn.is_nil_return ? 0 : sectionB2Values.salesRegistered,
        "Sales Not Registered": vatReturn.is_nil_return ? 0 : sectionB2Values.salesNotRegistered,
      }
    })
  }

  const calculateCompanyStats = () => {
    if (!selectedCompany || companyVatReturns.length === 0) {
      return { totalReturns: 0, nilReturns: 0, dataReturns: 0, totalOutputVat: 0, totalInputVat: 0 }
    }

    const totalReturns = companyVatReturns.length
    const nilReturns = companyVatReturns.filter((r) => r.is_nil_return).length
    const dataReturns = totalReturns - nilReturns

    let totalOutputVat = 0
    let totalInputVat = 0

    companyVatReturns.forEach((vatReturn) => {
      if (!vatReturn.is_nil_return) {
        const sectionOValues = extractSectionOValues(vatReturn)
        totalOutputVat += sectionOValues.outputVat6
        totalInputVat += sectionOValues.inputVat12
      }
    })

    return { totalReturns, nilReturns, dataReturns, totalOutputVat, totalInputVat }
  }

  const stats = calculateCompanyStats()

  return (
    <div className="flex flex-1">
      {/* Sidebar */}
      <div className="w-80 border-r bg-gray-50/50 p-4 overflow-y-auto">
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Companies
            </h2>
            <p className="text-sm text-muted-foreground">Select a company to view detailed data</p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search companies..."
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Date Range Filter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Date Range Filter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">From Year</label>
                  <Select value={fromYear} onValueChange={setFromYear}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">From Month</label>
                  <Select value={fromMonth} onValueChange={setFromMonth}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">To Year</label>
                  <Select value={toYear} onValueChange={setToYear}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">To Month</label>
                  <Select value={toMonth} onValueChange={setToMonth}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Companies ({filteredCompanies.length})</span>
              {selectedCompany && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedCompany(null)} className="text-xs">
                  Clear Selection
                </Button>
              )}
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => setSelectedCompany(company)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedCompany?.id === company.id
                      ? "bg-blue-50 border-blue-200 shadow-sm"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium text-sm truncate">{company.company_name}</div>
                  <div className="text-xs text-gray-500 font-mono">{company.kra_pin}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {allVatReturns.filter((r) => r.company_id === company.id).length} returns
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {!selectedCompany ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Company</h3>
              <p className="text-gray-500">Choose a company from the sidebar to view detailed VAT data and analysis</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Company Header with Export/Email Buttons */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{selectedCompany.company_name}</h1>
                <p className="text-muted-foreground">KRA PIN: {selectedCompany.kra_pin}</p>
                <p className="text-sm text-gray-500">
                  Showing data from {months.find((m) => m.value === fromMonth)?.label} {fromYear} to{" "}
                  {months.find((m) => m.value === toMonth)?.label} {toYear}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {loading && <Badge variant="secondary">Loading...</Badge>}
                <Button onClick={handleEmailReport} variant="outline" size="sm">
                  <Mail className="mr-2 h-4 w-4" />
                  Email Report
                </Button>
                {selectedCompany && companyVatReturns.length > 0 && (
                  <ExportButton
                    data={prepareSummaryData()}
                    filename={`VAT_Summary_${selectedCompany.company_name.replace(/\s+/g, "_")}`}
                    type="section-data"
                    company={selectedCompany}
                    variant="default"
                    size="sm"
                  />
                )}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Returns</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalReturns}</div>
                  <p className="text-xs text-muted-foreground">VAT returns filed</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Data Returns</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.dataReturns}</div>
                  <p className="text-xs text-muted-foreground">With transaction data</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Nil Returns</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.nilReturns}</div>
                  <p className="text-xs text-muted-foreground">No transaction data</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Output VAT</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalOutputVat)}</div>
                  <p className="text-xs text-muted-foreground">Total collected</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Input VAT</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalInputVat)}</div>
                  <p className="text-xs text-muted-foreground">Total claimed</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for Different Views */}
            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList>
                <TabsTrigger value="summary">Summary View</TabsTrigger>
                <TabsTrigger value="sections">VAT Sections</TabsTrigger>
                <TabsTrigger value="listings">Return Listings</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>VAT Returns Summary</CardTitle>
                        <CardDescription>
                          Data extracted from Section O (Tax Calculation), Section B2 (Sales Totals), Section F2
                          (Purchases Totals), and Return Listings (Filing Dates)
                        </CardDescription>
                      </div>
                      {selectedCompany && companyVatReturns.length > 0 && (
                        <ExportButton
                          data={prepareSummaryData()}
                          filename={`VAT_Summary_${selectedCompany.company_name.replace(/\s+/g, "_")}`}
                          type="section-data"
                          company={selectedCompany}
                          variant="outline"
                          size="sm"
                        />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto border rounded-lg">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b text-left bg-gray-50">
                            <th className="pb-2 px-3 py-3 font-medium border-r">Sr.No.</th>
                            <th className="pb-2 px-3 py-3 font-medium border-r">Period</th>
                            <th className="pb-2 px-3 py-3 font-medium border-r">Filing Date</th>
                            <th className="pb-2 px-3 py-3 font-medium border-r">Type</th>
                            <th className="pb-2 px-3 py-3 font-medium border-r">Output VAT (6)</th>
                            <th className="pb-2 px-3 py-3 font-medium border-r">Input VAT (12)</th>
                            <th className="pb-2 px-3 py-3 font-medium border-r">VAT Withholding</th>
                            <th className="pb-2 px-3 py-3 font-medium border-r">Credit B/F</th>
                            <th className="pb-2 px-3 py-3 font-medium border-r">Net VAT Payable</th>
                            <th className="pb-2 px-3 py-3 font-medium border-r">Purchases Reg.</th>
                            <th className="pb-2 px-3 py-3 font-medium border-r">Purchases Not Reg.</th>
                            <th className="pb-2 px-3 py-3 font-medium border-r">Sales Reg.</th>
                            <th className="pb-2 px-3 py-3 font-medium">Sales Not Reg.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {companyVatReturns.map((vatReturn, index) => {
                            const sectionOValues = extractSectionOValues(vatReturn)
                            const sectionB2Values = extractSectionB2Values(vatReturn)
                            const sectionF2Values = extractSectionF2Values(vatReturn)
                            const filingDate = getFilingDate(vatReturn)
                            const isLate = filingDate ? isFilingLate(vatReturn, filingDate) : false

                            return (
                              <tr key={index} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                                <td className="py-3 px-3 font-medium border-r">{index + 1}</td>
                                <td className="py-3 px-3 border-r">
                                  {new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </td>
                                <td className="py-3 px-3 border-r">
                                  <div className="flex items-center gap-2">
                                    {filingDate ? (
                                      <>
                                        {isLate ? (
                                          <AlertTriangle className="h-4 w-4 text-red-500" />
                                        ) : (
                                          <CheckCircle className="h-4 w-4 text-green-500" />
                                        )}
                                        <span className={`font-bold ${isLate ? "text-red-600" : "text-green-600"}`}>
                                          {formatDate(filingDate)}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 border-r">
                                  <Badge variant={vatReturn.is_nil_return ? "secondary" : "default"}>
                                    {vatReturn.is_nil_return ? "Nil" : "VAT Filled"}
                                  </Badge>
                                </td>
                                <td className="py-3 px-3 border-r">
                                  {vatReturn.is_nil_return ? "-" : formatCurrency(sectionOValues.outputVat6)}
                                </td>
                                <td className="py-3 px-3 border-r">
                                  {vatReturn.is_nil_return ? "-" : formatCurrency(sectionOValues.inputVat12)}
                                </td>
                                <td className="py-3 px-3 border-r">
                                  {vatReturn.is_nil_return ? "-" : formatCurrency(sectionOValues.totalVatWithholding)}
                                </td>
                                <td className="py-3 px-3 border-r">
                                  {vatReturn.is_nil_return ? "-" : formatCurrency(sectionOValues.creditBroughtForward)}
                                </td>
                                <td className="py-3 px-3 border-r">
                                  {vatReturn.is_nil_return ? "-" : formatCurrency(sectionOValues.netVatPayable)}
                                </td>
                                <td className="py-3 px-3 border-r">
                                  {vatReturn.is_nil_return ? "-" : formatCurrency(sectionF2Values.purchasesRegistered)}
                                </td>
                                <td className="py-3 px-3 border-r">
                                  {vatReturn.is_nil_return
                                    ? "-"
                                    : formatCurrency(sectionF2Values.purchasesNotRegistered)}
                                </td>
                                <td className="py-3 px-3 border-r">
                                  {vatReturn.is_nil_return ? "-" : formatCurrency(sectionB2Values.salesRegistered)}
                                </td>
                                <td className="py-3 px-3">
                                  {vatReturn.is_nil_return ? "-" : formatCurrency(sectionB2Values.salesNotRegistered)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sections" className="space-y-4">
                <VatSectionViewer companyId={selectedCompany.id} vatReturns={companyVatReturns} />
              </TabsContent>

              <TabsContent value="listings" className="space-y-4">
                <ReturnListingsTable returnListings={companyListings} company={selectedCompany} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
