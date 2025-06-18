import { CheckCircle, Clock, Loader2 } from "lucide-react"

interface ExtractionStatusCardProps {
  company: string
  progress: number
  status: string
  startTime: string
  estimatedCompletion: string
  isComplete?: boolean
  isQueued?: boolean
}

export function ExtractionStatusCard({
  company,
  progress,
  status,
  startTime,
  estimatedCompletion,
  isComplete = false,
  isQueued = false,
}: ExtractionStatusCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">{company}</div>
        <div className="flex items-center gap-1 text-xs">
          {isComplete ? (
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          ) : isQueued ? (
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
          )}
          <span className={isComplete ? "text-green-500" : isQueued ? "text-muted-foreground" : "text-blue-500"}>
            {status}
          </span>
        </div>
      </div>
      <div className="mb-2 h-2 w-full rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${
            isComplete ? "bg-green-500" : isQueued ? "bg-muted-foreground" : "bg-blue-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>{startTime}</div>
        <div>{estimatedCompletion}</div>
      </div>
    </div>
  )
}
