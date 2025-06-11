import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getCompanies, getAvailableVatPeriods, getPinCheckerDetails } from "@/lib/data-viewer/data-fetchers"
import { DataViewerContent } from "@/components/data-viewer/data-viewer-content"
import type { EnrichedCompany } from "@/lib/data-viewer/supabase"

export default async function DataViewerPage() {
  // Fetch all data sources needed for client-side filtering
  const [companies, availablePeriods, pinCheckerDetails] = await Promise.all([
    getCompanies(),
    getAvailableVatPeriods(),
    getPinCheckerDetails(),
  ]);

  const availableYears = Array.from(new Set(availablePeriods.map((p) => p.year))).sort(
    (a, b) => b - a,
  );

  // Create a lookup map for VAT status, keyed by company_name
  const vatStatusMap = new Map<string, string>();
  pinCheckerDetails.forEach(detail => {
    if (detail.company_name && detail.vat_status) {
      vatStatusMap.set(detail.company_name, detail.vat_status);
    }
  });

  // Enrich the primary company list with VAT status. All date fields are already present.
  const enrichedCompanies: EnrichedCompany[] = companies.map(company => ({
    ...company,
    vat_status: vatStatusMap.get(company.company_name) || 'Unknown',
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <Link href="/filed-vat" className="flex items-center gap-2 text-lg font-semibold">
          <ArrowLeft className="h-5 w-5" />
          Back to Dashboard
        </Link>
      </header>
      <div className="flex flex-1">
        {/* Pass the complete, enriched dataset to the client component */}
        <DataViewerContent companies={enrichedCompanies} availableYears={availableYears} />
      </div>
    </div>
  );
}