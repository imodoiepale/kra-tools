//@ts-nocheck
import { supabase } from '@/lib/supabase';

export interface Customer {
    id: number;
    customer_name_as_per_pin: string;
    pin_no: string;
    last_checked_at: string | null;
}

export async function fetchCustomers() {
    try {
        let allData: Customer[] = [];
        let page = 0;
        const pageSize = 1000; // Supabase's maximum limit
        let hasMore = true;

        while (hasMore) {
            const { data, error, count } = await supabase
                .from('acc_portal_kra_customers')
                .select('*', { count: 'exact' })
                .order('pin_no', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error('Error fetching customers:', error);
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

        return allData as Customer[];
    } catch (error) {
        console.error('Error in fetchCustomers:', error);
        throw error;
    }
}

export async function fetchCustomersByPinNo() {
    try {
        let allData: Customer[] = [];
        let page = 0;
        const pageSize = 1000; // Supabase's maximum limit
        let hasMore = true;

        while (hasMore) {
            const { data, error, count } = await supabase
                .from('acc_portal_kra_customers')
                .select('id, pin_no, customer_name_as_per_pin', { count: 'exact' })
                .order('pin_no', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error('Error fetching customers:', error);
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

        return allData as Customer[];
    } catch (error) {
        console.error('Error in fetchCustomersByPinNo:', error);
        throw error;
    }
}
