// @ts-nocheck
import { supabase } from "./supabase"
import type { Company, VatReturnDetails, CompanyVatReturnListings, PinCheckerDetails } from "./supabase"

export interface EnrichedCompany extends Company {
  vat_status: 'Registered' | 'Not Registered' | 'Unknown';
  categoryStatus: {
    acc: 'active' | 'inactive';
    audit_tax: 'active' | 'inactive';
    cps_sheria: 'active' | 'inactive';
    imm: 'active' | 'inactive';
  };
}

async function fetchAllPages<T>(
  tableName: string,
  selectClause: string = "*",
  filters: { [key: string]: any } = {},
  orderBy: { column: string; ascending: boolean }[] = [],
  pageSize: number = 10000
): Promise<T[]> {
  let allData: T[] = []
  let offset = 0
  let hasMore = true
  const maxConcurrentPages = 2

  while (hasMore) {
    const promises = []
    for (let i = 0; i < maxConcurrentPages && hasMore; i++) {
      const currentOffset = offset + (i * pageSize)
      let query = supabase
        .from(tableName)
        .select(selectClause)
        .range(currentOffset, currentOffset + pageSize - 1)

      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) query = query.in(key, value)
        else if (value !== undefined && value !== null) query = query.eq(key, value)
      })

      orderBy.forEach(({ column, ascending }) => {
        query = query.order(column, { ascending })
      })
      promises.push(query)
    }

    const results = await Promise.all(promises)
    let pageHasData = false
    for (const result of results) {
      if (result.error) {
        console.error(`Error fetching data from ${tableName}:`, result.error)
        continue
      }
      if (result.data && result.data.length > 0) {
        allData.push(...result.data)
        pageHasData = true
      }
      if (!result.data || result.data.length < pageSize) {
        hasMore = false
      }
    }
    if (!pageHasData) hasMore = false
    offset += maxConcurrentPages * pageSize
  }
  return allData
}

const parseDate = (dateStr: string | null): Date | null => {
  if (!dateStr || !dateStr.includes('/')) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month - 1, day);
};

const isDateInRange = (currentDate: Date, fromDateStr: string | null, toDateStr: string | null): boolean => {
  const fromDate = parseDate(fromDateStr);
  const toDate = parseDate(toDateStr);
  if (!fromDate || !toDate) return false;
  return currentDate >= fromDate && currentDate <= toDate;
};

async function getPinCheckerDetailsMap(): Promise<Map<string, 'Registered' | 'Not Registered'>> {
  try {
    const details = await fetchAllPages<PinCheckerDetails>(
      "PinCheckerDetails",
      "company_name, vat_status"
    );
    const map = new Map<string, 'Registered' | 'Not Registered'>();
    details.forEach(detail => {
      if (detail.company_name && detail.vat_status) {
        map.set(detail.company_name, detail.vat_status);
      }
    });
    return map;
  } catch (error) {
    console.error("Unexpected error fetching Pin Checker details:", error);
    return new Map();
  }
}

export async function getCompanies(): Promise<EnrichedCompany[]> {
  try {
    const selectClause = `
      id, company_name, kra_pin, 
      acc_client_effective_from, acc_client_effective_to,
      audit_client_effective_from, audit_client_effective_to,
      sheria_client_effective_from, sheria_client_effective_to,
      imm_client_effective_from, imm_client_effective_to
    `;

    const [companies, pinDetailsMap] = await Promise.all([
      fetchAllPages<Company>("acc_portal_company_duplicate", selectClause, {}, [{ column: "company_name", ascending: true }]),
      getPinCheckerDetailsMap()
    ]);

    const currentDate = new Date();

    return companies.map(company => ({
      ...company,
      vat_status: pinDetailsMap.get(company.company_name) || 'Unknown',
      categoryStatus: {
        acc: isDateInRange(currentDate, company.acc_client_effective_from, company.acc_client_effective_to) ? 'active' : 'inactive',
        audit_tax: isDateInRange(currentDate, company.audit_client_effective_from, company.audit_client_effective_to) ? 'active' : 'inactive',
        cps_sheria: isDateInRange(currentDate, company.sheria_client_effective_from, company.sheria_client_effective_to) ? 'active' : 'inactive',
        imm: isDateInRange(currentDate, company.imm_client_effective_from, company.imm_client_effective_to) ? 'active' : 'inactive',
      }
    }));
  } catch (error) {
    console.error("Unexpected error fetching companies:", error);
    return [];
  }
}


// Fetches Pin Checker details for VAT status
export async function getPinCheckerDetails(): Promise<PinCheckerDetails[]> {
  try {
    console.log("Fetching all Pin Checker details...")
    const details = await fetchAllPages<PinCheckerDetails>(
      "PinCheckerDetails",
      "company_name, vat_status",
      {},
      [{ column: "company_name", ascending: true }]
    );
    console.log(`Successfully fetched ${details.length} Pin Checker details`);
    return details;
  } catch (error) {
    console.error("Unexpected error fetching Pin Checker details:", error);
    return [];
  }
}
export async function getPinCheckerDetailsForCompany(companyName: string) {
  try {
    const { data, error } = await supabase
      .from("pin_checker_results")
      .select("*")
      .eq("company_name", companyName)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error fetching pin checker details for ${companyName}:`, error);
      return null;
    }

    // Assuming the type is similar to other details, adjust as needed.
    return data as any | null;
  } catch (error) {
    console.error("Unexpected error in getPinCheckerDetailsForCompany:", error);
    return null;
  }
}


// Add these missing functions to lib/data-viewer/data-fetchers.ts
export async function getAllVatReturns(options: {
  companyIds?: number[]
  includeNestedFields?: boolean
  onProgress?: (loaded: number, total: number) => void
}): Promise<VatReturnDetails[]> {
  try {
    const { companyIds, includeNestedFields = false, onProgress } = options

    console.log("Fetching ALL VAT returns...")

    // First, get the total count
    let countQuery = supabase
      .from("vat_return_details")
      .select("*", { count: "exact", head: true })

    if (companyIds && companyIds.length > 0) {
      countQuery = countQuery.in("company_id", companyIds)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error("Error getting count:", countError)
      throw new Error(`Count error: ${countError.message}`)
    }

    const totalRecords = count || 0
    console.log(`Total VAT returns to fetch: ${totalRecords}`)

    if (totalRecords === 0) {
      return []
    }

    // Select fields based on nested field requirement
    const selectClause = includeNestedFields
      ? "*"
      : `
        id, company_id, year, month, processing_status, is_nil_return, 
        extraction_timestamp, created_at, updated_at, kra_pin,
        section_o, section_m, section_n, section_b2, section_f2
      `

    // Fetch all data using pagination
    const pageSize = 1000 // Fetch 1000 records per request
    const allReturns: VatReturnDetails[] = []
    let offset = 0

    while (offset < totalRecords) {
      let query = supabase
        .from("vat_return_details")
        .select(selectClause)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (companyIds && companyIds.length > 0) {
        query = query.in("company_id", companyIds)
      }

      const { data, error } = await query

      if (error) {
        console.error(`Error fetching batch ${offset}-${offset + pageSize}:`, error)
        throw new Error(`Batch error: ${error.message}`)
      }

      if (data && data.length > 0) {
        allReturns.push(...(data as VatReturnDetails[]))
        console.log(`Fetched ${allReturns.length}/${totalRecords} VAT returns`)

        // Call progress callback
        if (onProgress) {
          onProgress(allReturns.length, totalRecords)
        }
      }

      offset += pageSize

      // Break if we got less than expected (end of data)
      if (!data || data.length < pageSize) {
        break
      }

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`Successfully fetched ${allReturns.length} total VAT returns`)
    return allReturns

  } catch (error) {
    console.error("Error in getAllVatReturns:", error)
    throw error
  }
}

export async function getCompanyById(id: number) {
  try {
    const { data, error } = await supabase
      .from("acc_portal_company_duplicate")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("Error fetching company:", error)
      return null
    }

    return data as Company
  } catch (error) {
    console.error("Unexpected error fetching company:", error)
    return null
  }
}

// Enhanced VAT section data fetcher with monthly aggregation
export async function getVatSectionData(options: {
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

// Helper function to aggregate VAT section data by month
function aggregateVatSectionByMonth(sectionData: any[], sectionField: string, baseRecord: any): any | null {
  if (!sectionData || sectionData.length === 0) return null

  const aggregated = { ...baseRecord }

  const parseAmount = (value: any): number => {
    if (value === null || value === undefined || value === "" || value === "-") return 0
    const cleanValue = String(value)
      .replace(/[^\d.-]/g, "")
      .replace(/,/g, "")
    const parsed = Number.parseFloat(cleanValue)
    return Number.isNaN(parsed) ? 0 : parsed
  }

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
      const amount = parseAmount(row["Amount (Ksh)"])

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
      const vatAmount = parseAmount(row["Amount of VAT (Ksh)"])
      const taxableValue = parseAmount(row["Taxable Value (Ksh)"])

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
      const vatAmount = parseAmount(row["Amount of VAT (Ksh)"])
      const taxableValue = parseAmount(row["Taxable Value (Ksh)"])

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
      const amount = parseAmount(row["Amount (Excl. VAT) (Ksh)"])
      const vat = parseAmount(row["Amount of Output VAT (Ksh)"])

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
      const amount = parseAmount(row["Amount (Excl. VAT) (Ksh)"])
      const vat = parseAmount(row["Amount of Input VAT (Ksh)"])

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


// Enhanced VAT returns fetcher with date filtering
export async function getVatReturnDetails(
  companyId?: number,
  year?: number,
  month?: number,
  limit?: number,
  fromDate?: { year: number; month: number },
  toDate?: { year: number; month: number }
): Promise<VatReturnDetails[]> {
  try {
    console.log("Fetching VAT return details with filters:", {
      companyId,
      year,
      month,
      limit,
      fromDate,
      toDate
    })

    // If limit is specified and small, use single query
    if (limit && limit <= 1000 && !fromDate && !toDate) {
      let query = supabase
        .from("vat_return_details")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(limit)

      if (companyId) query = query.eq("company_id", companyId)
      if (year) query = query.eq("year", year)
      if (month) query = query.eq("month", month)

      const { data, error } = await query

      if (error) {
        console.error("Error fetching VAT return details:", error)
        return []
      }

      return (data || []) as VatReturnDetails[]
    }

    // For unlimited or large datasets, use pagination
    const filters: { [key: string]: any } = {}
    if (companyId) filters.company_id = companyId
    if (year) filters.year = year
    if (month) filters.month = month

    let allReturns = await fetchAllPages<VatReturnDetails>(
      "vat_return_details",
      "*",
      filters,
      [
        { column: "year", ascending: false },
        { column: "month", ascending: false }
      ]
    )

    // Apply date range filtering if specified
    if (fromDate || toDate) {
      allReturns = allReturns.filter((vatReturn) => {
        const returnDate = new Date(vatReturn.year, vatReturn.month - 1)

        if (fromDate) {
          const fromDateTime = new Date(fromDate.year, fromDate.month - 1)
          if (returnDate < fromDateTime) return false
        }

        if (toDate) {
          const toDateTime = new Date(toDate.year, toDate.month - 1)
          if (returnDate > toDateTime) return false
        }

        return true
      })
    }

    // Apply limit after filtering
    if (limit && limit > 0) {
      allReturns = allReturns.slice(0, limit)
    }

    console.log(`Successfully fetched ${allReturns.length} VAT returns`)
    return allReturns
  } catch (error) {
    console.error("Unexpected error fetching VAT return details:", error)
    return []
  }
}

// Enhanced optimized VAT data fetcher
export async function getVatReturnDetailsOptimized(options: {
  companyIds?: number[]
  limit?: number
  offset?: number
  includeNestedFields?: boolean
  selectedFields?: string[]
  dateRange?: {
    fromYear?: number
    fromMonth?: number
    toYear?: number
    toMonth?: number
  }
}): Promise<VatReturnDetails[]> {
  try {
    const {
      companyIds,
      limit,
      offset = 0,
      includeNestedFields = false,
      selectedFields,
      dateRange
    } = options

    console.log("Fetching optimized VAT return details with options:", options)

    // Build select clause
    let selectClause = "*"
    if (!includeNestedFields) {
      selectClause = `
        id, company_id, year, month, processing_status, is_nil_return, 
        extraction_timestamp, created_at, updated_at
      `
    } else if (selectedFields && selectedFields.length > 0) {
      selectClause = selectedFields.join(", ")
    }

    // For unlimited data (no limit specified), use pagination
    if (!limit || limit > 1000) {
      const filters: { [key: string]: any } = {}
      if (companyIds && companyIds.length > 0) {
        filters.company_id = companyIds
      }

      let allReturns = await fetchAllPages<VatReturnDetails>(
        "vat_return_details",
        selectClause,
        filters,
        [
          { column: "year", ascending: false },
          { column: "month", ascending: false }
        ]
      )

      // Apply date range filtering
      if (dateRange) {
        allReturns = allReturns.filter((vatReturn) => {
          if (dateRange.fromYear && dateRange.fromMonth) {
            const fromDate = new Date(dateRange.fromYear, dateRange.fromMonth - 1)
            const returnDate = new Date(vatReturn.year, vatReturn.month - 1)
            if (returnDate < fromDate) return false
          }

          if (dateRange.toYear && dateRange.toMonth) {
            const toDate = new Date(dateRange.toYear, dateRange.toMonth - 1)
            const returnDate = new Date(vatReturn.year, vatReturn.month - 1)
            if (returnDate > toDate) return false
          }

          return true
        })
      }

      // Apply offset and limit after filtering
      if (offset > 0) {
        allReturns = allReturns.slice(offset)
      }

      if (limit && limit > 0) {
        allReturns = allReturns.slice(0, limit)
      }

      return allReturns
    }

    // For small datasets, use single query
    let query = supabase
      .from("vat_return_details")
      .select(selectClause)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .range(offset, offset + limit - 1)

    if (companyIds && companyIds.length > 0) {
      query = query.in("company_id", companyIds)
    }

    // Apply date range filters
    if (dateRange?.fromYear && dateRange?.fromMonth) {
      query = query.gte("year", dateRange.fromYear)
    }
    if (dateRange?.toYear && dateRange?.toMonth) {
      query = query.lte("year", dateRange.toYear)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching optimized VAT return details:", error)
      return []
    }

    let results = (data || []) as VatReturnDetails[]

    // Additional client-side date filtering for month precision
    if (dateRange && (dateRange.fromMonth || dateRange.toMonth)) {
      results = results.filter((vatReturn) => {
        if (dateRange.fromYear && dateRange.fromMonth) {
          const fromDate = new Date(dateRange.fromYear, dateRange.fromMonth - 1)
          const returnDate = new Date(vatReturn.year, vatReturn.month - 1)
          if (returnDate < fromDate) return false
        }

        if (dateRange.toYear && dateRange.toMonth) {
          const toDate = new Date(dateRange.toYear, dateRange.toMonth - 1)
          const returnDate = new Date(vatReturn.year, vatReturn.month - 1)
          if (returnDate > toDate) return false
        }

        return true
      })
    }

    console.log(`Successfully fetched ${results.length} optimized VAT returns`)
    return results
  } catch (error) {
    console.error("Unexpected error fetching optimized VAT return details:", error)
    return []
  }
}

// Enhanced company return listings fetcher
export async function getCompanyReturnListings(companyId?: number): Promise<CompanyVatReturnListings[]> {
  try {
    console.log("Fetching company return listings for company:", companyId)

    const filters: { [key: string]: any } = {}
    if (companyId) filters.company_id = companyId

    const listings = await fetchAllPages<CompanyVatReturnListings>(
      "company_vat_return_listings",
      "*",
      filters,
      [{ column: "last_scraped_at", ascending: false }]
    )

    console.log(`Successfully fetched ${listings.length} return listings`)
    return listings
  } catch (error) {
    console.error("Unexpected error fetching company return listings:", error)
    return []
  }
}

// Enhanced optimized return listings fetcher
export async function getCompanyReturnListingsOptimized(options: {
  companyIds?: number[]
  limit?: number
  offset?: number
  includeNestedFields?: boolean
}): Promise<CompanyVatReturnListings[]> {
  try {
    const { companyIds, limit, offset = 0, includeNestedFields = false } = options

    console.log("Fetching optimized return listings with options:", options)

    let selectClause = "*"
    if (!includeNestedFields) {
      selectClause = `
        id, company_id, last_scraped_at, created_at, updated_at
      `
    }

    // For unlimited data, use pagination
    if (!limit || limit > 1000) {
      const filters: { [key: string]: any } = {}
      if (companyIds && companyIds.length > 0) {
        filters.company_id = companyIds
      }

      let allListings = await fetchAllPages<CompanyVatReturnListings>(
        "company_vat_return_listings",
        selectClause,
        filters,
        [{ column: "last_scraped_at", ascending: false }]
      )

      // Apply offset and limit
      if (offset > 0) {
        allListings = allListings.slice(offset)
      }

      if (limit && limit > 0) {
        allListings = allListings.slice(0, limit)
      }

      return allListings
    }

    // For small datasets, use single query
    let query = supabase
      .from("company_vat_return_listings")
      .select(selectClause)
      .order("last_scraped_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (companyIds && companyIds.length > 0) {
      query = query.in("company_id", companyIds)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching optimized return listings:", error)
      return []
    }

    console.log(`Successfully fetched ${(data || []).length} optimized return listings`)
    return (data || []) as CompanyVatReturnListings[]
  } catch (error) {
    console.error("Unexpected error fetching optimized return listings:", error)
    return []
  }
}

// Enhanced dashboard stats with full data support
export async function getDashboardStats() {
  try {
    console.log("Calculating dashboard stats from full dataset...")

    // Use Promise.all to fetch all data concurrently
    const [companies, vatReturns] = await Promise.all([
      getCompanies(),
      getVatReturnDetails() // This will fetch all VAT returns
    ])

    const totalCompanies = companies.length
    const totalReturns = vatReturns.length
    const successfulExtractions = vatReturns.filter(r => r.processing_status === "completed").length
    const nilReturns = vatReturns.filter(r => r.is_nil_return).length

    // Calculate missing returns more accurately
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth() + 1

    const companiesWithRecentReturns = new Set(
      vatReturns
        .filter(r => r.year === currentYear && r.month === (currentMonth - 1))
        .map(r => r.company_id)
    )

    const missingReturns = Math.max(0, totalCompanies - companiesWithRecentReturns.size)
    const complianceRate = totalCompanies > 0 ? Math.round(((totalCompanies - missingReturns) / totalCompanies) * 100) : 0

    console.log("Dashboard stats calculated:", {
      totalCompanies,
      totalReturns,
      successfulExtractions,
      nilReturns,
      missingReturns,
      complianceRate
    })

    return {
      totalCompanies,
      totalReturns,
      successfulExtractions,
      nilReturns,
      missingReturns,
      complianceRate,
    }
  } catch (error) {
    console.error("Unexpected error fetching dashboard stats:", error)
    return {
      totalCompanies: 0,
      totalReturns: 0,
      successfulExtractions: 0,
      nilReturns: 0,
      missingReturns: 0,
      complianceRate: 0,
    }
  }
}

// Enhanced filing trends with full data
export async function getFilingTrends() {
  try {
    console.log("Calculating filing trends from full dataset...")

    // Fetch all VAT returns for trend analysis
    const vatReturns = await getVatReturnDetails()

    if (vatReturns.length === 0) {
      return []
    }

    // Group by month/year and calculate stats
    const trends = vatReturns.reduce((acc: any[], curr) => {
      const key = `${curr.year}-${curr.month.toString().padStart(2, "0")}`
      const monthName = new Date(curr.year, curr.month - 1).toLocaleDateString("en-US", { month: "short" })

      let existing = acc.find((item) => item.key === key)
      if (!existing) {
        existing = {
          key,
          name: monthName,
          year: curr.year,
          month: curr.month,
          onTime: 0,
          late: 0,
          missing: 0,
          nil: 0,
        }
        acc.push(existing)
      }

      if (curr.is_nil_return) {
        existing.nil++
      } else if (curr.processing_status === "completed") {
        existing.onTime++
      } else {
        existing.late++
      }

      return acc
    }, [])

    // Sort by year and month, then take last 12 months
    const sortedTrends = trends
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.month - b.month
      })
      .slice(-12)

    console.log(`Filing trends calculated for ${sortedTrends.length} months`)
    return sortedTrends
  } catch (error) {
    console.error("Unexpected error fetching filing trends:", error)
    return []
  }
}

// Enhanced recent extractions with full company data
export async function getRecentExtractions() {
  try {
    console.log("Fetching recent extractions...")

    // Use Promise.all to fetch data concurrently
    const [recentVatReturns, companies] = await Promise.all([
      getVatReturnDetails(undefined, undefined, undefined, 50), // Last 50 returns
      getCompanies()
    ])

    if (recentVatReturns.length === 0) {
      return []
    }

    // Create a map of company names for efficient lookup
    const companyMap = new Map()
    companies.forEach((company) => {
      companyMap.set(company.id, company.company_name)
    })

    // Combine the data
    const result = recentVatReturns.map((item) => ({
      ...item,
      company_name: companyMap.get(item.company_id) || `Company ${item.company_id}`,
    }))

    console.log(`Recent extractions fetched: ${result.length} items`)
    return result
  } catch (error) {
    console.error("Unexpected error fetching recent extractions:", error)
    return []
  }
}

// New function to get VAT returns with comprehensive date filtering
export async function getVatReturnsByDateRange(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
  companyIds?: number[]
): Promise<VatReturnDetails[]> {
  try {
    console.log("Fetching VAT returns by date range:", {
      fromYear,
      fromMonth,
      toYear,
      toMonth,
      companyIds
    })

    return await getVatReturnDetailsOptimized({
      companyIds,
      dateRange: {
        fromYear,
        fromMonth,
        toYear,
        toMonth
      }
    })
  } catch (error) {
    console.error("Error fetching VAT returns by date range:", error)
    return []
  }
}

// New function to get all available years and months from the dataset
export async function getAvailableVatPeriods(): Promise<{ year: number; month: number }[]> {
  try {
    console.log("Fetching available VAT periods...")

    // Fetch basic data to get year/month combinations
    const { data, error } = await supabase
      .from("vat_return_details")
      .select("year, month")
      .order("year", { ascending: false })
      .order("month", { ascending: false })

    if (error) {
      console.error("Error fetching VAT periods:", error)
      return []
    }

    // Get unique year/month combinations
    const uniquePeriods = Array.from(
      new Set((data || []).map(item => `${item.year}-${item.month}`))
    ).map(period => {
      const [year, month] = period.split('-').map(Number)
      return { year, month }
    })

    console.log(`Found ${uniquePeriods.length} unique VAT periods`)
    return uniquePeriods
  } catch (error) {
    console.error("Error fetching available VAT periods:", error)
    return []
  }
}