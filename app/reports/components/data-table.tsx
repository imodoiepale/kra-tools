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
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

export type TaxEntry = {
  month: string;
  paye: {
    amount: number;
    date: string | null;
    status?: string | null;
    bank?: string | null;
    payMode?: string | null;
  };
  housingLevy: {
    amount: number;
    date: string | null;
    status?: string | null;
    bank?: string | null;
    payMode?: string | null;
  };
  nita: {
    amount: number;
    date: string | null;
    status?: string | null;
    bank?: string | null;
    payMode?: string | null;
  };
  shif: {
    amount: number;
    date: string | null;
    status?: string | null;
    bank?: string | null;
    payMode?: string | null;
  };
  nssf: {
    amount: number;
    date: string | null;
    status?: string | null;
    bank?: string | null;
    payMode?: string | null;
  };
};

interface DataTableProps {
  data: any[];
  title?: string;
  taxType?: string;
  yearlyData?: Record<string, any[]>;
  isHorizontalView?: boolean;
  selectedColumns?: string[];
  selectedSubColumns?: (
    | "amount"
    | "date"
    | "status"
    | "bank"
    | "payMode"
    | "all"
  )[];
  isLoading?: boolean;
  showTotals?: boolean;
  viewMode?: "table" | "overall";
  startDate?: string;
  endDate?: string;
  getMonthsInRange?: (start: string, end: string) => any[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
  onPageChange?: (page: number) => void;
  onExport?: () => void;
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

// Memoize date color calculation for payment deadlines
// Green (1-9): Paid on time before deadline
// Red (10+): Paid late after deadline
const getDateColor = (dateStr: string | null): string => {
  if (!dateStr || dateStr === "—") return "text-red-600 font-medium";
  try {
    // Check for different date formats
    let dayNum: number;

    if (dateStr.includes("/")) {
      // Format: dd/mm/yyyy
      const [day] = dateStr.split("/");
      dayNum = parseInt(day, 10);
    } else if (dateStr.includes("-")) {
      // Format: yyyy-mm-dd
      const [_, __, day] = dateStr.split("-");
      dayNum = parseInt(day, 10);
    } else {
      // Unable to parse
      return "text-slate-900 font-medium";
    }

    // Check if date is within deadline (1-9 = on time, 10+ = late)
    if (isNaN(dayNum)) {
      return "text-slate-900 font-medium";
    } else if (dayNum >= 1 && dayNum <= 9) {
      return "text-emerald-600 font-medium"; // Green - paid on time
    } else {
      return "text-rose-600 font-medium"; // Red - late payment
    }
  } catch (e) {
    console.error("Error parsing date:", e);
    return "text-slate-900 font-medium";
  }
};

// Date formatting with placeholder for null dates - standardized to dd/mm/yyyy
const formatDate = (date: string | null) => {
  if (!date) return "—";
  try {
    // Handle empty strings or invalid dates
    if (date === "" || date === "Invalid Date") return "—";

    // If already in dd/mm/yyyy format, validate and ensure proper padding
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
      const [day, month, year] = date.split("/");
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }

    // Handle yyyy-mm-dd format
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) {
      const [year, month, day] = date.split("-");
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }

    // For any other format, parse and convert to dd/mm/yyyy
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return "—";

    const day = dateObj.getDate().toString().padStart(2, "0");
    const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
    const year = dateObj.getFullYear();

    return `${day}/${month}/${year}`;
  } catch (e) {
    console.error("Error formatting date:", date, e);
    return "—";
  }
};

const taxColumns = [
  { id: "paye", label: "PAYE" },
  { id: "housingLevy", label: "Housing Levy" },
  { id: "nita", label: "NITA" },
  { id: "shif", label: "SHIF" },
  { id: "nssf", label: "NSSF" },
] as const;

// Memoized data cell to prevent unnecessary re-renders
const DataCell = memo(
  ({
    tax,
    entry,
    selectedSubColumns,
    isLoading,
  }: {
    tax: (typeof taxColumns)[number];
    entry: TaxEntry;
    selectedSubColumns: (
      | "amount"
      | "date"
      | "status"
      | "bank"
      | "payMode"
      | "all"
    )[];
    isLoading: boolean;
  }) => {
    const showAmount =
      selectedSubColumns.includes("all") ||
      selectedSubColumns.includes("amount");
    const showDate =
      selectedSubColumns.includes("all") || selectedSubColumns.includes("date");
    const showStatus =
      selectedSubColumns.includes("all") ||
      selectedSubColumns.includes("status");
    const showBank =
      selectedSubColumns.includes("all") || selectedSubColumns.includes("bank");
    const showPayMode =
      selectedSubColumns.includes("all") ||
      selectedSubColumns.includes("payMode");

    return (
      <React.Fragment>
        {showAmount && (
          <TableCell
            className={`text-right py-3 px-4 font-medium border-2 border-slate-300 bg-white ${
              isLoading ? "animate-pulse" : ""
            }`}>
            <span className="text-slate-700">
              {isLoading ? "—" : formatAmount(entry[tax.id].amount)}
            </span>
          </TableCell>
        )}
        {showDate && (
          <TableCell
            className={`text-center py-3 px-3 border-2 border-slate-300 bg-white ${
              isLoading ? "animate-pulse" : ""
            }`}>
            <span
              className={
                isLoading ? "text-slate-400" : getDateColor(entry[tax.id].date)
              }>
              {isLoading ? "—" : formatDate(entry[tax.id].date)}
            </span>
          </TableCell>
        )}
        {showStatus && (
          <TableCell
            className={`text-center py-3 px-3 border-2 border-slate-300 bg-white ${
              isLoading ? "animate-pulse" : ""
            }`}>
            <span className="text-slate-700">
              {isLoading ? "—" : entry[tax.id].status || "—"}
            </span>
          </TableCell>
        )}
        {showBank && (
          <TableCell
            className={`text-center py-3 px-3 border-2 border-slate-300 bg-white ${
              isLoading ? "animate-pulse" : ""
            }`}>
            <span className="text-slate-700">
              {isLoading ? "—" : entry[tax.id].bank || "—"}
            </span>
          </TableCell>
        )}
        {showPayMode && (
          <TableCell
            className={`text-center py-3 px-3 border-2 border-slate-300 bg-white ${
              isLoading ? "animate-pulse" : ""
            }`}>
            <span className="text-slate-700">
              {isLoading ? "—" : entry[tax.id].payMode || "—"}
            </span>
          </TableCell>
        )}
      </React.Fragment>
    );
  }
);

DataCell.displayName = "DataCell";

// Memoized table row component
const TableRowMemo = memo(
  ({
    entry,
    idx,
    selectedColumns,
    selectedSubColumns,
    isLoading,
  }: {
    entry: TaxEntry;
    idx: number;
    selectedColumns: string[];
    selectedSubColumns: (
      | "amount"
      | "date"
      | "status"
      | "bank"
      | "payMode"
      | "all"
    )[];
    isLoading: boolean;
  }) => {
    return (
      <TableRow
        className={
          isLoading
            ? "bg-slate-100 animate-pulse"
            : idx % 2 === 0
            ? "bg-white"
            : "bg-gray-50"
        }>
        {selectedColumns.includes("month") && (
          <TableCell
            className={`font-medium text-slate-700 py-3 px-5 border-2 border-slate-300 ${
              isLoading ? "animate-pulse" : ""
            }`}>
            {isLoading ? "—" : entry.month}
          </TableCell>
        )}
        {taxColumns.map(
          (tax) =>
            selectedColumns.includes(tax.id) && (
              <DataCell
                key={`${tax.id}-cell-${entry.month}`}
                tax={tax}
                entry={entry}
                selectedSubColumns={selectedSubColumns}
                isLoading={isLoading}
              />
            )
        )}
      </TableRow>
    );
  }
);

TableRowMemo.displayName = "TableRowMemo";

// Main DataTable component with memoization
export const DataTable = memo(
  ({
    data = [],
    title,
    taxType,
    yearlyData,
    isHorizontalView = false,
    selectedColumns = ["paye", "housingLevy", "nita", "shif", "nssf"],
    selectedSubColumns = ["all"],
    isLoading = false,
    showTotals = false,
    viewMode = "table",
    startDate,
    endDate,
    getMonthsInRange,
    pagination,
    onPageChange,
    onExport,
  }: DataTableProps) => {
    // Helper function to calculate column spans
    const calculateColSpan = (subColumns) => {
      if (subColumns.includes("all")) return 5;
      let count = 0;
      if (subColumns.includes("amount")) count++;
      if (subColumns.includes("date")) count++;
      if (subColumns.includes("status")) count++;
      if (subColumns.includes("bank")) count++;
      if (subColumns.includes("payMode")) count++;
      return count || 1; // Ensure we return at least 1 for empty selections
    };

    // Calculate totals only once for better performance
    const totals = useMemo(() => {
      return data.reduce((acc, entry) => {
        selectedColumns.forEach((col) => {
          acc[col] = (acc[col] || 0) + (entry[col]?.amount || 0);
        });
        return acc;
      }, {} as Record<string, number>);
    }, [data, selectedColumns]);

    // Calculate table width based on columns
    const tableWidth = useMemo(() => {
      const baseWidth = 180; // Base width for month column
      const columnWidth = 120; // Width per tax column
      const subColumnWidth = 100; // Width per sub-column

      const totalColumns = selectedColumns.length;
      const subColumnsPerColumn = selectedSubColumns.includes("all")
        ? 5
        : selectedSubColumns.length;

      return baseWidth + totalColumns * columnWidth * subColumnsPerColumn;
    }, [selectedColumns, selectedSubColumns]);

    // If in overall view mode, render the overall table
    if (viewMode === "overall" && getMonthsInRange) {
      const visibleMonths = getMonthsInRange(
        startDate || "2015-01",
        endDate || "2025-12"
      );

      return (
        <div className="space-y-4">
          {title && (
            <h3 className="text-xl font-bold text-gray-800 mb-4">{title}</h3>
          )}

          <div className="overflow-x-auto border rounded-lg shadow">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 bg-blue-600 text-white py-3 px-4 border min-w-[200px]">
                    Month/Year
                  </TableHead>
                  {selectedColumns.map((col) => (
                    <TableHead
                      key={col}
                      colSpan={calculateColSpan(selectedSubColumns)}
                      className="bg-blue-500 text-white py-2 px-3 border text-center">
                      {taxColumns.find((t) => t.id === col)?.label}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 bg-blue-600 text-white"></TableHead>
                  {selectedColumns.map((col) => (
                    <React.Fragment key={`${col}-subheader`}>
                      {(selectedSubColumns.includes("all") ||
                        selectedSubColumns.includes("amount")) && (
                        <TableHead className="bg-blue-400 text-white py-2 px-3 border text-sm font-medium">
                          Amount
                        </TableHead>
                      )}
                      {(selectedSubColumns.includes("all") ||
                        selectedSubColumns.includes("date")) && (
                        <TableHead className="bg-blue-400 text-white py-2 px-3 border text-sm font-medium">
                          Pay Date
                        </TableHead>
                      )}
                      {(selectedSubColumns.includes("all") ||
                        selectedSubColumns.includes("status")) && (
                        <TableHead className="bg-blue-400 text-white py-2 px-3 border text-sm font-medium">
                          Status
                        </TableHead>
                      )}
                      {(selectedSubColumns.includes("all") ||
                        selectedSubColumns.includes("bank")) && (
                        <TableHead className="bg-blue-400 text-white py-2 px-3 border text-sm font-medium">
                          Bank
                        </TableHead>
                      )}
                      {(selectedSubColumns.includes("all") ||
                        selectedSubColumns.includes("payMode")) && (
                        <TableHead className="bg-blue-400 text-white py-2 px-3 border text-sm font-medium">
                          Pay Mode
                        </TableHead>
                      )}
                    </React.Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleMonths.map((month, idx) => {
                  const entry = data.find(
                    (d) => d.month === month.name.slice(0, 3).toUpperCase()
                  ) || {
                    month: month.name.slice(0, 3).toUpperCase(),
                    paye: { amount: 0, date: null },
                    housingLevy: { amount: 0, date: null },
                    nita: { amount: 0, date: null },
                    shif: { amount: 0, date: null },
                    nssf: { amount: 0, date: null },
                  };

                  return (
                    <TableRow
                      key={`${month.year}-${month.name}`}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <TableCell className="sticky left-0 z-10 py-3 px-4 border bg-blue-100 font-medium">
                        {`${month.name} ${month.year}`}
                      </TableCell>
                      {selectedColumns.map((col) => (
                        <React.Fragment
                          key={`${col}-${month.year}-${month.name}`}>
                          {(selectedSubColumns.includes("all") ||
                            selectedSubColumns.includes("amount")) && (
                            <TableCell className="py-3 px-3 border text-right">
                              {formatAmount(entry[col]?.amount || 0)}
                            </TableCell>
                          )}
                          {(selectedSubColumns.includes("all") ||
                            selectedSubColumns.includes("date")) && (
                            <TableCell className="py-3 px-3 border text-center">
                              {formatDate(entry[col]?.date)}
                            </TableCell>
                          )}
                          {(selectedSubColumns.includes("all") ||
                            selectedSubColumns.includes("status")) && (
                            <TableCell className="py-3 px-3 border text-center">
                              {entry[col]?.status || "—"}
                            </TableCell>
                          )}
                          {(selectedSubColumns.includes("all") ||
                            selectedSubColumns.includes("bank")) && (
                            <TableCell className="py-3 px-3 border text-center">
                              {entry[col]?.bank || "—"}
                            </TableCell>
                          )}
                          {(selectedSubColumns.includes("all") ||
                            selectedSubColumns.includes("payMode")) && (
                            <TableCell className="py-3 px-3 border text-center">
                              {entry[col]?.payMode || "—"}
                            </TableCell>
                          )}
                        </React.Fragment>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      );
    }

    // Render horizontal view (yearly tables)
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
            <h3 className="text-xl font-semibold text-slate-800 px-1">
              {title}
            </h3>
          )}

          <div className="rounded-xl border-2 border-slate-300 shadow-md overflow-x-auto">
            <div className="max-h-[calc(100vh-300px)] overflow-auto relative">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead
                      className="w-[180px] font-bold text-white py-4 px-5 border-2 border-slate-300 sticky left-0 bg-[#1e4d7b]"
                      rowSpan={2}>
                      Year / Month
                    </TableHead>
                    {selectedColumns.map((col) => (
                      <TableHead
                        key={col}
                        colSpan={calculateColSpan(selectedSubColumns)}
                        className="text-center font-bold text-white py-4 px-5 border-2 border-slate-300 bg-[#1e4d7b]">
                        {taxColumns.find((t) => t.id === col)?.label ||
                          col.toUpperCase()}
                      </TableHead>
                    ))}
                    <TableHead
                      className="w-[150px] font-bold text-white py-4 px-5 border-2 border-slate-300 bg-[#2a5a8c]"
                      rowSpan={2}>
                      Monthly Total
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    {selectedColumns.map((col) => (
                      <React.Fragment key={`${col}-subheaders`}>
                        {(selectedSubColumns.includes("all") ||
                          selectedSubColumns.includes("amount")) && (
                          <TableHead className="font-semibold text-white text-center py-3 px-3 border-2 border-slate-300 bg-[#2a5a8c]">
                            Amount
                          </TableHead>
                        )}
                        {(selectedSubColumns.includes("all") ||
                          selectedSubColumns.includes("date")) && (
                          <TableHead className="font-semibold text-white text-center py-3 px-3 border-2 border-slate-300 bg-[#2a5a8c]">
                            Pay Date
                          </TableHead>
                        )}
                        {(selectedSubColumns.includes("all") ||
                          selectedSubColumns.includes("status")) && (
                          <TableHead className="font-semibold text-white text-center py-3 px-3 border-2 border-slate-300 bg-[#2a5a8c]">
                            Status
                          </TableHead>
                        )}
                        {(selectedSubColumns.includes("all") ||
                          selectedSubColumns.includes("bank")) && (
                          <TableHead className="font-semibold text-white text-center py-3 px-3 border-2 border-slate-300 bg-[#2a5a8c]">
                            Bank
                          </TableHead>
                        )}
                        {(selectedSubColumns.includes("all") ||
                          selectedSubColumns.includes("payMode")) && (
                          <TableHead className="font-semibold text-white text-center py-3 px-3 border-2 border-slate-300 bg-[#2a5a8c]">
                            Pay Mode
                          </TableHead>
                        )}
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {years.map((year) => (
                    <React.Fragment key={year}>
                      <TableRow className="bg-[#eef6fc]">
                        <TableCell
                          colSpan={
                            // Calculate total columns: sum of all tax type columns + month column + total column
                            selectedColumns.reduce(
                              (sum, _) =>
                                sum + calculateColSpan(selectedSubColumns),
                              0
                            ) + 2
                          }
                          className="py-2 px-5 font-bold text-lg text-[#1e4d7b] border-2 border-slate-300 sticky left-0 bg-inherit">
                          {year}
                        </TableCell>
                      </TableRow>
                      {months.map((month, idx) => {
                        const entry = yearlyData[year]?.find(
                          (e) => e.month === month
                        ) || {
                          month,
                          paye: { amount: 0, date: null },
                          housingLevy: { amount: 0, date: null },
                          nita: { amount: 0, date: null },
                          shif: { amount: 0, date: null },
                          nssf: { amount: 0, date: null },
                        };

                        const monthlyTotal = selectedColumns.reduce(
                          (sum, col) => sum + (entry[col]?.amount || 0),
                          0
                        );

                        return (
                          <TableRow
                            key={`${year}-${month}`}
                            className={`${
                              idx % 2 === 0 ? "bg-white" : "bg-[#f8fbfe]"
                            } hover:bg-[#eef6fc] transition-colors`}>
                            <TableCell className="font-medium text-slate-700 py-3 px-5 border-2 border-slate-300 sticky left-0 bg-inherit">
                              {month}
                            </TableCell>
                            {selectedColumns.map((col) => (
                              <React.Fragment key={`${col}-data-${month}`}>
                                {(selectedSubColumns.includes("all") ||
                                  selectedSubColumns.includes("amount")) && (
                                  <TableCell className="text-right py-3 px-4 font-medium border-2 border-slate-300 bg-inherit">
                                    <span className="text-slate-700">
                                      {formatAmount(entry[col]?.amount || 0)}
                                    </span>
                                  </TableCell>
                                )}
                                {(selectedSubColumns.includes("all") ||
                                  selectedSubColumns.includes("date")) && (
                                  <TableCell className="text-center py-3 px-3 border-2 border-slate-300 bg-inherit">
                                    <span
                                      className={getDateColor(
                                        entry[col]?.date
                                      )}>
                                      {formatDate(entry[col]?.date)}
                                    </span>
                                  </TableCell>
                                )}
                                {(selectedSubColumns.includes("all") ||
                                  selectedSubColumns.includes("status")) && (
                                  <TableCell className="text-center py-3 px-3 border-2 border-slate-300 bg-inherit">
                                    <span className="text-slate-700">
                                      {entry[col]?.status || "—"}
                                    </span>
                                  </TableCell>
                                )}
                                {(selectedSubColumns.includes("all") ||
                                  selectedSubColumns.includes("bank")) && (
                                  <TableCell className="text-center py-3 px-3 border-2 border-slate-300 bg-inherit">
                                    <span className="text-slate-700">
                                      {entry[col]?.bank || "—"}
                                    </span>
                                  </TableCell>
                                )}
                                {(selectedSubColumns.includes("all") ||
                                  selectedSubColumns.includes("payMode")) && (
                                  <TableCell className="text-center py-3 px-3 border-2 border-slate-300 bg-inherit">
                                    <span className="text-slate-700">
                                      {entry[col]?.payMode || "—"}
                                    </span>
                                  </TableCell>
                                )}
                              </React.Fragment>
                            ))}
                            <TableCell className="text-right py-3 px-4 font-medium border-2 border-slate-300 bg-[#eef6fc]">
                              <span className="text-[#1e4d7b] font-bold">
                                {formatAmount(monthlyTotal)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {showTotals && (
                        <TableRow className="bg-[#eef6fc] font-semibold">
                          <TableCell className="py-4 px-5 text-[#1e4d7b] border-2 border-slate-300 sticky left-0 bg-inherit">
                            {year} TOTAL
                          </TableCell>
                          {selectedColumns.map((col) => {
                            const total =
                              yearlyData[year]?.reduce(
                                (sum, entry) => sum + (entry[col]?.amount || 0),
                                0
                              ) || 0;
                            return (
                              <React.Fragment key={`${col}-total`}>
                                {(selectedSubColumns.includes("all") ||
                                  selectedSubColumns.includes("amount")) && (
                                  <TableCell className="text-right py-4 px-4 text-[#1e4d7b] font-bold border-2 border-slate-300 bg-inherit">
                                    {formatAmount(total)}
                                  </TableCell>
                                )}
                                {(selectedSubColumns.includes("all") ||
                                  selectedSubColumns.includes("date")) && (
                                  <TableCell className="border-2 border-slate-300 bg-inherit" />
                                )}
                                {(selectedSubColumns.includes("all") ||
                                  selectedSubColumns.includes("status")) && (
                                  <TableCell className="border-2 border-slate-300 bg-inherit" />
                                )}
                                {(selectedSubColumns.includes("all") ||
                                  selectedSubColumns.includes("bank")) && (
                                  <TableCell className="border-2 border-slate-300 bg-inherit" />
                                )}
                                {(selectedSubColumns.includes("all") ||
                                  selectedSubColumns.includes("payMode")) && (
                                  <TableCell className="border-2 border-slate-300 bg-inherit" />
                                )}
                              </React.Fragment>
                            );
                          })}
                          <TableCell className="text-right py-4 px-4 font-bold border-2 border-slate-300 bg-[#2a5a8c] text-white">
                            {formatAmount(
                              selectedColumns.reduce(
                                (sum, col) =>
                                  sum +
                                  (yearlyData[year]?.reduce(
                                    (s, entry) => s + (entry[col]?.amount || 0),
                                    0
                                  ) || 0),
                                0
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted"></div>
                  <div className="absolute top-0 left-0 animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-sm font-medium text-slate-800">
                    Loading tax data...
                  </span>
                  <span className="text-xs text-slate-500">
                    This may take a few moments
                  </span>
                </div>
              </div>
            </div>
          )}
          {pagination && (
            <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
              <div className="flex items-center text-sm text-gray-700">
                <span>
                  Showing{" "}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.pageSize + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(
                      pagination.page * pagination.pageSize,
                      pagination.total
                    )}
                  </span>{" "}
                  of <span className="font-medium">{pagination.total}</span>{" "}
                  results
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange?.(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="text-sm">
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange?.(pagination.page + 1)}
                  disabled={
                    pagination.page * pagination.pageSize >= pagination.total
                  }
                  className="text-sm">
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4 h-full flex flex-col">
        {title && (
          <h3 className="text-xl font-semibold text-slate-800 px-1">{title}</h3>
        )}

        <div className="flex-grow flex flex-col rounded-xl border-2 border-slate-300 shadow-md overflow-hidden">
          <div className="flex-grow overflow-auto relative">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead
                    className="w-[120px] font-bold text-white py-4 px-5 border-2 border-slate-300 sticky left-0 bg-[#1e4d7b]"
                    rowSpan={2}>
                    Month
                  </TableHead>
                  {selectedColumns.map((col) => (
                    <TableHead
                      key={col}
                      colSpan={calculateColSpan(selectedSubColumns)}
                      className={`text-center font-bold text-white py-4 px-5 border-2 border-slate-300 bg-[#1e4d7b]`}>
                      {taxColumns.find((t) => t.id === col)?.label ||
                        col.toUpperCase()}
                    </TableHead>
                  ))}
                  <TableHead
                    className="w-[150px] font-bold text-white py-4 px-5 border-2 border-slate-300 bg-[#2a5a8c]"
                    rowSpan={2}>
                    Monthly Total
                  </TableHead>
                </TableRow>
                <TableRow>
                  {selectedColumns.map((col) => (
                    <React.Fragment key={`${col}-subheaders`}>
                      {(selectedSubColumns.includes("all") ||
                        selectedSubColumns.includes("amount")) && (
                        <TableHead className="font-semibold text-white text-center py-3 px-3 border-2 border-slate-300 bg-[#2a5a8c]">
                          Amount
                        </TableHead>
                      )}
                      {(selectedSubColumns.includes("all") ||
                        selectedSubColumns.includes("date")) && (
                        <TableHead className="font-semibold text-white text-center py-3 px-3 border-2 border-slate-300 bg-[#2a5a8c]">
                          Pay Date
                        </TableHead>
                      )}
                      {(selectedSubColumns.includes("all") ||
                        selectedSubColumns.includes("status")) && (
                        <TableHead className="font-semibold text-white text-center py-3 px-3 border-2 border-slate-300 bg-[#2a5a8c]">
                          Status
                        </TableHead>
                      )}
                      {(selectedSubColumns.includes("all") ||
                        selectedSubColumns.includes("bank")) && (
                        <TableHead className="font-semibold text-white text-center py-3 px-3 border-2 border-slate-300 bg-[#2a5a8c]">
                          Bank
                        </TableHead>
                      )}
                      {(selectedSubColumns.includes("all") ||
                        selectedSubColumns.includes("payMode")) && (
                        <TableHead className="font-semibold text-white text-center py-3 px-3 border-2 border-slate-300 bg-[#2a5a8c]">
                          Pay Mode
                        </TableHead>
                      )}
                    </React.Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((entry, idx) => {
                  const monthlyTotal = selectedColumns.reduce(
                    (sum, col) => sum + (entry[col]?.amount || 0),
                    0
                  );

                  return (
                    <TableRow
                      key={entry.month}
                      className={idx % 2 === 0 ? "bg-white" : "bg-[#f8fbfe]"}>
                      <TableCell className="font-medium text-slate-700 py-3 px-5 border-2 border-slate-300 sticky left-0 bg-inherit">
                        {entry.month}
                      </TableCell>
                      {selectedColumns.map((col) => (
                        <React.Fragment key={`${col}-data-${entry.month}`}>
                          {(selectedSubColumns.includes("all") ||
                            selectedSubColumns.includes("amount")) && (
                            <TableCell className="text-right py-3 px-4 font-medium border-2 border-slate-300 bg-inherit">
                              <span className="text-slate-700">
                                {formatAmount(entry[col]?.amount || 0)}
                              </span>
                            </TableCell>
                          )}
                          {(selectedSubColumns.includes("all") ||
                            selectedSubColumns.includes("date")) && (
                            <TableCell className="text-center py-3 px-3 border-2 border-slate-300 bg-inherit">
                              <span className={getDateColor(entry[col]?.date)}>
                                {formatDate(entry[col]?.date)}
                              </span>
                            </TableCell>
                          )}
                          {(selectedSubColumns.includes("all") ||
                            selectedSubColumns.includes("status")) && (
                            <TableCell className="text-center py-3 px-3 border-2 border-slate-300 bg-inherit">
                              <span className="text-slate-700">
                                {entry[col]?.status || "—"}
                              </span>
                            </TableCell>
                          )}
                          {(selectedSubColumns.includes("all") ||
                            selectedSubColumns.includes("bank")) && (
                            <TableCell className="text-center py-3 px-3 border-2 border-slate-300 bg-inherit">
                              <span className="text-slate-700">
                                {entry[col]?.bank || "—"}
                              </span>
                            </TableCell>
                          )}
                          {(selectedSubColumns.includes("all") ||
                            selectedSubColumns.includes("payMode")) && (
                            <TableCell className="text-center py-3 px-3 border-2 border-slate-300 bg-inherit">
                              <span className="text-slate-700">
                                {entry[col]?.payMode || "—"}
                              </span>
                            </TableCell>
                          )}
                        </React.Fragment>
                      ))}
                      <TableCell className="text-right py-3 px-4 font-medium border-2 border-slate-300 bg-[#eef6fc]">
                        <span className="text-[#1e4d7b] font-bold">
                          {formatAmount(monthlyTotal)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {showTotals && (
                  <TableRow className="bg-[#eef6fc] font-semibold">
                    <TableCell className="py-4 px-5 text-[#1e4d7b] border-2 border-slate-300 sticky left-0 bg-inherit">
                      TOTAL
                    </TableCell>
                    {selectedColumns.map((col) => (
                      <React.Fragment key={`${col}-total`}>
                        {(selectedSubColumns.includes("all") ||
                          selectedSubColumns.includes("amount")) && (
                          <TableCell className="text-right py-4 px-4 text-[#1e4d7b] font-bold border-2 border-slate-300 bg-inherit">
                            {formatAmount(totals[col] || 0)}
                          </TableCell>
                        )}
                        {(selectedSubColumns.includes("all") ||
                          selectedSubColumns.includes("date")) && (
                          <TableCell className="border-2 border-slate-300 bg-inherit" />
                        )}
                        {(selectedSubColumns.includes("all") ||
                          selectedSubColumns.includes("status")) && (
                          <TableCell className="border-2 border-slate-300 bg-inherit" />
                        )}
                        {(selectedSubColumns.includes("all") ||
                          selectedSubColumns.includes("bank")) && (
                          <TableCell className="border-2 border-slate-300 bg-inherit" />
                        )}
                        {(selectedSubColumns.includes("all") ||
                          selectedSubColumns.includes("payMode")) && (
                          <TableCell className="border-2 border-slate-300 bg-inherit" />
                        )}
                      </React.Fragment>
                    ))}
                    <TableCell className="text-right py-4 px-4 font-bold border-2 border-slate-300 bg-[#2a5a8c] text-white">
                      {formatAmount(
                        selectedColumns.reduce(
                          (sum, col) => sum + (totals[col] || 0),
                          0
                        )
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Horizontal scroll indicator */}
          <div className="h-3 bg-gray-100 border-t border-gray-200 overflow-x-auto">
            <div style={{ width: `${tableWidth}px` }} className="h-full"></div>
          </div>
        </div>
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted"></div>
                <div className="absolute top-0 left-0 animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm font-medium text-slate-800">
                  Loading tax data...
                </span>
                <span className="text-xs text-slate-500">
                  This may take a few moments
                </span>
              </div>
            </div>
          </div>
        )}
        {pagination && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
            <div className="flex items-center text-sm text-gray-700">
              <span>
                Showing{" "}
                <span className="font-medium">
                  {(pagination.page - 1) * pagination.pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {Math.min(
                    pagination.page * pagination.pageSize,
                    pagination.total
                  )}
                </span>{" "}
                of <span className="font-medium">{pagination.total}</span>{" "}
                results
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="text-sm">
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.page + 1)}
                disabled={
                  pagination.page * pagination.pageSize >= pagination.total
                }
                className="text-sm">
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

// Export function to export data as displayed in the table
const exportTableToExcel = (
  data: any[],
  yearlyData: Record<string, any[]> | null,
  selectedColumns: string[],
  selectedSubColumns: string[],
  isHorizontalView: boolean,
  visibleMonths?: any[],
  title?: string
) => {
  try {
    console.log("[DEBUG] Starting Excel export from DataTable");
    
    // Create a workbook
    const wb = XLSX.utils.book_new();
    let headers: string[] = [];
    let exportData: any[] = [];
    
    // Format data based on current view
    if (isHorizontalView && yearlyData) {
      // Horizontal view (yearly tables)
      const years = Object.keys(yearlyData).sort().reverse();
      const months = [
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
        "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
      ];
      
      // Create a sheet for each year
      years.forEach(year => {
        headers = ["Month"];
        exportData = [];
        
        // Add column headers
        selectedColumns.forEach(col => {
          const colName = taxColumns.find(t => t.id === col)?.label || col.toUpperCase();
          
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
            headers.push(`${colName} Amount`);
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
            headers.push(`${colName} Date`);
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
            headers.push(`${colName} Status`);
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
            headers.push(`${colName} Bank`);
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
            headers.push(`${colName} Pay Mode`);
          }
        });
        
        // Add a column for monthly total
        headers.push("Monthly Total");
        
        // Add data for each month
        months.forEach(month => {
          const entry = yearlyData[year]?.find(e => e.month === month) || {
            month,
            paye: { amount: 0, date: null },
            housingLevy: { amount: 0, date: null },
            nita: { amount: 0, date: null },
            shif: { amount: 0, date: null },
            nssf: { amount: 0, date: null },
          };
          
          const row: any[] = [month];
          let monthlyTotal = 0;
          
          // Add data for each selected column
          selectedColumns.forEach(col => {
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
              row.push(formatAmount(entry[col]?.amount || 0));
              monthlyTotal += (entry[col]?.amount || 0);
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
              row.push(formatDate(entry[col]?.date));
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
              row.push(entry[col]?.status || "—");
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
              row.push(entry[col]?.bank || "—");
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
              row.push(entry[col]?.payMode || "—");
            }
          });
          
          // Add monthly total
          row.push(formatAmount(monthlyTotal));
          
          exportData.push(row);
        });
        
        // Add yearly total row
        const totalRow: any[] = [`${year} TOTAL`];
        const yearlyTotals: Record<string, number> = {};
        
        // Calculate yearly totals for each tax type
        selectedColumns.forEach(col => {
          yearlyTotals[col] = yearlyData[year]?.reduce(
            (sum, entry) => sum + (entry[col]?.amount || 0), 0
          ) || 0;
        });
        
        // Add yearly totals to the row
        selectedColumns.forEach(col => {
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
            totalRow.push(formatAmount(yearlyTotals[col]));
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
            totalRow.push("");
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
            totalRow.push("");
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
            totalRow.push("");
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
            totalRow.push("");
          }
        });
        
        // Add yearly grand total
        const yearlyGrandTotal = Object.values(yearlyTotals).reduce((sum, val) => sum + val, 0);
        totalRow.push(formatAmount(yearlyGrandTotal));
        
        exportData.push(totalRow);
        
        // Create worksheet and add to workbook
        const ws = XLSX.utils.aoa_to_sheet([headers, ...exportData]);
        XLSX.utils.book_append_sheet(wb, ws, `Year ${year}`);
      });
    } else if (visibleMonths) {
      // Overall view
      headers = ["Month/Year"];
      
      // Add column headers
      selectedColumns.forEach(col => {
        const colName = taxColumns.find(t => t.id === col)?.label || col.toUpperCase();
        
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
          headers.push(`${colName} Amount`);
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
          headers.push(`${colName} Date`);
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
          headers.push(`${colName} Status`);
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
          headers.push(`${colName} Bank`);
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
          headers.push(`${colName} Pay Mode`);
        }
      });
      
      // Add data for each month
      visibleMonths.forEach(month => {
        const entry = data.find(
          (d) => d.month === month.name.slice(0, 3).toUpperCase()
        ) || {
          month: month.name.slice(0, 3).toUpperCase(),
          paye: { amount: 0, date: null },
          housingLevy: { amount: 0, date: null },
          nita: { amount: 0, date: null },
          shif: { amount: 0, date: null },
          nssf: { amount: 0, date: null },
        };
        
        const row: any[] = [`${month.name} ${month.year}`];
        
        // Add data for each selected column
        selectedColumns.forEach(col => {
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
            row.push(formatAmount(entry[col]?.amount || 0));
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
            row.push(formatDate(entry[col]?.date));
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
            row.push(entry[col]?.status || "—");
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
            row.push(entry[col]?.bank || "—");
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
            row.push(entry[col]?.payMode || "—");
          }
        });
        
        exportData.push(row);
      });
      
      // Create worksheet and add to workbook
      const ws = XLSX.utils.aoa_to_sheet([headers, ...exportData]);
      XLSX.utils.book_append_sheet(wb, ws, "Overall View");
    } else {
      // Regular table view
      headers = ["Month"];
      
      // Add column headers
      selectedColumns.forEach(col => {
        const colName = taxColumns.find(t => t.id === col)?.label || col.toUpperCase();
        
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
          headers.push(`${colName} Amount`);
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
          headers.push(`${colName} Date`);
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
          headers.push(`${colName} Status`);
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
          headers.push(`${colName} Bank`);
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
          headers.push(`${colName} Pay Mode`);
        }
      });
      
      // Add "Monthly Total" column
      headers.push("Monthly Total");
      
      // Add data for each entry
      data.forEach(entry => {
        const row: any[] = [entry.month];
        let monthlyTotal = 0;
        
        // Add data for each selected column
        selectedColumns.forEach(col => {
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
            row.push(formatAmount(entry[col]?.amount || 0));
            monthlyTotal += (entry[col]?.amount || 0);
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
            row.push(formatDate(entry[col]?.date));
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
            row.push(entry[col]?.status || "—");
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
            row.push(entry[col]?.bank || "—");
          }
          if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
            row.push(entry[col]?.payMode || "—");
          }
        });
        
        // Add monthly total
        row.push(formatAmount(monthlyTotal));
        
        exportData.push(row);
      });
      
      // Calculate totals
      const totals: Record<string, number> = {};
      data.forEach(entry => {
        selectedColumns.forEach(col => {
          totals[col] = (totals[col] || 0) + (entry[col]?.amount || 0);
        });
      });
      
      // Add total row
      const totalRow: any[] = ["TOTAL"];
      
      // Add totals for each column
      selectedColumns.forEach(col => {
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
          totalRow.push(formatAmount(totals[col] || 0));
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
          totalRow.push("");
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
          totalRow.push("");
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
          totalRow.push("");
        }
        if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
          totalRow.push("");
        }
      });
      
      // Add grand total
      const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
      totalRow.push(formatAmount(grandTotal));
      
      exportData.push(totalRow);
      
      // Create worksheet and add to workbook
      const ws = XLSX.utils.aoa_to_sheet([headers, ...exportData]);
      XLSX.utils.book_append_sheet(wb, ws, title || "Tax Report");
    }
    
    // Generate filename
    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
    const filename = `tax_report_${timestamp}.xlsx`;
    
    // Write to file and trigger download
    XLSX.writeFile(wb, filename);
    
    console.log("[DEBUG] Excel export completed");
  } catch (error) {
    console.error("Error exporting to Excel:", error);
  }
};

DataTable.displayName = "DataTable";
