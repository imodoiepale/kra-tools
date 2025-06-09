import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VatExtractorReports } from "@/components/data-viewer/vat-extractor-reports"

export default function ReportsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">VAT Return Customers</h1>
            <p className="text-sm text-gray-600">Extract and manage VAT return data for companies</p>
          </div>
          <Link href="/filed-vat">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b bg-white px-6">
        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-fit grid-cols-3 bg-transparent p-0">
            <TabsTrigger
              value="start"
              className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-gray-600 data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-600"
            >
              Start
            </TabsTrigger>
            <TabsTrigger
              value="running"
              className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-gray-600 data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-600"
            >
              Running
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-gray-600 data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-600"
            >
              Reports
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <Suspense fallback={<div>Loading reports...</div>}>
          <VatExtractorReports />
        </Suspense>
      </main>
    </div>
  )
}
