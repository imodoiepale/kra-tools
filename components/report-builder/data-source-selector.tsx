// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Settings, Database, ChevronDown, ChevronRight, Eye, Building2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { getCompanies } from "@/lib/data-viewer/data-fetchers"

interface DataSourceSelectorProps {
  availableTables: any[]
  selectedDataSources: any[]
  setSelectedDataSources: (sources: any[]) => void
  onSourceChange?: () => void
}

export function DataSourceSelector({
  availableTables,
  selectedDataSources,
  setSelectedDataSources,
  onSourceChange,
}: DataSourceSelectorProps) {
  const [isAddingSource, setIsAddingSource] = useState(false)
  const [selectedTableId, setSelectedTableId] = useState("")
  const [sourceAlias, setSourceAlias] = useState("")
  const [selectedNestedFields, setSelectedNestedFields] = useState<string[]>([])
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null)
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const [previewData, setPreviewData] = useState<any>(null)

  // Company filtering
  const [availableCompanies, setAvailableCompanies] = useState<any[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [companyFilterMode, setCompanyFilterMode] = useState<"all" | "selected">("all")
  const [loadingCompanies, setLoadingCompanies] = useState(false)

  // Load companies when dialog opens
  useEffect(() => {
    if (isAddingSource && availableCompanies.length === 0) {
      loadCompanies()
    }
  }, [isAddingSource])

  const loadCompanies = async () => {
    setLoadingCompanies(true)
    try {
      const companies = await getCompanies()
      setAvailableCompanies(companies)
    } catch (error) {
      console.error("Error loading companies:", error)
    } finally {
      setLoadingCompanies(false)
    }
  }

  // Get detailed schema including nested fields
  const getDetailedSchema = (tableId: string, flattenFields: string[] = []) => {
    const tableConfig = availableTables.find((t) => t.id === tableId)
    if (!tableConfig) return { regular: {}, nested: {} }

    const regular = { ...tableConfig.schema }
    const nested: Record<string, any> = {}

    // Analyze nested fields
    if (flattenFields.length > 0 && tableConfig.sample && tableConfig.sample.length > 0) {
      flattenFields.forEach((field) => {
        const sampleData = tableConfig.sample.find((s: any) => s[field])
        if (sampleData && sampleData[field]) {
          const fieldData = sampleData[field]

          if (fieldData.data && Array.isArray(fieldData.data) && fieldData.data.length > 0) {
            // Section data format (like section_m, section_n)
            const firstItem = fieldData.data[0]
            nested[field] = {
              type: "section_data",
              status: fieldData.status || "unknown",
              columns: Object.keys(firstItem).reduce((acc: any, key) => {
                acc[`${field}.${key}`] = typeof firstItem[key]
                return acc
              }, {}),
              sampleData: fieldData.data.slice(0, 3), // First 3 items for preview
            }
          } else if (Array.isArray(fieldData)) {
            // Direct array format
            if (fieldData.length > 0 && typeof fieldData[0] === "object") {
              const firstItem = fieldData[0]
              nested[field] = {
                type: "array_data",
                columns: Object.keys(firstItem).reduce((acc: any, key) => {
                  acc[`${field}.${key}`] = typeof firstItem[key]
                  return acc
                }, {}),
                sampleData: fieldData.slice(0, 3),
              }
            }
          }
        }
      })
    }

    return { regular, nested }
  }

  // Add a data source
  const addDataSource = () => {
    if (!selectedTableId) return

    const tableConfig = availableTables.find((t) => t.id === selectedTableId)
    if (!tableConfig) return

    const newSource = {
      id: editingSourceId || `source_${Date.now()}`,
      tableId: selectedTableId,
      alias: sourceAlias || tableConfig.name,
      flattenFields: selectedNestedFields,
      schema: getDetailedSchema(selectedTableId, selectedNestedFields),
      companyFilter: {
        mode: companyFilterMode,
        companies: companyFilterMode === "selected" ? selectedCompanies : [],
      },
    }

    if (editingSourceId) {
      // Update existing source
      setSelectedDataSources(selectedDataSources.map((s) => (s.id === editingSourceId ? newSource : s)))
    } else {
      // Add new source
      setSelectedDataSources([...selectedDataSources, newSource])
    }

    resetForm()
    onSourceChange?.()
  }

  // Remove a data source
  const removeDataSource = (sourceId: string) => {
    setSelectedDataSources(selectedDataSources.filter((s) => s.id !== sourceId))
    onSourceChange?.()
  }

  // Edit a data source
  const editDataSource = (source: any) => {
    setEditingSourceId(source.id)
    setSelectedTableId(source.tableId)
    setSourceAlias(source.alias)
    setSelectedNestedFields(source.flattenFields || [])
    setCompanyFilterMode(source.companyFilter?.mode || "all")
    setSelectedCompanies(source.companyFilter?.companies || [])
    setIsAddingSource(true)
  }

  // Reset form
  const resetForm = () => {
    setIsAddingSource(false)
    setSelectedTableId("")
    setSourceAlias("")
    setSelectedNestedFields([])
    setEditingSourceId(null)
    setPreviewData(null)
    setCompanyFilterMode("all")
    setSelectedCompanies([])
  }

  // Toggle nested field selection
  const toggleNestedField = (field: string) => {
    if (selectedNestedFields.includes(field)) {
      setSelectedNestedFields(selectedNestedFields.filter((f) => f !== field))
    } else {
      setSelectedNestedFields([...selectedNestedFields, field])
    }
  }

  // Toggle company selection
  const toggleCompany = (companyId: string) => {
    if (selectedCompanies.includes(companyId)) {
      setSelectedCompanies(selectedCompanies.filter((id) => id !== companyId))
    } else {
      setSelectedCompanies([...selectedCompanies, companyId])
    }
  }

  // Select all companies
  const selectAllCompanies = () => {
    setSelectedCompanies(availableCompanies.map((c) => c.id))
  }

  // Clear company selection
  const clearCompanySelection = () => {
    setSelectedCompanies([])
  }

  // Get nested fields for the selected table
  const getNestedFields = () => {
    if (!selectedTableId) return []

    const tableConfig = availableTables.find((t) => t.id === selectedTableId)
    if (!tableConfig || !tableConfig.nestedFields) return []

    return tableConfig.nestedFields
  }

  // Preview nested field data
  const previewNestedField = (field: string) => {
    const tableConfig = availableTables.find((t) => t.id === selectedTableId)
    if (!tableConfig || !tableConfig.sample) return

    const sampleData = tableConfig.sample.find((s: any) => s[field])
    if (sampleData && sampleData[field]) {
      setPreviewData({
        field,
        data: sampleData[field],
        type: Array.isArray(sampleData[field]) ? "array" : "object",
      })
    }
  }

  // Toggle source expansion
  const toggleSourceExpansion = (sourceId: string) => {
    const newExpanded = new Set(expandedSources)
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId)
    } else {
      newExpanded.add(sourceId)
    }
    setExpandedSources(newExpanded)
  }

  // Get column count for a source
  const getColumnCount = (source: any) => {
    let count = Object.keys(source.schema?.regular || {}).length
    if (source.schema?.nested) {
      Object.values(source.schema.nested).forEach((nested: any) => {
        count += Object.keys(nested.columns || {}).length
      })
    }
    return count
  }

  // Get company filter display
  const getCompanyFilterDisplay = (source: any) => {
    if (!source.companyFilter || source.companyFilter.mode === "all") {
      return "All companies"
    }
    return `${source.companyFilter.companies.length} selected companies`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Data Sources ({selectedDataSources.length})</Label>
        <Button variant="outline" size="sm" onClick={() => setIsAddingSource(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Source
        </Button>
      </div>

      {selectedDataSources.length === 0 ? (
        <div className="text-center py-8 border rounded-md bg-muted/20">
          <p className="text-muted-foreground">No data sources selected</p>
          <p className="text-xs text-muted-foreground mt-1">Add data sources to include in your report</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px] border rounded-md">
          <div className="p-4 space-y-2">
            {selectedDataSources.map((source) => {
              const tableConfig = availableTables.find((t) => t.id === source.tableId)
              const isExpanded = expandedSources.has(source.id)
              const columnCount = getColumnCount(source)

              return (
                <div key={source.id} className="border rounded-lg">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSourceExpansion(source.id)}
                        className="h-6 w-6 p-0"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                      <Database className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="font-medium">{source.alias}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{tableConfig?.name || "Unknown"}</span>
                          <Badge variant="outline" className="text-xs">
                            {columnCount} columns
                          </Badge>
                          {source.flattenFields && source.flattenFields.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {source.flattenFields.length} nested fields
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            <Building2 className="h-3 w-3 mr-1" />
                            {getCompanyFilterDisplay(source)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => editDataSource(source)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeDataSource(source.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t p-3 bg-muted/20">
                      <div className="space-y-3">
                        {/* Company Filter Info */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">Company Filter</h4>
                          <div className="p-2 bg-blue-50 rounded text-sm">
                            {source.companyFilter?.mode === "all" ? (
                              <span className="text-blue-800">Including all companies</span>
                            ) : (
                              <span className="text-blue-800">
                                Filtered to {source.companyFilter?.companies.length || 0} specific companies
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Regular Columns */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">Regular Columns</h4>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {Object.entries(source.schema?.regular || {}).map(([key, type]) => (
                              <div key={key} className="flex items-center justify-between p-1 rounded bg-white">
                                <span className="truncate">{key}</span>
                                <Badge variant="outline" className="text-xs">
                                  {type as string}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Nested Columns */}
                        {source.schema?.nested && Object.keys(source.schema.nested).length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Nested Columns</h4>
                            {Object.entries(source.schema.nested).map(([field, nested]: [string, any]) => (
                              <Collapsible key={field}>
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded bg-blue-50 hover:bg-blue-100">
                                  <div className="flex items-center gap-2">
                                    <ChevronRight className="h-3 w-3" />
                                    <span className="text-sm font-medium">{field}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {nested.type}
                                    </Badge>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {Object.keys(nested.columns || {}).length} fields
                                  </Badge>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1">
                                  <div className="grid grid-cols-1 gap-1 text-xs ml-4">
                                    {Object.entries(nested.columns || {}).map(([key, type]) => (
                                      <div key={key} className="flex items-center justify-between p-1 rounded bg-white">
                                        <span className="truncate">{key}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {type as string}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                  {nested.sampleData && (
                                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                      <p className="font-medium mb-1">Sample Data:</p>
                                      <pre className="whitespace-pre-wrap overflow-auto max-h-20">
                                        {JSON.stringify(nested.sampleData[0], null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </CollapsibleContent>
                              </Collapsible>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}

      <Dialog open={isAddingSource} onOpenChange={setIsAddingSource}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSourceId ? "Edit Data Source" : "Add Data Source"}</DialogTitle>
            <DialogDescription>
              {editingSourceId
                ? "Update the configuration for this data source"
                : "Select a data source to include in your report"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="table-select">Select Table</Label>
              <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                <SelectTrigger id="table-select">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{table.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {Object.keys(table.schema).length} columns
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTableId && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="source-alias">Source Alias (Optional)</Label>
                  <Input
                    id="source-alias"
                    value={sourceAlias}
                    onChange={(e) => setSourceAlias(e.target.value)}
                    placeholder="Custom name for this data source"
                  />
                </div>

                {/* Company Filter Section */}
                <div className="space-y-4 border rounded-lg p-4 bg-blue-50/50">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <Label className="text-base font-medium">Company Filter</Label>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="all-companies"
                          name="company-filter"
                          checked={companyFilterMode === "all"}
                          onChange={() => setCompanyFilterMode("all")}
                        />
                        <Label htmlFor="all-companies">Include all companies</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="selected-companies"
                          name="company-filter"
                          checked={companyFilterMode === "selected"}
                          onChange={() => setCompanyFilterMode("selected")}
                        />
                        <Label htmlFor="selected-companies">Select specific companies</Label>
                      </div>
                    </div>

                    {companyFilterMode === "selected" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Select Companies ({selectedCompanies.length} selected)</Label>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={selectAllCompanies}>
                              Select All
                            </Button>
                            <Button variant="outline" size="sm" onClick={clearCompanySelection}>
                              Clear All
                            </Button>
                          </div>
                        </div>

                        {loadingCompanies ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="text-sm text-muted-foreground mt-2">Loading companies...</p>
                          </div>
                        ) : (
                          <ScrollArea className="h-[200px] border rounded-md p-3 bg-white">
                            <div className="space-y-2">
                              {availableCompanies.map((company) => (
                                <div key={company.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`company-${company.id}`}
                                    checked={selectedCompanies.includes(company.id)}
                                    onCheckedChange={() => toggleCompany(company.id)}
                                  />
                                  <Label htmlFor={`company-${company.id}`} className="text-sm cursor-pointer flex-1">
                                    <div>
                                      <p className="font-medium">{company.company_name}</p>
                                      <p className="text-xs text-muted-foreground">PIN: {company.pin}</p>
                                    </div>
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Show table schema preview */}
                <div className="space-y-2">
                  <Label>Available Columns Preview</Label>
                  <div className="border rounded-md p-3 bg-muted/20">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(availableTables.find((t) => t.id === selectedTableId)?.schema || {}).map(
                        ([key, type]) => (
                          <div key={key} className="flex items-center justify-between p-1 rounded bg-white">
                            <span className="truncate">{key}</span>
                            <Badge variant="outline" className="text-xs">
                              {type as string}
                            </Badge>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>

                {getNestedFields().length > 0 && (
                  <div className="space-y-2">
                    <Label>Flatten Nested Fields (Optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Select VAT sections to include. Optimized sections (O, B2, F2, M, N) show one month per row.
                    </p>
                    <ScrollArea className="h-[250px] border rounded-md p-2">
                      <div className="space-y-3">
                        {getNestedFields().map((field) => {
                          const isOptimized = ['section_o', 'section_b2', 'section_f2', 'section_m', 'section_n'].includes(field)
                          const tableConfig = availableTables.find((t) => t.id === selectedTableId)
                          const description = tableConfig?.sectionDescriptions?.[field] || ""

                          return (
                            <div key={field} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`field-${field}`}
                                    checked={selectedNestedFields.includes(field)}
                                    onCheckedChange={() => toggleNestedField(field)}
                                  />
                                  <Label htmlFor={`field-${field}`} className="text-sm cursor-pointer font-medium flex items-center gap-2">
                                    {field.replace('_', ' ').toUpperCase()}
                                    {isOptimized && (
                                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                                        Optimized
                                      </Badge>
                                    )}
                                  </Label>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => previewNestedField(field)}
                                  className="h-6 px-2"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </div>

                              {description && (
                                <div className="ml-6 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                  {description}
                                </div>
                              )}

                              {selectedNestedFields.includes(field) && (
                                <div className="ml-6 p-2 bg-blue-50 rounded text-xs">
                                  <p className="font-medium text-blue-800 mb-1">
                                    {isOptimized ? "Will create monthly columns:" : "Will create detailed columns:"}
                                  </p>
                                  <div className="space-y-1">
                                    {(() => {
                                      if (isOptimized) {
                                        switch (field) {
                                          case 'section_o':
                                            return (
                                              <div className="grid grid-cols-2 gap-1">
                                                <div className="text-blue-700">• output_vat_13</div>
                                                <div className="text-blue-700">• input_vat_14</div>
                                                <div className="text-blue-700">• vat_claimable_15</div>
                                                <div className="text-blue-700">• net_vat_28</div>
                                                <div className="text-blue-700 col-span-2">... and 12 more tax fields</div>
                                              </div>
                                            )
                                          case 'section_b2':
                                            return (
                                              <div className="grid grid-cols-2 gap-1">
                                                <div className="text-blue-700">• registered_customers_vat</div>
                                                <div className="text-blue-700">• registered_customers_taxable</div>
                                                <div className="text-blue-700">• non_registered_customers_vat</div>
                                                <div className="text-blue-700">• total_vat</div>
                                              </div>
                                            )
                                          case 'section_f2':
                                            return (
                                              <div className="grid grid-cols-2 gap-1">
                                                <div className="text-blue-700">• local_suppliers_vat</div>
                                                <div className="text-blue-700">• local_suppliers_taxable</div>
                                                <div className="text-blue-700">• import_suppliers_vat</div>
                                                <div className="text-blue-700">• total_vat</div>
                                              </div>
                                            )
                                          case 'section_m':
                                            return (
                                              <div className="grid grid-cols-2 gap-1">
                                                <div className="text-blue-700">• rate_16_amount</div>
                                                <div className="text-blue-700">• rate_16_vat</div>
                                                <div className="text-blue-700">• total_amount</div>
                                                <div className="text-blue-700">• total_vat</div>
                                              </div>
                                            )
                                          case 'section_n':
                                            return (
                                              <div className="grid grid-cols-2 gap-1">
                                                <div className="text-blue-700">• rate_16_amount</div>
                                                <div className="text-blue-700">• rate_16_vat</div>
                                                <div className="text-blue-700">• total_amount</div>
                                                <div className="text-blue-700">• total_vat</div>
                                              </div>
                                            )
                                          default:
                                            return <div className="text-blue-700">• {field}.*</div>
                                        }
                                      } else {
                                        return <div className="text-blue-700">• {field}.* (detailed transaction data)</div>
                                      }
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Preview nested field data */}
                {previewData && (
                  <div className="space-y-2">
                    <Label>Preview: {previewData.field}</Label>
                    <ScrollArea className="h-[150px] border rounded-md p-3 bg-gray-50">
                      <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(previewData.data, null, 2)}</pre>
                    </ScrollArea>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={addDataSource} disabled={!selectedTableId}>
              {editingSourceId ? "Update Source" : "Add Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
