import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Company {
  id: number
  company_name: string
  kra_pin?: string | null
  // Dates for Accounting
  acc_client_effective_from?: string | null
  acc_client_effective_to?: string | null
  // Dates for Audit/Tax
  audit_client_effective_from?: string | null
  audit_client_effective_to?: string | null
  // Dates for Sheria/CPS
  sheria_client_effective_from?: string | null
  sheria_client_effective_to?: string | null
  // Dates for Immigration
  imm_client_effective_from?: string | null
  imm_client_effective_to?: string | null
  created_at?: string
  updated_at?: string
}

// Represents `PinCheckerDetails`
export interface PinCheckerDetails {
  id: number
  company_name: string
  income_tax_company_status?: 'Registered' | 'Not Registered' | null
}

// The final, combined data structure passed to the client
export interface EnrichedCompany extends Company {
  income_tax_company_status: 'Registered' | 'Not Registered' | 'Unknown';
  categoryStatus: {
    acc: 'active' | 'inactive';
    audit_tax: 'active' | 'inactive';
    cps_sheria: 'active' | 'inactive';
    imm: 'active' | 'inactive';
  };
}

// Represents the `it_return_details` table
export interface ItReturnDetails {
  id: number
  company_id: number
  kra_pin: string
  acknowledgement_no: string
  return_period_from: string
  return_period_to: string
  date_of_filing?: string | null
  return_info_summary?: any
  section_a_1?: any
  section_a_2?: any
  section_a_3?: any
  section_a_4?: any
  section_a_5?: any
  section_b1_1?: any
  section_b1_2?: any
  section_b_1?: any
  section_b_2?: any
  section_b_3?: any
  section_b_4?: any
  section_c_1?: any
  section_c_2?: any
  section_c_3?: any
  section_d_1?: any
  section_d_2?: any
  section_e1_1?: any
  section_e1_2?: any
  section_e1_3?: any
  section_e1_4?: any
  section_e_1?: any
  section_e_2?: any
  section_f_1?: any
  section_f_2?: any
  section_g1_1?: any
  section_g1_2?: any
  section_h_1?: any
  section_h_2?: any
  section_i_1?: any
  section_i_2?: any
  section_j_1?: any
  section_j_2?: any
  section_k_1?: any
  section_k_2?: any
  section_l_1?: any
  section_l_2?: any
  section_m_1?: any
  section_m_2?: any
  section_m_3?: any
  section_m_4?: any
  section_n_1?: any
  section_n_2?: any
  extraction_timestamp?: string | null
  processing_status?: string | null
  error_message?: string | null
  created_at?: string | null
  updated_at?: string | null
}

// Represents the `company_it_return_listings` table
export interface CompanyItReturnListings {
  id?: number
  company_id: number
  listing_data: any
  last_scraped_at: string
  updated_at: string
}