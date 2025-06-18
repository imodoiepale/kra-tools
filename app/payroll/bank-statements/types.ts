// Shared types for bank statements

export interface Bank {
    id: number;
    bank_name: string;
    account_number: string;
    bank_currency: string;
    company_id: number;
    company_name: string;
    acc_password?: string;
}

export interface BankStatement {
    id: string;
    has_soft_copy: boolean;
    has_hard_copy: boolean;
    statement_document: {
        statement_pdf: string | null;
        statement_excel: string | null;
        document_size?: number;
        document_type?: string;
        password?: string | null;
    };
    statement_extractions: any;
    validation_status: any;
    status: any;
    statement_month?: number;
    statement_year?: number;
}

export interface Company {
    id: number;
    company_name: string;
    acc_client_effective_from: string | null;
    acc_client_effective_to: string | null;
    audit_client_effective_from: string | null;
    audit_client_effective_to: string | null;
    sheria_client_effective_from: string | null;
    sheria_client_effective_to: string | null;
    imm_client_effective_from: string | null;
    imm_client_effective_to: string | null;
}

export interface BankReconciliationTableProps {
    selectedYear: number;
    selectedMonth: number;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onStatsChange: () => void;
    selectedClientTypes: FilterWithStatus[];
    selectedStatementStatuses: FilterWithStatus[];
}

export interface FilterWithStatus {
    id: number;
    name: string;
    status: string;
}
