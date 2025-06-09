// @ts-nocheck
"use client"

import { supabase } from "@/lib/supabase"

// Extract schema from sample data
export function extractTableSchema(data: any[]): Record<string, string> {
  if (!data || data.length === 0) return {}

  const schema: Record<string, string> = {}
  const sample = data[0]

  Object.keys(sample).forEach((key) => {
    const value = sample[key]

    if (value === null || value === undefined) {
      schema[key] = "string"
    } else if (typeof value === "number") {
      schema[key] = "number"
    } else if (typeof value === "boolean") {
      schema[key] = "boolean"
    } else if (value instanceof Date) {
      schema[key] = "date"
    } else if (typeof value === "string") {
      // Try to detect date strings
      if (value.match(/^\d{4}-\d{2}-\d{2}/) || (value.includes("T") && value.includes("Z"))) {
        schema[key] = "datetime"
      } else {
        schema[key] = "string"
      }
    } else if (typeof value === "object") {
      schema[key] = "object"
    } else {
      schema[key] = "string"
    }
  })

  return schema
}

// Flatten nested data based on specified fields
export function flattenNestedData(data: any[], flattenFields: string[], nestedFields: string[]): any[] {
  if (!flattenFields || flattenFields.length === 0) return data

  const flattened: any[] = []

  data.forEach((record) => {
    const baseRecord = { ...record }

    // Remove nested fields from base record
    flattenFields.forEach((field) => {
      delete baseRecord[field]
    })

    let hasNestedData = false

    // Process each flatten field
    flattenFields.forEach((field) => {
      const nestedData = record[field]

      if (nestedData && typeof nestedData === "object") {
        if (nestedData.data && Array.isArray(nestedData.data)) {
          // Handle section data format
          nestedData.data.forEach((item: any, index: number) => {
            const flatRecord = {
              ...baseRecord,
              [`${field}_index`]: index + 1,
              [`${field}_status`]: nestedData.status || "unknown",
            }

            // Add all fields from the nested item with prefix
            Object.keys(item).forEach((nestedKey) => {
              flatRecord[`${field}_${nestedKey}`] = item[nestedKey]
            })

            flattened.push(flatRecord)
            hasNestedData = true
          })
        } else if (Array.isArray(nestedData)) {
          // Handle direct array format
          nestedData.forEach((item: any, index: number) => {
            const flatRecord = {
              ...baseRecord,
              [`${field}_index`]: index + 1,
            }

            if (typeof item === "object") {
              Object.keys(item).forEach((nestedKey) => {
                flatRecord[`${field}_${nestedKey}`] = item[nestedKey]
              })
            } else {
              flatRecord[`${field}_value`] = item
            }

            flattened.push(flatRecord)
            hasNestedData = true
          })
        }
      }
    })

    // If no nested data was found, add the base record
    if (!hasNestedData) {
      flattened.push(baseRecord)
    }
  })

  return flattened
}

// Merge data from multiple sources based on join conditions
export function mergeDataSources(dataSets: any[][], selectedDataSources: any[], joinConditions: any[]): any[] {
  if (dataSets.length === 0) return []
  if (dataSets.length === 1) return dataSets[0]

  // Start with the first dataset
  let result = dataSets[0].map((row) => ({
    ...row,
    _sourceId: selectedDataSources[0].id,
  }))

  // Join with each subsequent dataset
  for (let i = 1; i < dataSets.length; i++) {
    const rightData = dataSets[i]
    const rightSourceId = selectedDataSources[i].id

    // Find join condition for this source
    const joinCondition = joinConditions.find(
      (jc) =>
        (jc.leftSourceId === selectedDataSources[0].id && jc.rightSourceId === rightSourceId) ||
        (jc.rightSourceId === selectedDataSources[0].id && jc.leftSourceId === rightSourceId),
    )

    if (!joinCondition) {
      // No join condition - do a cartesian product (not recommended for large datasets)
      const newResult: any[] = []
      result.forEach((leftRow) => {
        rightData.forEach((rightRow) => {
          newResult.push({
            ...leftRow,
            ...rightRow,
            _sourceId: `${leftRow._sourceId},${rightSourceId}`,
          })
        })
      })
      result = newResult
    } else {
      // Perform the join
      const newResult: any[] = []

      result.forEach((leftRow) => {
        const matches = rightData.filter((rightRow) => {
          const leftValue = leftRow[joinCondition.leftField]
          const rightValue = rightRow[joinCondition.rightField]
          return leftValue === rightValue
        })

        if (matches.length > 0) {
          matches.forEach((rightRow) => {
            newResult.push({
              ...leftRow,
              ...rightRow,
              _sourceId: `${leftRow._sourceId},${rightSourceId}`,
            })
          })
        } else if (joinCondition.joinType === "left") {
          // Left join - include left row even without match
          newResult.push({
            ...leftRow,
            _sourceId: `${leftRow._sourceId},${rightSourceId}`,
          })
        }
      })

      result = newResult
    }
  }

  return result
}

// Apply filters to data
export function applyFilters(data: any[], filters: any[]): any[] {
  if (!filters || filters.length === 0) return data

  return data.filter((row) => {
    return filters.every((filter) => {
      const value = row[filter.column]
      const filterValue = filter.value

      switch (filter.operator) {
        case "equals":
          return value == filterValue
        case "not_equals":
          return value != filterValue
        case "contains":
          return value && value.toString().toLowerCase().includes(filterValue.toLowerCase())
        case "not_contains":
          return !value || !value.toString().toLowerCase().includes(filterValue.toLowerCase())
        case "starts_with":
          return value && value.toString().toLowerCase().startsWith(filterValue.toLowerCase())
        case "ends_with":
          return value && value.toString().toLowerCase().endsWith(filterValue.toLowerCase())
        case "is_empty":
          return !value || value === ""
        case "is_not_empty":
          return value && value !== ""
        case "greater_than":
          return Number(value) > Number(filterValue)
        case "less_than":
          return Number(value) < Number(filterValue)
        case "greater_than_equals":
          return Number(value) >= Number(filterValue)
        case "less_than_equals":
          return Number(value) <= Number(filterValue)
        case "before":
          return new Date(value) < new Date(filterValue)
        case "after":
          return new Date(value) > new Date(filterValue)
        default:
          return true
      }
    })
  })
}

// Updated report-utils.ts - Add this to the existing file

// Enhanced VAT section data flattening
export function flattenVatSectionData(data: any[], flattenFields: string[], nestedFields: string[]): any[] {
  if (!flattenFields || flattenFields.length === 0) return data

  const flattened: any[] = []

  data.forEach((record) => {
    const baseRecord = { ...record }

    // Remove nested fields from base record
    flattenFields.forEach((field) => {
      delete baseRecord[field]
    })

    let hasNestedData = false

    // Process each flatten field with VAT section optimization
    flattenFields.forEach((field) => {
      const nestedData = record[field]

      if (nestedData && typeof nestedData === 'object') {
        if (nestedData.data && Array.isArray(nestedData.data)) {
          // Handle VAT section data format - use monthly aggregation for optimized sections
          if (['section_o', 'section_b2', 'section_f2', 'section_m', 'section_n'].includes(field)) {
            // For optimized sections, create one flattened record per month
            const monthlyAggregated = aggregateVatSectionByMonth(nestedData.data, field, baseRecord)
            if (monthlyAggregated) {
              flattened.push(monthlyAggregated)
              hasNestedData = true
            }
          } else {
            // For other sections, use original detailed approach
            nestedData.data.forEach((item: any, index: number) => {
              const flatRecord = {
                ...baseRecord,
                [`${field}_index`]: index + 1,
                [`${field}_status`]: nestedData.status || "unknown",
              }

              Object.keys(item).forEach((nestedKey) => {
                flatRecord[`${field}_${nestedKey}`] = item[nestedKey]
              })

              flattened.push(flatRecord)
              hasNestedData = true
            })
          }
        }
      }
    })

    // If no nested data was found, add the base record
    if (!hasNestedData) {
      flattened.push(baseRecord)
    }
  })

  return flattened
}

// Helper function to aggregate VAT section data by month
function aggregateVatSectionByMonth(sectionData: any[], sectionField: string, baseRecord: any): any | null {
  if (!sectionData || sectionData.length === 0) return null

  const aggregated = { ...baseRecord }

  // Section O - Tax Calculation aggregation
  if (sectionField === 'section_o') {
    const fieldMapping = {
      13: 'output_vat_13', 14: 'input_vat_14', 15: 'vat_claimable_15',
      16: 'input_vat_exempt_16', 17: 'input_vat_mixed_17', 18: 'non_deductible_18',
      19: 'deductible_input_19', 20: 'vat_payable_20', 21: 'credit_bf_21',
      22: 'vat_withholding_22', 23: 'refund_claim_23', 24: 'total_vat_payable_24',
      25: 'vat_paid_25', 26: 'credit_adjustment_26', 27: 'debit_adjustment_27',
      28: 'net_vat_28'
    }

    sectionData.forEach((row: any) => {
      const srNo = parseInt(row["Sr.No."] || "0")
      const amount = parseFloat(String(row["Amount (Ksh)"]).replace(/[^\d.-]/g, '')) || 0

      if (fieldMapping[srNo as keyof typeof fieldMapping]) {
        aggregated[`section_o_${fieldMapping[srNo as keyof typeof fieldMapping]}`] = amount
        aggregated[`section_o_${fieldMapping[srNo as keyof typeof fieldMapping]}_description`] = row["Descriptions"] || ""
      }
    })
  }

  // Section B2 - Sales Totals aggregation
  else if (sectionField === 'section_b2') {
    sectionData.forEach((row: any) => {
      const description = (row["Description"] || "").toLowerCase()
      const vatAmount = parseFloat(String(row["Amount of VAT (Ksh)"]).replace(/[^\d.-]/g, '')) || 0
      const taxableValue = parseFloat(String(row["Taxable Value (Ksh)"]).replace(/[^\d.-]/g, '')) || 0

      if (description.includes("customers registered for vat")) {
        aggregated['section_b2_registered_customers_vat'] = vatAmount
        aggregated['section_b2_registered_customers_taxable'] = taxableValue
      } else if (description.includes("customers not registered for vat")) {
        aggregated['section_b2_non_registered_customers_vat'] = vatAmount
        aggregated['section_b2_non_registered_customers_taxable'] = taxableValue
      } else if (description.includes("total")) {
        aggregated['section_b2_total_vat'] = vatAmount
        aggregated['section_b2_total_taxable'] = taxableValue
      }
    })
  }

  // Section F2 - Purchases Totals aggregation
  else if (sectionField === 'section_f2') {
    sectionData.forEach((row: any) => {
      const description = (row["Description"] || "").toLowerCase()
      const vatAmount = parseFloat(String(row["Amount of VAT (Ksh)"]).replace(/[^\d.-]/g, '')) || 0
      const taxableValue = parseFloat(String(row["Taxable Value (Ksh)"]).replace(/[^\d.-]/g, '')) || 0

      if (description.includes("suppliers registered for vat") && description.includes("local")) {
        aggregated['section_f2_local_suppliers_vat'] = vatAmount
        aggregated['section_f2_local_suppliers_taxable'] = taxableValue
      } else if (description.includes("suppliers not registered for vat") && description.includes("import")) {
        aggregated['section_f2_import_suppliers_vat'] = vatAmount
        aggregated['section_f2_import_suppliers_taxable'] = taxableValue
      } else if (description.includes("total")) {
        aggregated['section_f2_total_vat'] = vatAmount
        aggregated['section_f2_total_taxable'] = taxableValue
      }
    })
  }

  // Section M - Sales Summary by Rate
  else if (sectionField === 'section_m') {
    let totalAmount = 0
    let totalVat = 0
    const rateBreakdown: Record<string, { amount: number, vat: number }> = {}

    sectionData.forEach((row: any) => {
      const rate = row["Rate (%)"] || "0"
      const amount = parseFloat(String(row["Amount (Excl. VAT) (Ksh)"]).replace(/[^\d.-]/g, '')) || 0
      const vat = parseFloat(String(row["Amount of Output VAT (Ksh)"]).replace(/[^\d.-]/g, '')) || 0

      if (!rateBreakdown[rate]) {
        rateBreakdown[rate] = { amount: 0, vat: 0 }
      }
      rateBreakdown[rate].amount += amount
      rateBreakdown[rate].vat += vat
      totalAmount += amount
      totalVat += vat

      // Add rate-specific columns
      aggregated[`section_m_rate_${rate}_amount`] = rateBreakdown[rate].amount
      aggregated[`section_m_rate_${rate}_vat`] = rateBreakdown[rate].vat
    })

    aggregated['section_m_total_amount'] = totalAmount
    aggregated['section_m_total_vat'] = totalVat
  }

  // Section N - Purchases Summary by Rate
  else if (sectionField === 'section_n') {
    let totalAmount = 0
    let totalVat = 0
    const rateBreakdown: Record<string, { amount: number, vat: number }> = {}

    sectionData.forEach((row: any) => {
      const rate = row["Rate (%)"] || "0"
      const amount = parseFloat(String(row["Amount (Excl. VAT) (Ksh)"]).replace(/[^\d.-]/g, '')) || 0
      const vat = parseFloat(String(row["Amount of Input VAT (Ksh)"]).replace(/[^\d.-]/g, '')) || 0

      if (!rateBreakdown[rate]) {
        rateBreakdown[rate] = { amount: 0, vat: 0 }
      }
      rateBreakdown[rate].amount += amount
      rateBreakdown[rate].vat += vat
      totalAmount += amount
      totalVat += vat

      // Add rate-specific columns
      aggregated[`section_n_rate_${rate}_amount`] = rateBreakdown[rate].amount
      aggregated[`section_n_rate_${rate}_vat`] = rateBreakdown[rate].vat
    })

    aggregated['section_n_total_amount'] = totalAmount
    aggregated['section_n_total_vat'] = totalVat
  }

  return aggregated
}

// Enhanced schema extraction for VAT sections
export function extractVatSectionSchema(data: any[]): Record<string, string> {
  if (!data || data.length === 0) return {}

  const schema: Record<string, string> = {}
  const sample = data[0]

  Object.keys(sample).forEach((key) => {
    const value = sample[key]

    // Handle VAT section fields specifically
    if (key.startsWith('section_')) {
      if (key.includes('_vat') || key.includes('_amount') || key.includes('_taxable')) {
        schema[key] = "currency"
      } else if (key.includes('_description')) {
        schema[key] = "string"
      } else if (key.includes('_rate_')) {
        schema[key] = "number"
      } else {
        schema[key] = "object"
      }
    } else {
      // Standard field detection
      if (value === null || value === undefined) {
        schema[key] = "string"
      } else if (typeof value === "number") {
        schema[key] = "number"
      } else if (typeof value === "boolean") {
        schema[key] = "boolean"
      } else if (value instanceof Date) {
        schema[key] = "date"
      } else if (typeof value === "string") {
        if (value.match(/^\d{4}-\d{2}-\d{2}/) || (value.includes("T") && value.includes("Z"))) {
          schema[key] = "datetime"
        } else {
          schema[key] = "string"
        }
      } else if (typeof value === "object") {
        schema[key] = "object"
      } else {
        schema[key] = "string"
      }
    }
  })

  return schema
}

// Updated data fetcher with VAT section optimization
export async function getVatSectionDataOptimized(options: {
  companyIds?: number[]
  sectionFields: string[]
  limit?: number
  offset?: number
  monthlyAggregation?: boolean
}) {
  try {
    const { companyIds, sectionFields, limit = 100, offset = 0, monthlyAggregation = true } = options

    // Build select clause with only the requested section fields
    const selectClause = `id, company_id, year, month, ${sectionFields.join(", ")}`

    let query = supabase
      .from("vat_return_details")
      .select(selectClause)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .range(offset, offset + limit - 1)

    if (companyIds && companyIds.length > 0) {
      query = query.in("company_id", companyIds)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching VAT section data:", error)
      return []
    }

    // If monthly aggregation is requested, process the data
    if (monthlyAggregation && data) {
      return data.map(record => {
        const processed = { ...record }

        // Process each section field for monthly aggregation
        sectionFields.forEach(field => {
          if (['section_o', 'section_b2', 'section_f2', 'section_m', 'section_n'].includes(field)) {
            const sectionData = record[field]
            if (sectionData?.data && Array.isArray(sectionData.data)) {
              const aggregated = aggregateVatSectionByMonth(sectionData.data, field, {})
              if (aggregated) {
                // Merge aggregated fields into the main record
                Object.assign(processed, aggregated)
              }
            }
          }
        })

        return processed
      })
    }

    return data || []
  } catch (error) {
    console.error("Unexpected error fetching VAT section data:", error)
    return []
  }
}
