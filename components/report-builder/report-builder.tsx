// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Save, Trash2, Settings, Table, FileText, RefreshCw, AlertCircle, Zap, Wifi, WifiOff } from "lucide-react"
import { ColumnSelector } from "@/components/report-builder/column-selector"
import { ReportPreview } from "@/components/report-builder/report-preview"
import { DataSourceSelector } from "@/components/report-builder/data-source-selector"
import { JoinConditionBuilder } from "@/components/report-builder/join-condition-builder"
import { ReportFilterBuilder } from "@/components/report-builder/report-filter-builder"
import {
  getCompanies,
  getVatReturnDetailsOptimized,
  getCompanyReturnListingsOptimized,
  getVatSectionData,
} from "@/lib/data-viewer/data-fetchers"
import { ReportExporter } from "@/components/report-builder/report-exporter"
import {
  extractTableSchema,
  mergeDataSources,
  applyFilters,
  flattenNestedData,
} from "@/components/report-builder/report-utils"

export function ReportBuilder() {
  // State for report configuration
  const [reportName, setReportName] = useState("New Custom Report")
  const [reportDescription, setReportDescription] = useState("Custom report created with Report Builder")
  const [selectedDataSources, setSelectedDataSources] = useState<any[]>([])
  const [selectedColumns, setSelectedColumns] = useState<any[]>([])
  const [joinConditions, setJoinConditions] = useState<any[]>([])
  const [filters, setFilters] = useState<any[]>([])
  const [reportData, setReportData] = useState<any[]>([])
  const [availableTables, setAvailableTables] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewMode, setPreviewMode] = useState<"table" | "json">("table")
  const [activeTab, setActiveTab] = useState("sources")
  const [savedReports, setSavedReports] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [performanceMode, setPerformanceMode] = useState<"fast" | "full">("fast")
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("checking")

  // Test database connection
  const testConnection = async () => {
    setConnectionStatus("checking")
    try {
      console.log("Testing database connection...")
      const companies = await getCompanies()
      console.log("Connection test successful, companies loaded:", companies.length)
      setConnectionStatus("connected")
      return true
    } catch (error) {
      console.error("Connection test failed:", error)
      setConnectionStatus("disconnected")
      setError("Database connection failed. Please check your network connection and try again.")
      return false
    }
  }

  // Load available data sources with better error handling
  useEffect(() => {
    async function loadDataSources() {
      setIsLoading(true)
      setError(null)

      try {
        console.log("Loading data sources...")

        // Test connection first
        const isConnected = await testConnection()
        if (!isConnected) {
          // Use mock data if connection fails
          console.log("Using mock data due to connection failure")
          const mockTables = createMockTables()
          setAvailableTables(mockTables)
          setIsLoading(false)
          return
        }

        // Load sample data from each source to extract schema
        const [companies, vatReturns, returnListings] = await Promise.allSettled([
          getCompanies(),
          getVatReturnDetailsOptimized({ limit: 5, includeNestedFields: false }),
          getCompanyReturnListingsOptimized({ limit: 5, includeNestedFields: false }),
        ])

        console.log("Data loading results:", {
          companies: companies.status,
          vatReturns: vatReturns.status,
          returnListings: returnListings.status,
        })

        // Extract successful results
        const companiesData = companies.status === "fulfilled" ? companies.value : []
        const vatReturnsData = vatReturns.status === "fulfilled" ? vatReturns.value : []
        const returnListingsData = returnListings.status === "fulfilled" ? returnListings.value : []

        // For VAT returns, get a sample with nested fields for schema extraction
        let vatReturnsSample = vatReturnsData
        try {
          if (vatReturnsData.length > 0) {
            const sampleWithNested = await getVatReturnDetailsOptimized({
              limit: 2,
              includeNestedFields: true,
            })
            vatReturnsSample = sampleWithNested.length > 0 ? sampleWithNested : vatReturnsData
          }
        } catch (error) {
          console.warn("Failed to load nested sample data, using basic data:", error)
        }

        // Extract schema from each data source
        const tables = [
          {
            id: "companies",
            name: "Companies",
            description: "Company information and details",
            schema: extractTableSchema(companiesData),
            sample: companiesData.slice(0, 5),
            getData: async (companyFilter?: any) => {
              try {
                const allCompanies = await getCompanies()
                if (companyFilter?.mode === "selected" && companyFilter.companies?.length > 0) {
                  return allCompanies.filter((c: any) => companyFilter.companies.includes(c.id))
                }
                return allCompanies
              } catch (error) {
                console.error("Error fetching companies data:", error)
                throw new Error("Failed to fetch companies data")
              }
            },
            keyField: "id",
            isLarge: false,
          },
          {
            id: "vat_returns",
            name: "VAT Returns",
            description: "VAT return details with nested section data (optimized loading)",
            schema: extractTableSchema(vatReturnsSample),
            sample: vatReturnsSample.slice(0, 3),
            getData: async (companyFilter?: any, options?: any) => {
              try {
                const { includeNestedFields = false, limit = 500 } = options || {}

                const companyIds =
                  companyFilter?.mode === "selected" && companyFilter.companies?.length > 0
                    ? companyFilter.companies
                    : undefined

                if (includeNestedFields) {
                  // If nested fields are needed, use the section data fetcher
                  const selectedNestedFields = options?.selectedNestedFields || []
                  if (selectedNestedFields.length > 0) {
                    return await getVatSectionData({
                      companyIds,
                      sectionFields: selectedNestedFields,
                      limit,
                    })
                  }
                }

                return await getVatReturnDetailsOptimized({
                  companyIds,
                  limit,
                  includeNestedFields,
                })
              } catch (error) {
                console.error("Error fetching VAT returns data:", error)
                throw new Error("Failed to fetch VAT returns data")
              }
            },
            keyField: "id",
            isLarge: true,
            nestedFields: [
              "section_b",
              "section_b2",
              "section_e",
              "section_f",
              "section_f2",
              "section_k3",
              "section_m",
              "section_n",
              "section_o",
            ],
          },
          {
            id: "return_listings",
            name: "Return Listings",
            description: "Return listings with nested listing data",
            schema: extractTableSchema(returnListingsData),
            sample: returnListingsData.slice(0, 5),
            getData: async (companyFilter?: any) => {
              try {
                const companyIds =
                  companyFilter?.mode === "selected" && companyFilter.companies?.length > 0
                    ? companyFilter.companies
                    : undefined

                return await getCompanyReturnListingsOptimized({
                  companyIds,
                  limit: 200,
                  includeNestedFields: companyFilter?.includeNestedFields || false,
                })
              } catch (error) {
                console.error("Error fetching return listings data:", error)
                throw new Error("Failed to fetch return listings data")
              }
            },
            keyField: "id",
            isLarge: true,
            nestedFields: ["listing_data"],
          },
        ]

        setAvailableTables(tables)

        // Load saved reports from localStorage
        try {
          const savedReportsStr = localStorage.getItem("vatDashboardReports")
          if (savedReportsStr) {
            setSavedReports(JSON.parse(savedReportsStr))
          }
        } catch (error) {
          console.warn("Failed to load saved reports:", error)
        }

        console.log("Data sources loaded successfully")
      } catch (error) {
        console.error("Error loading data sources:", error)
        setError("Failed to load data sources. Using offline mode with limited functionality.")

        // Fallback to mock data
        const mockTables = createMockTables()
        setAvailableTables(mockTables)
      } finally {
        setIsLoading(false)
      }
    }

    loadDataSources()
  }, [])

  // Create mock tables for offline mode
  const createMockTables = () => {
    return [
      {
        id: "companies",
        name: "Companies (Offline)",
        description: "Company information - offline mode",
        schema: [
          { name: "id", type: "number" },
          { name: "company_name", type: "string" },
          { name: "pin", type: "string" },
        ],
        sample: [
          { id: 1, company_name: "Sample Company 1", pin: "P000000001A" },
          { id: 2, company_name: "Sample Company 2", pin: "P000000002B" },
        ],
        getData: async () => {
          throw new Error("Offline mode - please check your connection")
        },
        keyField: "id",
        isLarge: false,
      },
      {
        id: "vat_returns",
        name: "VAT Returns",
        description: "VAT return details with optimized section data (one month per row)",
        schema: extractTableSchema(vatReturnsSample),
        sample: vatReturnsSample.slice(0, 3),
        getData: async (companyFilter?: any, options?: any) => {
          try {
            const { includeNestedFields = false, limit = 500, monthlyAggregation = true } = options || {}

            const companyIds =
              companyFilter?.mode === "selected" && companyFilter.companies?.length > 0
                ? companyFilter.companies
                : undefined

            if (includeNestedFields) {
              const selectedNestedFields = options?.selectedNestedFields || []
              if (selectedNestedFields.length > 0) {
                // Use optimized VAT section data fetcher
                return await getVatSectionDataOptimized({
                  companyIds,
                  sectionFields: selectedNestedFields,
                  limit,
                  monthlyAggregation
                })
              }
            }

            return await getVatReturnDetailsOptimized({
              companyIds,
              limit,
              includeNestedFields,
            })
          } catch (error) {
            console.error("Error fetching VAT returns data:", error)
            throw new Error("Failed to fetch VAT returns data")
          }
        },
        keyField: "id",
        isLarge: true,
        nestedFields: [
          "section_b",
          "section_b2", // Optimized: Sales Totals (one month per row)
          "section_e",
          "section_f",
          "section_f2", // Optimized: Purchases Totals (one month per row)
          "section_k3",
          "section_m",  // Optimized: Sales Summary by Rate (one month per row)
          "section_n",  // Optimized: Purchases Summary by Rate (one month per row)
          "section_o",  // Optimized: Tax Calculation (one month per row)
        ],
        optimizedSections: [
          "section_o", "section_b2", "section_f2", "section_m", "section_n"
        ],
        sectionDescriptions: {
          "section_o": "Tax Calculation - 16 tax fields (Sr.No. 13-28) as columns",
          "section_b2": "Sales Totals - Registered/Non-Registered/Total with VAT & Taxable columns",
          "section_f2": "Purchases Totals - Local/Import/Total with VAT & Taxable columns",
          "section_m": "Sales Summary - Dynamic rate-based columns with totals",
          "section_n": "Purchases Summary - Dynamic rate-based columns with totals",
          "section_b": "Sales Transactions - Detailed transaction-level data",
          "section_e": "Exempt Sales - Detailed exempt transaction data",
          "section_f": "Purchase Transactions - Detailed transaction-level data",
          "section_k3": "Credit Adjustments - Individual adjustment records"
        }
      }
    ]
  }

  // Generate report data when configuration changes
  const generateReport = async () => {
    if (selectedDataSources.length === 0) {
      setReportData([])
      return
    }

    if (connectionStatus === "disconnected") {
      setError("Cannot generate report - database connection is unavailable")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      console.log("Generating report with:", {
        dataSources: selectedDataSources.length,
        columns: selectedColumns.length,
        joins: joinConditions.length,
        filters: filters.length,
        performanceMode,
      })

      // Fetch data for each selected data source with optimizations
      const dataPromises = selectedDataSources.map(async (source) => {
        const tableConfig = availableTables.find((t) => t.id === source.tableId)
        if (!tableConfig) {
          console.warn(`Table config not found for ${source.tableId}`)
          return []
        }

        console.log(`Fetching data for ${source.tableId} with company filter:`, source.companyFilter)

        try {
          // Prepare options for optimized loading
          const options: any = {
            includeNestedFields: source.flattenFields && source.flattenFields.length > 0,
            selectedNestedFields: source.flattenFields,
            limit: performanceMode === "fast" ? 500 : 2000, // Limit based on performance mode
          }

          const data = await tableConfig.getData(source.companyFilter, options)
          console.log(`Fetched ${data.length} records for ${source.tableId}`)

          // If the source has nested fields that need to be flattened
          if (source.flattenFields && source.flattenFields.length > 0) {
            console.log(`Flattening fields for ${source.tableId}:`, source.flattenFields)

            // Use enhanced VAT section flattening
            const flattened = flattenVatSectionData(data, source.flattenFields, tableConfig.nestedFields || [])
            console.log(`Flattened to ${flattened.length} records`)
            return flattened
          }

          return data
        } catch (error) {
          console.error(`Error fetching data for ${source.tableId}:`, error)
          setError(`Failed to fetch data from ${tableConfig.name}. Please try again.`)
          return []
        }
      })

      const dataSets = await Promise.all(dataPromises)
      console.log(
        "Data sets loaded:",
        dataSets.map((ds) => ds.length),
      )

      // Start with the first dataset
      let mergedData = dataSets[0] || []

      // If we have multiple data sources, merge them
      if (dataSets.length > 1) {
        console.log("Merging data sources...")
        mergedData = mergeDataSources(dataSets, selectedDataSources, joinConditions)
        console.log(`Merged to ${mergedData.length} records`)
      }

      // Apply filters
      if (filters.length > 0) {
        console.log("Applying filters...")
        const filteredData = applyFilters(mergedData, filters)
        console.log(`Filtered to ${filteredData.length} records`)
        mergedData = filteredData
      }

      // If no columns are selected, show all available columns (limited for performance)
      let finalData = mergedData
      if (selectedColumns.length > 0) {
        console.log("Projecting selected columns...")
        // Project only selected columns
        finalData = mergedData.map((row, index) => {
          const newRow: Record<string, any> = {}

          selectedColumns.forEach((col) => {
            let value = row[col.path]

            // Handle nested field access
            if (col.path.includes(".") && value === undefined) {
              const pathParts = col.path.split(".")
              let current = row
              for (const part of pathParts) {
                if (current && typeof current === "object") {
                  current = current[part]
                } else {
                  current = undefined
                  break
                }
              }
              value = current
            }

            const columnKey = col.alias || col.path
            newRow[columnKey] = value
          })

          return newRow
        })
      }

      // Limit final data for preview performance
      const previewLimit = performanceMode === "fast" ? 1000 : 5000
      if (finalData.length > previewLimit) {
        console.log(`Limiting preview to ${previewLimit} records for performance`)
        finalData = finalData.slice(0, previewLimit)
      }

      console.log(`Final report data: ${finalData.length} records`)
      setReportData(finalData)
    } catch (error) {
      console.error("Error generating report:", error)
      setError("Failed to generate report. Please check your configuration and try again.")
      setReportData([])
    } finally {
      setIsGenerating(false)
    }
  }

  // Auto-generate report when configuration changes (with longer debounce for large data)
  useEffect(() => {
    if (connectionStatus === "disconnected") {
      return
    }

    const hasLargeDataSources = selectedDataSources.some((source) => {
      const tableConfig = availableTables.find((t) => t.id === source.tableId)
      return tableConfig?.isLarge && source.flattenFields?.length > 0
    })

    const debounceTime = hasLargeDataSources ? 1500 : 500 // Longer debounce for large data

    const timeoutId = setTimeout(() => {
      generateReport()
    }, debounceTime)

    return () => clearTimeout(timeoutId)
  }, [selectedDataSources, selectedColumns, joinConditions, filters, performanceMode, connectionStatus])

  // Handle data source changes
  const handleDataSourceChange = () => {
    // Clear columns when data sources change
    setSelectedColumns([])
    setJoinConditions([])
    setFilters([])
  }

  // Save report configuration
  const saveReport = () => {
    const report = {
      id: Date.now().toString(),
      name: reportName,
      description: reportDescription,
      dataSources: selectedDataSources,
      columns: selectedColumns,
      joinConditions,
      filters,
      performanceMode,
      createdAt: new Date().toISOString(),
    }

    const updatedReports = [...savedReports, report]
    setSavedReports(updatedReports)
    localStorage.setItem("vatDashboardReports", JSON.stringify(updatedReports))
  }

  // Load a saved report
  const loadReport = (report: any) => {
    setReportName(report.name)
    setReportDescription(report.description)
    setSelectedDataSources(report.dataSources || [])
    setSelectedColumns(report.columns || [])
    setJoinConditions(report.joinConditions || [])
    setFilters(report.filters || [])
    setPerformanceMode(report.performanceMode || "fast")
  }

  // Delete a saved report
  const deleteReport = (reportId: string) => {
    const updatedReports = savedReports.filter((r) => r.id !== reportId)
    setSavedReports(updatedReports)
    localStorage.setItem("vatDashboardReports", JSON.stringify(updatedReports))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading data sources...</p>
          {connectionStatus === "checking" && (
            <p className="mt-1 text-xs text-muted-foreground">Testing database connection...</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                Custom Report Builder
                {connectionStatus === "connected" && <Wifi className="h-5 w-5 text-green-600" />}
                {connectionStatus === "disconnected" && <WifiOff className="h-5 w-5 text-red-600" />}
              </CardTitle>
              <CardDescription>
                Create custom reports by selecting and combining data from multiple sources
                {connectionStatus === "disconnected" && " (Offline Mode)"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Connection Status */}
              <Button variant="outline" size="sm" onClick={testConnection} disabled={connectionStatus === "checking"}>
                {connectionStatus === "checking" ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : connectionStatus === "connected" ? (
                  <Wifi className="mr-2 h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="mr-2 h-4 w-4 text-red-600" />
                )}
                {connectionStatus === "checking" ? "Testing..." : "Test Connection"}
              </Button>

              {/* Performance Mode Toggle */}
              <div className="flex items-center gap-2 mr-4">
                <Label className="text-sm">Performance:</Label>
                <Button
                  variant={performanceMode === "fast" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPerformanceMode("fast")}
                >
                  <Zap className="mr-1 h-3 w-3" />
                  Fast
                </Button>
                <Button
                  variant={performanceMode === "full" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPerformanceMode("full")}
                >
                  Full
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={generateReport}
                disabled={isGenerating || connectionStatus === "disconnected"}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
                {isGenerating ? "Generating..." : "Refresh"}
              </Button>
              <Button variant="outline" size="sm" onClick={saveReport}>
                <Save className="mr-2 h-4 w-4" />
                Save Report
              </Button>
              <ReportExporter data={reportData} reportName={reportName} reportDescription={reportDescription} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-4 md:col-span-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="report-name">Report Name</Label>
                  <Input
                    id="report-name"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="report-description">Description</Label>
                  <Input
                    id="report-description"
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-2">
              <Badge variant="outline" className="text-sm">
                {reportData.length} records
              </Badge>
              <Badge variant="outline" className="text-sm">
                {selectedColumns.length} columns
              </Badge>
              <Badge variant="outline" className="text-sm">
                {selectedDataSources.length} sources
              </Badge>
              <Badge variant={performanceMode === "fast" ? "default" : "secondary"} className="text-sm">
                {performanceMode} mode
              </Badge>
              <Badge variant={connectionStatus === "connected" ? "default" : "destructive"} className="text-sm">
                {connectionStatus}
              </Badge>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          )}

          {connectionStatus === "disconnected" && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-amber-600" />
              <span className="text-amber-800 text-sm">
                Database connection unavailable. Please check your network connection and click "Test Connection" to
                retry.
              </span>
            </div>
          )}

          {performanceMode === "fast" && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-blue-800 text-sm">
                Fast mode: Limited to 500-1000 records for optimal performance. Switch to Full mode for complete data.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Configuration Panel */}
        <div className="md:col-span-5 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Report Configuration</CardTitle>
              <CardDescription>Configure your custom report step by step</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="sources">Sources</TabsTrigger>
                  <TabsTrigger value="columns">Columns</TabsTrigger>
                  <TabsTrigger value="joins">Joins</TabsTrigger>
                  <TabsTrigger value="filters">Filters</TabsTrigger>
                </TabsList>

                <TabsContent value="sources" className="p-4 space-y-4">
                  <DataSourceSelector
                    availableTables={availableTables}
                    selectedDataSources={selectedDataSources}
                    setSelectedDataSources={setSelectedDataSources}
                    onSourceChange={handleDataSourceChange}
                  />
                </TabsContent>

                <TabsContent value="columns" className="p-4 space-y-4">
                  <ColumnSelector
                    availableTables={availableTables}
                    selectedDataSources={selectedDataSources}
                    selectedColumns={selectedColumns}
                    setSelectedColumns={setSelectedColumns}
                  />
                </TabsContent>

                <TabsContent value="joins" className="p-4 space-y-4">
                  <JoinConditionBuilder
                    availableTables={availableTables}
                    selectedDataSources={selectedDataSources}
                    joinConditions={joinConditions}
                    setJoinConditions={setJoinConditions}
                  />
                </TabsContent>

                <TabsContent value="filters" className="p-4 space-y-4">
                  <ReportFilterBuilder
                    availableTables={availableTables}
                    selectedDataSources={selectedDataSources}
                    selectedColumns={selectedColumns}
                    filters={filters}
                    setFilters={setFilters}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Saved Reports</CardTitle>
              <CardDescription>Load or manage your saved reports</CardDescription>
            </CardHeader>
            <CardContent>
              {savedReports.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No saved reports yet</p>
                  <p className="text-sm">Save your current configuration to reuse it later</p>
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {savedReports.map((report) => (
                      <div key={report.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                        <div>
                          <p className="font-medium">{report.name}</p>
                          <p className="text-xs text-muted-foreground">{report.description}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => loadReport(report)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteReport(report.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="md:col-span-7">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Report Preview</CardTitle>
                  <CardDescription>
                    {isGenerating ? "Generating report..." : "Preview of your custom report"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={previewMode === "table" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("table")}
                  >
                    <Table className="mr-2 h-4 w-4" />
                    Table
                  </Button>
                  <Button
                    variant={previewMode === "json" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("json")}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    JSON
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("columns")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Configure
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ReportPreview data={reportData} columns={selectedColumns} isLoading={isGenerating} mode={previewMode} />
            </CardContent>
            <CardFooter className="bg-muted/50 flex justify-between">
              <div className="text-sm text-muted-foreground">
                {reportData.length} records found
                {performanceMode === "fast" && reportData.length >= 1000 && (
                  <span className="text-amber-600 ml-2">• Limited for performance</span>
                )}
                {selectedDataSources.length > 0 &&
                  reportData.length === 0 &&
                  !isGenerating &&
                  connectionStatus === "connected" && (
                    <span className="text-amber-600 ml-2">• No data matches your criteria</span>
                  )}
                {selectedDataSources.length === 0 && (
                  <span className="text-amber-600 ml-2">• Add data sources to begin</span>
                )}
                {connectionStatus === "disconnected" && (
                  <span className="text-red-600 ml-2">• Database unavailable</span>
                )}
              </div>
              <ReportExporter
                data={reportData}
                reportName={reportName}
                reportDescription={reportDescription}
                variant="outline"
                size="sm"
              />
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
