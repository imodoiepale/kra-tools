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
const SECTION_MAPPING = {
  sectionA: {
    name: "Section A",
    fullName: "Basic Information",
    columns: ["section_a_1", "section_a_2", "section_a_3", "section_a_4", "section_a_5"],
  },
  sectionB1: {
    name: "Section B1",
    fullName: "Profit/Loss Account Details",
    columns: ["section_b1_1", "section_b1_2"],
  },
  sectionB: {
    name: "Section B",
    fullName: "Profit/Loss Account",
    columns: ["section_b_1", "section_b_2", "section_b_3", "section_b_4"],
  },
  sectionC: {
    name: "Section C",
    fullName: "Balance Sheet",
    columns: ["section_c_1", "section_c_2", "section_c_3"],
  },
  sectionD: {
    name: "Section D",
    fullName: "Stock Details",
    columns: ["section_d_1", "section_d_2"],
  },
  sectionE1: {
    name: "Section E1",
    fullName: "Capital Allowances Details",
    columns: ["section_e1_1", "section_e1_2", "section_e1_3", "section_e1_4"],
  },
  sectionE: {
    name: "Section E",
    fullName: "Capital Allowances",
    columns: ["section_e_1", "section_e_2"],
  },
  sectionF: {
    name: "Section F",
    fullName: "Installment Tax Paid",
    columns: ["section_f_1", "section_f_2"],
  },
  sectionG1: {
    name: "Section G1",
    fullName: "Tax Withheld Details",
    columns: ["section_g1_1", "section_g1_2"],
  },
  sectionG2: {
    name: "Section G2",
    fullName: "Additional Tax Withheld",
    columns: ["section_h_1", "section_h_2"], // Note: mapped to section_h columns as per your script
  },
  sectionH: {
    name: "Section H",
    fullName: "Other Details",
    columns: ["section_h_1", "section_h_2"],
  },
  sectionI: {
    name: "Section I",
    fullName: "Income Tax Paid",
    columns: ["section_i_1", "section_i_2"],
  },
  sectionJ: {
    name: "Section J",
    fullName: "Double Taxation Agreement",
    columns: ["section_j_1", "section_j_2"],
  },
  sectionK: {
    name: "Section K",
    fullName: "Losses Carried Forward",
    columns: ["section_k_1", "section_k_2"],
  },
  sectionL: {
    name: "Section L",
    fullName: "Partnership Income",
    columns: ["section_l_1", "section_l_2"],
  },
  sectionM: {
    name: "Section M",
    fullName: "Tax Computation",
    columns: ["section_m_1", "section_m_2", "section_m_3", "section_m_4"],
  },
  sectionN: {
    name: "Section N",
    fullName: "Trust/Estate Income",
    columns: ["section_n_1", "section_n_2"],
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