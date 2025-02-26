// @ts-nocheck
"use client"

import { format } from "date-fns"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableCell,
  TableRow,
} from "@/components/ui/table"

export type TaxEntry = {
  month: string
  paye: {
    amount: number
    date: string | null
  }
  housingLevy: {
    amount: number
    date: string | null
  }
  nita: {
    amount: number
    date: string | null
  }
  shif: {
    amount: number
    date: string | null
  }
  nssf: {
    amount: number
    date: string | null
  }
}

interface DataTableProps {
  data: TaxEntry[]
  title?: string
  taxType?: 'paye' | 'housingLevy' | 'nita' | 'shif' | 'nssf'
  yearlyData?: Record<string, TaxEntry[]>
  isHorizontalView?: boolean
  selectedColumns?: string[]
}

const getStatusColor = (date: string | null) => {
  if (!date) return 'text-red-500'
  return 'text-green-500'
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy')
}

const taxColumns = [
  { id: 'paye', name: 'PAYE' },
  { id: 'housingLevy', name: 'Housing Levy' },
  { id: 'nita', name: 'NITA' },
  { id: 'shif', name: 'SHIF' },
  { id: 'nssf', name: 'NSSF' }
] as const

export function DataTable({ data, title, taxType, yearlyData, isHorizontalView, selectedColumns = ['month', 'paye', 'housingLevy', 'nita', 'shif', 'nssf'] }: DataTableProps) {
  const getTaxData = (entry: TaxEntry) => {
    if (taxType) {
      return {
        amount: entry[taxType].amount,
        date: entry[taxType].date
      }
    }
    return null
  }

  if (isHorizontalView && yearlyData) {
    const years = Object.keys(yearlyData).sort().reverse()
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

    return (
      <div className="space-y-2">
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        <div className="rounded-lg border shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {selectedColumns.includes('month') && (
                  <TableHead className="w-[100px] font-bold">FIELDS</TableHead>
                )}
                {years.map(year => (
                  <TableHead key={year} className="text-center font-bold">{year}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((month, idx) => (
                <TableRow key={month} className={idx % 2 === 0 ? "bg-muted/5" : ""}>
                  {selectedColumns.includes('month') && (
                    <TableCell className="font-medium">{month}</TableCell>
                  )}
                  {years.map(year => {
                    const entry = yearlyData[year].find(e => e.month === month)
                    const amount = entry ? entry[taxType!].amount : 0
                    return (
                      <TableCell key={year} className="text-center">
                        {amount.toLocaleString()}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
              <TableRow className="bg-primary/10 font-semibold">
                <TableCell>TOTAL</TableCell>
                {years.map(year => (
                  <TableCell key={year} className="text-center">
                    {yearlyData[year].reduce((sum, entry) => 
                      sum + entry[taxType!].amount, 0
                    ).toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  const total = data.reduce((sum, entry) => {
    if (taxType) {
      return sum + entry[taxType].amount
    }
    return sum + entry.paye.amount + entry.housingLevy.amount + 
           entry.nita.amount + entry.shif.amount + entry.nssf.amount
  }, 0)

  return (
    <div className="space-y-2">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <div className="rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {selectedColumns.includes('month') && (
                <TableHead className="w-[80px]">Month</TableHead>
              )}
              {!taxType ? (
                <>
                  {taxColumns.map((tax, index) => (
                    selectedColumns.includes(tax.id) && (
                      <>
                        <TableHead className={`bg-muted/[${index % 2 ? '0.1' : '0.05'}]`} key={`${tax.id}-amount`}>
                          {tax.name} (KSH)
                        </TableHead>
                        <TableHead className={`bg-muted/[${index % 2 ? '0.1' : '0.05'}]`} key={`${tax.id}-date`}>
                          {tax.name} Date
                        </TableHead>
                      </>
                    )
                  ))}
                </>
              ) : (
                <>
                  {selectedColumns.includes('amount') && (
                    <TableHead>Amount (KSH)</TableHead>
                  )}
                  {selectedColumns.includes('date') && (
                    <TableHead>Payment Date</TableHead>
                  )}
                  {selectedColumns.includes('status') && (
                    <TableHead>Status</TableHead>
                  )}
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry, idx) => (
              <TableRow 
                key={entry.month} 
                className={idx % 2 === 0 ? "bg-muted/5" : ""}
              >
                {selectedColumns.includes('month') && (
                  <TableCell className="font-medium">{entry.month}</TableCell>
                )}
                {!taxType ? (
                  <>
                    {taxColumns.map((tax, index) => (
                      selectedColumns.includes(tax.id) && (
                        <>
                          <TableCell 
                            key={`${tax.id}-amount`}
                            className={`bg-muted/[${index % 2 ? '0.1' : '0.05'}] ${getStatusColor(entry[tax.id].date)}`}
                          >
                            {entry[tax.id].amount.toLocaleString()}
                          </TableCell>
                          <TableCell 
                            key={`${tax.id}-date`}
                            className={`bg-muted/[${index % 2 ? '0.1' : '0.05'}] ${getStatusColor(entry[tax.id].date)}`}
                          >
                            {formatDate(entry[tax.id].date)}
                          </TableCell>
                        </>
                      )
                    ))}
                  </>
                ) : (
                  <>
                    {selectedColumns.includes('amount') && (
                      <TableCell>{getTaxData(entry)?.amount.toLocaleString()}</TableCell>
                    )}
                    {selectedColumns.includes('date') && (
                      <TableCell>
                        {getTaxData(entry)?.date 
                          ? format(new Date(getTaxData(entry)?.date!), 'dd/MM/yyyy') 
                          : '-'}
                      </TableCell>
                    )}
                    {selectedColumns.includes('status') && (
                      <TableCell 
                        className={getStatusColor(getTaxData(entry)?.date)}
                      >
                        {getTaxData(entry)?.date ? 'Paid' : 'Pending'}
                      </TableCell>
                    )}
                  </>
                )}
              </TableRow>
            ))}
            <TableRow className="bg-primary/10 font-semibold">
              <TableCell>TOTAL</TableCell>
              {!taxType ? (
                <>
                  {taxColumns.map((tax, index) => (
                    selectedColumns.includes(tax.id) && (
                      <>
                        <TableCell 
                          key={`${tax.id}-amount-total`}
                          className={`bg-muted/[${index % 2 ? '0.1' : '0.05'}]`}
                        >
                          {data.reduce((sum, e) => sum + e[tax.id].amount, 0).toLocaleString()}
                        </TableCell>
                        <TableCell 
                          key={`${tax.id}-date-total`}
                          className={`bg-muted/[${index % 2 ? '0.1' : '0.05'}]`}
                        />
                      </>
                    )
                  ))}
                </>
              ) : (
                <>
                  {selectedColumns.includes('amount') && (
                    <TableCell>{total.toLocaleString()}</TableCell>
                  )}
                  {selectedColumns.includes('date') && (
                    <TableCell />
                  )}
                  {selectedColumns.includes('status') && (
                    <TableCell />
                  )}
                </>
              )}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}