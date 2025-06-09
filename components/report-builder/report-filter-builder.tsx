"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Settings, Filter } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ReportFilterBuilderProps {
  availableTables: any[]
  selectedDataSources: any[]
  selectedColumns: any[]
  filters: any[]
  setFilters: (filters: any[]) => void
}

export function ReportFilterBuilder({
  availableTables,
  selectedDataSources,
  selectedColumns,
  filters,
  setFilters,
}: ReportFilterBuilderProps) {
  const [isAddingFilter, setIsAddingFilter] = useState(false)
  const [filterColumn, setFilterColumn] = useState("")
  const [filterOperator, setFilterOperator] = useState<string>("equals")
  const [filterValue, setFilterValue] = useState("")
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null)

  // Get column type
  const getColumnType = (columnPath: string) => {
    const column = selectedColumns.find((c) => c.path === columnPath)
    if (!column) return "string"

    return column.type || "string"
  }

  // Get available operators based on column type
  const getAvailableOperators = (columnPath: string) => {
    const type = getColumnType(columnPath)

    const operators = [
      { value: "equals", label: "Equals" },
      { value: "not_equals", label: "Not Equals" },
      { value: "contains", label: "Contains" },
      { value: "not_contains", label: "Not Contains" },
      { value: "starts_with", label: "Starts With" },
      { value: "ends_with", label: "Ends With" },
      { value: "is_empty", label: "Is Empty" },
      { value: "is_not_empty", label: "Is Not Empty" },
    ]

    if (type === "number") {
      return [
        ...operators,
        { value: "greater_than", label: "Greater Than" },
        { value: "less_than", label: "Less Than" },
        { value: "greater_than_equals", label: "Greater Than or Equal" },
        { value: "less_than_equals", label: "Less Than or Equal" },
      ]
    }

    if (type === "date" || type === "datetime") {
      return [
        ...operators,
        { value: "before", label: "Before" },
        { value: "after", label: "After" },
        { value: "between", label: "Between" },
      ]
    }

    return operators
  }

  // Add a filter
  const addFilter = () => {
    if (!filterColumn) return

    const newFilter = {
      id: editingFilterId || `filter_${Date.now()}`,
      column: filterColumn,
      operator: filterOperator,
      value: filterValue,
    }

    if (editingFilterId) {
      // Update existing filter
      setFilters(filters.map((f) => (f.id === editingFilterId ? newFilter : f)))
    } else {
      // Add new filter
      setFilters([...filters, newFilter])
    }

    resetForm()
  }

  // Remove a filter
  const removeFilter = (filterId: string) => {
    setFilters(filters.filter((f) => f.id !== filterId))
  }

  // Edit a filter
  const editFilter = (filter: any) => {
    setEditingFilterId(filter.id)
    setFilterColumn(filter.column)
    setFilterOperator(filter.operator)
    setFilterValue(filter.value)
    setIsAddingFilter(true)
  }

  // Reset form
  const resetForm = () => {
    setIsAddingFilter(false)
    setFilterColumn("")
    setFilterOperator("equals")
    setFilterValue("")
    setEditingFilterId(null)
  }

  // Get operator display name
  const getOperatorDisplay = (operator: string) => {
    const operatorObj = getAvailableOperators("").find((op) => op.value === operator)
    return operatorObj ? operatorObj.label : operator
  }

  // Get column display name
  const getColumnDisplay = (columnPath: string) => {
    const column = selectedColumns.find((c) => c.path === columnPath)
    if (!column) return columnPath

    return column.alias || column.path
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Filters ({filters.length})</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddingFilter(true)}
          disabled={selectedColumns.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Filter
        </Button>
      </div>

      {selectedColumns.length === 0 ? (
        <div className="text-center py-8 border rounded-md bg-muted/20">
          <p className="text-muted-foreground">Add columns before creating filters</p>
        </div>
      ) : filters.length === 0 ? (
        <div className="text-center py-8 border rounded-md bg-muted/20">
          <p className="text-muted-foreground">No filters defined</p>
          <p className="text-xs text-muted-foreground mt-1">Add filters to limit the data in your report</p>
        </div>
      ) : (
        <ScrollArea className="h-[300px] border rounded-md">
          <div className="p-4 space-y-2">
            {filters.map((filter) => (
              <div key={filter.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                <div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{getColumnDisplay(filter.column)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm mt-1">
                    <Badge variant="outline" className="bg-blue-50 text-blue-800">
                      {getOperatorDisplay(filter.operator)}
                    </Badge>
                    {filter.operator !== "is_empty" && filter.operator !== "is_not_empty" && (
                      <span className="text-muted-foreground ml-1">{filter.value || "(empty)"}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => editFilter(filter)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeFilter(filter.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={isAddingFilter} onOpenChange={setIsAddingFilter}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFilterId ? "Edit Filter" : "Add Filter"}</DialogTitle>
            <DialogDescription>Define a filter to limit the data in your report</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filter-column">Column</Label>
              <Select value={filterColumn} onValueChange={setFilterColumn}>
                <SelectTrigger id="filter-column">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {selectedColumns.map((column) => (
                    <SelectItem key={column.path} value={column.path}>
                      {column.alias || column.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filterColumn && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="filter-operator">Operator</Label>
                  <Select value={filterOperator} onValueChange={setFilterOperator}>
                    <SelectTrigger id="filter-operator">
                      <SelectValue placeholder="Select operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableOperators(filterColumn).map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {filterOperator !== "is_empty" && filterOperator !== "is_not_empty" && (
                  <div className="space-y-2">
                    <Label htmlFor="filter-value">Value</Label>
                    <Input
                      id="filter-value"
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      placeholder="Filter value"
                      type={getColumnType(filterColumn) === "number" ? "number" : "text"}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              onClick={addFilter}
              disabled={
                !filterColumn || (!filterValue && filterOperator !== "is_empty" && filterOperator !== "is_not_empty")
              }
            >
              {editingFilterId ? "Update Filter" : "Add Filter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
