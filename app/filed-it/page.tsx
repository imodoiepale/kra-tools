// @ts-nocheck
"use client";
import { useCompanyFilters } from "./hooks/useCompanyFilters";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useCompanyTaxReports } from "./hooks/useCompanyTaxReports";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Filter } from "lucide-react";
import { ClientCategoryFilter } from "./components/client-category-filter";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import IncomeTaxDashboard from "./components/income-tax-dashboard";
import { useIncomeTaxReturns } from "./hooks/useIncomeTaxReturns";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15 * 60 * 1000, 
      cacheTime: 24 * 60 * 60 * 1000, 
      retry: 1,
      retryDelay: 1000,
      keepPreviousData: true,
    },
  },
});

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
    selectedCompany,
    setSelectedCompany,
    loading,
    clearCache,
    filterByIncomeTax,
    setFilterByIncomeTax,
  } = useCompanyTaxReports();

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const {
    searchQuery,
    setSearchQuery,
    selectedFilters,
    setSelectedFilters,
    filteredCompanies,
    totalFilteredCount,
  } = useCompanyFilters(companies || []);

  const selectedCompanyName = useMemo(() => {
    if (!Array.isArray(companies)) return '';
    const company = companies.find((c) => c?.id === selectedCompany);
    return company?.name || '';
  }, [companies, selectedCompany]);

  const activeFilterCount = useMemo(() => {
    return Object.keys(selectedFilters).filter(category => 
      Object.values(selectedFilters[category]).some(status => status)
    ).length;
  }, [selectedFilters]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
            <aside className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold mb-2 text-blue-600 uppercase">Filtered Companies {totalFilteredCount}</h3>
        <div className="relative mb-4">
          <Input
            type="search"
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        <div className="mb-4">
          <Button
            variant="outline"
            className="w-full justify-between text-xs h-8 font-normal"
            onClick={() => setIsFilterOpen(true)}
          >
            <div className="flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              <span>Service Categories</span>
            </div>
            {activeFilterCount > 0 && (
              <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        <ClientCategoryFilter
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          selectedFilters={selectedFilters}
          onApplyFilters={setSelectedFilters}
          onClearFilters={() => setSelectedFilters({}) }
        />

        <div className="flex items-center space-x-2 mt-4">
          <Switch
            id="income-tax-filter"
            checked={filterByIncomeTax}
            onCheckedChange={setFilterByIncomeTax}
          />
          <Label htmlFor="income-tax-filter" className="text-xs">Filter by Income Tax Registered</Label>
        </div>

        <ScrollArea className="h-[calc(100vh-240px)] mt-4">
          <div className="space-y-2">
            {loading ? (
              <p className="text-gray-500 text-xs">Loading companies...</p>
            ) : (
              filteredCompanies.map((company, index) => (
                <div
                  key={company.id}
                  className={`cursor-pointer text-xs truncate${
                    selectedCompany === company.id ? "font-bold text-blue-600" : ""
                  }`}
                  onClick={() => setSelectedCompany(company.id)}
                  onMouseEnter={() => prefetchCompanyData(company.id)}
                  title={company.name}
                >
                  <span className="text-gray-500 w-8 inline-block">{index + 1}.</span>
                  <span className="uppercase">{company.name.split(' ').slice(0, 2).join(' ')}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

      </aside>

      <main className="flex-1 overflow-y-auto">
        <IncomeTaxDashboard company={companies?.find(c => c.id === selectedCompany)} />
      </main>
    </div>
  );
}
