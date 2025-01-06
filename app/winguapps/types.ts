export interface ReportRecord {
    ID: number;
    CompanyName: string;
    Month: number;
    PAYE_Link?: string;
    NSSF_Link?: string;
    NHIF_Link?: string;
    SHIF_Link?: string;
    Housing_Levy_Link?: string;
    NITA_List?: string;
    PAYE_CSV_Link?: string;
    Housing_Levy_CSV_Link?: string;
    NSSF_Excel_Link?: string;
    NHIF_Excel_Link?: string;
    SHIF_Excel_Link?: string;
    Payroll_Summary_Link?: string;
    Payroll_Summary_Excel_Link?: string;
    Payroll_Recon_Link?: string;
    Control_Total_Link?: string;
    Payslips_Link?: string;
    Bank_List_Link?: string;
    Cash_List?: string;
    MPESA_List?: string;
}

export interface VisibleColumns {
    StatutoryDocs: boolean;
    PayrollDocs: boolean;
    PaymentLists: boolean;
}

export interface SortConfig {
    key: string;
    direction: 'asc' | 'desc';
}

export interface SelectedDocs {
    PAYE_PDF: boolean;
    NSSF_PDF: boolean;
    NHIF_PDF: boolean;
    SHIF_PDF: boolean;
    Housing_Levy_PDF: boolean;
    NITA_PDF: boolean;
    PAYE_CSV: boolean;
    Housing_Levy_CSV: boolean;
    NSSF_Excel: boolean;
    NHIF_Excel: boolean;
    SHIF_Excel: boolean;
    Payroll_Summary_PDF: boolean;
    Payroll_Summary_Excel: boolean;
    Payroll_Recon: boolean;
    Control_Total: boolean;
    Payslips: boolean;
    Bank_List: boolean;
    Cash_List: boolean;
    MPESA_List: boolean;
}

export interface DownloadStatus {
    [key: string]: {
        status: 'pending' | 'downloading' | 'completed' | 'error';
        message?: string;
    };
}

export interface DocumentInfo {
    url: string;
    name: string;
}

export interface DocumentMap {
    [key: string]: DocumentInfo;
}
