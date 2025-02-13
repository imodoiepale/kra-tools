// types.ts
export interface Company {
    id: string
    company_name: string
    created_at: string
    updated_at: string
}

export interface CompanyTaxPaymentRecord {
    id: string
    company: Company
    payroll_cycle_id: string
    status: {
        verification_date: string | null
        status: 'pending' | 'verified' | 'completed'
        assigned_to: string | null
        filing?: {
            isReady: boolean
            filingDate: string
            isNil: boolean
            filedBy: string
        }
    }
    documents: {
        paye_ack: string | null
        paye: string | null
        housing_levy: string | null
        shif: string | null
        nssf: string | null
        all_csv: string | null
    }
}

export type DocumentType = 'paye_ack' | 'paye' | 'housing_levy' | 'shif' | 'nssf' | 'all_csv';
