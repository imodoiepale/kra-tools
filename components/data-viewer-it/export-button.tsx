"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import * as XLSX from "xlsx"
import type { Company, VatReturnDetails, CompanyVatReturnListings } from "@/lib/data-viewer/supabase"

interface ExportButtonProps {
  data: any[]
  filename: string
  type: "vat-returns" | "companies" | "return-listings" | "section-data"
  company?: Company
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
  className?: string
}

export function ExportButton({
  data,
  filename,
  type,
  company,
  variant = "default",
  size = "default",
  className,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-KE", {
  //     style: "currency",
  //     currency: "KES",
  //     minimumFractionDigits: 2,
  //     maximumFractionDigits: 2,
  //   }).format(amount)
  // }

  const calculateVatTotals = (vatReturn: VatReturnDetails) => {
    if (vatReturn.is_nil_return) return { outputVat: 0, inputVat: 0, netVat: 0 }

    let outputVat = 0
    let inputVat = 0

    // Calculate from section M (Sales Summary)
    if (vatReturn.section_m?.data && Array.isArray(vatReturn.section_m.data)) {
      vatReturn.section_m.data.forEach((row: any) => {
        if (row["Amount of Output VAT (Ksh)"]) {
          outputVat += Number(row["Amount of Output VAT (Ksh)"]) || 0
        }
      })
    }

    // Calculate from section N (Purchases Summary)
    if (vatReturn.section_n?.data && Array.isArray(vatReturn.section_n.data)) {
      vatReturn.section_n.data.forEach((row: any) => {
        if (row["Amount of Input VAT (Ksh)"]) {
          inputVat += Number(row["Amount of Input VAT (Ksh)"]) || 0
        }
      })
    }

    return { outputVat, inputVat, netVat: outputVat - inputVat }
  }

  const exportVatReturns = (vatReturns: VatReturnDetails[]) => {
    const workbook = XLSX.utils.book_new()

    // Summary Sheet
    const summaryData = vatReturns.map((vatReturn) => {
      const { outputVat, inputVat, netVat } = calculateVatTotals(vatReturn)
      return {
        "Company Name": company?.company_name || "Unknown",
        "KRA PIN": company?.kra_pin || "Unknown",
        Period: new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        Year: vatReturn.year,
        Month: vatReturn.month,
        "Return Type": vatReturn.is_nil_return ? "Nil Return" : "Data Return",
        "Processing Status": vatReturn.processing_status,
        "Output VAT (KES)": vatReturn.is_nil_return ? 0 : outputVat,
        "Input VAT (KES)": vatReturn.is_nil_return ? 0 : inputVat,
        "Net VAT (KES)": vatReturn.is_nil_return ? 0 : netVat,
        "Extraction Date": new Date(vatReturn.extraction_timestamp).toLocaleDateString(),
        "Error Message": vatReturn.error_message || "",
      }
    })

    const summarySheet = XLSX.utils.json_to_sheet(summaryData)

    // Style the summary sheet
    const summaryRange = XLSX.utils.decode_range(summarySheet["!ref"] || "A1")

    // Header styling
    for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!summarySheet[cellAddress]) continue
      summarySheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "366092" } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      }
    }

    // Data styling
    for (let row = summaryRange.s.r + 1; row <= summaryRange.e.r; row++) {
      for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (!summarySheet[cellAddress]) continue

        // Currency formatting for VAT columns
        if (col >= 7 && col <= 9) {
          // Output VAT, Input VAT, Net VAT columns
          summarySheet[cellAddress].z = '"KES "#,##0.00'
        }

        summarySheet[cellAddress].s = {
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
          alignment: { horizontal: col >= 7 && col <= 9 ? "right" : "left" },
        }
      }
    }

    // Set column widths
    summarySheet["!cols"] = [
      { width: 25 }, // Company Name
      { width: 15 }, // KRA PIN
      { width: 15 }, // Period
      { width: 8 }, // Year
      { width: 8 }, // Month
      { width: 12 }, // Return Type
      { width: 15 }, // Processing Status
      { width: 15 }, // Output VAT
      { width: 15 }, // Input VAT
      { width: 15 }, // Net VAT
      { width: 15 }, // Extraction Date
      { width: 30 }, // Error Message
    ]

    XLSX.utils.book_append_sheet(workbook, summarySheet, "VAT Returns Summary")

    // Detailed Sections Sheet (for non-nil returns)
    const dataReturns = vatReturns.filter((r) => !r.is_nil_return)
    if (dataReturns.length > 0) {
      const detailedData: any[] = []

      dataReturns.forEach((vatReturn) => {
        const period = new Date(vatReturn.year, vatReturn.month - 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })

        // Section M data (Sales)
        if (vatReturn.section_m?.data && Array.isArray(vatReturn.section_m.data)) {
          vatReturn.section_m.data.forEach((row: any) => {
            detailedData.push({
              Period: period,
              Section: "M - Sales Summary",
              "Tax Rate": row["Tax Rate"] || "",
              "Taxable Value (KES)": Number(row["Taxable Value (Ksh)"]) || 0,
              "VAT Amount (KES)": Number(row["Amount of Output VAT (Ksh)"]) || 0,
              Description: row["Description"] || "",
            })
          })
        }

        // Section N data (Purchases)
        if (vatReturn.section_n?.data && Array.isArray(vatReturn.section_n.data)) {
          vatReturn.section_n.data.forEach((row: any) => {
            detailedData.push({
              Period: period,
              Section: "N - Purchases Summary",
              "Tax Rate": row["Tax Rate"] || "",
              "Taxable Value (KES)": Number(row["Taxable Value (Ksh)"]) || 0,
              "VAT Amount (KES)": Number(row["Amount of Input VAT (Ksh)"]) || 0,
              Description: row["Description"] || "",
            })
          })
        }
      })

      if (detailedData.length > 0) {
        const detailedSheet = XLSX.utils.json_to_sheet(detailedData)

        // Style the detailed sheet
        const detailedRange = XLSX.utils.decode_range(detailedSheet["!ref"] || "A1")

        // Header styling
        for (let col = detailedRange.s.c; col <= detailedRange.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
          if (!detailedSheet[cellAddress]) continue
          detailedSheet[cellAddress].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4F81BD" } },
            alignment: { horizontal: "center" },
            border: {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" },
            },
          }
        }

        // Data styling and currency formatting
        for (let row = detailedRange.s.r + 1; row <= detailedRange.e.r; row++) {
          for (let col = detailedRange.s.c; col <= detailedRange.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
            if (!detailedSheet[cellAddress]) continue

            // Currency formatting for amount columns
            if (col === 3 || col === 4) {
              // Taxable Value and VAT Amount columns
              detailedSheet[cellAddress].z = '"KES "#,##0.00'
            }

            detailedSheet[cellAddress].s = {
              border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
              },
              alignment: { horizontal: col === 3 || col === 4 ? "right" : "left" },
            }
          }
        }

        detailedSheet["!cols"] = [
          { width: 15 }, // Period
          { width: 20 }, // Section
          { width: 10 }, // Tax Rate
          { width: 18 }, // Taxable Value
          { width: 15 }, // VAT Amount
          { width: 30 }, // Description
        ]

        XLSX.utils.book_append_sheet(workbook, detailedSheet, "Detailed Transactions")
      }
    }

    return workbook
  }

  const exportCompanies = (companies: Company[]) => {
    const workbook = XLSX.utils.book_new()

    const companiesData = companies.map((company) => ({
      "Company ID": company.id,
      "Company Name": company.company_name,
      "KRA PIN": company.kra_pin,
      "Created Date": company.created_at ? new Date(company.created_at).toLocaleDateString() : "",
      "Last Updated": company.updated_at ? new Date(company.updated_at).toLocaleDateString() : "",
    }))

    const sheet = XLSX.utils.json_to_sheet(companiesData)

    // Style the sheet
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1")

    // Header styling
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!sheet[cellAddress]) continue
      sheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "366092" } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      }
    }

    sheet["!cols"] = [
      { width: 12 }, // Company ID
      { width: 30 }, // Company Name
      { width: 15 }, // KRA PIN
      { width: 15 }, // Created Date
      { width: 15 }, // Last Updated
    ]

    XLSX.utils.book_append_sheet(workbook, sheet, "Companies")
    return workbook
  }

  const exportReturnListings = (listings: any[]) => {
    const workbook = XLSX.utils.book_new()

    // If data is already flattened individual records, use them directly
    let flattenedData = listings

    // If data is the original listing format, flatten it
    if (listings.length > 0 && listings[0].listing_data) {
      flattenedData = []
      listings.forEach((listing: CompanyVatReturnListings, listingIndex: number) => {
        if (Array.isArray(listing.listing_data)) {
          listing.listing_data.forEach((record: any, recordIndex: number) => {
            flattenedData.push({
              listing_id: listing.id || listingIndex + 1,
              company_id: listing.company_id,
              company_name: company?.company_name || "Unknown",
              last_scraped: new Date(listing.last_scraped_at).toLocaleDateString(),
              record_index: recordIndex + 1,
              ...record, // Spread all the fields from the individual record
            })
          })
        }
      })
    }

    if (flattenedData.length === 0) {
      // Create empty sheet if no data
      const emptySheet = XLSX.utils.json_to_sheet([
        {
          Message: "No return listing data available",
        },
      ])
      XLSX.utils.book_append_sheet(workbook, emptySheet, "Return Summary")
      return workbook
    }

    // Get all unique keys from all records
    const allKeys = new Set<string>()
    flattenedData.forEach((record) => {
      Object.keys(record).forEach((key) => allKeys.add(key))
    })

    // Create consistent data structure
    const consistentData = flattenedData.map((record) => {
      const consistentRecord: any = {}
      Array.from(allKeys).forEach((key) => {
        consistentRecord[key] = record[key] || ""
      })
      return consistentRecord
    })

    const sheet = XLSX.utils.json_to_sheet(consistentData)

    // Style the sheet
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1")

    // Header styling
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!sheet[cellAddress]) continue
      sheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "366092" } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      }
    }

    // Data styling
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (!sheet[cellAddress]) continue

        sheet[cellAddress].s = {
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
          alignment: { horizontal: "left" },
        }
      }
    }

    // Set column widths dynamically based on content
    const colWidths = Array.from(allKeys).map((key) => {
      const maxLength = Math.max(
        key.length,
        ...flattenedData.map((record) => {
          const value = record[key]
          return value ? value.toString().length : 0
        }),
      )
      return { width: Math.min(Math.max(maxLength + 2, 10), 50) }
    })

    sheet["!cols"] = colWidths

    XLSX.utils.book_append_sheet(workbook, sheet, "Return Summary Detail")
    return workbook
  }

  const exportSectionData = (sectionData: any[]) => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet(sectionData)

    // Style the sheet
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1")

    // Header styling
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!sheet[cellAddress]) continue
      sheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F81BD" } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      }
    }

    XLSX.utils.book_append_sheet(workbook, sheet, "Section Data")
    return workbook
  }

  const handleExport = async () => {
    if (data.length === 0) {
      alert("No data to export")
      return
    }

    setIsExporting(true)

    try {
      let workbook: XLSX.WorkBook

      switch (type) {
        case "vat-returns":
          workbook = exportVatReturns(data as VatReturnDetails[])
          break
        case "companies":
          workbook = exportCompanies(data as Company[])
          break
        case "return-listings":
          workbook = exportReturnListings(data)
          break
        case "section-data":
          workbook = exportSectionData(data)
          break
        default:
          throw new Error("Unsupported export type")
      }

      // Generate and download the file
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`
      link.click()

      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export failed:", error)
      alert("Export failed. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isExporting || data.length === 0}
      className={className}
    >
      <Download className="mr-2 h-4 w-4" />
      {isExporting ? "Exporting..." : "Export to Excel"}
    </Button>
  )
}
