// types/index.ts
export interface Company {
    id: string
    company_name: string
    created_at: string
    updated_at: string
}

export interface PayrollCycle {
    id: string
    month_year: string
    status: 'active' | 'closed'
    created_at: string
    updated_at: string
}

export interface CompanyPayrollRecord {
    id: string
    company_id: string
    payroll_cycle_id: string
    status: {
        finalization_date: string | null
        status: 'pending' | 'completed'
        assigned_to: string | null
        filing?: {
            isReady: boolean;
            filingDate: string;
            isNil: boolean;
            filedBy: string;
        }
    }
    filing_status?: {
        isReady: boolean;
        filingDate: string;
        isNil: boolean;
        filedBy: string;
    };
    documents: {
        paye_csv: string | null
        hslevy_csv: string | null
        shif_exl: string | null
        nssf_exl: string | null
        zip_file_kra: string | null
        all_csv: string | null
    }
    company: Company
    created_at: string
    updated_at: string
}

export type DocumentType = 'paye_csv' | 'hslevy_csv' | 'shif_exl' | 'nssf_exl' | 'zip_file_kra' | 'all_csv';

export interface DocumentStatus {
    [key: string]: string | null;
}

export interface FilingStatus {
    isReady: boolean;
    filingDate: string;
    isNil: boolean;
    filedBy: string;
}

export interface FilingDialogState {
    isOpen: boolean;
    recordId: string | null;
    isNil: boolean;
    confirmOpen: boolean;
    record?: CompanyPayrollRecord;
}

export interface CompanyPayrollRecord {
    id: string;
    company: Company;
    payroll_cycle_id: string;
    documents: {
        [key in DocumentType]: string | null;
    };
    status: {
        finalization_date: string | null;
        status: 'pending' | 'completed';
        assigned_to: string | null;
        filing?: {
            isReady: boolean;
            filingDate: string;
            isNil: boolean;
            filedBy: string;
        }
    };
    filing?: FilingStatus;
}

// export type DocumentType = keyof CompanyPayrollRecord['documents']