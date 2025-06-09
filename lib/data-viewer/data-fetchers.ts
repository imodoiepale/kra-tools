import { supabase } from "../supabase"
import type { Company, VatReturnDetails, CompanyVatReturnListings } from "../supabase"

export async function getCompanies() {
  try {
    const { data, error } = await supabase
      .from("acc_portal_company_duplicate")
      .select("*")
      .order("company_name", { ascending: true })

    if (error) {
      console.error("Error fetching companies:", error)
      return []
    }

    return data as Company[]
  } catch (error) {
    console.error("Unexpected error fetching companies:", error)
    return []
  }
}

export async function getCompanyById(id: number) {
  try {
    const { data, error } = await supabase.from("acc_portal_company_duplicate").select("*").eq("id", id).single()

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

export async function getVatReturnDetails(companyId?: number, year?: number, month?: number, limit = 100) {
  try {
    let query = supabase
      .from("vat_return_details")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(limit)

    if (companyId) {
      query = query.eq("company_id", companyId)
    }

    if (year) {
      query = query.eq("year", year)
    }

    if (month) {
      query = query.eq("month", month)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching VAT return details:", error)
      return []
    }

    return (data || []) as VatReturnDetails[]
  } catch (error) {
    console.error("Unexpected error fetching VAT return details:", error)
    return []
  }
}

// Optimized VAT data fetcher for report builder
export async function getVatReturnDetailsOptimized(options: {
  companyIds?: number[]
  limit?: number
  offset?: number
  includeNestedFields?: boolean
  selectedFields?: string[]
}) {
  try {
    const { companyIds, limit = 500, offset = 0, includeNestedFields = false, selectedFields } = options

    // Build select clause - exclude heavy nested fields by default
    let selectClause = "*"
    if (!includeNestedFields) {
      // Only select basic fields that we know exist - avoiding potentially non-existent columns
      selectClause = `
        id, company_id, year, month, processing_status, is_nil_return, 
        extraction_timestamp, created_at, updated_at
      `
    } else if (selectedFields && selectedFields.length > 0) {
      // Only select specific fields if provided
      selectClause = selectedFields.join(", ")
    }

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
      console.error("Error fetching optimized VAT return details:", error)
      return []
    }

    return (data || []) as VatReturnDetails[]
  } catch (error) {
    console.error("Unexpected error fetching optimized VAT return details:", error)
    return []
  }
}

// Get specific nested section data
export async function getVatSectionData(options: {
  companyIds?: number[]
  sectionFields: string[]
  limit?: number
  offset?: number
}) {
  try {
    const { companyIds, sectionFields, limit = 100, offset = 0 } = options

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

    return (data || []) as VatReturnDetails[]
  } catch (error) {
    console.error("Unexpected error fetching VAT section data:", error)
    return []
  }
}

export async function getCompanyReturnListings(companyId?: number) {
  try {
    let query = supabase
      .from("company_vat_return_listings")
      .select("*")
      .order("last_scraped_at", { ascending: false })
      .limit(50)

    if (companyId) {
      query = query.eq("company_id", companyId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching company return listings:", error)
      return []
    }

    return (data || []) as CompanyVatReturnListings[]
  } catch (error) {
    console.error("Unexpected error fetching company return listings:", error)
    return []
  }
}

// Optimized return listings fetcher
export async function getCompanyReturnListingsOptimized(options: {
  companyIds?: number[]
  limit?: number
  offset?: number
  includeNestedFields?: boolean
}) {
  try {
    const { companyIds, limit = 200, offset = 0, includeNestedFields = false } = options

    let selectClause = "*"
    if (!includeNestedFields) {
      // Only select basic fields that we know exist
      selectClause = `
        id, company_id, last_scraped_at, created_at, updated_at
      `
    }

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

    return (data || []) as CompanyVatReturnListings[]
  } catch (error) {
    console.error("Unexpected error fetching optimized return listings:", error)
    return []
  }
}

export async function getDashboardStats() {
  try {
    // Get total companies with error handling
    const { count: totalCompanies, error: companiesError } = await supabase
      .from("acc_portal_company_duplicate")
      .select("*", { count: "exact", head: true })

    if (companiesError) {
      console.error("Error fetching companies count:", companiesError)
    }

    // Get total VAT returns with error handling
    const { count: totalReturns, error: returnsError } = await supabase
      .from("vat_return_details")
      .select("*", { count: "exact", head: true })

    if (returnsError) {
      console.error("Error fetching returns count:", returnsError)
    }

    // Get successful extractions with error handling
    const { count: successfulExtractions, error: successError } = await supabase
      .from("vat_return_details")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "completed")

    if (successError) {
      console.error("Error fetching successful extractions:", successError)
    }

    // Get nil returns with error handling
    const { count: nilReturns, error: nilError } = await supabase
      .from("vat_return_details")
      .select("*", { count: "exact", head: true })
      .eq("is_nil_return", true)

    if (nilError) {
      console.error("Error fetching nil returns:", nilError)
    }

    // Calculate missing returns safely
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth() + 1

    const { data: companiesWithRecentReturns, error: recentError } = await supabase
      .from("vat_return_details")
      .select("company_id")
      .eq("year", currentYear)
      .eq("month", currentMonth - 1)
      .limit(1000)

    if (recentError) {
      console.error("Error fetching recent returns:", recentError)
    }

    const companiesWithReturns = new Set(companiesWithRecentReturns?.map((r) => r.company_id) || [])
    const missingReturns = Math.max(0, (totalCompanies || 0) - companiesWithReturns.size)

    // Calculate compliance rate safely
    const complianceRate =
      totalCompanies && totalCompanies > 0 ? Math.round(((totalCompanies - missingReturns) / totalCompanies) * 100) : 0

    return {
      totalCompanies: totalCompanies || 0,
      totalReturns: totalReturns || 0,
      successfulExtractions: successfulExtractions || 0,
      nilReturns: nilReturns || 0,
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

export async function getFilingTrends() {
  try {
    const { data, error } = await supabase
      .from("vat_return_details")
      .select("year, month, is_nil_return, processing_status")
      .gte("year", 2024)
      .order("year", { ascending: true })
      .order("month", { ascending: true })
      .limit(1000)

    if (error) {
      console.error("Error fetching filing trends:", error)
      return []
    }

    if (!data || data.length === 0) {
      return []
    }

    // Group by month/year and calculate stats
    const trends = data.reduce((acc: any[], curr) => {
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

    return trends.slice(-6) // Last 6 months
  } catch (error) {
    console.error("Unexpected error fetching filing trends:", error)
    return []
  }
}

export async function getRecentExtractions() {
  try {
    // First get recent VAT returns
    const { data: vatReturns, error: vatError } = await supabase
      .from("vat_return_details")
      .select("*")
      .order("extraction_timestamp", { ascending: false })
      .limit(10)

    if (vatError) {
      console.error("Error fetching recent VAT returns:", vatError)
      return []
    }

    if (!vatReturns || vatReturns.length === 0) {
      return []
    }

    // Get company names for the returns
    const companyIds = [...new Set(vatReturns.map((r) => r.company_id))]
    const { data: companies, error: companyError } = await supabase
      .from("acc_portal_company_duplicate")
      .select("id, company_name")
      .in("id", companyIds)

    if (companyError) {
      console.error("Error fetching company names:", companyError)
    }

    // Create a map of company names
    const companyMap = new Map()
    if (companies) {
      companies.forEach((company) => {
        companyMap.set(company.id, company.company_name)
      })
    }

    // Combine the data
    return vatReturns.map((item) => ({
      ...item,
      company_name: companyMap.get(item.company_id) || `Company ${item.company_id}`,
    }))
  } catch (error) {
    console.error("Unexpected error fetching recent extractions:", error)
    return []
  }
}
