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

export interface ReceptionData {
    id: string;
    received_at: string;
    received_by: string;
    brought_by: string;
    delivery_method: string;
    document_types: string[];
    files_count: number;
    notes: string;
    is_urgent: boolean;
    created_at: string;
    created_by: string;
    updated_at?: string;
    updated_by?: string;
}

export interface DeliveryData {
    id: string;
    reception_id?: string; 
    delivered_at: string;
    delivered_to: string;
    picked_by: string;
    delivery_method: string;
    delivery_location: string;
    notes: string;
    status: 'delivered' | 'attempted' | 'pending' | 'returned' | 'cancelled';
    requires_signature: boolean;
    created_at: string;
    created_by: string;
    updated_at?: string;
    updated_by?: string;
}

export interface FileRecord {
    id: string;
    company_id: string | number;
    company_name: string;
    year: number;
    month: number;
    reception_data: ReceptionData[];
    delivery_data: DeliveryData[];
    processing_status: 'pending' | 'received' | 'processed' | 'delivered' | 'nil';
    is_urgent: boolean;
    created_at: string;
    updated_at: string;
    created_by: string;
    updated_by: string;
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

export interface Individual {
    id: string;
    full_name: string;
    role?: string;
    employment_history?: any[];
    email?: string;
    phone?: string;
}

// Legacy types for backward compatibility
export type ReceptionRecord = ReceptionData;
export type DeliveryRecord = DeliveryData;