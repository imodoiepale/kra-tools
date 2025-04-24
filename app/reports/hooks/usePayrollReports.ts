// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface TaxData {
  amount: string | number;
  date: string | null;
  status: string | null;
  bank: string | null;
  payMode: string | null;
}

export interface MonthData {
  paye: TaxData;
  housingLevy: TaxData;
  nita: TaxData;
  shif: TaxData;
  nssf: TaxData;
}

export interface PayrollReportData {
  [companyId: string]: {
    [year: string]: MonthData[];
  };
}

export function usePayrollReports() {
  const [reportData, setReportData] = useState<PayrollReportData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Function to fetch data for all companies in date range
  const fetchReportData = useCallback(async (startDate: string, endDate: string, companyIds: number[]) => {
    console.log("[DEBUG] fetchReportData called with:", { startDate, endDate, companies: companyIds.length });
    
    if (!companyIds || companyIds.length === 0) {
      console.warn("[DEBUG] No companies to fetch data for");
      return {};
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Fetch all relevant payroll cycles in the date range
      const { data: cyclesData, error: cyclesError } = await supabase
        .from("payroll_cycles")
        .select("id, month_year")
        .gte("month_year", startDate)
        .lte("month_year", endDate);
      
      if (cyclesError) throw cyclesError;
      
      console.log("[DEBUG] Fetched payroll cycles:", cyclesData?.length || 0);
      
      if (!cyclesData || cyclesData.length === 0) {
        console.log("[DEBUG] No payroll cycles found in date range");
        setLoading(false);
        return {};
      }
      
      // Create a map of cycle IDs and their corresponding month/year
      const cycleIds = cyclesData.map(cycle => cycle.id);
      const cycleMap = {};
      
      cyclesData.forEach(cycle => {
        const [year, month] = cycle.month_year.split('-');
        cycleMap[cycle.id] = { 
          year, 
          monthIndex: parseInt(month) - 1 
        };
      });
      
      // Step 2: Fetch all company records for these cycles (in batches if needed)
      const batchSize = 50;
      const allRecords = [];
      
      for (let i = 0; i < companyIds.length; i += batchSize) {
        const batchCompanyIds = companyIds.slice(i, i + batchSize);
        
        const { data: recordsData, error: recordsError } = await supabase
          .from("company_payroll_records")
          .select(`
            id, 
            company_id,
            payroll_cycle_id, 
            payment_receipts_extractions
          `)
          .in("company_id", batchCompanyIds)
          .in("payroll_cycle_id", cycleIds);
        
        if (recordsError) throw recordsError;
        
        if (recordsData && recordsData.length > 0) {
          allRecords.push(...recordsData);
        }
      }
      
      console.log("[DEBUG] Fetched company payroll records:", allRecords.length);
      
      // Step 3: Process the data into the format expected by the table
      const processedData: PayrollReportData = {};
      
      // Initialize data structure for all companies
      companyIds.forEach(companyId => {
        processedData[companyId] = {};
        
        // Get all years in the date range
        const startYear = parseInt(startDate.split('-')[0]);
        const endYear = parseInt(endDate.split('-')[0]);
        
        // Initialize years in the date range
        for (let year = startYear; year <= endYear; year++) {
          processedData[companyId][year] = Array(12).fill(null).map(() => ({
            paye: { amount: '0', date: null, status: null, bank: null, payMode: null },
            housingLevy: { amount: '0', date: null, status: null, bank: null, payMode: null },
            nita: { amount: '0', date: null, status: null, bank: null, payMode: null },
            shif: { amount: '0', date: null, status: null, bank: null, payMode: null },
            nssf: { amount: '0', date: null, status: null, bank: null, payMode: null }
          }));
        }
      });
      
      // Populate with actual data
      allRecords.forEach(record => {
        const companyId = record.company_id;
        const cycleInfo = cycleMap[record.payroll_cycle_id];
        
        if (cycleInfo && processedData[companyId] && processedData[companyId][cycleInfo.year]) {
          const extractions = record.payment_receipts_extractions || {};
          
          // Map tax types from database format to UI format
          const taxTypeMap = {
            paye_receipt: "paye",
            housing_levy_receipt: "housingLevy",
            nita_receipt: "nita",
            shif_receipt: "shif",
            nssf_receipt: "nssf"
          };
          
          // Process each tax type
          Object.entries(extractions).forEach(([dbTaxType, data]) => {
            if (!data) return;
            
            const taxType = taxTypeMap[dbTaxType] || dbTaxType;
            
            if (processedData[companyId][cycleInfo.year][cycleInfo.monthIndex] && 
                processedData[companyId][cycleInfo.year][cycleInfo.monthIndex][taxType]) {
              
              processedData[companyId][cycleInfo.year][cycleInfo.monthIndex][taxType] = {
                // Keep the original amount string from the database instead of converting to number
                amount: data.amount || '0',
                date: data.payment_date || null,
                status: data.status || null,
                bank: data.bank_name || null,
                payMode: data.payment_mode || null
              };
            }
          });
        }
      });
      
      console.log("[DEBUG] Processed data structure:", {
        companies: Object.keys(processedData).length,
        sampleCompany: Object.keys(processedData)[0] ? {
          id: Object.keys(processedData)[0],
          years: Object.keys(processedData[Object.keys(processedData)[0]]),
          monthCount: Object.keys(processedData)[0] && 
            Object.keys(processedData[Object.keys(processedData)[0]])[0] ? 
            processedData[Object.keys(processedData)[0]][Object.keys(processedData[Object.keys(processedData)[0]])[0]].length : 0
        } : null
      });
      
      setReportData(processedData);
      return processedData;
    } catch (err) {
      console.error("[DEBUG] Error fetching report data:", err);
      setError(err);
      return {};
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    reportData,
    loading,
    error,
    fetchReportData
  };
}
