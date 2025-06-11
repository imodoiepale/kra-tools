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
  vat_status?: string | null
}

// The final, combined data structure passed to the client
export interface EnrichedCompany extends Company {
  vat_status: string // e.g., 'Registered' or 'Unknown'
}

// Other types remain the same
export interface VatReturnDetails {
  id?: number
  company_id: number
  kra_pin: string
  month: number
  year: number
  is_nil_return: boolean
  section_b: any
  section_b2: any
  section_e: any
  section_f: any
  section_f2: any
  section_k3: any
  section_m: any
  section_n: any
  section_o: any
  extraction_timestamp: string
  processing_status: string
  error_message?: string
  updated_at: string
}

// Represents the `company_vat_return_listings` table
export interface CompanyVatReturnListings {
  id?: number
  company_id: number
  listing_data: any
  last_scraped_at: string
  updated_at: string
}