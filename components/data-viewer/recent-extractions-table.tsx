import { CheckCircle, Clock, XCircle } from "lucide-react"
import { getRecentExtractions } from "@/lib/data-viewer/data-fetchers"

export async function RecentExtractionsTable() {
  const extractions = await getRecentExtractions()

  const getStatusIcon = (status: string, isNilReturn: boolean) => {
    if (status === "completed") {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    } else if (status === "nil_return" || isNilReturn) {
      return <Clock className="h-4 w-4 text-amber-500" />
    } else {
      return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusText = (status: string, isNilReturn: boolean) => {
    if (status === "completed") return "Success"
    if (status === "nil_return" || isNilReturn) return "Nil Return"
    return "Failed"
  }

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Less than 1 hour ago"
    if (diffInHours < 24) return `${diffInHours} hours ago`
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} days ago`
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium">Company</th>
            <th className="pb-2 font-medium">Period</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {extractions.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-center text-muted-foreground">
                No recent extractions found
              </td>
            </tr>
          ) : (
            extractions.map((extraction, index) => (
              <tr key={index} className="border-b">
                <td className="py-3">{extraction.company_name}</td>
                <td className="py-3">
                  {new Date(extraction.year, extraction.month - 1).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-1">
                    {getStatusIcon(extraction.processing_status, extraction.is_nil_return)}
                    <span>{getStatusText(extraction.processing_status, extraction.is_nil_return)}</span>
                  </div>
                </td>
                <td className="py-3 text-muted-foreground">{formatTimeAgo(extraction.extraction_timestamp)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
