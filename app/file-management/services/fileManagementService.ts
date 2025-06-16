// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import { Company, FileRecord, FileManagementStats, BulkOperation, ReceptionData, DeliveryData } from '../types/fileManagement';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to generate UUID
const generateUUID = () => crypto.randomUUID();

// Helper function to get current timestamp in ISO format
const getCurrentTimestamp = () => new Date().toISOString();

export class FileManagementService {
    // Companies CRUD
    static async getCompanies(): Promise<Company[]> {
        try {
            const { data, error } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .order('id');

            if (error) throw new Error(`Failed to fetch companies: ${error.message}`);
            
            return (data || []).map(item => ({
                id: item.id.toString(),
                company_name: item.company_name || '',
                kra_pin: item.kra_pin || '',
                category: item.client_category || 'corporate',
                industry: item.industry || '',
                status: item.company_status || 'active',
                priority: 'medium',
                contact_person: item.site_accountant_name || '',
                email: item.current_communication_email || item.kra_email || '',
                phone: item.phone || item.office_number || item.whatsapp_number || '',
                created_at: item.created_at || getCurrentTimestamp(),
                updated_at: item.updated_at || getCurrentTimestamp(),
                acc_client_effective_from: item.acc_client_effective_from,
                acc_client_effective_to: item.acc_client_effective_to,
                imm_client_effective_from: item.imm_client_effective_from,
                imm_client_effective_to: item.imm_client_effective_to,
                sheria_client_effective_from: item.sheria_client_effective_from,
                sheria_client_effective_to: item.sheria_client_effective_to,
                audit_client_effective_from: item.audit_client_effective_from,
                audit_client_effective_to: item.audit_client_effective_to
            }));
        } catch (error: any) {
            console.error('Error in getCompanies:', error.message);
            throw error;
        }
    }

    static async createCompany(company: Omit<Company, 'id' | 'created_at' | 'updated_at'>): Promise<Company> {
        try {
            const dbCompany = {
                company_name: company.company_name,
                kra_pin: company.kra_pin,
                client_category: company.category,
                industry: company.industry,
                company_status: company.status,
                site_accountant_name: company.contact_person,
                current_communication_email: company.email,
                phone: company.phone,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('acc_portal_company_duplicate')
                .insert([dbCompany])
                .select()
                .single();

            if (error) throw new Error(`Failed to create company: ${error.message}`);
            
            return {
                id: data.id.toString(),
                company_name: data.company_name || '',
                kra_pin: data.kra_pin || '',
                category: data.client_category || 'corporate',
                industry: data.industry || '',
                status: data.company_status || 'active',
                priority: 'medium',
                contact_person: data.site_accountant_name || '',
                email: data.current_communication_email || data.kra_email || '',
                phone: data.phone || data.office_number || data.whatsapp_number || '',
                created_at: data.created_at || new Date().toISOString(),
                updated_at: data.updated_at || new Date().toISOString()
            };
        } catch (error: any) {
            console.error('Error in createCompany:', error.message);
            throw error;
        }
    }

    static async getCompanyById(id: string): Promise<Company> {
        try {
            const { data, error } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw new Error(`Failed to fetch company: ${error.message}`);
            
            return {
                id: data.id.toString(),
                company_name: data.company_name || '',
                kra_pin: data.kra_pin || '',
                category: data.client_category || 'corporate',
                industry: data.industry || '',
                status: data.company_status || 'active',
                priority: 'medium',
                contact_person: data.site_accountant_name || '',
                email: data.current_communication_email || data.kra_email || '',
                phone: data.phone || data.office_number || data.whatsapp_number || '',
                created_at: data.created_at || new Date().toISOString(),
                updated_at: data.updated_at || new Date().toISOString()
            };
        } catch (error: any) {
            console.error('Error in getCompanyById:', error.message);
            throw error;
        }
    }

    // File Records CRUD with JSONB structure
    static async getFileRecords(year?: number, month?: number, companyId?: string): Promise<FileRecord[]> {
        try {
            let query = supabase
                .from('file_transactions')
                .select('*');

            if (year) query = query.eq('year', year);
            if (month) query = query.eq('month', month);
            if (companyId) query = query.eq('company_id', companyId);

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                if (error.message && (
                    error.message.includes('relation "file_transactions" does not exist') ||
                    error.message.includes('relation does not exist') ||
                    error.code === '42P01'
                )) {
                    console.log('File transactions table does not exist, returning empty array');
                    return [];
                }
                console.error('Error fetching file records:', error.message);
                return [];
            }

            // Transform the data to match our FileRecord interface
            return (data || []).map(item => ({
                id: item.id.toString(),
                company_id: item.company_id,
                company_name: item.company_name || '',
                year: item.year,
                month: item.month,
                reception_data: item.reception_data || [],
                delivery_data: item.delivery_data || [],
                processing_status: item.processing_status || 'pending',
                is_urgent: item.is_urgent || false,
                created_at: item.created_at,
                updated_at: item.updated_at,
                created_by: item.created_by || 'system',
                updated_by: item.updated_by || 'system'
            }));
        } catch (error: any) {
            console.error('Error in getFileRecords:', error.message);
            return [];
        }
    }

    static async createFileRecord(record: Omit<FileRecord, 'id' | 'created_at' | 'updated_at'>): Promise<FileRecord> {
        try {
            const now = getCurrentTimestamp();
            const { data, error } = await supabase
                .from('file_transactions')
                .insert([{
                    company_id: record.company_id,
                    company_name: record.company_name,
                    year: record.year,
                    month: record.month,
                    reception_data: record.reception_data || [],
                    delivery_data: record.delivery_data || [],
                    processing_status: record.processing_status || 'pending',
                    is_urgent: record.is_urgent || false,
                    created_at: now,
                    updated_at: now,
                    created_by: 'current_user', // Replace with actual user
                    updated_by: 'current_user'   // Replace with actual user
                }])
                .select()
                .single();

            if (error) {
                if (error.message && (
                    error.message.includes('relation "file_transactions" does not exist') ||
                    error.message.includes('relation does not exist') ||
                    error.code === '42P01'
                )) {
                    throw new Error('File transactions table does not exist. Please create the table first.');
                }
                throw new Error(`Failed to create file record: ${error.message}`);
            }
            
            return {
                ...data,
                reception_data: data.reception_data || [],
                delivery_data: data.delivery_data || []
            };
        } catch (error: any) {
            console.error('Error in createFileRecord:', error.message);
            throw error;
        }
    }

    static async updateFileRecord(id: string, updates: Partial<FileRecord>): Promise<FileRecord> {
        try {
            const now = getCurrentTimestamp();
            const { data, error } = await supabase
                .from('file_transactions')
                .update({
                    ...updates,
                    updated_at: now,
                    updated_by: 'current_user' // Replace with actual user
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                if (error.message && (
                    error.message.includes('relation "file_transactions" does not exist') ||
                    error.message.includes('relation does not exist') ||
                    error.code === '42P01'
                )) {
                    throw new Error('File transactions table does not exist. Please create the table first.');
                }
                throw new Error(`Failed to update file record: ${error.message}`);
            }
            
            return {
                ...data,
                reception_data: data.reception_data || [],
                delivery_data: data.delivery_data || []
            };
        } catch (error: any) {
            console.error('Error in updateFileRecord:', error.message);
            throw error;
        }
    }

    // Reception management methods
    static async addReception(
        companyId: string,
        year: number,
        month: number,
        receptionData: Omit<ReceptionData, 'id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by'>
    ): Promise<FileRecord> {
        try {
            const company = await this.getCompanyById(companyId);
            const now = getCurrentTimestamp();
            const userId = 'current_user'; // Replace with actual user ID
            
            const reception: ReceptionData = {
                ...receptionData,
                id: generateUUID(),
                created_at: now,
                created_by: userId,
                updated_at: now,
                updated_by: userId
            };

            // Try to find existing record for this company/year/month
            const { data: existing } = await supabase
                .from('file_transactions')
                .select('*')
                .eq('company_id', companyId)
                .eq('year', year)
                .eq('month', month)
                .maybeSingle();

            if (existing) {
                // Add reception to existing record
                const updatedReceptions = [
                    ...(existing.reception_data || []),
                    reception
                ];
                
                return await this.updateFileRecord(existing.id.toString(), {
                    reception_data: updatedReceptions,
                    processing_status: 'received',
                    is_urgent: reception.is_urgent || existing.is_urgent || false,
                    updated_at: now,
                    updated_by: userId
                });
            } else {
                // Create new record with this reception
                const newRecord: Omit<FileRecord, 'id' | 'created_at' | 'updated_at'> = {
                    company_id: companyId,
                    company_name: company?.company_name || '',
                    year,
                    month,
                    reception_data: [reception],
                    delivery_data: [],
                    processing_status: 'received',
                    is_urgent: reception.is_urgent || false,
                    created_by: userId,
                    updated_by: userId
                };
                
                return await this.createFileRecord(newRecord);
            }
        } catch (error: any) {
            console.error('Error in addReception:', error.message);
            throw error;
        }
    }

    static async updateReception(
        recordId: string,
        receptionId: string,
        updates: Partial<Omit<ReceptionData, 'id' | 'created_at' | 'created_by'>>
    ): Promise<FileRecord> {
        try {
            const now = getCurrentTimestamp();
            const userId = 'current_user'; // Replace with actual user ID
            
            const { data: record } = await supabase
                .from('file_transactions')
                .select('*')
                .eq('id', recordId)
                .single();

            if (!record) throw new Error('File record not found');

            const updatedReceptions = (record.reception_data || []).map((reception: ReceptionData) =>
                reception.id === receptionId 
                    ? { 
                        ...reception, 
                        ...updates, 
                        updated_at: now,
                        updated_by: userId 
                    }
                    : reception
            );

            return await this.updateFileRecord(recordId, {
                reception_data: updatedReceptions,
                is_urgent: updatedReceptions.some((r: ReceptionData) => r.is_urgent) || false,
                updated_at: now,
                updated_by: userId
            });
        } catch (error: any) {
            console.error('Error in updateReception:', error.message);
            throw error;
        }
    }

    static async deleteReception(recordId: string, receptionId: string): Promise<FileRecord> {
        try {
            const now = getCurrentTimestamp();
            const userId = 'current_user'; // Replace with actual user ID
            
            const { data: record } = await supabase
                .from('file_transactions')
                .select('*')
                .eq('id', recordId)
                .single();

            if (!record) throw new Error('File record not found');

            const updatedReceptions = (record.reception_data || []).filter(
                (reception: ReceptionData) => reception.id !== receptionId
            );

            // Determine new processing status
            let newStatus = record.processing_status;
            if (updatedReceptions.length === 0) {
                // No more receptions, check if there are deliveries
                if (record.delivery_data && record.delivery_data.length > 0) {
                    newStatus = 'delivered';
                } else {
                    newStatus = 'pending';
                }
            }

            return await this.updateFileRecord(recordId, {
                reception_data: updatedReceptions,
                processing_status: newStatus,
                is_urgent: updatedReceptions.some((r: ReceptionData) => r.is_urgent) || false,
                updated_at: now,
                updated_by: userId
            });
        } catch (error: any) {
            console.error('Error in deleteReception:', error.message);
            throw error;
        }
    }

    // Delivery management methods
    static async addDelivery(
        companyId: string,
        year: number,
        month: number,
        deliveryData: Omit<DeliveryData, 'id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by'>,
        receptionId?: string
    ): Promise<FileRecord> {
        try {
            const now = getCurrentTimestamp();
            const userId = 'current_user'; // Replace with actual user ID
            
            const delivery: DeliveryData = {
                ...deliveryData,
                id: generateUUID(),
                reception_id: receptionId || 'general',
                created_at: now,
                created_by: userId,
                updated_at: now,
                updated_by: userId
            };

            // Try to find existing record
            const { data: existing } = await supabase
                .from('file_transactions')
                .select('*')
                .eq('company_id', companyId)
                .eq('year', year)
                .eq('month', month)
                .maybeSingle();

            if (!existing) {
                throw new Error('No file transaction record found. Documents must be received before delivery.');
            }

            const updatedDeliveries = [
                ...(existing.delivery_data || []),
                delivery
            ];
            
            // Determine new processing status
            let newStatus = existing.processing_status;
            if (delivery.status === 'delivered') {
                newStatus = 'delivered';
            } else if (existing.processing_status === 'pending') {
                newStatus = 'received';
            }

            return await this.updateFileRecord(existing.id.toString(), {
                delivery_data: updatedDeliveries,
                processing_status: newStatus,
                updated_at: now,
                updated_by: userId
            });
        } catch (error: any) {
            console.error('Error in addDelivery:', error.message);
            throw error;
        }
    }

    static async updateDelivery(
        recordId: string,
        deliveryId: string,
        updates: Partial<Omit<DeliveryData, 'id' | 'created_at' | 'created_by'>>
    ): Promise<FileRecord> {
        try {
            const now = getCurrentTimestamp();
            const userId = 'current_user'; // Replace with actual user ID
            
            const { data: record } = await supabase
                .from('file_transactions')
                .select('*')
                .eq('id', recordId)
                .single();

            if (!record) throw new Error('File record not found');

            const updatedDeliveries = (record.delivery_data || []).map((delivery: DeliveryData) =>
                delivery.id === deliveryId 
                    ? { 
                        ...delivery, 
                        ...updates, 
                        updated_at: now,
                        updated_by: userId 
                    }
                    : delivery
            );

            // Determine new processing status
            let newStatus = record.processing_status;
            if (updates.status === 'delivered') {
                newStatus = 'delivered';
            } else if (record.processing_status === 'pending' && record.reception_data?.length) {
                newStatus = 'received';
            }

            return await this.updateFileRecord(recordId, {
                delivery_data: updatedDeliveries,
                processing_status: newStatus,
                updated_at: now,
                updated_by: userId
            });
        } catch (error: any) {
            console.error('Error in updateDelivery:', error.message);
            throw error;
        }
    }

    static async deleteDelivery(recordId: string, deliveryId: string): Promise<FileRecord> {
        try {
            const now = getCurrentTimestamp();
            const userId = 'current_user'; // Replace with actual user ID
            
            const { data: record } = await supabase
                .from('file_transactions')
                .select('*')
                .eq('id', recordId)
                .single();

            if (!record) throw new Error('File record not found');

            const updatedDeliveries = (record.delivery_data || []).filter(
                (delivery: DeliveryData) => delivery.id !== deliveryId
            );

            // Determine new processing status
            let newStatus = record.processing_status;
            if (updatedDeliveries.length === 0) {
                // No more deliveries, revert to received if there are receptions
                newStatus = record.reception_data?.length ? 'received' : 'pending';
            } else if (updatedDeliveries.some((d: DeliveryData) => d.status === 'delivered')) {
                newStatus = 'delivered';
            } else {
                newStatus = 'received';
            }

            return await this.updateFileRecord(recordId, {
                delivery_data: updatedDeliveries,
                processing_status: newStatus,
                updated_at: now,
                updated_by: userId
            });
        } catch (error: any) {
            console.error('Error in deleteDelivery:', error.message);
            throw error;
        }
    }

    static async deleteReception(recordId: string, receptionId: string): Promise<FileRecord> {
        try {
            const { data: record } = await supabase
                .from('file_records')
                .select('*')
                .eq('id', recordId)
                .single();

            if (!record) throw new Error('File record not found');

            const updatedReceptions = (record.receptions || []).filter(
                (reception: ReceptionRecord) => reception.id !== receptionId
            );

            return await this.updateFileRecord(recordId, {
                receptions: updatedReceptions,
                status: updatedReceptions.length === 0 ? 'pending' : 'received'
            });
        } catch (error: any) {
            console.error('Error in deleteReception:', error.message);
            throw error;
        }
    }

    // Delivery management methods
    static async addDelivery(
        companyId: string,
        year: number,
        month: number,
        deliveryData: Omit<DeliveryRecord, 'id' | 'created_at' | 'created_by'>,
        receptionId?: string
    ): Promise<FileRecord> {
        try {
            const delivery: DeliveryRecord = {
                ...deliveryData,
                id: generateUUID(),
                reception_id: receptionId || 'general',
                created_at: new Date().toISOString(),
                created_by: 'current_user'
            };

            const { data: existing } = await supabase
                .from('file_records')
                .select('*')
                .eq('company_id', companyId)
                .eq('year', year)
                .eq('month', month)
                .single();

            if (!existing) throw new Error('No reception record found. Documents must be received before delivery.');

            const updatedDeliveries = [...(existing.deliveries || []), delivery];
            
            return await this.updateFileRecord(existing.id, {
                deliveries: updatedDeliveries,
                status: delivery.delivered_at ? 'delivered' : existing.status
            });
        } catch (error: any) {
            console.error('Error in addDelivery:', error.message);
            throw error;
        }
    }

    static async updateDelivery(
        recordId: string,
        deliveryId: string,
        updates: Partial<DeliveryRecord>
    ): Promise<FileRecord> {
        try {
            const { data: record } = await supabase
                .from('file_records')
                .select('*')
                .eq('id', recordId)
                .single();

            if (!record) throw new Error('File record not found');

            const updatedDeliveries = (record.deliveries || []).map((delivery: DeliveryRecord) =>
                delivery.id === deliveryId 
                    ? { ...delivery, ...updates, updated_at: new Date().toISOString() }
                    : delivery
            );

            // Update status based on delivery status
            let newStatus = record.status;
            const latestDelivery = updatedDeliveries[updatedDeliveries.length - 1];
            if (latestDelivery?.delivered_at) {
                newStatus = 'delivered';
            }

            return await this.updateFileRecord(recordId, {
                deliveries: updatedDeliveries,
                status: newStatus
            });
        } catch (error: any) {
            console.error('Error in updateDelivery:', error.message);
            throw error;
        }
    }

    static async deleteDelivery(recordId: string, deliveryId: string): Promise<FileRecord> {
        try {
            const { data: record } = await supabase
                .from('file_records')
                .select('*')
                .eq('id', recordId)
                .single();

            if (!record) throw new Error('File record not found');

            const updatedDeliveries = (record.deliveries || []).filter(
                (delivery: DeliveryRecord) => delivery.id !== deliveryId
            );

            // Update status based on remaining deliveries
            let newStatus = 'received'; // Default back to received
            if (updatedDeliveries.length > 0) {
                const hasDelivered = updatedDeliveries.some((d: DeliveryRecord) => d.delivered_at);
                if (hasDelivered) newStatus = 'delivered';
            }

            return await this.updateFileRecord(recordId, {
                deliveries: updatedDeliveries,
                status: newStatus
            });
        } catch (error: any) {
            console.error('Error in deleteDelivery:', error.message);
            throw error;
        }
    }

    // Upsert method for file records
    static async upsertFileRecord(
        companyId: string,
        year: number,
        month: number,
        updates: any
    ): Promise<FileRecord> {
        try {
            // Handle reception updates
            if (updates.reception_record) {
                return await this.addReception(companyId, year, month, updates.reception_record);
            }

            // Handle delivery updates
            if (updates.delivery_record) {
                return await this.addDelivery(companyId, year, month, updates.delivery_record);
            }

            // Handle legacy updates (convert to new structure)
            if (updates.received_at || updates.brought_by) {
                const receptionData = {
                    received_at: updates.received_at,
                    received_by: updates.received_by || '',
                    brought_by: updates.brought_by || '',
                    delivery_method: updates.delivery_method || 'physical',
                    document_types: updates.document_types || [],
                    files_count: updates.files_count || 0,
                    reception_notes: updates.reception_notes || '',
                    is_urgent: updates.is_urgent || false
                };
                
                return await this.addReception(companyId, year, month, receptionData);
            }

            if (updates.delivered_at || updates.picked_by) {
                const deliveryData = {
                    delivered_at: updates.delivered_at,
                    delivered_to: updates.delivered_to || '',
                    picked_by: updates.picked_by || '',
                    delivery_location: updates.delivery_location || '',
                    delivery_notes: updates.delivery_notes || ''
                };
                
                return await this.addDelivery(companyId, year, month, deliveryData);
            }

            // Handle general updates
            const { data: existing } = await supabase
                .from('file_records')
                .select('*')
                .eq('company_id', companyId)
                .eq('year', year)
                .eq('month', month)
                .maybeSingle();

            if (existing) {
                return await this.updateFileRecord(existing.id, updates);
            } else {
                const company = await this.getCompanyById(companyId);
                return await this.createFileRecord({
                    company_id: companyId,
                    company_name: company.company_name,
                    year,
                    month,
                    receptions: [],
                    deliveries: [],
                    status: 'pending',
                    is_nil: false,
                    is_urgent: false,
                    processing_status: 'pending',
                    created_by: 'current_user',
                    updated_by: 'current_user',
                    ...updates
                });
            }
        } catch (error: any) {
            console.error('Error in upsertFileRecord:', error.message);
            throw error;
        }
    }

    // Statistics with updated logic
    static async getStats(year: number, month: number): Promise<FileManagementStats> {
        try {
            const [companies, records] = await Promise.all([
                this.getCompanies(),
                this.getFileRecords(year, month)
            ]);

            const received = records.filter(r => r.receptions && r.receptions.length > 0).length;
            const delivered = records.filter(r => r.deliveries && r.deliveries.length > 0).length;
            const nil = records.filter(r => r.is_nil).length;

            return {
                total_companies: companies.length,
                received_this_month: received,
                delivered_this_month: delivered,
                pending_receipt: companies.length - received,
                pending_delivery: received - delivered,
                nil_records: nil,
                overdue_count: 0,
                completion_rate: companies.length > 0 ? (received / companies.length) * 100 : 0,
                delivery_rate: received > 0 ? (delivered / received) * 100 : 0
            };
        } catch (error: any) {
            console.error('Error in getStats:', error.message);
            return {
                total_companies: 0,
                received_this_month: 0,
                delivered_this_month: 0,
                pending_receipt: 0,
                pending_delivery: 0,
                nil_records: 0,
                overdue_count: 0,
                completion_rate: 0,
                delivery_rate: 0
            };
        }
    }

    // Bulk operations updated for new structure
    static async performBulkOperation(operation: BulkOperation): Promise<void> {
        try {
            const { type, company_ids, data } = operation;

            switch (type) {
                case 'mark_received':
                    await Promise.all(
                        company_ids.map((id: string) =>
                            this.addReception(id, data.year, data.month, {
                                received_at: new Date().toISOString(),
                                received_by: data.received_by || 'Bulk Operation',
                                brought_by: 'Bulk Operation',
                                delivery_method: 'bulk',
                                document_types: ['bulk_received'],
                                files_count: 1,
                                reception_notes: 'Bulk marked as received',
                                is_urgent: false
                            })
                        )
                    );
                    break;

                case 'mark_delivered':
                    await Promise.all(
                        company_ids.map(async (id: string) => {
                            try {
                                await this.addDelivery(id, data.year, data.month, {
                                    delivered_at: new Date().toISOString(),
                                    delivered_to: data.delivered_to || 'Bulk Operation',
                                    picked_by: 'Bulk Operation',
                                    delivery_location: 'Office',
                                    delivery_notes: 'Bulk marked as delivered'
                                });
                            } catch (error) {
                                console.warn(`Could not mark ${id} as delivered:`, error);
                            }
                        })
                    );
                    break;

                case 'mark_nil':
                    await Promise.all(
                        company_ids.map((id: string) =>
                            this.addReception(id, data.year, data.month, {
                                received_at: null,
                                received_by: 'System',
                                brought_by: 'N/A',
                                delivery_method: 'nil',
                                document_types: [],
                                files_count: 0,
                                reception_notes: 'Bulk marked as NIL - No documents received',
                                is_urgent: false
                            })
                        )
                    );
                    break;

                case 'mark_nil':
                    await Promise.all(
                        company_ids.map((id: string) =>
                            this.addReception(id, data.year, data.month, {
                                received_at: null,
                                received_by: 'System',
                                brought_by: 'N/A',
                                delivery_method: 'nil',
                                document_types: [],
                                files_count: 0,
                                reception_notes: 'Bulk marked as NIL - No documents received',
                                is_urgent: false
                            })
                        )
                    );
                    break;

                default:
                    throw new Error(`Unknown bulk operation: ${type}`);
            }
        } catch (error: any) {
            console.error('Error in performBulkOperation:', error.message);
            throw error;
        }
    }

    // Export data
    static async exportData(filters: any): Promise<any[]> {
        try {
            const records = await this.getFileRecords();
            return records;
        } catch (error: any) {
            console.error('Error in exportData:', error.message);
            return [];
        }
    }

    // Helper function to get a file record by company, year, and month
    static async getFileRecord(companyId: string, year: number, month: number) {
        const { data, error } = await supabase
            .from('file_transactions')
            .select('*')
            .eq('company_id', companyId)
            .eq('year', year)
            .eq('month', month)
            .maybeSingle();

        if (error) {
            console.error('Error getting file record:', error.message);
            throw error;
        }

        return data;
    }

    // Helper function to upsert a file record
    static async upsertFileRecord(record: any) {
        const { data, error } = await supabase
            .from('file_transactions')
            .upsert(record, { onConflict: 'company_id,year,month' })
            .select()
            .single();

        if (error) {
            console.error('Error upserting file record:', error);
            throw error;
        }
        return data;
    }
}