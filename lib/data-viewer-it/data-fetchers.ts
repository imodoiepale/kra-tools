// @ts-nocheck

// it_return_details
// company_it_return_listings


import { supabase } from "./supabase"
import type { Company, ItReturnDetails, CompanyItReturnListings, PinCheckerDetails, EnrichedCompany } from "./supabase"

export interface EnrichedCompany extends Company {
  income_tax_company_status: 'Registered' | 'Not Registered' | 'Unknown';
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

async function getPinDetailsMap(): Promise<Map<string, 'Registered' | 'Not Registered' | 'Unknown'>> {
  try {
    const details = await fetchAllPages<PinCheckerDetails>(
      "PinCheckerDetails",
      "company_name, income_tax_company_status"
    );
    const map = new Map<string, 'Registered' | 'Not Registered' | 'Unknown'>();
    details.forEach(detail => {
      if (detail.company_name && detail.income_tax_company_status) {
        if (detail.income_tax_company_status === 'Registered' || detail.income_tax_company_status === 'Not Registered') {
        map.set(detail.company_name, detail.income_tax_company_status);
      }
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
      getPinDetailsMap()
    ]);

    const currentDate = new Date();

    return companies.map(company => ({
      ...company,
      income_tax_company_status: pinDetailsMap.get(company.company_name) || 'Unknown',
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
      "company_name, income_tax_company_status",
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

// Enhanced VAT returns fetcher with date filtering
export async function getItReturnDetails(
  companyId?: number,
  returnPeriodFrom?: { year: number; month: number },
  returnPeriodTo?: { year: number; month: number },
  limit?: number,
  fromDate?: { year: number; month: number },
  toDate?: { year: number; month: number }
): Promise<ItReturnDetails[]> {
  try {
    console.log("Fetching IT return details with filters:", {
      companyId,
      returnPeriodFrom,
      returnPeriodTo,
      limit,
      fromDate,
      toDate
    })

    // If limit is specified and small, use single query
    if (limit && limit <= 1000 && !fromDate && !toDate) {
      let query = supabase
        .from("it_return_details")
        .select("*")
        .order("return_period_from", { ascending: false })
        .order("return_period_to", { ascending: false })
        .limit(limit)

      if (companyId) query = query.eq("company_id", companyId)
      if (returnPeriodFrom) query = query.gte("return_period_from", `${returnPeriodFrom.year}-${returnPeriodFrom.month.toString().padStart(2, "0")}`)
      if (returnPeriodTo) query = query.lte("return_period_to", `${returnPeriodTo.year}-${returnPeriodTo.month.toString().padStart(2, "0")}`)

      const { data, error } = await query

      if (error) {
        console.error("Error fetching IT return details:", error)
        return []
      }

      return (data || []) as ItReturnDetails[]
    }

    // For unlimited or large datasets, use pagination
    const filters: { [key: string]: any } = {}
    if (companyId) filters.company_id = companyId
    if (returnPeriodFrom) filters.return_period_from = `${returnPeriodFrom.year}-${returnPeriodFrom.month.toString().padStart(2, "0")}`
    if (returnPeriodTo) filters.return_period_to = `${returnPeriodTo.year}-${returnPeriodTo.month.toString().padStart(2, "0")}`

    let allReturns = await fetchAllPages<ItReturnDetails>(
      "it_return_details",
      "*",
      filters,
      [
        { column: "return_period_from", ascending: false },
        { column: "return_period_to", ascending: false }
      ]
    )

    // Apply date range filtering if specified
    if (fromDate || toDate) {
      allReturns = allReturns.filter((itReturn) => {
        const returnDateFrom = new Date(itReturn.return_period_from);
        const returnDateTo = new Date(itReturn.return_period_to);

        if (fromDate) {
          const fromDateTime = new Date(fromDate.year, fromDate.month - 1)
          if (returnDateTo < fromDateTime) return false
        }

        if (toDate) {
          const toDateTime = new Date(toDate.year, toDate.month - 1)
          if (returnDateFrom > toDateTime) return false
        }

        return true
      })
    }

    // Apply limit after filtering
    if (limit && limit > 0) {
      allReturns = allReturns.slice(0, limit)
    }

    console.log(`Successfully fetched ${allReturns.length} IT returns`)
    return allReturns
  } catch (error) {
    console.error("Unexpected error fetching IT return details:", error)
    return []
  }
}

// Enhanced optimized IT data fetcher
export async function getItReturnDetailsOptimized(options: {
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
}): Promise<ItReturnDetails[]> {
  try {
    const {
      companyIds,
      limit,
      offset = 0,
      includeNestedFields = false,
      selectedFields,
      dateRange
    } = options

    console.log("Fetching optimized IT return details with options:", options)

    // Build select clause
    let selectClause = "*"
    if (!includeNestedFields) {
      selectClause = `
        id, company_id, return_period_from, return_period_to, 
        processing_status, is_nil_return, 
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

      let allReturns = await fetchAllPages<ItReturnDetails>(
        "it_return_details",
        selectClause,
        filters,
        [
          { column: "return_period_from", ascending: false },
          { column: "return_period_to", ascending: false }
        ]
      )

      // Apply date range filtering
      if (dateRange) {
        allReturns = allReturns.filter((itReturn) => {
          if (dateRange.fromYear && dateRange.fromMonth) {
            const fromDate = new Date(dateRange.fromYear, dateRange.fromMonth - 1)
            const returnDateFrom = new Date(itReturn.return_period_from);
            const returnDateTo = new Date(itReturn.return_period_to);
            if (returnDateTo < fromDate) return false
          }

          if (dateRange.toYear && dateRange.toMonth) {
            const toDate = new Date(dateRange.toYear, dateRange.toMonth - 1)
            const returnDateFrom = new Date(itReturn.return_period_from);
            const returnDateTo = new Date(itReturn.return_period_to);
            if (returnDateFrom > toDate) return false
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
      .from("it_return_details")
      .select(selectClause)
      .order("return_period_from", { ascending: false })
      .order("return_period_to", { ascending: false })
      .range(offset, offset + limit - 1)

    if (companyIds && companyIds.length > 0) {
      query = query.in("company_id", companyIds)
    }

    // Apply date range filters
    if (dateRange?.fromYear && dateRange?.fromMonth) {
      query = query.gte("return_period_from", `${dateRange.fromYear}-${dateRange.fromMonth.toString().padStart(2, "0")}`)
    }
    if (dateRange?.toYear && dateRange?.toMonth) {
      query = query.lte("return_period_to", `${dateRange.toYear}-${dateRange.toMonth.toString().padStart(2, "0")}`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching optimized IT return details:", error)
      return []
    }

    let results = (data || []) as ItReturnDetails[]

    // Additional client-side date filtering for month precision
    if (dateRange && (dateRange.fromMonth || dateRange.toMonth)) {
      results = results.filter((itReturn) => {
        if (dateRange.fromYear && dateRange.fromMonth) {
          const fromDate = new Date(dateRange.fromYear, dateRange.fromMonth - 1)
          const returnDateFrom = new Date(itReturn.return_period_from);
          const returnDateTo = new Date(itReturn.return_period_to);
          if (returnDateTo < fromDate) return false
        }

        if (dateRange.toYear && dateRange.toMonth) {
          const toDate = new Date(dateRange.toYear, dateRange.toMonth - 1)
          const returnDateFrom = new Date(itReturn.return_period_from);
          const returnDateTo = new Date(itReturn.return_period_to);
          if (returnDateFrom > toDate) return false
        }

        return true
      })
    }

    console.log(`Successfully fetched ${results.length} optimized IT returns`)
    return results
  } catch (error) {
    console.error("Unexpected error fetching optimized IT return details:", error)
    return []
  }
}

// Enhanced company return listings fetcher
export async function getCompanyItReturnListings(companyId?: number): Promise<CompanyItReturnListings[]> {
  try {
    console.log("Fetching company return listings for company:", companyId)

    const filters: { [key: string]: any } = {}
    if (companyId) filters.company_id = companyId

    const listings = await fetchAllPages<CompanyItReturnListings>(
      "company_it_return_listings",
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
export async function getCompanyItReturnListingsOptimized(options: {
  companyIds?: number[]
  limit?: number
  offset?: number
  includeNestedFields?: boolean
}): Promise<CompanyItReturnListings[]> {
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

      let allListings = await fetchAllPages<CompanyItReturnListings>(
        "company_it_return_listings",
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
      .from("company_it_return_listings")
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
    return (data || []) as CompanyItReturnListings[]
  } catch (error) {
    console.error("Unexpected error fetching optimized return listings:", error)
    return []
  }
}

// New function to get all available years and months from the dataset
export async function getAvailableItPeriods(): Promise<{ year: number }[]> {
  try {
    console.log("Fetching available IT periods...")

    const { data, error } = await supabase
      .from('it_return_details')
      .select('return_period_from, return_period_to');

    if (error) {
      console.error('Error fetching IT periods:', error);
      return [];
    }

    const years = new Set<number>();
    data.forEach(item => {
      if (item.return_period_from) {
        years.add(new Date(item.return_period_from).getFullYear());
      }
      if (item.return_period_to) {
        years.add(new Date(item.return_period_to).getFullYear());
      }
    });

    const uniquePeriods = Array.from(years).map(year => ({ year }));

    console.log(`Found ${uniquePeriods.length} unique IT periods`)
    return uniquePeriods.sort((a, b) => b.year - a.year);
  } catch (error) {
    console.error("Error fetching available IT periods:", error)
    return []
  }
}