// components/BankStatements/BulkUpload/types.ts

export interface Bank {
    id: number
    bank_name: string
    account_number: string
    bank_currency: string
    company_id: number
    company_name: string
    acc_password?: string
}

export interface BulkUploadItem {
    file: File
    status: 'pending' | 'processing' | 'matched' | 'unmatched' | 'failed' | 'uploaded' | 'vouched'
    extractedData: any
    matchedBank?: Bank
    closingBalance?: number | null
    error?: string
    matchConfidence?: number
    uploadProgress?: number
    isVouched?: boolean
    vouchNotes?: string
    hasSoftCopy?: boolean
    hasHardCopy?: boolean
    password?: string
    passwordApplied?: boolean
    detectedInfo?: {
        password?: string;
        accountNumber?: string;
        bankName?: string;
    }
    uploadedPdfPath?: string
    fileName?: { shortName: string, fullName: string, extension: string }
    originalName?: string
}

export interface CompanyGroup {
    companyId: number
    companyName: string
    isExpanded: boolean
    isVouched: boolean
    statements: BulkUploadItem[]
}

export interface PasswordProtectedFile {
    index: number
    fileName: string
    file: File
    possiblePasswords: string[]
}