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

  // Get all subtables with their proper labels
  const getAllSubtables = () => {
    const subtablesMap = new Map()
    
    sectionData.forEach((periodData, periodIndex) => {
      Object.keys(periodData).forEach((key) => {
        if (key.startsWith("table_")) {
          const tableData = periodData[key]
          if (tableData && (tableData.data || tableData.content)) {
            if (!subtablesMap.has(key)) {
              // Extract table label from the data structure
              let tableLabel = `Table ${key.replace('table_', '')}`
              
              // Try to get a meaningful label from the table data
              if (tableData.data && Array.isArray(tableData.data)) {
                if (tableData.data.length > 0 && Array.isArray(tableData.data[0])) {
                  // Use first row as potential title/label
                  const firstRow = tableData.data[0]
                  if (firstRow.length === 1 && typeof firstRow[0] === 'string') {
                    tableLabel = firstRow[0]
                  }
                }
              }
              
              // If it's text content, use the content type as label
              if (tableData.type === "text_content") {
                tableLabel = `${key.replace('table_', '')} - Text Content`
              }

              subtablesMap.set(key, {
                key: key,
                label: tableLabel,
                type: tableData.type || 'table',
                periods: []
              })
            }
            
            subtablesMap.get(key).periods.push({
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
    
    return Array.from(subtablesMap.values())
  }

  // Extract headers for a specific subtable
  const extractSubtableHeaders = (subtable) => {
    const headers = ["period", "acknowledgement_no"] // Always include these basic columns
    
    if (subtable.type === "text_content") {
      headers.push("content")
      return headers
    }

    // For table data, extract headers from the actual table structure
    const headerSet = new Set()
    
    subtable.periods.forEach(period => {
      const tableData = period.data
      if (tableData.data && Array.isArray(tableData.data)) {
        // Check if first row contains headers
        if (tableData.data.length > 0 && Array.isArray(tableData.data[0])) {
          const potentialHeaders = tableData.data[0]
          
          // If first row looks like headers (all strings, reasonable length)
          if (potentialHeaders.every(cell => typeof cell === 'string') && 
              potentialHeaders.length <= 10) {
            potentialHeaders.forEach(header => {
              if (header && header.trim() !== '') {
                headerSet.add(header.trim())
              }
            })
          } else {
            // If not headers, create generic column names
            potentialHeaders.forEach((_, index) => {
              headerSet.add(`Column ${index + 1}`)
            })
          }
        }
      }
    })

    return [...headers, ...Array.from(headerSet)]
  }

  // Build rows for a specific subtable
  const buildSubtableRows = (subtable, headers) => {
    return subtable.periods.map(period => {
      const row = {
        id: `${period.period}_${subtable.key}`,
        period: period.period, // Keep original format
        acknowledgement_no: period.acknowledgement_no,
        return_period_to: period.return_period_to,
        date_of_filing: period.date_of_filing,
      }

      const tableData = period.data

      if (tableData.type === "text_content") {
        row.content = tableData.content || ""
        return row
      }

      if (tableData.data && Array.isArray(tableData.data)) {
        const data = tableData.data
        
        if (data.length > 0) {
          const firstRow = data[0]
          
          // Determine if first row is headers
          const hasHeaders = firstRow.every(cell => typeof cell === 'string') && 
                           firstRow.length <= 10
          
          const startRow = hasHeaders ? 1 : 0
          const columnHeaders = hasHeaders ? firstRow : headers.slice(2) // Skip period and ack columns
          
          // Process data rows
          for (let i = startRow; i < data.length; i++) {
            const dataRow = data[i]
            if (Array.isArray(dataRow)) {
              dataRow.forEach((cellValue, colIndex) => {
                const columnName = columnHeaders[colIndex] || `Column ${colIndex + 1}`
                if (columnName && !row[columnName]) {
                  row[columnName] = cellValue
                }
              })
            }
          }
        }
      }

      return row
    })
  }

  // Format cell value without date conversion
  const formatCellValue = (value, header) => {
    if (value === null || value === undefined || value === '') {
      return "-"
    }

    // Only format currency values, keep dates as-is
    if (typeof value === 'number' || 
        (typeof value === 'string' && value.match(/^\d+(\.\d{2})?$/)) ||
        header.toLowerCase().includes('amount') ||
        header.toLowerCase().includes('value') ||
        header.toLowerCase().includes('cost') ||
        header.toLowerCase().includes('ksh') ||
        header.toLowerCase().includes('kes')) {
      return formatCurrency(value)
    }

    if (header.toLowerCase().includes('rate') || 
        header.toLowerCase().includes('percent') ||
        header.toLowerCase().includes('%')) {
      return typeof value === 'number' ? `${value}%` : value
    }

    // Return dates and other values as-is
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
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Summary Info */}
        <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b">
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

        {/* Render each subtable */}
        {allSubtables.map((subtable, subtableIndex) => {
          const headers = extractSubtableHeaders(subtable)
          const rows = buildSubtableRows(subtable, headers)

          return (
            <div key={subtable.key} className="space-y-3">
              {/* Subtable Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-medium">{subtable.label}</h4>
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

              {/* Subtable Content */}
              <div className="border rounded-lg overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow className="h-10">
                        {headers.map((header, headerIndex) => (
                          <TableHead 
                            key={headerIndex} 
                            className={`text-xs font-medium px-3 py-2 border-r last:border-r-0 ${
                              header === "period" || header === "acknowledgement_no" 
                                ? 'bg-gray-100 sticky left-0 z-10' 
                                : ''
                            }`}
                            style={{ 
                              minWidth: header === "period" ? "140px" : 
                                      header === "acknowledgement_no" ? "140px" : 
                                      header.toLowerCase().includes('amount') || 
                                      header.toLowerCase().includes('value') ? "120px" : "100px",
                              left: header === "period" ? "0px" : 
                                   header === "acknowledgement_no" ? "140px" : undefined
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
                                     header === "acknowledgement_no" ? "140px" : undefined
                              }}
                            >
                              {header === "period" && (
                                <div>
                                  <div className="font-medium text-xs">
                                    {row.period}
                                  </div>
                                  {row.return_period_to && (
                                    <div className="text-gray-500 text-xs">
                                      to {row.return_period_to}
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
                                      Filed: {row.date_of_filing}
                                    </div>
                                  )}
                                </div>
                              )}
                              {header !== "period" && header !== "acknowledgement_no" && (
                                <div className={`
                                  ${header.toLowerCase().includes('amount') || 
                                    header.toLowerCase().includes('value') ? "text-right font-mono" : ""}
                                  ${header === "content" ? "max-w-xs truncate" : ""}
                                  break-words
                                `}>
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

              {/* Separator between subtables */}
              {subtableIndex < allSubtables.length - 1 && (
                <Separator className="my-4" />
              )}
            </div>
          )
        })}

        {/* Footer Summary */}
        {sectionData.length > 0 && (
          <div className="text-xs text-gray-500 border-t pt-3 mt-4">
            <div className="flex justify-between items-center">
              <span>
                Total periods: {sectionData.length} | Subtables: {allSubtables.length}
              </span>
              <span>
                Last filed: {sectionData[0]?.date_of_filing}
              </span>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}