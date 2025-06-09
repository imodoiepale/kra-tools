"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import * as XLSX from "xlsx"

interface ReportExporterProps {
  data: any[]
  reportName: string
  reportDescription: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
}

export function ReportExporter({
  data,
  reportName,
  reportDescription,
  variant = "default",
  size = "default",
}: ReportExporterProps) {
  const [isExporting, setIsExporting] = useState(false)

  const exportToExcel = async () => {
    if (data.length === 0) {
      alert("No data to export")
      return
    }

    setIsExporting(true)

    try {
      const workbook = XLSX.utils.book_new()

      // Add report metadata
      const metadata = [
        ["Report Name", reportName],
        ["Description", reportDescription],
        ["Generated On", new Date().toLocaleString()],
        ["Total Records", data.length],
        [""],
        ["Data:"],
      ]

      // Create data with row numbers
      const dataWithRowNumbers = data.map((row, index) => ({
        "Sr.No.": index + 1,
        ...row,
      }))

      // Create worksheet with metadata and data
      const worksheet = XLSX.utils.aoa_to_sheet(metadata)

      // Add data starting from row 7 (after metadata)
      XLSX.utils.sheet_add_json(worksheet, dataWithRowNumbers, {
        origin: "A7",
        skipHeader: false,
      })

      // Style the worksheet
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1")

      // Header styling for metadata
      for (let row = 0; row < 4; row++) {
        const cellA = XLSX.utils.encode_cell({ r: row, c: 0 })
        const cellB = XLSX.utils.encode_cell({ r: row, c: 1 })

        if (worksheet[cellA]) {
          worksheet[cellA].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "E6F3FF" } },
          }
        }
      }

      // Data header styling
      const dataStartRow = 6
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: dataStartRow, c: col })
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].s = {
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
      }

      // Data styling
      for (let row = dataStartRow + 1; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          if (worksheet[cellAddress]) {
            worksheet[cellAddress].s = {
              border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
              },
              alignment: { horizontal: col === 0 ? "center" : "left" },
            }
          }
        }
      }

      // Set column widths
      const headers = Object.keys(dataWithRowNumbers[0] || {})
      worksheet["!cols"] = headers.map((header) => {
        const maxLength = Math.max(
          header.length,
          ...data.map((row) => {
            const value = row[header === "Sr.No." ? "Sr.No." : header.replace("Sr.No.", "")]
            return value ? value.toString().length : 0
          }),
        )
        return { width: Math.min(Math.max(maxLength + 2, 10), 50) }
      })

      XLSX.utils.book_append_sheet(workbook, worksheet, "Report Data")

      // Generate and download the file
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${reportName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`
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
    <Button variant={variant} size={size} onClick={exportToExcel} disabled={isExporting || data.length === 0}>
      <Download className="mr-2 h-4 w-4" />
      {isExporting ? "Exporting..." : "Export to Excel"}
    </Button>
  )
}
