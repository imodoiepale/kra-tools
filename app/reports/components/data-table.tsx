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

const formatAmount = (amount: number): string => {
  return amount.toString()
}

const getStatusColor = (date: string | null) => {
  if (!date) return 'text-red-500'
  return 'text-green-500'
}

const getDateColor = (dateStr: string | null): string => {
  if (!dateStr) return 'text-red-500'
  try {
    // Assuming date format is dd/MM/yyyy
    const [day] = dateStr.split('/')
    const dayNum = parseInt(day, 10)
    if (dayNum > 9) return 'text-red-500'
    if (dayNum >= 1 && dayNum <= 9) return 'text-green-500'
    return 'text-black'
  } catch (e) {
    return 'text-black'
  }
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy')
}

const taxColumns = [
  { id: 'paye', name: 'PAYE', bg: 'bg-[#E8EFF7]' },
  { id: 'housingLevy', name: 'Housing Levy', bg: 'bg-[#F5F5F5]' },
  { id: 'nita', name: 'NITA', bg: 'bg-[#E8EFF7]' },
  { id: 'shif', name: 'SHIF', bg: 'bg-[#F5F5F5]' },
  { id: 'nssf', name: 'NSSF', bg: 'bg-[#E8EFF7]' }
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
                        {formatAmount(amount)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
              <TableRow className="bg-primary/10 font-semibold">
                <TableCell>TOTAL</TableCell>
                {years.map(year => (
                  <TableCell key={year} className="text-center">
                    {formatAmount(yearlyData[year].reduce((sum, entry) => 
                      sum + entry[taxType!].amount, 0
                    ))}
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
      <div className="rounded-lg border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selectedColumns.includes('month') && (
                <TableHead className="w-[80px] bg-[#F5F5F5] font-bold border-r whitespace-nowrap">Month</TableHead>
              )}
              {!taxType ? (
                <>
                  {taxColumns.map((tax) => (
                    selectedColumns.includes(tax.id) && (
                      <>
                        <TableHead 
                          className={`${tax.bg} font-bold border-r text-center whitespace-nowrap px-2`} 
                          key={`${tax.id}-amount`}
                        >
                          {tax.name} (KSH)
                        </TableHead>
                        <TableHead 
                          className={`${tax.bg} font-bold border-r text-center whitespace-nowrap px-2`} 
                          key={`${tax.id}-date`}
                        >
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
            {data.map((entry) => (
              <TableRow 
                key={entry.month}
                className="border-b"
              >
                {selectedColumns.includes('month') && (
                  <TableCell className="font-medium bg-[#F5F5F5] border-r whitespace-nowrap">{entry.month}</TableCell>
                )}
                {!taxType ? (
                  <>
                    {taxColumns.map((tax) => (
                      selectedColumns.includes(tax.id) && (
                        <>
                          <TableCell 
                            key={`${tax.id}-amount`}
                            className={`${tax.bg} border-r text-right px-4`}
                          >
                            {formatAmount(entry[tax.id].amount)}
                          </TableCell>
                          <TableCell 
                            key={`${tax.id}-date`}
                            className={`${tax.bg} border-r text-center ${getDateColor(entry[tax.id].date)}`}
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
                      <TableCell className="text-right px-4">
                        {formatAmount(getTaxData(entry)?.amount || 0)}
                      </TableCell>
                    )}
                    {selectedColumns.includes('date') && (
                      <TableCell className={`text-center ${getDateColor(getTaxData(entry)?.date)}`}>
                        {getTaxData(entry)?.date 
                          ? format(new Date(getTaxData(entry)?.date!), 'dd/MM/yyyy') 
                          : '-'}
                      </TableCell>
                    )}
                    {selectedColumns.includes('status') && (
                      <TableCell 
                        className={`text-center ${getStatusColor(getTaxData(entry)?.date)}`}
                      >
                        {getTaxData(entry)?.date ? 'Paid' : 'Pending'}
                      </TableCell>
                    )}
                  </>
                )}
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-bold bg-[#F5F5F5] border-r">TOTAL</TableCell>
              {!taxType ? (
                <>
                  {taxColumns.map((tax) => (
                    selectedColumns.includes(tax.id) && (
                      <>
                        <TableCell 
                          key={`${tax.id}-amount-total`}
                          className={`${tax.bg} border-r font-bold text-right px-4`}
                        >
                          {formatAmount(data.reduce((sum, e) => sum + e[tax.id].amount, 0))}
                        </TableCell>
                        <TableCell 
                          key={`${tax.id}-date-total`}
                          className={`${tax.bg} border-r`}
                        />
                      </>
                    )
                  ))}
                </>
              ) : (
                <>
                  {selectedColumns.includes('amount') && (
                    <TableCell className="font-bold text-right px-4">
                      {formatAmount(total)}
                    </TableCell>
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