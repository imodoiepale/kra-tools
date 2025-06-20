// @ts-nocheck
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { TaxEntry } from "../components/data-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface PaymentReceiptExtraction {
  amount?: string;
  payment_mode?: string;
  payment_date?: string;
  status?: string;
  bank_name?: string;
}

interface PaymentReceiptExtractions {
  [key: string]: PaymentReceiptExtraction | null;
}

// Enhanced cache with TTL and loading status
interface CacheEntry {
  data: Record<string, TaxEntry[]>;
  timestamp: number;
  complete: boolean;
  loadingPromise?: Promise<Record<string, TaxEntry[]>>;
}

// In-memory cache
const taxDataCache = new Map<number, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const LOCALSTORAGE_KEY = "companyTaxCache";
// Add cache version to detect schema changes
const CACHE_VERSION = "1.0";

// Initialize cache from localStorage
const initCacheFromStorage = () => {
  try {
    const cachedData = localStorage.getItem(LOCALSTORAGE_KEY);
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);

      // Check cache version before using stored data
      if (parsedData.version !== CACHE_VERSION) {
        console.log("Cache version mismatch, clearing cache");
        localStorage.removeItem(LOCALSTORAGE_KEY);
        return;
      }

      Object.entries(parsedData.data || {}).forEach(([companyId, entry]) => {
        // Only load if data is complete and not expired
        if (entry.complete && Date.now() - entry.timestamp < CACHE_TTL) {
          taxDataCache.set(Number(companyId), {
            ...entry,
            loadingPromise: undefined,
          });
        }
      });
      console.log("Loaded cached data for", taxDataCache.size, "companies");
    }
  } catch (error) {
    console.error("Error loading cache from localStorage:", error);
    // Clear cache on error to prevent using corrupted data
    localStorage.removeItem(LOCALSTORAGE_KEY);
  }
};

// Save cache to localStorage
const saveCacheToStorage = () => {
  try {
    const cacheToSave: Record<number, Omit<CacheEntry, "loadingPromise">> = {};
    taxDataCache.forEach((entry, companyId) => {
      if (entry.complete) {
        // Only save complete entries, omit loading promises
        const { loadingPromise, ...entryToSave } = entry;
        cacheToSave[companyId] = entryToSave;
      }
    });

    // Store with version information
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      data: cacheToSave,
      lastUpdated: Date.now()
    }));
  } catch (error) {
    console.error("Error saving cache to localStorage:", error);
  }
};

// Helper function to check if cache is still valid
const isCacheValid = (entry: CacheEntry | undefined): boolean => {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
};

// Helper function to batch request IDs
const batchRequests = async (ids, batchSize, fetchFn) => {
  if (!ids || ids.length === 0) return [];

  const batches = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    batches.push(batch);
  }

  const results = [];
  for (const batch of batches) {
    const result = await fetchFn(batch);
    results.push(...result);
  }

  return results;
};

// Fetch companies function without pagination
const fetchCompanies = async (searchQuery: string) => {
  console.time("fetchCompanies");

  let query = supabase
    .from("acc_portal_company_duplicate")
    .select(
      `
      id, 
      company_name,
      acc_client_effective_from,
      acc_client_effective_to,
      audit_client_effective_from,
      audit_client_effective_to,
      sheria_client_effective_from,
      sheria_client_effective_to,
      imm_client_effective_from,
      imm_client_effective_to
    `
    )
    .order("company_name");

  if (searchQuery) {
    query = query.ilike("company_name", `%${searchQuery}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  const companies = data?.map((company) => ({
    id: Number(company.id),
    name: company.company_name,
    acc_client_effective_from: company.acc_client_effective_from,
    acc_client_effective_to: company.acc_client_effective_to,
    audit_client_effective_from: company.audit_client_effective_from,
    audit_client_effective_to: company.audit_client_effective_to,
    sheria_client_effective_from: company.sheria_client_effective_from,
    sheria_client_effective_from: company.sheria_client_effective_to,
    imm_client_effective_from: company.imm_client_effective_from,
    imm_client_effective_to: company.imm_client_effective_to,
  })) || [];

  console.timeEnd("fetchCompanies");
  return companies;
};

// Get current year and previous year
const getCurrentAndPreviousYear = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  return [currentYear.toString(), (currentYear - 1).toString()];
};

// Create empty results for a year
const createEmptyYearData = (year: string): TaxEntry[] => {
  return Array.from({ length: 12 }, (_, i) =>
    createEmptyTaxEntry(getMonthName(i + 1))
  );
};

// Progressive data loading function - returns immediate results and loads full data in background
const fetchCompanyTaxData = async (companyId: number, queryClient: any, availableCompanies: any[] = []) => {
  console.time(`fetchCompanyTaxData:${companyId}`);

  // Check if company ID exists in available companies
  if (availableCompanies.length > 0 && !availableCompanies.some(c => c.id === companyId)) {
    console.warn(`Company ID ${companyId} no longer exists in database`);
    // Clear cache for this company to prevent using stale data
    taxDataCache.delete(companyId);
    console.timeEnd(`fetchCompanyTaxData:${companyId}`);
    return Promise.reject(new Error("Company ID no longer exists"));
  }

  // Check if we have a valid complete entry in cache
  const cachedEntry = taxDataCache.get(companyId);
  if (cachedEntry && cachedEntry.complete && isCacheValid(cachedEntry)) {
    console.timeEnd(`fetchCompanyTaxData:${companyId}`);
    return cachedEntry.data;
  }

  // If we have an ongoing loading promise, return that
  if (cachedEntry && cachedEntry.loadingPromise) {
    console.log(`Returning existing loading promise for company ${companyId}`);
    return cachedEntry.loadingPromise;
  }

  // Create empty initial data with current and previous year
  const [currentYear, previousYear] = getCurrentAndPreviousYear();
  const initialData: Record<string, TaxEntry[]> = {
    [currentYear]: createEmptyYearData(currentYear),
    [previousYear]: createEmptyYearData(previousYear),
  };

  // Start full data loading in background
  const loadingPromise = loadFullCompanyData(companyId, queryClient);

  // Store initial data + loading promise in cache
  taxDataCache.set(companyId, {
    data: initialData,
    timestamp: Date.now(),
    complete: false,
    loadingPromise,
  });

  console.timeEnd(`fetchCompanyTaxData:${companyId}`);
  return loadingPromise; // Return the promise so React Query can handle loading states
};

// Full data loading function that runs in background
const loadFullCompanyData = async (
  companyId: number,
  queryClient: any
): Promise<Record<string, TaxEntry[]>> => {
  console.time(`loadFullCompanyData:${companyId}`);
  try {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const twoYearsAgoStr = twoYearsAgo.toISOString().split("T")[0];

    // First, fetch all the payroll cycles
    const { data: cyclesData, error: cyclesError } = await supabase
      .from("payroll_cycles")
      .select("id, month_year")
      .gte("month_year", twoYearsAgoStr)
      .order("month_year", { ascending: false });

    if (cyclesError) throw cyclesError;

    // Group cycles by year
    const yearGroups: Record<string, string[]> = {};
    cyclesData?.forEach((cycle) => {
      const [year] = cycle.month_year.split("-");
      if (!yearGroups[year]) yearGroups[year] = [];
      yearGroups[year].push(cycle.id);
    });

    const years = Object.keys(yearGroups).sort().reverse();
    const result: Record<string, TaxEntry[]> = {};

    // Process each year in parallel
    await Promise.all(
      years.map(async (year) => {
        // Initialize with empty data
        result[year] = Array.from({ length: 12 }, (_, i) =>
          createEmptyTaxEntry(getMonthName(i + 1))
        );

        // Execute batch requests with larger batch size
        const batchSize = 50; // Increased batch size
        const cycleDetailsData = await batchRequests(
          yearGroups[year],
          batchSize,
          fetchCycleBatch
        );
        const recordsData = await batchRequests(
          yearGroups[year],
          batchSize,
          (batchIds) => fetchRecordsBatch(batchIds, companyId)
        );

        // Create a map for faster lookups
        const cycleMap: Record<string, string> = {};
        cycleDetailsData.forEach((cycle) => {
          cycleMap[cycle.id] = cycle.month_year;
        });

        // Process records data
        recordsData.forEach((record) => {
          if (!record.payment_receipts_extractions) return;

          const monthYear = cycleMap[record.payroll_cycle_id];
          if (!monthYear) return;

          const [_, monthStr] = monthYear.split("-");
          const monthIdx = parseInt(monthStr, 10) - 1;

          Object.entries(
            record.payment_receipts_extractions as PaymentReceiptExtractions
          ).forEach(([taxType, data]) => {
            if (!data) return;

            const mappedTaxType = mapTaxType(taxType);
            if (!mappedTaxType) return;

            if (
              result[year][monthIdx] &&
              result[year][monthIdx][mappedTaxType]
            ) {
              result[year][monthIdx][mappedTaxType] = {
                amount: parseAmount(data.amount || "0"),
                date: parseDate(data.payment_date || null),
                status: data.status || null,
                bank: data.bank_name || null,
                payMode: data.payment_mode || null,
              };
            }
          });
        });
      })
    );

    // Update cache with complete data
    taxDataCache.set(companyId, {
      data: result,
      timestamp: Date.now(),
      complete: true,
    });

    // Save updated cache to localStorage
    setTimeout(saveCacheToStorage, 100);

    console.timeEnd(`loadFullCompanyData:${companyId}`);
    return result;
  } catch (error) {
    console.error(`Error loading data for company ${companyId}:`, error);

    // If we failed, remove the loading promise and mark as incomplete
    const existingEntry = taxDataCache.get(companyId);
    if (existingEntry) {
      taxDataCache.set(companyId, {
        ...existingEntry,
        loadingPromise: undefined,
      });
    }

    throw error;
  }
};

// Prefetch multiple companies in parallel
const prefetchMultipleCompanies = async (
  companyIds: number[],
  queryClient: any
) => {
  const prioritizedIds = [...companyIds]; // Make a copy to sort

  // Only prefetch companies not already in cache
  const idsToFetch = prioritizedIds.filter((id) => {
    const cachedEntry = taxDataCache.get(id);
    return !cachedEntry || !cachedEntry.complete || !isCacheValid(cachedEntry);
  });

  if (idsToFetch.length === 0) return;

  console.log(
    `Prefetching ${idsToFetch.length} companies: ${idsToFetch.join(", ")}`
  );

  // Process in small batches to avoid overwhelming the browser
  const batchSize = 3;
  for (let i = 0; i < idsToFetch.length; i += batchSize) {
    const batch = idsToFetch.slice(i, i + batchSize);

    // Use Promise.all for parallel execution within the batch
    await Promise.all(
      batch.map((id) =>
        fetchCompanyTaxData(id, queryClient).catch((err) =>
          console.error(`Failed to prefetch company ${id}:`, err)
        )
      )
    );

    // Small delay between batches
    if (i + batchSize < idsToFetch.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
};

// Map tax type from database format to UI format
const mapTaxType = (dbTaxType: string): string => {
  const taxTypeMap: Record<string, string> = {
    paye_receipt: "paye",
    housing_levy_receipt: "housingLevy",
    nita_receipt: "nita",
    shif_receipt: "shif",
    nssf_receipt: "nssf",
  };
  return taxTypeMap[dbTaxType] || dbTaxType;
};

// Parse date string from database format
const parseDate = (dateStr: string | null): string | null => {
  if (!dateStr) return null;
  try {
    // Convert date format if needed
    return dateStr;
  } catch (e) {
    console.error("Error parsing date:", e);
    return null;
  }
};

// Convert month number to month name
const getMonthName = (monthNum: number): string => {
  return [
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
  ][monthNum - 1];
};

// Initialize empty tax entry
const createEmptyTaxEntry = (month: string): TaxEntry => ({
  month,
  paye: { amount: 0, date: null },
  housingLevy: { amount: 0, date: null },
  nita: { amount: 0, date: null },
  shif: { amount: 0, date: null },
  nssf: { amount: 0, date: null },
});

// Parse amount from string to number
const parseAmount = (amountStr: string): number => {
  if (!amountStr) return 0;
  // Remove all commas and other non-numeric characters except decimal point
  const cleanedStr = amountStr.replace(/[^0-9.-]/g, "");
  return parseFloat(cleanedStr) || 0;
};

// Fetch cycle batch function with optimized query
const fetchCycleBatch = async (batchIds: string[]) => {
  if (!batchIds || batchIds.length === 0) return [];

  const { data, error } = await supabase
    .from("payroll_cycles")
    .select("id, month_year")
    .in("id", batchIds);

  if (error) throw error;
  return data || [];
};

// Fetch records batch function with optimized query
const fetchRecordsBatch = async (batchIds: string[], companyId: number) => {
  if (!batchIds || batchIds.length === 0) return [];

  const { data, error } = await supabase
    .from("company_payroll_records")
    .select("id, payroll_cycle_id, payment_receipts_extractions")
    .eq("company_id", companyId)
    .in("payroll_cycle_id", batchIds);

  if (error) throw error;
  return data || [];
};

export const useCompanyTaxReports = () => {
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "paye",
    "housingLevy",
    "nita",
    "shif",
    "nssf",
  ]);

  // Track initial load completion
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const prefetchedCompanies = useRef(new Set<number>());

  // Track company ID changes
  const previousCompaniesRef = useRef<any[]>([]);

  // Companies query without pagination
  const {
    data: companies = [],
    isLoading: isLoadingCompanies,
    error: companiesError,
  } = useQuery({
    queryKey: ["companies", searchQuery],
    queryFn: () => fetchCompanies(searchQuery),
    staleTime: 5 * 60 * 1000,
  });

  // Detect company ID changes and handle accordingly
  useEffect(() => {
    if (!companies || companies.length === 0 || !previousCompaniesRef.current.length) {
      previousCompaniesRef.current = [...(companies || [])];
      return;
    }

    const currentIds = companies.map(c => c.id);
    const previousIds = previousCompaniesRef.current.map(c => c.id);

    // Check for changes
    const added = currentIds.filter(id => !previousIds.includes(id));
    const removed = previousIds.filter(id => !currentIds.includes(id));

    if (added.length > 0 || removed.length > 0) {
      console.warn("Company IDs changed:", { added, removed });

      // If currently selected company is no longer available, reset selection
      if (selectedCompany && !currentIds.includes(selectedCompany)) {
        console.warn(`Selected company ${selectedCompany} is no longer available`);
        setSelectedCompany(null);

        // Clear cache for removed companies
        removed.forEach(id => {
          taxDataCache.delete(id);
        });

        // Save updated cache
        saveCacheToStorage();
      }
    }

    // Update reference
    previousCompaniesRef.current = [...(companies || [])];
  }, [companies, selectedCompany]);

  // Company tax data query with seamless loading and error handling
  const { data: reportData = {}, isLoading: isLoadingTaxData, error: taxDataError } = useQuery({
    queryKey: ["companyTaxData", selectedCompany],
    queryFn: () =>
      selectedCompany
        ? fetchCompanyTaxData(selectedCompany, queryClient, companies)
        : Promise.resolve({}),
    enabled: !!selectedCompany && initialLoadComplete,
    staleTime: 30 * 60 * 1000, // 30 minutes
    keepPreviousData: true, // Keep previous data while loading new data
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry if company ID doesn't exist
      if (error?.message === "Company ID no longer exists") {
        return false;
      }
      return failureCount < 2; // Retry other errors up to 2 times
    },
    onError: (error) => {
      console.error("Error fetching tax data:", error);
      // If error is due to company ID not existing, reset selection
      if (error?.message === "Company ID no longer exists") {
        setSelectedCompany(null);
      }
    }
  });

  // Prefetch first few companies when company list loads
  useEffect(() => {
    if (!initialLoadComplete || companies.length === 0 || isLoadingCompanies)
      return;

    // Only run this once per search
    const companiesToPrefetch = companies.slice(0, 5).map((c) => c.id);
    const needsPrefetch = companiesToPrefetch.some(
      (id) => !prefetchedCompanies.current.has(id)
    );

    if (needsPrefetch) {
      // Mark these companies as prefetched
      companiesToPrefetch.forEach((id) => prefetchedCompanies.current.add(id));

      // Start prefetching with a slight delay to not block UI
      setTimeout(() => {
        prefetchMultipleCompanies(companiesToPrefetch, queryClient);
      }, 200);
    }
  }, [companies, isLoadingCompanies, initialLoadComplete, queryClient]);

  // Function to toggle tax type selection
  const toggleTaxType = (taxId: string) => {
    setSelectedColumns((prev) => {
      if (taxId === "month") return prev;

      if (prev.includes(taxId)) {
        return prev.filter((col) => col !== taxId);
      } else {
        return [...prev, taxId];
      }
    });
  };

  // Improved prefetch function with smart prefetching
  const prefetchCompanyData = useCallback(
    (companyId: number, index: number) => {
      if (!companyId) return;

      // Add to set of prefetched companies
      prefetchedCompanies.current.add(companyId);

      // Prefetch this company immediately
      queryClient.prefetchQuery({
        queryKey: ["companyTaxData", companyId],
        queryFn: () => fetchCompanyTaxData(companyId, queryClient),
        staleTime: 30 * 60 * 1000,
      });

      // Prefetch nearby companies in background with slight delay
      if (companies.length > 1) {
        setTimeout(() => {
          const nearbyIndices = [index - 1, index + 1, index + 2];
          const validNearbyIds = nearbyIndices
            .filter((i) => i >= 0 && i < companies.length)
            .map((i) => companies[i].id)
            .filter((id) => !prefetchedCompanies.current.has(id))
            .slice(0, 2); // Limit to 2 nearby companies

          if (validNearbyIds.length > 0) {
            prefetchMultipleCompanies(validNearbyIds, queryClient);
            validNearbyIds.forEach((id) => prefetchedCompanies.current.add(id));
          }
        }, 500);
      }
    },
    [queryClient, companies]
  );

  // Custom function to determine if loading state should be shown
  const isLoading = useCallback(() => {
    if (isLoadingCompanies) return true;

    // Only show loading for tax data if we don't have any data yet
    if (
      isLoadingTaxData &&
      selectedCompany &&
      Object.keys(reportData).length === 0
    ) {
      // Check if we have any partial data in cache
      const cachedEntry = taxDataCache.get(selectedCompany);
      if (cachedEntry && Object.keys(cachedEntry.data).length > 0) {
        return false; // We have some data, don't show loading
      }
      return true;
    }

    return false;
  }, [isLoadingCompanies, isLoadingTaxData, selectedCompany, reportData]);

  // Function to clear cache (for testing)
  const clearCache = useCallback(() => {
    taxDataCache.clear();
    localStorage.removeItem(LOCALSTORAGE_KEY);
    console.log("Cache cleared");

    // Force refetch companies to get fresh IDs
    queryClient.invalidateQueries(["companies"]);
  }, [queryClient]);

  const [viewMode, setViewMode] = useState<"table" | "overall">("table");
  const [startDate, setStartDate] = useState("2015-01");
  const [endDate, setEndDate] = useState("2025-12");

  // Add getMonthsInRange helper
  const getMonthsInRange = useCallback((start: string, end: string) => {
    const startDate = new Date(start + "-01");
    const endDate = new Date(end + "-01");
    const months = [];

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

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

      months.push({
        name: monthNames[month],
        year: year,
        label: `${monthNames[month]} ${year}`,
      });

      currentDate.setMonth(month + 1);
    }

    return months;
  }, []);

  // Initialize cache from localStorage on first load
  useEffect(() => {
    initCacheFromStorage();
    setInitialLoadComplete(true);

    // Set up periodic cache save
    const saveInterval = setInterval(saveCacheToStorage, 60000); // Save every minute

    // Set up periodic cache validation (every 15 minutes)
    const validateInterval = setInterval(() => {
      // Check if any company IDs in cache no longer exist in the database
      if (companies && companies.length > 0) {
        const currentIds = new Set(companies.map(c => c.id));
        const cachedIds = Array.from(taxDataCache.keys());

        const invalidIds = cachedIds.filter(id => !currentIds.has(id));
        if (invalidIds.length > 0) {
          console.warn(`Removing ${invalidIds.length} invalid company IDs from cache`);
          invalidIds.forEach(id => taxDataCache.delete(id));
          saveCacheToStorage();
        }
      }
    }, 15 * 60 * 1000);

    return () => {
      clearInterval(saveInterval);
      clearInterval(validateInterval);
      saveCacheToStorage(); // Save on unmount
    };
  }, [companies]);

  return {
    companies,
    reportData,
    selectedCompany,
    setSelectedCompany,
    searchQuery,
    setSearchQuery,
    loading: isLoading(),
    selectedColumns,
    setSelectedColumns,
    toggleTaxType,
    prefetchCompanyData,
    clearCache,
    viewMode,
    setViewMode,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    getMonthsInRange,
  };
};
