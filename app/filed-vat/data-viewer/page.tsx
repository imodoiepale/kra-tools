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
  const vatStatusMap = new Map<string, 'Registered' | 'Not Registered'>();
  pinCheckerDetails.forEach(detail => {
    if (detail.company_name && detail.vat_status) {
      const status = detail.vat_status === 'Registered' || detail.vat_status === 'Not Registered' 
        ? detail.vat_status 
        : null;
      if (status) {
        vatStatusMap.set(detail.company_name, status);
      }
    }
  });

  // Enrich the primary company list with VAT status and default category status
  const enrichedCompanies: EnrichedCompany[] = companies.map(company => {
    const vatStatus = vatStatusMap.get(company.company_name) || 'Unknown';
    return {
      ...company,
      vat_status: vatStatus,
      categoryStatus: {
        acc: company.acc_client_effective_to && new Date(company.acc_client_effective_to) < new Date() ? 'inactive' : 'active',
        audit_tax: company.audit_client_effective_to && new Date(company.audit_client_effective_to) < new Date() ? 'inactive' : 'active',
        cps_sheria: company.sheria_client_effective_to && new Date(company.sheria_client_effective_to) < new Date() ? 'inactive' : 'active',
        imm: company.imm_client_effective_to && new Date(company.imm_client_effective_to) < new Date() ? 'inactive' : 'active',
      },
    };
  });

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