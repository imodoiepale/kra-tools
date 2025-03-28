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
        finalization_date: string | null;
        assigned_to: string | null;
        status: string;
    };
    payment_slips_status: {
        status: string;
        assigned_to: string | null;
        verification_date: string | null;
    };
    payment_slips_documents: {
        paye_acknowledgment: string | null;
        paye_slip: string | null;
        housing_levy_slip: string | null;
        shif_slip: string | null;
        nssf_slip: string | null;
        nita_slip: string | null;
    };
}

export type DocumentType =
    | 'paye_acknowledgment'
    | 'paye_slip'
    | 'housing_levy_slip'
    | 'shif_slip'
    | 'nssf_slip'
    | 'nita_slip';