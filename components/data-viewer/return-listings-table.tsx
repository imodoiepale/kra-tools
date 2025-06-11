"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, ChevronDown, ChevronRight } from "lucide-react"
import { ExportButton } from "@/components/data-viewer/export-button"
import type { Company, CompanyVatReturnListings } from "@/lib/data-viewer/supabase"

interface ReturnListingsTableProps {
  returnListings: CompanyVatReturnListings[]
  company: Company
}

export function ReturnListingsTable({ returnListings, company }: ReturnListingsTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString

      const day = date.getDate().toString().padStart(2, "0")
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      const year = date.getFullYear()

      return `${day}/${month}/${year}`
    } catch {
      return dateString
    }
  }

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedRows(newExpanded)
  }

  // Extract all individual records from all listings
  const extractAllRecords = () => {
    const allRecords: any[] = []

    returnListings.forEach((listing, listingIndex) => {
      const listingData = listing.listing_data as any

      // Handle different possible structures
      let dataArray = []
      if (listingData?.data && Array.isArray(listingData.data)) {
        dataArray = listingData.data
      } else if (Array.isArray(listingData)) {
        dataArray = listingData
      }

      dataArray.forEach((record: any, recordIndex: number) => {
        // Create a clean record without the excluded fields and remove duplicate Sr.No.
        const cleanRecord = { ...record }

        // Remove unwanted fields
        delete cleanRecord.listing_id
        delete cleanRecord.record_index
        delete cleanRecord.company_name
        delete cleanRecord.company_id
        delete cleanRecord.nssf_status
        delete cleanRecord.NSSF_Status
        delete cleanRecord.nssf
        delete cleanRecord.NSSF

        allRecords.push(cleanRecord)
      })
    })

    return allRecords
  }

  const allRecords = extractAllRecords()

  // Filter records based on search term
  const filteredRecords = allRecords.filter((record) => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()
    return Object.values(record).some((value) => value && value.toString().toLowerCase().includes(searchLower))
  })

  // Get unique column headers from all records (excluding unwanted columns and duplicate Sr.No.)
  const getColumnHeaders = () => {
    if (filteredRecords.length === 0) return []

    const allKeys = new Set<string>()
    filteredRecords.forEach((record) => {
      Object.keys(record).forEach((key) => {
        // Skip unwanted columns
        if (
          ![
            "listing_id",
            "record_index",
            "company_name",
            "company_id",
            "nssf_status",
            "NSSF_Status",
            "nssf",
            "NSSF",
          ].includes(key)
        ) {
          allKeys.add(key)
        }
      })
    })

    // Convert to array and remove duplicates based on exact key names
    const keysArray = Array.from(allKeys)

    // Remove exact duplicates first
    const uniqueKeys = [...new Set(keysArray)]

    // Now handle case where we might have different cased versions of the same column
    // Keep only one instance of "Status" (prefer the exact case match)
    const finalKeys: string[] = []
    const processedLowerKeys = new Set<string>()

    // Define preferred order for common columns
    const preferredOrder = [
      "Sr.No.",
      "Status",
      "Tax Obligation",
      "Type of Return",
      "Date of Filing",
      "Return Period from",
      "Return Period to",
      "Acknowledgement No",
      "Entity Type",
      "NSSF Status",
      "View Return Filed",
    ]

    // First, add columns that match preferred order
    preferredOrder.forEach(preferredKey => {
      const matchingKey = uniqueKeys.find(key => key === preferredKey)
      if (matchingKey && !processedLowerKeys.has(matchingKey.toLowerCase())) {
        finalKeys.push(matchingKey)
        processedLowerKeys.add(matchingKey.toLowerCase())
      }
    })

    // Then add remaining columns that weren't in preferred order
    uniqueKeys.forEach(key => {
      if (!processedLowerKeys.has(key.toLowerCase())) {
        finalKeys.push(key)
        processedLowerKeys.add(key.toLowerCase())
      }
    })

    return finalKeys
  }

  const columnHeaders = getColumnHeaders()

  const formatCellValue = (value: any, key: string) => {
    if (value === null || value === undefined) return "-"

    // Format dates with dd/mm/yyyy format
    if (key.toLowerCase().includes("date") || key === "last_scraped") {
      return formatDate(value)
    }

    // Format amounts/currency
    if (key.toLowerCase().includes("amount") && typeof value === "number") {
      return new Intl.NumberFormat("en-KE", {
        style: "decimal",
        // currency: "KES",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    }

    // Truncate long strings
    if (typeof value === "string" && value.length > 50) {
      return value.substring(0, 50) + "..."
    }

    return value.toString()
  }

  const formatHeaderName = (key: string) => {
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  // Get the actual key from the record that matches the header (exact match)
  const getActualKey = (record: any, header: string) => {
    const keys = Object.keys(record)
    return keys.find(key => key === header) || header
  }

  if (returnListings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Return Summary</CardTitle>
          <CardDescription>Data extracted from KRA portal Return Summary</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No Return Summary data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="grid gap-2 text-center md:text-left">
            <CardTitle>Return Summary Data</CardTitle>
            <CardDescription>
              Data extracted from KRA portal return Summary - Total {allRecords.length} records from{" "}
              {returnListings.length} listing{returnListings.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>

          <div className="flex w-full flex-col items-center gap-4 md:w-auto md:flex-row md:justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-8 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search in all listing data..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <Badge variant="secondary" className="whitespace-nowrap">
              {filteredRecords.length} records
            </Badge>
          </div>

          <div className="flex justify-center md:ml-auto">
            <ExportButton
              data={filteredRecords.map((record, index) => ({ "Sr.No.": index + 1, ...record }))}
              filename={`${company.company_name}_Return_Listings_Detailed`}
              type="return-listings"
              company={company}
              variant="outline"
              size="sm"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No records found matching your search criteria</p>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto rounded-lg border">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50 border-b shadow-sm">
                  <tr>
                    {columnHeaders.map((header, index) => (
                      <th
                        key={header}
                        className={`px-3 py-3 text-left font-medium text-gray-900 bg-gray-50 ${index === columnHeaders.length - 1 ? "" : "border-r"
                          }`}
                      >
                        {formatHeaderName(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, index) => (
                    <tr key={index} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-blue-50"}`}>
                      {columnHeaders.map((header, headerIndex) => {
                        const actualKey = getActualKey(record, header)
                        return (
                          <td
                            key={header}
                            className={`px-3 py-3 text-gray-900 ${headerIndex === columnHeaders.length - 1 ? "" : "border-r"
                              }`}
                          >
                            {formatCellValue(record[actualKey], header)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          )}
        </CardContent>
      </Card>
    </div>
  )
}