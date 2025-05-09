import { supabase } from '@/lib/supabase';

export interface Supplier {
    id: number;
    supplier_name_as_per_pin: string;
    pin_no: string;
    last_checked_at: string | null;
}

export async function fetchSuppliers() {
    try {
        const { data, error } = await supabase
            .from('acc_portal_kra_suppliers')
            .select('*')
            .order('pin_no', { ascending: true });

        if (error) {
            console.error('Error fetching suppliers:', error);
            throw error;
        }

        return data as Supplier[];
    } catch (error) {
        console.error('Error in fetchSuppliers:', error);
        throw error;
    }
}

export async function fetchSuppliersByPinNo() {
    try {
        const { data, error } = await supabase
            .from('acc_portal_kra_suppliers')
            .select('id, pin_no, supplier_name_as_per_pin')
            .order('pin_no', { ascending: true });

        if (error) {
            console.error('Error fetching suppliers:', error);
            throw error;
        }

        return data as Supplier[];
    } catch (error) {
        console.error('Error in fetchSuppliersByPinNo:', error);
        throw error;
    }
}
