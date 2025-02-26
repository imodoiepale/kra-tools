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
  if (!dateStr) return 'text-rose-600 font-medium'
  try {
    const [day] = dateStr.split('/')
    const dayNum = parseInt(day, 10)
    if (dayNum > 9) return 'text-rose-600 font-medium'
    if (dayNum >= 1 && dayNum <= 9) return 'text-emerald-600 font-medium'
    return 'text-slate-900 font-medium'
  } catch (e) {
    return 'text-slate-900 font-medium'
  }
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy')
}

const taxColumns = [
  { id: 'paye', name: 'PAYE', bg: 'bg-[#E8EFF7]', headerBg: 'bg-blue-100' },
  { id: 'housingLevy', name: 'Housing Levy', bg: 'bg-[#F5F5F5]', headerBg: 'bg-purple-100' },
  { id: 'nita', name: 'NITA', bg: 'bg-[#E8EFF7]', headerBg: 'bg-green-100' },
  { id: 'shif', name: 'SHIF', bg: 'bg-[#F5F5F5]', headerBg: 'bg-orange-100' },
  { id: 'nssf', name: 'NSSF', bg: 'bg-[#E8EFF7]', headerBg: 'bg-red-100' }
] as const

const baseHeaderStyle = (bg: string) => `font-semibold border-[1.5px] border-slate-200 text-slate-900 text-center p-3 ${bg}`
const baseCellStyle = (bg: string) => `border-[1.5px] border-slate-200 p-3 text-slate-900 font-medium ${bg}`

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
      <div className="rounded-lg border-2 border-slate-300 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="border-b-2 border-slate-300">
                {selectedColumns.includes('month') && (
                  <TableHead 
                    rowSpan={2} 
                    className="w-[80px] bg-gray-100 font-bold border-2 border-slate-300 text-slate-700 whitespace-nowrap p-3"
                  >
                    Month
                  </TableHead>
                )}
                {taxColumns.map((tax) => (
                  <TableHead 
                    key={tax.id}
                    colSpan={2}
                    className={`font-bold border-2 border-slate-300 text-slate-700 text-center whitespace-nowrap p-3 ${tax.headerBg}`}
                  >
                    {tax.name}
                  </TableHead>
                ))}
              </TableRow>
              <TableRow className="border-b-2 border-slate-300">
                {taxColumns.map((tax) => (
                  <>
                    <TableHead className={`font-bold border-2 border-slate-300 text-slate-700 text-center p-3 ${tax.headerBg}`}>
                      Amount
                    </TableHead>
                    <TableHead className={`font-bold border-2 border-slate-300 text-slate-700 text-center p-3 ${tax.headerBg}`}>
                      date
                    </TableHead>
                  </>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((entry, idx) => (
                <TableRow 
                  key={entry.month}
                  className={idx % 2 === 0 ? "bg-[#F5F5F5]" : "bg-[#E8EFF7]"}
                >
                  {selectedColumns.includes('month') && (
                    <TableCell className={`font-medium ${baseCellStyle('')}`}>
                      {entry.month}
                    </TableCell>
                  )}
                  {taxColumns.map((tax) => (
                    selectedColumns.includes(tax.id) && (
                      <>
                        <TableCell 
                          key={`${tax.id}-amount`}
                          className={`${tax.bg} border-2 border-slate-300 text-right p-3 text-slate-700 font-medium`}
                        >
                          {formatAmount(entry[tax.id].amount)}
                        </TableCell>
                        <TableCell 
                          key={`${tax.id}-date`}
                          className={`${tax.bg} border-2 border-slate-300 text-center p-3 ${getDateColor(entry[tax.id].date)}`}
                        >
                          {formatDate(entry[tax.id].date)}
                        </TableCell>
                      </>
                    )
                  ))}
                </TableRow>
              ))}
              <TableRow className="bg-gradient-to-r from-slate-100 to-slate-200">
                <TableCell className="font-bold border-2 border-slate-300 text-slate-700 p-3">
                  TOTAL
                </TableCell>
                {taxColumns.map((tax) => (
                  selectedColumns.includes(tax.id) && (
                    <>
                      <TableCell 
                        key={`${tax.id}-amount-total`}
                        className={`border-2 border-slate-300 font-bold text-right p-3 text-slate-700`}
                      >
                        {formatAmount(data.reduce((sum, e) => sum + e[tax.id].amount, 0))}
                      </TableCell>
                      <TableCell 
                        key={`${tax.id}-date-total`}
                        className="border-2 border-slate-300 p-3"
                      />
                    </>
                  )
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}