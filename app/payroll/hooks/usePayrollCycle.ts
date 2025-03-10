// @ts-nocheck
import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CompanyPayrollRecord, DocumentType } from '../types'
import { useToast } from '@/hooks/use-toast'

const DOCUMENT_LABELS: Record<DocumentType, string> = {
    paye_acknowledgment: 'PAYE Acknowledgment Receipt',
    paye_slip: 'PAYE Payment Slip',
    housing_levy_slip: 'Housing Levy Payment Slip',
    shif_slip: 'SHIF Payment Slip',
    nssf_slip: 'NSSF Payment Slip',
    nita_slip: 'NITA Payment Slip',
    all_csv: 'All CSV Files'
}

export const usePayrollCycle = () => {
    const [payrollRecords, setPayrollRecords] = useState<CompanyPayrollRecord[]>([])
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    const selectedMonthYear = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`

    const fetchOrCreatePayrollCycle = useCallback(async () => {
        setLoading(true)
        try {
            // Check if the cycle exists or create it if needed
            let { data: cycle } = await supabase
                .from('payroll_cycles')
                .select('*')
                .eq('month_year', selectedMonthYear)
                .single()

            if (!cycle) {
                const { data: newCycle, error: cycleError } = await supabase
                    .from('payroll_cycles')
                    .insert([{ month_year: selectedMonthYear }])
                    .select()
                    .single()

                if (cycleError) throw cycleError
                cycle = newCycle
            }

            // Fetch all companies regardless of whether they're in payroll_records
            const { data: companies, error: companiesError } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .ilike('company_name', `%${searchTerm}%`)

            if (companiesError) throw companiesError
            if (!companies) {
                setPayrollRecords([])
                setLoading(false)
                return
            }

            // Fetch existing payroll records for this cycle
            const { data: existingRecords, error: existingError } = await supabase
                .from('company_payroll_records')
                .select('*')
                .eq('payroll_cycle_id', cycle.id)

            if (existingError) throw existingError

            // Create a map of existing records for quick lookup
            const recordMap = new Map()
            existingRecords?.forEach(record => {
                recordMap.set(record.company_id, record)
            })

            // Get company names for PIN checker details
            const companyNames = companies.map(company => company.company_name)

            // Fetch PIN details for companies
            const { data: pinData, error: pinError } = await supabase
                .from('PinCheckerDetails')
                .select('*')
                .in('company_name', companyNames)

            if (pinError) throw pinError

            // Create a map of PIN details for quick lookup
            const pinDetailsMap = (pinData || []).reduce((acc, detail) => {
                acc[detail.company_name] = detail
                return acc
            }, {} as Record<string, any>)

            // Combine all data to create complete records for UI display
            const displayRecords = companies.map(company => {
                // Get existing record if any
                const existingRecord = recordMap.get(company.id)

                // Find corresponding PIN details
                const pinDetails = pinDetailsMap[company.company_name] || null

                // Create a record object - if company exists in payroll_records, use that data
                // otherwise create a temporary display-only record
                return {
                    // Use existing record ID if available, otherwise use temporary ID
                    id: existingRecord?.id || `temp_${company.id}`,
                    company_id: company.id,
                    payroll_cycle_id: cycle.id,
                    // Use existing data or set defaults
                    documents: existingRecord?.documents || {},
                    payment_slips_documents: existingRecord?.payment_slips_documents || {},
                    payment_receipts_documents: existingRecord?.payment_receipts_documents || {},
                    status: existingRecord?.status || {
                        finalization_date: null,
                        assigned_to: null,
                        filing: null
                    },
                    number_of_employees: existingRecord?.number_of_employees || 0,
                    // Include the full company object and pin details
                    company: company,
                    pin_details: pinDetails,
                    // Flag to know if this is a real record or just for display
                    is_temporary: !existingRecord
                }
            })

            setPayrollRecords(displayRecords)
        } catch (error) {
            console.error('Fetch error:', error)
            toast({
                title: 'Error',
                description: 'Failed to initialize payroll cycle',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }, [selectedMonthYear, searchTerm, toast])

    const fetchPayrollRecords = async (cycleId: string) => {
        try {
            setLoading(true)

            // Get all companies first (this shows all companies regardless of payroll records)
            const { data: companiesData, error: companiesError } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .ilike('company_name', `%${searchTerm}%`)

            if (companiesError) throw companiesError
            if (!companiesData) {
                setPayrollRecords([])
                setLoading(false)
                return
            }

            // Create company lookup map
            const companyMap = companiesData.reduce((map, company) => {
                map[company.id] = company
                return map
            }, {})

            // Fetch existing payroll records for this cycle
            const { data: recordsData, error: recordsError } = await supabase
                .from('company_payroll_records')
                .select('*')
                .eq('payroll_cycle_id', cycleId)

            if (recordsError) throw recordsError

            // Create a map of existing records by company ID
            const recordMap = new Map()
            recordsData?.forEach(record => {
                recordMap.set(record.company_id, record)
            })

            // Get all company names for PIN details
            const companyNames = companiesData.map(company => company.company_name)

            // Fetch PIN details
            const { data: pinData, error: pinError } = await supabase
                .from('PinCheckerDetails')
                .select('*')
                .in('company_name', companyNames)

            if (pinError) throw pinError

            // Create PIN details lookup map
            const pinDetailsMap = (pinData || []).reduce((map, detail) => {
                map[detail.company_name] = detail
                return map
            }, {})

            // Create complete records for display - for ALL companies
            const completeRecords = companiesData.map(company => {
                // Find existing record if any
                const record = recordMap.get(company.id)

                // Find PIN details
                const pinDetails = pinDetailsMap[company.company_name] || null

                // Create record object
                return {
                    id: record?.id || `temp_${company.id}`,
                    company_id: company.id,
                    payroll_cycle_id: cycleId,
                    // Use existing data or set defaults with proper structure
                    documents: record?.documents || {
                        paye_csv: null,
                        hslevy_csv: null,
                        zip_file_kra: null,
                        shif_exl: null,
                        nssf_exl: null,
                    },
                    payment_slips_documents: record?.payment_slips_documents || {},
                    payment_receipts_documents: record?.payment_receipts_documents || {},
                    status: record?.status || {
                        finalization_date: null,
                        assigned_to: null,
                        filing: null
                    },
                    number_of_employees: record?.number_of_employees || 0,
                    // Include the full company object and pin details
                    company: company,
                    pin_details: pinDetails,
                    // Flag to know if this is a real record or just for display
                    is_temporary: !record
                }
            })

            setPayrollRecords(completeRecords)
        } catch (error) {
            console.error('Fetch error:', error)
            toast({
                title: 'Error',
                description: 'Failed to fetch payroll records',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const handleDocumentUpload = async (
        recordId: string,
        file: File,
        documentType: DocumentType,
        subFolder: string
    ) => {
        try {
            // Find the record in our state
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) return

            // If this is a temporary record, we need to create a real record first
            let realRecordId = recordId

            if (record.is_temporary) {
                // Create a new record in the database
                const { data: newRecord, error: insertError } = await supabase
                    .from('company_payroll_records')
                    .insert([
                        {
                            company_id: record.company_id,
                            payroll_cycle_id: record.payroll_cycle_id,
                            documents: {},
                            payment_slips_documents: {},
                            payment_receipts_documents: {},
                            status: {
                                finalization_date: null,
                                assigned_to: null,
                                filing: null
                            },
                            number_of_employees: 0
                        }
                    ])
                    .select()
                    .single()

                if (insertError) throw insertError
                realRecordId = newRecord.id

                // Update our record with the real ID
                record.id = realRecordId
                record.is_temporary = false
            }

            const fileExtension = file.name.split('.').pop()
            const fileName = `${documentType} - ${record.company.company_name} - ${format(new Date(), 'yyyyMMdd')}.${fileExtension}`
            const filePath = `${selectedMonthYear}/${subFolder}/${record.company.company_name}/${fileName}`

            // First, try to delete existing file if it exists
            const existingPath = record.documents?.[documentType]
            if (existingPath) {
                try {
                    await supabase.storage
                        .from('Payroll-Cycle')
                        .remove([existingPath])
                } catch (error) {
                    console.error('Failed to delete existing file:', error)
                }
            }

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('Payroll-Cycle')
                .upload(filePath, file, {
                    cacheControl: '0',
                    upsert: true
                })

            if (uploadError) throw uploadError

            // Get current documents to ensure we have the latest state
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('documents')
                .eq('id', realRecordId)
                .single()

            if (fetchError) throw fetchError

            // Merge the new document path with existing documents
            const updatedDocuments = {
                ...(currentRecord?.documents || {}),
                [documentType]: uploadData.path
            }

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    documents: updatedDocuments
                })
                .eq('id', realRecordId)

            if (updateError) throw updateError

            // Update employee count if this is a PAYE CSV
            if (documentType === 'paye_csv') {
                const text = await file.text()
                const rows = text.split('\n')
                const employeeCount = rows.length // Subtract 1 for header row if needed

                // Update record with employee count
                const { error: updateError } = await supabase
                    .from('company_payroll_records')
                    .update({
                        number_of_employees: employeeCount
                    })
                    .eq('id', realRecordId)

                if (updateError) throw updateError
            }

            // Refresh the data
            await fetchPayrollRecords(record.payroll_cycle_id)

            toast({
                title: 'Success',
                description: 'Document uploaded successfully'
            })

            return uploadData.path
        } catch (error) {
            console.error('Upload error:', error)
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to upload document',
                variant: 'destructive'
            })
            throw error
        }
    }

    const handleDocumentDelete = async (recordId: string, documentType: DocumentType) => {
        try {
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) return

            // If this is a temporary record, we can't delete anything
            if (record.is_temporary) {
                toast({
                    title: 'Error',
                    description: 'Cannot delete document from an unfinalized record',
                    variant: 'destructive'
                })
                return
            }

            const documentPath = record.documents?.[documentType]
            if (!documentPath) return

            const { error: deleteError } = await supabase.storage
                .from('Payroll-Cycle')
                .remove([documentPath])

            if (deleteError) throw deleteError

            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    documents: {
                        ...(record.documents || {}),
                        [documentType]: null
                    }
                })
                .eq('id', recordId)

            if (updateError) throw updateError

            await fetchPayrollRecords(record.payroll_cycle_id)

            toast({
                title: 'Success',
                description: 'Document deleted successfully'
            })
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete document',
                variant: 'destructive'
            })
        }
    }

    const handleStatusUpdate = async (
        recordId: string,
        statusUpdate: Partial<CompanyPayrollRecord['status']>
    ) => {
        try {
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) return

            // If this is a temporary record, create a real record first
            let realRecordId = recordId

            if (record.is_temporary) {
                // Create a new record in the database
                const { data: newRecord, error: insertError } = await supabase
                    .from('company_payroll_records')
                    .insert([
                        {
                            company_id: record.company_id,
                            payroll_cycle_id: record.payroll_cycle_id,
                            documents: {},
                            status: {
                                finalization_date: null,
                                assigned_to: null,
                                filing: null
                            },
                            number_of_employees: 0
                        }
                    ])
                    .select()
                    .single()

                if (insertError) throw insertError
                realRecordId = newRecord.id

                // Update our record with the real ID
                record.id = realRecordId
                record.is_temporary = false
            }

            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    status: {
                        ...record.status,
                        ...statusUpdate
                    }
                })
                .eq('id', realRecordId)

            if (error) throw error

            await fetchPayrollRecords(record.payroll_cycle_id)

            toast({
                title: 'Success',
                description: 'Status updated successfully'
            })
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update status',
                variant: 'destructive'
            })
        }
    }

    const handlePaymentSlipsDocumentUpload = async (
        recordId: string,
        file: File,
        documentType: DocumentType,
        subFolder: string
    ) => {
        try {
            // Find the record in our state
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) {
                throw new Error('Record not found')
            }

            // If this is a temporary record, we need to create a real record first
            let realRecordId = recordId

            if (record.is_temporary) {
                // Create a new record in the database
                const { data: newRecord, error: insertError } = await supabase
                    .from('company_payroll_records')
                    .insert([
                        {
                            company_id: record.company_id,
                            payroll_cycle_id: record.payroll_cycle_id,
                            payment_slips_documents: {},
                            documents: {},
                            status: {
                                finalization_date: null,
                                assigned_to: null,
                                filing: null
                            },
                            number_of_employees: 0
                        }
                    ])
                    .select()
                    .single()

                if (insertError) throw insertError
                realRecordId = newRecord.id

                // Update our record with the real ID
                record.id = realRecordId
                record.is_temporary = false
            }

            // Ensure company information is available
            if (!record.company?.company_name) {
                throw new Error('Company information is missing')
            }

            // Get current record to ensure we have the latest state
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('payment_slips_documents')
                .eq('id', realRecordId)
                .single()

            if (fetchError) throw fetchError
            if (!currentRecord) throw new Error('Failed to fetch current record')

            // Ensure we're using the correct month-year format for the file path
            const fileExtension = file.name.substring(file.name.lastIndexOf('.'))
            const fileName = `${documentType} - ${record.company.company_name} - ${format(new Date(), 'yyyy-MM-dd')}${fileExtension}`
            
            // Create storage path using month-year format like payment slips
            const filePath = `${selectedMonthYear}/${subFolder}/${record.company.company_name}/${fileName}`

            // Upload file to storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('Payroll-Cycle')
                .upload(filePath, file, {
                    cacheControl: '0',
                    upsert: true
                })

            if (uploadError) throw uploadError

            // Initialize payment_slips_documents if it doesn't exist
            const currentDocuments = currentRecord.payment_slips_documents || {}

            // Update with the new document path
            const updatedDocuments = {
                ...currentDocuments,
                [documentType]: uploadData.path
            }

            // Update the database record
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_slips_documents: updatedDocuments
                })
                .eq('id', realRecordId)

            if (updateError) {
                // If database update fails, clean up the uploaded file
                await supabase.storage
                    .from('Payroll-Cycle')
                    .remove([uploadData.path])
                throw updateError
            }

            // Update local state
            const updatedRecords = payrollRecords.map(r => {
                if (r.id === realRecordId) {
                    return {
                        ...r,
                        payment_slips_documents: updatedDocuments
                    }
                }
                return r
            })

            setPayrollRecords(updatedRecords)

            toast({
                title: 'Success',
                description: 'Document uploaded successfully'
            })

            return uploadData.path
        } catch (error) {
            console.error('Payment slips document upload error:', error)
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to upload document',
                variant: 'destructive'
            })
            throw error
        }
    }

    const handlePaymentSlipsDocumentDelete = async (recordId: string, documentType: DocumentType) => {
        try {
            // Find the record in our state
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) {
                throw new Error('Record not found')
            }

            // If this is a temporary record, we can't delete anything
            if (record.is_temporary) {
                toast({
                    title: 'Error',
                    description: 'Cannot delete document from an unfinalized record',
                    variant: 'destructive'
                })
                return
            }

            // Check if payment_slips_documents exists and has the document
            if (!record.payment_slips_documents || !record.payment_slips_documents[documentType]) {
                toast({
                    title: 'Error',
                    description: 'Document not found',
                    variant: 'destructive'
                })
                return
            }

            const documentPath = record.payment_slips_documents[documentType]

            // Delete the file from storage
            const { error: deleteError } = await supabase.storage
                .from('Payroll-Cycle')
                .remove([documentPath])

            if (deleteError) throw deleteError

            // Get current record to ensure we have the latest state
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('payment_slips_documents')
                .eq('id', recordId)
                .single()

            if (fetchError) throw fetchError
            if (!currentRecord) throw new Error('Failed to fetch current record')

            // Create updated document object with the specific document set to null
            const updatedDocuments = {
                ...(currentRecord.payment_slips_documents || {}),
                [documentType]: null
            }

            // Update the database record
            const { error: updateError } = await supabase
                .from('company_payroll_records')
                .update({
                    payment_slips_documents: updatedDocuments
                })
                .eq('id', recordId)

            if (updateError) throw updateError

            // Update local state
            const updatedRecords = payrollRecords.map(r => {
                if (r.id === recordId) {
                    return {
                        ...r,
                        payment_slips_documents: updatedDocuments
                    }
                }
                return r
            })

            setPayrollRecords(updatedRecords)

            toast({
                title: 'Success',
                description: 'Document deleted successfully'
            })
        } catch (error) {
            console.error('Payment slips document delete error:', error)
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to delete document',
                variant: 'destructive'
            })
        }
    }

    const handlePaymentReceiptsDocumentUpload = async (
        recordId: string,
        file: File,
        documentType: DocumentType,
        subFolder: string
    ) => {
        try {
            console.log('Attempting to upload document for record ID:', recordId);
            console.log('Available record IDs in payrollRecords:', payrollRecords.map(r => r.id));
            
            // Find the record in our state
            const record = payrollRecords.find(r => r.id === recordId);
            if (!record) {
                console.error('Record not found in payrollRecords state. Record ID:', recordId);
                
                // Attempt to fetch the record directly from the database as a fallback
                // Include company information in the query
                const { data: fetchedRecord, error: fetchError } = await supabase
                    .from('company_payroll_records')
                    .select('*, company:company_id(*)')
                    .eq('id', recordId)
                    .single();
                
                if (fetchError || !fetchedRecord) {
                    console.error('Could not fetch record from database:', fetchError);
                    throw new Error('Record not found');
                }
                
                console.log('Record fetched directly from database:', fetchedRecord);
                
                // Add the fetched record to our state to prevent future lookups
                setPayrollRecords(prev => {
                    // Check if record already exists in state
                    if (prev.some(r => r.id === fetchedRecord.id)) {
                        return prev;
                    }
                    return [...prev, fetchedRecord];
                });
                
                // Continue with the fetched record
                return handlePaymentReceiptsDocumentUploadWithRecord(fetchedRecord, file, documentType, subFolder);
            }
            
            return handlePaymentReceiptsDocumentUploadWithRecord(record, file, documentType, subFolder);
        } catch (error) {
            console.error('Payment receipts document upload error:', error);
            toast({
                title: 'Upload Failed',
                description: error instanceof Error ? error.message : 'An unknown error occurred',
                variant: 'destructive'
            });
            throw error;
        }
    };
    
    // Helper function to handle the actual upload with a valid record
    const handlePaymentReceiptsDocumentUploadWithRecord = async (
        record: CompanyPayrollRecord,
        file: File,
        documentType: DocumentType,
        subFolder: string
    ) => {
        try {
            // If this is a temporary record, we need to create a real record first
            let realRecordId = record.id;

            if (record.is_temporary) {
                // Create a new record in the database
                const { data: newRecord, error: insertError } = await supabase
                    .from('company_payroll_records')
                    .insert([
                        {
                            company_id: record.company_id,
                            payroll_cycle_id: record.payroll_cycle_id,
                            payment_receipts_documents: {},
                            documents: {},
                            status: {
                                finalization_date: null,
                                assigned_to: null,
                                filing: null
                            },
                            number_of_employees: 0
                        }
                    ])
                    .select()
                    .single();

                if (insertError) throw insertError;
                realRecordId = newRecord.id;

                // Update our record with the real ID
                record.id = realRecordId;
                record.is_temporary = false;
            }

            // Ensure company information is available
            if (!record.company?.company_name) {
                console.error('Company information missing from record:', record);
                throw new Error('Company information is missing');
            }

            // Get current record to ensure we have the latest state
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('payment_receipts_documents, payroll_cycle_id')
                .eq('id', realRecordId)
                .single();

            if (fetchError) throw fetchError;
            if (!currentRecord) throw new Error('Failed to fetch current record');

            // Get the payroll cycle to ensure we're using the correct month-year
            const { data: payrollCycle, error: cycleError } = await supabase
                .from('payroll_cycles')
                .select('month_year')
                .eq('id', currentRecord.payroll_cycle_id)
                .single();

            if (cycleError) throw cycleError;
            if (!payrollCycle) throw new Error('Failed to fetch payroll cycle');

            // Use the month-year from the payroll cycle instead of the selected month-year
            const cycleMonthYear = payrollCycle.month_year;
            console.log('Using month-year from payroll cycle:', cycleMonthYear);

            // Ensure we're using the correct month-year format for the file path
            const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
            
            // Sanitize company name for file path to avoid special characters
            const sanitizedCompanyName = record.company.company_name.replace(/[^a-zA-Z0-9 ]/g, '');
            
            // Create a more concise filename to avoid path length issues
            const fileName = `${documentType}${fileExtension}`;
            
            // Create storage path using month-year format like payment slips
            // Use a shorter path structure to avoid database timeout issues
            const filePath = `${cycleMonthYear}/${subFolder}/${sanitizedCompanyName}/${fileName}`;

            console.log('Uploading file to path:', filePath);

            // Upload file to storage with timeout handling
            try {
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('Payroll-Cycle')
                    .upload(filePath, file, {
                        cacheControl: '0',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // Get the current payment_receipts_documents or create an empty object if it doesn't exist
                const currentDocuments = currentRecord.payment_receipts_documents || {};

                // Update the document path in the database
                const updatedDocuments = {
                    ...currentDocuments,
                    [documentType]: uploadData.path
                };

                const { error: updateError } = await supabase
                    .from('company_payroll_records')
                    .update({
                        payment_receipts_documents: updatedDocuments
                    })
                    .eq('id', realRecordId);

                if (updateError) {
                    // If database update fails, clean up the uploaded file
                    await supabase.storage
                        .from('Payroll-Cycle')
                        .remove([uploadData.path]);
                    throw updateError;
                }

                // Update our local state
                const updatedRecords = payrollRecords.map(r => {
                    if (r.id === realRecordId) {
                        return {
                            ...r,
                            payment_receipts_documents: updatedDocuments
                        };
                    }
                    return r;
                });

                setPayrollRecords(updatedRecords);

                toast({
                    title: 'Success',
                    description: 'Document uploaded successfully'
                });

                return uploadData.path;
            } catch (error) {
                // Check for timeout error and provide a more helpful message
                if (error.statusCode === '544' || error.code === 'DatabaseTimeout') {
                    console.error('Database timeout during upload. File path may be too long or database is under load.');
                    throw new Error('Upload timed out. Try using a smaller file or try again later.');
                }
                throw error;
            }
        } catch (error) {
            console.error('Payment receipts document upload error:', error);
            toast({
                title: 'Upload Failed',
                description: error instanceof Error ? error.message : 'An unknown error occurred',
                variant: 'destructive'
            });
            throw error;
        }
    };

    const handlePaymentReceiptsDocumentDelete = async (recordId: string, documentType: DocumentType) => {
        try {
            console.log('Attempting to delete document for record ID:', recordId);
            console.log('Available record IDs in payrollRecords:', payrollRecords.map(r => r.id));
            
            // Find the record in our state
            const record = payrollRecords.find(r => r.id === recordId);
            if (!record) {
                console.error('Record not found in payrollRecords state. Record ID:', recordId);
                
                // Attempt to fetch the record directly from the database as a fallback
                // Include company information in the query
                const { data: fetchedRecord, error: fetchError } = await supabase
                    .from('company_payroll_records')
                    .select('*, company:company_id(*)')
                    .eq('id', recordId)
                    .single();
                
                if (fetchError || !fetchedRecord) {
                    console.error('Could not fetch record from database:', fetchError);
                    throw new Error('Record not found');
                }
                
                console.log('Record fetched directly from database:', fetchedRecord);
                
                // Continue with the fetched record
                return handlePaymentReceiptsDocumentDeleteWithRecord(fetchedRecord, documentType);
            }
            
            return handlePaymentReceiptsDocumentDeleteWithRecord(record, documentType);
        } catch (error) {
            console.error('Payment receipts document delete error:', error);
            toast({
                title: 'Delete Failed',
                description: error instanceof Error ? error.message : 'An unknown error occurred',
                variant: 'destructive'
            });
            throw error;
        }
    };
    
    // Helper function to handle the actual delete with a valid record
    const handlePaymentReceiptsDocumentDeleteWithRecord = async (
        record: CompanyPayrollRecord,
        documentType: DocumentType
    ) => {
        try {
            // Get current record to ensure we have the latest state
            const { data: currentRecord, error: fetchError } = await supabase
                .from('company_payroll_records')
                .select('payment_receipts_documents, payroll_cycle_id')
                .eq('id', record.id)
                .single();

            if (fetchError) throw fetchError;
            if (!currentRecord) throw new Error('Failed to fetch current record');
            
            // Check if document exists
            const currentDocuments = currentRecord.payment_receipts_documents || {};
            const documentPath = currentDocuments[documentType];
            
            if (!documentPath) {
                throw new Error('Document does not exist');
            }
            
            console.log('Deleting document from path:', documentPath);
            
            try {
                // Delete file from storage
                const { error: deleteError } = await supabase.storage
                    .from('Payroll-Cycle')
                    .remove([documentPath]);
                
                if (deleteError) throw deleteError;
                
                // Update database record
                const updatedDocuments = { ...currentDocuments };
                delete updatedDocuments[documentType];
                
                const { error: updateError } = await supabase
                    .from('company_payroll_records')
                    .update({
                        payment_receipts_documents: updatedDocuments
                    })
                    .eq('id', record.id);
                
                if (updateError) throw updateError;
                
                // Update local state
                const updatedRecords = payrollRecords.map(r => {
                    if (r.id === record.id) {
                        return {
                            ...r,
                            payment_receipts_documents: updatedDocuments
                        };
                    }
                    return r;
                });
                
                setPayrollRecords(updatedRecords);
                
                toast({
                    title: 'Success',
                    description: 'Document deleted successfully'
                });
            } catch (error) {
                // Check for timeout error and provide a more helpful message
                if (error.statusCode === '544' || error.code === 'DatabaseTimeout') {
                    console.error('Database timeout during delete operation.');
                    throw new Error('Delete operation timed out. Please try again later.');
                }
                throw error;
            }
        } catch (error) {
            console.error('Payment receipts document delete error:', error);
            toast({
                title: 'Delete Failed',
                description: error instanceof Error ? error.message : 'An unknown error occurred',
                variant: 'destructive'
            });
            throw error;
        }
    };

    const handleBulkExport = async (records: CompanyPayrollRecord[]) => {
        try {
            // Create CSV content
            let csvContent = "Company Name,PIN,Document Type,Document URL\n";
            
            for (const record of records) {
                if (!record.payment_slips_documents) continue;
                
                const companyName = record.company?.company_name || 'Unknown';
                const pin = record.pin_details?.pin || 'Unknown';
                
                for (const [docType, path] of Object.entries(record.payment_slips_documents)) {
                    if (!path) continue;
                    
                    // Get public URL for the document
                    const { data: publicUrl } = await supabase.storage
                        .from('Payroll-Cycle')
                        .getPublicUrl(path);
                    
                    if (publicUrl) {
                        const documentTypeLabel = DOCUMENT_LABELS[docType as DocumentType] || docType;
                        csvContent += `"${companyName}","${pin}","${documentTypeLabel}","${publicUrl.publicUrl}"\n`;
                    }
                }
            }
            
            // Create and download the CSV file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `payment_slips_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast({
                title: 'Export Successful',
                description: 'Document links have been exported to CSV'
            });
        } catch (error) {
            console.error('Export error:', error);
            toast({
                title: 'Export Failed',
                description: 'Failed to export document links',
                variant: 'destructive'
            });
        }
    };

    const updateExistingEmployeeCounts = async () => {
        try {
            // First get the current cycle ID
            const { data: cycle, error: cycleError } = await supabase
                .from('payroll_cycles')
                .select('id')
                .eq('month_year', selectedMonthYear)
                .single()

            if (cycleError) throw cycleError
            if (!cycle) {
                toast({
                    title: 'No Cycle Found',
                    description: 'No payroll cycle exists for the selected month',
                    variant: 'destructive'
                })
                return
            }

            // Get ONLY existing records for current cycle
            const { data: records, error } = await supabase
                .from('company_payroll_records')
                .select('*')
                .eq('payroll_cycle_id', cycle.id)

            if (error) throw error

            if (records && records.length > 0) {
                const updates = await Promise.all(records.map(async (record) => {
                    try {
                        // Check if PAYE CSV exists
                        if (!record.documents?.paye_csv) {
                            // No PAYE CSV, set to 0
                            await supabase
                                .from('company_payroll_records')
                                .update({ number_of_employees: 0 })
                                .eq('id', record.id)
                            return { recordId: record.id, employeeCount: 0, success: true }
                        }

                        const { data: fileData, error: downloadError } = await supabase.storage
                            .from('Payroll-Cycle')
                            .download(record.documents.paye_csv)

                        if (downloadError) {
                            // Failed to download, set to 0
                            await supabase
                                .from('company_payroll_records')
                                .update({ number_of_employees: 0 })
                                .eq('id', record.id)
                            return { recordId: record.id, employeeCount: 0, success: true }
                        }

                        // Determine file type
                        const filePath = record.documents.paye_csv
                        const fileExt = filePath.split('.').pop().toLowerCase()

                        let employeeCount = 0

                        if (fileExt === 'csv') {
                            // Handle CSV file - No header row, so count all rows
                            const text = await fileData.text()
                            const rows = text.split('\n')
                            employeeCount = rows.length // Count all rows as they're all employee data
                        } else if (['xls', 'xlsx'].includes(fileExt)) {
                            // For Excel files, set to 1 as placeholder
                            employeeCount = 1
                        } else {
                            // Unknown file type, set to 0
                            employeeCount = 0
                        }

                        await supabase
                            .from('company_payroll_records')
                            .update({ number_of_employees: employeeCount })
                            .eq('id', record.id)

                        return {
                            recordId: record.id,
                            employeeCount,
                            success: true
                        }
                    } catch (error) {
                        // On any error, set to 0
                        await supabase
                            .from('company_payroll_records')
                            .update({ number_of_employees: 0 })
                            .eq('id', record.id)

                        return {
                            recordId: record.id,
                            employeeCount: 0,
                            success: true
                        }
                    }
                }))

                await fetchPayrollRecords(cycle.id)

                toast({
                    title: 'Update Complete',
                    description: `Updated employee counts for ${updates.length} records`,
                    variant: 'default'
                })
            } else {
                toast({
                    title: 'No Updates Needed',
                    description: 'No records found for the current cycle',
                    variant: 'default'
                })
            }
        } catch (error) {
            console.error('Error updating existing employee counts:', error)
            toast({
                title: 'Error',
                description: 'Failed to update employee counts',
                variant: 'destructive'
            })
        }
    }

    return {
        payrollRecords,
        setPayrollRecords,
        loading,
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        searchTerm,
        setSearchTerm,
        fetchOrCreatePayrollCycle,
        handleDocumentUpload,
        handleDocumentDelete,
        handleStatusUpdate,
        handlePaymentSlipsDocumentUpload,
        handlePaymentSlipsDocumentDelete,
        handlePaymentReceiptsDocumentUpload,
        handlePaymentReceiptsDocumentDelete,
        handleBulkExport,
        updateExistingEmployeeCounts
    }
}