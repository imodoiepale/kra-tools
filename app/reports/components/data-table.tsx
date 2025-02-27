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
import React from "react";

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
}

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

  return new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2 }).format(
    amount as number
  );
};

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

const formatDate = (date: string | null) => {
  if (!date) return "—";
  try {
    return format(new Date(date), "dd/MM/yyyy");
  } catch (e) {
    return date;
  }
};

const taxColumns = [
  { id: "paye", name: "PAYE", headerBg: "bg-blue-100" },
  { id: "housingLevy", name: "Housing Levy", headerBg: "bg-purple-100" },
  { id: "nita", name: "NITA", headerBg: "bg-green-100" },
  { id: "shif", name: "SHIF", headerBg: "bg-orange-100" },
  { id: "nssf", name: "NSSF", headerBg: "bg-red-100" },
] as const;

export function DataTable({
  data,
  title,
  taxType,
  yearlyData,
  isHorizontalView,
  selectedColumns = ["month", "paye", "housingLevy", "nita", "shif", "nssf"],
}: DataTableProps) {
  if (isHorizontalView && yearlyData) {
    const years = Object.keys(yearlyData).sort().reverse();
    const months = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];

    return (
      <div className="space-y-4">
        {title && (
          <h3 className="text-xl font-semibold text-slate-800 px-1">{title}</h3>
        )}
        <div className="rounded-xl border-2 border-slate-300 shadow-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100">
                {selectedColumns.includes("month") && (
                  <TableHead className="w-[120px] font-bold text-slate-700 py-4 px-5 border-2 border-slate-300">
                    MONTH
                  </TableHead>
                )}
                {years.map((year) => (
                  <TableHead
                    key={year}
                    className="text-center font-bold text-slate-700 py-4 px-5 border-2 border-slate-300"
                  >
                    {year}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((month, idx) => (
                <TableRow
                  key={month}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {selectedColumns.includes("month") && (
                    <TableCell className="font-medium text-slate-700 py-3 px-5 border-2 border-slate-300">
                      {month}
                    </TableCell>
                  )}
                  {years.map((year) => {
                    const entry = yearlyData[year].find(
                      (e) => e.month === month
                    );
                    const amount = entry ? entry[taxType!].amount : 0;
                    return (
                      <TableCell
                        key={year}
                        className="text-center py-3 px-5 border-2 border-slate-300 bg-white"
                      >
                        {formatAmount(amount)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              <TableRow className="bg-slate-100 font-semibold">
                <TableCell className="py-4 px-5 text-slate-800 border-2 border-slate-300">
                  TOTAL
                </TableCell>
                {years.map((year) => (
                  <TableCell
                    key={year}
                    className="text-center py-4 px-5 text-slate-800 border-2 border-slate-300"
                  >
                    {formatAmount(
                      yearlyData[year].reduce(
                        (sum, entry) => sum + entry[taxType!].amount,
                        0
                      )
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-xl font-semibold text-slate-800 px-1">{title}</h3>
      )}
      <div className="rounded-xl border-2 border-slate-300 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                {selectedColumns.includes("month") && (
                  <TableHead
                    rowSpan={2}
                    className="w-[100px] bg-slate-100 font-bold text-slate-700 py-4 px-5 border-2 border-slate-300"
                  >
                    Month
                  </TableHead>
                )}
                {taxColumns.map(
                  (tax) =>
                    selectedColumns.includes(tax.id) && (
                      <TableHead
                        key={`${tax.id}-name`}
                        colSpan={2}
                        className={`font-bold text-slate-700 text-center py-4 px-3 border-2 border-slate-300 ${tax.headerBg}`}
                      >
                        {tax.name}
                      </TableHead>
                    )
                )}
              </TableRow>
              <TableRow>
                {taxColumns.map(
                  (tax) =>
                    selectedColumns.includes(tax.id) && (
                      <React.Fragment key={`${tax.id}-header-fragment`}>
                        <TableHead
                          key={`${tax.id}-amount-header`}
                          className={`font-semibold text-slate-700 text-center py-3 px-3 border-2 border-slate-300 ${tax.headerBg}`}
                        >
                          Amount
                        </TableHead>
                        <TableHead
                          key={`${tax.id}-date-header`}
                          className={`font-semibold text-slate-700 text-center py-3 px-3 border-2 border-slate-300 ${tax.headerBg}`}
                        >
                          Pay Date
                        </TableHead>
                      </React.Fragment>
                    )
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((entry, idx) => (
                <TableRow
                  key={entry.month}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {selectedColumns.includes("month") && (
                    <TableCell className="font-medium text-slate-700 py-3 px-5 border-2 border-slate-300">
                      {entry.month}
                    </TableCell>
                  )}
                  {taxColumns.map(
                    (tax) =>
                      selectedColumns.includes(tax.id) && (
                        <React.Fragment key={`${tax.id}-fragment`}>
                          <TableCell
                            key={`${tax.id}-amount-${entry.month}`}
                            className="text-right py-3 px-4 font-medium border-2 border-slate-300 bg-white"
                          >
                            <span className="text-slate-700">
                              {formatAmount(entry[tax.id].amount)}
                            </span>
                          </TableCell>
                          <TableCell
                            key={`${tax.id}-date-${entry.month}`}
                            className="text-center py-3 px-3 border-2 border-slate-300 bg-white"
                          >
                            <span className={getDateColor(entry[tax.id].date)}>
                              {formatDate(entry[tax.id].date)}
                            </span>
                          </TableCell>
                        </React.Fragment>
                      )
                  )}
                </TableRow>
              ))}
              <TableRow className="bg-slate-100 font-semibold">
                <TableCell className="py-4 px-5 text-slate-800 border-2 border-slate-300">
                  TOTAL
                </TableCell>
                {taxColumns.map(
                  (tax) =>
                    selectedColumns.includes(tax.id) && (
                      <React.Fragment key={`${tax.id}-total-fragment`}>
                        <TableCell
                          key={`${tax.id}-amount-total`}
                          className="text-right py-4 px-4 text-slate-700 font-bold border-2 border-slate-300"
                        >
                          {formatAmount(
                            data.reduce((sum, e) => sum + e[tax.id].amount, 0)
                          )}
                        </TableCell>
                        <TableCell
                          key={`${tax.id}-date-total`}
                          className="border-2 border-slate-300"
                        />
                      </React.Fragment>
                    )
                )}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
