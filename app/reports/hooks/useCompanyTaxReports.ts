// @ts-nocheck
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TaxEntry } from '../components/data-table'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface PaymentReceiptExtraction {
  amount?: string;
  payment_mode?: string;
  payment_date?: string;
}

interface PaymentReceiptExtractions {
  [key: string]: PaymentReceiptExtraction | null;
}

// Cache for storing company tax data
const taxDataCache = new Map<number, Record<string, TaxEntry[]>>()

// Helper function to batch request IDs
const batchRequests = async (ids, batchSize, fetchFn) => {
  const batches = []
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    batches.push(batch)
  }
  
  const results = []
  for (const batch of batches) {
    const result = await fetchFn(batch)
    results.push(...result)
  }
  
  return results
}

// Fetch companies function
const fetchCompanies = async (searchQuery: string) => {
  let query = supabase
    .from('acc_portal_company_duplicate')
    .select('id, company_name')
    .order('company_name')
  
  if (searchQuery) {
    query = query.ilike('company_name', `%${searchQuery}%`)
  }
  
  const { data, error } = await query.limit(100) // Increased limit

  if (error) throw error

  return data?.map(company => ({
    id: Number(company.id),
    name: company.company_name
  })) || []
}

// Fetch company tax data function
const fetchCompanyTaxData = async (companyId: number) => {
  // Check cache first
  if (taxDataCache.has(companyId)) {
    return taxDataCache.get(companyId)!
  }

  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
  const twoYearsAgoStr = twoYearsAgo.toISOString().split('T')[0]

  const { data: cyclesData, error: cyclesError } = await supabase
    .from('payroll_cycles')
    .select('id, month_year')
    .gte('month_year', twoYearsAgoStr)
    .order('month_year', { ascending: false })

  if (cyclesError) throw cyclesError

  const yearGroups: Record<string, string[]> = {}
  cyclesData?.forEach(cycle => {
    const [year] = cycle.month_year.split('-')
    if (!yearGroups[year]) yearGroups[year] = []
    yearGroups[year].push(cycle.id)
  })

  const years = Object.keys(yearGroups).sort().reverse()
  const result: Record<string, TaxEntry[]> = {}

  await Promise.all(years.map(async (year) => {
    result[year] = Array.from({ length: 12 }, (_, i) => 
      createEmptyTaxEntry(getMonthName(i + 1))
    )

    const batchSize = 30
    const cycleDetailsData = await batchRequests(yearGroups[year], batchSize, fetchCycleBatch)
    const recordsData = await batchRequests(yearGroups[year], batchSize, (batchIds) => 
      fetchRecordsBatch(batchIds, companyId)
    )

    const cycleMap: Record<string, string> = {}
    cycleDetailsData.forEach(cycle => {
      cycleMap[cycle.id] = cycle.month_year
    })

    recordsData.forEach(record => {
      if (!record.payment_receipts_extractions) return
      
      const monthYear = cycleMap[record.payroll_cycle_id]
      if (!monthYear) return
      
      const [_, monthStr] = monthYear.split('-')
      const monthIdx = parseInt(monthStr, 10) - 1
      
      Object.entries(record.payment_receipts_extractions as PaymentReceiptExtractions).forEach(([taxType, data]) => {
        if (!data) return
        
        const mappedTaxType = mapTaxType(taxType)
        if (!mappedTaxType) return
        
        if (result[year][monthIdx] && result[year][monthIdx][mappedTaxType]) {
          result[year][monthIdx][mappedTaxType] = {
            amount: parseAmount(data.amount || '0'),
            date: parseDate(data.payment_date || null)
          }
        }
      })
    })
  }))

  // Cache the result
  taxDataCache.set(companyId, result)
  return result
}

// Map tax type from database format to UI format
const mapTaxType = (dbTaxType: string): string => {
  const taxTypeMap: Record<string, string> = {
    'paye_receipt': 'paye',
    'housing_levy_receipt': 'housingLevy',
    'nita_receipt': 'nita',
    'shif_receipt': 'shif',
    'nssf_receipt': 'nssf'
  }
  return taxTypeMap[dbTaxType] || dbTaxType
}

// Parse date string from database format
const parseDate = (dateStr: string | null): string | null => {
  if (!dateStr) return null
  try {
    // Convert date format if needed
    return dateStr
  } catch (e) {
    console.error('Error parsing date:', e)
    return null
  }
}

// Convert month number to month name
const getMonthName = (monthNum: number): string => {
  return ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][monthNum - 1]
}

// Initialize empty tax entry
const createEmptyTaxEntry = (month: string): TaxEntry => ({
  month,
  paye: { amount: 0, date: null },
  housingLevy: { amount: 0, date: null },
  nita: { amount: 0, date: null },
  shif: { amount: 0, date: null },
  nssf: { amount: 0, date: null }
})

// Parse amount from string to number
const parseAmount = (amountStr: string): number => {
  if (!amountStr) return 0;
  // Remove all commas and other non-numeric characters except decimal point
  const cleanedStr = amountStr.replace(/[^0-9.-]/g, '');
  return parseFloat(cleanedStr) || 0;
}

// Fetch cycle batch function
const fetchCycleBatch = async (batchIds: string[]) => {
  const { data, error } = await supabase
    .from('payroll_cycles')
    .select('id, month_year')
    .in('id', batchIds)
  
  if (error) throw error
  return data || []
}

// Fetch records batch function
const fetchRecordsBatch = async (batchIds: string[], companyId: number) => {
  const { data, error } = await supabase
    .from('company_payroll_records')
    .select('id, payroll_cycle_id, payment_receipts_extractions')
    .eq('company_id', companyId)
    .in('payroll_cycle_id', batchIds)
  
  if (error) throw error
  return data || []
}

export const useCompanyTaxReports = () => {
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'month', 'paye', 'housingLevy', 'nita', 'shif', 'nssf'
  ])

  const queryClient = useQueryClient()

  // Companies query
  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['companies', searchQuery],
    queryFn: () => fetchCompanies(searchQuery),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  })

  // Company tax data query
  const { data: reportData = {}, isLoading: isLoadingTaxData } = useQuery({
    queryKey: ['companyTaxData', selectedCompany],
    queryFn: () => selectedCompany ? fetchCompanyTaxData(selectedCompany) : Promise.resolve({}),
    enabled: !!selectedCompany,
    staleTime: 5 * 60 * 1000,
  })

  // Function to toggle tax type selection
  const toggleTaxType = (taxId: string) => {
    setSelectedColumns(prev => {
      if (taxId === 'month') return prev
      
      if (prev.includes(taxId)) {
        return prev.filter(col => col !== taxId)
      } else {
        return [...prev, taxId]
      }
    })
  }

  // Prefetch company tax data
  const prefetchCompanyData = useCallback((companyId: number) => {
    queryClient.prefetchQuery({
      queryKey: ['companyTaxData', companyId],
      queryFn: () => fetchCompanyTaxData(companyId),
    })
  }, [queryClient])

  return {
    companies,
    reportData,
    selectedCompany,
    setSelectedCompany,
    searchQuery,
    setSearchQuery,
    loading: isLoadingCompanies || isLoadingTaxData,
    selectedColumns,
    setSelectedColumns,
    toggleTaxType,
    prefetchCompanyData
  }
}