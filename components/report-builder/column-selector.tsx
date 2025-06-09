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

  // Filter columns based on search term
  const filteredColumns = availableColumns.filter(
    (col) =>
      col.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      col.path.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Group columns by source and category
  const groupedColumns = selectedDataSources.reduce((acc: any, source) => {
    const sourceColumns = filteredColumns.filter((col) => col.sourceId === source.id)

    if (sourceColumns.length === 0) return acc

    acc[source.id] = {
      source,
      regular: sourceColumns.filter((col) => col.category === "regular"),
      nested: {},
    }

    // Group nested columns by field
    sourceColumns
      .filter((col) => col.category === "nested")
      .forEach((col) => {
        if (!acc[source.id].nested[col.nestedField]) {
          acc[source.id].nested[col.nestedField] = []
        }
        acc[source.id].nested[col.nestedField].push(col)
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
          {Object.entries(groupedColumns).map(([sourceId, data]: [string, any]) => (
            <div key={sourceId} className="border rounded-lg">
              <div className="p-2 bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{data.source.alias}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {data.regular.length + Object.values(data.nested).flat().length} columns
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addAllFromGroup([...data.regular, ...Object.values(data.nested).flat()])}
                    className="h-6 text-xs"
                  >
                    Add All
                  </Button>
                </div>
              </div>

              <div className="p-2 space-y-2">
                {/* Regular Columns */}
                {data.regular.length > 0 && (
                  <Collapsible
                    open={expandedGroups.has(`${sourceId}-regular`)}
                    onOpenChange={() => toggleGroup(`${sourceId}-regular`)}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-1 rounded hover:bg-muted">
                      <div className="flex items-center gap-2">
                        <ChevronsUpDown className="h-3 w-3" />
                        <span className="text-sm font-medium">Regular Columns</span>
                        <Badge variant="secondary" className="text-xs">
                          {data.regular.length}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          addAllFromGroup(data.regular)
                        }}
                        className="h-5 text-xs"
                      >
                        Add All
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1">
                      <div className="grid grid-cols-1 gap-1 ml-4">
                        {data.regular.map((column: any) => {
                          const isSelected = selectedColumns.some(
                            (c) => c.sourceId === column.sourceId && c.path === column.path,
                          )
                          return (
                            <div
                              key={column.path}
                              className={cn(
                                "flex items-center justify-between p-1 rounded cursor-pointer hover:bg-blue-50",
                                isSelected && "bg-blue-100",
                              )}
                              onClick={() => addColumn(column)}
                            >
                              <div className="flex items-center gap-2">
                                <Check
                                  className={cn("h-3 w-3", isSelected ? "opacity-100 text-blue-600" : "opacity-0")}
                                />
                                <span className="text-sm truncate">{column.path}</span>
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
                )}

                {/* Nested Columns */}
                {Object.entries(data.nested).map(([field, columns]: [string, any]) => (
                  <Collapsible
                    key={field}
                    open={expandedGroups.has(`${sourceId}-${field}`)}
                    onOpenChange={() => toggleGroup(`${sourceId}-${field}`)}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-1 rounded hover:bg-muted">
                      <div className="flex items-center gap-2">
                        <ChevronsUpDown className="h-3 w-3" />
                        <span className="text-sm font-medium">{field}</span>
                        <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                          {columns.length} nested
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
