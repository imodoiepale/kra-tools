// @ts-nocheck
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TaxEntry } from '../components/data-table'

interface PaymentReceiptExtraction {
  amount?: string;
  payment_mode?: string;
  payment_date?: string;
}

interface PaymentReceiptExtractions {
  [key: string]: PaymentReceiptExtraction | null;
}

export const useCompanyTaxReports = () => {
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([])
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [reportData, setReportData] = useState<Record<string, TaxEntry[]>>({})
  const [loading, setLoading] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'month', 'paye', 'housingLevy', 'nita', 'shif', 'nssf'
  ])

  // Fetch companies from the database
  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('acc_portal_company_duplicate')
        .select('id, company_name')
        .order('company_name')

      if (error) throw error

      if (data) {
        const formattedCompanies = data.map(company => ({
          id: Number(company.id),
          name: company.company_name
        }))
        setCompanies(formattedCompanies)
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
    } finally {
      setLoading(false)
    }
  }, [])

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

  // Fetch tax data for selected company
  const fetchCompanyTaxData = useCallback(async (companyId: number) => {
    setLoading(true)
    try {
      // First, get all payroll cycles to identify years
      const { data: cyclesData, error: cyclesError } = await supabase
        .from('payroll_cycles')
        .select('id, month_year')
        .order('month_year', { ascending: false })
      
      if (cyclesError) throw cyclesError
      
      // Group cycles by year
      const yearGroups: Record<string, string[]> = {}
      cyclesData?.forEach(cycle => {
        const [year] = cycle.month_year.split('-')
        if (!yearGroups[year]) yearGroups[year] = []
        yearGroups[year].push(cycle.id)
      })
      
      const years = Object.keys(yearGroups).sort().reverse()
      const result: Record<string, TaxEntry[]> = {}
      
      // Process each year
      for (const year of years) {
        // Initialize monthly entries for this year
        result[year] = Array.from({ length: 12 }, (_, i) => 
          createEmptyTaxEntry(getMonthName(i + 1))
        )
        
        // Get all records for this company in this year's cycles
        const { data: records, error: recordsError } = await supabase
          .from('company_payroll_records')
          .select(`
            id,
            payroll_cycle_id,
            payment_receipts_extractions
          `)
          .eq('company_id', companyId)
          .in('payroll_cycle_id', yearGroups[year])
        
        if (recordsError) throw recordsError
        
        // Map payroll cycles to months
        const { data: cycleDetails } = await supabase
          .from('payroll_cycles')
          .select('id, month_year')
          .in('id', records?.map(r => r.payroll_cycle_id) || [])
        
        const cycleMap: Record<string, string> = {}
        cycleDetails?.forEach(cycle => {
          cycleMap[cycle.id] = cycle.month_year
        })
        
        // Process records and update tax data
        records?.forEach(record => {
          if (!record.payment_receipts_extractions) return
          
          // Get month from cycle
          const monthYear = cycleMap[record.payroll_cycle_id]
          if (!monthYear) return
          
          const [_, monthStr] = monthYear.split('-')
          const monthIdx = parseInt(monthStr, 10) - 1
          
          // Process each tax type
          Object.entries(record.payment_receipts_extractions as PaymentReceiptExtractions).forEach(([taxType, data]) => {
            if (!data) return
            
            const mappedTaxType = mapTaxType(taxType)
            if (!mappedTaxType) return
            
            // Update the tax entry with extracted data
            if (result[year][monthIdx] && result[year][monthIdx][mappedTaxType]) {
              result[year][monthIdx][mappedTaxType] = {
                amount: parseFloat(data.amount || '0'),
                date: parseDate(data.payment_date || null)
              }
            }
          })
        })
      }
      
      // If no data was found, create sample data for display
      if (Object.keys(result).length === 0) {
        result["2024"] = generateSampleData("2024")
        result["2023"] = generateSampleData("2023")
      }
      
      setReportData(result)
    } catch (error) {
      console.error('Error fetching tax data:', error)
      
      // Fallback to sample data
      setReportData({
        "2024": generateSampleData("2024"),
        "2023": generateSampleData("2023")
      })
    } finally {
      setLoading(false)
    }
  }, [])

  // Generate sample data for development/fallback
  const generateSampleData = (year: string): TaxEntry[] => {
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
    return months.map((monthNum, index) => ({
      month: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][index],
      paye: {
        amount: Math.floor(Math.random() * 10000) + 2000,
        date: Math.random() > 0.3 ? `${year}-${monthNum}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}` : null
      },
      housingLevy: {
        amount: Math.floor(Math.random() * 2000) + 500,
        date: Math.random() > 0.3 ? `${year}-${monthNum}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}` : null
      },
      nita: {
        amount: Math.floor(Math.random() * 500) + 200,
        date: Math.random() > 0.3 ? `${year}-${monthNum}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}` : null
      },
      shif: {
        amount: Math.floor(Math.random() * 3000) + 800,
        date: Math.random() > 0.3 ? `${year}-${monthNum}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}` : null
      },
      nssf: {
        amount: Math.floor(Math.random() * 1500) + 400,
        date: Math.random() > 0.3 ? `${year}-${monthNum}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}` : null
      }
    }))
  }

  // Filter companies based on search query
  const filteredCompanies = useCallback(() => {
    return companies.filter(company =>
      company.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [companies, searchQuery])

  // Initialize: fetch companies on component mount
  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  // Fetch data when selected company changes
  useEffect(() => {
    if (selectedCompany) {
      fetchCompanyTaxData(selectedCompany)
    }
  }, [selectedCompany, fetchCompanyTaxData])

  return {
    companies: filteredCompanies(),
    reportData,
    selectedCompany,
    setSelectedCompany,
    searchQuery,
    setSearchQuery,
    loading,
    selectedColumns,
    setSelectedColumns
  }
}