import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://zyszsqgdlrpnunkegipk.supabase.co"
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5c3pzcWdkbHJwbnVua2VnaXBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwODMyNzg5NCwiZXhwIjoyMDIzOTAzODk0fQ.7ICIGCpKqPMxaSLiSZ5MNMWRPqrTr5pHprM0lBaNing"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types based on your database schema
export interface Company {
  id: number
  company_name: string
  kra_pin: string
  kra_password: string
  created_at?: string
  updated_at?: string
}

export interface VatReturnDetails {
  id?: number
  company_id: number
  kra_pin: string
  return_period_from_date: string
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

export interface CompanyVatReturnListings {
  id?: number
  company_id: number
  listing_data: any
  last_scraped_at: string
  updated_at: string
}
