// @ts-nocheck
import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, FileText, Database } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface SectionDataTableProps {
  sectionData: any[]
  selectedSection: string
  formatCurrency: (value: any) => string
  formatDate: (dateString: string) => string
}

export function SectionDataTable({ 
  sectionData, 
  selectedSection, 
  formatCurrency 
}: SectionDataTableProps) {
  
  // Format date to dd/mm/yyyy
  const formatDate = (dateString: string) => {
    if (!dateString) return ""
    try {
      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    } catch {
      return dateString
    }
  }

  if (!sectionData || sectionData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-3 text-gray-400" />
          <h4 className="text-sm font-medium mb-1">No data available for this section</h4>
          <p className="text-xs text-gray-400">This section may not be applicable or no returns have been filed</p>
        </div>
      </div>
    )
  }

  // Function to parse concatenated string into key-value pairs
  const parseReturnInformation = (dataString: string) => {
    const keyValuePairs = {}
    
    // Common patterns for Section A data
    const patterns = [
      { key: 'Personal Identification Number', regex: /Personal Identification Number\s+([A-Z0-9]+)/i },
      { key: 'Taxpayer Name', regex: /Taxpayer Name\s+([^A-Z]*?)(?=\s+Address|$)/i },
      { key: 'Address', regex: /Address\s+([^.]*\.?[^A-Z]*?)(?=\s+Type of Return|$)/i },
      { key: 'Type of Return', regex: /Type of Return\s+([^A-Z]*?)(?=\s+Return Period From|$)/i },
      { key: 'Return Period From', regex: /Return Period From\s+(\d{2}\/\d{2}\/\d{4})/i },
      { key: 'Return Period To', regex: /Return Period To\s+(\d{2}\/\d{2}\/\d{4})/i },
      { key: 'Date of Filing', regex: /Date of Filing\s+(\d{2}\/\d{2}\/\d{4})/i },
      { key: 'Entity Type', regex: /Entity Type\s+([^A-Z]*?)(?=\s+[A-Z]|$)/i },
      { key: 'Tax Obligation', regex: /Tax Obligation\s+([^A-Z]*?)(?=\s+[A-Z]|$)/i },
      { key: 'Status', regex: /Status\s+([^A-Z]*?)(?=\s+[A-Z]|$)/i },
      { key: 'NSSF Status', regex: /NSSF Status\s+([^A-Z]*?)(?=\s+[A-Z]|$)/i }
    ]

    patterns.forEach(pattern => {
      const match = dataString.match(pattern.regex)
      if (match && match[1]) {
        keyValuePairs[pattern.key] = match[1].trim()
      }
    })

    return keyValuePairs
  }

  // Get all subtables with proper parsing for Section A
  const getAllSubtables = () => {
    const subtablesMap = new Map()
    
    sectionData.forEach((periodData, periodIndex) => {
      Object.keys(periodData).forEach((key) => {
        if (key.startsWith("table_")) {
          const tableData = periodData[key]
          if (tableData && (tableData.data || tableData.content)) {
            
            let tableLabel = tableData.partName || `Table ${key.replace('table_', '')}`
            let tableKey = key
            
            // Special handling for Section A
            if (selectedSection === 'sectionA' && tableData.partName) {
              tableLabel = tableData.partName
            }
            
            if (!subtablesMap.has(tableKey)) {
              subtablesMap.set(tableKey, {
                key: tableKey,
                label: tableLabel,
                partName: tableData.partName || "",
                type: tableData.type || 'table',
                sectionKey: tableData.sectionKey || selectedSection,
                partIndex: tableData.partIndex || 0,
                periods: []
              })
            }
            
            subtablesMap.get(tableKey).periods.push({
              periodIndex,
              period: periodData.period,
              acknowledgement_no: periodData.acknowledgement_no,
              return_period_to: periodData.return_period_to,
              date_of_filing: periodData.date_of_filing,
              data: tableData
            })
          }
        }
      })
    })
    
    return Array.from(subtablesMap.values()).sort((a, b) => a.partIndex - b.partIndex)
  }

  // Extract headers with special handling for Section A
  const extractTableHeaders = (subtable) => {
    const headerSet = new Set(["period", "acknowledgement_no"])
    
    if (subtable.type === "text_content") {
      headerSet.add("content")
      return Array.from(headerSet)
    }

    // Special handling for Section A - Return Information
    if (selectedSection === 'sectionA') {
      // For Section A, we want to show the parsed key-value pairs
      const commonFields = [
        "Personal Identification Number",
        "Taxpayer Name", 
        "Address",
        "Type of Return",
        "Return Period From",
        "Return Period To",
        "Date of Filing",
        "Entity Type",
        "Tax Obligation",
        "Status",
        "NSSF Status"
      ]
      
      commonFields.forEach(field => headerSet.add(field))
      return Array.from(headerSet)
    }

    // For other sections, extract headers from table data
    subtable.periods.forEach(period => {
      const tableData = period.data
      if (tableData.data && Array.isArray(tableData.data) && tableData.data.length > 0) {
        const firstRow = tableData.data[0]
        
        if (Array.isArray(firstRow)) {
          const isHeaderRow = firstRow.every(cell => 
            typeof cell === 'string' && cell.trim() !== ''
          )
          
          if (isHeaderRow) {
            firstRow.forEach(header => {
              if (header && typeof header === 'string' && header.trim() !== '') {
                headerSet.add(header.trim())
              }
            })
          } else {
            firstRow.forEach((_, index) => {
              headerSet.add(`Column ${index + 1}`)
            })
          }
        }
      }
    })

    return Array.from(headerSet)
  }

  // Build rows with special handling for Section A
  const buildTableRows = (subtable, headers) => {
    const rowsMap = new Map()
    
    subtable.periods.forEach(period => {
      const rowKey = period.period
      
      if (!rowsMap.has(rowKey)) {
        rowsMap.set(rowKey, {
          id: `${period.period}_${subtable.key}`,
          period: period.period,
          acknowledgement_no: period.acknowledgement_no,
          return_period_to: period.return_period_to,
          date_of_filing: period.date_of_filing,
        })
      }

      const row = rowsMap.get(rowKey)
      const tableData = period.data

      if (tableData.type === "text_content") {
        row.content = tableData.content || ""
        return
      }

      // Special handling for Section A
      if (selectedSection === 'sectionA' && tableData.data && Array.isArray(tableData.data)) {
        // Check if the data is a concatenated string that needs parsing
        const flatData = tableData.data.flat()
        const concatenatedString = flatData.join(' ')
        
        if (concatenatedString.includes('Personal Identification Number') || 
            concatenatedString.includes('Taxpayer Name')) {
          // Parse the concatenated string
          const parsedData = parseReturnInformation(concatenatedString)
          Object.assign(row, parsedData)
          return
        }
        
        // Otherwise, process as regular table data
        const data = tableData.data
        if (data.length > 0) {
          const firstRow = data[0]
          const isHeaderRow = Array.isArray(firstRow) && 
                            firstRow.every(cell => typeof cell === 'string' && cell.trim() !== '')
          
          const startRow = isHeaderRow ? 1 : 0
          const columnHeaders = isHeaderRow ? firstRow : []
          
          for (let i = startRow; i < data.length; i++) {
            const dataRow = data[i]
            if (Array.isArray(dataRow)) {
              dataRow.forEach((cellValue, colIndex) => {
                const columnName = columnHeaders[colIndex] || `Column ${colIndex + 1}`
                if (columnName && headers.includes(columnName)) {
                  row[columnName] = cellValue
                }
              })
            }
          }
        }
      } else {
        // Regular table processing for other sections
        if (tableData.data && Array.isArray(tableData.data)) {
          const data = tableData.data
          
          if (data.length > 0) {
            const firstRow = data[0]
            const isHeaderRow = Array.isArray(firstRow) && 
                              firstRow.every(cell => typeof cell === 'string' && cell.trim() !== '')
            
            const startRow = isHeaderRow ? 1 : 0
            const columnHeaders = isHeaderRow ? firstRow : []
            
            for (let i = startRow; i < data.length; i++) {
              const dataRow = data[i]
              if (Array.isArray(dataRow)) {
                dataRow.forEach((cellValue, colIndex) => {
                  const columnName = columnHeaders[colIndex] || `Column ${colIndex + 1}`
                  if (columnName && headers.includes(columnName)) {
                    row[columnName] = cellValue
                  }
                })
              }
            }
          }
        }
      }
    })

    return Array.from(rowsMap.values())
  }

  // Format cell value
  const formatCellValue = (value, header) => {
    if (value === null || value === undefined || value === '') {
      return "-"
    }

    // Format currency values
    if (typeof value === 'number' || 
        (typeof value === 'string' && value.match(/^\d+(\.\d{2})?$/)) ||
        header.toLowerCase().includes('amount') ||
        header.toLowerCase().includes('value') ||
        header.toLowerCase().includes('cost') ||
        header.toLowerCase().includes('ksh') ||
        header.toLowerCase().includes('kes')) {
      return formatCurrency(value)
    }

    // Format percentages
    if (header.toLowerCase().includes('rate') || 
        header.toLowerCase().includes('percent') ||
        header.toLowerCase().includes('%')) {
      return typeof value === 'number' ? `${value}%` : value
    }

    return value.toString()
  }

  const allSubtables = getAllSubtables()

  if (allSubtables.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <Database className="h-8 w-8 mx-auto mb-3 text-gray-400" />
          <h4 className="text-sm font-medium mb-1">No subtable data found</h4>
          <p className="text-xs text-gray-400">This section contains no structured data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Summary Info */}
      <div className="flex-shrink-0 border-b bg-gray-50 p-3">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <FileText className="h-3 w-3 mr-1" />
              {sectionData.length} return periods
            </span>
            <span className="flex items-center">
              <Database className="h-3 w-3 mr-1" />
              {allSubtables.length} subtable{allSubtables.length !== 1 ? 's' : ''}
            </span>
          </div>
          <span>
            Period range: {sectionData[sectionData.length - 1]?.period} to {sectionData[0]?.period}
          </span>
        </div>
      </div>

      {/* Tables Container with proper scrolling */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="p-4 space-y-6">
            {allSubtables.map((subtable, subtableIndex) => {
              const headers = extractTableHeaders(subtable)
              const rows = buildTableRows(subtable, headers)

              return (
                <div key={subtable.key} className="space-y-3">
                  {/* Subtable Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium text-gray-900">
                        {subtable.label || `Table ${subtable.key.replace('table_', '')}`}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {subtable.key}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {subtable.periods.length} periods
                      </Badge>
                      {subtable.type === "text_content" && (
                        <Badge variant="outline" className="text-xs">
                          Text
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Subtable Content with horizontal scroll */}
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <div className="overflow-x-auto max-w-full">
                      <div className="min-w-full">
                        <Table>
                          <TableHeader className="bg-gray-50 sticky top-0 z-10">
                            <TableRow className="h-10">
                              {headers.map((header, headerIndex) => (
                                <TableHead 
                                  key={headerIndex} 
                                  className={`text-xs font-medium px-3 py-2 border-r last:border-r-0 whitespace-nowrap ${
                                    header === "period" || header === "acknowledgement_no" 
                                      ? 'bg-gray-100 sticky left-0 z-20' 
                                      : 'bg-gray-50'
                                  }`}
                                  style={{ 
                                    minWidth: header === "period" ? "140px" : 
                                            header === "acknowledgement_no" ? "160px" : 
                                            header.toLowerCase().includes('address') ? "200px" :
                                            header.toLowerCase().includes('name') ? "180px" :
                                            header.toLowerCase().includes('amount') || 
                                            header.toLowerCase().includes('value') ? "120px" : "120px",
                                    left: header === "period" ? "0px" : 
                                         header === "acknowledgement_no" ? "140px" : undefined,
                                    maxWidth: header === "content" || header.toLowerCase().includes('address') ? "300px" : undefined
                                  }}
                                >
                                  <div className="text-left">
                                    <span className="font-medium">
                                      {header === "period" ? "Return Period" : 
                                       header === "acknowledgement_no" ? "Acknowledgement No" : 
                                       header === "content" ? "Content" :
                                       header}
                                    </span>
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row, rowIndex) => (
                              <TableRow key={row.id} className="h-12 hover:bg-gray-50">
                                {headers.map((header, headerIndex) => (
                                  <TableCell 
                                    key={`${row.id}_${header}`} 
                                    className={`text-xs px-3 py-2 border-r last:border-r-0 ${
                                      header === "period" || header === "acknowledgement_no" 
                                        ? 'bg-white sticky left-0 z-10 border-r-2' 
                                        : ''
                                    }`}
                                    style={{ 
                                      left: header === "period" ? "0px" : 
                                           header === "acknowledgement_no" ? "140px" : undefined,
                                      maxWidth: header === "content" || header.toLowerCase().includes('address') ? "300px" : undefined
                                    }}
                                  >
                                    {header === "period" && (
                                      <div>
                                        <div className="font-medium text-xs">
                                          {formatDate(row.period)}
                                        </div>
                                        {row.return_period_to && (
                                          <div className="text-gray-500 text-xs">
                                            to {formatDate(row.return_period_to)}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {header === "acknowledgement_no" && (
                                      <div>
                                        <div className="font-mono text-xs font-medium">
                                          {row.acknowledgement_no}
                                        </div>
                                        {row.date_of_filing && (
                                          <div className="text-gray-500 text-xs">
                                            Filed: {formatDate(row.date_of_filing)}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {header !== "period" && header !== "acknowledgement_no" && (
                                      <div className={`
                                        ${header.toLowerCase().includes('amount') || 
                                          header.toLowerCase().includes('value') ? "text-right font-mono" : ""}
                                        ${header === "content" || header.toLowerCase().includes('address') ? "truncate" : ""}
                                        break-words
                                      `}
                                      title={header === "content" || header.toLowerCase().includes('address') ? row[header] : undefined}
                                      >
                                        {formatCellValue(row[header], header)}
                                      </div>
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>

                  {/* Separator between subtables */}
                  {subtableIndex < allSubtables.length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Footer Summary */}
      {sectionData.length > 0 && (
        <div className="flex-shrink-0 text-xs text-gray-500 border-t bg-gray-50 p-3">
          <div className="flex justify-between items-center">
            <span>
              Total periods: {sectionData.length} | Subtables: {allSubtables.length}
            </span>
            <span>
              Last filed: {formatDate(sectionData[0]?.date_of_filing)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}