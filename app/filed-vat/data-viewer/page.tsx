import { ArrowLeft, Download } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { getCompanies, getAvailableVatPeriods } from "@/lib/data-viewer/data-fetchers"
import { DataViewerContent } from "@/components/data-viewer/data-viewer-content"

export default async function DataViewerPage() {
  // Fetch only the initial, lightweight data needed to render the page shell.
  // This avoids the "Oversized Page" build error.
  const [companies, availablePeriods] = await Promise.all([
    getCompanies(),
    getAvailableVatPeriods(),
  ])

  // Derive the unique years from the periods data for the filter dropdowns.
  const availableYears = Array.from(new Set(availablePeriods.map((p) => p.year))).sort(
    (a, b) => b - a,
  )

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <Link href="/filed-vat" className="flex items-center gap-2 text-lg font-semibold">
          <ArrowLeft className="h-5 w-5" />
          Back to Dashboard
        </Link>
        {/* Note: This top-level export button is now disconnected from the filtered data.
            The more useful export buttons are inside the DataViewerContent component. */}
        <div className="ml-auto flex items-center gap-4">
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Pass the smaller, initial dataset to the client component. */}
        <DataViewerContent companies={companies} availableYears={availableYears} />
      </div>
    </div>
  )
}