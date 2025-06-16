// types/fileManagement.ts
//@ts-nocheck
export interface Company {
    id: string;
    company_name: string;
    kra_pin: string;
    category: 'corporate' | 'sme' | 'individual' | 'ngo';
    industry: string;
    status: 'active' | 'inactive' | 'suspended';
    priority: 'high' | 'medium' | 'low';
    contact_person: string;
    email: string;
    phone: string;
    created_at: string;
    updated_at: string;
}

export interface FileRecord {
    id: string;
    company_id: string;
    company_name: string;
    year: number;
    month: number;
    received_at?: string;
    received_by: string;
    delivery_method: string;
    document_types: string[];
    files_count: number;
    delivered_at?: string;
    delivered_to: string;
    delivery_notes: string;
    status: 'pending' | 'received' | 'processed' | 'delivered' | 'nil';
    is_nil: boolean;
    processing_notes: string;
    created_at: string;
    updated_at: string;
    created_by: string;
}

export interface FileManagementStats {
    total_companies: number;
    received_this_month: number;
    delivered_this_month: number;
    pending_receipt: number;
    pending_delivery: number;
    nil_records: number;
    overdue_count: number;
}

export interface BulkOperation {
    type: 'mark_received' | 'mark_delivered' | 'mark_nil' | 'reset_status';
    company_ids: string[];
    data: {
        year: number;
        month: number;
        received_by?: string;
        delivered_to?: string;
        notes?: string;
        is_urgent?: boolean;
    };
}
// Add these interfaces to your existing types file

export interface ReceptionRecord {
    id: string;
    received_at: string;
    received_by: string;
    brought_by: string;
    delivery_method: string;
    document_types: string[];
    files_count: number;
    reception_notes: string;
    is_urgent: boolean;
    created_at: string;
    created_by: string;
}

export interface DeliveryRecord {
    id: string;
    reception_id: string;
    delivered_at: string;
    delivered_to: string;
    picked_by: string;
    delivery_location: string;
    delivery_notes: string;
    created_at: string;
    created_by: string;
}

// Update the FileRecord interface
export interface FileRecord {
    id: string;
    company_id: string | number;
    company_name: string;
    year: number;
    month: number;
    receptions: ReceptionRecord[];
    deliveries: DeliveryRecord[];
    status: string;
    is_nil: boolean;
    is_urgent: boolean;
    processing_status: string;
    created_at: string;
    updated_at: string;
    created_by: string;
    updated_by: string;
}

export interface Individual {
    id: string;
    full_name: string;
    role?: string;
    employment_history?: any[];
}

// Keep your existing Company, FileManagementStats, and BulkOperation interfaces