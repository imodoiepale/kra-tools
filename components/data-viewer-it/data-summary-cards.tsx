"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getVatReturnDetails, getDashboardStats } from "@/lib/data-viewer/data-fetchers"
import { BarChart3, DollarSign, FileText, Users, CheckCircle2, AlertCircle } from "lucide-react"

export function DataSummaryCards() {
  const [vatSummary, setVatSummary] = useState({
    totalOutputVat: 0,
    totalInputVat: 0,
    netVat: 0,
    nilReturns: 0,
    completedReturns: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [vatReturns, stats] = await Promise.all([getVatReturnDetails(), getDashboardStats()])

        // Calculate VAT summary from actual data
        let totalOutputVat = 0
        let totalInputVat = 0

        vatReturns.forEach((vatReturn) => {
          if (!vatReturn.is_nil_return && vatReturn.section_m) {
            // Extract output VAT from section M (Sales Summary)
            if (Array.isArray(vatReturn.section_m.data)) {
              vatReturn.section_m.data.forEach((row: any) => {
                if (row["Amount of Output VAT (Ksh)"]) {
                  totalOutputVat += Number(row["Amount of Output VAT (Ksh)"]) || 0
                }
              })
            }
          }

          if (!vatReturn.is_nil_return && vatReturn.section_n) {
            // Extract input VAT from section N (Purchases Summary)
            if (Array.isArray(vatReturn.section_n.data)) {
              vatReturn.section_n.data.forEach((row: any) => {
                if (row["Amount of Input VAT (Ksh)"]) {
                  totalInputVat += Number(row["Amount of Input VAT (Ksh)"]) || 0
                }
              })
            }
          }
        })

        setVatSummary({
          totalOutputVat,
          totalInputVat,
          netVat: totalOutputVat - totalInputVat,
          nilReturns: stats.nilReturns,
          completedReturns: stats.successfulExtractions,
        })
      } catch (error) {
        console.error("Error fetching VAT summary:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return <div>Loading data summary...</div>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>VAT Liability Summary</CardTitle>
          <CardDescription>Total VAT across all companies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(vatSummary.netVat)}</div>
          <p className="text-xs text-muted-foreground">Net VAT liability</p>
          <div className="mt-4 grid gap-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Output VAT:</div>
              <div className="text-right font-medium">{formatCurrency(vatSummary.totalOutputVat)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Input VAT:</div>
              <div className="text-right font-medium">{formatCurrency(vatSummary.totalInputVat)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm font-medium">
              <div>Net VAT:</div>
              <div className="text-right">{formatCurrency(vatSummary.netVat)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Filing Compliance</CardTitle>
          <CardDescription>Return filing status summary</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex flex-col items-center gap-1">
                <div className="text-2xl font-bold text-green-500">{vatSummary.completedReturns}</div>
                <div className="text-center text-xs text-muted-foreground">Completed</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="text-2xl font-bold text-amber-500">{vatSummary.nilReturns}</div>
                <div className="text-center text-xs text-muted-foreground">Nil Returns</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Data Status</CardTitle>
          <CardDescription>Extraction and processing status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Total Returns Processed</div>
              <div className="text-sm font-medium">{vatSummary.completedReturns + vatSummary.nilReturns}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div>Data Returns</div>
                <div className="font-medium text-green-500">{vatSummary.completedReturns}</div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div>Nil Returns</div>
                <div className="font-medium text-amber-500">{vatSummary.nilReturns}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
