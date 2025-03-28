export interface Company {
  id: number
  company_name?: string
  name?: string
  kra_pin?: string
  kra_password?: string
  nhif_id?: string
  nhif_code?: string
  nhif_password?: string
  nssf_id?: string
  nssf_code?: string
  nssf_password?: string
  ecitizen_identifier?: string
  ecitizen_password?: string
  quickbooks_id?: string
  quickbooks_password?: string
  kebs_id?: string
  kebs_password?: string
  director?: string
  status?: string
  last_checked?: string
  acc_client_effective_from?: string
  acc_client_effective_to?: string
  audit_tax_client_effective_from?: string
  audit_tax_client_effective_to?: string
  cps_sheria_client_effective_from?: string
  cps_sheria_client_effective_to?: string
  imm_client_effective_from?: string
  imm_client_effective_to?: string
}

export interface CategoryFilter {
  label: string
  key: string
  checked: boolean
}
