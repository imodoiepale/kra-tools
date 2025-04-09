// @ts-nocheck
import { useState, useMemo, useCallback, useEffect } from 'react';

interface Company {
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
}

interface ServiceCategory {
  label: string;
  key: string;
  selected: boolean;
  isActive: boolean;
}

const isDateInRange = (currentDate: Date, fromDate?: string | null, toDate?: string | null): boolean => {
  if (!fromDate || !toDate) return false;
  
  try {
    const parseDate = (dateStr: string) => {
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
      }
      return new Date(dateStr);
    };

    const from = parseDate(fromDate);
    const to = parseDate(toDate);
    
    return currentDate >= from && currentDate <= to;
  } catch (error) {
    console.error('Error parsing dates:', error);
    return false;
  }
};

export function useCompanyFilters(companies: Company[]) {
  // Track total count of filtered companies
  const [totalFilteredCount, setTotalFilteredCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['acc', 'audit_tax']);
  const currentDate = new Date();

  const getFilters = useCallback((): ServiceCategory[] => {
    return [
      {
        label: 'All',
        key: 'all',
        selected: selectedFilters.length === 0,
        isActive: true
      },
      {
        label: 'Accounting',
        key: 'acc',
        selected: selectedFilters.includes('acc'),
        isActive: true
      },
      {
        label: 'Audit Tax',
        key: 'audit_tax',
        selected: selectedFilters.includes('audit_tax'),
        isActive: true
      },
      {
        label: 'Sheria',
        key: 'cps_sheria',
        selected: selectedFilters.includes('cps_sheria'),
        isActive: true
      },
      {
        label: 'Immigration',
        key: 'imm',
        selected: selectedFilters.includes('imm'),
        isActive: true
      }
    ];
  }, [selectedFilters]);

  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // Apply search filter
      const matchesSearch = company.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      // If no filters selected or "all" is selected, show all that match search
      if (selectedFilters.length === 0) return matchesSearch;
      
      // Check if any selected filter matches
      const matchesFilters = selectedFilters.some(filterKey => {
        const fromDate = company[`${filterKey}_client_effective_from`];
        const toDate = company[`${filterKey}_client_effective_to`];
        return isDateInRange(currentDate, fromDate, toDate);
      });

      return matchesSearch && matchesFilters;
    });
  }, [companies, searchQuery, selectedFilters, currentDate]);

  const handleFilterChange = useCallback((filterKey: string) => {
    if (filterKey === 'all') {
      setSelectedFilters([]);
      return;
    }

    setSelectedFilters(prev => {
      if (prev.includes(filterKey)) {
        return prev.filter(k => k !== filterKey);
      } else {
        return [...prev, filterKey];
      }
    });
  }, []);

  // Update total count when filtered companies change
  useEffect(() => {
    setTotalFilteredCount(filteredCompanies.length);
  }, [filteredCompanies]);

  return {
    searchQuery,
    setSearchQuery,
    selectedFilters,
    setSelectedFilters,
    filteredCompanies,
    getFilters,
    handleFilterChange,
    isDateInRange,
    totalFilteredCount
  };
}