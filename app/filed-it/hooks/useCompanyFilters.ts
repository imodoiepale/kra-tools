// @ts-nocheck
import { useState, useMemo, useEffect } from 'react';

interface Company {
  id: number;
  name: string;
  acc_client_effective_from: string | null;
  acc_client_effective_to: string | null;
  audit_client_effective_from: string | null;
  audit_client_effective_to: string | null;
  sheria_client_effective_from: string | null;
  sheria_client_effective_to: string | null;
  imm_client_effective_from: string | null;
  imm_client_effective_to: string | null;
}

const isDateInRange = (currentDate: Date, fromDate?: string | null, toDate?: string | null): boolean => {
  if (!fromDate) return false; 

  try {
    const parseDate = (dateStr: string) => {
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
      }
      return new Date(dateStr);
    };

    const from = parseDate(fromDate);
    const to = toDate ? parseDate(toDate) : new Date('9999-12-31');

    return currentDate >= from && currentDate <= to;
  } catch (error) {
    console.error('Error parsing dates:', error);
    return false;
  }
};

export function useCompanyFilters(companies: Company[]) {
  const [totalFilteredCount, setTotalFilteredCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<any>({
    acc: { active: true },
    audit: { active: true },
  });
  const currentDate = new Date();

  const filteredCompanies = useMemo(() => {
    if (!Array.isArray(companies)) {
      return [];
    }

    return companies.filter(company => {
      if (!company) return false;

      const matchesSearch = company.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
      if (!matchesSearch) return false;

      const filterCategories = Object.keys(selectedFilters);
      if (filterCategories.length === 0) {
        return true; 
      }

      if (selectedFilters.all?.all) {
        return true;
      }

      return filterCategories.every(category => {
        if (category === 'all') return true;

        const categoryStatuses = selectedFilters[category];
        const selectedStatusKeys = Object.keys(categoryStatuses).filter(status => categoryStatuses[status]);

        if (selectedStatusKeys.length === 0 || selectedStatusKeys.includes('all')) {
            return true; 
        }

        const fromDate = company[`${category}_client_effective_from`];
        const toDate = company[`${category}_client_effective_to`];
        
        const isActive = isDateInRange(currentDate, fromDate, toDate);

        return selectedStatusKeys.some(status => {
          if (status === 'active') return isActive;
          if (status === 'inactive') return !isActive;
          return false;
        });
      });
    });
  }, [companies, searchQuery, selectedFilters, currentDate]);

  useEffect(() => {
    setTotalFilteredCount(filteredCompanies.length);
  }, [filteredCompanies]);

  return {
    searchQuery,
    setSearchQuery,
    selectedFilters,
    setSelectedFilters,
    filteredCompanies,
    totalFilteredCount,
  };
}

