// components/PasswordCheckerReports.tsx
// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Start from './Start'
import PasswordCheckerRunning from './PasswordCheckerRunning'
import { SearchBar } from './reports/components/SearchBar'
import { CategoryFilters, type CategoryFilter } from './reports/components/CategoryFilters'
import { ExportButton } from './reports/components/ExportButton'
import { DownloadDatesButton } from './reports/components/DownloadDatesButton'
import { ReportsTable } from './reports/components/ReportsTable'
import { Company } from './reports/types'
import { formatDate, getStatusColor, parseDate } from './reports/utils'

export default function PasswordCheckerReports() {
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [newCompany, setNewCompany] = useState<Partial<Company>>({
    name: '',
    identifier: '',
    password: '',
  })
  const [activeTab, setActiveTab] = useState('kra')
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'ascending' | 'descending';
  }>({ key: 'company_name', direction: 'ascending' })
  const [searchTerm, setSearchTerm] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("Not Started")
  const [categoriesData, setCategoriesData] = useState({})
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilter[]>([
    { label: 'Accounting', key: 'acc', checked: true },
    { label: 'Audit Tax', key: 'audit_tax', checked: false },
    { label: 'Sheria', key: 'cps_sheria', checked: false },
    { label: 'Immigration', key: 'imm', checked: false },
  ])

  useEffect(() => {
    fetchReports()
  }, [activeTab])

  useEffect(() => {
    fetchCategoriesData()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    const tableName = getTableName()
    try {
      const [mainData, duplicateData] = await Promise.all([
        supabase.from(tableName).select('*').order('company_name', { ascending: true }),
        supabase.from('acc_portal_company_duplicate').select('*')
      ])

      if (mainData.error) throw mainData.error
      if (duplicateData.error) throw duplicateData.error

      const duplicateMap = new Map(
        duplicateData.data.map(company => [
          company.company_name.toLowerCase().trim(),
          company
        ])
      )

      const mergedData = mainData.data
        .map(company => {
          const companyName = (company.company_name || company.name || '').toLowerCase().trim()
          const duplicateInfo = duplicateMap.get(companyName)

          return {
            ...company,
            acc_client_effective_from: duplicateInfo?.acc_client_effective_from || null,
            acc_client_effective_to: duplicateInfo?.acc_client_effective_to || null,
            audit_tax_client_effective_from: duplicateInfo?.audit_tax_client_effective_from || null,
            audit_tax_client_effective_to: duplicateInfo?.audit_tax_client_effective_to || null,
            cps_sheria_client_effective_from: duplicateInfo?.cps_sheria_client_effective_from || null,
            cps_sheria_client_effective_to: duplicateInfo?.cps_sheria_client_effective_to || null,
            imm_client_effective_from: duplicateInfo?.imm_client_effective_from || null,
            imm_client_effective_to: duplicateInfo?.imm_client_effective_to || null,
            hasAllCredentials: checkCredentials(company, activeTab)
          }
        })

      setCompanies(mergedData)
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategoriesData = async () => {
    try {
      const { data, error } = await supabase
        .from('category_table_mappings')
        .select('category, subcategory, table_name')

      if (error) throw error

      const newCategoriesData = {}
      data.forEach(item => {
        if (!newCategoriesData[item.category]) {
          newCategoriesData[item.category] = {}
        }
        newCategoriesData[item.category][item.subcategory] = item.table_name
      })

      setCategoriesData(newCategoriesData)
    } catch (error) {
      console.error('Error fetching categories data:', error)
    }
  }

  const getTableName = () => {
    const category = activeTab.toUpperCase()

    for (const [cat, subcategories] of Object.entries(categoriesData)) {
      if (cat.toUpperCase() === category) {
        for (const [subcat, table_name] of Object.entries(subcategories)) {
          if (table_name) {
            return table_name
          }
        }
      }
    }

    console.error(`No table found for category: ${category}`)
    return 'PasswordChecker'
  }

  const checkCredentials = (company: Company, tab: string) => {
    switch (tab) {
      case 'kra':
        return Boolean(company.kra_pin && company.kra_password)
      case 'nhif':
        return Boolean(company.nhif_id && company.nhif_code && company.nhif_password)
      case 'nssf':
        return Boolean(company.nssf_id && company.nssf_code && company.nssf_password)
      case 'ecitizen':
        return Boolean(company.ecitizen_identifier && company.ecitizen_password && company.director)
      case 'quickbooks':
        return Boolean(company.quickbooks_id && company.quickbooks_password)
      case 'kebs':
        return Boolean(company.kebs_id && company.kebs_password)
      default:
        return true
    }
  }

  const handleEdit = (company: Company) => {
    setEditingCompany(company)
  }

  const handleSave = async (updatedCompany: Company) => {
    const { id, ...updateData } = updatedCompany
    let tableName = getTableName()

    const { error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('Error updating company:', error)
    } else {
      setCompanies(companies.map(c => c.id === updatedCompany.id ? updatedCompany : c))
      setEditingCompany(null)
    }
  }

  const handleDelete = async (id: number) => {
    let tableName = getTableName()

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting company:', error)
    } else {
      setCompanies(companies.filter(c => c.id !== id))
    }
  }

  const handleCategoryFilterChange = (key: string) => {
    setCategoryFilters(categoryFilters.map(filter => 
      filter.key === key ? { ...filter, checked: !filter.checked } : filter
    ))
  }

  const isCompanyActive = (company: Company) => {
    const activeFilters = categoryFilters.filter(filter => filter.checked)
    
    // If no filters are checked, show nothing
    if (activeFilters.length === 0) {
      return false
    }

    const currentDate = new Date()

    const isActiveForCategory = (fromStr: string | null | undefined, toStr: string | null | undefined): boolean => {
      if (!fromStr && !toStr) return true

      const from = fromStr ? parseDate(fromStr) : null
      const to = toStr ? parseDate(toStr) : null

      if (fromStr && !from) {
        console.warn(`Failed to parse from date: ${fromStr}`)
        return true
      }
      if (toStr && !to) {
        console.warn(`Failed to parse to date: ${toStr}`)
        return true
      }

      if (from && !to) return from <= currentDate
      if (!from && to) return currentDate <= to
      return from! <= currentDate && currentDate <= to!
    }

    return activeFilters.some(category => {
      switch (category.key) {
        case 'acc':
          return isActiveForCategory(company.acc_client_effective_from, company.acc_client_effective_to)
        case 'audit_tax':
          return isActiveForCategory(company.audit_tax_client_effective_from, company.audit_tax_client_effective_to)
        case 'cps_sheria':
          return isActiveForCategory(company.cps_sheria_client_effective_from, company.cps_sheria_client_effective_to)
        case 'imm':
          return isActiveForCategory(company.imm_client_effective_from, company.imm_client_effective_to)
        default:
          return false
      }
    })
  }

  const filteredCompanies = companies.filter(isCompanyActive)

  const filteredAndSearchedCompanies = filteredCompanies.filter(company => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    
    return (
      (company.company_name || company.name || '').toLowerCase().includes(searchLower) ||
      (company.kra_pin || '').toLowerCase().includes(searchLower) ||
      (company.kra_password || '').toLowerCase().includes(searchLower) ||
      (company.nhif_code || '').toLowerCase().includes(searchLower) ||
      (company.nssf_code || '').toLowerCase().includes(searchLower) ||
      (company.ecitizen_identifier || '').toLowerCase().includes(searchLower) ||
      (company.director || '').toLowerCase().includes(searchLower) ||
      (company.status || '').toLowerCase().includes(searchLower)
    )
  })

  const sortedCompanies = [...filteredAndSearchedCompanies].sort((a, b) => {
    if (!sortConfig.key) return 0

    const aValue = a[sortConfig.key] || ''
    const bValue = b[sortConfig.key] || ''

    if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1
    return 0
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
            <TabsList className="h-10 bg-muted/50">
              {Object.keys(categoriesData).map(category => (
                <TabsTrigger 
                  key={category} 
                  value={category.toLowerCase()} 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {category.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex flex-wrap gap-2 items-center">
              <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
              <CategoryFilters 
                categoryFilters={categoryFilters} 
                onFilterChange={handleCategoryFilterChange} 
              />
              <ExportButton companies={sortedCompanies} activeTab={activeTab} />
              <DownloadDatesButton companies={companies} />
            </div>
          </div>
        </Tabs>

        <div className="rounded-md border">
          {loading ? (
            <div className="flex justify-center items-center h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <ReportsTable
                companies={sortedCompanies}
                activeTab={activeTab}
                categoryFilters={categoryFilters}
                onEdit={handleEdit}
                onDelete={handleDelete}
                getStatusColor={getStatusColor}
                formatDate={formatDate}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}