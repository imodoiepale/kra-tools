// @ts-nocheck
"use client";
import { useCompanyFilters } from "./hooks/useCompanyFilters";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "./components/data-table";
import { Input } from "@/components/ui/input";
import { useCompanyTaxReports } from "./hooks/useCompanyTaxReports";
import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Filter } from "lucide-react";
import { ClientCategoryFilter } from "./components/client-category-filter";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import OverallView from "./components/overallview";

// Configure the query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15 * 60 * 1000, // 15 minutes
      cacheTime: 24 * 60 * 60 * 1000, // 24 hours
      retry: 1,
      retryDelay: 1000,
      keepPreviousData: true,
    },
  },
});

const taxTypes = [
  { id: "all", name: "All Taxes" },
  { id: "paye", name: "PAYE" },
  { id: "housingLevy", name: "Housing Levy" },
  { id: "nita", name: "NITA" },
  { id: "shif", name: "SHIF" },
  { id: "nssf", name: "NSSF" },
] as const;

export default function CompanyReportsWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <CompanyReports />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

function CompanyReports() {
  const {
    companies,
    reportData,
    selectedCompany,
    setSelectedCompany,
    loading,
    selectedColumns,
    setSelectedColumns,
    prefetchCompanyData,
    clearCache,
  } = useCompanyTaxReports();

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const {
    searchQuery,
    setSearchQuery,
    selectedFilters,
    setSelectedFilters,
    filteredCompanies,
    getFilters,
    handleFilterChange,
    isDateInRange,
  } = useCompanyFilters(companies || []);  // Provide empty array as fallback

  const selectedCompanyName = useMemo(() => {
    if (!Array.isArray(companies)) return '';
    const company = companies.find((c) => c?.id === selectedCompany);
    return company?.name || '';
  }, [companies, selectedCompany]);

  const [selectedSubColumns, setSelectedSubColumns] = useState<
    ("amount" | "date" | "status" | "bank" | "payMode" | "all")[]>([
    "amount", "date" // By default only show Amount and Pay Date
  ]);
  const [taxDropdownOpen, setTaxDropdownOpen] = useState(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false);
  const [showTotals, setShowTotals] = useState(true);

  // Store the last valid company data to avoid UI flashing
  const [stableReportData, setStableReportData] = useState({});

  // Update stableReportData when reportData changes and has content
  useEffect(() => {
    if (reportData && Object.keys(reportData).length > 0) {
      setStableReportData(reportData);
    }
  }, [reportData]);

  // Enhanced period selection
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [isRangeView, setIsRangeView] = useState(false);
  const [isOverallView, setIsOverallView] = useState(false);
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(1);
  const [endYear, setEndYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(currentMonth);

  // Generate years list (from 2015 to current year)
  const years = useMemo(() => {
    const yearsList = [];
    for (let year = currentYear; year >= 2015; year--) {
      yearsList.push(year);
    }
    return yearsList;
  }, [currentYear]);

  // Generate all months
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Date(2000, i)
        .toLocaleString("default", { month: "short" })
        .toUpperCase(),
    }));
  }, []);

  // Update period selection UI
  const periodSelectionUI = (
    <div className="space-y-4 mb-4">
      <div className="flex items-center gap-4">
        <Select
          value={selectedYear.toString()}
          onValueChange={(value) => setSelectedYear(Number(value))}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={monthDropdownOpen}
            className="w-[200px] justify-between"
            onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}>
            {selectedMonths.length === 0
              ? "Select months..."
              : selectedMonths.length === months.length
              ? "All months"
              : `${selectedMonths.length} month${
                  selectedMonths.length === 1 ? "" : "s"
                } selected`}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
          {monthDropdownOpen && (
            <div className="absolute top-full z-50 w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  className="justify-start font-normal"
                  onClick={() => {
                    setSelectedMonths(
                      selectedMonths.length === months.length
                        ? []
                        : months.map((m) => m.value)
                    );
                    setMonthDropdownOpen(false);
                  }}>
                  {selectedMonths.length === months.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
                {months.map((month) => (
                  <div
                    key={month.value}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer"
                    onClick={() => {
                      setSelectedMonths((prev) =>
                        prev.includes(month.value)
                          ? prev.filter((m) => m !== month.value)
                          : [...prev, month.value].sort((a, b) => a - b)
                      );
                    }}>
                    <Checkbox
                      checked={selectedMonths.includes(month.value)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{month.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className={`${!isRangeView && !isOverallView ? "bg-blue-50" : ""}`}
            onClick={() => {
              setIsRangeView(false);
              setIsOverallView(false);
            }}>
            Single Year
          </Button>
          <Button
            variant="outline"
            className={`${isRangeView ? "bg-blue-50" : ""}`}
            onClick={() => {
              setIsRangeView(true);
              setIsOverallView(false);
            }}>
            Range View
          </Button>
          <Button
            variant="outline"
            className={`${isOverallView ? "bg-blue-50" : ""}`}
            onClick={() => {
              setIsRangeView(false);
              setIsOverallView(true);
            }}>
            Overall View
          </Button>
        </div>
      </div>

      {isRangeView && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">From:</span>
            <Select
              value={startYear.toString()}
              onValueChange={(value) => setStartYear(Number(value))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={startMonth.toString()}
              onValueChange={(value) => setStartMonth(Number(value))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">To:</span>
            <Select
              value={endYear.toString()}
              onValueChange={(value) => setEndYear(Number(value))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years
                  .filter((year) => year >= startYear)
                  .map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select
              value={endMonth.toString()}
              onValueChange={(value) => setEndMonth(Number(value))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem
                    key={month.value}
                    value={month.value.toString()}
                    disabled={
                      endYear === currentYear && month.value > currentMonth
                    }>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );

  // Get data to display with period filtering
  const displayData = useMemo(() => {
    if (isOverallView) {
      // Overall view logic - combine data from all available years
      const yearlyData: Record<string, any[]> = {};

      // Get all available years from both current and stable data
      const allYears = [
        ...new Set([
          ...Object.keys(reportData),
          ...Object.keys(stableReportData),
        ]),
      ].sort();

      allYears.forEach((year) => {
        const yearData = reportData[year] || stableReportData[year] || [];
        yearlyData[year] = yearData;
      });

      return yearlyData;
    } else if (isRangeView) {
      // Range view logic
      const yearlyData: Record<string, any[]> = {};

      // Create entries for all years in range, even if empty
      for (let year = startYear; year <= endYear; year++) {
        const yearData =
          reportData[year.toString()] ||
          stableReportData[year.toString()] ||
          [];

        const filteredData = yearData.filter((entry) => {
          const entryMonth =
            months.findIndex((m) => m.label === entry.month) + 1;

          if (year === startYear && year === endYear) {
            return entryMonth >= startMonth && entryMonth <= endMonth;
          } else if (year === startYear) {
            return entryMonth >= startMonth;
          } else if (year === endYear) {
            return entryMonth <= endMonth;
          }
          return true;
        });

        // Always include the year in the data, even if empty
        yearlyData[year.toString()] = filteredData;
      }

      return yearlyData;
    } else {
      // Single year view logic
      const yearData =
        reportData[selectedYear.toString()] ||
        stableReportData[selectedYear.toString()] ||
        [];

      // If no months are explicitly selected and it's current year,
      // show data up to current month by default
      if (selectedMonths.length === 0 && selectedYear === currentYear) {
        return yearData.filter((entry) => {
          const entryMonth =
            months.findIndex((m) => m.label === entry.month) + 1;
          return entryMonth <= currentMonth;
        });
      }

      // If specific months are selected, filter by those months
      if (selectedMonths.length > 0) {
        return yearData.filter((entry) => {
          const entryMonth =
            months.findIndex((m) => m.label === entry.month) + 1;
          return selectedMonths.includes(entryMonth);
        });
      }

      // Otherwise show all data for the selected year
      return yearData;
    }
  }, [
    reportData,
    stableReportData,
    selectedYear,
    selectedMonths,
    months,
    currentYear,
    currentMonth,
    isRangeView,
    isOverallView,
    startYear,
    startMonth,
    endYear,
    endMonth,
  ]);

  const getTruncatedCompanyName = (name: string) => {
    const words = name.split(" ");
    return {
      short: words.slice(0, 2).join(" "),
      full: name,
    };
  };

  const getFilteredColumns = () => {
    if (selectedColumns.includes("all")) return selectedColumns;
    return ["month", ...selectedColumns];
  };

  // Enhanced export function with better error handling and formatting
  const exportToExcel = useCallback(() => {
    try {
      console.log("[DEBUG] Starting Excel export");
      
      // Create a workbook and worksheet
      const wb = XLSX.utils.book_new();
      
      if (isRangeView && displayData) {
        // Range view - create a sheet for each year
        const years = Object.keys(displayData).sort();
        const months = [
          "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
          "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
        ];
        
        years.forEach(year => {
          const headers = ["Month"];
          const dataRows = [];
          
          // Add column headers
          selectedColumns.filter(col => col !== "month").forEach(col => {
            const colName = taxTypes.find(t => t.id === col)?.name || col.toUpperCase();
            
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
          
          // Add data for each month
          months.forEach(month => {
            const entry = displayData[year]?.find(e => e.month === month) || {
              month,
              paye: { amount: 0, date: null, status: null, bank: null, payMode: null },
              housingLevy: { amount: 0, date: null, status: null, bank: null, payMode: null },
              nita: { amount: 0, date: null, status: null, bank: null, payMode: null },
              shif: { amount: 0, date: null, status: null, bank: null, payMode: null },
              nssf: { amount: 0, date: null, status: null, bank: null, payMode: null }
            };
            
            const row = [month];
            let monthlyTotal = 0;
            
            // Add data for each selected column
            selectedColumns.filter(col => col !== "month").forEach(col => {
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
                row.push(formatAmount(entry[col]?.amount || 0));
                monthlyTotal += (entry[col]?.amount || 0);
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
                row.push(entry[col]?.date ? formatDate(entry[col]?.date) : "-");
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
                row.push(entry[col]?.status || "-");
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
                row.push(entry[col]?.bank || "-");
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
                row.push(entry[col]?.payMode || "-");
              }
            });
            
            // Add monthly total
            row.push(formatAmount(monthlyTotal));
            
            dataRows.push(row);
          });
          
          // Add yearly total row
          const totalRow = [`${year} TOTAL`];
          const yearlyTotals = {};
          
          // Calculate yearly totals for each tax type
          selectedColumns.filter(col => col !== "month").forEach(col => {
            yearlyTotals[col] = displayData[year]?.reduce(
              (sum, entry) => sum + (entry[col]?.amount || 0), 0
            ) || 0;
          });
          
          // Add yearly totals to the row
          selectedColumns.filter(col => col !== "month").forEach(col => {
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
          
          dataRows.push(totalRow);
          
          // Create worksheet and add to workbook
          const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
          XLSX.utils.book_append_sheet(wb, ws, `Year ${year}`);
        });
      } else {
        // Single year view
        const headers = ["Month"];
        const dataRows = [];
        
        // Add column headers
        selectedColumns.filter(col => col !== "month").forEach(col => {
          const colName = taxTypes.find(t => t.id === col)?.name || col.toUpperCase();
          
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
        displayData.forEach(entry => {
          const row = [entry.month];
          let monthlyTotal = 0;
          
          // Add data for each selected column
          selectedColumns.filter(col => col !== "month").forEach(col => {
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
              row.push(formatAmount(entry[col]?.amount || 0));
              monthlyTotal += (entry[col]?.amount || 0);
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
              row.push(entry[col]?.date ? formatDate(entry[col]?.date) : "-");
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
              row.push(entry[col]?.status || "-");
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
              row.push(entry[col]?.bank || "-");
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
              row.push(entry[col]?.payMode || "-");
            }
          });
          
          // Add monthly total
          row.push(formatAmount(monthlyTotal));
          
          dataRows.push(row);
        });
        
        // Calculate totals
        const totals = {};
        displayData.forEach(entry => {
          selectedColumns.filter(col => col !== "month").forEach(col => {
            totals[col] = (totals[col] || 0) + (entry[col]?.amount || 0);
          });
        });
        
        // Add total row
        const totalRow = ["TOTAL"];
        
        // Add totals for each column
        selectedColumns.filter(col => col !== "month").forEach(col => {
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
        
        dataRows.push(totalRow);
        
        // Create worksheet and add to workbook
        const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
        
        // Add worksheet name and company details
        const sheetName =
          selectedCompanyName.length > 30
            ? `${selectedCompanyName.substring(0, 27)}...`
            : selectedCompanyName;
        
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
      
      // Generate filename with sanitized company name and date range
      const sanitizedCompanyName = selectedCompanyName.replace(/[^a-z0-9]/gi, "_");
      let filename;
      
      if (isRangeView) {
        filename = `${sanitizedCompanyName}_${startYear}-${startMonth}_to_${endYear}-${endMonth}_tax_report.xlsx`;
      } else {
        filename = `${sanitizedCompanyName}_${selectedYear}_tax_report.xlsx`;
      }
      
      // Write to file and trigger download
      XLSX.writeFile(wb, filename);
      
      console.log("[DEBUG] Excel export completed");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      // You can add a toast notification here to show the error
    }
  }, [
    isRangeView,
    displayData,
    selectedYear,
    startYear,
    startMonth,
    endYear,
    endMonth,
    selectedCompanyName,
    selectedColumns,
    selectedSubColumns,
  ]);
  
  // Helper functions for formatting
  const formatAmount = (amount) => {
    if (typeof amount === "string") {
      const cleanedStr = amount.replace(/[^0-9.-]/g, "");
      amount = parseFloat(cleanedStr) || 0;
    }
    if (isNaN(amount) || amount === undefined) {
      amount = 0;
    }
    if (amount === 0) return "0.00";
    return new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2 }).format(amount);
  };
  
  const formatDate = (date) => {
    if (!date) return "—";
    try {
      if (date === "" || date === "Invalid Date") return "—";
      
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
        const [day, month, year] = date.split("/");
        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      }
      
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) {
        const [year, month, day] = date.split("-");
        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      }
      
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

  // When in overall view, render the OverallView component
  if (isOverallView) {
    return (
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Overall View</h2>
          <Button
            onClick={() => {
              // Export functionality for OverallView will be handled by the component itself
              const exportButton = document.querySelector('.overallview-export-button');
              if (exportButton) {
                exportButton.click();
              }
            }}
            variant="outline"
            className="ml-auto">
            Export to Excel
          </Button>
        </div>
        <OverallView 
          companies={filteredCompanies} 
          initialSearchQuery={searchQuery}
          initialSelectedFilters={Object.fromEntries(
            selectedFilters.map(filter => [filter, { active: true, inactive: false }])
          )}
          onSearchChange={setSearchQuery}
          onFilterChange={(filters) => {
            const selectedCategories = Object.entries(filters)
              .filter(([_, value]) => Object.values(value).some(v => v))
              .map(([key]) => key);
            setSelectedFilters(selectedCategories);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen max-h-screen">
      <div className="w-48 border-r p-2">
        <div className="space-y-2 mb-4">
          <h2 className="font-bold text-xs text-blue-700">Filtered Companies {filteredCompanies.length}</h2>
          <div className="space-y-2">
            <Input
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 flex items-center justify-between text-xs"
              onClick={() => setIsFilterOpen(true)}
            >
              <div className="flex items-center">
                <Filter className="mr-2 h-3 w-3" />
                Service Categories
              </div>
              {selectedFilters.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedFilters.length}
                </Badge>
              )}
            </Button>

            <ClientCategoryFilter
              isOpen={isFilterOpen}
              onClose={() => setIsFilterOpen(false)}
              onApplyFilters={(filters) => {
                const selectedCategories = Object.entries(filters)
                  .filter(([_, value]) => Object.values(value).some(v => v))
                  .map(([key]) => key);
                setSelectedFilters(selectedCategories);
              }}
              onClearFilters={() => setSelectedFilters([])}
              selectedFilters={Object.fromEntries(
                selectedFilters.map(filter => [
                  filter,
                  { active: true }
                ])
              )}
            />
          </div>
        </div>
        <ScrollArea className="h-[calc(100vh-8rem)]">
          {loading && companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-xs text-muted-foreground">
                Loading companies...
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredCompanies.map((company, index) => {
                const { short, full } = getTruncatedCompanyName(company.name);
                return (
                  <div
                    key={company.id}
                    className={`p-1.5 cursor-pointer text-xs transition-all group relative rounded-md ${
                      selectedCompany === company.id
                        ? "bg-blue-500 text-white border border-blue-600"
                        : "hover:border hover:border-muted-foreground/20"
                    }`}
                    onClick={() => setSelectedCompany(company.id)}
                    onMouseEnter={() => prefetchCompanyData(company.id, index)}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground text-[10px] w-4">
                        {index + 1}.
                      </span>
                      <span className="truncate">{short}</span>
                    </div>
                    {full !== short && (
                      <div className="absolute z-50 left-full ml-2 invisible group-hover:visible bg-popover border rounded-md p-2 mt-1 shadow-lg text-xs">
                        {full}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Debug button - can be removed in production */}
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full text-xs hidden" // hidden by default
          onClick={clearCache}>
          Clear Cache (Debug)
        </Button>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {loading && Object.keys(stableReportData).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-muted-foreground">Loading tax data...</p>
          </div>
        ) : selectedCompany ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedCompanyName}</h2>
              <Button
                onClick={exportToExcel}
                variant="outline"
                className="ml-auto">
                Export to Excel
              </Button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <DropdownMenu
                  open={taxDropdownOpen}
                  onOpenChange={setTaxDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[180px] justify-between">
                      Select Taxes
                      <span className="text-xs text-muted-foreground">
                        ({selectedColumns.length - 1} selected)
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[180px]"
                    onInteractOutside={(e) => {
                      // Only close if clicking outside both dropdowns
                      if (!e.target.closest('[role="dialog"]')) {
                        setTaxDropdownOpen(false);
                      }
                    }}>
                    <DropdownMenuLabel className="flex items-center justify-between">
                      Tax Types
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          if (selectedColumns.length === taxTypes.length) {
                            setSelectedColumns(["month"]);
                          } else {
                            setSelectedColumns([
                              "month",
                              ...taxTypes.slice(1).map((t) => t.id),
                            ]);
                          }
                        }}>
                        {selectedColumns.length === taxTypes.length
                          ? "Unselect All"
                          : "Select All"}
                      </Button>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {taxTypes.slice(1).map((tax) => (
                      <DropdownMenuCheckboxItem
                        key={tax.id}
                        checked={selectedColumns.includes(tax.id)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedColumns([...selectedColumns, tax.id]);
                          } else {
                            setSelectedColumns(
                              selectedColumns.filter((col) => col !== tax.id)
                            );
                          }
                        }}>
                        {tax.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu
                  open={columnDropdownOpen}
                  onOpenChange={setColumnDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[180px] justify-between">
                      Tax Fields
                      <span className="text-xs text-muted-foreground">
                        {selectedSubColumns.includes("all")
                          ? "(All)"
                          : `(${selectedSubColumns.length} selected)`}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[180px]"
                    onInteractOutside={(e) => {
                      // Only close if clicking outside both dropdowns
                      if (!e.target.closest('[role="dialog"]')) {
                        setColumnDropdownOpen(false);
                      }
                    }}>
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          if (selectedSubColumns.includes("all")) {
                            setSelectedSubColumns(["amount", "date"]);
                          } else {
                            setSelectedSubColumns(["all"]);
                          }
                        }}>
                        {selectedSubColumns.includes("all")
                          ? "Show Custom"
                          : "Show All"}
                      </Button>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={selectedSubColumns.includes("all")}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSubColumns(["all"]);
                        } else {
                          setSelectedSubColumns(["amount", "date"]);
                        }
                      }}>
                      All Details
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={
                        selectedSubColumns.includes("amount") ||
                        selectedSubColumns.includes("all")
                      }
                      disabled={selectedSubColumns.includes("all")}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) => {
                        if (selectedSubColumns.includes("all")) return;
                        
                        if (checked) {
                          setSelectedSubColumns((prev) => 
                            [...prev.filter(col => col !== "all" && col !== "amount"), "amount"]
                          );
                        } else {
                          const newSelection = selectedSubColumns.filter(col => col !== "amount" && col !== "all");
                          setSelectedSubColumns(newSelection.length > 0 ? newSelection : ["date"]);
                        }
                      }}>
                      Amount
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={
                        selectedSubColumns.includes("date") ||
                        selectedSubColumns.includes("all")
                      }
                      disabled={selectedSubColumns.includes("all")} 
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) => {
                        if (selectedSubColumns.includes("all")) return;
                        
                        if (checked) {
                          setSelectedSubColumns((prev) => 
                            [...prev.filter(col => col !== "all" && col !== "date"), "date"]
                          );
                        } else {
                          const newSelection = selectedSubColumns.filter(col => col !== "date" && col !== "all");
                          setSelectedSubColumns(newSelection.length > 0 ? newSelection : ["amount"]);
                        }
                      }}>
                      Pay Date
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={
                        selectedSubColumns.includes("status") ||
                        selectedSubColumns.includes("all")
                      }
                      disabled={selectedSubColumns.includes("all")} 
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) => {
                        if (selectedSubColumns.includes("all")) return;
                        
                        if (checked) {
                          setSelectedSubColumns((prev) => 
                            [...prev.filter(col => col !== "all" && col !== "status"), "status"]
                          );
                        } else {
                          setSelectedSubColumns(selectedSubColumns.filter(col => col !== "status" && col !== "all"));
                        }
                      }}>
                      Status
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={
                        selectedSubColumns.includes("bank") ||
                        selectedSubColumns.includes("all")
                      }
                      disabled={selectedSubColumns.includes("all")} 
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) => {
                        if (selectedSubColumns.includes("all")) return;
                        
                        if (checked) {
                          setSelectedSubColumns((prev) => 
                            [...prev.filter(col => col !== "all" && col !== "bank"), "bank"]
                          );
                        } else {
                          setSelectedSubColumns(selectedSubColumns.filter(col => col !== "bank" && col !== "all"));
                        }
                      }}>
                      Bank
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={
                        selectedSubColumns.includes("payMode") ||
                        selectedSubColumns.includes("all")
                      }
                      disabled={selectedSubColumns.includes("all")} 
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) => {
                        if (selectedSubColumns.includes("all")) return;
                        
                        if (checked) {
                          setSelectedSubColumns((prev) => 
                            [...prev.filter(col => col !== "all" && col !== "payMode"), "payMode"]
                          );
                        } else {
                          setSelectedSubColumns(selectedSubColumns.filter(col => col !== "payMode" && col !== "all"));
                        }
                      }}>
                      Pay Mode
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTotals(!showTotals)}
                    className="ml-2">
                    {showTotals ? "Hide Totals" : "Show Totals"}
                  </Button>
                </div>
              </div>

              {!isOverallView && (
                <div className="flex items-center gap-2">
                  {periodSelectionUI}
                </div>
              )}
            </div>

            {/* Data table section */}
            <div className="relative">
              {(
                isRangeView
                  ? Object.keys(displayData).length > 0
                  : displayData.length > 0
              ) ? (
                <DataTable
                  data={isRangeView ? [] : displayData}
                  yearlyData={isRangeView ? displayData : null}
                  selectedColumns={selectedColumns.filter(col => col !== "month")}
                  selectedSubColumns={selectedSubColumns}
                  isLoading={loading && selectedCompany !== null}
                  isHorizontalView={isRangeView}
                  showTotals={showTotals}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-32 border rounded-md bg-muted/10 space-y-4">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-xs">Loading data...</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      No data available for selected period
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              Select a company to view tax reports
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
