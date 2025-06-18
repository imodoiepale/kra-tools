// @ts-nocheck
import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const fetchIncomeTaxRegisteredCompanies = async () => {
  console.log(`📋 Fetching companies registered for Income Tax from Supabase...`);
  const { data: companyData, error: companyError } = await supabase
    .from("acc_portal_company_duplicate")
    .select("*")
    .order('company_name', { ascending: true })
    .order('id', { ascending: true });

  if (companyError) {
    throw new Error(`Error reading company data: ${companyError.message}`);
  }

  const companyNames = companyData.map(company => company.company_name);
  
  console.log(`... Checking registration status for ${companyNames.length} companies.`);

  const { data: pinDetails, error: pinError } = await supabase
    .from("PinCheckerDetails")
    .select("company_name, income_tax_company_status")
    .in("company_name", companyNames)
    .eq("income_tax_company_status", "Registered");

  if (pinError) {
    throw new Error(`Error reading PIN details: ${pinError.message}`);
  }

  const registeredCompanyNames = new Set(pinDetails.map(d => d.company_name));
  
  const filteredData = companyData.filter(company => registeredCompanyNames.has(company.company_name));
  
  console.log(`📊 Found ${filteredData.length} companies registered for Income Tax.`);
  return filteredData.map((company) => ({
    id: Number(company.id),
    name: company.company_name,
    ...company
  }));
};

const fetchCompanies = async (searchQuery: string, filterByIncomeTax: boolean) => {
  if (filterByIncomeTax) {
    return fetchIncomeTaxRegisteredCompanies();
  }

  let query = supabase
    .from("acc_portal_company_duplicate")
    .select("*")
    .order("company_name");

  if (searchQuery) {
    query = query.ilike("company_name", `%${searchQuery}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data?.map((company) => ({
    id: Number(company.id),
    name: company.company_name,
    ...company
  })) || [];
};

export function useCompanyTaxReports() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [filterByIncomeTax, setFilterByIncomeTax] = useState(false);
  const queryClient = useQueryClient();

  const { data: companies, isLoading: loading } = useQuery({
    queryKey: ["companies", searchQuery, filterByIncomeTax],
    queryFn: () => fetchCompanies(searchQuery, filterByIncomeTax),
  });

  const clearCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["companies"] });
  }, [queryClient]);

  return {
    companies,
    selectedCompany,
    setSelectedCompany,
    loading,
    clearCache,
    searchQuery,
    setSearchQuery,
    filterByIncomeTax,
    setFilterByIncomeTax,
  };
}
