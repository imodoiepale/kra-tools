import { ArrowLeft, Download } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { getCompanies, getVatReturnDetails } from "@/lib/data-viewer/data-fetchers"
import { DataViewerContent } from "@/components/data-viewer/data-viewer-content"

export default async function DataViewerPage() {
  // const [companies, allVatReturns] = await Promise.all([getCompanies(), getVatReturnDetails()])
  const companies = await getCompanies()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <Link href="/filed-vat" className="flex items-center gap-2 text-lg font-semibold">
          <ArrowLeft className="h-5 w-5" />
          Back to Dashboard
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        <DataViewerContent companies={companies} />
        {/* <DataViewerContent companies={companies} allVatReturns={allVatReturns} /> */}
      </div>
    </div>
  )
}
