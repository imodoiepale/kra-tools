//@ts-nocheck
import { supabase } from '@/lib/supabase';

export interface Supplier {
    id: number;
    manufacturer_name: string;
    pin_no: string;
    last_checked_at: string | null;
}

export async function fetchSuppliers() {
    try {
        let allData: Supplier[] = [];
        let page = 0;
        const pageSize = 1000; // Supabase's maximum limit
        let hasMore = true;

        while (hasMore) {
            const { data, error, count } = await supabase
                .from('acc_portal_kra_pins_suppliers_and_customers')
                .select('*', { count: 'exact' })
                .order('pin_no', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error('Error fetching suppliers:', error);
                throw error;
            }

            if (data) {
                allData = [...allData, ...data];
                // Check if we've fetched all records
                hasMore = data.length === pageSize;
                page++;
            } else {
                hasMore = false;
            }
        }

        return allData as Supplier[];
    } catch (error) {
        console.error('Error in fetchSuppliers:', error);
        throw error;
    }
}

export async function fetchSuppliersByPinNo() {
    try {
        let allData: Supplier[] = [];
        let page = 0;
        const pageSize = 1000; // Supabase's maximum limit
        let hasMore = true;

        while (hasMore) {
            const { data, error, count } = await supabase
                .from('acc_portal_kra_pins_suppliers_and_customers')
                .select('id, pin_no, manufacturer_name', { count: 'exact' })
                .order('pin_no', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error('Error fetching suppliers:', error);
                throw error;
            }

            if (data) {
                allData = [...allData, ...data];
                // Check if we've fetched all records
                hasMore = data.length === pageSize;
                page++;
            } else {
                hasMore = false;
            }
        }

        return allData as Supplier[];
    } catch (error) {
        console.error('Error in fetchSuppliersByPinNo:', error);
        throw error;
    }
}
