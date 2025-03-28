// @ts-nocheck
"use client";

import { format } from "date-fns";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import React, { memo, useMemo } from "react";

export type TaxEntry = {
  month: string;
  paye: {
    amount: number;
    date: string | null;
  };
  housingLevy: {
    amount: number;
    date: string | null;
  };
  nita: {
    amount: number;
    date: string | null;
  };
  shif: {
    amount: number;
    date: string | null;
  };
  nssf: {
    amount: number;
    date: string | null;
  };
};

interface DataTableProps {
  data: TaxEntry[];
  title?: string;
  taxType?: "paye" | "housingLevy" | "nita" | "shif" | "nssf";
  yearlyData?: Record<string, TaxEntry[]>;
  isHorizontalView?: boolean;
  selectedColumns?: string[];
  selectedSubColumns?: ("amount" | "date" | "all")[];
  isLoading?: boolean;
}

// Memoized formatter for better performance
const formatAmount = (amount: number | string): string => {
  // If it's a string and might already have formatting
  if (typeof amount === "string") {
    // Remove any existing formatting first
    const cleanedStr = amount.replace(/[^0-9.-]/g, "");
    amount = parseFloat(cleanedStr) || 0;
  }

  // Handle NaN or undefined
  if (isNaN(amount as number) || amount === undefined) {
    amount = 0;
  }

  // Use a more efficient approach for zero values
  if (amount === 0) return "0.00";

  return new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2 }).format(
    amount as number
  );
};

// Memoize date color calculation
const getDateColor = (dateStr: string | null): string => {
  if (!dateStr) return "text-red-600 font-medium";
  try {
    const [day] = dateStr.split("/");
    const dayNum = parseInt(day, 10);
    if (dayNum > 9) return "text-rose-600 font-medium";
    if (dayNum >= 1 && dayNum <= 9) return "text-emerald-600 font-medium";
    return "text-slate-900 font-medium";
  } catch (e) {
    return "text-slate-900 font-medium";
  }
};

// Date formatting with placeholder for null dates
const formatDate = (date: string | null) => {
  if (!date) return "—";
  try {
    // Check if date is already in dd/mm/yyyy format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
      return date;
    }
    return format(new Date(date), "dd/MM/yyyy");
  } catch (e) {
    return date || "—";
  }
};

const taxColumns = [
  { id: "paye", name: "PAYE", headerBg: "bg-blue-100", label: "PAYE" },
  { id: "housingLevy", name: "Housing Levy", headerBg: "bg-purple-100", label: "Housing Levy" },
  { id: "nita", name: "NITA", headerBg: "bg-green-100", label: "NITA" },
  { id: "shif", name: "SHIF", headerBg: "bg-orange-100", label: "SHIF" },
  { id: "nssf", name: "NSSF", headerBg: "bg-red-100", label: "NSSF" },
] as const;

// Memoized data cell to prevent unnecessary re-renders
const DataCell = memo(({ 
  tax, 
  entry, 
  showAmount, 
  showDate,
  isLoading 
}: { 
  tax: typeof taxColumns[number], 
  entry: TaxEntry, 
  showAmount: boolean, 
  showDate: boolean,
  isLoading: boolean 
}) => (
  <React.Fragment>
    {showAmount && (
      <TableCell
        className={`text-right py-3 px-4 font-medium border-2 border-slate-300 bg-white ${isLoading ? 'animate-pulse' : ''}`}
      >
        <span className="text-slate-700">
          {isLoading ? '—' : formatAmount(entry[tax.id].amount)}
        </span>
      </TableCell>
    )}
    {showDate && (
      <TableCell
        className={`text-center py-3 px-3 border-2 border-slate-300 bg-white ${isLoading ? 'animate-pulse' : ''}`}
      >
        <span className={isLoading ? 'text-slate-400' : getDateColor(entry[tax.id].date)}>
          {isLoading ? '—' : formatDate(entry[tax.id].date)}
        </span>
      </TableCell>
    )}
  </React.Fragment>
));

DataCell.displayName = 'DataCell';

// Memoized table row component
const TableRowMemo = memo(({ 
  entry, 
  idx, 
  selectedColumns, 
  selectedSubColumns,
  isLoading
}: { 
  entry: TaxEntry, 
  idx: number, 
  selectedColumns: string[], 
  selectedSubColumns: ("amount" | "date" | "all")[],
  isLoading: boolean
}) => {
  const showAmount = selectedSubColumns.includes("all") || selectedSubColumns.includes("amount");
  const showDate = selectedSubColumns.includes("all") || selectedSubColumns.includes("date");
  
  return (
    <TableRow
      className={isLoading ? 'bg-slate-100 animate-pulse' : idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
    >
      {selectedColumns.includes("month") && (
        <TableCell className={`font-medium text-slate-700 py-3 px-5 border-2 border-slate-300 ${isLoading ? 'animate-pulse' : ''}`}>
          {isLoading ? '—' : entry.month}
        </TableCell>
      )}
      {taxColumns.map(
        (tax) =>
          selectedColumns.includes(tax.id) && (
            <DataCell 
              key={`${tax.id}-cell-${entry.month}`}
              tax={tax}
              entry={entry}
              showAmount={showAmount}
              showDate={showDate}
              isLoading={isLoading}
            />
          )
      )}
    </TableRow>
  );
});

TableRowMemo.displayName = 'TableRowMemo';

// Main DataTable component with memoization
export const DataTable = memo(({
  data,
  title,
  taxType,
  yearlyData,
  isHorizontalView,
  selectedColumns = ["month", "paye", "housingLevy", "nita", "shif", "nssf"],
  selectedSubColumns = ["all"],
  isLoading = false,
}: DataTableProps) => {
  // Calculate totals only once for better performance
  const totals = useMemo(() => {
    if (!data || data.length === 0) return {};
    
    return taxColumns.reduce((acc, tax) => {
      acc[tax.id] = data.reduce((sum, entry) => sum + (entry[tax.id]?.amount || 0), 0);
      return acc;
    }, {} as Record<string, number>);
  }, [data]);

  // Render horizontal view (yearly tables)
  if (isHorizontalView && yearlyData) {
    const years = Object.keys(yearlyData).sort().reverse();
    const months = [
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN", 
      "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    ];

    return (
      <div className="space-y-4">
        {title && (
          <h3 className="text-xl font-semibold text-slate-800 px-1">{title}</h3>
        )}
        {years.map((year) => (
          <div key={year} className="rounded-xl border-2 border-slate-300 shadow-md overflow-hidden mb-8">
            <div className="bg-blue-600 text-white py-2 px-4 text-lg font-semibold">
              {year}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead className="w-[100px] font-bold text-slate-700 py-4 px-5 border-2 border-slate-300">
                    Month
                  </TableHead>
                  {selectedColumns.slice(1).map(col => (
                    <TableHead 
                      key={col}
                      colSpan={2} 
                      className={`text-center font-bold text-slate-700 py-4 px-5 border-2 border-slate-300 ${taxColumns.find(t => t.id === col)?.headerBg}`}
                    >
                      {taxColumns.find(t => t.id === col)?.label || col.toUpperCase()}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow className="bg-slate-100">
                  <TableHead className="border-2 border-slate-300"></TableHead>
                  {selectedColumns.slice(1).map(col => (
                    <React.Fragment key={`${col}-subheaders`}>
                      <TableHead className={`font-semibold text-slate-700 text-center py-3 px-3 border-2 border-slate-300 ${taxColumns.find(t => t.id === col)?.headerBg}`}>
                        Amount
                      </TableHead>
                      <TableHead className={`font-semibold text-slate-700 text-center py-3 px-3 border-2 border-slate-300 ${taxColumns.find(t => t.id === col)?.headerBg}`}>
                        Pay Date
                      </TableHead>
                    </React.Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((month, idx) => {
                  const entry = yearlyData[year]?.find(e => e.month === month) || {
                    month,
                    paye: { amount: 0, date: null },
                    housingLevy: { amount: 0, date: null },
                    nita: { amount: 0, date: null },
                    shif: { amount: 0, date: null },
                    nssf: { amount: 0, date: null }
                  };
                  
                  return (
                    <TableRow key={`${year}-${month}`} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <TableCell className="font-medium text-slate-700 py-3 px-5 border-2 border-slate-300">
                        {month}
                      </TableCell>
                      {selectedColumns.slice(1).map(col => (
                        <React.Fragment key={`${col}-data-${month}`}>
                          <TableCell className="text-right py-3 px-4 font-medium border-2 border-slate-300 bg-white">
                            <span className="text-slate-700">
                              {formatAmount(entry[col]?.amount || 0)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-3 px-3 border-2 border-slate-300 bg-white">
                            <span className={getDateColor(entry[col]?.date)}>
                              {formatDate(entry[col]?.date)}
                            </span>
                          </TableCell>
                        </React.Fragment>
                      ))}
                    </TableRow>
                  );
                })}
                <TableRow className="bg-slate-100 font-semibold">
                  <TableCell className="py-4 px-5 text-slate-800 border-2 border-slate-300">
                    TOTAL
                  </TableCell>
                  {selectedColumns.slice(1).map(col => {
                    const total = yearlyData[year]?.reduce((sum, entry) => sum + (entry[col]?.amount || 0), 0) || 0;
                    return (
                      <React.Fragment key={`${col}-total`}>
                        <TableCell className="text-right py-4 px-4 text-slate-700 font-bold border-2 border-slate-300">
                          {formatAmount(total)}
                        </TableCell>
                        <TableCell className="border-2 border-slate-300" />
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ))}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted"></div>
                <div className="absolute top-0 left-0 animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm font-medium text-slate-800">Loading tax data...</span>
                <span className="text-xs text-slate-500">This may take a few moments</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render vertical view (single year)
  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-xl font-semibold text-slate-800 px-1">{title}</h3>
      )}
      <div className="rounded-xl border-2 border-slate-300 shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead className="w-[120px] font-bold text-slate-700 py-4 px-5 border-2 border-slate-300">
                Month
              </TableHead>
              {selectedColumns.slice(1).map(col => (
                <TableHead 
                  key={col}
                  colSpan={2} 
                  className={`text-center font-bold text-slate-700 py-4 px-5 border-2 border-slate-300 ${taxColumns.find(t => t.id === col)?.headerBg}`}
                >
                  {taxColumns.find(t => t.id === col)?.name || col.toUpperCase()}
                </TableHead>
              ))}
            </TableRow>
            <TableRow className="bg-slate-100">
              <TableHead className="border-2 border-slate-300"></TableHead>
              {selectedColumns.slice(1).map(col => (
                <React.Fragment key={`${col}-subheaders`}>
                  <TableHead className={`font-semibold text-slate-700 text-center py-3 px-3 border-2 border-slate-300 ${taxColumns.find(t => t.id === col)?.headerBg}`}>
                    Amount
                  </TableHead>
                  <TableHead className={`font-semibold text-slate-700 text-center py-3 px-3 border-2 border-slate-300 ${taxColumns.find(t => t.id === col)?.headerBg}`}>
                    Pay Date
                  </TableHead>
                </React.Fragment>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry, idx) => (
              <TableRow key={entry.month} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <TableCell className="font-medium text-slate-700 py-3 px-5 border-2 border-slate-300">
                  {entry.month}
                </TableCell>
                {selectedColumns.slice(1).map(col => (
                  <React.Fragment key={`${col}-data-${entry.month}`}>
                    <TableCell className="text-right py-3 px-4 font-medium border-2 border-slate-300 bg-white">
                      <span className="text-slate-700">
                        {formatAmount(entry[col]?.amount || 0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center py-3 px-3 border-2 border-slate-300 bg-white">
                      <span className={getDateColor(entry[col]?.date)}>
                        {formatDate(entry[col]?.date)}
                      </span>
                    </TableCell>
                  </React.Fragment>
                ))}
              </TableRow>
            ))}
            <TableRow className="bg-slate-100 font-semibold">
              <TableCell className="py-4 px-5 text-slate-800 border-2 border-slate-300">
                TOTAL
              </TableCell>
              {selectedColumns.slice(1).map(col => (
                <React.Fragment key={`${col}-total`}>
                  <TableCell className="text-right py-4 px-4 text-slate-700 font-bold border-2 border-slate-300">
                    {formatAmount(totals[col] || 0)}
                  </TableCell>
                  <TableCell className="border-2 border-slate-300" />
                </React.Fragment>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted"></div>
              <div className="absolute top-0 left-0 animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-slate-800">Loading tax data...</span>
              <span className="text-xs text-slate-500">This may take a few moments</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

DataTable.displayName = 'DataTable';