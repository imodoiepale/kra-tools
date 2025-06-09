import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ReportBuilder } from "@/components/report-builder/report-builder"

export default function ReportBuilderPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <Link href="/filed-vat" className="flex items-center gap-2 text-lg font-semibold">
          <ArrowLeft className="h-5 w-5" />
          Back to Dashboard
        </Link>
        <div className="ml-auto">
          <h1 className="text-lg font-semibold">Custom Report Builder</h1>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <ReportBuilder />
      </main>
    </div>
  )
}
