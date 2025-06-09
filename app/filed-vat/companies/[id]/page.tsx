import { ArrowLeft, Calendar, FileText, TrendingUp } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCompanyById, getVatReturnDetails, getCompanyReturnListings } from "@/lib/data-viewer/data-fetchers"
import { VatSectionViewer } from "@/components/data-viewer/vat-section-viewer"
import { ExportButton } from "@/components/data-viewer/export-button"
import { ReturnListingsTable } from "@/components/data-viewer/return-listings-table"

interface CompanyDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CompanyDetailPage({ params }: CompanyDetailPageProps) {
  const { id } = await params
  const companyId = Number.parseInt(id)

  if (isNaN(companyId)) {
    notFound()
  }

  const [company, vatReturns, returnListings] = await Promise.all([
    getCompanyById(companyId),
    getVatReturnDetails(companyId),
    getCompanyReturnListings(companyId),
  ])

  if (!company) {
    notFound()
  }

  const totalReturns = vatReturns.length
  const nilReturns = vatReturns.filter((r) => r.is_nil_return).length
  const completedReturns = vatReturns.filter((r) => r.processing_status === "completed").length

  // Calculate VAT totals
  let totalOutputVat = 0
  let totalInputVat = 0

  vatReturns.forEach((vatReturn) => {
    if (!vatReturn.is_nil_return) {
      // Extract from section M (Sales Summary)
      if (vatReturn.section_m?.data && Array.isArray(vatReturn.section_m.data)) {
        vatReturn.section_m.data.forEach((row: any) => {
          if (row["Amount of Output VAT (Ksh)"]) {
            totalOutputVat += Number(row["Amount of Output VAT (Ksh)"]) || 0
          }
        })
      }

      // Extract from section N (Purchases Summary)
      if (vatReturn.section_n?.data && Array.isArray(vatReturn.section_n.data)) {
        vatReturn.section_n.data.forEach((row: any) => {
          if (row["Amount of Input VAT (Ksh)"]) {
            totalInputVat += Number(row["Amount of Input VAT (Ksh)"]) || 0
          }
        })
      }
    }
  })

  const netVat = totalOutputVat - totalInputVat

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <Link href="/companies" className="flex items-center gap-2 text-lg font-semibold">
          <ArrowLeft className="h-5 w-5" />
          Back to Companies
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <ExportButton
            data={vatReturns}
            filename={`${company.company_name}_VAT_Returns`}
            type="vat-returns"
            company={company}
          />
          <Button size="sm">
            <FileText className="mr-2 h-4 w-4" />
            New Extraction
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{company.company_name}</h1>
            <p className="text-muted-foreground">KRA PIN: {company.kra_pin}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Returns</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalReturns}</div>
              <p className="text-xs text-muted-foreground">
                {completedReturns} completed, {nilReturns} nil
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Output VAT</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalOutputVat)}</div>
              <p className="text-xs text-muted-foreground">Total sales VAT</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Input VAT</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalInputVat)}</div>
              <p className="text-xs text-muted-foreground">Total purchase VAT</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net VAT</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(netVat)}</div>
              <p className="text-xs text-muted-foreground">VAT liability</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="returns">
          <TabsList>
            <TabsTrigger value="returns">VAT Returns</TabsTrigger>
            <TabsTrigger value="sections">Section Data</TabsTrigger>
            <TabsTrigger value="listings">Return Listings</TabsTrigger>
          </TabsList>

          <TabsContent value="returns" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                  <CardTitle>VAT Return History</CardTitle>
                  <CardDescription>Complete history of VAT returns for {company.company_name}</CardDescription>
                </div>
                <ExportButton
                  data={vatReturns}
                  filename={`${company.company_name}_VAT_Returns_History`}
                  type="vat-returns"
                  company={company}
                  variant="outline"
                  size="sm"
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Sr.No.</th>
                        <th className="pb-2 font-medium">Period</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Output VAT</th>
                        <th className="pb-2 font-medium">Input VAT</th>
                        <th className="pb-2 font-medium">Net VAT</th>
                        <th className="pb-2 font-medium">Extracted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vatReturns.map((vatReturn, index) => {
                        const periodOutputVat = vatReturn.section_m?.data
                          ? vatReturn.section_m.data.reduce(
                            (sum: number, row: any) => sum + (Number(row["Amount of Output VAT (Ksh)"]) || 0),
                            0,
                          )
                          : 0
                        const periodInputVat = vatReturn.section_n?.data
                          ? vatReturn.section_n.data.reduce(
                            (sum: number, row: any) => sum + (Number(row["Amount of Input VAT (Ksh)"]) || 0),
                            0,
                          )
                          : 0

                        return (
                          <tr
                            key={`${vatReturn.year}-${vatReturn.month}`}
                            className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}
                          >
                            <td className="py-3">{index + 1}</td>
                            <td className="py-3">
                              {new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
                                month: "long",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-3">
                              <div
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${vatReturn.is_nil_return
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                  : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                  }`}
                              >
                                {vatReturn.is_nil_return ? "Nil Return" : "Data Return"}
                              </div>
                            </td>
                            <td className="py-3">
                              <div
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${vatReturn.processing_status === "completed"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                  : vatReturn.error_message
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                  }`}
                              >
                                {vatReturn.processing_status === "completed"
                                  ? "Completed"
                                  : vatReturn.error_message
                                    ? "Error"
                                    : "Processing"}
                              </div>
                            </td>
                            <td className="py-3">{vatReturn.is_nil_return ? "-" : formatCurrency(periodOutputVat)}</td>
                            <td className="py-3">{vatReturn.is_nil_return ? "-" : formatCurrency(periodInputVat)}</td>
                            <td className="py-3">
                              {vatReturn.is_nil_return ? "-" : formatCurrency(periodOutputVat - periodInputVat)}
                            </td>
                            <td className="py-3 text-muted-foreground">{formatDate(vatReturn.extraction_timestamp)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sections" className="mt-4 space-y-4">
            <VatSectionViewer companyId={companyId} vatReturns={vatReturns} />
          </TabsContent>

          <TabsContent value="listings" className="mt-4 space-y-4">
            <ReturnListingsTable returnListings={returnListings} company={company} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
