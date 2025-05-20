'use client'

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { X } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { UsersIcon } from 'lucide-react';

interface Company {
  id: string;
  company_name: string;
  kra_pin: string;
  service_categories?: string[];
  acc_client_effective_from?: string;
  acc_client_effective_to?: string;
  audit_client_effective_from?: string;
  audit_client_effective_to?: string;
  status?: {
    is_active?: boolean;
  };
}

interface WHVATCompanyTableProps {
  selectedCompanies: string[];
  setSelectedCompanies: (companies: string[]) => void;
  filteredCategories?: string[];
}

export function WHVATCompanyTable({ selectedCompanies, setSelectedCompanies, filteredCategories }: WHVATCompanyTableProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const [clientType, setClientType] = useState('all'); // For filtering by client type

  // Fetch companies data directly from Supabase
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true);
        const currentDate = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

        // Fetch companies from acc_portal_company_duplicate table
        const { data, error } = await supabase
          .from('acc_portal_company_duplicate')
          .select('id, company_name, kra_pin, acc_client_effective_from, acc_client_effective_to, audit_client_effective_from, audit_client_effective_to');

        if (error) {
          throw error;
        }

        // Process and format company data
        const processedData = data?.map(company => {
          // Determine if company is active (either acc or audit client active now)
          // A company is active if:
          // 1. Both effective dates exist
          // 2. effective_from is before or equal to today
          // 3. effective_to is after or equal to today (i.e., in the future or today)
          const isAccActive = Boolean(
            company.acc_client_effective_from && 
            company.acc_client_effective_to && 
            new Date(company.acc_client_effective_from) <= new Date(currentDate) && 
            new Date(company.acc_client_effective_to) >= new Date(currentDate)
          );
                             
          const isAuditActive = Boolean(
            company.audit_client_effective_from && 
            company.audit_client_effective_to && 
            new Date(company.audit_client_effective_from) <= new Date(currentDate) && 
            new Date(company.audit_client_effective_to) >= new Date(currentDate)
          );

          // Determine service categories based on active status
          const serviceCategories = [];
          if (isAccActive) serviceCategories.push('accounting');
          if (isAuditActive) serviceCategories.push('audit');

          return {
            id: company.id,
            company_name: company.company_name || 'Unknown',
            kra_pin: company.kra_pin || 'N/A',
            service_categories: serviceCategories,
            acc_client_effective_from: company.acc_client_effective_from,
            acc_client_effective_to: company.acc_client_effective_to,
            audit_client_effective_from: company.audit_client_effective_from,
            audit_client_effective_to: company.audit_client_effective_to,
            status: {
              is_active: isAccActive || isAuditActive
            }
          };
        }) || [];

        setCompanies(processedData);
      } catch (error) {
        console.error('Error fetching companies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  // Filter companies based on search query, categories, and client type
  const filteredCompanies = companies.filter(company => {
    // First filter by search query
    const matchesSearch = !searchQuery ||
      company.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.kra_pin?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Filter by client type
    if (clientType === 'acc' && !company.service_categories?.includes('accounting')) {
      return false;
    }

    if (clientType === 'audit' && !company.service_categories?.includes('audit')) {
      return false;
    }

    // If no categories are selected or filteredCategories is undefined, show all companies
    if (!filteredCategories || filteredCategories.length === 0) return true;

    // Check if company matches any of the selected category filters
    return filteredCategories.some(filter => {
      if (filter.includes('_status_')) {
        // Handle status-specific category filters
        const [category, _, status] = filter.split('_');
        const isActive = status === 'active';

        return company.service_categories?.includes(category) &&
          company.status?.is_active === isActive;
      } else {
        // Handle regular category filters
        return company.service_categories?.includes(filter);
      }
    });
  });

  // Toggle select all companies
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);

    if (checked) {
      setSelectedCompanies(filteredCompanies.map(company => company.id));
    } else {
      setSelectedCompanies([]);
    }
  };

  // Toggle select individual company
  const handleSelectCompany = (companyId: string, checked: boolean) => {
    if (checked) {
      setSelectedCompanies([...selectedCompanies, companyId]);
    } else {
      setSelectedCompanies(selectedCompanies.filter(id => id !== companyId));
    }
  };

  // Update selectAll state when filtered companies or selections change
  useEffect(() => {
    if (filteredCompanies.length > 0 && selectedCompanies.length === filteredCompanies.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedCompanies, filteredCompanies]);

  // Render loading skeleton
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle><Skeleton className="h-8 w-3/4" /></CardTitle>
          <CardDescription><Skeleton className="h-4 w-1/2" /></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="border rounded-md">
            <div className="p-4">
              {Array(5).fill(0).map((_, idx) => (
                <div key={idx} className="flex items-center py-2">
                  <Skeleton className="h-4 w-4 mr-2" />
                  <Skeleton className="h-4 w-1/3 mr-4" />
                  <Skeleton className="h-4 w-1/4 mr-4" />
                  <Skeleton className="h-6 w-16 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:space-x-4">
        {/* Search and filters section */}
        <div className="w-full md:w-1/3 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or PIN"
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0.5 top-0.5 h-8 w-8 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-row space-x-2">
            <Button
              variant={clientType === 'all' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setClientType('all')}
            >
              All Clients
            </Button>
            <Button
              variant={clientType === 'acc' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setClientType('acc')}
            >
              Accounting
            </Button>
            <Button
              variant={clientType === 'audit' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setClientType('audit')}
            >
              Audit
            </Button>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {selectedCompanies.length > 0 ? 
                `${selectedCompanies.length} companies selected` : 
                `${filteredCompanies.length} companies found`}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedCompanies([])}
              disabled={selectedCompanies.length === 0}
            >
              Clear Selection
            </Button>
          </div>
        </div>

        {/* Companies list and selected companies */}
        <div className="flex-1 flex">
          <motion.div
            className="pr-2 flex-1"
            initial={{ width: "100%" }}
            animate={{ width: selectedCompanies.length > 0 ? "50%" : "100%" }}
            transition={{ duration: 0.3 }}
          >
            <div className="max-h-[420px] overflow-y-auto border rounded-md">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <div className="h-4 w-4">
                        <Skeleton className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] sticky top-0 bg-white">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all companies"
                        />
                      </TableHead>
                      <TableHead className="sticky top-0 bg-white">Company</TableHead>
                      <TableHead className="w-[100px] sticky top-0 bg-white">PIN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                          No companies found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCompanies
                        .sort((a, b) => a.company_name.localeCompare(b.company_name, undefined, { sensitivity: 'base' }))
                        .map((company, index) => (
                          <TableRow key={company.id}>
                            <TableCell className="py-2">
                              <Checkbox
                                checked={selectedCompanies.includes(company.id)}
                                onCheckedChange={(checked) => handleSelectCompany(company.id, !!checked)}
                                aria-label={`Select ${company.company_name}`}
                              />
                            </TableCell>
                            <TableCell className="py-2 font-medium truncate max-w-[180px]">
                              {company.company_name || 'Unknown'}
                              {company.status?.is_active ? (
                                <Badge variant="success" className="ml-2">Active</Badge>
                              ) : (
                                <Badge variant="destructive" className="ml-2">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-2">{company.kra_pin || 'N/A'}</TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </motion.div>

          {selectedCompanies.length > 0 && (
            <motion.div
              className="pl-2 flex-1"
              initial={{ width: "0%", opacity: 0 }}
              animate={{ width: "50%", opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="border rounded-md max-h-[420px] overflow-y-auto">
                <div className="p-2 bg-muted flex items-center">
                  <UsersIcon className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Selected Companies ({selectedCompanies.length})</span>
                </div>
                <Table>
                  <TableBody>
                    {companies
                      .filter(c => selectedCompanies.includes(c.id))
                      .sort((a, b) => a.company_name.localeCompare(b.company_name, undefined, { sensitivity: 'base' }))
                      .map((company, index) => (
                        <TableRow key={company.id} className="bg-blue-50">
                          <TableCell className="py-2 w-[40px] text-center">{index + 1}</TableCell>
                          <TableCell className="py-2 truncate max-w-[140px]">{company.company_name}</TableCell>
                          <TableCell className="py-2 w-[60px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleSelectCompany(company.id, false)}
                            >
                              ✕
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="mt-2 text-sm text-muted-foreground">
        <span>{selectedCompanies.length} of {filteredCompanies.length} companies selected</span>
      </div>
    </div>
  );
}
