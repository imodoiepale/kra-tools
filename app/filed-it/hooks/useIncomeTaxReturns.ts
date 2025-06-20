// @ts-nocheck
import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

const fetchIncomeTaxReturns = async (companyId: number) => {
  if (!companyId) return null;

  const { data, error } = await supabase
    .from("it_return_details")
    .select("*")
    .eq("company_id", companyId)
    .order("return_period_from", { ascending: false });

  if (error) {
    throw new Error(`Error reading income tax returns: ${error.message}`);
  }

  return data;
};

// Section mapping configuration
// Updated section mapping with all new sections and parts
const SECTION_MAPPING = {
  sectionA: {
    name: "Section A",
    fullName: "Return Information",
    columns: ["section_a_1", "section_a_2", "section_a_3", "section_a_4", "section_a_5"],
    parts: [
      "Part 1 - Return Information",
      "Part 2 - Bank Details", 
      "Part 3 - Details of Auditor",
      "Part 4 - Landlord Details",
      "Part 5 - Tenant Details"
    ]
  },
  sectionB1: {
    name: "Section B1",
    fullName: "Profit/Loss Account",
    columns: ["section_b1_1", "section_b1_2"],
    parts: [
      "Part I - Other Expenses (Describe the Head of Expense)",
      "Part II - Other Income (Describe the Head of Income)"
    ]
  },
  sectionB: {
    name: "Section B",
    fullName: "Profit/Surplus and Loss Account",
    columns: ["section_b_1", "section_b_2"],
    parts: [
      "Part I - Other Expenses (Describe the Head of Expense)",
      "Part II - Other Income (Describe the Head of Income)"
    ]
  },
  sectionB2: {
    name: "Section B2",
    fullName: "Related Party Transactions",
    columns: ["section_b2_1", "section_b2_2", "section_b2_3", "section_b2_4"],
    parts: [
      "Part 1 - Particulars of Related Party Transactions or Controlled Transactions",
      "Part 2 - Financial Performance of the Local Entity vs Consolidated Performance",
      "Part 3a - Controlled Transactions that give Rise to Taxable Income or Tax Deductible Expenses",
      "Part 3b - Controlled Transactions of a Capital Nature"
    ]
  },
  sectionC: {
    name: "Section C",
    fullName: "Balance Sheet",
    columns: ["section_c_1", "section_c_2", "section_c_3"],
    parts: ["Balance Sheet"]
  },
  sectionD: {
    name: "Section D",
    fullName: "Stock Details",
    columns: ["section_d_1", "section_d_2"],
    parts: [
      "Part 1 - Quantitative Details of Stock/Inventory (Trading Concern)",
      "Part 2 - Quantitative Details of Stock/Inventory (Raw Material Details)"
    ]
  },
  sectionE1: {
    name: "Section E1",
    fullName: "Capital Allowances Additions",
    columns: ["section_e1_1", "section_e1_2", "section_e1_3", "section_e1_4"],
    parts: [
      "Part 1 - Addition to Plant and Machinery and Investment Deduction",
      "Part 2 - Addition to Building, Investment Deduction", 
      "Part 3 - Deductions In Respect of Farm Works",
      "Part 4 - Deductions in respect of Extractive Industries"
    ]
  },
  sectionE2: {
    name: "Section E2",
    fullName: "Wear and Tear Deductions",
    columns: ["section_e2_1", "section_e2_2"],
    parts: ["Part A - Reducing Balance Method"]
  },
  sectionE2Part3: {
    name: "Section E2 Part 3",
    fullName: "Additional Wear and Tear Deductions",
    columns: ["section_e2_3", "section_e2_4"],
    parts: ["Part 3 - Additional Wear and Tear Deductions"]
  },
  sectionE: {
    name: "Section E",
    fullName: "Summary of Capital Allowance",
    columns: ["section_e_1", "section_e_2"],
    parts: ["Capital Allowance Summary"]
  },
  sectionF: {
    name: "Section F",
    fullName: "Details of Installment Tax Paid",
    columns: ["section_f_1", "section_f_2"],
    parts: ["Installment Tax Details"]
  },
  sectionG: {
    name: "Section G",
    fullName: "Details of Tax Withheld",
    columns: ["section_g_1", "section_g_2"],
    parts: ["Tax Withheld Details"]
  },
  sectionH: {
    name: "Section H",
    fullName: "Details of Advance Tax on Commercial Vehicles",
    columns: ["section_h_1", "section_h_2"],
    parts: ["Advance Tax on Commercial Vehicles"]
  },
  sectionI: {
    name: "Section I",
    fullName: "Details of Income Tax Paid",
    columns: ["section_i_1", "section_i_2"],
    parts: [
      "Section I1 - Advance Payment",
      "Section I2 - Self Assessment Tax"
    ]
  },
  sectionJ: {
    name: "Section J",
    fullName: "Details of Double Taxation Agreement",
    columns: ["section_j_1", "section_j_2"],
    parts: ["Double Taxation Agreement"]
  },
  sectionK: {
    name: "Section K",
    fullName: "Details of Losses",
    columns: ["section_k_1", "section_k_2"],
    parts: ["Losses Brought Forward and Carried Forward"]
  },
  sectionL: {
    name: "Section L",
    fullName: "Partnership Income",
    columns: ["section_l_1", "section_l_2"],
    parts: ["Partnership Income"]
  },
  sectionM: {
    name: "Section M",
    fullName: "Tax Computation",
    columns: ["section_m_1", "section_m_2"],
    parts: [
      "Part I - Other Disallowable Deductions",
      "Part II - Other Allowable Deductions"
    ]
  },
  sectionN: {
    name: "Section N",
    fullName: "Distribuatable Income Computation",
    columns: ["section_n_1", "section_n_2"],
    parts: ["Distribuatable Income Computation"]
  },
};

export function useIncomeTaxReturns(companyId: number | null) {
  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ["incomeTaxReturns", companyId],
    queryFn: () => fetchIncomeTaxReturns(companyId!),
    enabled: !!companyId,
    staleTime: 15 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });

  // Transform data for listings tab
  // Update the getListingsData function
const getListingsData = useCallback(() => {
    if (!rawData) return [];
  
    return rawData.map((record, index) => ({
      ...record,
      // Keep the raw database values for the table display
      return_info_summary: record.return_info_summary || {}
    }));
  }, [rawData]);

  // Transform data for section analysis
  const getSectionData = useCallback((sectionKey: string) => {
    if (!rawData || !SECTION_MAPPING[sectionKey]) return [];

    const sectionConfig = SECTION_MAPPING[sectionKey];
    const sectionData = [];

    rawData.forEach((record) => {
      const periodData = {
        period: record.return_period_from,
        acknowledgement_no: record.acknowledgement_no,
        return_period_to: record.return_period_to,
        date_of_filing: record.date_of_filing,
      };

      sectionConfig.columns.forEach((columnName, index) => {
        const columnData = record[columnName];
        if (columnData) {
          periodData[`table_${index + 1}`] = columnData;
        }
      });

      sectionData.push(periodData);
    });

    return sectionData;
  }, [rawData]);

  // Get all available tables/headers for a section across all periods
  const getSectionHeaders = useCallback((sectionKey: string) => {
    if (!rawData || !SECTION_MAPPING[sectionKey]) return [];

    const sectionConfig = SECTION_MAPPING[sectionKey];
    const headers = new Set();

    // Add basic headers
    headers.add("Period");
    headers.add("Acknowledgement No");

    // Extract headers from the first non-null table data
    rawData.forEach((record) => {
      sectionConfig.columns.forEach((columnName, index) => {
        const columnData = record[columnName];
        if (columnData && columnData.data && Array.isArray(columnData.data)) {
          // If it's table data, extract headers from first row
          if (columnData.data.length > 0 && Array.isArray(columnData.data[0])) {
            columnData.data[0].forEach((header) => {
              if (header && typeof header === 'string') {
                headers.add(header);
              }
            });
          }
        }
      });
    });

    return Array.from(headers);
  }, [rawData]);

  // Get section status for navigation
  const getSectionStatus = useCallback((sectionKey: string) => {
    if (!rawData || !SECTION_MAPPING[sectionKey]) return "not_found";

    const sectionConfig = SECTION_MAPPING[sectionKey];
    let hasData = false;

    rawData.forEach((record) => {
      sectionConfig.columns.forEach((columnName) => {
        if (record[columnName]) {
          hasData = true;
        }
      });
    });

    return hasData ? "success" : "not_found";
  }, [rawData]);

  return {
    rawData,
    isLoading,
    error,
    getListingsData,
    getSectionData,
    getSectionHeaders,
    getSectionStatus,
    sectionMapping: SECTION_MAPPING,
  };
}