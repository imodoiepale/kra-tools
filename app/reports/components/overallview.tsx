// @ts-nocheck
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useCompanyFilters } from "../hooks/useCompanyFilters";
import { Filter, Download, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientCategoryFilter } from "./client-category-filter";
import { ColumnFilter } from "./column-filter";
import { Badge } from "@/components/ui/badge";
import { useCompanyTaxReports } from "../hooks/useCompanyTaxReports";
import { DataTable } from "./data-table";

interface OverallViewProps {
  companies: Array<{
    id: number;
    name: string;
    acc_client_effective_from: string | null;
    acc_client_effective_to: string | null;
    audit_tax_client_effective_from: string | null;
    audit_tax_client_effective_to: string | null;
    cps_sheria_client_effective_from: string | null;
    cps_sheria_client_effective_to: string | null;
    imm_client_effective_from: string | null;
    imm_client_effective_to: string | null;
  }>;
  selectedColumns?: string[];
  selectedSubColumns?: (
    | "amount"
    | "date"
    | "status"
    | "bank"
    | "payMode"
    | "all"
  )[];
}

export default function OverallView({
  companies,
  selectedColumns: initialSelectedColumns = [
    "paye",
    "housingLevy",
    "nita",
    "shif",
    "nssf",
  ],
  selectedSubColumns: initialSelectedSubColumns = ["all"],
}: OverallViewProps) {
  const [selectedColumns, setSelectedColumns] = useState(
    initialSelectedColumns
  );
  const [selectedSubColumns, setSelectedSubColumns] = useState(
    initialSelectedSubColumns
  );
  const [showDetails, setShowDetails] = useState(true);
  const [showTotals, setShowTotals] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "overall" | "company">(
    "table"
  );
  const { reportData, loading: taxDataLoading } = useCompanyTaxReports();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "name", direction: "asc" });
  const [selectedFilters, setSelectedFilters] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [filteredCompanies, setFilteredCompanies] = useState(companies);

  // Add counts state
  const [counts, setCounts] = useState({
    total: companies.length,
    filtered: companies.length,
    active: 0,
    inactive: 0,
  });

  // Calculate counts whenever filters change
  useEffect(() => {
    const newCounts = {
      total: companies.length,
      filtered: filteredCompanies.length,
      active: 0,
      inactive: 0,
    };

    // Calculate active/inactive counts
    filteredCompanies.forEach((company) => {
      const now = new Date();
      const isActive = ["acc", "audit", "sheria", "imm"].some((category) => {
        const effectiveToField = `${
          category === "audit" ? "audit_tax" : category
        }_client_effective_to`;
        return (
          company[effectiveToField] === null ||
          new Date(company[effectiveToField]) > now
        );
      });

      if (isActive) {
        newCounts.active++;
      } else {
        newCounts.inactive++;
      }
    });

    setCounts(newCounts);
  }, [companies, filteredCompanies]);

  // State for date range selection
  const currentYear = new Date().getFullYear();

  const [isLoading, setIsLoading] = useState(false);
  // Get current month (1-12)
  const currentMonth = new Date().getMonth() + 1;

  // Get list of years (current year and previous years)
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  // Month names array
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Initial state for date range
  const [startDate, setStartDate] = useState(
    `${currentYear}-${currentMonth.toString().padStart(2, "0")}`
  );
  const [endDate, setEndDate] = useState(
    `${currentYear}-${currentMonth.toString().padStart(2, "0")}`
  );

  // Use company filters hook with default Accounting and Audit filters
  const {
    searchQuery,
    setSearchQuery,
    selectedFilters: filters,
    setSelectedFilters: setFilters,
    filteredCompanies: filtered,
    getFilters,
    handleFilterChange,
    isDateInRange,
    totalFilteredCount,
  } = useCompanyFilters(companies);

  // Function to generate month range - memoized
  // Function to determine date color based on day
  const getDateColor = (dateStr: string | null): string => {
    if (!dateStr) {
      return "text-red-600 font-medium";
    }
    try {
      const [day] = dateStr.split("/");
      const dayNum = parseInt(day, 10);
      if (dayNum > 9) {
        return "text-rose-600 font-medium";
      }
      if (dayNum >= 1 && dayNum <= 9) {
        return "text-emerald-600 font-medium";
      }
      return "text-slate-900 font-medium";
    } catch (e) {
      return "text-slate-900 font-medium";
    }
  };

  // Date formatting with placeholder for null dates - standardized to dd/mm/yyyy
  const formatDate = (date: string | null) => {
    if (!date) {
      return "—";
    }
    try {
      // Handle empty strings or invalid dates
      if (date === "" || date === "Invalid Date") {
        return "—";
      }

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
      if (isNaN(dateObj.getTime())) {
        return "—";
      }

      const day = dateObj.getDate().toString().padStart(2, "0");
      const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
      const year = dateObj.getFullYear();

      return `${day}/${month}/${year}`;
    } catch (e) {
      console.error("Error formatting date:", date, e);
      return "—";
    }
  };

  // Function to truncate company name to first 2 words
  const truncateCompanyName = (name: string): string => {
    const words = name.split(" ");
    return words.slice(0, 2).join(" ") + (words.length > 2 ? "..." : "");
  };

  const getMonthsInRange = React.useCallback((start: string, end: string) => {
    const startDate = new Date(start + "-01");
    const endDate = new Date(end + "-01");
    const months = [];

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      months.push({
        name: monthNames[month],
        year: year,
        label: `${monthNames[month]} ${year}`,
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return months;
  }, []);

  const visibleMonths = React.useMemo(
    () => getMonthsInRange(startDate, endDate),
    [startDate, endDate, getMonthsInRange]
  );

  // Apply date range
  const applyDateRange = () => {
    setIsLoading(true);
    // Actual data fetching is handled by useCompanyTaxReports
    setIsLoading(false);
  };

  // Helper function to calculate column spans based on selected subcolumns
  const calculateColSpan = (subColumns) => {
    if (subColumns.includes("all")) {
      return 5;
    }
    let count = 0;
    if (subColumns.includes("amount")) {
      count++;
    }
    if (subColumns.includes("date")) {
      count++;
    }
    if (subColumns.includes("status")) {
      count++;
    }
    if (subColumns.includes("bank")) {
      count++;
    }
    if (subColumns.includes("payMode")) {
      count++;
    }
    return count || 1; // Ensure we return at least 1 for empty selections
  };

  // Calculate table width based on months and selected columns/subcolumns
  const totalSubColumns = selectedColumns.reduce(
    (sum, _) => sum + calculateColSpan(selectedSubColumns),
    0
  );
  const tableWidth = visibleMonths.length * totalSubColumns * 200; // Adjust width based on visible columns

  // Enhanced search and filter functionality
  useEffect(() => {
    let filtered = [...companies];

    // Apply search filter
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((company) =>
        company.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filters
    if (Object.keys(selectedFilters).length > 0) {
      filtered = filtered.filter((company) => {
        return Object.entries(selectedFilters).some(([category, statuses]) => {
          // Skip categories where no status is selected
          if (!Object.values(statuses).some((value) => value)) {
            return false;
          }

          const now = new Date();
          let isActive = false;

          switch (category) {
            case "acc":
              isActive =
                !company.acc_client_effective_to ||
                new Date(company.acc_client_effective_to) > now;
              break;
            case "audit":
              isActive =
                !company.audit_tax_client_effective_to ||
                new Date(company.audit_tax_client_effective_to) > now;
              break;
            case "sheria":
              isActive =
                !company.cps_sheria_client_effective_to ||
                new Date(company.cps_sheria_client_effective_to) > now;
              break;
            case "imm":
              isActive =
                !company.imm_client_effective_to ||
                new Date(company.imm_client_effective_to) > now;
              break;
            case "all":
              isActive = ["acc", "audit", "sheria", "imm"].some((cat) => {
                const toField =
                  company[
                    `${cat === "audit" ? "audit_tax" : cat}_client_effective_to`
                  ];
                return !toField || new Date(toField) > now;
              });
              break;
          }

          return statuses[isActive ? "active" : "inactive"];
        });
      });
    }

    setFilteredCompanies(filtered);
  }, [companies, searchQuery, selectedFilters]);

  // Update sorting logic
  useMemo(() => {
    let sorted = [...filteredCompanies];
    if (sortConfig.key === "name") {
      sorted.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        return sortConfig.direction === "asc"
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName);
      });
    }
    return sorted;
  }, [filteredCompanies, sortConfig]);

  // Function to handle search input with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Update counts when filters change
  useEffect(() => {
    setCounts({
      total: companies.length,
      filtered: filteredCompanies.length,
      active: filteredCompanies.filter((company) =>
        ["acc", "audit", "sheria", "imm"].some((cat) => {
          const toField =
            company[
              `${cat === "audit" ? "audit_tax" : cat}_client_effective_to`
            ];
          return !toField || new Date(toField) > new Date();
        })
      ).length,
      inactive: filteredCompanies.filter(
        (company) =>
          !["acc", "audit", "sheria", "imm"].some((cat) => {
            const toField =
              company[
                `${cat === "audit" ? "audit_tax" : cat}_client_effective_to`
              ];
            return !toField || new Date(toField) > new Date();
          })
      ).length,
    });
  }, [companies, filteredCompanies]);

  // Function to handle export to Excel
  const handleExport = () => {
    try {
      const headers = ["Company"];
      const dataRows = [];

      // Add column headers based on selected columns and subcolumns
      selectedColumns.forEach((col) => {
        if (
          selectedSubColumns.includes("all") ||
          selectedSubColumns.includes("amount")
        ) {
          headers.push(`${col} Amount`);
        }
        if (
          selectedSubColumns.includes("all") ||
          selectedSubColumns.includes("date")
        ) {
          headers.push(`${col} Date`);
        }
        if (
          selectedSubColumns.includes("all") ||
          selectedSubColumns.includes("status")
        ) {
          headers.push(`${col} Status`);
        }
        if (
          selectedSubColumns.includes("all") ||
          selectedSubColumns.includes("bank")
        ) {
          headers.push(`${col} Bank`);
        }
        if (
          selectedSubColumns.includes("all") ||
          selectedSubColumns.includes("payMode")
        ) {
          headers.push(`${col} Pay Mode`);
        }
      });

      // Add data rows
      filteredCompanies.forEach((company) => {
        const row = [company.name];

        visibleMonths.forEach((month) => {
          const monthData = getMonthData(company, month);
          selectedColumns.forEach((col) => {
            if (
              selectedSubColumns.includes("all") ||
              selectedSubColumns.includes("amount")
            ) {
              row.push(monthData[col]?.amount?.toString() || "0");
            }
            if (
              selectedSubColumns.includes("all") ||
              selectedSubColumns.includes("date")
            ) {
              row.push(monthData[col]?.date || "-");
            }
            if (
              selectedSubColumns.includes("all") ||
              selectedSubColumns.includes("status")
            ) {
              row.push(monthData[col]?.status || "-");
            }
            if (
              selectedSubColumns.includes("all") ||
              selectedSubColumns.includes("bank")
            ) {
              row.push(monthData[col]?.bank || "-");
            }
            if (
              selectedSubColumns.includes("all") ||
              selectedSubColumns.includes("payMode")
            ) {
              row.push(monthData[col]?.payMode || "-");
            }
          });
        });

        dataRows.push(row);
      });

      // Create CSV content
      const csvContent = [
        headers.join(","),
        ...dataRows.map((row) => row.join(",")),
      ].join("\n");

      // Create and trigger download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `payroll_report_${startDate}_${endDate}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      // You may want to show an error toast here
    }
  };

  // Function to get month data for a company
  const getMonthData = (company, month) => {
    const companyData = reportData[company.id];
    const defaultTaxEntry = {
      amount: 0,
      date: null,
      status: null,
      bank: null,
      payMode: null,
    };

    if (!companyData || !companyData[month.year.toString()]) {
      return {
        month: month.name.slice(0, 3).toUpperCase(),
        year: month.year.toString(),
        paye: { ...defaultTaxEntry },
        housingLevy: { ...defaultTaxEntry },
        nita: { ...defaultTaxEntry },
        shif: { ...defaultTaxEntry },
        nssf: { ...defaultTaxEntry },
      };
    }

    const monthIndex = [
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
    ].indexOf(month.name.slice(0, 3).toUpperCase());

    if (monthIndex === -1) return defaultTaxEntry;

    const foundMonthData = companyData[month.year.toString()][monthIndex];
    return {
      month: month.name.slice(0, 3).toUpperCase(),
      year: month.year.toString(),
      paye: { ...defaultTaxEntry, ...foundMonthData?.paye },
      housingLevy: { ...defaultTaxEntry, ...foundMonthData?.housingLevy },
      nita: { ...defaultTaxEntry, ...foundMonthData?.nita },
      shif: { ...defaultTaxEntry, ...foundMonthData?.shif },
      nssf: { ...defaultTaxEntry, ...foundMonthData?.nssf },
    };
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header with title and controls */}
      <div className="bg-white shadow-lg p-3 border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-6">
              <h1 className="font-bold text-gray-800 text-lg">
                Payroll Report Overview
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Search input */}
              <div className="relative flex-grow max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                />
              </div>

              {/* Client Category Filter */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setIsFilterOpen(true)}>
                  <Filter className="h-4 w-4" />
                  <span>Client Category</span>
                  {Object.keys(selectedFilters).length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {Object.keys(selectedFilters).length}
                    </Badge>
                  )}
                </Button>
              </div>

              <ClientCategoryFilter
                isOpen={isFilterOpen}
                onClose={() => {
                  if (!Object.keys(selectedFilters).length) {
                    setFilteredCompanies(companies);
                  }
                  setIsFilterOpen(false);
                }}
                onClearFilters={() => {
                  setSelectedFilters({});
                  setFilteredCompanies(companies);
                }}
                onApplyFilters={(
                  filters: Record<string, Record<string, boolean>>
                ) => {
                  setSelectedFilters(filters);

                  // Reset to all companies if no filters are selected
                  if (!Object.keys(filters).length) {
                    setFilteredCompanies(companies);
                    return;
                  }

                  // Apply the selected filters
                  const filtered = companies.filter((company) => {
                    // Check if any of the selected categories match the company
                    return Object.entries(filters).some(
                      ([category, statuses]) => {
                        // Skip categories where no status is selected
                        if (!Object.values(statuses).some((value) => value)) {
                          return false;
                        }

                        const now = new Date();
                        let isActive = false;
                        let effectiveFrom = null;
                        let effectiveTo = null;

                        // Determine which category we're checking
                        switch (category) {
                          case "acc":
                            effectiveFrom = company.acc_client_effective_from;
                            effectiveTo = company.acc_client_effective_to;
                            break;
                          case "audit":
                            effectiveFrom =
                              company.audit_tax_client_effective_from;
                            effectiveTo = company.audit_tax_client_effective_to;
                            break;
                          case "sheria":
                            effectiveFrom =
                              company.cps_sheria_client_effective_from;
                            effectiveTo =
                              company.cps_sheria_client_effective_to;
                            break;
                          case "imm":
                            effectiveFrom = company.imm_client_effective_from;
                            effectiveTo = company.imm_client_effective_to;
                            break;
                          case "all":
                            // For "all" category, check if the company is active in any category
                            isActive = ["acc", "audit", "sheria", "imm"].some(
                              (cat) => {
                                const toField =
                                  company[
                                    `${
                                      cat === "audit" ? "audit_tax" : cat
                                    }_client_effective_to`
                                  ];
                                return (
                                  toField === null || new Date(toField) > now
                                );
                              }
                            );
                            break;
                        }

                        // For specific categories, determine if active based on effective dates
                        if (category !== "all") {
                          isActive =
                            effectiveTo === null || new Date(effectiveTo) > now;
                        }

                        // Check if the company's status matches any of the selected statuses
                        return statuses[isActive ? "active" : "inactive"];
                      }
                    );
                  });

                  setFilteredCompanies(filtered);
                }}
                selectedFilters={selectedFilters}
              />

              {/* Date range selector */}
              <div className="flex items-center gap-3 bg-white p-1 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <span className="text-gray-500 mx-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                  </span>
                  <label className="text-sm font-medium text-gray-700 mr-2">
                    From:
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={startDate.split("-")[0]}
                      onChange={(e) => {
                        const [_, month] = startDate.split("-");
                        setStartDate(`${e.target.value}-${month}`);
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <select
                      value={startDate.split("-")[1]}
                      onChange={(e) => {
                        const [year] = startDate.split("-");
                        setStartDate(`${year}-${e.target.value}`);
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {Array.from({ length: 12 }, (_, i) => {
                        // Adjust index to start from current month
                        const monthIndex = (currentMonth - 1 + i) % 12;
                        const month = (monthIndex + 1)
                          .toString()
                          .padStart(2, "0");
                        return (
                          <option key={month} value={month}>
                            {monthNames[monthIndex]}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="text-sm font-medium text-gray-700 mr-2">
                    To:
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={endDate.split("-")[0]}
                      onChange={(e) => {
                        const [_, month] = endDate.split("-");
                        setEndDate(`${e.target.value}-${month}`);
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <select
                      value={endDate.split("-")[1]}
                      onChange={(e) => {
                        const [year] = endDate.split("-");
                        setEndDate(`${year}-${e.target.value}`);
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {Array.from({ length: 12 }, (_, i) => {
                        // Adjust index to start from current month
                        const monthIndex = (currentMonth - 1 + i) % 12;
                        const month = (monthIndex + 1)
                          .toString()
                          .padStart(2, "0");
                        return (
                          <option key={month} value={month}>
                            {monthNames[monthIndex]}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                <button
                  onClick={applyDateRange}
                  disabled={isLoading}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 flex items-center">
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </>
                  ) : (
                    "Apply"
                  )}
                </button>
              </div>

              {/* Export and View Mode buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextMode =
                      viewMode === "table"
                        ? "overall"
                        : viewMode === "overall"
                        ? "company"
                        : "table";
                    setViewMode(nextMode);
                  }}
                  className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  {viewMode === "table"
                    ? "Overall View"
                    : viewMode === "overall"
                    ? "Company View"
                    : "Table View"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 justify-between">
            {/* Column filter controls */}
            <ColumnFilter
              columns={[
                { id: "paye", name: "PAYE" },
                { id: "housingLevy", name: "Housing Levy" },
                { id: "nita", name: "NITA" },
                { id: "shif", name: "SHIF" },
                { id: "nssf", name: "NSSF" },
              ]}
              selectedColumns={selectedColumns}
              onColumnChange={setSelectedColumns}
              selectedSubColumns={selectedSubColumns}
              onSubColumnChange={setSelectedSubColumns}
              showTotals={showTotals}
              onToggleTotals={() => setShowTotals(!showTotals)}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>
        </div>
      </div>

      {/* Table container with horizontal scrolling */}
      <div className="flex-grow overflow-auto relative">
        {viewMode === "table" ? (
          <div className="h-full relative" style={{ minWidth: `${tableWidth}px`, maxWidth: "100%" }}>
            <table className="w-full border-collapse bg-white">
              <thead className="sticky top-0 z-50">
                <tr>
                  <th className="sticky top-0 left-0 z-50 py-1 px-1.5 border border-slate-300 w-[40px] text-center bg-[#1e4d7b]">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] font-normal text-white">
                        #
                      </span>
                      <span className="text-[10px] font-normal text-white">
                        ({filteredCompanies.length})
                      </span>
                    </div>
                  </th>
                  <th
                    className="sticky top-0 left-[40px] z-50 py-1 px-1.5 border border-slate-300 min-w-[100px] max-w-[100px] text-left cursor-pointer hover:bg-[#2a5a8c] transition-colors bg-[#1e4d7b]"
                    onClick={() => {
                      setSortConfig({
                        key: "name",
                        direction:
                          sortConfig.key === "name" &&
                          sortConfig.direction === "asc"
                            ? "desc"
                            : "asc",
                      });
                    }}>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-white">Company</span>
                      {sortConfig.key === "name" && (
                        <span className="text-[10px] text-white">
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  {visibleMonths.map((month, index) => (
                    <th
                      key={index}
                      colSpan={selectedColumns.reduce(
                        (sum, _) => sum + calculateColSpan(selectedSubColumns),
                        0
                      )}
                      className={`sticky top-0 z-50 text-white py-3 px-4 border border-slate-300 text-center ${
                        index % 2 === 0 ? "bg-[#1e4d7b]" : "bg-[#2a5a8c]"
                      }`}>
                      {month.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky top-[32px] left-0 z-50 bg-[#1e4d7b] text-white py-1 px-1.5 border border-slate-300"></th>
                  <th className="sticky top-[32px] left-[40px] z-50 bg-[#1e4d7b] text-white py-1 px-1.5 border border-slate-300"></th>
                  {visibleMonths.map((_, monthIndex) => (
                    <React.Fragment key={monthIndex}>
                      {selectedColumns.map((column) => (
                        <th
                          key={column}
                          colSpan={calculateColSpan(selectedSubColumns)}
                          className="sticky top-[35px] z-50 bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-center">
                          {column === "paye"
                            ? "PAYE"
                            : column === "housingLevy"
                            ? "Housing Levy"
                            : column === "nita"
                            ? "NITA"
                            : column === "shif"
                            ? "SHIF"
                            : column === "nssf"
                            ? "NSSF"
                            : column}
                        </th>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
                <tr>
                  <th className="sticky top-[64px] left-0 z-50 bg-[#1e4d7b] text-white py-1 px-1.5 border border-slate-300"></th>
                  <th className="sticky top-[64px] left-[40px] z-50 bg-[#1e4d7b] text-white py-1 px-1.5 border border-slate-300"></th>
                  {visibleMonths.map((_, monthIndex) => (
                    <React.Fragment key={monthIndex}>
                      {selectedColumns.map((column) => (
                        <React.Fragment key={column}>
                          {selectedSubColumns.map((subColumn) =>
                            subColumn === "all" ? null : (
                              <th
                                key={`${column}-${subColumn}`}
                                className="sticky top-[70px] z-50 bg-[#2a5a8c] text-white py-1.5 px-2 border border-slate-300 text-[11px] font-medium">
                                {subColumn === "amount"
                                  ? "Amount"
                                  : subColumn === "date"
                                  ? "Pay Date"
                                  : subColumn === "status"
                                  ? "Status"
                                  : subColumn === "bank"
                                  ? "Bank"
                                  : subColumn === "payMode"
                                  ? "Pay Mode"
                                  : subColumn}
                              </th>
                            )
                          )}
                          {selectedSubColumns.includes("all") && (
                            <>
                              <th className="sticky top-[70px] z-50 bg-[#2a5a8c] text-white py-1.5 px-2 border border-slate-300 text-[11px] font-medium">
                                Amount
                              </th>
                              <th className="sticky top-[70px] z-50 bg-[#2a5a8c] text-white py-1.5 px-2 border border-slate-300 text-[11px] font-medium">
                                Pay Date
                              </th>
                              <th className="sticky top-[70px] z-50 bg-[#2a5a8c] text-white py-1.5 px-2 border border-slate-300 text-[11px] font-medium">
                                Status
                              </th>
                              <th className="sticky top-[70px] z-50 bg-[#2a5a8c] text-white py-1.5 px-2 border border-slate-300 text-[11px] font-medium">
                                Bank
                              </th>
                              <th className="sticky top-[70px] z-50 bg-[#2a5a8c] text-white py-1.5 px-2 border border-slate-300 text-[11px] font-medium">
                                Pay Mode
                              </th>
                            </>
                          )}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Display sorted companies */}
                {useMemo(() => {
                  let sortedCompanies = [...filteredCompanies];
                  if (sortConfig.key === "name") {
                    sortedCompanies.sort((a, b) => {
                      if (sortConfig.direction === "asc") {
                        return a.name.localeCompare(b.name);
                      }
                      return b.name.localeCompare(a.name);
                    });
                  }
                  return sortedCompanies;
                }, [filteredCompanies, sortConfig]).map(
                  (company, companyIndex) => (
                    <tr
                      key={company.id}
                      className={
                        companyIndex % 2 === 0
                          ? "bg-white hover:bg-blue-50"
                          : "bg-gray-50 hover:bg-blue-50"
                      }>
                      <td
                        className="sticky left-0 z-40 py-1 px-1.5 border border-slate-300 text-center text-[10px] text-slate-700"
                        style={{
                          backgroundColor:
                            companyIndex % 2 === 0 ? "white" : "#f9fafb",
                        }}>
                        {companyIndex + 1}
                      </td>
                      <td
                        className="sticky left-[40px] z-40 py-1 px-1.5 border border-slate-300 font-medium text-[10px] text-slate-700 cursor-help group"
                        style={{
                          backgroundColor:
                            companyIndex % 2 === 0 ? "white" : "#f9fafb",
                        }}>
                        <span className="block truncate w-[85px]">
                          {truncateCompanyName(company.name)}
                        </span>
                        <div
                          className="fixed z-[9999] invisible group-hover:visible bg-slate-900 text-white p-1.5 rounded shadow-lg text-[10px] max-w-xs whitespace-normal break-words"
                          style={{ transform: "translateY(-100%)" }}>
                          {company.name}
                        </div>
                      </td>

                      {/* Generate cells for all months */}
                      {visibleMonths.map((month, monthIndex) => {
                        // Get company data from reportData
                        const companyData = reportData[company.id];

                        // Create a default empty tax entry structure
                        const defaultTaxEntry = {
                          amount: 0,
                          date: null,
                          status: null,
                          bank: null,
                          payMode: null,
                        };

                        // Initialize empty month data with default tax entries
                        const emptyMonthData = {
                          month: month.name.slice(0, 3).toUpperCase(),
                          year: month.year.toString(),
                          paye: { ...defaultTaxEntry },
                          housingLevy: { ...defaultTaxEntry },
                          nita: { ...defaultTaxEntry },
                          shif: { ...defaultTaxEntry },
                          nssf: { ...defaultTaxEntry },
                        };

                        // Get actual month data if available
                        let monthData = emptyMonthData;

                        if (companyData && companyData[month.year.toString()]) {
                          const monthIndex = [
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
                          ].indexOf(month.name.slice(0, 3).toUpperCase());
                          if (
                            monthIndex !== -1 &&
                            companyData[month.year.toString()][monthIndex]
                          ) {
                            const foundMonthData =
                              companyData[month.year.toString()][monthIndex];

                            // Merge with default structure to ensure all fields exist
                            monthData = {
                              month: month.name.slice(0, 3).toUpperCase(),
                              year: month.year.toString(),
                              paye: {
                                ...defaultTaxEntry,
                                ...foundMonthData.paye,
                              },
                              housingLevy: {
                                ...defaultTaxEntry,
                                ...foundMonthData.housingLevy,
                              },
                              nita: {
                                ...defaultTaxEntry,
                                ...foundMonthData.nita,
                              },
                              shif: {
                                ...defaultTaxEntry,
                                ...foundMonthData.shif,
                              },
                              nssf: {
                                ...defaultTaxEntry,
                                ...foundMonthData.nssf,
                              },
                            };
                          }
                        }

                        const taxTypes = [
                          { key: "paye", label: "PAYE" },
                          { key: "housingLevy", label: "Housing Levy" },
                          { key: "nita", label: "NITA" },
                          { key: "shif", label: "SHIF" },
                          { key: "nssf", label: "NSSF" },
                        ];

                        return (
                          <React.Fragment key={monthIndex}>
                            {taxTypes
                              .filter((tax) =>
                                selectedColumns.includes(tax.key)
                              )
                              .map((tax) => (
                                <React.Fragment key={tax.key}>
                                  {(selectedSubColumns.includes("all") ||
                                    selectedSubColumns.includes("amount")) && (
                                    <td
                                      className={`py-1.5 px-2 border border-slate-300 text-right text-[11px] ${
                                        monthData?.[tax.key]?.amount
                                          ? "font-medium text-slate-700"
                                          : "text-slate-500"
                                      }`}>
                                      {monthData?.[
                                        tax.key
                                      ]?.amount?.toLocaleString("en-KE", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }) ?? "0.00"}
                                    </td>
                                  )}
                                  {(selectedSubColumns.includes("all") ||
                                    selectedSubColumns.includes("date")) && (
                                    <td
                                      className={`py-1.5 px-2 border border-slate-300 text-center text-[11px] ${
                                        monthData?.[tax.key]?.date
                                          ? getDateColor(
                                              monthData[tax.key].date
                                            )
                                          : "text-slate-400"
                                      }`}>
                                      {monthData?.[tax.key]?.date
                                        ? formatDate(monthData[tax.key].date)
                                        : "—"}
                                    </td>
                                  )}
                                  {(selectedSubColumns.includes("all") ||
                                    selectedSubColumns.includes("status")) && (
                                    <td
                                      className={`py-1.5 px-2 border border-slate-300 text-center text-[11px] ${
                                        monthData?.[tax.key]?.status
                                          ? "font-medium text-slate-700"
                                          : "text-slate-500"
                                      }`}>
                                      {monthData?.[tax.key]?.status ?? "—"}
                                    </td>
                                  )}
                                  {(selectedSubColumns.includes("all") ||
                                    selectedSubColumns.includes("bank")) && (
                                    <td
                                      className={`py-1.5 px-2 border border-slate-300 text-center text-[11px] ${
                                        monthData?.[tax.key]?.bank
                                          ? "font-medium text-slate-700"
                                          : "text-slate-500"
                                      }`}>
                                      {monthData?.[tax.key]?.bank ?? "—"}
                                    </td>
                                  )}
                                  {(selectedSubColumns.includes("all") ||
                                    selectedSubColumns.includes("payMode")) && (
                                    <td
                                      className={`py-1.5 px-2 border border-slate-300 text-center text-[11px] ${
                                        monthData?.[tax.key]?.payMode
                                          ? "font-medium text-slate-700"
                                          : "text-slate-500"
                                      }`}>
                                      {monthData?.[tax.key]?.payMode ?? "—"}
                                    </td>
                                  )}
                                </React.Fragment>
                              ))}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  )
                )}

                {/* Empty state handling */}
                {filteredCompanies.length === 0 && (
                  <tr>
                    <td
                      colSpan={
                        visibleMonths.length *
                          selectedColumns.reduce(
                            (sum, _) =>
                              sum + calculateColSpan(selectedSubColumns),
                            0
                          ) +
                        2
                      }
                      className="text-center py-10 text-gray-500">
                      No companies found matching your search criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <DataTable 
            data={filteredCompanies}
            selectedColumns={selectedColumns}
            selectedSubColumns={selectedSubColumns}
            viewMode={viewMode}
            showTotals={showTotals}
            startDate={startDate}
            endDate={endDate}
            getMonthsInRange={getMonthsInRange}
            isLoading={isLoading}
            yearlyData={reportData}
            isHorizontalView={viewMode === "company"}
          />
        )}
      </div>

      {/* Footer */}
      <div className="bg-white shadow-lg p-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
            <span className="font-medium">{totalFilteredCount}</span> companies
          </div>
        </div>
        <div className="flex items-center justify-between gap-8">
          <div className="bg-indigo-50 py-1 px-3 rounded-full text-indigo-700 font-medium text-xs">
            {visibleMonths.length > 0 && (
              <>
                {visibleMonths[0]?.label} to{" "}
                {visibleMonths[visibleMonths.length - 1]?.label}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
