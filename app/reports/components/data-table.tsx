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
}

const getStatusColor = (date: string | null) => {
  if (!date) return 'text-red-500'
  return 'text-green-500'
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy')
}

export function DataTable({ data, title, taxType, yearlyData, isHorizontalView }: DataTableProps) {
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
                <TableHead className="w-[100px] font-bold">FIELDS</TableHead>
                {years.map(year => (
                  <TableHead key={year} className="text-center font-bold">{year}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((month, idx) => (
                <TableRow key={month} className={idx % 2 === 0 ? "bg-muted/5" : ""}>
                  <TableCell className="font-medium">{month}</TableCell>
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
              <TableHead className="w-[80px]">Month</TableHead>
              {!taxType ? (
                <>
                  <TableHead>PAYE (KSH)</TableHead>
                  <TableHead>PAYE Date</TableHead>
                  <TableHead>Housing Levy (KSH)</TableHead>
                  <TableHead>Housing Levy Date</TableHead>
                  <TableHead>NITA (KSH)</TableHead>
                  <TableHead>NITA Date</TableHead>
                  <TableHead>SHIF (KSH)</TableHead>
                  <TableHead>SHIF Date</TableHead>
                  <TableHead>NSSF (KSH)</TableHead>
                  <TableHead>NSSF Date</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Amount (KSH)</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Status</TableHead>
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
                <TableCell className="font-medium">{entry.month}</TableCell>
                {!taxType ? (
                  <>
                    <TableCell className={getStatusColor(entry.paye.date)}>
                      {entry.paye.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className={getStatusColor(entry.paye.date)}>
                      {formatDate(entry.paye.date)}
                    </TableCell>
                    <TableCell className={getStatusColor(entry.housingLevy.date)}>
                      {entry.housingLevy.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className={getStatusColor(entry.housingLevy.date)}>
                      {formatDate(entry.housingLevy.date)}
                    </TableCell>
                    <TableCell className={getStatusColor(entry.nita.date)}>
                      {entry.nita.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className={getStatusColor(entry.nita.date)}>
                      {formatDate(entry.nita.date)}
                    </TableCell>
                    <TableCell className={getStatusColor(entry.shif.date)}>
                      {entry.shif.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className={getStatusColor(entry.shif.date)}>
                      {formatDate(entry.shif.date)}
                    </TableCell>
                    <TableCell className={getStatusColor(entry.nssf.date)}>
                      {entry.nssf.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className={getStatusColor(entry.nssf.date)}>
                      {formatDate(entry.nssf.date)}
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>{getTaxData(entry)?.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      {getTaxData(entry)?.date 
                        ? format(new Date(getTaxData(entry)?.date!), 'dd/MM/yyyy') 
                        : '-'}
                    </TableCell>
                    <TableCell 
                      className={getStatusColor(getTaxData(entry)?.date)}
                    >
                      {getTaxData(entry)?.date ? 'Paid' : 'Pending'}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
            <TableRow className="bg-primary/10 font-semibold">
              <TableCell>TOTAL</TableCell>
              {!taxType ? (
                <>
                  <TableCell>{data.reduce((sum, e) => sum + e.paye.amount, 0).toLocaleString()}</TableCell>
                  <TableCell />
                  <TableCell>{data.reduce((sum, e) => sum + e.housingLevy.amount, 0).toLocaleString()}</TableCell>
                  <TableCell />
                  <TableCell>{data.reduce((sum, e) => sum + e.nita.amount, 0).toLocaleString()}</TableCell>
                  <TableCell />
                  <TableCell>{data.reduce((sum, e) => sum + e.shif.amount, 0).toLocaleString()}</TableCell>
                  <TableCell />
                  <TableCell>{data.reduce((sum, e) => sum + e.nssf.amount, 0).toLocaleString()}</TableCell>
                  <TableCell />
                </>
              ) : (
                <>
                  <TableCell>{total.toLocaleString()}</TableCell>
                  <TableCell />
                  <TableCell />
                </>
              )}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}