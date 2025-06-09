// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Trash2, MoveUp, MoveDown, Check, ChevronsUpDown, Search } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface ColumnSelectorProps {
  availableTables: any[]
  selectedDataSources: any[]
  selectedColumns: any[]
  setSelectedColumns: (columns: any[]) => void
}

export function ColumnSelector({
  availableTables,
  selectedDataSources,
  selectedColumns,
  setSelectedColumns,
}: ColumnSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null)
  const [columnAlias, setColumnAlias] = useState("")
  const [columnOpen, setColumnOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Auto-expand all groups when data sources change
  useEffect(() => {
    if (selectedDataSources.length > 0) {
      const allGroups = new Set<string>()
      selectedDataSources.forEach((source) => {
        allGroups.add(`${source.id}-regular`)
        if (source.schema?.nested) {
          Object.keys(source.schema.nested).forEach((field) => {
            allGroups.add(`${source.id}-${field}`)
          })
        }
      })
      setExpandedGroups(allGroups)
    }
  }, [selectedDataSources])

  // Get all available columns from selected data sources
  const getAvailableColumns = () => {
    const columns: any[] = []

    selectedDataSources.forEach((source) => {
      const tableConfig = availableTables.find((t) => t.id === source.tableId)
      if (!tableConfig) return

      // Add regular columns
      Object.entries(source.schema?.regular || {}).forEach(([key, type]) => {
        columns.push({
          sourceId: source.id,
          sourceName: source.alias,
          tableName: tableConfig.name,
          path: key,
          type: type as string,
          displayName: `${source.alias}.${key}`,
          category: "regular",
          groupKey: `${source.id}-regular`,
        })
      })

      // Add nested columns
      if (source.schema?.nested) {
        Object.entries(source.schema.nested).forEach(([field, nested]: [string, any]) => {
          Object.entries(nested.columns || {}).forEach(([nestedKey, nestedType]) => {
            const cleanKey = nestedKey.replace(`${field}.`, "")
            columns.push({
              sourceId: source.id,
              sourceName: source.alias,
              tableName: tableConfig.name,
              path: nestedKey,
              type: nestedType as string,
              displayName: `${source.alias}.${field}.${cleanKey}`,
              category: "nested",
              nestedField: field,
              groupKey: `${source.id}-${field}`,
            })
          })
        })
      }
    })

    return columns
  }

  const availableColumns = getAvailableColumns()

  const categorizeVatColumn = (columnPath: string) => {
    if (columnPath.startsWith('section_o_')) {
      const field = columnPath.replace('section_o_', '')
      if (field.includes('_description')) return { category: 'description', section: 'O', importance: 'low' }
      if (field.includes('output_vat_13')) return { category: 'key_metric', section: 'O', importance: 'high' }
      if (field.includes('input_vat_14')) return { category: 'key_metric', section: 'O', importance: 'high' }
      if (field.includes('net_vat_28')) return { category: 'key_metric', section: 'O', importance: 'high' }
      return { category: 'tax_calculation', section: 'O', importance: 'medium' }
    }

    if (columnPath.startsWith('section_b2_')) {
      if (columnPath.includes('total_')) return { category: 'total', section: 'B2', importance: 'high' }
      if (columnPath.includes('registered_')) return { category: 'registered', section: 'B2', importance: 'medium' }
      if (columnPath.includes('non_registered_')) return { category: 'non_registered', section: 'B2', importance: 'medium' }
      return { category: 'sales_breakdown', section: 'B2', importance: 'medium' }
    }

    if (columnPath.startsWith('section_f2_')) {
      if (columnPath.includes('total_')) return { category: 'total', section: 'F2', importance: 'high' }
      if (columnPath.includes('local_')) return { category: 'local', section: 'F2', importance: 'medium' }
      if (columnPath.includes('import_')) return { category: 'import', section: 'F2', importance: 'medium' }
      return { category: 'purchase_breakdown', section: 'F2', importance: 'medium' }
    }

    if (columnPath.startsWith('section_m_')) {
      if (columnPath.includes('total_')) return { category: 'total', section: 'M', importance: 'high' }
      if (columnPath.includes('rate_')) return { category: 'rate_breakdown', section: 'M', importance: 'medium' }
      return { category: 'sales_summary', section: 'M', importance: 'medium' }
    }

    if (columnPath.startsWith('section_n_')) {
      if (columnPath.includes('total_')) return { category: 'total', section: 'N', importance: 'high' }
      if (columnPath.includes('rate_')) return { category: 'rate_breakdown', section: 'N', importance: 'medium' }
      return { category: 'purchase_summary', section: 'N', importance: 'medium' }
    }

    return { category: 'other', section: 'Other', importance: 'medium' }
  }

  // Filter columns based on search term
  const filteredColumns = availableColumns.filter(
    (col) =>
      col.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      col.path.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Group columns by source and category
  const enhancedGroupedColumns = selectedDataSources.reduce((acc: any, source) => {
    const sourceColumns = filteredColumns.filter((col) => col.sourceId === source.id)

    if (sourceColumns.length === 0) return acc

    acc[source.id] = {
      source,
      regular: sourceColumns.filter((col) => col.category === "regular"),
      nested: {},
      vatSections: {}  // Add VAT sections grouping
    }

    // Group nested columns by field and VAT section type
    sourceColumns
      .filter((col) => col.category === "nested")
      .forEach((col) => {
        // Check if it's a VAT section column
        if (col.path.startsWith('section_')) {
          const vatInfo = categorizeVatColumn(col.path)
          const sectionKey = `section_${vatInfo.section.toLowerCase()}`

          if (!acc[source.id].vatSections[sectionKey]) {
            acc[source.id].vatSections[sectionKey] = {
              sectionName: `Section ${vatInfo.section}`,
              isOptimized: ['section_o', 'section_b2', 'section_f2', 'section_m', 'section_n'].includes(sectionKey),
              categories: {}
            }
          }

          if (!acc[source.id].vatSections[sectionKey].categories[vatInfo.category]) {
            acc[source.id].vatSections[sectionKey].categories[vatInfo.category] = []
          }

          acc[source.id].vatSections[sectionKey].categories[vatInfo.category].push({
            ...col,
            vatInfo
          })
        } else {
          // Original nested grouping for non-VAT sections
          if (!acc[source.id].nested[col.nestedField]) {
            acc[source.id].nested[col.nestedField] = []
          }
          acc[source.id].nested[col.nestedField].push(col)
        }
      })

    return acc
  }, {})


  // Add a column to the report
  const addColumn = (column: any) => {
    if (editingColumnIndex !== null) {
      // Update existing column
      const updatedColumns = [...selectedColumns]
      updatedColumns[editingColumnIndex] = {
        ...column,
        alias: columnAlias || column.path,
      }
      setSelectedColumns(updatedColumns)
      resetForm()
    } else {
      // Check if column already exists
      const exists = selectedColumns.some((c) => c.sourceId === column.sourceId && c.path === column.path)

      if (!exists) {
        setSelectedColumns([
          ...selectedColumns,
          {
            ...column,
            alias: columnAlias || column.path,
          },
        ])
      }
      resetForm()
    }
  }

  // Add all columns from a group
  const addAllFromGroup = (groupColumns: any[]) => {
    const newColumns = groupColumns.filter(
      (column) => !selectedColumns.some((c) => c.sourceId === column.sourceId && c.path === column.path),
    )

    setSelectedColumns([
      ...selectedColumns,
      ...newColumns.map((column) => ({
        ...column,
        alias: column.path,
      })),
    ])
  }

  // Remove a column from the report
  const removeColumn = (index: number) => {
    const updatedColumns = [...selectedColumns]
    updatedColumns.splice(index, 1)
    setSelectedColumns(updatedColumns)
  }

  // Move a column up in the list
  const moveColumnUp = (index: number) => {
    if (index === 0) return
    const updatedColumns = [...selectedColumns]
    const temp = updatedColumns[index]
    updatedColumns[index] = updatedColumns[index - 1]
    updatedColumns[index - 1] = temp
    setSelectedColumns(updatedColumns)
  }

  // Move a column down in the list
  const moveColumnDown = (index: number) => {
    if (index === selectedColumns.length - 1) return
    const updatedColumns = [...selectedColumns]
    const temp = updatedColumns[index]
    updatedColumns[index] = updatedColumns[index + 1]
    updatedColumns[index + 1] = temp
    setSelectedColumns(updatedColumns)
  }

  // Edit a column
  const editColumn = (index: number) => {
    const column = selectedColumns[index]
    setEditingColumnIndex(index)
    setColumnAlias(column.alias || "")
  }

  // Reset form
  const resetForm = () => {
    setEditingColumnIndex(null)
    setColumnAlias("")
    setColumnOpen(false)
  }

  // Toggle group expansion
  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey)
    } else {
      newExpanded.add(groupKey)
    }
    setExpandedGroups(newExpanded)
  }

  if (selectedDataSources.length === 0) {
    return (
      <div className="text-center py-8 border rounded-md bg-muted/20">
        <p className="text-muted-foreground">No data sources selected</p>
        <p className="text-xs text-muted-foreground mt-1">Add data sources first to select columns</p>
      </div>
    )
  }
  // Helper function to format VAT column names for better readability
  const formatVatColumnName = (columnPath: string): string => {
    if (columnPath.startsWith('section_o_')) {
      const field = columnPath.replace('section_o_', '')
      const fieldMappings: Record<string, string> = {
        'output_vat_13': 'Output VAT (13)',
        'input_vat_14': 'Input VAT (14)',
        'vat_claimable_15': 'VAT Claimable (15)',
        'input_vat_exempt_16': 'Input VAT Exempt (16)',
        'input_vat_mixed_17': 'Input VAT Mixed (17)',
        'non_deductible_18': 'Non-Deductible (18)',
        'deductible_input_19': 'Deductible Input (19)',
        'vat_payable_20': 'VAT Payable (20)',
        'credit_bf_21': 'Credit B/F (21)',
        'vat_withholding_22': 'VAT Withholding (22)',
        'refund_claim_23': 'Refund Claim (23)',
        'total_vat_payable_24': 'Total VAT Payable (24)',
        'vat_paid_25': 'VAT Paid (25)',
        'credit_adjustment_26': 'Credit Adjustment (26)',
        'debit_adjustment_27': 'Debit Adjustment (27)',
        'net_vat_28': 'Net VAT (28)'
      }
      return fieldMappings[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    if (columnPath.startsWith('section_b2_')) {
      const field = columnPath.replace('section_b2_', '')
      const fieldMappings: Record<string, string> = {
        'registered_customers_vat': 'Registered Customers VAT',
        'registered_customers_taxable': 'Registered Customers Taxable',
        'non_registered_customers_vat': 'Non-Registered Customers VAT',
        'non_registered_customers_taxable': 'Non-Registered Customers Taxable',
        'total_vat': 'Total VAT',
        'total_taxable': 'Total Taxable'
      }
      return fieldMappings[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    if (columnPath.startsWith('section_f2_')) {
      const field = columnPath.replace('section_f2_', '')
      const fieldMappings: Record<string, string> = {
        'local_suppliers_vat': 'Local Suppliers VAT',
        'local_suppliers_taxable': 'Local Suppliers Taxable',
        'import_suppliers_vat': 'Import Suppliers VAT',
        'import_suppliers_taxable': 'Import Suppliers Taxable',
        'total_vat': 'Total VAT',
        'total_taxable': 'Total Taxable'
      }
      return fieldMappings[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    if (columnPath.startsWith('section_m_') || columnPath.startsWith('section_n_')) {
      const prefix = columnPath.startsWith('section_m_') ? 'Sales' : 'Purchases'
      const field = columnPath.replace(/section_[mn]_/, '')

      if (field.startsWith('rate_')) {
        const ratePart = field.match(/rate_(\d+(?:\.\d+)?)_(.+)/)
        if (ratePart) {
          const [, rate, type] = ratePart
          return `${prefix} Rate ${rate}% ${type === 'amount' ? 'Amount' : 'VAT'}`
        }
      }

      if (field === 'total_amount') return `${prefix} Total Amount`
      if (field === 'total_vat') return `${prefix} Total VAT`

      return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    return columnPath.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Add quick selection buttons for common VAT analysis
  const renderVatQuickSelections = () => {
    const quickSelections = [
      {
        name: "Key Tax Metrics",
        description: "Essential tax calculation fields",
        columns: [
          'section_o_output_vat_13',
          'section_o_input_vat_14',
          'section_o_net_vat_28',
          'section_b2_total_vat',
          'section_f2_total_vat'
        ]
      },
      {
        name: "Sales Analysis",
        description: "Complete sales breakdown",
        columns: [
          'section_b2_registered_customers_vat',
          'section_b2_registered_customers_taxable',
          'section_b2_non_registered_customers_vat',
          'section_b2_non_registered_customers_taxable',
          'section_b2_total_vat',
          'section_b2_total_taxable'
        ]
      },
      {
        name: "Purchase Analysis",
        description: "Complete purchase breakdown",
        columns: [
          'section_f2_local_suppliers_vat',
          'section_f2_local_suppliers_taxable',
          'section_f2_import_suppliers_vat',
          'section_f2_import_suppliers_taxable',
          'section_f2_total_vat',
          'section_f2_total_taxable'
        ]
      },
      {
        name: "Full Tax Calculation",
        description: "All Section O tax fields",
        columns: SECTION_O_FIELDS.map(field => `section_o_${field.key}`)
      }
    ]

    return (
      <div className="space-y-2 mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
        <Label className="text-sm font-medium text-blue-800">Quick VAT Analysis Selections</Label>
        <div className="grid grid-cols-2 gap-2">
          {quickSelections.map((selection) => (
            <Button
              key={selection.name}
              variant="outline"
              size="sm"
              onClick={() => {
                // Add all columns from this quick selection
                const columnsToAdd = availableColumns.filter(col =>
                  selection.columns.some(quickCol => col.path.includes(quickCol))
                )
                columnsToAdd.forEach(col => addColumn(col))
              }}
              className="h-auto p-2 flex flex-col items-start"
            >
              <span className="text-xs font-medium">{selection.name}</span>
              <span className="text-xs text-muted-foreground">{selection.description}</span>
            </Button>
          ))}
        </div>
      </div>
    )
  }


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Available Columns</Label>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-8 w-48"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {availableColumns.length} available
          </Badge>
        </div>
      </div>

      {/* Available Columns Browser */}
      <ScrollArea className="h-[300px] border rounded-md">
        <div className="p-3 space-y-2">
          {Object.entries(enhancedGroupedColumns).map(([sourceId, data]: [string, any]) => (
            <div key={sourceId} className="border rounded-lg">
              <div className="p-2 bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{data.source.alias}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {data.regular.length + Object.values(data.nested).flat().length +
                        Object.values(data.vatSections).reduce((sum: number, section: any) =>
                          sum + Object.values(section.categories).flat().length, 0)} columns
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addAllFromGroup([
                      ...data.regular,
                      ...Object.values(data.nested).flat(),
                      ...Object.values(data.vatSections).reduce((all: any[], section: any) =>
                        [...all, ...Object.values(section.categories).flat()], [])
                    ])}
                    className="h-6 text-xs"
                  >
                    Add All
                  </Button>
                </div>
              </div>

              <div className="p-2 space-y-2">
                {/* Regular Columns */}
                {data.regular.length > 0 && (
                  <RegularColumnsSection
                    columns={data.regular}
                    sourceId={sourceId}
                    onAddAll={addAllFromGroup}
                    onAddColumn={addColumn}
                    selectedColumns={selectedColumns}
                  />
                )}

                {/* VAT Sections */}
                {Object.entries(data.vatSections).map(([sectionKey, sectionData]: [string, any]) => (
                  <Collapsible key={sectionKey}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-3 w-3" />
                        <span className="text-sm font-medium">{sectionData.sectionName}</span>
                        {sectionData.isOptimized && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            Optimized
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {Object.values(sectionData.categories).flat().length} fields
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            addAllFromGroup(Object.values(sectionData.categories).flat())
                          }}
                          className="h-5 text-xs"
                        >
                          Add All
                        </Button>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1">
                      <div className="ml-4 space-y-2">
                        {Object.entries(sectionData.categories).map(([categoryKey, categoryColumns]: [string, any]) => (
                          <div key={categoryKey} className="border-l-2 border-blue-200 pl-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-blue-800 capitalize">
                                {categoryKey.replace(/_/g, ' ')}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => addAllFromGroup(categoryColumns)}
                                className="h-4 text-xs"
                              >
                                Add {categoryColumns.length}
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 gap-1">
                              {categoryColumns.map((column: any) => {
                                const isSelected = selectedColumns.some(
                                  (c) => c.sourceId === column.sourceId && c.path === column.path,
                                )
                                const displayName = formatVatColumnName(column.path)

                                return (
                                  <div
                                    key={column.path}
                                    className={cn(
                                      "flex items-center justify-between p-1 rounded cursor-pointer hover:bg-blue-50",
                                      isSelected && "bg-blue-100",
                                      column.vatInfo?.importance === 'high' && "border-l-2 border-green-400"
                                    )}
                                    onClick={() => addColumn(column)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Check
                                        className={cn("h-3 w-3", isSelected ? "opacity-100 text-blue-600" : "opacity-0")}
                                      />
                                      <span className="text-sm truncate">{displayName}</span>
                                      {column.vatInfo?.importance === 'high' && (
                                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                          Key
                                        </Badge>
                                      )}
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      {column.type}
                                    </Badge>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}

                {/* Regular Nested Columns (non-VAT sections) */}
                {Object.entries(data.nested).map(([field, columns]: [string, any]) => (
                  <Collapsible key={field}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-1 rounded hover:bg-muted">
                      <div className="flex items-center gap-2">
                        <ChevronsUpDown className="h-3 w-3" />
                        <span className="text-sm font-medium">{field}</span>
                        <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                          {columns.length} detailed
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          addAllFromGroup(columns)
                        }}
                        className="h-5 text-xs"
                      >
                        Add All
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1">
                      <div className="grid grid-cols-1 gap-1 ml-4">
                        {columns.map((column: any) => {
                          const isSelected = selectedColumns.some(
                            (c) => c.sourceId === column.sourceId && c.path === column.path,
                          )
                          return (
                            <div
                              key={column.path}
                              className={cn(
                                "flex items-center justify-between p-1 rounded cursor-pointer hover:bg-purple-50",
                                isSelected && "bg-purple-100",
                              )}
                              onClick={() => addColumn(column)}
                            >
                              <div className="flex items-center gap-2">
                                <Check
                                  className={cn("h-3 w-3", isSelected ? "opacity-100 text-purple-600" : "opacity-0")}
                                />
                                <span className="text-sm truncate">{column.path.replace(`${field}.`, "")}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {column.type}
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Selected Columns */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Selected Columns ({selectedColumns.length})</Label>
          {selectedColumns.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setSelectedColumns([])} className="h-6 text-xs">
              Clear All
            </Button>
          )}
        </div>

        {selectedColumns.length === 0 ? (
          <div className="text-center py-6 border rounded-md bg-muted/20">
            <p className="text-muted-foreground">No columns selected</p>
            <p className="text-xs text-muted-foreground mt-1">Click on columns above to add them to your report</p>
          </div>
        ) : (
          <ScrollArea className="h-[200px] border rounded-md">
            <div className="p-3 space-y-1">
              {selectedColumns.map((column, index) => (
                <div
                  key={`${column.sourceId}-${column.path}-${index}`}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md",
                    editingColumnIndex === index ? "bg-blue-50 border border-blue-200" : "hover:bg-muted",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {index + 1}
                      </Badge>
                      <div className="truncate">
                        <p className="font-medium truncate text-sm">{column.alias || column.path}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {column.sourceName} • {column.type}
                          {column.category === "nested" && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              nested
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => editColumn(index)} className="h-6 w-6 p-0">
                      <ChevronsUpDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveColumnUp(index)}
                      disabled={index === 0}
                      className="h-6 w-6 p-0"
                    >
                      <MoveUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveColumnDown(index)}
                      disabled={index === selectedColumns.length - 1}
                      className="h-6 w-6 p-0"
                    >
                      <MoveDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeColumn(index)} className="h-6 w-6 p-0">
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Edit Column Dialog */}
      {editingColumnIndex !== null && (
        <div className="space-y-3 p-3 border rounded-md bg-blue-50">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Edit Column Alias</Label>
            <Button variant="ghost" size="sm" onClick={resetForm} className="h-6 text-xs">
              Cancel
            </Button>
          </div>
          <div className="space-y-2">
            <Input
              value={columnAlias}
              onChange={(e) => setColumnAlias(e.target.value)}
              placeholder="Custom column name"
              className="h-8"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              onClick={() => {
                const column = selectedColumns[editingColumnIndex]
                addColumn(column)
              }}
              className="h-7"
            >
              Update Column
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
