import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { CompanyPayrollRecord, DocumentType } from '../types'
import { useToast } from '@/hooks/use-toast'

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

                const { data: companies, error: companiesError } = await supabase
                    .from('acc_portal_company_duplicate')
                    .select('id')

                if (companiesError) throw companiesError
                if (companies) {
                    const { error: recordsError } = await supabase
                        .from('company_payroll_records')
                        .insert(
                            companies.map(company => ({
                                company_id: company.id,
                                payroll_cycle_id: cycle!.id
                            }))
                        )

                    if (recordsError) throw recordsError
                }
            }

            await fetchPayrollRecords(cycle.id)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to initialize payroll cycle',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }, [selectedMonthYear, toast])

    // const fetchPayrollRecords = async (cycleId: string) => {
    //     try {
    //         // First get records with company details
    //         const { data: records, error: recordsError } = await supabase
    //             .from('company_payroll_records')
    //             .select(`
    //             *,
    //             company:acc_portal_company_duplicate(
    //                 id,
    //                 company_name,
    //                 kra_pin,
    //                 acc_client_effective_from,
    //                 acc_client_effective_to,
    //                 audit_tax_client_effective_from,
    //                 audit_tax_client_effective_to,
    //                 cps_sheria_client_effective_from,
    //                 cps_sheria_client_effective_to,
    //                 imm_client_effective_from,
    //                 imm_client_effective_to
    //             )
    //         `)
    //             .eq('payroll_cycle_id', cycleId)
    //             .ilike('company.company_name', `%${searchTerm}%`)

    //         if (recordsError) throw recordsError

    //         if (records) {
    //             // Filter out records without company data
    //             const validRecords = records.filter(record => record.company);

    //             // Get all company names for valid records
    //             const companyNames = validRecords.map(record => record.company.company_name);

    //             // Fetch all PinCheckerDetails in a single query
    //             const { data: pinData, error: pinError } = await supabase
    //                 .from('PinCheckerDetails')
    //                 .select('*')
    //                 .in('company_name', companyNames)

    //             if (pinError) throw pinError

    //             // Create a map of company_name to pin details for quick lookup
    //             const pinDetailsMap = (pinData || []).reduce((acc, detail) => {
    //                 acc[detail.company_name] = detail;
    //                 return acc;
    //             }, {} as Record<string, any>);

    //             // Combine records with their pin details
    //             const recordsWithPinDetails = records.map(record => ({
    //                 ...record,
    //                 pin_details: record.company
    //                     ? pinDetailsMap[record.company.company_name] || null
    //                     : null
    //             }));

    //             setPayrollRecords(recordsWithPinDetails)
    //         }
    //     } catch (error) {
    //         console.error('Fetch error:', error)
    //         toast({
    //             title: 'Error',
    //             description: 'Failed to fetch payroll records',
    //             variant: 'destructive'
    //         })
    //     }
    // }

    const fetchPayrollRecords = async (cycleId: string) => {
        try {
            setLoading(true);

            // Step 1: Fetch company payroll records
            const { data: recordsData, error: recordsError } = await supabase
                .from('company_payroll_records')
                .select('*')
                .eq('payroll_cycle_id', cycleId);

            if (recordsError) throw recordsError;
            if (!recordsData) throw new Error('No records found');

            // Step 2: Extract company IDs for fetching company details
            const companyIds = recordsData.map(record => record.company_id);

            // Step 3: Fetch company details
            const { data: companiesData, error: companiesError } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .in('id', companyIds)
                .ilike('company_name', `%${searchTerm}%`);

            if (companiesError) throw companiesError;

            // Create company lookup map for faster access
            const companyMap = (companiesData || []).reduce((map, company) => {
                map[company.id] = company;
                return map;
            }, {});

            // Step 4: Get all company names to fetch PIN details
            const companyNames = companiesData.map(company => company.company_name);

            // Step 5: Fetch PIN details for all companies
            const { data: pinData, error: pinError } = await supabase
                .from('PinCheckerDetails')
                .select('*')
                .in('company_name', companyNames);

            if (pinError) throw pinError;

            // Create PIN details lookup map
            const pinDetailsMap = (pinData || []).reduce((map, detail) => {
                map[detail.company_name] = detail;
                return map;
            }, {});

            // Step 6: Combine all data into complete records
            const completeRecords = recordsData.map(record => {
                const company = companyMap[record.company_id];

                // Skip records without company data
                if (!company) return null;

                // Find corresponding PIN details
                const pinDetails = pinDetailsMap[company.company_name] || null;

                // Construct complete record
                return {
                    ...record,
                    company,
                    pin_details: pinDetails,
                    // Include any additional derived properties here
                    number_of_employees: record.number_of_employees || 0
                };
            }).filter(Boolean); // Remove null entries

            setPayrollRecords(completeRecords);
        } catch (error) {
            console.error('Fetch error:', error);
            toast({
                title: 'Error',
                description: 'Failed to fetch payroll records',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };
    
    const handleDocumentUpload = async (
        recordId: string,
        file: File,
        documentType: DocumentType,
        subFolder: string
    ) => {
        try {
            const record = payrollRecords.find(r => r.id === recordId)
            if (!record) return

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
                .eq('id', recordId)
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
                .eq('id', recordId)

            if (updateError) throw updateError


            if (documentType === 'paye_csv') {
                const text = await file.text();
                const rows = text.split('\n');
                const employeeCount = rows.length; // Subtract 1 for header row

                // Update record with employee count
                const { error: updateError } = await supabase
                    .from('company_payroll_records')
                    .update({
                        number_of_employees: employeeCount
                    })
                    .eq('id', recordId)

                if (updateError) throw updateError
            }

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

            const { error } = await supabase
                .from('company_payroll_records')
                .update({
                    status: {
                        ...record.status,
                        ...statusUpdate
                    }
                })
                .eq('id', recordId)

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

    const updateExistingEmployeeCounts = async () => {
        try {
            // First get the current cycle ID
            const { data: cycle, error: cycleError } = await supabase
                .from('payroll_cycles')
                .select('id')
                .eq('month_year', selectedMonthYear)
                .single();

            if (cycleError) throw cycleError;
            if (!cycle) {
                toast({
                    title: 'No Cycle Found',
                    description: 'No payroll cycle exists for the selected month',
                    variant: 'destructive'
                });
                return;
            }

            // Get ALL records for current cycle
            const { data: records, error } = await supabase
                .from('company_payroll_records')
                .select('*')
                .eq('payroll_cycle_id', cycle.id);

            if (error) throw error;

            if (records && records.length > 0) {
                const updates = await Promise.all(records.map(async (record) => {
                    try {
                        // Check if PAYE CSV exists
                        if (!record.documents?.paye_csv) {
                            // No PAYE CSV, set to 0
                            await supabase
                                .from('company_payroll_records')
                                .update({ number_of_employees: 0 })
                                .eq('id', record.id);
                            return { recordId: record.id, employeeCount: 0, success: true };
                        }

                        const { data: fileData, error: downloadError } = await supabase.storage
                            .from('Payroll-Cycle')
                            .download(record.documents.paye_csv);

                        if (downloadError) {
                            // Failed to download, set to 0
                            await supabase
                                .from('company_payroll_records')
                                .update({ number_of_employees: 0 })
                                .eq('id', record.id);
                            return { recordId: record.id, employeeCount: 0, success: true };
                        }

                        // Determine file type
                        const filePath = record.documents.paye_csv;
                        const fileExt = filePath.split('.').pop().toLowerCase();

                        let employeeCount = 0;

                        if (fileExt === 'csv') {
                            // Handle CSV file - No header row, so count all rows
                            const text = await fileData.text();
                            const rows = text.split('\n').filter(row => row.trim());
                            employeeCount = rows.length; // Count all rows as they're all employee data
                        } else if (['xls', 'xlsx'].includes(fileExt)) {
                            // For Excel files, set to 1 as placeholder
                            employeeCount = 1;
                        } else {
                            // Unknown file type, set to 0
                            employeeCount = 0;
                        }

                        await supabase
                            .from('company_payroll_records')
                            .update({ number_of_employees: employeeCount })
                            .eq('id', record.id);

                        return {
                            recordId: record.id,
                            employeeCount,
                            success: true
                        };
                    } catch (error) {
                        // On any error, set to 0
                        await supabase
                            .from('company_payroll_records')
                            .update({ number_of_employees: 0 })
                            .eq('id', record.id);

                        return {
                            recordId: record.id,
                            employeeCount: 0,
                            success: true
                        };
                    }
                }));

                await fetchPayrollRecords(cycle.id);

                toast({
                    title: 'Update Complete',
                    description: `Updated employee counts for ${updates.length} records`,
                    variant: 'default'
                });
            } else {
                toast({
                    title: 'No Updates Needed',
                    description: 'No records found for the current cycle',
                    variant: 'default'
                });
            }
        } catch (error) {
            console.error('Error updating existing employee counts:', error);
            toast({
                title: 'Error',
                description: 'Failed to update employee counts',
                variant: 'destructive'
            });
        }
    };

    return {
        payrollRecords,
        setPayrollRecords,
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        searchTerm,
        setSearchTerm,
        loading,
        fetchOrCreatePayrollCycle,
        handleDocumentUpload,
        handleDocumentDelete,
        handleStatusUpdate,
        updateExistingEmployeeCounts
    }
}
