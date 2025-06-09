// Utility functions for the report builder

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
