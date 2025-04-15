// @ts-nocheck
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useCompanyFilters } from "../hooks/useCompanyFilters";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientCategoryFilter } from "./client-category-filter";
import { Badge } from "@/components/ui/badge";
import { useCompanyTaxReports } from "../hooks/useCompanyTaxReports";

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
}

export default function OverallView({ companies }: OverallViewProps) {
  const { reportData, loading: taxDataLoading } = useCompanyTaxReports();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [selectedFilters, setSelectedFilters] = useState<Record<string, Record<string, boolean>>>({});
  const [filteredCompanies, setFilteredCompanies] = useState(companies);

  // Add counts state
  const [counts, setCounts] = useState({
    total: companies.length,
    filtered: companies.length,
    active: 0,
    inactive: 0
  });

  // Calculate counts whenever filters change
  useEffect(() => {
    const newCounts = {
      total: companies.length,
      filtered: filteredCompanies.length,
      active: 0,
      inactive: 0
    };

    // Calculate active/inactive counts
    filteredCompanies.forEach(company => {
      const now = new Date();
      const isActive = ['acc', 'audit', 'sheria', 'imm'].some(category => {
        const effectiveToField = `${category === 'audit' ? 'audit_tax' : category}_client_effective_to`;
        return company[effectiveToField] === null || new Date(company[effectiveToField]) > now;
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
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Initial state for date range
  const [startDate, setStartDate] = useState(`${currentYear}-${currentMonth.toString().padStart(2, '0')}`);
  const [endDate, setEndDate] = useState(`${currentYear}-${currentMonth.toString().padStart(2, '0')}`);

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
    totalFilteredCount
  } = useCompanyFilters(companies);

  // Function to generate month range - memoized
  // Function to determine date color based on day
  const getDateColor = (dateStr: string | null): string => {
    if (!dateStr) return 'text-red-600 font-medium';
    try {
      const [day] = dateStr.split('/');
      const dayNum = parseInt(day, 10);
      if (dayNum > 9) return 'text-rose-600 font-medium';
      if (dayNum >= 1 && dayNum <= 9) return 'text-emerald-600 font-medium';
      return 'text-slate-900 font-medium';
    } catch (e) {
      return 'text-slate-900 font-medium';
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

  // Function to truncate company name to first 2 words
  const truncateCompanyName = (name: string): string => {
    const words = name.split(' ');
    return words.slice(0, 2).join(' ') + (words.length > 2 ? '...' : '');
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

  const visibleMonths = React.useMemo(() => getMonthsInRange(startDate, endDate), [startDate, endDate, getMonthsInRange]);

  // Apply date range
  const applyDateRange = () => {
    setIsLoading(true);
    // Actual data fetching is handled by useCompanyTaxReports
    setIsLoading(false);
  };

  // Calculate table width based on months
  const tableWidth = visibleMonths.length * 2000; // Increased width to accommodate all columns

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
              {/* Company counts */}
              
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-grow max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                onApplyFilters={(filters: Record<string, Record<string, boolean>>) => {
                  setSelectedFilters(filters);
                  
                  // Reset to all companies if no filters are selected
                  if (!Object.keys(filters).length) {
                    setFilteredCompanies(companies);
                    return;
                  }

                  // Apply the selected filters
                  const filtered = companies.filter(company => {
                    return Object.entries(filters).some(([category, statuses]) => {
                      if (!Object.values(statuses).some(value => value)) {
                        return false; // Skip categories where no status is selected
                      }

                      const now = new Date();
                      let isActive = false;
                      
                      switch(category) {
                        case 'acc':
                          isActive = company.acc_client_effective_to === null || new Date(company.acc_client_effective_to) > now;
                          break;
                        case 'audit':
                          isActive = company.audit_tax_client_effective_to === null || new Date(company.audit_tax_client_effective_to) > now;
                          break;
                        case 'sheria':
                          isActive = company.cps_sheria_client_effective_to === null || new Date(company.cps_sheria_client_effective_to) > now;
                          break;
                        case 'imm':
                          isActive = company.imm_client_effective_to === null || new Date(company.imm_client_effective_to) > now;
                          break;
                      }
                      
                      return statuses[isActive ? 'active' : 'inactive'];
                    });
                  });
                  setFilteredCompanies(filtered);
                }}
                selectedFilters={selectedFilters}
              />

              {/* Date range selector */}
              <div className="flex items-center gap-3 bg-white p-1 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <span className="text-gray-500 mx-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                  </span>
                  <label className="text-sm font-medium text-gray-700 mr-2">
                    From:
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={startDate.split('-')[0]}
                      onChange={(e) => {
                        const [_, month] = startDate.split('-');
                        setStartDate(`${e.target.value}-${month}`);
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {years.map(year => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <select
                      value={startDate.split('-')[1]}
                      onChange={(e) => {
                        const [year] = startDate.split('-');
                        setStartDate(`${year}-${e.target.value}`);
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        // Adjust index to start from current month
                        const monthIndex = (currentMonth - 1 + i) % 12;
                        const month = (monthIndex + 1).toString().padStart(2, '0');
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
                      value={endDate.split('-')[0]}
                      onChange={(e) => {
                        const [_, month] = endDate.split('-');
                        setEndDate(`${e.target.value}-${month}`);
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {years.map(year => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <select
                      value={endDate.split('-')[1]}
                      onChange={(e) => {
                        const [year] = endDate.split('-');
                        setEndDate(`${year}-${e.target.value}`);
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        // Adjust index to start from current month
                        const monthIndex = (currentMonth - 1 + i) % 12;
                        const month = (monthIndex + 1).toString().padStart(2, '0');
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
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </>
                  ) : (
                    "Apply"
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 justify-between">
          </div>
        </div>
      </div>

      {/* Table container with horizontal scrolling */}
      <div className="flex-grow overflow-auto">
        <div
          style={{ minWidth: `${tableWidth}px`, maxWidth: "100%" }}
          className="h-full">
          <table className="w-full border-collapse bg-white" style={{ position: 'relative' }}>
            <thead className="sticky top-0 z-10">
              <tr className="sticky top-0 z-30">
                <th className="sticky left-0 z-40 bg-[#1e4d7b] text-white py-2 px-3 border-2 border-slate-300 w-[60px] text-center">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-xs font-normal">#</span>
                    <span className="text-xs font-normal">({filteredCompanies.length})</span>
                  </div>
                </th>
                <th 
                  className="sticky left-[60px] z-40 bg-[#1e4d7b] text-white py-2 px-3 border-2 border-slate-300 min-w-[180px] text-left cursor-pointer hover:bg-[#2a5a8c] transition-colors text-sm"
                  onClick={() => {
                    setSortConfig({
                      key: 'name',
                      direction: sortConfig.key === 'name' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                    });
                  }}
                >
                  <div className="flex items-center gap-1">
                    Company {filteredCompanies.length}
                    {sortConfig.key === 'name' && (
                      <span className="text-xs">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                {visibleMonths.map((month, index) => (
                  <th
                    key={index}
                    colSpan={20}
                    className="bg-[#1e4d7b] text-white py-3 px-4 border-2 border-slate-300 text-center">
                    {month.label}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-20 bg-[#1e4d7b] text-white py-3 px-4 border-2 border-slate-300"></th>
                <th className="sticky left-[60px] z-20 bg-[#1e4d7b] text-white py-3 px-4 border-2 border-slate-300"></th>
                {visibleMonths.map((_, monthIndex) => (
                  <React.Fragment key={monthIndex}>
                    <th
                      colSpan={5}
                      className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-center">
                      PAYE
                    </th>
                    <th
                      colSpan={5}
                      className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-center">
                      Housing Levy
                    </th>
                    <th
                      colSpan={5}
                      className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-center">
                      NITA
                    </th>
                    <th
                      colSpan={5}
                      className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-center">
                      SHIF
                    </th>
                    <th
                      colSpan={5}
                      className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-center">
                      NSSF
                    </th>
                  </React.Fragment>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-20 bg-[#1e4d7b] text-white py-2 px-4 border-2 border-slate-300"></th>
                {visibleMonths.map((_, monthIndex) => (
                  <React.Fragment key={monthIndex}>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Amount
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Pay Date
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Status
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Bank
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Pay Mode
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Amount
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Pay Date
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Status
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Bank
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Pay Mode
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Amount
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Pay Date
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Status
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Bank
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Pay Mode
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Amount
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Pay Date
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Status
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Bank
                    </th>
                    <th className="bg-[#2a5a8c] text-white py-2 px-3 border-2 border-slate-300 text-sm font-medium">
                      Pay Mode
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Display sorted companies */}
              {useMemo(() => {
                let sortedCompanies = [...filteredCompanies];
                if (sortConfig.key === 'name') {
                  sortedCompanies.sort((a, b) => {
                    if (sortConfig.direction === 'asc') {
                      return a.name.localeCompare(b.name);
                    }
                    return b.name.localeCompare(a.name);
                  });
                }
                return sortedCompanies;
              }, [filteredCompanies, sortConfig]).map((company, companyIndex) => (
                <tr
                  key={company.id}
                  className={
                    companyIndex % 2 === 0 ? "bg-white hover:bg-blue-50" : "bg-gray-50 hover:bg-blue-50"
                  }>
                  <td className="sticky left-0 z-10 py-3 px-4 border-2 border-slate-300 bg-[#eef6fc] text-center text-slate-700">
                    {companyIndex + 1}
                  </td>
                  <td 
                    className="sticky left-[60px] z-10 py-3 px-4 border-2 border-slate-300 bg-[#eef6fc] font-medium text-slate-700 cursor-help group relative"
                    title={company.name}
                  >
                    <span className="block truncate w-[150px]">{truncateCompanyName(company.name)}</span>
                    <div className="fixed z-[9999] invisible group-hover:visible bg-slate-900 text-white p-2 rounded shadow-lg text-xs max-w-xs whitespace-normal break-words" style={{ transform: 'translateY(-100%)' }}>
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
                      payMode: null
                    };
                    
                    // Initialize empty month data with default tax entries
                    const emptyMonthData = {
                      month: month.name.slice(0, 3).toUpperCase(),
                      year: month.year.toString(),
                      paye: { ...defaultTaxEntry },
                      housingLevy: { ...defaultTaxEntry },
                      nita: { ...defaultTaxEntry },
                      shif: { ...defaultTaxEntry },
                      nssf: { ...defaultTaxEntry }
                    };
                    
                    // Get actual month data if available
                    let monthData = emptyMonthData;
                    
                    if (companyData && companyData[month.year.toString()]) {
                      const monthIndex = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
                        .indexOf(month.name.slice(0, 3).toUpperCase());
                      
                      if (monthIndex !== -1 && companyData[month.year.toString()][monthIndex]) {
                        const foundMonthData = companyData[month.year.toString()][monthIndex];
                        
                        // Merge with default structure to ensure all fields exist
                        monthData = {
                          month: month.name.slice(0, 3).toUpperCase(),
                          year: month.year.toString(),
                          paye: { ...defaultTaxEntry, ...foundMonthData.paye },
                          housingLevy: { ...defaultTaxEntry, ...foundMonthData.housingLevy },
                          nita: { ...defaultTaxEntry, ...foundMonthData.nita },
                          shif: { ...defaultTaxEntry, ...foundMonthData.shif },
                          nssf: { ...defaultTaxEntry, ...foundMonthData.nssf }
                        };
                      }
                    }
                    
                    const taxTypes = [
                      { key: 'paye', label: 'PAYE' },
                      { key: 'housingLevy', label: 'Housing Levy' },
                      { key: 'nita', label: 'NITA' },
                      { key: 'shif', label: 'SHIF' },
                      { key: 'nssf', label: 'NSSF' }
                    ];

                    return (
                      <React.Fragment key={monthIndex}>
                        {taxTypes.map(tax => (
                          <React.Fragment key={tax.key}>
                            <td className={`py-3 px-3 border-2 border-slate-300 text-right ${monthData?.[tax.key]?.amount ? 'font-medium text-slate-700' : 'text-slate-500'}`}>
                              {monthData?.[tax.key]?.amount?.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                            </td>
                            <td className={`py-3 px-3 border-2 border-slate-300 text-center ${monthData?.[tax.key]?.date ? getDateColor(monthData[tax.key].date) : 'text-slate-400'}`}>
                              {monthData?.[tax.key]?.date ? formatDate(monthData[tax.key].date) : "—"}
                            </td>
                            <td className={`py-3 px-3 border-2 border-slate-300 text-center ${monthData?.[tax.key]?.status ? 'font-medium text-slate-700' : 'text-slate-500'}`}>
                              {monthData?.[tax.key]?.status ?? "—"}
                            </td>
                            <td className={`py-3 px-3 border-2 border-slate-300 text-center ${monthData?.[tax.key]?.bank ? 'font-medium text-slate-700' : 'text-slate-500'}`}>
                              {monthData?.[tax.key]?.bank ?? "—"}
                            </td>
                            <td className={`py-3 px-3 border-2 border-slate-300 text-center ${monthData?.[tax.key]?.payMode ? 'font-medium text-slate-700' : 'text-slate-500'}`}>
                              {monthData?.[tax.key]?.payMode ?? "—"}
                            </td>
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}

              {/* Empty state handling */}
              {filteredCompanies.length === 0 && (
                <tr>
                  <td colSpan={visibleMonths.length * 20 + 1} className="text-center py-10 text-gray-500">
                    No companies found matching your search criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white shadow-lg p-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
            <span className="font-medium">{totalFilteredCount}</span>{" "}
            companies
          </div>
        </div>
        <div className="flex items-center justify-between gap-8">
          <div className="bg-indigo-50 py-1 px-3 rounded-full text-indigo-700 font-medium text-xs">
            {visibleMonths.length > 0 && (
              <>
                {visibleMonths[0]?.label} to {visibleMonths[visibleMonths.length - 1]?.label}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}