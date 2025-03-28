// @ts-nocheck

import React from 'react'
import { Button } from "@/components/ui/button"
import { Download } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Company } from '../types'

interface ExportButtonProps {
  companies: Company[]
  activeTab: string
}

export function ExportButton({ companies, activeTab }: ExportButtonProps) {
  const handleDownloadExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Password Check Reports')

    // Add headers
    const headers = ['Index', 'Name', 'Identifier', 'Password', 'Status', 'Last Checked']
    if (activeTab === 'nhif' || activeTab === 'nssf') headers.push('Code')
    if (activeTab === 'ecitizen') headers.push('Director')

    worksheet.addRow([]) // Create empty first row
    const headerRow = worksheet.getRow(2)
    headers.forEach((header, i) => {
      headerRow.getCell(i + 2).value = header // Start from column B
    })

    headerRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' }
      }
    })

    // Add data
    companies.forEach((company, index) => {
      const row = worksheet.addRow([
        '', // Empty cell in column A
        index + 1, // Index in B starting from 1
        company.company_name, // Company Name in C
        getIdentifier(company, activeTab), // Identifier in D
        getPassword(company, activeTab), // Password in E
        company.status, // Status in F
        company.last_checked ? new Date(company.last_checked).toLocaleString() : 'Missing' // Last Checked in G
      ])

      // Center-align the index column (column B)
      row.getCell(2).alignment = { horizontal: 'center' }

      // Set status cell background color
      const statusCell = row.getCell(6) // Status is in column F (6th column)
      const statusColor = {
        'valid': 'FF90EE90', // Light green for valid
        'invalid': 'FFFF6347', // Tomato red for invalid
        'default': 'FFFFD700' // Gold for other statuses
      }

      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: statusColor[company.status?.toLowerCase()] || statusColor.default }
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
    link.download = `${activeTab}_password_check_reports.xlsx`
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
      <Download className="h-4 w-4 mr-2" />
      Download Excel
    </Button>
  )
}

function getIdentifier(company: Company, activeTab: string): string {
  switch (activeTab) {
    case 'kra':
      return company.kra_pin || ''
    case 'nhif':
      return company.nhif_id || ''
    case 'nssf':
      return company.nssf_id || ''
    case 'ecitizen':
      return company.ecitizen_identifier || ''
    case 'quickbooks':
      return company.quickbooks_id || ''
    case 'kebs':
      return company.kebs_id || ''
    default:
      return ''
  }
}

function getPassword(company: Company, activeTab: string): string {
  switch (activeTab) {
    case 'kra':
      return company.kra_password || ''
    case 'nhif':
      return company.nhif_password || ''
    case 'nssf':
      return company.nssf_password || ''
    case 'ecitizen':
      return company.ecitizen_password || ''
    case 'quickbooks':
      return company.quickbooks_password || ''
    case 'kebs':
      return company.kebs_password || ''
    default:
      return ''
  }
}
