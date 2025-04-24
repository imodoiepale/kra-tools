// @ts-nocheck
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useCompanyFilters } from "../hooks/useCompanyFilters";
import { Filter, Download, LayoutGrid, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientCategoryFilter } from "./client-category-filter";
import { ColumnFilter } from "./column-filter";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { usePayrollReports } from "../hooks/usePayrollReports";
import { DataTable } from "./data-table";
import { format } from "date-fns";

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
  initialSearchQuery?: string;
  initialSelectedFilters?: Record<string, Record<string, boolean>>;
  onSearchChange?: (query: string) => void;
  onFilterChange?: (filters: Record<string, Record<string, boolean>>) => void;
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
  initialSearchQuery = "",
  initialSelectedFilters = {},
  onSearchChange,
  onFilterChange,
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
  const { reportData, loading: taxDataLoading, fetchReportData } = usePayrollReports();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "name", direction: "asc" });
  const [selectedFilters, setSelectedFilters] = useState<Record<string, Record<string, boolean>>>(initialSelectedFilters);
  // Use the companies passed from parent directly
  const [filteredCompanies, setFilteredCompanies] = useState(companies);
  
  // Update filteredCompanies when companies prop changes
  useEffect(() => {
    setFilteredCompanies(companies);
  }, [companies]);

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
        const effectiveToField = `${category === "audit" ? "audit_tax" : category}_client_effective_to`;
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

  // Load data on component mount
  useEffect(() => {
    // Initialize data when component mounts
    applyDateRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // State for date range selection
  const currentYear = new Date().getFullYear();

  const [isLoading, setIsLoading] = useState(false);
  // Get current month (1-12)
  const currentMonth = new Date().getMonth() + 1;

  // Get list of years (current year and previous years)
  const years = Array.from({ length: 16 }, (_, i) => currentYear - i);

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

  // Use company filters hook with initial values from parent
  const {
    searchQuery,
    setSearchQuery: setLocalSearchQuery,
    selectedFilters: filters,
    setSelectedFilters: setFilters,
    filteredCompanies: filtered,
    getFilters,
    handleFilterChange,
    isDateInRange,
    totalFilteredCount,
  } = useCompanyFilters(companies, initialSearchQuery);
  
  // Sync search query with parent component
  const setSearchQuery = (query: string) => {
    setLocalSearchQuery(query);
    if (onSearchChange) {
      onSearchChange(query);
    }
  };

  // Function to format amount - consistent with DataTable component
  const formatAmount = (amount) => {
    if (typeof amount === "string") {
      // Return the string amount directly from the database without modifying it
      return amount;
    }

    if (isNaN(amount) || amount === undefined) {
      amount = 0;
    }

    if (amount === 0) {
      return "0.00";
    }

    return new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2 }).format(
      amount
    );
  };

  // Function to determine date color based on day
  const getDateColor = (dateStr) => {
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
  const formatDate = (date) => {
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
  const truncateCompanyName = (name) => {
    const words = name.split(" ");
    return words.slice(0, 2).join(" ") + (words.length > 2 ? "..." : "");
  };

  const getMonthsInRange = React.useCallback(
    (start, end) => {
      console.log("[DEBUG] getMonthsInRange called with:", start, end);
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
      
      // Reverse the array to show most recent month first
      months.reverse();

      return months;
    },
    [monthNames]
  );

  const visibleMonths = React.useMemo(
    () => getMonthsInRange(startDate, endDate),
    [startDate, endDate, getMonthsInRange]
  );

  // Apply date range
  const applyDateRange = async () => {
    console.log("[DEBUG] Applying date range:", startDate, endDate);
    console.log("[DEBUG] Filtered companies count:", filteredCompanies.length);
    
    setIsLoading(true);
    
    try {
      // Get all company IDs
      const companyIds = filteredCompanies.map(company => company.id);
      console.log("[DEBUG] Company IDs to fetch:", companyIds);
      
      if (companyIds.length === 0) {
        console.warn("[DEBUG] No companies to fetch data for");
        setIsLoading(false);
        return;
      }
      
      // Fetch real data from the database using our hook
      await fetchReportData(startDate, endDate, companyIds);
      
    } catch (error) {
      console.error("[DEBUG] Error in applyDateRange:", error);
    } finally {
      setIsLoading(false);
    }
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

  // Update sorting logic
  const sortedCompanies = useMemo(() => {
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
  
  // Format data for DataTable component
  const formatDataForDataTable = () => {
    console.log("[DEBUG] formatDataForDataTable - viewMode:", viewMode);
    console.log("[DEBUG] formatDataForDataTable - reportData keys:", reportData ? Object.keys(reportData).length : 0);
    console.log("[DEBUG] formatDataForDataTable - filteredCompanies:", filteredCompanies.length);
    console.log("[DEBUG] formatDataForDataTable - selectedColumns:", selectedColumns);

    // Add detailed debug logging for reportData structure
    console.log("[DEBUG] reportData structure:",
      reportData && Object.keys(reportData).length > 0 ?
      Object.keys(reportData).slice(0,1).map(companyId => ({
        companyId,
        years: Object.keys(reportData[companyId]),
        sampleMonth: reportData[companyId][Object.keys(reportData[companyId])[0]]?.[0]
      })) :
      "No data"
    );

    // For the standard table view, we need to convert the data to month-based entries
    // If this is for company or overall view, DataTable will handle it internally
    if (viewMode === "table") {
      // Create entries for each month in the visible range
      return visibleMonths.map((month) => {
        // Convert month name to abbreviation (JAN, FEB, etc.)
        const monthAbbr = month.name.slice(0, 3).toUpperCase();
        const monthIndex = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(monthAbbr);
        
        // Create default entry for this month
        const entry = {
          month: monthAbbr,
          paye: { amount: 0, date: null, status: null, bank: null, payMode: null },
          housingLevy: { amount: 0, date: null, status: null, bank: null, payMode: null },
          nita: { amount: 0, date: null, status: null, bank: null, payMode: null },
          shif: { amount: 0, date: null, status: null, bank: null, payMode: null },
          nssf: { amount: 0, date: null, status: null, bank: null, payMode: null }
        };

        // Populate with actual data from reportData
        if (reportData && sortedCompanies.length > 0) {
          sortedCompanies.forEach(company => {
            if (reportData[company.id] && reportData[company.id][month.year.toString()]) {
              const companyMonthData = reportData[company.id][month.year.toString()][monthIndex];
              if (companyMonthData) {
                selectedColumns.forEach(taxType => {
                  if (companyMonthData[taxType]) {
                    entry[taxType] = { ...companyMonthData[taxType] };
                  }
                });
              }
            }
          });
        }
        
        return entry;
      });
    }
    
    // For company view and overall view, just pass filteredCompanies
    return filteredCompanies;
  };
  
  // Format yearly data for the DataTable component's horizontal view
  const formatYearlyDataForTable = () => {
    console.log("[DEBUG] formatYearlyDataForTable - startYear/endYear:", startDate, endDate);
    console.log("[DEBUG] formatYearlyDataForTable - reportData available:", !!reportData);
    // If we don't have reportData, return empty object
    if (!reportData) return {};
    
    // For company view, we need to format the data by year
    const yearlyDataFormatted = {};
    
    // Get all years from the date range
    const startYear = parseInt(startDate.split('-')[0]);
    const endYear = parseInt(endDate.split('-')[0]);
    
    // Create a structure for each year in the range
    for (let year = startYear; year <= endYear; year++) {
      yearlyDataFormatted[year] = [];
      
      // For each month, create an entry in the year
      const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      monthNames.forEach(month => {
        yearlyDataFormatted[year].push({
          month,
          paye: {
            amount: 0,
            date: null,
            status: null,
            bank: null,
            payMode: null
          },
          housingLevy: {
            amount: 0,
            date: null,
            status: null,
            bank: null,
            payMode: null
          },
          nita: {
            amount: 0,
            date: null,
            status: null,
            bank: null,
            payMode: null
          },
          shif: {
            amount: 0,
            date: null,
            status: null,
            bank: null,
            payMode: null
          },
          nssf: {
            amount: 0,
            date: null,
            status: null,
            bank: null,
            payMode: null
          }
        });
      });
    }
    
    // If we have selected companies and report data, populate with actual data
    if (filteredCompanies.length > 0 && Object.keys(reportData).length > 0) {
      console.log("[DEBUG] formatYearlyDataForTable - populating with data for", filteredCompanies[0]?.id);
      // For the first selected company (for company view), get its report data
      const firstCompany = filteredCompanies[0];
      if (firstCompany && reportData[firstCompany.id]) {
        const companyData = reportData[firstCompany.id];
        
        // For each year in the company data
        Object.keys(companyData).forEach(year => {
          // If we have this year in our formatted data
          if (yearlyDataFormatted[year]) {
            // For each month in the year data (which should be an array of months)
            companyData[year].forEach((monthData, index) => {
              // If we have this month index in our formatted data
              if (yearlyDataFormatted[year][index]) {
                // Copy the tax data from the report to our formatted data
                selectedColumns.forEach(taxType => {
                  if (monthData[taxType]) {
                    yearlyDataFormatted[year][index][taxType] = {
                      ...monthData[taxType]
                    };
                  }
                });
              }
            });
          }
        });
      }
    }
    
    return yearlyDataFormatted;
  };

  // Function to handle search input with debounce
  const handleSearchChange = (e) => {
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
      console.log("[DEBUG] Starting Excel export");
      
      // Create a workbook and worksheet
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      
      if (viewMode === "table") {
        // For table view, export data as displayed in the table
        const headers = ["#", "Company"];
        const dataRows = [];
        
        // Add month headers
        visibleMonths.forEach(month => {
          selectedColumns.forEach(col => {
            // Format column names based on tax type
            const colName = col === "paye" ? "PAYE" :
                          col === "housingLevy" ? "Housing Levy" :
                          col === "nita" ? "NITA" :
                          col === "shif" ? "SHIF" :
                          col === "nssf" ? "NSSF" : col;
                          
            // Add subcolumns based on selection
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
              headers.push(`${month.label} - ${colName} Amount`);
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
              headers.push(`${month.label} - ${colName} Date`);
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
              headers.push(`${month.label} - ${colName} Status`);
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
              headers.push(`${month.label} - ${colName} Bank`);
            }
            if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
              headers.push(`${month.label} - ${colName} Pay Mode`);
            }
          });
        });
        
        // Add data rows for each company
        sortedCompanies.forEach((company, index) => {
          const row = [index + 1, company.name];
          
          // Process data for this company
          const companyMonthData = visibleMonths.map((month) => {
            const monthAbbr = month.name.slice(0, 3).toUpperCase();
            const monthIndex = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(monthAbbr);
            
            // Create default entry for this month
            const entry = {
              month: monthAbbr,
              paye: { amount: 0, date: null, status: null, bank: null, payMode: null },
              housingLevy: { amount: 0, date: null, status: null, bank: null, payMode: null },
              nita: { amount: 0, date: null, status: null, bank: null, payMode: null },
              shif: { amount: 0, date: null, status: null, bank: null, payMode: null },
              nssf: { amount: 0, date: null, status: null, bank: null, payMode: null }
            };
            
            // Get company data from reportData
            const companyData = reportData[company.id];
            
            // If we have data for this company and year
            if (companyData && companyData[month.year.toString()]) {
              // Get the month's data if it exists
              const monthData = companyData[month.year.toString()][monthIndex];
              if (monthData) {
                // Copy tax data for each selected column
                selectedColumns.forEach(taxType => {
                  if (monthData[taxType]) {
                    entry[taxType] = { ...monthData[taxType] };
                  }
                });
              }
            }
            
            return entry;
          });
          
          // Add data for each month to the row
          companyMonthData.forEach((monthData) => {
            selectedColumns.forEach(taxType => {
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
                row.push(formatAmount(monthData[taxType]?.amount || 0));
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
                row.push(monthData[taxType]?.date ? formatDate(monthData[taxType]?.date) : "-");
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
                row.push(monthData[taxType]?.status || "-");
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
                row.push(monthData[taxType]?.bank || "-");
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
                row.push(monthData[taxType]?.payMode || "-");
              }
            });
          });
          
          dataRows.push(row);
        });
        
        // Create worksheet from data
        const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
        XLSX.utils.book_append_sheet(wb, ws, `Payroll Report`);
      } else {
        // For company or overall view, format data differently
        if (viewMode === "company" && sortedCompanies.length > 0) {
          // Company view - create a sheet for the selected company
          const company = sortedCompanies[0];
          const sheetName = company.name.substring(0, 30); // Excel sheet name length limit
          
          // Format yearly data
          const yearlyData = formatYearlyDataForTable();
          const headers = ["Month"];
          const dataRows = [];
          
          // Add column headers
          selectedColumns.forEach(col => {
            const colName = col === "paye" ? "PAYE" :
                          col === "housingLevy" ? "Housing Levy" :
                          col === "nita" ? "NITA" :
                          col === "shif" ? "SHIF" :
                          col === "nssf" ? "NSSF" : col;
                          
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
          
          // Add data for each year and month
          Object.keys(yearlyData).forEach(year => {
            yearlyData[year].forEach(monthData => {
              const row = [`${monthData.month} ${year}`];
              
              selectedColumns.forEach(taxType => {
                if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
                  row.push(formatAmount(monthData[taxType]?.amount || 0));
                }
                if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
                  row.push(monthData[taxType]?.date ? formatDate(monthData[taxType]?.date) : "-");
                }
                if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
                  row.push(monthData[taxType]?.status || "-");
                }
                if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
                  row.push(monthData[taxType]?.bank || "-");
                }
                if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
                  row.push(monthData[taxType]?.payMode || "-");
                }
              });
              
              dataRows.push(row);
            });
          });
          
          const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        } else {
          // Overall view - create a sheet with all companies
          const headers = ["#", "Company"];
          
          // Add column headers
          selectedColumns.forEach(col => {
            const colName = col === "paye" ? "PAYE" :
                          col === "housingLevy" ? "Housing Levy" :
                          col === "nita" ? "NITA" :
                          col === "shif" ? "SHIF" :
                          col === "nssf" ? "NSSF" : col;
                          
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
          
          // Add data for each company
          const dataRows = sortedCompanies.map((company, index) => {
            const row = [index + 1, company.name];
            // Add placeholder data for each column
            selectedColumns.forEach(col => {
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("amount")) {
                row.push("");
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("date")) {
                row.push("");
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("status")) {
                row.push("");
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("bank")) {
                row.push("");
              }
              if (selectedSubColumns.includes("all") || selectedSubColumns.includes("payMode")) {
                row.push("");
              }
            });
            return row;
          });
          
          const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
          XLSX.utils.book_append_sheet(wb, ws, "Companies Overview");
        }
      }
      
      // Generate filename
      const filename = `payroll_report_${startDate}_${endDate}.xlsx`;
      
      // Write to file and trigger download
      XLSX.writeFile(wb, filename);
      
      console.log("[DEBUG] Excel export completed");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      // You may want to show an error toast here
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header with title and controls */}
      <div className="bg-white shadow-lg p-3 border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            
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
                  // Just close the filter dialog without changing anything
                  setIsFilterOpen(false);
                }}
                onClearFilters={() => {
                  // Update local state
                  setSelectedFilters({});
                  
                  // Sync with parent component if callback is provided
                  if (onFilterChange) {
                    onFilterChange({});
                  }
                }}
                onApplyFilters={(
                  filters: Record<string, Record<string, boolean>>
                ) => {
                  // Update local state
                  setSelectedFilters(filters);
                  
                  // Sync with parent component if callback is provided
                  if (onFilterChange) {
                    onFilterChange(filters);
                  }
  
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
                    To:
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={endDate.split("-")[0]}
                      onChange={(e) => {
                        const [_, month] = endDate.split("-");
                        setEndDate(`${e.target.value}-${month}`);
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
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
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        // Display months in chronological order (January to December)
                        const monthIndex = i;
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
                    From:
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={startDate.split("-")[0]}
                      onChange={(e) => {
                        const [_, month] = startDate.split("-");
                        setStartDate(`${e.target.value}-${month}`);
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
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
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        // Display months in chronological order (January to December)
                        const monthIndex = i;
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
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 flex items-center"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
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
                  onClick={() => {
                    console.log("[DEBUG] Refreshing data");
                    // Refresh data by calling applyDateRange
                    applyDateRange();
                  }}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="flex items-center gap-2"
                >
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
                  className="flex items-center gap-2"
                >
                  <LayoutGrid className="h-4 w-4" />
                  {viewMode === "table"
                    ? "Overall View"
                    : viewMode === "company"
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
      <div className="flex-grow relative">
        {/* Debug info */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="bg-yellow-100 p-2 text-xs border-b border-yellow-300 overflow-auto max-h-40">
            <div><strong>DEBUG:</strong> Companies: {companies.length}, Filtered: {filteredCompanies.length}, Sorted: {sortedCompanies.length}</div>
            <div><strong>ViewMode:</strong> {viewMode}</div>
            <div><strong>Has reportData:</strong> {reportData ? 'Yes' : 'No'}</div>
            <div><strong>Report keys:</strong> {reportData ? Object.keys(reportData).join(', ').substring(0, 100) : 'None'}</div>
            <div><strong>Selected Columns:</strong> {selectedColumns.join(', ')}</div>
            <div><strong>Search Query:</strong> {searchQuery}</div>
            <div><strong>Selected Filters:</strong> {JSON.stringify(Object.keys(selectedFilters))}</div>
          </div>
        )}
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-grow overflow-auto">
            {viewMode === "table" ? (
              <div className="min-w-fit h-full relative">
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
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-white">
                            Company({filteredCompanies.length})
                          </span>
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
                            (sum, _) =>
                              sum + calculateColSpan(selectedSubColumns),
                            0
                          )}
                          className={`sticky top-0 z-50 text-white py-3 px-4 border border-slate-300 text-center ${
                            index % 2 === 0
                              ? "bg-[#1e4d7b]"
                              : "bg-[#2a5a8c]"
                          }`}
                        >
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
                              className="sticky top-[35px] z-50 bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-center"
                            >
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
                                    className="sticky top-[70px] z-50 bg-[#2a5a8c] text-white py-1.5 px-2 border border-slate-300 text-[11px] font-medium"
                                  >
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
                    {/* Use sortedCompanies which already has filtering and sorting applied */}
                    {sortedCompanies.map((company, companyIndex) => {
                      // Process data for this company - this ensures we're using the same data source as DataTable
                      const companyMonthData = visibleMonths.map((month) => {
                        const monthAbbr = month.name.slice(0, 3).toUpperCase();
                        const monthIndex = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(monthAbbr);
                      
                        // Create default entry for this month
                        const entry = {
                          month: monthAbbr,
                          paye: { amount: 0, date: null, status: null, bank: null, payMode: null },
                          housingLevy: { amount: 0, date: null, status: null, bank: null, payMode: null },
                          nita: { amount: 0, date: null, status: null, bank: null, payMode: null },
                          shif: { amount: 0, date: null, status: null, bank: null, payMode: null },
                          nssf: { amount: 0, date: null, status: null, bank: null, payMode: null }
                        };
                      
                        // Get company data from reportData
                        const companyData = reportData[company.id];
                      
                        // If we have data for this company and year
                        if (companyData && companyData[month.year.toString()]) {
                          // Get the month's data if it exists
                          const monthData = companyData[month.year.toString()][monthIndex];
                          if (monthData) {
                            // Copy tax data for each selected column
                            selectedColumns.forEach(taxType => {
                              if (monthData[taxType]) {
                                entry[taxType] = { ...monthData[taxType] };
                              }
                            });
                          }
                        }
                      
                        return entry;
                      });
  
                      return (
                        <tr
                          key={company.id}
                          className={
                            companyIndex % 2 === 0
                              ? "bg-white hover:bg-blue-50"
                              : "bg-gray-50 hover:bg-blue-50"
                          }
                        >
                          <td
                            className="sticky left-0 z-40 py-1 px-1.5 border border-slate-300 text-center text-[10px] text-slate-700"
                            style={{
                              backgroundColor:
                                companyIndex % 2 === 0 ? "white" : "#f9fafb",
                            }}
                          >
                            {companyIndex + 1}
                          </td>
                          <td
                            className="sticky left-[40px] z-40 py-1 px-1.5 border border-slate-300 font-medium text-[10px] text-slate-700 cursor-help group"
                            style={{
                              backgroundColor:
                                companyIndex % 2 === 0 ? "white" : "#f9fafb",
                            }}
                          >
                            <span className="block truncate w-[85px]">
                              {truncateCompanyName(company.name)}
                            </span>
                            <div
                              className="fixed z-[9999] invisible group-hover:visible bg-slate-900 text-white p-1.5 rounded shadow-lg text-[10px] max-w-xs whitespace-normal break-words"
                              style={{ transform: "translateY(-100%)" }}
                            >
                              {company.name}
                            </div>
                          </td>
  
                          {/* Render data for all visible months */}
                          {companyMonthData.map((monthData, monthIndex) => {
                            return (
                              <React.Fragment key={monthIndex}>
                                {selectedColumns.map((taxType) => (
                                  <React.Fragment key={`${taxType}-${monthIndex}`}>
                                    {(selectedSubColumns.includes("all") ||
                                      selectedSubColumns.includes("amount")) && (
                                      <td
                                        className={`py-1.5 px-2 border border-slate-300 text-right text-[11px] ${
                                          monthData[taxType]?.amount
                                            ? "font-medium text-slate-700"
                                            : "text-slate-500"
                                        }`}
                                      >
                                        {formatAmount(
                                          monthData[taxType]?.amount || 0
                                        )}
                                      </td>
                                    )}
                                    {(selectedSubColumns.includes("all") ||
                                      selectedSubColumns.includes("date")) && (
                                      <td
                                        className={`py-1.5 px-2 border border-slate-300 text-right text-[11px] ${
                                          monthData[taxType]?.date
                                            ? "font-medium text-slate-700"
                                            : "text-slate-500"
                                        }`}
                                      >
                                        {monthData[taxType]?.date
                                          ? formatDate(monthData[taxType]?.date)
                                          : "-"}
                                      </td>
                                    )}
                                    {(selectedSubColumns.includes("all") ||
                                      selectedSubColumns.includes("status")) && (
                                      <td
                                        className={`py-1.5 px-2 border border-slate-300 text-center text-[11px] ${
                                          monthData[taxType]?.status
                                            ? "font-medium text-slate-700"
                                            : "text-slate-500"
                                        }`}
                                      >
                                        {monthData[taxType]?.status || "-"}
                                      </td>
                                    )}
                                    {(selectedSubColumns.includes("all") ||
                                      selectedSubColumns.includes("bank")) && (
                                      <td
                                        className={`py-1.5 px-2 border border-slate-300 text-center text-[11px] ${
                                          monthData[taxType]?.bank
                                            ? "font-medium text-slate-700"
                                            : "text-slate-500"
                                        }`}
                                      >
                                        {monthData[taxType]?.bank || "-"}
                                      </td>
                                    )}
                                    {(selectedSubColumns.includes("all") ||
                                      selectedSubColumns.includes("payMode")) && (
                                      <td
                                        className={`py-1.5 px-2 border border-slate-300 text-center text-[11px] ${
                                          monthData[taxType]?.payMode
                                            ? "font-medium text-slate-700"
                                            : "text-slate-500"
                                        }`}
                                      >
                                        {monthData[taxType]?.payMode || "-"}
                                      </td>
                                    )}
                                  </React.Fragment>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      );
                    })}
  
                    {/* Empty state handling */}
                    {filteredCompanies.length === 0 && (
                      <tr>
                        <td
                          colSpan={totalSubColumns + 2}
                          className="text-center py-10 text-gray-500"
                        >
                          No companies found matching your search criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="w-full h-full">
                {/* The alternative view modes (overall or company) */}
                <DataTable
                  data={formatDataForDataTable()}
                  selectedColumns={selectedColumns}
                  selectedSubColumns={selectedSubColumns}
                  isLoading={isLoading}
                  showTotals={showTotals}
                  viewMode={viewMode}
                  startDate={startDate}
                  endDate={endDate}
                  getMonthsInRange={getMonthsInRange}
                  yearlyData={formatYearlyDataForTable()}
                  isHorizontalView={viewMode === "company"}
                />
              </div>
            )}
          </div>
          {/* Horizontal scroll indicator */}
          <div className="h-3 bg-gray-100 border-t border-gray-200 overflow-x-auto">
            <div style={{ width: `${tableWidth}px` }} className="h-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}