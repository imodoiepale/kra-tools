"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface ReportPreviewProps {
  data: any[]
  columns: any[]
  isLoading: boolean
  mode: "table" | "json"
}

export function ReportPreview({ data, columns, isLoading, mode }: ReportPreviewProps) {
  const [searchTerm, setSearchTerm] = useState("")

  // Filter data based on search term
  const filteredData = data.filter((row) => {
    if (!searchTerm) return true

    return Object.values(row).some(
      (value) => value && value.toString().toLowerCase().includes(searchTerm.toLowerCase()),
    )
  })

  // Format cell value
  const formatCellValue = (value: any, column: any) => {
    if (value === null || value === undefined) return "-"

    // Format currency
    if (
      column.path.toLowerCase().includes("ksh") ||
      column.path.toLowerCase().includes("amount") ||
      column.path.toLowerCase().includes("vat")
    ) {
      const numValue = Number(value)
      if (!isNaN(numValue)) {
        return new Intl.NumberFormat("en-KE", {
          style: "currency",
          currency: "KES",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(numValue)
      }
    }

    // Format dates
    if (column.path.toLowerCase().includes("date") || column.path.toLowerCase().includes("timestamp")) {
      try {
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        }
      } catch {
        // Fall through to default formatting
      }
    }

    // Truncate long strings
    if (typeof value === "string" && value.length > 50) {
      return value.substring(0, 50) + "..."
    }

    return value.toString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Generating report...</p>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] border rounded-md bg-muted/20">
        <div className="text-center">
          <p className="text-muted-foreground">No data to display</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure data sources and columns to generate your report
          </p>
        </div>
      </div>
    )
  }

  if (mode === "json") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search in data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <ScrollArea className="h-[500px] border rounded-md">
          <pre className="p-4 text-xs whitespace-pre-wrap">{JSON.stringify(filteredData, null, 2)}</pre>
        </ScrollArea>
      </div>
    )
  }

  // Get column headers
  const headers = columns.length > 0 ? columns.map((col) => col.alias || col.path) : Object.keys(data[0] || {})

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search in data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredData.length} of {data.length} records
        </div>
      </div>

      <ScrollArea className="h-[500px] border rounded-md">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-900 border-b">Sr.No.</th>
                {headers.map((header, index) => (
                  <th key={index} className="px-3 py-2 text-left font-medium text-gray-900 border-b">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 1000).map((row, rowIndex) => (
                <tr key={rowIndex} className={`border-b ${rowIndex % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                  <td className="px-3 py-2 text-gray-900 font-medium">{rowIndex + 1}</td>
                  {headers.map((header, colIndex) => {
                    const column = columns.find((col) => (col.alias || col.path) === header) || { path: header }
                    return (
                      <td key={colIndex} className="px-3 py-2 text-gray-900">
                        {formatCellValue(row[header], column)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length > 1000 && (
            <div className="p-4 text-center text-muted-foreground">
              Showing first 1000 records. Use filters to narrow down results.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
