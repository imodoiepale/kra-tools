// @ts-nocheck

import React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Edit, Trash2 } from 'lucide-react'
import { Company, CategoryFilter } from '../types'

interface ReportsTableProps {
  companies: Company[]
  activeTab: string
  categoryFilters: CategoryFilter[]
  onEdit: (company: Company) => void
  onDelete: (id: number) => void
  getStatusColor: (status: string | null) => string
  formatDate: (dateStr: string | null | undefined) => string
}

export function ReportsTable({
  companies,
  activeTab,
  categoryFilters,
  onEdit,
  onDelete,
  getStatusColor,
  formatDate
}: ReportsTableProps) {
  const isAllDatesNA = (company: Company) => {
    const datePairs = [
      { from: company.acc_client_effective_from, to: company.acc_client_effective_to },
      { from: company.audit_tax_client_effective_from, to: company.audit_tax_client_effective_to },
      { from: company.cps_sheria_client_effective_from, to: company.cps_sheria_client_effective_to },
      { from: company.imm_client_effective_from, to: company.imm_client_effective_to }
    ]
    return !datePairs.some(({ from, to }) => 
      (from && from !== 'N/A') || (to && to !== 'N/A')
    )
  }

  return (
    <Table>
      <TableHeader className="sticky top-0 z-10">
        <TableRow className="bg-primary hover:bg-primary/90">
          <TableHead className="text-center text-primary-foreground w-[50px]">Index</TableHead>
          <TableHead className="text-primary-foreground">Name</TableHead>
          {getHeaderCells(activeTab)}
          {getCategoryDateHeaders(categoryFilters)}
          <TableHead className="text-center text-primary-foreground">Status</TableHead>
          <TableHead className="text-center text-primary-foreground">Last Checked</TableHead>
          <TableHead className="text-center text-primary-foreground">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.length === 0 ? (
          <TableRow>
            <TableCell colSpan={getColumnCount(activeTab, categoryFilters)} className="h-24 text-center">
              No companies found.
            </TableCell>
          </TableRow>
        ) : (
          companies.map((company, index) => (
            <TableRow 
              key={company.id}
              className={`${
                isAllDatesNA(company) ? 'bg-destructive/10' : 
                !company.hasAllCredentials ? 'bg-warning/10' : 
                ''
              } hover:bg-muted/50 transition-colors`}
            >
              <TableCell className="text-center font-medium">{index + 1}</TableCell>
              <TableCell className="font-medium">{company.company_name || company.name}</TableCell>
              {getDataCells(company, activeTab)}
              {getCategoryDateCells(company, categoryFilters, formatDate)}
              <TableCell className="text-center">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(company.status)}`}>
                  {company.status || 'N/A'}
                </span>
              </TableCell>
              <TableCell className="text-center">
                {company.last_checked ? (
                  <span title={new Date(company.last_checked).toLocaleString()}>
                    {formatTimeAgo(company.last_checked)}
                  </span>
                ) : (
                  'Never'
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onEdit(company)}
                    className="hover:bg-primary/10"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

function getHeaderCells(activeTab: string) {
  switch (activeTab) {
    case 'kra':
      return (
        <>
          <TableHead className="text-center text-primary-foreground">KRA PIN</TableHead>
          <TableHead className="text-center text-primary-foreground">KRA Password</TableHead>
        </>
      )
    case 'nhif':
      return (
        <>
          <TableHead className="text-center text-primary-foreground">NHIF ID</TableHead>
          <TableHead className="text-center text-primary-foreground">NHIF Code</TableHead>
          <TableHead className="text-center text-primary-foreground">NHIF Password</TableHead>
        </>
      )
    case 'nssf':
      return (
        <>
          <TableHead className="text-center text-primary-foreground">NSSF ID</TableHead>
          <TableHead className="text-center text-primary-foreground">NSSF Code</TableHead>
          <TableHead className="text-center text-primary-foreground">NSSF Password</TableHead>
        </>
      )
    case 'ecitizen':
      return (
        <>
          <TableHead className="text-center text-primary-foreground">eCitizen ID</TableHead>
          <TableHead className="text-center text-primary-foreground">eCitizen Password</TableHead>
          <TableHead className="text-primary-foreground">Director</TableHead>
        </>
      )
    case 'quickbooks':
      return (
        <>
          <TableHead className="text-center text-primary-foreground">ID</TableHead>
          <TableHead className="text-center text-primary-foreground">Password</TableHead>
        </>
      )
    case 'kebs':
      return (
        <>
          <TableHead className="text-center text-primary-foreground">ID</TableHead>
          <TableHead className="text-center text-primary-foreground">Password</TableHead>
        </>
      )
    default:
      return null
  }
}

function getDataCells(company: Company, activeTab: string) {
  const getMissingStyle = (value: string | undefined | null) => {
    if (!value || value.trim() === '') {
      return 'text-red-600 font-bold'
    }
    return ''
  }

  switch (activeTab) {
    case 'kra':
      return (
        <>
          <TableCell className={`text-center ${getMissingStyle(company.kra_pin)}`}>
            {company.kra_pin || 'MISSING'}
          </TableCell>
          <TableCell className={`text-center ${getMissingStyle(company.kra_password)}`}>
            {company.kra_password || 'MISSING'}
          </TableCell>
        </>
      )
    case 'nhif':
      return (
        <>
          <TableCell className={`text-center ${getMissingStyle(company.nhif_id)}`}>
            {company.nhif_id || 'MISSING'}
          </TableCell>
          <TableCell className={`text-center ${getMissingStyle(company.nhif_code)}`}>
            {company.nhif_code || 'MISSING'}
          </TableCell>
          <TableCell className={`text-center ${getMissingStyle(company.nhif_password)}`}>
            {company.nhif_password || 'MISSING'}
          </TableCell>
        </>
      )
    case 'nssf':
      return (
        <>
          <TableCell className={`text-center ${getMissingStyle(company.nssf_id)}`}>
            {company.nssf_id || 'MISSING'}
          </TableCell>
          <TableCell className={`text-center ${getMissingStyle(company.nssf_code)}`}>
            {company.nssf_code || 'MISSING'}
          </TableCell>
          <TableCell className={`text-center ${getMissingStyle(company.nssf_password)}`}>
            {company.nssf_password || 'MISSING'}
          </TableCell>
        </>
      )
    case 'ecitizen':
      return (
        <>
          <TableCell className={`text-center ${getMissingStyle(company.ecitizen_identifier)}`}>
            {company.ecitizen_identifier || 'MISSING'}
          </TableCell>
          <TableCell className={`text-center ${getMissingStyle(company.ecitizen_password)}`}>
            {company.ecitizen_password || 'MISSING'}
          </TableCell>
          <TableCell className={getMissingStyle(company.director)}>
            {company.director || 'MISSING'}
          </TableCell>
        </>
      )
    case 'quickbooks':
      return (
        <>
          <TableCell className={`text-center ${getMissingStyle(company.quickbooks_id)}`}>
            {company.quickbooks_id || 'MISSING'}
          </TableCell>
          <TableCell className={`text-center ${getMissingStyle(company.quickbooks_password)}`}>
            {company.quickbooks_password || 'MISSING'}
          </TableCell>
        </>
      )
    case 'kebs':
      return (
        <>
          <TableCell className={`text-center ${getMissingStyle(company.kebs_id)}`}>
            {company.kebs_id || 'MISSING'}
          </TableCell>
          <TableCell className={`text-center ${getMissingStyle(company.kebs_password)}`}>
            {company.kebs_password || 'MISSING'}
          </TableCell>
        </>
      )
    default:
      return null
  }
}

function getCategoryDateHeaders(categoryFilters: CategoryFilter[]) {
  return categoryFilters
    .filter(f => f.checked)
    .map(filter => {
      switch (filter.key) {
        case 'acc':
          return (
            <React.Fragment key={filter.key}>
              <TableHead className="text-center text-primary-foreground">ACC From</TableHead>
              <TableHead className="text-center text-primary-foreground">ACC To</TableHead>
            </React.Fragment>
          )
        case 'audit_tax':
          return (
            <React.Fragment key={filter.key}>
              <TableHead className="text-center text-primary-foreground">Audit Tax From</TableHead>
              <TableHead className="text-center text-primary-foreground">Audit Tax To</TableHead>
            </React.Fragment>
          )
        case 'cps_sheria':
          return (
            <React.Fragment key={filter.key}>
              <TableHead className="text-center text-primary-foreground">CPS Sheria From</TableHead>
              <TableHead className="text-center text-primary-foreground">CPS Sheria To</TableHead>
            </React.Fragment>
          )
        case 'imm':
          return (
            <React.Fragment key={filter.key}>
              <TableHead className="text-center text-primary-foreground">Immigration From</TableHead>
              <TableHead className="text-center text-primary-foreground">Immigration To</TableHead>
            </React.Fragment>
          )
        default:
          return null
      }
    })
}

function getCategoryDateCells(company: Company, categoryFilters: CategoryFilter[], formatDate: (dateStr: string | null | undefined) => string) {
  const getDateStyle = (fromDate: string | null | undefined, toDate: string | null | undefined) => {
    if ((!fromDate || fromDate === 'N/A') && (!toDate || toDate === 'N/A')) {
      return 'bg-red-50'
    }
    return ''
  }

  return categoryFilters
    .filter(f => f.checked)
    .map(filter => {
      switch (filter.key) {
        case 'acc':
          const accStyle = getDateStyle(company.acc_client_effective_from, company.acc_client_effective_to)
          return (
            <React.Fragment key={filter.key}>
              <TableCell className={`text-center text-sm ${accStyle}`}>
                {formatDate(company.acc_client_effective_from)}
              </TableCell>
              <TableCell className={`text-center text-sm ${accStyle}`}>
                {formatDate(company.acc_client_effective_to)}
              </TableCell>
            </React.Fragment>
          )
        case 'audit_tax':
          const auditStyle = getDateStyle(company.audit_tax_client_effective_from, company.audit_tax_client_effective_to)
          return (
            <React.Fragment key={filter.key}>
              <TableCell className={`text-center text-sm ${auditStyle}`}>
                {formatDate(company.audit_tax_client_effective_from)}
              </TableCell>
              <TableCell className={`text-center text-sm ${auditStyle}`}>
                {formatDate(company.audit_tax_client_effective_to)}
              </TableCell>
            </React.Fragment>
          )
        case 'cps_sheria':
          const sheriaStyle = getDateStyle(company.cps_sheria_client_effective_from, company.cps_sheria_client_effective_to)
          return (
            <React.Fragment key={filter.key}>
              <TableCell className={`text-center text-sm ${sheriaStyle}`}>
                {formatDate(company.cps_sheria_client_effective_from)}
              </TableCell>
              <TableCell className={`text-center text-sm ${sheriaStyle}`}>
                {formatDate(company.cps_sheria_client_effective_to)}
              </TableCell>
            </React.Fragment>
          )
        case 'imm':
          const immStyle = getDateStyle(company.imm_client_effective_from, company.imm_client_effective_to)
          return (
            <React.Fragment key={filter.key}>
              <TableCell className={`text-center text-sm ${immStyle}`}>
                {formatDate(company.imm_client_effective_from)}
              </TableCell>
              <TableCell className={`text-center text-sm ${immStyle}`}>
                {formatDate(company.imm_client_effective_to)}
              </TableCell>
            </React.Fragment>
          )
        default:
          return null
      }
    })
}

function getColumnCount(activeTab: string, categoryFilters: CategoryFilter[]): number {
  const baseCols = 4 // Index, Name, Status, Actions
  const activeCategoryCount = categoryFilters.filter(f => f.checked).length * 2 // From and To dates for each category
  
  switch (activeTab) {
    case 'kra':
      return baseCols + 2 + activeCategoryCount // +2 for KRA PIN and Password
    case 'nhif':
      return baseCols + 3 + activeCategoryCount // +3 for NHIF ID, Code, Password
    case 'nssf':
      return baseCols + 3 + activeCategoryCount // +3 for NSSF ID, Code, Password
    case 'ecitizen':
      return baseCols + 3 + activeCategoryCount // +3 for eCitizen ID, Password, Director
    case 'quickbooks':
    case 'kebs':
      return baseCols + 2 + activeCategoryCount // +2 for ID and Password
    default:
      return baseCols + activeCategoryCount
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  }
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit)
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`
    }
  }
  
  return 'Just now'
}
