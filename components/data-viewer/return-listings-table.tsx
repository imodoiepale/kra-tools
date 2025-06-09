"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, ChevronDown, ChevronRight } from "lucide-react"
import { ExportButton } from "@/components/data-viewer/export-button"
import type { Company, CompanyVatReturnListings } from "@/lib/supabase"

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

    // Define preferred order for common columns (Sr.No. will be added separately)
    const preferredOrder = [
      "Status",
      "Entity Type",
      "NSSF Status",
      "Date of Filing",
      "Tax Obligation",
      "Type of Return",
      "Return Period to",
      "View Return Filed",
      "Acknowledgement No",
      "Return Period from",
    ]

    const orderedKeys = preferredOrder.filter((key) => allKeys.has(key))
    const remainingKeys = Array.from(allKeys).filter((key) => !preferredOrder.includes(key))

    return [...orderedKeys, ...remainingKeys]
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
        style: "currency",
        currency: "KES",
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

  if (returnListings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Return Listings</CardTitle>
          <CardDescription>Data extracted from KRA portal return listings</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No return listings data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center">
          <div className="grid gap-2">
            <CardTitle>Return Listings Data</CardTitle>
            <CardDescription>
              Data extracted from KRA portal return listings - Total {allRecords.length} records from{" "}
              {returnListings.length} listing{returnListings.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="ml-auto flex items-center gap-2">
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

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search in all listing data..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary">{filteredRecords.length} records</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No records found matching your search criteria</p>
            </div>
          ) : (
            <div className="overflow-auto border rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-900 border-r">Sr.No.</th>
                    {columnHeaders.map((header, index) => (
                      <th
                        key={header}
                        className={`px-3 py-3 text-left font-medium text-gray-900 ${index === columnHeaders.length - 1 ? "" : "border-r"
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
                      <td className="px-3 py-3 text-gray-900 font-medium border-r">{index + 1}</td>
                      {columnHeaders.map((header, headerIndex) => (
                        <td
                          key={header}
                          className={`px-3 py-3 text-gray-900 ${headerIndex === columnHeaders.length - 1 ? "" : "border-r"
                            }`}
                        >
                          {formatCellValue(record[header], header)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Raw Listings Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Raw Listings Summary</CardTitle>
          <CardDescription>Overview of original listing entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {returnListings.map((listing, index) => {
              const isExpanded = expandedRows.has(index)
              const listingData = listing.listing_data as any
              let recordCount = 0

              if (listingData?.data && Array.isArray(listingData.data)) {
                recordCount = listingData.data.length
              } else if (Array.isArray(listingData)) {
                recordCount = listingData.length
              }

              return (
                <div key={index} className="border rounded-lg">
                  <button
                    onClick={() => toggleRow(index)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                      <div>
                        <div className="font-medium">Listing #{listing.id || index + 1}</div>
                        <div className="text-sm text-gray-500">Scraped: {formatDate(listing.last_scraped_at)}</div>
                      </div>
                    </div>
                    <Badge variant={recordCount > 0 ? "default" : "secondary"}>{recordCount} records</Badge>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t bg-gray-50">
                      <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap mt-3 p-3 bg-white rounded border">
                        {JSON.stringify(listing.listing_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
