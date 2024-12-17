// @ts-nocheck

import React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Trash2 } from 'lucide-react'
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
        <TableRow className="bg-blue-600 hover:bg-blue-700">
          <TableHead className="text-center text-white w-[50px]">Index</TableHead>
          <TableHead className="text-white">Name</TableHead>
          {getHeaderCells(activeTab)}
          {getCategoryDateHeaders(categoryFilters)}
          <TableHead className="text-center text-white">Status</TableHead>
          <TableHead className="text-center text-white">Last Checked</TableHead>
          <TableHead className="text-center text-white">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company, index) => (
          <TableRow 
            key={company.id}
            className={isAllDatesNA(company) ? 'bg-red-50' : ''}
          >
            <TableCell className="text-center">{index + 1}</TableCell>
            <TableCell>{company.company_name || company.name}</TableCell>
            {getDataCells(company, activeTab)}
            {getCategoryDateCells(company, categoryFilters, formatDate)}
            <TableCell className="text-center">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(company.status)}`}>
                {company.status || 'N/A'}
              </span>
            </TableCell>
            <TableCell className="text-center">
              {company.last_checked ? new Date(company.last_checked).toLocaleString() : 'Never'}
            </TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center space-x-2">
                <Button variant="ghost" size="sm" onClick={() => onEdit(company)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(company.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function getHeaderCells(activeTab: string) {
  switch (activeTab) {
    case 'kra':
      return (
        <>
          <TableHead className="text-center text-white">KRA PIN</TableHead>
          <TableHead className="text-center text-white">KRA Password</TableHead>
        </>
      )
    case 'nhif':
      return (
        <>
          <TableHead className="text-center text-white">NHIF ID</TableHead>
          <TableHead className="text-center text-white">NHIF Code</TableHead>
          <TableHead className="text-center text-white">NHIF Password</TableHead>
        </>
      )
    case 'nssf':
      return (
        <>
          <TableHead className="text-center text-white">NSSF ID</TableHead>
          <TableHead className="text-center text-white">NSSF Code</TableHead>
          <TableHead className="text-center text-white">NSSF Password</TableHead>
        </>
      )
    case 'ecitizen':
      return (
        <>
          <TableHead className="text-center text-white">eCitizen ID</TableHead>
          <TableHead className="text-center text-white">eCitizen Password</TableHead>
          <TableHead className="text-white">Director</TableHead>
        </>
      )
    case 'quickbooks':
      return (
        <>
          <TableHead className="text-center text-white">ID</TableHead>
          <TableHead className="text-center text-white">Password</TableHead>
        </>
      )
    case 'kebs':
      return (
        <>
          <TableHead className="text-center text-white">ID</TableHead>
          <TableHead className="text-center text-white">Password</TableHead>
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
              <TableHead className="text-center text-white">ACC From</TableHead>
              <TableHead className="text-center text-white">ACC To</TableHead>
            </React.Fragment>
          )
        case 'audit_tax':
          return (
            <React.Fragment key={filter.key}>
              <TableHead className="text-center text-white">Audit Tax From</TableHead>
              <TableHead className="text-center text-white">Audit Tax To</TableHead>
            </React.Fragment>
          )
        case 'cps_sheria':
          return (
            <React.Fragment key={filter.key}>
              <TableHead className="text-center text-white">CPS Sheria From</TableHead>
              <TableHead className="text-center text-white">CPS Sheria To</TableHead>
            </React.Fragment>
          )
        case 'imm':
          return (
            <React.Fragment key={filter.key}>
              <TableHead className="text-center text-white">Immigration From</TableHead>
              <TableHead className="text-center text-white">Immigration To</TableHead>
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
