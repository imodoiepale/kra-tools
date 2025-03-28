// @ts-nocheck

import React from 'react'
import { Button } from "@/components/ui/button"
import { Download } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Company } from '../types'
import { formatDate } from '../utils'

interface DownloadDatesButtonProps {
  companies: Company[]
}

export function DownloadDatesButton({ companies }: DownloadDatesButtonProps) {
  const handleDownloadDates = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Company Dates')

    // Add headers
    worksheet.addRow([]) // Empty first row
    const headerRow = worksheet.getRow(2)
    const headers = [
      'Index',
      'Company Name',
      'ACC From',
      'ACC To',
      'Audit Tax From',
      'Audit Tax To',
      'CPS Sheria From',
      'CPS Sheria To',
      'Immigration From',
      'Immigration To'
    ]

    headers.forEach((header, i) => {
      headerRow.getCell(i + 2).value = header // Start from column B
    })

    // Style headers
    headerRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' }
      }
    })

    // Add data
    companies
      .sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''))
      .forEach((company, index) => {
        const row = worksheet.addRow([
          '', // Empty cell in column A
          index + 1,
          company.company_name || company.name,
          formatDate(company.acc_client_effective_from),
          formatDate(company.acc_client_effective_to),
          formatDate(company.audit_tax_client_effective_from),
          formatDate(company.audit_tax_client_effective_to),
          formatDate(company.cps_sheria_client_effective_from),
          formatDate(company.cps_sheria_client_effective_to),
          formatDate(company.imm_client_effective_from),
          formatDate(company.imm_client_effective_to)
        ])

        // Center-align the index column (column B)
        row.getCell(2).alignment = { horizontal: 'center' }

        // Center-align date columns
        for (let i = 4; i <= 11; i++) {
          row.getCell(i).alignment = { horizontal: 'center' }
        }
    })

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      let maxLength = 0
      column.eachCell({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value ? cell.value.toString().length : 10
        if (cellLength > maxLength) {
          maxLength = cellLength
        }
      })
      column.width = maxLength + 2
    })

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)

    // Trigger download
    const link = document.createElement('a')
    link.href = url
    link.download = 'company_dates.xlsx'
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownloadDates}>
      <Download className="h-4 w-4 mr-2" />
      Download All Dates
    </Button>
  )
}
