// app/dashboard/hooks/useAutomations.ts

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Automation,
  AutomationType,
  AutomationStatus,
  AutomationFilters,
  AutomationStats
} from '../types';
import { sampleAutomations } from '../utils/sampleData';

export function useAutomations() {
  const [automations, setAutomations] = useState<Automation[]>(sampleAutomations);
  const [filters, setFilters] = useState<AutomationFilters>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get all unique automation types
  const automationTypes = useMemo<AutomationType[]>(() => {
    const types = new Set<AutomationType>();
    automations.forEach(automation => types.add(automation.type));
    return Array.from(types);
  }, [automations]);

  // Calculate automation stats
  const automationStats = useMemo<AutomationStats>(() => {
    const stats: AutomationStats = {
      total: automations.length,
      success: 0,
      failed: 0,
      inProgress: 0,
      pending: 0,
      byType: {
        authentication: 0,
        extraction: 0,
        compliance: 0,
        verification: 0,
        communication: 0
      }
    };

    automations.forEach(automation => {
      switch (automation.status) {
        case 'success': stats.success++; break;
        case 'failed': stats.failed++; break;
        case 'in-progress': stats.inProgress++; break;
        case 'pending': stats.pending++; break;
      }
      stats.byType[automation.type]++;
    });

    return stats;
  }, [automations]);

  // Apply filters to get filtered automations
  const filteredAutomations = useMemo(() => {
    return automations.filter(automation => {
      // Apply type filter
      if (filters.type && automation.type !== filters.type) {
        return false;
      }

      // Apply status filter
      if (filters.status && automation.status !== filters.status) {
        return false;
      }

      // Apply search filter (case insensitive)
      if (filters.search && !automation.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [automations, filters]);

  // Filter by type
  const filterByType = useCallback((type: AutomationType) => {
    setFilters(prev => ({ ...prev, type }));
  }, []);

  // Filter by status
  const filterByStatus = useCallback((status: AutomationStatus | 'all') => {
    setFilters(prev => {
      // If status is 'all', remove the status filter
      if (status === 'all') {
        const { status, ...rest } = prev;
        return rest;
      }
      // Otherwise, set the status filter
      return { ...prev, status };
    });
  }, []);

  // Search by name
  const searchAutomations = useCallback((searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Run automation
  const runAutomation = useCallback((automationId: string) => {
    setAutomations(prev => {
      const updatedAutomations = [...prev];
      const index = updatedAutomations.findIndex(a => a.id === automationId);

      if (index !== -1) {
        updatedAutomations[index] = {
          ...updatedAutomations[index],
          status: 'in-progress'
        };
      }

      return updatedAutomations;
    });

    // Simulate completion after 2 seconds
    setTimeout(() => {
      setAutomations(prev => {
        const updatedAutomations = [...prev];
        const index = updatedAutomations.findIndex(a => a.id === automationId);

        if (index !== -1) {
          updatedAutomations[index] = {
            ...updatedAutomations[index],
            status: Math.random() > 0.2 ? 'success' : 'failed',
            last_run_at: new Date().toISOString()
          };
        }

        return updatedAutomations;
      });
    }, 2000);
  }, []);

  // Run companies for specific automation
  const runCompanies = useCallback((automationId: string, companyIds: string[]) => {
    setAutomations(prev => {
      const updatedAutomations = [...prev];
      const automationIndex = updatedAutomations.findIndex(a => a.id === automationId);

      if (automationIndex !== -1) {
        const updatedCompanies = [...updatedAutomations[automationIndex].companies];

        companyIds.forEach(companyId => {
          const companyIndex = updatedCompanies.findIndex(c => c.id === companyId);
          if (companyIndex !== -1) {
            updatedCompanies[companyIndex] = {
              ...updatedCompanies[companyIndex],
              status: 'in-progress'
            };
          }
        });

        updatedAutomations[automationIndex] = {
          ...updatedAutomations[automationIndex],
          companies: updatedCompanies,
          status: 'in-progress'
        };
      }

      return updatedAutomations;
    });

    // Simulate completion for each company with staggered timeouts
    companyIds.forEach((companyId, index) => {
      setTimeout(() => {
        setAutomations(prev => {
          const updatedAutomations = [...prev];
          const automationIndex = updatedAutomations.findIndex(a => a.id === automationId);

          if (automationIndex !== -1) {
            const updatedCompanies = [...updatedAutomations[automationIndex].companies];
            const companyIndex = updatedCompanies.findIndex(c => c.id === companyId);

            if (companyIndex !== -1) {
              const status = Math.random() > 0.2 ? 'success' : 'failed';

              updatedCompanies[companyIndex] = {
                ...updatedCompanies[companyIndex],
                status,
                last_run: new Date().toISOString()
              };

              // Add log entry
              const newLog = {
                type: status === 'success' ? 'success' : 'error',
                message: status === 'success'
                  ? `Successfully executed automation for ${updatedCompanies[companyIndex].name}`
                  : `Failed to execute automation for ${updatedCompanies[companyIndex].name}`,
                timestamp: new Date().toISOString()
              };

              // Update automation status if all companies are done
              const allDone = updatedCompanies.every(c =>
                c.status !== 'in-progress' || !companyIds.includes(c.id)
              );

              const anyFailed = updatedCompanies.some(c =>
                companyIds.includes(c.id) && c.status === 'failed'
              );

              const automationStatus = allDone
                ? (anyFailed ? 'failed' : 'success')
                : 'in-progress';

              updatedAutomations[automationIndex] = {
                ...updatedAutomations[automationIndex],
                companies: updatedCompanies,
                logs: [newLog, ...updatedAutomations[automationIndex].logs].slice(0, 10),
                status: automationStatus,
                last_run_at: new Date().toISOString()
              };
            }
          }

          return updatedAutomations;
        });
      }, 2000 * (index + 1));
    });
  }, []);

  // Refresh data
  const refreshData = useCallback(() => {
    setIsRefreshing(true);

    setTimeout(() => {
      setAutomations(prev => {
        const updatedAutomations = [...prev];

        // Update a random automation
        const randomIndex = Math.floor(Math.random() * updatedAutomations.length);
        const possibleStatuses: AutomationStatus[] = ['success', 'failed', 'in-progress', 'pending'];

        updatedAutomations[randomIndex] = {
          ...updatedAutomations[randomIndex],
          status: possibleStatuses[Math.floor(Math.random() * possibleStatuses.length)],
          last_run_at: new Date().toISOString()
        };

        return updatedAutomations;
      });

      setIsRefreshing(false);
    }, 1500);
  }, []);

  return {
    automations,
    filteredAutomations,
    automationTypes,
    automationStats,
    filterByType,
    filterByStatus,
    searchAutomations,
    clearFilters,
    runAutomation,
    runCompanies,
    refreshData,
    isRefreshing
  };
}