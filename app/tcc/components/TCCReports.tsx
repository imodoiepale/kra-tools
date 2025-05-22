// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpDown, Search, Eye, EyeOff, ImageIcon, MoreHorizontal, Download, ChevronLeftIcon, ChevronRightIcon, Filter, FileIcon, RefreshCw, PlayCircle, Play } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from '@supabase/supabase-js';
import * as ExcelJS from 'exceljs';
import { Badge } from '@/components/ui/badge';
import ClientCategoryFilter from '@/components/ClientCategoryFilter-updated-ui';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function TCCReports() {
    const [reports, setReports] = useState([]);
    const [allCompanyData, setAllCompanyData] = useState([]);
    const [filteredReports, setFilteredReports] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [detailedViewSearchTerm, setDetailedViewSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [selectedRows, setSelectedRows] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('idle'); // 'idle', 'processing', 'complete', 'error'
    const [visibleColumns, setVisibleColumns] = useState({
        company_name: true,
        company_pin: true,
        status: true,
        expiry_date: true,
        days_to_go: true,
        doc_status: true,
        extraction_date: true,
    });
    const [activeTab, setActiveTab] = useState("summary");
    const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(30); // in seconds
    const [categoryFilters, setCategoryFilters] = useState({
        categories: {
            'All Categories': false,
            'Acc': true,
            'Imm': false,
            'Sheria': false,
            'Audit': false
        },
        categorySettings: {
            'Acc': {
                clientStatus: {
                    All: false,
                    Active: true,
                    Inactive: false
                },
                sectionStatus: {
                    All: false,
                    Active: true,
                    Inactive: false,
                    Missing: false
                }
            }
        }
    });
    const [showStatsRows, setShowStatsRows] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const calculateClientStatus = (fromDate, toDate) => {
        if (!fromDate || !toDate) return 'inactive';

        const today = new Date();
        const from = new Date(fromDate.split('/').reverse().join('-'));
        const to = new Date(toDate.split('/').reverse().join('-'));

        return today >= from && today <= to ? 'active' : 'inactive';
    };

    const fetchReports = async () => {
        try {
            // First get all companies from acc_portal_company_duplicate
            const { data: companiesData, error: companiesError } = await supabase
                .from('acc_portal_company_duplicate')
                .select('*')
                .order('company_name', { ascending: true });

            if (companiesError) {
                throw new Error(`Error fetching companies: ${companiesError.message}`);
            }

            // Then get all TCC data
            const { data: tccData, error: tccError } = await supabase
                .from('TaxComplianceCertificates')
                .select('*');

            if (tccError) {
                throw new Error(`Error fetching TCC data: ${tccError.message}`);
            }

            // Define the TCC document ID (UUID format with hyphens)
            const tccDocumentId = '5c658f23-7d16-4453-9965-619b72b9166a';

            // Fetch TCC documents from acc_portal_kyc_uploads table
            const { data: kycUploadsData, error: kycUploadsError } = await supabase
                .from('acc_portal_kyc_uploads')
                .select('*')
                .eq('kyc_document_id', tccDocumentId);

            if (kycUploadsError) {
                console.error('Error fetching KYC uploads:', kycUploadsError);
                // Don't throw - we can still show certificates from the TaxComplianceCertificates table
            }

            console.log('KYC uploads data for TCC:', kycUploadsData);

            // Group KYC uploads by userid (company ID) and take the latest upload for each company
            const kycUploadsMap = new Map();
            if (kycUploadsData && kycUploadsData.length > 0) {
                kycUploadsData.forEach(upload => {
                    // Convert userid to number to match company.id
                    const companyId = parseInt(upload.userid);
                    if (!isNaN(companyId)) {
                        const existingUpload = kycUploadsMap.get(companyId);
                        // Keep only the latest upload based on created_at
                        if (!existingUpload || new Date(upload.created_at) > new Date(existingUpload.created_at)) {
                            kycUploadsMap.set(companyId, upload);
                        }
                    }
                });
            }

            // Create a map of company_id to TCC data
            const tccMap = new Map(tccData.map(tcc => [tcc.company_id, tcc]));

            // Process and map the data
            const calculateDaysRemaining = (expiryDateStr) => {
                if (!expiryDateStr || typeof expiryDateStr !== 'string' || expiryDateStr === 'N/A') {
                    return { days: null, status: 'Unknown', statusColor: 'text-gray-500' };
                }

                try {
                    const today = new Date();
                    // Set time to beginning of day for accurate day calculation
                    today.setHours(0, 0, 0, 0);

                    // Check for DD/MM/YYYY format
                    let expiryDate;
                    if (expiryDateStr.includes('/')) {
                        // Convert from DD/MM/YYYY to YYYY-MM-DD
                        const parts = expiryDateStr.split('/');
                        if (parts.length === 3) {
                            expiryDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        } else {
                            expiryDate = new Date(expiryDateStr);
                        }
                    } else {
                        expiryDate = new Date(expiryDateStr);
                    }

                    // Check if we got a valid date
                    if (isNaN(expiryDate.getTime())) {
                        console.error('Invalid date format:', expiryDateStr);
                        return { days: null, status: 'Unknown', statusColor: 'text-gray-500' };
                    }

                    expiryDate.setHours(0, 0, 0, 0);

                    // Calculate difference in milliseconds
                    const diffTime = expiryDate.getTime() - today.getTime();
                    // Convert to days
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    let status, statusColor;
                    if (diffDays < 0) {
                        status = 'Expired';
                        statusColor = 'text-red-500';
                    } else if (diffDays <= 30) {
                        status = 'Grace';
                        statusColor = 'text-blue-500';
                    } else {
                        status = 'Safe';
                        statusColor = 'text-green-500';
                    }

                    return { days: diffDays, status, statusColor };
                } catch (error) {
                    console.error('Error calculating days remaining:', error);
                    return { days: null, status: 'Unknown', statusColor: 'text-gray-500' };
                }
            };

            const processedData = companiesData.map(company => {
                const tccRecord = tccMap.get(company.id);

                // Get KYC upload document for this company (if any)
                const kycUpload = kycUploadsMap.get(company.id);

                // Generate public URL for KYC document if it exists
                let documentUrl = null;
                if (kycUpload && kycUpload.file_path) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('kyc-documents')
                        .getPublicUrl(kycUpload.file_path);
                    documentUrl = publicUrl;
                }

                // Calculate client statuses
                const acc_client_status = calculateClientStatus(company.acc_client_effective_from, company.acc_client_effective_to);
                const imm_client_status = calculateClientStatus(company.imm_client_effective_from, company.imm_client_effective_to);
                const sheria_client_status = calculateClientStatus(company.sheria_client_effective_from, company.sheria_client_effective_to);
                const audit_client_status = calculateClientStatus(company.audit_client_effective_from, company.audit_client_effective_to);

                // Determine which categories this company belongs to
                const categories = [];
                if (company.acc_client_effective_from && company.acc_client_effective_to) categories.push('Acc');
                if (company.imm_client_effective_from && company.imm_client_effective_to) categories.push('Imm');
                if (company.sheria_client_effective_from && company.sheria_client_effective_to) categories.push('Sheria');
                if (company.audit_client_effective_from && company.audit_client_effective_to) categories.push('Audit');

                // Always calculate days remaining for reporting consistency
                let daysRemaining = calculateDaysRemaining(null);

                if (!tccRecord) {
                    return {
                        id: company.id,
                        company_name: company.company_name,
                        company_pin: company.kra_pin || <span className="text-red-500">Missing</span>,
                        status: 'No TCC Data',
                        certificate_date: <span className="text-red-500">Missing</span>,
                        expiry_date: <span className="text-red-500">Missing</span>,
                        serial_no: <span className="text-red-500">Missing</span>,
                        // Use the document from KYC uploads if available (prioritize newer system)
                        pdf_link: documentUrl,
                        screenshot_link: null,
                        full_table_data: [],
                        extraction_date: kycUpload ? new Date(kycUpload.updated_at || kycUpload.created_at).toLocaleDateString() : <span className="text-red-500">Missing</span>,
                        client_category: company.client_category || '',
                        days_to_go: daysRemaining.days,
                        expiry_status: daysRemaining.status,
                        expiry_status_color: daysRemaining.statusColor,
                        doc_status: daysRemaining.status,
                        // Add client status fields and categories
                        acc_client_status,
                        imm_client_status,
                        sheria_client_status,
                        audit_client_status,
                        categories,
                        // Keep effective date fields for reference
                        acc_client_effective_from: company.acc_client_effective_from,
                        acc_client_effective_to: company.acc_client_effective_to,
                        imm_client_effective_from: company.imm_client_effective_from,
                        imm_client_effective_to: company.imm_client_effective_to,
                        sheria_client_effective_from: company.sheria_client_effective_from,
                        sheria_client_effective_to: company.sheria_client_effective_to,
                        audit_client_effective_from: company.audit_client_effective_from,
                        audit_client_effective_to: company.audit_client_effective_to,
                    };
                }

                const extractions = tccRecord.extractions || {};
                const latestDate = Object.keys(extractions).sort((a, b) =>
                    new Date(b) - new Date(a)
                )[0];
                const latestExtraction = extractions[latestDate] || {};

                // Calculate days remaining until expiry
                daysRemaining = calculateDaysRemaining(latestExtraction.expiry_date);

                // Determine which documents to use - prioritize KYC uploads documents over TaxComplianceCertificates documents
                const pdfLink = documentUrl || (
                    latestExtraction.pdf_link && latestExtraction.pdf_link !== "no doc"
                        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kra-documents/${latestExtraction.pdf_link}`
                        : null
                );

                // Use the extraction date from KYC uploads if available, otherwise use the date from TaxComplianceCertificates
                let extractionDate;
                if (kycUpload) {
                    // Always use updated_at if available, as it reflects the latest extraction time
                    // Fall back to created_at if updated_at is not available
                    extractionDate = kycUpload.updated_at || kycUpload.created_at;
                } else if (latestDate) {
                    // latestDate is the key from extractions object - make sure it's a valid date format
                    // If it's already a valid ISO date string, use it as is
                    try {
                        const testDate = new Date(latestDate);
                        if (!isNaN(testDate.getTime())) {
                            extractionDate = latestDate;
                        } else {
                            // If it's not a valid date format, store as a string but mark it
                            extractionDate = ` ${latestDate}`;
                        }
                    } catch (e) {
                        // Handle any parsing errors
                        extractionDate = `${latestDate}`;
                    }
                } else {
                    extractionDate = null; // Will be displayed as "Not extracted"
                }

                return {
                    id: company.id,
                    company_name: company.company_name,
                    company_pin: company.kra_pin || <span className="text-red-500">Missing</span>,
                    status: latestExtraction.status || <span className="text-red-500">Missing</span>,
                    certificate_date: latestExtraction.certificate_date || <span className="text-red-500">Missing</span>,
                    expiry_date: latestExtraction.expiry_date || <span className="text-red-500">Missing</span>,
                    serial_no: latestExtraction.serial_no || <span className="text-red-500">Missing</span>,
                    pdf_link: pdfLink,
                    screenshot_link: latestExtraction.screenshot_link && latestExtraction.screenshot_link !== "no doc"
                        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kra-documents/${latestExtraction.screenshot_link}`
                        : null,
                    full_table_data: latestExtraction.full_table_data || [],
                    extraction_date: extractionDate,
                    client_category: company.client_category || '',
                    days_to_go: daysRemaining.days,
                    expiry_status: daysRemaining.status,
                    expiry_status_color: daysRemaining.statusColor,
                    doc_status: daysRemaining.status,
                    // Add client status fields and categories
                    acc_client_status,
                    imm_client_status,
                    sheria_client_status,
                    audit_client_status,
                    categories,
                    // Keep effective date fields for reference
                    acc_client_effective_from: company.acc_client_effective_from,
                    acc_client_effective_to: company.acc_client_effective_to,
                    imm_client_effective_from: company.imm_client_effective_from,
                    imm_client_effective_to: company.imm_client_effective_to,
                    sheria_client_effective_from: company.sheria_client_effective_from,
                    sheria_client_effective_to: company.sheria_client_effective_to,
                    audit_client_effective_from: company.audit_client_effective_from,
                    audit_client_effective_to: company.audit_client_effective_to,
                };
            });

            setAllCompanyData(processedData);
            setReports(processedData);
            applyFilters(processedData);

            if (processedData.length > 0) {
                setSelectedCompany(processedData[0]);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    // Add a function to filter the data based on category filters
    const applyFiltersToData = (data) => {
        if (!categoryFilters.categories || Object.keys(categoryFilters.categories).length === 0) {
            return data;
        }

        return data.filter(company => {
            // Check if "All Categories" is selected
            if (categoryFilters.categories['All Categories']) {
                return true;
            }

            // Get all selected categories
            const selectedCategories = Object.entries(categoryFilters.categories)
                .filter(([category, isSelected]) => category !== 'All Categories' && isSelected)
                .map(([category]) => category);

            // If no categories selected, show all companies
            if (selectedCategories.length === 0) {
                return true;
            }

            // Check if company belongs to ALL of the selected categories
            // and matches the status criteria for each selected category
            return selectedCategories.every(category => {
                // Check if company belongs to this category
                if (!company.categories.includes(category)) {
                    return false;
                }

                // Get the status settings for this category
                const categorySettings = categoryFilters.categorySettings?.[category];
                if (!categorySettings) {
                    return true;
                }

                // Get the client status for this category
                const clientStatus = company[`${category.toLowerCase()}_client_status`];

                // Get selected client statuses
                const selectedClientStatuses = Object.entries(categorySettings.clientStatus || {})
                    .filter(([_, isSelected]) => isSelected)
                    .map(([status]) => status.toLowerCase());

                // If "All" is selected or no specific status is selected, include all
                if (selectedClientStatuses.includes('all') || selectedClientStatuses.length === 0) {
                    return true;
                }

                // Check if company's status matches any selected status
                return selectedClientStatuses.includes(clientStatus);
            });
        });
    };

    // Apply both category and search filters
    const applyFilters = (data = allCompanyData) => {
        // First apply category filters
        let filteredData = applyFiltersToData(data);

        // Then apply search filter
        if (searchTerm) {
            filteredData = filteredData.filter(report => {
                const searchValue = searchTerm.toLowerCase();
                // Generic search across all fields
                const searchableFields = [
                    report.company_name,
                    typeof report.company_pin === 'string' ? report.company_pin : '',
                    typeof report.status === 'string' ? report.status : '',
                    typeof report.expiry_date === 'string' ? report.expiry_date : '',
                    typeof report.extraction_date === 'string' ? report.extraction_date : '',
                    typeof report.serial_no === 'string' ? report.serial_no : '',
                    typeof report.certificate_date === 'string' ? report.certificate_date : ''
                ];

                return searchableFields.some(field =>
                    field.toLowerCase().includes(searchValue)
                );
            });
        }

        setFilteredReports(filteredData);

        // If current selected company is filtered out, select the first one in the filtered list
        if (selectedCompany && !filteredData.some(report => report.id === selectedCompany.id)) {
            setSelectedCompany(filteredData.length > 0 ? filteredData[0] : null);
        }
    };

    // Apply filter to detailed view sidebar
    const getFilteredDetailedViewCompanies = () => {
        // First apply category filters - using the same logic as the main view
        let detailedFiltered = applyFiltersToData(reports);

        // Then apply search term filter
        if (detailedViewSearchTerm) {
            const searchValue = detailedViewSearchTerm.toLowerCase();
            detailedFiltered = detailedFiltered.filter(report =>
                report.company_name.toLowerCase().includes(searchValue)
            );
        }

        return detailedFiltered;
    };

    const handleApplyFilters = (newFilters) => {
        setCategoryFilters(newFilters);
        applyFilters();
    };

    // Update filters whenever search term or category filters change
    useEffect(() => {
        applyFilters();
    }, [searchTerm, categoryFilters]);

    // Auto-refresh functionality
    useEffect(() => {
        // Set up auto-refresh timer if enabled
        if (autoRefreshEnabled && !isProcessing) {
            const timer = setTimeout(() => {
                console.log(`Auto-refreshing data (${refreshInterval}s interval)`);
                fetchReports();
            }, refreshInterval * 1000);
            
            // Clean up timer on component unmount or when dependencies change
            return () => clearTimeout(timer);
        }
    }, [autoRefreshEnabled, refreshInterval, reports, isProcessing]);

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortOrder('asc');
        }
    };

    const sortedReports = [...filteredReports].sort((a, b) => {
        if (!sortColumn) return 0;

        const aValue = typeof a[sortColumn] === 'object' ? '' : a[sortColumn];
        const bValue = typeof b[sortColumn] === 'object' ? '' : b[sortColumn];

        if (!aValue && !bValue) return 0;
        if (!aValue) return 1;
        if (!bValue) return -1;

        // Handle days_to_go as numbers
        if (sortColumn === 'days_to_go') {
            const numA = Number(aValue);
            const numB = Number(bValue);

            if (!isNaN(numA) && !isNaN(numB)) {
                return sortOrder === 'asc' ? numA - numB : numB - numA;
            }
        }

        // Handle dates
        if (sortColumn === 'extraction_date' || sortColumn === 'expiry_date') {
            const dateA = new Date(aValue);
            const dateB = new Date(bValue);

            if (!isNaN(dateA) && !isNaN(dateB)) {
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            }
        }

        // Default string comparison for other fields
        return sortOrder === 'asc'
            ? String(aValue).localeCompare(String(bValue))
            : String(bValue).localeCompare(String(aValue));
    });

    // Calculate statistics for complete and missing entries
    const calculateStats = () => {
        const stats = {
            complete: {},
            missing: {}
        };

        // Define fields to check for completeness
        const fieldsToCheck = [
            'company_name',
            'company_pin',
            'status',
            'expiry_date',
            'days_to_go',
            'doc_status',
            'extraction_date',
            'pdf_link',
            'screenshot_link'
        ];

        // Initialize stats for each field
        fieldsToCheck.forEach(field => {
            stats.complete[field] = 0;
            stats.missing[field] = 0;
        });

        // Calculate stats for each field individually
        filteredReports.forEach(report => {
            fieldsToCheck.forEach(field => {
                if (field === 'days_to_go') {
                    // Special handling for days_to_go as it can be null but valid
                    if (report[field] !== null) {
                        stats.complete[field]++;
                    } else {
                        stats.missing[field]++;
                    }
                } else if (report[field] &&
                    (typeof report[field] !== 'object' ||
                        (typeof report[field] === 'object' && report[field].props && report[field].props.children !== 'Missing'))) {
                    stats.complete[field]++;
                } else {
                    stats.missing[field]++;
                }
            });
        });

        return stats;
    };

    const stats = calculateStats();

    // Function to run TCC extraction for selected companies
    const handleRunSelected = async () => {
        if (selectedRows.length === 0) return;

        setIsProcessing(true);
        setProcessingStatus('processing');

        try {
            // Call the TCC extractor API
            const response = await fetch('/api/tcc-extractor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'start',
                    companies: selectedRows
                }),
            });

            if (!response.ok) {
                throw new Error(`Error starting TCC extraction: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('TCC extraction started:', data);
            setProcessingStatus('complete');

            // Poll for progress updates
            const pollInterval = setInterval(async () => {
                const progressResponse = await fetch('/api/tcc-extractor', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'progress' }),
                });

                if (progressResponse.ok) {
                    const progressData = await progressResponse.json();
                    console.log('Progress:', progressData);

                    if (!progressData.isRunning) {
                        clearInterval(pollInterval);
                        setIsProcessing(false);
                        fetchReports(); // Refresh data once complete
                    }
                }
            }, 5000); // Poll every 5 seconds

        } catch (error) {
            console.error('Error running TCC extraction:', error);
            setProcessingStatus('error');
            setIsProcessing(false);
        }
    };

    // Function to run TCC extraction for companies missing certificates
    const handleRunMissing = async () => {
        setIsProcessing(true);
        setProcessingStatus('processing');

        try {
            // Get IDs of companies missing TCC certificates
            const missingCertCompanies = filteredReports
                .filter(report => !report.pdf_link || report.pdf_link === "no doc")
                .map(report => report.id);

            if (missingCertCompanies.length === 0) {
                setIsProcessing(false);
                setProcessingStatus('idle');
                return;
            }

            // Call the TCC extractor API
            const response = await fetch('/api/tcc-extractor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'start',
                    companies: missingCertCompanies
                }),
            });

            if (!response.ok) {
                throw new Error(`Error starting TCC extraction: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('TCC extraction started for missing certificates:', data);
            setProcessingStatus('complete');

            // Poll for progress updates
            const pollInterval = setInterval(async () => {
                const progressResponse = await fetch('/api/tcc-extractor', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'progress' }),
                });

                if (progressResponse.ok) {
                    const progressData = await progressResponse.json();
                    console.log('Progress:', progressData);

                    if (!progressData.isRunning) {
                        clearInterval(pollInterval);
                        setIsProcessing(false);
                        fetchReports(); // Refresh data once complete
                    }
                }
            }, 5000); // Poll every 5 seconds

        } catch (error) {
            console.error('Error running TCC extraction for missing certificates:', error);
            setProcessingStatus('error');
            setIsProcessing(false);
        }
    };

    // Function to run TCC extraction for a single company
    const handleRunSingle = async (companyId) => {
        try {
            // Call the TCC extractor API for a single company
            const response = await fetch('/api/tcc-extractor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'start',
                    companies: [companyId]
                }),
            });

            if (!response.ok) {
                throw new Error(`Error starting TCC extraction: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`TCC extraction started for company ${companyId}:`, data);

            // Poll for progress once
            setTimeout(async () => {
                const progressResponse = await fetch('/api/tcc-extractor', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'progress' }),
                });

                if (progressResponse.ok) {
                    fetchReports(); // Refresh data
                }
            }, 5000);

        } catch (error) {
            console.error(`Error running TCC extraction for company ${companyId}:`, error);
        }
    };

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('TCC Reports');

        // Add headers
        const headers = ['Index', 'Company Name', 'KRA PIN', 'Status', 'Expiry Date', 'Last Extracted', 'TCC Cert', 'Screenshot'];
        const headerRow = worksheet.addRow(headers);

        // Style the header row
        headerRow.eachCell((cell, colNumber) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' }  // Yellow background
            };
            cell.font = { bold: true };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Add data
        filteredReports.forEach((report, index) => {
            const row = worksheet.addRow([
                index + 1,
                report.company_name,
                typeof report.company_pin === 'string' ? report.company_pin : 'Missing',
                typeof report.status === 'string' ? report.status : 'Missing',
                typeof report.expiry_date === 'string' ? report.expiry_date : 'Missing',
                typeof report.extraction_date === 'string' ? report.extraction_date : 'Missing',
                report.pdf_link ? 'Available' : 'Missing',
                report.screenshot_link ? 'Available' : 'Missing'
            ]);

            // Center the index
            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

            // Color coding for dates and 'N/A'
            const expiryDateCell = row.getCell(5);
            if (report.expiry_date === 'N/A') {
                expiryDateCell.font = { color: { argb: 'FFFF9900' } };  // Orange for N/A
            } else if (typeof report.expiry_date === 'string') {
                const expiryDate = new Date(report.expiry_date);
                const today = new Date();
                if (expiryDate < today) {
                    expiryDateCell.font = { color: { argb: 'FFFF0000' } };  // Red for expired
                } else {
                    expiryDateCell.font = { color: { argb: 'FF008000' } };  // Green for valid
                }
            }

            // Add hyperlinks for TCC Cert and Screenshot
            if (report.pdf_link) {
                row.getCell(7).value = {
                    text: 'View TCC',
                    hyperlink: report.pdf_link,
                    tooltip: 'Click to view TCC'
                };
                row.getCell(7).font = { color: { argb: 'FF0000FF' }, underline: true };
            }
            if (report.screenshot_link) {
                row.getCell(8).value = {
                    text: 'View Screenshot',
                    hyperlink: report.screenshot_link,
                    tooltip: 'Click to view Screenshot'
                };
                row.getCell(8).font = { color: { argb: 'FF0000FF' }, underline: true };
            }

            // Alternating row colors
            if (index % 2 === 1) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF0F0F0' }  // Very light grey for alternating rows
                    };
                });
            }

            // Add borders to all cells in the row
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const cellLength = cell.value ? cell.value.toString().length : 10;
                if (cellLength > maxLength) {
                    maxLength = cellLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength;
        });

        // Generate and download the file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'tcc_reports.xlsx';
        link.click();
    };

    return (
        <Tabs defaultValue="summary" onValueChange={setActiveTab}>
            <TabsList>
                <TabsTrigger value="summary">Summary View</TabsTrigger>
                <TabsTrigger value="detailed">Detailed View</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
                <div className="flex justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search across all fields..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 w-64"
                            />
                        </div>
                        <div className="flex space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsCategoryFilterOpen(true)}
                            >
                                <Filter className="h-4 w-4 mr-2" />
                                Client Categories {filteredReports.length}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowStatsRows(!showStatsRows)}
                            >
                                {showStatsRows ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                                {showStatsRows ? 'Hide Stats' : 'Show Stats'}
                            </Button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={exportToExcel} size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Export to Excel
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => fetchReports()}>
                                <RefreshCw 
                                    className="mr-2 h-4 w-4" 
                                    style={autoRefreshEnabled ? { animation: 'spin 3s linear infinite' } : {}} 
                                />
                                Refresh
                            </Button>
                            
                            <div className="flex items-center gap-1 border rounded-md p-1">
                                <Switch 
                                    checked={autoRefreshEnabled}
                                    onCheckedChange={setAutoRefreshEnabled}
                                    id="auto-refresh-switch"
                                    size="sm"
                                />
                                <Label htmlFor="auto-refresh-switch" className="text-xs whitespace-nowrap">Auto ({refreshInterval}s)</Label>
                                
                                <Select 
                                    value={refreshInterval.toString()} 
                                    onValueChange={(value) => setRefreshInterval(parseInt(value))}
                                    disabled={!autoRefreshEnabled}
                                >
                                    <SelectTrigger className="h-7 w-16">
                                        <SelectValue placeholder="30s" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10s</SelectItem>
                                        <SelectItem value="30">30s</SelectItem>
                                        <SelectItem value="60">1m</SelectItem>
                                        <SelectItem value="300">5m</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={selectedRows.length === 0 || isProcessing}
                            onClick={() => handleRunSelected()}
                        >
                            <Play className="mr-2 h-4 w-4" />
                            Run Selected ({selectedRows.length})
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleRunMissing()}
                        >
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Run Missing
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="ml-auto">
                                    Columns <MoreHorizontal className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {Object.keys(visibleColumns).map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column}
                                        className="capitalize"
                                        checked={visibleColumns[column]}
                                        onCheckedChange={(value) =>
                                            setVisibleColumns((prev) => ({ ...prev, [column]: value }))
                                        }
                                    >
                                        {column.replace('_', ' ')}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <ClientCategoryFilter
                        open={isCategoryFilterOpen}
                        onOpenChange={setIsCategoryFilterOpen}
                        onFilterChange={handleApplyFilters}
                        showSectionName=""
                        initialFilters={categoryFilters}
                        showSectionStatus={false}
                    />
                </div>
                <div className="border rounded-md flex-1 flex flex-col">
                    <ScrollArea className="h-[75vh]" style={{ overflowY: 'auto' }}>
                        <Table>
                            <TableHeader className="sticky top-0 bg-white z-10">
                                <TableRow>
                                    <TableHead className="w-[50px] text-center" rowSpan={showStatsRows ? 3 : 1}>
                                        <Checkbox
                                            checked={selectedRows.length === filteredReports.length && filteredReports.length > 0}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedRows(filteredReports.map(report => report.id));
                                                } else {
                                                    setSelectedRows([]);
                                                }
                                            }}
                                        />
                                    </TableHead>
                                    {[
                                        { key: 'index', label: 'IDX', alwaysVisible: true },
                                        { key: 'company_name', label: 'Company Name' },
                                        { key: 'company_pin', label: 'KRA PIN' },
                                        { key: 'expiry_date', label: 'Expiry Date' },
                                        { key: 'days_to_go', label: 'Days', alwaysVisible: true },
                                        { key: 'doc_status', label: 'Status', alwaysVisible: true },
                                        { key: 'extraction_date', label: 'Last Extracted', alwaysVisible: true },
                                        { key: 'tcc_cert', label: 'TCC Cert', alwaysVisible: true },
                                        { key: 'screenshot', label: 'Screenshot', alwaysVisible: true },
                                        { key: 'action', label: 'Action', alwaysVisible: true }
                                    ].map(({ key, label, alwaysVisible }) => (
                                        (alwaysVisible || visibleColumns[key]) && (
                                            <TableHead key={key} className={`font-bold border-r border-gray-300 ${key === 'index' ? 'text-center sticky left-0 bg-white' : ''}`}>
                                                <div className="flex items-center justify-between">
                                                    {label}
                                                    {key !== 'tcc_cert' && key !== 'screenshot' && key !== 'action' && key !== 'doc_status' && (
                                                        <ArrowUpDown className="h-4 w-4 cursor-pointer" onClick={() => handleSort(key)} />
                                                    )}
                                                </div>
                                            </TableHead>
                                        )
                                    ))}
                                </TableRow>
                                {showStatsRows && (
                                    <>
                                        <TableRow className="bg-gray-100">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-gray-300 sticky left-0 bg-gray-100">Complete</TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.company_name === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.company_name}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.company_pin === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.company_pin}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.expiry_date === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.expiry_date}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.days_to_go === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.days_to_go}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.doc_status === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.doc_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.extraction_date === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.extraction_date}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.pdf_link === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.pdf_link}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.complete.screenshot_link === filteredReports.length ? 'text-green-600 font-bold' : ''}>
                                                    {stats.complete.screenshot_link}
                                                </span>
                                            </TableCell>
                                            {/* Action column - blank cell for stats row */}
                                            <TableCell className="text-center text-[10px] border-r border-gray-300"></TableCell>
                                        </TableRow>
                                        <TableRow className="bg-gray-50">
                                            <TableCell className="text-center text-[10px] font-bold border-r border-gray-300 sticky left-0 bg-gray-50">Missing</TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.company_name > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.company_name}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.company_pin > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.company_pin}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.expiry_date > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.expiry_date}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.days_to_go > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.days_to_go}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.doc_status > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.doc_status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.extraction_date > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.extraction_date}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.pdf_link > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.pdf_link}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-[10px] border-r border-gray-300">
                                                <span className={stats.missing.screenshot_link > 0 ? 'text-red-600 font-bold' : ''}>
                                                    {stats.missing.screenshot_link}
                                                </span>
                                            </TableCell>
                                            {/* Action column - blank cell for stats row */}
                                            <TableCell className="text-center text-[10px] border-r border-gray-300"></TableCell>
                                        </TableRow>
                                    </>
                                )}
                            </TableHeader>
                            <TableBody>
                                {sortedReports.length > 0 ? (
                                    sortedReports.map((report, index) => (
                                        <TableRow key={report.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <TableCell className="text-center w-[50px]">
                                                <Checkbox
                                                    checked={selectedRows.includes(report.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedRows(prev => [...prev, report.id]);
                                                        } else {
                                                            setSelectedRows(prev => prev.filter(id => id !== report.id));
                                                        }
                                                    }}
                                                />
                                            </TableCell>
                                            {[
                                                {
                                                    key: 'index', content: <div className="text-center">
                                                        <span>{index + 1}</span>
                                                    </div>, alwaysVisible: true
                                                },
                                                { key: 'company_name', content: report.company_name },
                                                {
                                                    key: 'company_pin', content: typeof report.company_pin === 'string' ?
                                                        (report.company_pin === "MISSING PIN/PASSWORD" ? <span className="text-red-500">{report.company_pin}</span> : report.company_pin) :
                                                        report.company_pin
                                                },
                                                {
                                                    key: 'expiry_date', content: (
                                                        <span className={`font-bold text-center ${report.expiry_status_color}`}>
                                                            {report.expiry_date}
                                                        </span>
                                                    )
                                                },
                                                {
                                                    key: 'days_to_go',
                                                    content: (
                                                        <div className="text-center">
                                                            <span className={`font-bold  ${report.expiry_status_color}`}>
                                                                {report.days_to_go !== null ? report.days_to_go : '-'}
                                                            </span>
                                                        </div>
                                                    ),
                                                    alwaysVisible: true
                                                },
                                                {
                                                    key: 'doc_status',
                                                    content: (
                                                        <div className="text-center">
                                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${report.expiry_status_color} bg-opacity-10`}>
                                                                {report.expiry_status || 'Unknown'}
                                                            </span>
                                                        </div>
                                                    ),
                                                    alwaysVisible: true
                                                },
                                                {
                                                    key: 'extraction_date',
                                                    content: (() => {
                                                        // Helper function to check if date is valid
                                                        const isValidDate = (date) => {
                                                            if (!date) return false;
                                                            const d = new Date(date);
                                                            return !isNaN(d.getTime());
                                                        };

                                                        if (!report.extraction_date) {
                                                            return <div className="text-center">Not extracted</div>;
                                                        }

                                                        // Check if extraction_date is a valid date string
                                                        if (isValidDate(report.extraction_date)) {
                                                            return (
                                                                <div className="text-center">
                                                                    <span className="text-xs">
                                                                        {(() => {
                                                                            try {
                                                                                const date = new Date(report.extraction_date);
                                                                                if (isNaN(date.getTime())) {
                                                                                    return report.extraction_date.toString();
                                                                                }
                                                                                
                                                                                // Format dd/mm/yyyy part
                                                                                const day = date.getDate().toString().padStart(2, '0');
                                                                                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                                                                                const year = date.getFullYear();
                                                                                const datePart = `${day}/${month}/${year}`;
                                                                                
                                                                                // Format time part - safer approach
                                                                                const hours = date.getHours();
                                                                                const minutes = date.getMinutes().toString().padStart(2, '0');
                                                                                const seconds = date.getSeconds().toString().padStart(2, '0');
                                                                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                                                                const formattedHours = (hours % 12 || 12).toString().padStart(2, '0');
                                                                                
                                                                                const timePart = `${formattedHours}:${minutes}:${seconds} ${ampm}`;
                                                                                
                                                                                // Combine with the pipe separator
                                                                                return `${datePart} | ${timePart}`;
                                                                            } catch (error) {
                                                                                console.error('Error formatting date:', error);
                                                                                return report.extraction_date ? report.extraction_date.toString() : 'N/A';
                                                                            }
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                            );
                                                        } else {
                                                            // If it's not a valid date but exists, display as is
                                                            return <div className="text-center">{report.extraction_date.toString()}</div>;
                                                        }
                                                    })(),
                                                    alwaysVisible: true
                                                },
                                                {
                                                    key: 'tcc_cert',
                                                    content: (
                                                        report.pdf_link && report.pdf_link !== "no doc" ? (
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <button className="text-blue-500 hover:underline flex items-center">
                                                                        <FileIcon className="mr-1 h-4 w-4" />
                                                                        View
                                                                    </button>
                                                                </DialogTrigger>
                                                                <DialogContent className="w-full max-w-5xl max-h-[90vh]">
                                                                    <DialogHeader>
                                                                        <DialogTitle>TCC Document</DialogTitle>
                                                                    </DialogHeader>
                                                                    {/* Helper function for formatting document source paths */}
                                                                    {(() => {
                                                                        // Format PDF source path for iframe
                                                                        const formatPdfSource = (pdfPath) => {
                                                                            if (!pdfPath) return '';

                                                                            // Check if it's a URL or a file path
                                                                            const isUrl = pdfPath.startsWith('http://') || pdfPath.startsWith('https://');

                                                                            if (isUrl) {
                                                                                // For URLs, just add the PDF viewer parameters
                                                                                return `${pdfPath}#toolbar=0&navpanes=0&view=FitH&zoom=40&embedded=true`;
                                                                            } else {
                                                                                // For file paths, convert to file URL format
                                                                                // Replace backslashes with forward slashes and encode the path
                                                                                const normalizedPath = pdfPath.replace(/\\/g, '/');
                                                                                return `file:///${encodeURI(normalizedPath)}#toolbar=0&navpanes=0&view=FitH&zoom=40&embedded=true`;
                                                                            }
                                                                        };

                                                                        const pdfSource = formatPdfSource(report.pdf_link);
                                                                        return (
                                                                            <iframe
                                                                                src={pdfSource}
                                                                                className="w-full h-[80vh]"
                                                                                onError={(e) => console.error("Error loading PDF:", e)}
                                                                            />
                                                                        );
                                                                    })()}
                                                                </DialogContent>
                                                            </Dialog>
                                                        ) : (
                                                            <span className="text-gray-500">
                                                                Missing
                                                            </span>
                                                        )
                                                    ),
                                                    alwaysVisible: true
                                                },
                                                {
                                                    key: 'screenshot',
                                                    content: (
                                                        report.screenshot_link && report.screenshot_link !== "no doc" ? (
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <button className="text-blue-500 hover:underline flex items-center">
                                                                        <ImageIcon className="mr-1 h-4 w-4" />
                                                                        View
                                                                    </button>
                                                                </DialogTrigger>
                                                                <DialogContent className="w-full max-w-5xl max-h-[90vh]">
                                                                    <DialogHeader>
                                                                        <DialogTitle>Screenshot</DialogTitle>
                                                                    </DialogHeader>
                                                                    <Image
                                                                        src={report.screenshot_link}
                                                                        alt="Screenshot"
                                                                        width={400}
                                                                        height={300}
                                                                        className="w-full h-auto max-h-[80vh] object-contain"
                                                                    />
                                                                </DialogContent>
                                                            </Dialog>
                                                        ) : (
                                                            <span className="text-gray-500">
                                                                Missing
                                                            </span>
                                                        )
                                                    ),
                                                    alwaysVisible: true
                                                },
                                                {
                                                    key: 'action',
                                                    content: (
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 px-2"
                                                                disabled={isProcessing}
                                                                onClick={() => handleRunSingle(report.id)}
                                                            >
                                                                <Play className="h-3 w-3" />
                                                                Run
                                                            </Button>
                                                        </div>
                                                    ),
                                                    alwaysVisible: true
                                                }
                                            ].map(({ key, content, alwaysVisible }) => (
                                                (alwaysVisible || visibleColumns[key]) && (
                                                    <TableCell key={key} className={`border-r border-gray-300 ${key === 'index' ? 'font-bold text-center sticky left-0 bg-inherit' : ''}`}>
                                                        {content}
                                                    </TableCell>
                                                )
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center py-8">
                                            No records found matching your search criteria.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {/* Add a spacer row at the bottom to ensure visibility of all items */}
                                <TableRow key="spacer-row" className="h-10"></TableRow>
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </TabsContent>
            <TabsContent value="detailed">
                <div className="flex space-x-8 mb-4">
                    <div className="w-1/4">
                        <div className="flex items-center mb-2 gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search companies..."
                                    value={detailedViewSearchTerm}
                                    onChange={(e) => setDetailedViewSearchTerm(e.target.value)}
                                    className="pl-8 w-full"
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsCategoryFilterOpen(true)}
                            >
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>
                        <ScrollArea className="h-[600px] rounded-md border border-gray-300" style={{ overflowY: 'auto' }}>
                            {getFilteredDetailedViewCompanies().map((report, index) => (
                                <React.Fragment key={report.id}>
                                    <div
                                        className={`p-2 cursor-pointer transition-colors duration-200 text-xs uppercase ${selectedCompany?.id === report.id
                                                ? 'bg-gray-500 text-white font-bold'
                                                : 'hover:bg-gray-100'
                                            }`}
                                        onClick={() => setSelectedCompany(report)}
                                    >
                                        {report.company_name}
                                    </div>
                                    {index < reports.length - 1 && (
                                        <div className="border-b border-gray-300"></div>
                                    )}
                                </React.Fragment>
                            ))}
                        </ScrollArea>
                        <div className="mt-2 text-xs text-gray-500">
                            Showing {getFilteredDetailedViewCompanies().length} of {reports.length} companies
                        </div>
                    </div>
                    <div className="flex-1">
                        {selectedCompany && (
                            <Card className="shadow-lg">
                                <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                                    <CardTitle className="text-xl">{selectedCompany.company_name}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <ScrollArea className="h-[600px]">
                                        <div className='text-xs'>
                                            <h4 className="font-medium my-3 text-sm">Full Table Data</h4>
                                            <Table>
                                                <TableHeader className="bg-gray-100">
                                                    <TableRow>
                                                        <TableHead className="text-center text-xs border-r border-gray-300">Serial No</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">PIN</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Taxpayer Name</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Status</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">TCC Cert</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Screenshot</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Certificate Date</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Expiry Date</TableHead>
                                                        <TableHead className="text-xs border-r border-gray-300">Certificate Serial No</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedCompany.full_table_data && selectedCompany.full_table_data.length > 0 ? (
                                                        selectedCompany.full_table_data.map((row, index) => {
                                                            const isApproved = row.Status === 'Approved'
                                                            return (
                                                                <TableRow key={index}>
                                                                    <TableCell className="text-center text-xs border-r border-gray-300">{row.SerialNo}</TableCell>
                                                                    <TableCell className="text-xs border-r border-gray-300">{row.PIN}</TableCell>
                                                                    <TableCell className="text-xs border-r border-gray-300">{row.TaxPayerName}</TableCell>
                                                                    <TableCell className="border-r border-gray-300">
                                                                        <span className={`px-2 py-1 rounded-full text-xxs font-semibold ${row.Status === 'Approved' ? 'bg-green-100 text-green-800' :
                                                                            row.Status === 'Expired' ? 'bg-red-100 text-red-800' :
                                                                                'bg-yellow-100 text-yellow-800'
                                                                            }`}>
                                                                            {row.Status}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell className="text-xs border-r border-gray-300">
                                                                        {/* Use the extraction's pdf_link since it's not in each row */}
                                                                        {selectedCompany.pdf_link && selectedCompany.pdf_link !== "no doc" ? (
                                                                            <Dialog>
                                                                                <DialogTrigger asChild>
                                                                                    <button className="text-blue-500 hover:underline flex items-center text-xs">
                                                                                        <FileIcon className="mr-1 h-3 w-3" />
                                                                                        View
                                                                                    </button>
                                                                                </DialogTrigger>
                                                                                <DialogContent className="w-full max-w-5xl max-h-[90vh]">
                                                                                    <DialogHeader>
                                                                                        <DialogTitle>TCC Document</DialogTitle>
                                                                                    </DialogHeader>
                                                                                    <iframe
                                                                                        src={`${selectedCompany.pdf_link}#toolbar=0&navpanes=0&view=FitH&zoom=40&embedded=true`}
                                                                                        className="w-full h-[80vh]"
                                                                                        title="TCC Certificate"
                                                                                    />
                                                                                </DialogContent>
                                                                            </Dialog>
                                                                        ) : (
                                                                            <span className="text-gray-500 text-xs">Missing</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs border-r border-gray-300">
                                                                        {/* Use the extraction's screenshot_link since it's not in each row */}
                                                                        {selectedCompany.screenshot_link && selectedCompany.screenshot_link !== "no doc" ? (
                                                                            <Dialog>
                                                                                <DialogTrigger asChild>
                                                                                    <button className="text-blue-500 hover:underline flex items-center text-xs">
                                                                                        <ImageIcon className="mr-1 h-3 w-3" />
                                                                                        View
                                                                                    </button>
                                                                                </DialogTrigger>
                                                                                <DialogContent className="w-full max-w-5xl max-h-[90vh]">
                                                                                    <DialogHeader>
                                                                                        <DialogTitle>Screenshot</DialogTitle>
                                                                                    </DialogHeader>
                                                                                    <Image
                                                                                        src={selectedCompany.screenshot_link}
                                                                                        alt="Screenshot"
                                                                                        width={400}
                                                                                        height={300}
                                                                                        className="w-full h-auto max-h-[80vh] object-contain"
                                                                                    />
                                                                                </DialogContent>
                                                                            </Dialog>
                                                                        ) : (
                                                                            <span className="text-gray-500 text-xs">Missing</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="font-bold text-xs border-r border-gray-300">{row.CertificateDate}</TableCell>
                                                                    <TableCell className={`font-bold text-xs border-r border-gray-300 ${isApproved ? 'text-green-500' : 'text-red-500'}`}>
                                                                        {row.ExpiryDate}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs border-r border-gray-300">{row.CertificateSerialNo}</TableCell>
                                                                </TableRow>
                                                            )
                                                        })
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={9} className="text-center py-4 text-red-500">
                                                                No table data available
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                    {/* Add a spacer row at the bottom to ensure visibility of all items */}
                                                    <TableRow key="detailed-spacer-row" className="h-10"></TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                    
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </TabsContent>
        </Tabs>
    );
}